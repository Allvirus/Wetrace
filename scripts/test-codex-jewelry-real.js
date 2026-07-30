'use strict';

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const sharp = require('sharp');
const { DatabaseSync } = require('../lib/sqliteRuntime');
const {
  atomicWriteJson,
  buildImageContext,
  openOrCreateDataset,
  readDatasetItems,
  readJson,
  resolveInside,
} = require('../lib/jewelryDataset');
const { runJewelryClassification } = require('../lib/codexJewelryClassifier');
const { TARGET_JEWELRY_GROUP_USERNAME } = require('../lib/jewelryScope');
const { sourceDay } = require('../lib/jewelryArchive');

const SOURCE_DATASET = path.resolve(process.env.WETRACE_REAL_DATASET || path.join(__dirname, '..', 'vwxyz'));
const TARGET_COUNT = Number(process.env.WETRACE_REAL_TARGET_COUNT) || 10;
const PERSIST_RESULTS = process.argv.includes('--persist-results');

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] || null : null;
}

const POSITIONAL_DATES = process.argv.slice(2).filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value));
const HAS_NAMED_DATE_ARGUMENT = ['--date', '--from', '--to'].some((name) => process.argv.includes(name));

const EXACT_DATE = argumentValue('--date') || (!HAS_NAMED_DATE_ARGUMENT && POSITIONAL_DATES.length === 1 ? POSITIONAL_DATES[0] : null);
const DATE_FROM = EXACT_DATE || argumentValue('--from') || (!HAS_NAMED_DATE_ARGUMENT ? POSITIONAL_DATES[0] || null : null);
const DATE_TO = EXACT_DATE || argumentValue('--to') || (!HAS_NAMED_DATE_ARGUMENT ? POSITIONAL_DATES[1] || null : null);

function inSelectedDateRange(value) {
  if (!DATE_FROM && !DATE_TO) return true;
  const day = sourceDay({ source: { message: value } });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  return (!DATE_FROM || day >= DATE_FROM) && (!DATE_TO || day <= DATE_TO);
}

function snapshot(filePath) {
  const stat = fs.statSync(filePath);
  return { size: stat.size, mtimeMs: stat.mtimeMs };
}

function assertUnchanged(filePath, before) {
  const after = snapshot(filePath);
  if (after.size !== before.size || after.mtimeMs !== before.mtimeMs) {
    throw new Error('Source dataset changed during the real acceptance test');
  }
}

function sourceFilePath(relativePath) {
  const root = SOURCE_DATASET;
  const target = path.resolve(root, ...String(relativePath || '').replace(/\\/g, '/').split('/'));
  const prefix = root.toLowerCase() + path.sep;
  if (!target.toLowerCase().startsWith(prefix)) throw new Error('Source media path escaped the dataset');
  return target;
}

function readCompleteGroupMessages(dbPath) {
  const db = new DatabaseSync(dbPath, { readOnly: true });
  try {
    return db.prepare([
      'SELECT local_id, server_id, type, type_name, create_time, datetime,',
      'sender_wxid, sender_name, is_self, content',
      'FROM messages WHERE username = ?',
      'ORDER BY create_time ASC, local_id ASC',
    ].join(' ')).all(TARGET_JEWELRY_GROUP_USERNAME).map((row) => ({
      id: Number(row.local_id) || 0,
      serverId: row.server_id || null,
      type: Number(row.type) || 0,
      typeName: row.type_name || '',
      createTime: Number(row.create_time) || 0,
      datetime: row.datetime || null,
      senderWxid: row.sender_wxid || null,
      senderName: row.sender_name || row.sender_wxid || null,
      isSelf: Boolean(row.is_self),
      content: row.content || '',
    }));
  } finally {
    db.close();
  }
}

function rawMessageIndex(messages, storedMessage) {
  const serverId = String(storedMessage.sourceServerId || '');
  if (serverId && serverId !== '0') {
    const index = messages.findIndex((message) => String(message.serverId || '') === serverId);
    if (index >= 0) return index;
  }
  return messages.findIndex((message) =>
    Number(message.id) === Number(storedMessage.sourceLocalId) &&
    Number(message.createTime) === Number(storedMessage.createTime)
  );
}

