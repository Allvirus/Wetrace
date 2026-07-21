const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  PRODUCT_CATEGORIES,
  JEWELRY_PROCESSES,
  PRODUCT_CATEGORY_IDS,
  JEWELRY_PROCESS_IDS,
} = require('./jewelryTaxonomy');
const {
  applyCodexResults,
  listStoredClassificationRuns,
  markImagesFailed,
  readDatasetItems,
  saveClassificationRun,
  validateDatasetImageAccess,
} = require('./jewelryDataset');

const CLASSIFICATION_BATCH_SIZE = 8;
let activeChild = null;
let cancelRequested = false;

function resolveWhere(commandName) {
  const executable = process.platform === 'win32' ? 'where.exe' : 'which';
  const result = spawnSync(executable, [commandName], { encoding: 'utf8', windowsHide: true });
  if (result.status !== 0) return [];
  return String(result.stdout || '').split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
}

function resolveCodexLaunch(override = null) {
  if (override?.command) return { command: override.command, prefixArgs: override.prefixArgs || [] };
  const candidates = resolveWhere('codex');
  const executable = candidates.find((item) => item.toLowerCase().endsWith('.exe'));
  if (executable) return { command: executable, prefixArgs: [] };

  const cmdShim = candidates.find((item) => item.toLowerCase().endsWith('.cmd'));
  if (cmdShim) {
    const shimDir = path.dirname(cmdShim);
    const scriptPath = path.join(shimDir, 'node_modules', '@openai', 'codex', 'bin', 'codex.js');
    const adjacentNode = path.join(shimDir, 'node.exe');
    const nodePath = fs.existsSync(adjacentNode) ? adjacentNode : resolveWhere('node')[0];
    if (nodePath && fs.existsSync(scriptPath)) {
      return { command: nodePath, prefixArgs: [scriptPath] };
    }
  }

  const plain = candidates.find((item) => fs.existsSync(item));
  if (plain) return { command: plain, prefixArgs: [] };
  throw new Error('未找到 Codex CLI，请先安装并登录 Codex');
}

function runSyncCommand(launch, args) {
  return spawnSync(launch.command, [...launch.prefixArgs, ...args], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 15000,
  });
}

function checkCodexReady(override = null) {
  const launch = resolveCodexLaunch(override);
  const help = runSyncCommand(launch, ['exec', '--help']);
  const helpText = `${help.stdout || ''}\n${help.stderr || ''}`;
  if (help.status !== 0 || !helpText.includes('--image') || !helpText.includes('--output-schema')) {
    throw new Error('当前 Codex CLI 不支持图片或结构化输出，请升级 Codex');
  }
  const login = runSyncCommand(launch, ['login', 'status']);
  if (login.status !== 0) throw new Error('Codex CLI 尚未登录，请先执行 codex login');
  return launch;
}

function createOutputSchema(imageIds) {
  return {
    type: 'object',
    additionalProperties: false,
    properties: {
      results: {
        type: 'array',
        minItems: imageIds.length,
        maxItems: imageIds.length,
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            imageId: { type: 'string', enum: imageIds },
            categoryId: { anyOf: [{ type: 'string', enum: [...PRODUCT_CATEGORY_IDS] }, { type: 'null' }] },
            categoryDecision: { type: 'string', enum: ['selected', 'uncertain'] },
            processIds: {
              type: 'array',
              uniqueItems: true,
              items: { type: 'string', enum: [...JEWELRY_PROCESS_IDS] },
            },
            processDecision: { type: 'string', enum: ['selected', 'none', 'uncertain'] },
            recognizedText: { type: 'string' },
            evidence: {
              type: 'array',
              uniqueItems: true,
              items: { type: 'string', enum: ['visual', 'image_text', 'chat_context'] },
            },
            reason: { type: 'string' },
          },
          required: [
            'imageId',
            'categoryId',
            'categoryDecision',
            'processIds',
            'processDecision',
            'recognizedText',
            'evidence',
            'reason',
          ],
        },
      },
    },
    required: ['results'],
  };
}

function formatTaxonomy(items) {
  return items.map((item) => `${item.id}=${item.name}`).join(', ');
}

