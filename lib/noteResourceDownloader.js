const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { getAccountDataPaths } = require('./accountDataPaths');

const MAX_NOTE_RESOURCE_BYTES = 64 * 1024 * 1024;
const MAX_DESCRIPTOR_HEX_CHARS = 32 * 1024;
const HASH_BUFFER_BYTES = 1024 * 1024;
let activeRun = null;

function validateResourceDescriptor(input) {
  const fullMd5 = String(input?.fullMd5 || '').trim().toLowerCase();
  const cdnDataUrl = String(input?.cdnDataUrl || '').trim();
  const cdnDataKey = String(input?.cdnDataKey || '').trim();
  const dataSize = Number(input?.dataSize);
  const errors = [];
  if (!/^[a-f0-9]{32}$/.test(fullMd5)) errors.push('invalid-md5');
  if (
    !/^[a-f0-9]+$/i.test(cdnDataUrl) ||
    cdnDataUrl.length % 2 !== 0 ||
    cdnDataUrl.length > MAX_DESCRIPTOR_HEX_CHARS
  ) {
    errors.push('invalid-url-descriptor');
  }
  if (
    !/^[a-f0-9]+$/i.test(cdnDataKey) ||
    cdnDataKey.length % 2 !== 0 ||
    cdnDataKey.length > MAX_DESCRIPTOR_HEX_CHARS
  ) {
    errors.push('invalid-data-key');
  }
  if (!Number.isSafeInteger(dataSize) || dataSize <= 0) errors.push('invalid-data-size');
  if (dataSize > MAX_NOTE_RESOURCE_BYTES) errors.push('resource-too-large');
  return {
    ok: errors.length === 0,
    errors,
    value: errors.length === 0
      ? { fullMd5, cdnDataUrl, cdnDataKey, dataSize }
      : null,
  };
}

function inspectResourceFile(filePath, descriptor) {
  if (!fs.existsSync(filePath)) return { ok: false, reason: 'missing' };
  const stat = fs.statSync(filePath);
  if (!stat.isFile() || stat.size <= 0) return { ok: false, reason: 'empty' };
  if (stat.size > MAX_NOTE_RESOURCE_BYTES) {
    return { ok: false, reason: 'resource-too-large', size: stat.size };
  }
  if (descriptor.dataSize && stat.size !== descriptor.dataSize) {
    return { ok: false, reason: 'size-mismatch', size: stat.size };
  }
  const hash = crypto.createHash('md5');
  const buffer = Buffer.allocUnsafe(Math.min(HASH_BUFFER_BYTES, stat.size));
  const fd = fs.openSync(filePath, 'r');
  try {
    let bytesRead;
    while ((bytesRead = fs.readSync(fd, buffer, 0, buffer.length, null)) > 0) {
      hash.update(buffer.subarray(0, bytesRead));
    }
  } finally {
    fs.closeSync(fd);
  }
  const md5 = hash.digest('hex');
  if (md5 !== descriptor.fullMd5) return { ok: false, reason: 'md5-mismatch', md5 };
  return { ok: true, size: stat.size, md5 };
}

function collectResources(tasks) {
  const resources = new Map();
  const taskMd5s = new Map();
  const taskInvalidCounts = new Map();
  let invalidCount = 0;
  for (const task of tasks || []) {
    const md5s = new Set();
    let taskInvalidCount = 0;
    for (const image of task?.imageItems || []) {
      if (image.available) continue;
      const validation = validateResourceDescriptor(image.resourceDescriptor);
      if (!validation.ok) {
        invalidCount += 1;
        taskInvalidCount += 1;
        continue;
      }
      md5s.add(validation.value.fullMd5);
      if (!resources.has(validation.value.fullMd5)) {
        resources.set(validation.value.fullMd5, validation.value);
      }
    }
    taskMd5s.set(task.taskId, md5s);
    taskInvalidCounts.set(task.taskId, taskInvalidCount);
  }
  return { resources: [...resources.values()], taskMd5s, taskInvalidCounts, invalidCount };
}

function createLocalCacheProvider() {
  return {
    name: 'local-cache-only',
    available: false,
    async download() {
      throw new Error('Remote note resource downloads are disabled');
    },
  };
}
function atomicPromote(tempPath, finalPath) {
  if (fs.existsSync(finalPath)) fs.unlinkSync(finalPath);
  fs.renameSync(tempPath, finalPath);
}