async function selectLatestImages(conversation) {
  const candidates = (conversation.messages || []).flatMap((message) =>
    (message.images || []).map((image) => ({ message, image }))
  ).filter(({ message, image }) =>
    inSelectedDateRange(message) &&
    image.classificationEligible !== false &&
    image.mediaKind !== 'gif' &&
    image.mediaKind !== 'emoji' &&
    !/\.gif(?:$|[?#])/i.test(String(image.relativePath || ''))
  ).sort((left, right) =>
    Number(right.message.createTime) - Number(left.message.createTime) ||
    String(right.image.imageId).localeCompare(String(left.image.imageId))
  );
  const selected = [];
  for (const candidate of candidates) {
    const absolutePath = sourceFilePath(candidate.image.relativePath);
    if (!fs.existsSync(absolutePath)) continue;
    try {
      const metadata = await sharp(absolutePath, { animated: true }).metadata();
      if (!['jpeg', 'png', 'webp', 'avif', 'tiff'].includes(metadata.format)) continue;
      if (Number(metadata.pages) > 1) continue;
      selected.push({ ...candidate, absolutePath });
    } catch {
      continue;
    }
    if (selected.length === TARGET_COUNT) break;
  }
  if (selected.length !== TARGET_COUNT) throw new Error('Fewer than 10 eligible target-group images are available');
  return selected;
}

async function selectLatestDatasetItems() {
  const candidates = readDatasetItems(SOURCE_DATASET).items.filter((item) =>
    inSelectedDateRange(item.classificationRecord.source.message) &&
    item.classificationEligible &&
    item.pathStatus === 'available' &&
    !item.annotation.manualLocked &&
    ['pending', 'failed'].includes(item.annotation.state) &&
    item.mediaKind !== 'gif' &&
    item.mediaKind !== 'emoji' &&
    !/\.gif(?:$|[?#])/i.test(String(item.relativePath || ''))
  ).sort((left, right) =>
    Number(right.createTime) - Number(left.createTime) ||
    String(right.sourceImageId).localeCompare(String(left.sourceImageId))
  );
  const selected = [];
  for (const item of candidates) {
    const absolutePath = sourceFilePath(item.relativePath);
    if (!fs.existsSync(absolutePath)) continue;
    try {
      const metadata = await sharp(absolutePath, { animated: true }).metadata();
      if (!['jpeg', 'png', 'webp', 'avif', 'tiff'].includes(metadata.format)) continue;
      if (Number(metadata.pages) > 1) continue;
      selected.push(item);
    } catch {
      continue;
    }
    if (selected.length === TARGET_COUNT) break;
  }
  if (selected.length !== TARGET_COUNT) throw new Error('Fewer than 10 unclassified target-group images are available');
  return selected;
}

function ensureSourceAccountProvenance() {
  const runtimeInfoPath = path.join(SOURCE_DATASET, 'runtime', 'db_storage_decrypted', 'info.json');
  const runtimeInfo = JSON.parse(fs.readFileSync(runtimeInfoPath, 'utf8'));
  const accountWxid = path.basename(String(runtimeInfo.wx_dir || '')).replace(/_c[a-f0-9]+$/i, '');
  if (!accountWxid) throw new Error('The source account identity cannot be traced');
  const { manifest } = openOrCreateDataset({ rootDir: SOURCE_DATASET });
  openOrCreateDataset({
    rootDir: SOURCE_DATASET,
    accountWxid,
    accountName: manifest.account?.displayName || accountWxid,
  });
}

function createTemporaryDataset(tempRoot, sourceManifest, sourceEntry, sourceConversation, selected, completeMessages, accountIdentity) {
  const datasetDir = path.join(tempRoot, 'dataset');
  const opened = openOrCreateDataset({
    rootDir: datasetDir,
    accountWxid: accountIdentity.wxid,
    accountName: accountIdentity.displayName,
  });
  const conversationId = sourceEntry.conversationId;
  const messageFile = path.posix.join('conversations', conversationId + '.json');
  const annotationFile = path.posix.join('annotations', conversationId + '.json');
  const grouped = new Map();
  for (const candidate of selected) {
    const rawIndex = rawMessageIndex(completeMessages, candidate.message);
    if (rawIndex < 0) throw new Error('A selected image message cannot be traced to full group records');
    const context = buildImageContext(TARGET_JEWELRY_GROUP_USERNAME, completeMessages, rawIndex);
    const extension = path.extname(candidate.image.relativePath).toLowerCase() || '.img';
    const relativePath = path.posix.join('media', conversationId, candidate.image.imageId + extension);
    const destination = resolveInside(datasetDir, relativePath);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(candidate.absolutePath, destination);
    const image = {
      ...candidate.image,
      absolutePath: destination,
      relativePath,
      pathStatus: 'available',
      sha256: crypto.createHash('sha256').update(fs.readFileSync(destination)).digest('hex'),
      mediaKind: 'image',
      isRealImage: true,
      classificationEligible: true,
      classificationSkipReason: null,
      context,
    };
    const stored = grouped.get(candidate.message.messageId) || {
      ...candidate.message,
      images: [],
    };
    stored.images.push(image);
    grouped.set(candidate.message.messageId, stored);
  }
  const messages = [...grouped.values()].sort((left, right) =>
    Number(left.createTime) - Number(right.createTime) ||
    Number(left.sourceLocalId) - Number(right.sourceLocalId)
  );
  opened.manifest.account = accountIdentity;
  opened.manifest.conversations = [{
    conversationId,
    username: TARGET_JEWELRY_GROUP_USERNAME,
    displayName: sourceConversation.displayName || sourceEntry.displayName,
    messageFile,
    annotationFile,
    messageCount: messages.length,
    imageCount: TARGET_COUNT,
  }];
  opened.manifest.selections = [{ username: TARGET_JEWELRY_GROUP_USERNAME }];
  atomicWriteJson(opened.paths.manifest, opened.manifest);
  atomicWriteJson(resolveInside(datasetDir, messageFile), {
    schemaVersion: 2,
    conversationId,
    username: TARGET_JEWELRY_GROUP_USERNAME,
    displayName: sourceConversation.displayName || sourceEntry.displayName,
    messages,
  });
  atomicWriteJson(resolveInside(datasetDir, annotationFile), {
    schemaVersion: 2,
    conversationId,
    items: {},
  });
  return datasetDir;
}

function validateResults(datasetDir, expectedImageIds = null) {
  const expected = expectedImageIds ? new Set(expectedImageIds) : null;
  const allItems = readDatasetItems(datasetDir).items;
  const items = expected ? allItems.filter((item) => expected.has(item.imageId)) : allItems;
  const expectedCount = expected ? expected.size : TARGET_COUNT;
  if (items.length !== expectedCount) throw new Error('SQLite dataset does not contain the expected result set');
  const guids = new Set(items.map((item) => item.imageId));
  if (guids.size !== expectedCount) throw new Error('Classification GUIDs are not unique');
  const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (items.some((item) => !uuidV4.test(item.imageId))) throw new Error('A classification ID is not UUID v4');

  const states = {};
  const decisions = {};
  const categories = {};
  let archived = 0;
  for (const item of items) {
    const record = item.classificationRecord;
    const current = record.current;
    states[current.state] = (states[current.state] || 0) + 1;
    decisions[current.jewelryDecision] = (decisions[current.jewelryDecision] || 0) + 1;
    if (!['jewelry', 'not_jewelry', 'uncertain'].includes(current.jewelryDecision)) {
      throw new Error('A real Codex result is missing the jewelry decision');
    }
    if (!record.source.account.wxid || !record.source.conversation.displayNameSnapshot) {
      throw new Error('Account or group provenance is incomplete');
    }
    if (record.source.conversation.username !== TARGET_JEWELRY_GROUP_USERNAME) {
      throw new Error('A real result escaped the target group');
    }
    const message = record.source.message;
    if (!message.messageId || !message.senderWxid || !message.senderName || !message.createTime) {
      throw new Error('Sender, time, or source message provenance is incomplete');
    }
    for (const contextMessage of [...record.context.before, ...record.context.after]) {
      if (!contextMessage.messageId || !contextMessage.senderWxid || !contextMessage.text || !contextMessage.distance) {
        throw new Error('A context trace entry is incomplete');
      }
    }
    if (record.context.before.length > 3 || record.context.after.length > 3) {
      throw new Error('Context exceeded the three-message boundary');
    }
    if (!record.revisions.length || !record.revisions.at(-1).inputSnapshot.imageSha256) {
      throw new Error('Classification revision provenance is incomplete');
    }
    if (current.jewelryDecision === 'not_jewelry') {
      if (current.category !== null || current.processes.length || current.categoryDecision !== 'not_applicable' || current.processDecision !== 'not_applicable') {
        throw new Error('A non-jewelry result contains detailed labels');
      }
    }
    if (current.jewelryDecision === 'uncertain') {
      if (current.category !== null || current.processes.length || current.categoryDecision !== 'uncertain' || current.processDecision !== 'uncertain') {
        throw new Error('An uncertain result contains definite labels');
      }
    }
    if (current.state === 'classified') {
      const categoryId = current.category && current.category.id;
      const expectedPrefix = path.posix.join('classified-images', record.archive.day, categoryId) + '/';
      const archivedPath = record.archive.classifiedRelativePath;
      if (!archivedPath || !archivedPath.startsWith(expectedPrefix) || path.parse(archivedPath).name !== item.imageId) {
        throw new Error('A classified image is not archived by day, category, and GUID');
      }
      if (!fs.existsSync(resolveInside(datasetDir, archivedPath))) throw new Error('A classified archive file is missing');
      archived += 1;
      categories[categoryId] = (categories[categoryId] || 0) + 1;
    } else if (record.archive.classifiedRelativePath) {
      throw new Error('An unresolved or non-jewelry result was archived');
    }
  }
  if (!fs.existsSync(path.join(datasetDir, 'dataset.db'))) throw new Error('SQLite dataset was not created');
  if (fs.existsSync(path.join(datasetDir, 'dataset.json'))) throw new Error('JSON index must not be created');
  return { total: items.length, states, decisions, categories, archived };
}

function sanitizeError(error) {
  return String(error && error.message || error || 'unknown error')
    .replace(/[A-Za-z]:[\\/][^\r\n]*/g, '<path>')
    .replace(/wxid_[A-Za-z0-9_-]+/g, '<wxid>')
    .replace(/[0-9]+@chatroom/g, '<chatroom>');
}

function assertCompletedRun(run) {
  if (run.completed !== TARGET_COUNT || run.failed !== 0 || run.status !== 'completed') {
    throw new Error(
      'Real Codex classification incomplete: status=' + run.status +
      ', completed=' + run.completed + ', failed=' + run.failed +
      ', cause=' + (run.error || 'unknown')
    );
  }
}

async function persistRealResults() {
  ensureSourceAccountProvenance();
  const selected = await selectLatestDatasetItems();
  const imageIds = selected.map((item) => item.imageId);
  const run = await runJewelryClassification({
    datasetDir: SOURCE_DATASET,
    imageIds,
    eligibleStates: ['pending', 'failed'],
    model: process.env.WETRACE_CODEX_MODEL || null,
    structuredOutput: false,
  });
  assertCompletedRun(run);
  const summary = validateResults(SOURCE_DATASET, imageIds);
  process.stdout.write('Codex real results persisted ' + JSON.stringify(summary) + '\n');
}

async function main() {
  if (PERSIST_RESULTS) {
    await persistRealResults();
    return;
  }
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'wetrace-codex-real-'));
  let trackedFiles = [];
  try {
    const manifestPath = path.join(SOURCE_DATASET, 'dataset.db');
    const sourceManifest = readJson(path.join(SOURCE_DATASET, 'dataset.json'));
    const sourceEntry = (sourceManifest.conversations || []).find((entry) =>
      entry.username === TARGET_JEWELRY_GROUP_USERNAME
    );
    if (!sourceEntry) throw new Error('Target group is absent from the source dataset');
    const conversationDb = path.join(SOURCE_DATASET, 'conversations', sourceEntry.conversationId + '.db');
    const groupRecordDb = path.join(SOURCE_DATASET, 'runtime', 'group-records.db');
    trackedFiles = [manifestPath, conversationDb, groupRecordDb].map((filePath) => ({
      filePath,
      before: snapshot(filePath),
    }));
    const sourceConversation = readJson(path.join(SOURCE_DATASET, sourceEntry.messageFile));
    const runtimeInfoPath = path.join(SOURCE_DATASET, 'runtime', 'db_storage_decrypted', 'info.json');
    const runtimeInfo = JSON.parse(fs.readFileSync(runtimeInfoPath, 'utf8'));
    const accountWxid = path.basename(String(runtimeInfo.wx_dir || '')).replace(/_c[a-f0-9]+$/i, '');
    if (!accountWxid) throw new Error('The source account identity cannot be traced');
    const accountIdentity = {
      wxid: accountWxid,
      displayName: sourceManifest.account && sourceManifest.account.displayName || accountWxid,
    };
    const completeMessages = readCompleteGroupMessages(groupRecordDb);
    const selected = await selectLatestImages(sourceConversation);
    const datasetDir = createTemporaryDataset(
      tempRoot,
      sourceManifest,
      sourceEntry,
      sourceConversation,
      selected,
      completeMessages,
      accountIdentity
    );
    const initialItems = readDatasetItems(datasetDir).items;
    if (initialItems.length !== TARGET_COUNT) throw new Error('Temporary dataset preparation did not produce 10 GUIDs');
    const run = await runJewelryClassification({
      datasetDir,
      imageIds: initialItems.map((item) => item.imageId),
      learningDbPath: path.join(tempRoot, 'learning.db'),
      model: process.env.WETRACE_CODEX_MODEL || null,
      structuredOutput: false,
    });
    for (const tracked of trackedFiles) assertUnchanged(tracked.filePath, tracked.before);
    assertCompletedRun(run);
    const summary = validateResults(datasetDir);
    process.stdout.write('Codex real acceptance passed ' + JSON.stringify(summary) + '\n');
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  process.stderr.write('Codex real acceptance failed: ' + sanitizeError(error) + '\n');
  process.exitCode = 1;
});