function buildPrompt(items) {
  const blocks = items.map((item, index) => {
    const context = (item.context || []).map((message) =>
      `${message.datetime || message.createTime} | ${message.senderName}: ${message.text}`
    ).join('\n');
    return [
      `IMAGE ${index + 1}: ${item.imageId}`,
      `Associated message: ${item.messageText || '(none)'}`,
      'Nearby group text messages in chronological order:',
      context || '(none)',
    ].join('\n');
  }).join('\n\n');

  return [
    'Classify each attached jewelry image. Use the image, readable text inside it, and the supplied chat context.',
    'Return one result for every imageId and never invent labels.',
    `Product category is single-select: ${formatTaxonomy(PRODUCT_CATEGORIES)}.`,
    `Processes are multi-select: ${formatTaxonomy(JEWELRY_PROCESSES)}.`,
    'If product category is unclear, use categoryDecision=uncertain and categoryId=null.',
    'For processes: selected requires one or more IDs; none means clearly no listed process; uncertain means the process cannot be determined.',
    'recognizedText must contain only text actually readable in the image; use an empty string when nothing is readable.',
    'Keep reason concise and state whether visual content, image text, or chat context supported the decision.',
    '',
    blocks,
  ].join('\n');
}

function validateBatchResults(raw, items) {
  const expected = new Set(items.map((item) => item.imageId));
  const results = Array.isArray(raw?.results) ? raw.results : [];
  if (results.length !== items.length) throw new Error('Codex 返回的图片数量不完整');
  const seen = new Set();
  for (const result of results) {
    if (!expected.has(result.imageId) || seen.has(result.imageId)) throw new Error('Codex 返回了未知或重复的图片 ID');
    seen.add(result.imageId);
    if (!['selected', 'uncertain'].includes(result.categoryDecision)) {
      throw new Error('Codex 返回的品类判断状态无效');
    }
    if (result.categoryDecision === 'selected' && !PRODUCT_CATEGORY_IDS.has(result.categoryId)) {
      throw new Error('Codex 返回了无效品类');
    }
    if (result.categoryDecision === 'uncertain' && result.categoryId !== null) {
      throw new Error('Codex 返回的品类与判断状态不一致');
    }
    if (!['selected', 'none', 'uncertain'].includes(result.processDecision)) {
      throw new Error('Codex 返回的工艺判断状态无效');
    }
    if (!Array.isArray(result.processIds) || result.processIds.some((id) => !JEWELRY_PROCESS_IDS.has(id))) {
      throw new Error('Codex 返回了无效工艺');
    }
    result.processIds = [...new Set(result.processIds)];
    if (result.processDecision === 'selected' && result.processIds.length === 0) {
      throw new Error('Codex 工艺结果缺少选项');
    }
    if (result.processDecision !== 'selected' && result.processIds.length > 0) {
      throw new Error('Codex 返回的工艺与判断状态不一致');
    }
    if (typeof result.recognizedText !== 'string' || typeof result.reason !== 'string') {
      throw new Error('Codex 返回的文字或依据无效');
    }
    if (!Array.isArray(result.evidence) || result.evidence.some((value) => !['visual', 'image_text', 'chat_context'].includes(value))) {
      throw new Error('Codex 返回的证据类型无效');
    }
  }
  return results;
}

function runCodexProcess(launch, args, prompt, onEvent) {
  return new Promise((resolve, reject) => {
    let stderr = '';
    let stdoutBuffer = '';
    const child = spawn(launch.command, [...launch.prefixArgs, ...args], {
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    activeChild = child;
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      stdoutBuffer += chunk;
      const lines = stdoutBuffer.split(/\r?\n/);
      stdoutBuffer = lines.pop() || '';
      for (const line of lines) {
        if (!line.trim()) continue;
        try { onEvent?.(JSON.parse(line)); } catch { /* ignore non-JSON progress */ }
      }
    });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('exit', (code) => {
      activeChild = null;
      if (cancelRequested) reject(new Error('图片分类已取消'));
      else if (code === 0) resolve();
      else reject(new Error(stderr.trim() || `Codex 分类异常退出 (code ${code})`));
    });
    child.stdin.end(prompt, 'utf8');
  });
}

function writeRun(datasetDir, run) {
  return saveClassificationRun(datasetDir, run);
}