async function downloadNoteResources({
  datasetDir,
  tasks,
  provider = null,
}, onProgress = null) {
  if (activeRun) throw new Error('已有笔记资源下载任务正在运行');
  const selectedTasks = (tasks || []).filter((task) => task?.taskId && Number(task.missingCount) > 0);
  const collected = collectResources(selectedTasks);
  const cacheDir = getAccountDataPaths(datasetDir).noteResourceCacheDir;
  fs.mkdirSync(cacheDir, { recursive: true });
  const resolvedProvider = provider || createLocalCacheProvider();
  const run = {};
  activeRun = run;
  const availableMd5s = new Set();
  const errors = [];
  let cached = 0;
  let downloaded = 0;
  let attempted = 0;
  const emit = (subphase, message, extra = null) => onProgress?.({
    phase: 'note-hydration',
    subphase,
    message,
    ...(extra || {}),
  });

  try {
    emit('resource-start', `资源补齐：共 ${collected.resources.length} 个去重资源`);
    const pending = [];
    for (const descriptor of collected.resources) {
      const finalPath = path.join(cacheDir, descriptor.fullMd5 + '.bin');
      const inspected = inspectResourceFile(finalPath, descriptor);
      if (inspected.ok) {
        availableMd5s.add(descriptor.fullMd5);
        cached += 1;
      } else {
        if (fs.existsSync(finalPath)) fs.unlinkSync(finalPath);
        pending.push(descriptor);
      }
    }
    emit('resource-cache', `资源缓存命中 ${cached} 个，待下载 ${pending.length} 个`, {
      current: cached,
      total: collected.resources.length,
    });

    if (pending.length && !resolvedProvider.available) {
      emit('resource-unavailable', '本地缓存中没有剩余资源，远程下载已禁用', {
        current: cached,
        total: collected.resources.length,
      });
    } else {
      for (const descriptor of pending) {
        attempted += 1;
        const finalPath = path.join(cacheDir, descriptor.fullMd5 + '.bin');
        const tempPath = path.join(
          cacheDir,
          `.${descriptor.fullMd5}.${process.pid}.${Date.now()}.tmp`
        );
        emit('resource-download', `正在下载资源 ${attempted}/${pending.length}`, {
          current: attempted,
          total: pending.length,
        });
        try {
          const result = await resolvedProvider.download({
            descriptor,
            outputPath: tempPath,
          });
          if (Buffer.isBuffer(result)) {
            if (result.length > MAX_NOTE_RESOURCE_BYTES) {
              throw new Error('Resource exceeds the maximum allowed size');
            }
            fs.writeFileSync(tempPath, result);
          }
          const inspected = inspectResourceFile(tempPath, descriptor);
          if (!inspected.ok) throw new Error('资源校验失败: ' + inspected.reason);
          atomicPromote(tempPath, finalPath);
          availableMd5s.add(descriptor.fullMd5);
          downloaded += 1;
        } catch (err) {
          if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
          errors.push({ fullMd5: descriptor.fullMd5, error: err.message });
          emit('resource-error', `资源下载失败：${err.message}`, {
            current: attempted,
            total: pending.length,
          });
        }
      }
    }

    const hydratedTaskIds = [];
    for (const task of selectedTasks) {
      const md5s = collected.taskMd5s.get(task.taskId) || new Set();
      if (
        md5s.size > 0 &&
        !collected.taskInvalidCounts.get(task.taskId) &&
        [...md5s].every((md5) => availableMd5s.has(md5))
      ) {
        hydratedTaskIds.push(task.taskId);
      }
    }
    emit('resource-done', '资源补齐完成：缓存 ' + cached + '，下载 ' + downloaded + '，失败 ' + errors.length, {
      current: cached + downloaded,
      total: collected.resources.length,
    });
    return {
      provider: resolvedProvider.name || 'resource-provider',
      providerAvailable: Boolean(resolvedProvider.available),
      uniqueResources: collected.resources.length,
      invalidDescriptors: collected.invalidCount,
      cached,
      attempted,
      downloaded,
      errors,
      hydratedTaskIds,
    };
  } finally {
    if (activeRun === run) activeRun = null;
  }
}

function isNoteResourceDownloadRunning() {
  return Boolean(activeRun);
}

module.exports = {
  MAX_NOTE_RESOURCE_BYTES,
  collectResources,
  createLocalCacheProvider,
  downloadNoteResources,
  inspectResourceFile,
  isNoteResourceDownloadRunning,
  validateResourceDescriptor,
};
