const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('./sqliteRuntime');
const { getAccountDataPaths } = require('./accountDataPaths');
const {
  openOrCreateDataset,
  readJson,
  resolveInside,
  stableId,
} = require('./jewelryDataset');
const { openGroupRecordStore } = require('./groupRecordStore');
const { validateResourceDescriptor } = require('./noteResourceDownloader');

const TASK_STATUSES = new Set([
  'pending',
  'running',
  'needs_manual',
  'failed',
  'completed',
]);

function openStateDatabase(datasetDir) {
  const rootDir = path.resolve(datasetDir);
  openOrCreateDataset({ rootDir });
  const db = new DatabaseSync(path.join(rootDir, 'dataset.db'));
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS note_hydration_state (
      task_id TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      last_attempt_at TEXT,
      updated_at TEXT NOT NULL
    );
  `);
  return db;
}

function readTaskStates(datasetDir) {
  const db = openStateDatabase(datasetDir);
  try {
    return new Map(
      db.prepare('SELECT * FROM note_hydration_state').all().map((row) => [
        row.task_id,
        {
          status: row.status,
          attempts: Number(row.attempts) || 0,
          lastError: row.last_error || null,
          lastAttemptAt: row.last_attempt_at || null,
          updatedAt: row.updated_at || null,
        },
      ])
    );
  } finally {
    db.close();
  }
}

function updateNoteHydrationTaskState({
  datasetDir,
  taskId,
  status,
  error = null,
  incrementAttempt = false,
}) {
  if (!taskId) throw new Error('缺少笔记补齐任务 ID');
  if (!TASK_STATUSES.has(status)) throw new Error('未知笔记补齐状态: ' + status);

  const db = openStateDatabase(datasetDir);
  try {
    const current = db.prepare(
      'SELECT attempts, last_attempt_at FROM note_hydration_state WHERE task_id = ?'
    ).get(taskId);
    const now = new Date().toISOString();
    const attempts = (Number(current?.attempts) || 0) + (incrementAttempt ? 1 : 0);
    const lastAttemptAt = incrementAttempt ? now : current?.last_attempt_at || null;
    db.prepare(`
      INSERT INTO note_hydration_state (
        task_id, status, attempts, last_error, last_attempt_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(task_id) DO UPDATE SET
        status = excluded.status,
        attempts = excluded.attempts,
        last_error = excluded.last_error,
        last_attempt_at = excluded.last_attempt_at,
        updated_at = excluded.updated_at
    `).run(
      taskId,
      status,
      attempts,
      error || null,
      lastAttemptAt,
      now
    );
    return {
      taskId,
      status,
      attempts,
      lastError: error || null,
      lastAttemptAt,
      updatedAt: now,
    };
  } finally {
    db.close();
  }
}

function sourceMessageKey(message) {
  return String(Number(message?.id) || 0) + ':' + String(Number(message?.createTime) || 0);
}

function findSourceMessage(message, byServerId, byLocalTime, byTime) {
  const serverId = String(message.sourceServerId || '');
  if (serverId && serverId !== '0' && byServerId.has(serverId)) {
    return byServerId.get(serverId);
  }
  const localKey = String(Number(message.sourceLocalId) || 0) + ':' +
    String(Number(message.createTime) || 0);
  if (byLocalTime.has(localKey)) return byLocalTime.get(localKey);
  const timeCandidates = byTime.get(Number(message.createTime) || 0) || [];
  return timeCandidates.find((item) =>
    !message.senderWxid || !item.senderWxid || item.senderWxid === message.senderWxid
  ) || null;
}

function noteText(sourceMessage, datasetMessage) {
  const textItems = (sourceMessage?.extra?.recordItems || [])
    .filter((item) => item?.kind === 'text')
    .map((item) => String(item.dataDesc || '').trim())
    .filter(Boolean);
  return textItems.join('\n') ||
    String(sourceMessage?.extra?.recordText || '').trim() ||
    String(datasetMessage?.text || '').trim();
}

function isImageAvailable(datasetDir, image) {
  if (!image?.relativePath || image.relativePath.endsWith('.missing')) return false;
  try {
    return fs.existsSync(resolveInside(datasetDir, image.relativePath));
  } catch {
    return false;
  }
}

async function listNoteHydrationTasks({
  datasetDir,
  username,
  includeResourceDescriptors = false,
  startTime = null,
  endTime = null,
}) {
  if (!datasetDir) throw new Error('缺少账号数据集目录');
  if (!username) throw new Error('缺少当前群 ID');

  const { manifest } = openOrCreateDataset({ rootDir: datasetDir });
  const entry = (manifest.conversations || []).find((item) => item.username === username);
  if (!entry) {
    return {
      tasks: [],
      summary: {
        totalNotes: 0,
        pendingNotes: 0,
        completedNotes: 0,
        expectedImages: 0,
        availableImages: 0,
        missingImages: 0,
        downloadableImages: 0,
      },
    };
  }

  const conversation = readJson(resolveInside(datasetDir, entry.messageFile), { messages: [] });
  const recordDbPath = getAccountDataPaths(datasetDir).groupRecordDbPath;
  const store = await openGroupRecordStore(recordDbPath);
  let sourceMessages;
  try {
    sourceMessages = store.loadAllMessages({ username, startTime, endTime });
  } finally {
    store.close();
  }

  const byServerId = new Map();
  const byLocalTime = new Map();
  const byTime = new Map();
  for (const message of sourceMessages) {
    const serverId = String(message.serverId || '');
    if (serverId && serverId !== '0') byServerId.set(serverId, message);
    byLocalTime.set(sourceMessageKey(message), message);
    const createTime = Number(message.createTime) || 0;
    if (!byTime.has(createTime)) byTime.set(createTime, []);
    byTime.get(createTime).push(message);
  }

  const states = readTaskStates(datasetDir);
  const tasks = [];
  for (const message of conversation.messages || []) {
    const createTime = Number(message.createTime) || 0;
    if (startTime != null && createTime < Number(startTime)) continue;
    if (endTime != null && createTime > Number(endTime)) continue;
    const sourceMessage = findSourceMessage(message, byServerId, byLocalTime, byTime);
    const recordItems = (sourceMessage?.extra?.recordItems || [])
      .filter((item) => item?.kind === 'image');
    if (!recordItems.length) continue;

    const datasetImages = Array.isArray(message.images) ? message.images : [];
    const imageItems = recordItems.map((recordItem, index) => {
      const image = datasetImages[index] || null;
      const available = isImageAvailable(datasetDir, image);
      const resourceDescriptor = {
        fullMd5: recordItem.fullMd5 || null,
        cdnDataUrl: recordItem.cdnDataUrl || null,
        cdnDataKey: recordItem.cdnDataKey || null,
        dataSize: Number(recordItem.dataSize) || 0,
      };
      const resourceDownloadable = validateResourceDescriptor(resourceDescriptor).ok;
      return {
        index,
        imageId: image?.imageId || null,
        available,
        processable: image?.classificationEligible !== false && image?.isRealImage !== false,
        fullMd5: recordItem.fullMd5 || null,
        thumbFullMd5: recordItem.thumbFullMd5 || null,
        resourceDownloadable,
        ...(includeResourceDescriptors && resourceDownloadable ? { resourceDescriptor } : {}),
      };
    }).filter((item) => item.processable).map(({ processable, ...item }) => item);
    if (!imageItems.length) continue;
    const availableCount = imageItems.filter((item) => item.available).length;
    const expectedCount = imageItems.length;
    const missingCount = expectedCount - availableCount;
    const taskId = stableId('note', entry.conversationId + ':' + message.messageId);
    const savedState = states.get(taskId) || null;
    let status = missingCount === 0 ? 'completed' : savedState?.status || 'pending';
    if (status === 'running' || missingCount > 0 && status === 'completed') status = 'pending';
    if (!TASK_STATUSES.has(status)) status = 'pending';

    const messageText = noteText(sourceMessage, message);
    tasks.push({
      taskId,
      conversationId: entry.conversationId,
      username,
      displayName: entry.displayName,
      messageId: message.messageId,
      sourceLocalId: Number(message.sourceLocalId) || 0,
      sourceServerId: message.sourceServerId || null,
      createTime: Number(message.createTime) || 0,
      datetime: message.datetime || null,
      senderWxid: message.senderWxid || null,
      senderName: message.senderName || message.senderWxid || null,
      messageText,
      matchText: messageText.replace(/\s+/g, '').slice(0, 80),
      expectedCount,
      availableCount,
      missingCount,
      imageItems,
      status,
      attempts: savedState?.attempts || 0,
      lastError: missingCount === 0 ? null : savedState?.lastError || null,
      lastAttemptAt: savedState?.lastAttemptAt || null,
      updatedAt: savedState?.updatedAt || null,
    });
  }

  tasks.sort((a, b) => b.createTime - a.createTime || b.sourceLocalId - a.sourceLocalId);
  return {
    tasks,
    summary: {
      totalNotes: tasks.length,
      pendingNotes: tasks.filter((task) => task.missingCount > 0).length,
      completedNotes: tasks.filter((task) => task.missingCount === 0).length,
      expectedImages: tasks.reduce((sum, task) => sum + task.expectedCount, 0),
      availableImages: tasks.reduce((sum, task) => sum + task.availableCount, 0),
      missingImages: tasks.reduce((sum, task) => sum + task.missingCount, 0),
      downloadableImages: tasks.reduce((sum, task) => sum + task.imageItems.filter(
        (item) => !item.available && item.resourceDownloadable
      ).length, 0),
    },
  };
}

module.exports = {
  TASK_STATUSES,
  listNoteHydrationTasks,
  updateNoteHydrationTaskState,
};