async function runBatch({ datasetDir, runId, batch, launch, onProgress }) {
  const taskDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wetrace-jewelry-'));
  const schemaPath = path.join(taskDir, 'schema.json');
  const resultPath = path.join(taskDir, 'result.json');
  try {
    fs.writeFileSync(schemaPath, JSON.stringify(createOutputSchema(batch.map((item) => item.imageId)), null, 2), 'utf8');
    const args = [
      'exec',
      '--ephemeral',
      '--skip-git-repo-check',
      '--sandbox',
      'read-only',
      '--json',
      '--output-schema',
      schemaPath,
      '--output-last-message',
      resultPath,
      '--cd',
      taskDir,
    ];
    for (const item of batch) args.push('--image', item.absolutePath);
    args.push('-');
    await runCodexProcess(launch, args, buildPrompt(batch), (event) => {
      onProgress?.({ phase: 'classification-event', runId, event });
    });
    const raw = JSON.parse(fs.readFileSync(resultPath, 'utf8').replace(/^\uFEFF/, ''));
    const results = validateBatchResults(raw, batch);
    applyCodexResults({
      datasetDir,
      runId,
      results,
      eligibleImageIds: batch.map((item) => item.imageId),
    });
    return results.length;
  } finally {
    fs.rmSync(taskDir, { recursive: true, force: true });
  }
}

async function runJewelryClassification({
  datasetDir,
  imageIds = null,
  eligibleStates = null,
  commandOverride = null,
  onProgress = null,
}) {
  cancelRequested = false;
  const { items } = readDatasetItems(datasetDir);
  const requested = imageIds ? new Set(imageIds) : null;
  const allowedStates = eligibleStates ? new Set(eligibleStates) : null;
  const candidates = items.filter((item) =>
    item.classificationEligible &&
    !item.annotation.manualLocked &&
    (requested ? requested.has(item.imageId) : item.annotation.state === 'pending') &&
    (!allowedStates || allowedStates.has(item.annotation.state))
  ).map((item) => validateDatasetImageAccess(datasetDir, item))
    .filter((item) => item.pathStatus === 'available');
  if (!candidates.length) return { ok: true, skipped: true, total: 0 };

  const run = {
    schemaVersion: 1,
    runId: `run_${cryptoRandomId()}`,
    status: 'running',
    createdAt: new Date().toISOString(),
    completedAt: null,
    imageIds: candidates.map((item) => item.imageId),
    total: candidates.length,
    completed: 0,
    failed: 0,
    error: null,
  };
  writeRun(datasetDir, run);
  onProgress?.({ phase: 'classification-start', runId: run.runId, total: run.total });

  let launch;
  try {
    launch = checkCodexReady(commandOverride);
  } catch (err) {
    markImagesFailed({ datasetDir, imageIds: run.imageIds, runId: run.runId, reason: err.message });
    run.status = 'failed';
    run.failed = run.total;
    run.error = err.message;
    run.completedAt = new Date().toISOString();
    writeRun(datasetDir, run);
    onProgress?.({ phase: 'classification-failed', runId: run.runId, error: err.message });
    throw err;
  }

  for (let index = 0; index < candidates.length; index += CLASSIFICATION_BATCH_SIZE) {
    const batch = candidates.slice(index, index + CLASSIFICATION_BATCH_SIZE);
    if (cancelRequested) break;
    onProgress?.({ phase: 'classification-batch', runId: run.runId, current: index, total: run.total });
    try {
      const completed = await runBatch({ datasetDir, runId: run.runId, batch, launch, onProgress });
      run.completed += completed;
    } catch (err) {
      if (cancelRequested) {
        run.error = null;
        break;
      }
      markImagesFailed({ datasetDir, imageIds: batch.map((item) => item.imageId), runId: run.runId, reason: err.message });
      run.failed += batch.length;
      run.error = err.message;
    }
    writeRun(datasetDir, run);
  }

  run.status = cancelRequested ? 'cancelled' : run.failed > 0 ? 'completed_with_errors' : 'completed';
  run.completedAt = new Date().toISOString();
  writeRun(datasetDir, run);
  onProgress?.({ phase: 'classification-done', ...run });
  return run;
}

function cryptoRandomId() {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function cancelJewelryClassification() {
  cancelRequested = true;
  if (activeChild && !activeChild.killed) activeChild.kill();
  return { cancelled: true };
}

function listClassificationRuns(datasetDir) {
  return listStoredClassificationRuns(datasetDir);
}

module.exports = {
  CLASSIFICATION_BATCH_SIZE,
  buildPrompt,
  cancelJewelryClassification,
  checkCodexReady,
  createOutputSchema,
  listClassificationRuns,
  resolveCodexLaunch,
  runJewelryClassification,
  validateBatchResults,
};
