const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { isImageMessage } = require('./viewerCore');
const { resolveConversationImages, resolveWxDir } = require('./exportCore');
const { buildDatasetImageId, getGroupImageCacheFingerprint } = require('./imageMedia');
const { getAccountDataPaths } = require('./accountDataPaths');
const {
  listDatasetDocuments,
  readDatasetDocument,
  writeDatasetDocument,
} = require('./jewelryDatasetDb');
const {
  PRODUCT_CATEGORIES,
  JEWELRY_PROCESSES,
  validateProductCategoryId,
  validateProcessIds,
} = require('./jewelryTaxonomy');

const DATASET_SCHEMA_VERSION = 1;
const IMAGE_RESOLVER_VERSION = 'partial-note-v2';
const TEXT_CONTEXT_SIZE = 3;
const PLACEHOLDER_TEXT = new Set(['[图片]', '[语音]', '[视频]', '[文件]', '[表情]']);

function nowIso() {
  return new Date().toISOString();
}

function stableId(prefix, value) {
  return `${prefix}_${crypto.createHash('sha256').update(String(value)).digest('hex').slice(0, 24)}`;
}

function normalizeRoot(rootDir) {
  if (!rootDir) throw new Error('请选择 SQLite 数据集目录');
  return path.resolve(rootDir);
}

function resolveInsideLexical(rootDir, relativePath) {
  const root = normalizeRoot(rootDir);
  const target = path.resolve(root, ...String(relativePath || '').replace(/\\/g, '/').split('/'));
  const rootPrefix = `${root}${path.sep}`;
  const normalizeCase = (value) => process.platform === 'win32' ? value.toLowerCase() : value;
  if (!normalizeCase(target).startsWith(normalizeCase(rootPrefix))) {
    throw new Error('图片路径超出数据集目录');
  }
  return target;
}

function resolveInside(rootDir, relativePath) {
  const root = normalizeRoot(rootDir);
  const target = resolveInsideLexical(root, relativePath);
  const normalizeCase = (value) => process.platform === 'win32' ? value.toLowerCase() : value;
  if (fs.existsSync(root)) {
    const canonicalRoot = fs.realpathSync.native(root);
    let existing = target;
    while (!fs.existsSync(existing) && path.dirname(existing) !== existing) existing = path.dirname(existing);
    if (fs.existsSync(existing)) {
      const canonicalExisting = fs.realpathSync.native(existing);
      const canonicalPrefix = `${canonicalRoot}${path.sep}`;
      if (
        normalizeCase(canonicalExisting) !== normalizeCase(canonicalRoot) &&
        !normalizeCase(canonicalExisting).startsWith(normalizeCase(canonicalPrefix))
      ) {
        throw new Error('图片路径超出数据集目录');
      }
    }
  }
  return target;
}

function atomicWriteJson(filePath, value) {
  if (writeDatasetDocument(filePath, value)) return;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.${crypto.randomBytes(4).toString('hex')}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(value, null, 2), 'utf8');
  fs.renameSync(tempPath, filePath);
}

function readFileJson(filePath, fallback = null) {
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, ''));
}

function readJson(filePath, fallback = null) {
  const stored = readDatasetDocument(filePath);
  if (stored.found) return stored.value;
  return readFileJson(filePath, fallback);
}

function isDirectoryEmpty(dirPath) {
  return !fs.existsSync(dirPath) || fs.readdirSync(dirPath).length === 0;
}

function datasetPaths(rootDir) {
  const root = normalizeRoot(rootDir);
  return {
    root,
    database: path.join(root, 'dataset.db'),
    manifest: path.join(root, 'dataset.json'),
    conversations: path.join(root, 'conversations'),
    annotations: path.join(root, 'annotations'),
    runs: path.join(root, 'classification', 'runs'),
  };
}

function createManifest({ rootDir, accountWxid, accountName }) {
  const paths = datasetPaths(rootDir);
  const createdAt = nowIso();
  return {
    schemaVersion: DATASET_SCHEMA_VERSION,
    datasetId: crypto.randomUUID(),
    createdAt,
    updatedAt: createdAt,
    account: { wxid: accountWxid || null, displayName: accountName || accountWxid || '不信账号' },
    taxonomy: { productCategories: PRODUCT_CATEGORIES, processes: JEWELRY_PROCESSES },
    syncPolicy: 'append-only',
    pathBindingRoot: paths.root,
    selections: [],
    conversations: [],
  };
}

function migrateLegacyDataset(paths, manifest) {
  for (const entry of manifest.conversations || []) {
    const conversationFile = entry.messageFile
      ? resolveInside(paths.root, entry.messageFile)
      : path.join(paths.conversations, `${entry.conversationId}.json`);
    const annotationFile = entry.annotationFile
      ? resolveInside(paths.root, entry.annotationFile)
      : path.join(paths.annotations, `${entry.conversationId}.json`);
    const conversation = readFileJson(conversationFile);
    const annotations = readFileJson(annotationFile);
    if (conversation) writeDatasetDocument(
      path.join(paths.conversations, `${entry.conversationId}.json`),
      conversation
    );
    if (annotations) writeDatasetDocument(
      path.join(paths.annotations, `${entry.conversationId}.json`),
      annotations
    );
  }
  if (fs.existsSync(paths.runs)) {
    for (const name of fs.readdirSync(paths.runs).filter((item) => item.endsWith('.json'))) {
      const run = readFileJson(path.join(paths.runs, name));
      if (run) writeDatasetDocument(path.join(paths.runs, name), run);
    }
  }
  writeDatasetDocument(paths.manifest, manifest);
}

function openOrCreateDataset({ rootDir, accountWxid = null, accountName = null }) {
  const paths = datasetPaths(rootDir);
  fs.mkdirSync(paths.root, { recursive: true });
  const storedManifest = readDatasetDocument(paths.manifest);
  let manifest = storedManifest.found ? storedManifest.value : readFileJson(paths.manifest);
  if (!manifest) {
    if (!isDirectoryEmpty(paths.root)) throw new Error('所选目录不是空目录，也不是 Wetrace SQLite 数据集');
    manifest = createManifest({ rootDir, accountWxid, accountName });
    atomicWriteJson(paths.manifest, manifest);
  } else if (!storedManifest.found && fs.existsSync(paths.manifest)) {
    migrateLegacyDataset(paths, manifest);
  }
  if (manifest.schemaVersion !== DATASET_SCHEMA_VERSION) throw new Error('SQLite 数据集版本不受支持');
  if (accountWxid && manifest.account?.wxid && manifest.account.wxid !== accountWxid) {
    throw new Error('该数据集属于另一个不信账号');
  }
  return { paths, manifest };
}

function messageSourceKey(username, message) {
  const serverId = String(message.serverId || '');
  return serverId && serverId !== '0'
    ? `${username}:server:${serverId}`
    : `${username}:local:${message.createTime || 0}:${message.id || 0}`;
}

function isUsefulTextMessage(message) {
  if (Number(message?.type) !== 1) return false;
  const text = String(message.content || '').trim();
  return Boolean(text && !PLACEHOLDER_TEXT.has(text) && !text.startsWith('<'));
}

function toContextEntry(username, message) {
  return {
    messageId: stableId('msg', messageSourceKey(username, message)),
    senderWxid: message.senderWxid || null,
    senderName: message.senderName || message.senderWxid || '未知发送人',
    createTime: Number(message.createTime) || 0,
    datetime: message.datetime || null,
    text: String(message.content || '').trim(),
  };
}

function buildImageContext(username, messages, imageIndex) {
  const before = [];
  const after = [];
  for (let i = imageIndex - 1; i >= 0 && before.length < TEXT_CONTEXT_SIZE; i -= 1) {
    if (isUsefulTextMessage(messages[i])) before.unshift(toContextEntry(username, messages[i]));
  }
  for (let i = imageIndex + 1; i < messages.length && after.length < TEXT_CONTEXT_SIZE; i += 1) {
    if (isUsefulTextMessage(messages[i])) after.push(toContextEntry(username, messages[i]));
  }
  return [...before, ...after];
}

function buildImageContexts(username, messages) {
  const entries = messages.map((message) =>
    isUsefulTextMessage(message) ? toContextEntry(username, message) : null
  );
  const beforeByIndex = new Map();
  const contexts = new Map();
  let nearby = [];
  for (let index = 0; index < messages.length; index += 1) {
    if (isImageMessage(messages[index])) beforeByIndex.set(index, [...nearby]);
    if (entries[index]) nearby = [...nearby, entries[index]].slice(-TEXT_CONTEXT_SIZE);
  }
  nearby = [];
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (isImageMessage(messages[index])) {
      contexts.set(index, [...(beforeByIndex.get(index) || []), ...nearby]);
    }
    if (entries[index]) nearby = [entries[index], ...nearby].slice(0, TEXT_CONTEXT_SIZE);
  }
  return contexts;
}

function expectedImageCount(message) {
  const primary = Number(message?.type) === 3 || message?.extra?.kind === 'image' ? 1 : 0;
  const records = (message?.extra?.recordItems || []).filter((item) => item?.kind === 'image').length;
  return primary + records;
}

function isGifMediaHint(value) {
  return /\.gif(?:$|[?#])/i.test(String(value || ''));
}

function classifyDatasetMediaKind(message, image = {}, source = null) {
  const messageKind = String(message?.extra?.kind || '').toLowerCase();
  const typeName = String(message?.typeName || '').toLowerCase();
  if (Number(message?.type) === 47 || typeName === 'emoji' || messageKind === 'emoji') {
    return 'emoji';
  }
  const hints = [
    image.relativePath,
    image.absolutePath,
    source?.outputImagePath,
    source?.urlName,
    source?.imageUrl,
    source?.thumbUrl,
    source?.midImgUrl,
    source?.bigImgUrl,
  ];
  if (hints.some(isGifMediaHint)) return 'gif';
  if (image.mediaKind === 'gif' || image.mediaKind === 'emoji') return image.mediaKind;
  return 'image';
}

function updateImageMediaMetadata(message, image, source = null) {
  const mediaKind = classifyDatasetMediaKind(message, image, source);
  const classificationEligible = mediaKind === 'image';
  const classificationSkipReason = classificationEligible ? null : mediaKind;
  const changed =
    image.mediaKind !== mediaKind ||
    image.isRealImage !== classificationEligible ||
    image.classificationEligible !== classificationEligible ||
    image.classificationSkipReason !== classificationSkipReason;
  image.mediaKind = mediaKind;
  image.isRealImage = classificationEligible;
  image.classificationEligible = classificationEligible;
  image.classificationSkipReason = classificationSkipReason;
  return changed;
}

function fileSha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function collectMessageImages({ datasetDir, conversationId, username, message, context }) {
  const messageId = stableId('msg', messageSourceKey(username, message));
  const availablePaths = [
    message.extra?.outputImagePath,
    ...(message.extra?.recordItems || []).map((item) => item?.outputImagePath),
    ...(message.previewImages || []).map((item) => item?.relativePath),
  ].filter(Boolean).map((value) => String(value).replace(/\\/g, '/'));
  const availableById = new Map(availablePaths.map((relativePath) => [path.parse(relativePath).name, relativePath]));
  const expected = [];
  if (Number(message.type) === 3 || message.extra?.kind === 'image') {
    expected.push({
      imageId: buildDatasetImageId(conversationId, message),
      source: message.extra || null,
    });
  }
  const recordItems = (message.extra?.recordItems || []).filter((item) => item?.kind === 'image');
  for (let index = 0; index < recordItems.length; index += 1) {
    const sourceServerId = String(message.serverId || '');
    const recordMessage = {
      id: `${message.id || message.serverId || 'record'}_record_${index + 1}`,
      serverId: sourceServerId && sourceServerId !== '0' ? `${sourceServerId}_record_${index + 1}` : null,
      createTime: message.createTime,
    };
    expected.push({
      imageId: buildDatasetImageId(conversationId, recordMessage, `note_${index + 1}`),
      source: recordItems[index],
    });
  }
  return expected.map(({ imageId, source }) => {
    const normalizedRelative = availableById.get(imageId) || path.posix.join('media', conversationId, `${imageId}.missing`);
    const absolutePath = resolveInside(datasetDir, normalizedRelative);
    const available = fs.existsSync(absolutePath);
    const image = {
      imageId,
      absolutePath,
      relativePath: normalizedRelative,
      pathStatus: available ? 'available' : 'missing',
      sha256: available ? fileSha256(absolutePath) : null,
      conversationId,
      messageId,
      senderWxid: message.senderWxid || null,
      senderName: message.senderName || message.senderWxid || '未知发送人',
      createTime: Number(message.createTime) || 0,
      datetime: message.datetime || null,
      context,
    };
    updateImageMediaMetadata(message, image, source);
    return image;
  });
}

function toDatasetMessage({ datasetDir, conversationId, username, message, context }) {
  const messageId = stableId('msg', messageSourceKey(username, message));
  const rawText = String(message.content || '').trim();
  const text = isImageMessage(message) && (PLACEHOLDER_TEXT.has(rawText) || rawText.startsWith('<'))
    ? ''
    : rawText;
  return {
    messageId,
    sourceLocalId: Number(message.id) || 0,
    sourceServerId: message.serverId || null,
    type: Number(message.type) || 0,
    typeName: message.typeName || '',
    createTime: Number(message.createTime) || 0,
    datetime: message.datetime || null,
    senderWxid: message.senderWxid || null,
    senderName: message.senderName || message.senderWxid || null,
    isSelf: Boolean(message.isSelf),
    text,
    images: collectMessageImages({ datasetDir, conversationId, username, message, context }),
  };
}

function toDatasetSqliteMessage(message) {
  const relativePaths = (message.previewImages || [])
    .map((item) => item?.relativePath)
    .filter(Boolean);
  if (!relativePaths.length) return message;
  const extra = { ...(message.extra || {}) };
  let pathIndex = 0;
  if (Number(message.type) === 3 || extra.kind === 'image') {
    extra.outputImagePath = relativePaths[pathIndex] || extra.outputImagePath;
    pathIndex += 1;
  }
  if (Array.isArray(extra.recordItems)) {
    extra.recordItems = extra.recordItems.map((item) => {
      if (item?.kind !== 'image') return item;
      const outputImagePath = relativePaths[pathIndex] || item.outputImagePath;
      pathIndex += 1;
      return { ...item, outputImagePath };
    });
  }
  return { ...message, extra };
}

function skippedMediaReason(mediaKind) {
  if (mediaKind === 'emoji') return '已跳过表情媒体';
  if (mediaKind === 'gif') return '已跳过 GIF 媒体';
  return '已跳过非分类媒体';
}

function emptyAnnotation(image) {
  const classificationEligible = image.classificationEligible !== false;
  const available = image.pathStatus === 'available';
  return {
    imageId: image.imageId,
    state: classificationEligible ? (available ? 'pending' : 'failed') : 'skipped',
    productCategory: { id: null, decision: 'uncertain' },
    processes: { ids: [], decision: 'uncertain' },
    recognizedText: { value: '', source: null, manuallyCorrected: false },
    contextMessageIds: (image.context || []).map((item) => item.messageId),
    evidence: [],
    reason: classificationEligible ? (available ? '' : '图片文件不存在') : skippedMediaReason(image.mediaKind),
    source: null,
    runId: null,
    manualLocked: false,
    updatedAt: nowIso(),
  };
}

function normalizeAnnotationForImage(image, current) {
  if (!current) return emptyAnnotation(image);
  if (current.manualLocked) return current;
  const shouldSkip = image.classificationEligible === false;
  if (shouldSkip) {
    const reason = skippedMediaReason(image.mediaKind);
    if (current.state !== 'skipped' || current.reason !== reason) return emptyAnnotation(image);
  } else if (current.state === 'skipped') {
    return emptyAnnotation(image);
  }
  return current;
}

function mergeMessages(existingMessages, incomingMessages) {
  const map = new Map((existingMessages || []).map((message) => [message.messageId, message]));
  for (const message of incomingMessages) {
    const existing = map.get(message.messageId);
    if (!existing) map.set(message.messageId, message);
    else if ((existing.images || []).some((image) =>
      image.classificationEligible !== false && image.pathStatus !== 'available'
    )) map.set(message.messageId, message);
  }
  return [...map.values()].sort((a, b) => a.createTime - b.createTime || a.sourceLocalId - b.sourceLocalId);
}

function normalizeSelection(selection) {
  return {
    username: selection.username,
    displayName: selection.displayName || selection.username,
    senderWxids: Array.isArray(selection.senderWxids) ? [...new Set(selection.senderWxids)] : null,
    startTime: selection.startTime == null ? null : Number(selection.startTime),
    endTime: selection.endTime == null ? null : Number(selection.endTime),
    includeText: selection.includeText !== false,
    includeImages: selection.includeImages !== false,
  };
}

async function syncJewelryDataset(payload, onProgress = null) {
  const { openGroupRecordStore } = require('./groupRecordStore');
  const { ensureGroupRecords } = require('./groupRecordService');
  const selections = (payload.selections || []).filter((item) => item?.username).map(normalizeSelection);
  if (!selections.length) throw new Error('请至少选择一个群聊');
  const wxDir = resolveWxDir(payload.wxDir);
  const { paths, manifest } = openOrCreateDataset({
    rootDir: payload.datasetDir,
    accountWxid: payload.selfWxid || null,
    accountName: payload.accountName || null,
  });
  const store = await openGroupRecordStore(getAccountDataPaths(payload.datasetDir).groupRecordDbPath);
  const pendingImageIds = new Set();
  let syncedMessages = 0;
  let syncedImages = 0;
  let syncedSqliteMessages = 0;
  let manifestChanged = false;
  const imageContextRef = { current: null };

  try {
    onProgress?.({
      phase: 'dataset-sync',
      subphase: 'start',
      current: 0,
      total: selections.length,
      message: `开始自动保存 ${selections.length} 个群聊到 SQLite 数据集`,
    });
    for (let index = 0; index < selections.length; index += 1) {
      const selection = selections[index];
      const progressMeta = {
        scope: 'dataset',
        current: index + 1,
        total: selections.length,
        displayName: selection.displayName,
      };
      onProgress?.({
        phase: 'dataset-sync',
        subphase: 'records',
        ...progressMeta,
        message: `正在读取群聊 ${index + 1}/${selections.length} · ${selection.displayName}`,
      });
      const sourceInfo = await ensureGroupRecords(
        {
          wxDir,
          selfWxid: payload.selfWxid,
          username: selection.username,
          decryptedDir: payload.decryptedDir || null,
        },
        store
      );
      const imageSourceVersion = sourceInfo.sourceVersion + ':' + getGroupImageCacheFingerprint(wxDir, selection.username) + ':' + IMAGE_RESOLVER_VERSION;
      const sourceMessages = store.loadAllMessages({
        username: selection.username,
        startTime: selection.startTime,
        endTime: selection.endTime,
      });
      const conversationId = stableId('conv', selection.username);
      const conversationPath = path.join(paths.conversations, `${conversationId}.json`);
      const conversationExists = fs.existsSync(conversationPath);
      const existingConversation = readJson(conversationPath, {
        schemaVersion: DATASET_SCHEMA_VERSION,
        conversationId,
        username: selection.username,
        displayName: selection.displayName,
        messages: [],
      });
      const existingByMessageId = new Map(
        (existingConversation.messages || []).map((message) => [message.messageId, message])
      );
      let conversationPathsChanged = false;
      for (const storedMessage of existingConversation.messages || []) {
        for (const storedImage of storedMessage.images || []) {
          if (updateImageMediaMetadata(storedMessage, storedImage)) conversationPathsChanged = true;
        }
      }
      const selectedSenders = selection.senderWxids ? new Set(selection.senderWxids) : null;
      const senderSelected = (message) => !selectedSenders || selectedSenders.has(message.senderWxid);
      const messageSelected = (message) => {
        if (!senderSelected(message)) return false;
        return isImageMessage(message)
          ? selection.includeImages
          : selection.includeText && isUsefulTextMessage(message);
      };
      const imageResolutionCurrent = (image) =>
        !image.classificationEligible ||
        image.pathStatus === 'available' ||
        (!payload.forceImageResolve && image.lastResolveSourceVersion === imageSourceVersion);
      const shouldResolveImage = (message) => {
        if (!messageSelected(message) || !isImageMessage(message)) return false;
        const messageId = stableId('msg', messageSourceKey(selection.username, message));
        const existing = existingByMessageId.get(messageId);
        if (existing) {
          for (const image of existing.images || []) {
            if (updateImageMediaMetadata(message, image, message.extra || null)) {
              conversationPathsChanged = true;
            }
            if (rebindImage(image, paths.root)) conversationPathsChanged = true;
            if (
              image.classificationEligible &&
              image.pathStatus !== 'available' &&
              !image.lastResolveSourceVersion
            ) {
              image.lastResolveSourceVersion = imageSourceVersion;
              conversationPathsChanged = true;
            }
          }
          if (
            (existing.images || []).length === expectedImageCount(message) &&
            existing.images.every(imageResolutionCurrent)
          ) {
            return false;
          }
        }
        return classifyDatasetMediaKind(message, {}, message.extra || null) === 'image';
      };
      const imageMessages = selection.includeImages
        ? sourceMessages.filter(shouldResolveImage)
        : [];
      if (imageMessages.length) {
        await resolveConversationImages({
          wxDir,
          username: selection.username,
          messages: imageMessages,
          decryptedDir: payload.decryptedDir || null,
          imageKeyCacheDir: payload.imageKeyCacheDir || null,
          imageOutputDir: paths.root,
          chatFileBase: conversationId,
          imageLayout: 'dataset',
          useLegacyExportParser: true,
          imageContextRef,
          onProgress,
          progressMeta,
        });
      }

      const incoming = [];
      const sqliteIncoming = [];
      let imageContexts = null;
      for (let messageIndex = 0; messageIndex < sourceMessages.length; messageIndex += 1) {
        const message = sourceMessages[messageIndex];
        const image = isImageMessage(message);
        if (!messageSelected(message)) continue;
        const messageId = stableId('msg', messageSourceKey(selection.username, message));
        const existing = existingByMessageId.get(messageId);
        if (image && existing) {
          for (const existingImage of existing.images || []) {
            if (updateImageMediaMetadata(message, existingImage, message.extra || null)) {
              conversationPathsChanged = true;
            }
            if (rebindImage(existingImage, paths.root)) conversationPathsChanged = true;
          }
        }
        const reusable = existing && (
          !image ||
          ((existing.images || []).length === expectedImageCount(message) &&
            (existing.images || []).every(imageResolutionCurrent))
        );
        if (reusable) continue;
        if (image && !imageContexts) imageContexts = buildImageContexts(selection.username, sourceMessages);
        const context = image ? imageContexts.get(messageIndex) || [] : [];
        const nextMessage = toDatasetMessage({
          datasetDir: paths.root,
          conversationId,
          username: selection.username,
          message,
          context,
        });
        for (const resolvedImage of nextMessage.images || []) {
          if (resolvedImage.classificationEligible) {
            resolvedImage.lastResolveSourceVersion = imageSourceVersion;
          }
        }
        incoming.push(nextMessage);
        sqliteIncoming.push(message);
        if (!existing) syncedMessages += 1;
        syncedImages += (nextMessage.images || []).filter((item) =>
          item.classificationEligible && item.pathStatus === 'available'
        ).length;
      }

      const conversationDbPath = path.join(paths.conversations, `${conversationId}.db`);
      const sqliteExists = fs.existsSync(conversationDbPath);
      const selectedSourceMessages = sourceMessages.filter(messageSelected);
      let sqliteMessages = sqliteExists ? sqliteIncoming : selectedSourceMessages;
      const conversationStore = await openGroupRecordStore(conversationDbPath);
      let sqliteInfo;
      let sqliteChanged = false;
      try {
        const existingSqliteInfo = conversationStore.getGroupInfo(selection.username);
        if (!existingSqliteInfo) sqliteMessages = selectedSourceMessages;
        if (!existingSqliteInfo || sqliteMessages.length) {
          onProgress?.({
            phase: 'dataset-sync',
            subphase: 'sqlite',
            ...progressMeta,
            message: `正在写入「${selection.displayName}」的独立 SQLite`,
          });
          sqliteInfo = conversationStore.storeGroup({
            username: selection.username,
            displayName: selection.displayName,
            sourceVersion: sourceInfo.sourceVersion,
            messages: sqliteMessages.map(toDatasetSqliteMessage),
            replace: false,
          });
          syncedSqliteMessages += sqliteMessages.length;
          sqliteChanged = true;
        } else {
          sqliteInfo = existingSqliteInfo;
        }
      } finally {
        conversationStore.close();
      }

      const conversationChanged =
        !conversationExists ||
        incoming.length > 0 ||
        conversationPathsChanged ||
        existingConversation.displayName !== selection.displayName;
      if (conversationChanged) {
        onProgress?.({
          phase: 'dataset-sync',
          subphase: 'write',
          ...progressMeta,
          message: `正在写入「${selection.displayName}」的 SQLite 记录`,
        });
        existingConversation.displayName = selection.displayName;
        existingConversation.updatedAt = nowIso();
        existingConversation.messages = mergeMessages(existingConversation.messages, incoming);
        atomicWriteJson(conversationPath, existingConversation);
      }

      const annotationPath = path.join(paths.annotations, `${conversationId}.json`);
      const annotationExists = fs.existsSync(annotationPath);
      const annotationFile = readJson(annotationPath, {
        schemaVersion: DATASET_SCHEMA_VERSION,
        conversationId,
        items: {},
      });
      let annotationChanged = !annotationExists;
      for (const message of existingConversation.messages) {
        for (const image of message.images || []) {
          const currentAnnotation = annotationFile.items[image.imageId];
          const normalizedAnnotation = normalizeAnnotationForImage(image, currentAnnotation);
          if (normalizedAnnotation !== currentAnnotation) {
            annotationFile.items[image.imageId] = normalizedAnnotation;
            annotationChanged = true;
          }
          if (
            image.classificationEligible &&
            image.pathStatus === 'available' &&
            !annotationFile.items[image.imageId].manualLocked &&
            annotationFile.items[image.imageId].state === 'failed' &&
            annotationFile.items[image.imageId].reason === '图片文件不存在'
          ) {
            annotationFile.items[image.imageId] = emptyAnnotation(image);
            annotationChanged = true;
          }
          const annotation = annotationFile.items[image.imageId];
          if (
            image.classificationEligible &&
            image.pathStatus === 'available' &&
            !annotation.manualLocked &&
            annotation.state === 'pending'
          ) {
            pendingImageIds.add(image.imageId);
          }
        }
      }
      if (annotationChanged) {
        annotationFile.updatedAt = nowIso();
        atomicWriteJson(annotationPath, annotationFile);
      }

      const messageCount = existingConversation.messages.length;
      const imageCount = existingConversation.messages.reduce((sum, item) => sum + (item.images?.length || 0), 0);
      const entryIndex = manifest.conversations.findIndex((item) => item.conversationId === conversationId);
      const previousEntry = entryIndex >= 0 ? manifest.conversations[entryIndex] : null;
      const manifestEntry = {
        conversationId,
        username: selection.username,
        displayName: selection.displayName,
        messageFile: path.posix.join('conversations', `${conversationId}.json`),
        sqliteFile: path.posix.join('conversations', `${conversationId}.db`),
        annotationFile: path.posix.join('annotations', `${conversationId}.json`),
        messageCount,
        sqliteMessageCount: sqliteInfo?.messageCount || 0,
        imageCount,
        updatedAt: conversationChanged || annotationChanged || sqliteChanged
          ? nowIso()
          : previousEntry?.updatedAt || nowIso(),
      };
      if (!previousEntry || JSON.stringify(previousEntry) !== JSON.stringify(manifestEntry)) {
        if (entryIndex >= 0) manifest.conversations[entryIndex] = manifestEntry;
        else manifest.conversations.push(manifestEntry);
        manifestChanged = true;
      }
      onProgress?.({
        phase: 'dataset-sync',
        subphase: 'conversation-done',
        ...progressMeta,
        message: `已完成群聊 ${index + 1}/${selections.length} · ${selection.displayName}`,
      });
    }
  } finally {
    store.close();
  }

  if (JSON.stringify(manifest.selections || []) !== JSON.stringify(selections)) {
    manifest.selections = selections;
    manifestChanged = true;
  }
  if (manifestChanged) {
    manifest.updatedAt = nowIso();
    atomicWriteJson(paths.manifest, manifest);
  }
  onProgress?.({
    phase: 'dataset-sync',
    subphase: 'done',
    current: selections.length,
    total: selections.length,
    message: `数据集保存完成：新增 ${syncedMessages} 条消息，写入 ${syncedSqliteMessages} 条群聊 SQLite 消息，解析 ${syncedImages} 张图片`,
  });
  return {
    datasetDir: paths.root,
    datasetId: manifest.datasetId,
    conversationCount: selections.length,
    syncedMessages,
    syncedImages,
    syncedSqliteMessages,
    pendingImageIds: [...pendingImageIds],
  };
}

function rebindImage(image, rootDir, { verifyCanonical = true } = {}) {
  const absolutePath = verifyCanonical
    ? resolveInside(rootDir, image.relativePath)
    : resolveInsideLexical(rootDir, image.relativePath);
  const available = fs.existsSync(absolutePath);
  const changed = image.absolutePath !== absolutePath || image.pathStatus !== (available ? 'available' : 'missing');
  image.absolutePath = absolutePath;
  image.pathStatus = available ? 'available' : 'missing';
  if (available && !image.sha256) image.sha256 = fileSha256(absolutePath);
  return changed;
}

function rebindDatasetPaths(rootDir) {
  const { paths, manifest } = openOrCreateDataset({ rootDir });
  let changed = 0;
  for (const entry of manifest.conversations || []) {
    const conversationPath = resolveInside(paths.root, entry.messageFile);
    const conversation = readJson(conversationPath);
    if (!conversation) continue;
    let conversationChanged = false;
    for (const message of conversation.messages || []) {
      for (const image of message.images || []) {
        if (updateImageMediaMetadata(message, image)) conversationChanged = true;
        if (rebindImage(image, paths.root)) {
          changed += 1;
          conversationChanged = true;
        }
      }
    }
    if (conversationChanged) atomicWriteJson(conversationPath, conversation);
  }
  if (manifest.pathBindingRoot !== paths.root) {
    manifest.pathBindingRoot = paths.root;
    manifest.updatedAt = nowIso();
    atomicWriteJson(paths.manifest, manifest);
  }
  return { datasetDir: paths.root, changed };
}

function readDatasetItems(rootDir) {
  const { paths, manifest } = openOrCreateDataset({ rootDir });
  const bindingChanged = manifest.pathBindingRoot !== paths.root;
  const items = [];
  for (const entry of manifest.conversations || []) {
    const conversationPath = resolveInside(paths.root, entry.messageFile);
    const conversation = readJson(conversationPath);
    const annotationPath = resolveInside(paths.root, entry.annotationFile);
    const annotations = readJson(annotationPath, { items: {} });
    if (!conversation) continue;
    annotations.items ||= {};
    let conversationChanged = false;
    let annotationsChanged = false;
    for (const message of conversation.messages || []) {
      for (const image of message.images || []) {
        if (updateImageMediaMetadata(message, image)) conversationChanged = true;
        if (rebindImage(image, paths.root, { verifyCanonical: false })) {
          conversationChanged = true;
        }
        const currentAnnotation = annotations.items[image.imageId];
        const annotation = normalizeAnnotationForImage(image, currentAnnotation);
        if (annotation !== currentAnnotation) {
          annotations.items[image.imageId] = annotation;
          annotationsChanged = true;
        }
        items.push({
          ...image,
          conversationName: conversation.displayName,
          messageText: message.text,
          annotation,
          previewUrl: image.pathStatus === 'available' ? pathToFileURL(image.absolutePath).href : null,
        });
      }
    }
    if (conversationChanged) atomicWriteJson(conversationPath, conversation);
    if (annotationsChanged) {
      annotations.updatedAt = nowIso();
      atomicWriteJson(annotationPath, annotations);
    }
  }
  if (bindingChanged) {
    manifest.pathBindingRoot = paths.root;
    manifest.updatedAt = nowIso();
    atomicWriteJson(paths.manifest, manifest);
  }
  return { manifest, items };
}

function validateDatasetImageAccess(datasetDir, item) {
  const absolutePath = resolveInside(datasetDir, item.relativePath);
  const available = fs.existsSync(absolutePath);
  return {
    ...item,
    absolutePath,
    pathStatus: available ? 'available' : 'missing',
    previewUrl: available ? pathToFileURL(absolutePath).href : null,
  };
}

function listDatasetImages({ datasetDir, filters = {}, offset = 0, limit = 50 }) {
  const { manifest, items } = readDatasetItems(datasetDir);
  const classificationEligible = typeof filters.classificationEligible === 'boolean'
    ? filters.classificationEligible
    : true;
  const filtered = items.filter((item) => {
    const annotation = item.annotation;
    if (item.classificationEligible !== classificationEligible) return false;
    if (filters.pathStatus && item.pathStatus !== filters.pathStatus) return false;
    if (filters.state && annotation.state !== filters.state) return false;
    if (filters.categoryId && annotation.productCategory?.id !== filters.categoryId) return false;
    if (filters.processId && !annotation.processes?.ids?.includes(filters.processId)) return false;
    if (filters.conversationId && item.conversationId !== filters.conversationId) return false;
    if (filters.senderQuery) {
      const query = String(filters.senderQuery).toLowerCase();
      if (!String(item.senderName || '').toLowerCase().includes(query) && !String(item.senderWxid || '').toLowerCase().includes(query)) return false;
    }
    if (filters.runId && annotation.runId !== filters.runId) return false;
    return true;
  });
  const rank = { needs_review: 0, failed: 1, pending: 2, classified: 3, skipped: 4 };
  filtered.sort((a, b) => (rank[a.annotation.state] ?? 9) - (rank[b.annotation.state] ?? 9) || b.createTime - a.createTime);
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
  const requestedOffset = Math.max(Number(offset) || 0, 0);
  const safeOffset = filtered.length > 0 && requestedOffset >= filtered.length
    ? Math.floor((filtered.length - 1) / safeLimit) * safeLimit
    : requestedOffset;
  return {
    datasetDir: normalizeRoot(datasetDir),
    manifest,
    items: filtered.slice(safeOffset, safeOffset + safeLimit),
    total: filtered.length,
    offset: safeOffset,
    limit: safeLimit,
    hasMore: safeOffset + safeLimit < filtered.length,
  };
}

function updateAnnotationFiles(datasetDir, imageIds, updater) {
  const { paths, manifest } = openOrCreateDataset({ rootDir: datasetDir });
  const targetIds = new Set(imageIds || []);
  let updated = 0;
  for (const entry of manifest.conversations || []) {
    if (!targetIds.size) break;
    const annotationPath = resolveInside(paths.root, entry.annotationFile);
    const annotations = readJson(annotationPath, { schemaVersion: 1, conversationId: entry.conversationId, items: {} });
    let changed = false;
    for (const imageId of [...targetIds]) {
      if (!annotations.items[imageId]) continue;
      targetIds.delete(imageId);
      const next = updater(annotations.items[imageId], imageId);
      if (!next) continue;
      annotations.items[imageId] = next;
      updated += 1;
      changed = true;
    }
    if (changed) {
      annotations.updatedAt = nowIso();
      atomicWriteJson(annotationPath, annotations);
    }
  }
  return updated;
}

function eligibleDatasetImageIds(datasetDir, imageIds) {
  const requested = new Set(imageIds || []);
  return new Set(
    readDatasetItems(datasetDir).items
      .filter((item) => requested.has(item.imageId) && item.classificationEligible)
      .map((item) => item.imageId)
  );
}

function saveManualClassification({ datasetDir, imageId, categoryId, processIds, processDecision, recognizedText }) {
  if (!eligibleDatasetImageIds(datasetDir, [imageId]).has(imageId)) {
    throw new Error('该媒体不是可分类的真实图片');
  }
  const validCategory = validateProductCategoryId(categoryId, { allowNull: false });
  const validProcesses = validateProcessIds(processIds);
  const decision = validProcesses.length ? 'selected' : processDecision === 'none' ? 'none' : null;
  if (!decision) throw new Error('请选择工艺，或确认无匹配工艺');
  const updated = updateAnnotationFiles(datasetDir, [imageId], (current) => {
    const textValue = String(recognizedText || '');
    const textChanged = textValue !== String(current.recognizedText?.value || '');
    return {
      ...current,
      state: 'classified',
      productCategory: { id: validCategory, decision: 'selected' },
      processes: { ids: validProcesses, decision },
      recognizedText: textChanged
        ? { value: textValue, source: 'manual', manuallyCorrected: true }
        : current.recognizedText,
      source: 'manual',
      manualLocked: true,
      updatedAt: nowIso(),
    };
  });
  if (!updated) throw new Error('未找到要分类的图片');
  return { imageId, updated: true };
}

function batchSaveProcesses({ datasetDir, imageIds, processIds, processDecision }) {
  const eligibleImageIds = eligibleDatasetImageIds(datasetDir, imageIds);
  const validProcesses = validateProcessIds(processIds);
  const decision = validProcesses.length ? 'selected' : processDecision === 'none' ? 'none' : null;
  if (!decision) throw new Error('请选择工艺，或确认无匹配工艺');
  const updated = updateAnnotationFiles(datasetDir, [...eligibleImageIds], (current) => ({
    ...current,
    state: current.productCategory?.id ? 'classified' : 'needs_review',
    processes: { ids: validProcesses, decision },
    source: 'manual',
    manualLocked: true,
    updatedAt: nowIso(),
  }));
  return { updated };
}

function applyCodexResults({ datasetDir, runId, results, eligibleImageIds = null }) {
  const allowedImageIds = eligibleImageIds
    ? new Set(eligibleImageIds)
    : eligibleDatasetImageIds(datasetDir, (results || []).map((item) => item.imageId));
  const resultMap = new Map(
    (results || [])
      .filter((item) => allowedImageIds.has(item.imageId))
      .map((item) => [item.imageId, item])
  );
  return updateAnnotationFiles(datasetDir, [...resultMap.keys()], (current, imageId) => {
    if (current.manualLocked) return null;
    const result = resultMap.get(imageId);
    const categoryId = validateProductCategoryId(result.categoryId, { allowNull: true });
    const processIds = validateProcessIds(result.processIds);
    const categorySelected = result.categoryDecision === 'selected' && categoryId;
    const processResolved = result.processDecision === 'selected' || result.processDecision === 'none';
    return {
      ...current,
      state: categorySelected && processResolved ? 'classified' : 'needs_review',
      productCategory: { id: categorySelected ? categoryId : null, decision: categorySelected ? 'selected' : 'uncertain' },
      processes: { ids: result.processDecision === 'selected' ? processIds : [], decision: result.processDecision },
      recognizedText: { value: String(result.recognizedText || ''), source: 'codex', manuallyCorrected: false },
      evidence: Array.isArray(result.evidence) ? result.evidence : [],
      reason: String(result.reason || ''),
      source: 'codex',
      runId,
      manualLocked: false,
      updatedAt: nowIso(),
    };
  });
}

function saveClassificationRun(datasetDir, run) {
  const runPath = path.join(path.resolve(datasetDir), 'classification', 'runs', `${run.runId}.json`);
  atomicWriteJson(runPath, run);
  return datasetPaths(datasetDir).database;
}

function listStoredClassificationRuns(datasetDir) {
  openOrCreateDataset({ rootDir: datasetDir });
  return listDatasetDocuments(datasetDir, 'run')
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

function markImagesFailed({ datasetDir, imageIds, runId, reason }) {
  return updateAnnotationFiles(datasetDir, imageIds, (current) => current.manualLocked ? null : ({
    ...current,
    state: 'failed',
    reason: String(reason || '分类任务失败'),
    source: 'codex',
    runId,
    updatedAt: nowIso(),
  }));
}

module.exports = {
  DATASET_SCHEMA_VERSION,
  TEXT_CONTEXT_SIZE,
  atomicWriteJson,
  readJson,
  buildImageContext,
  buildImageContexts,
  isUsefulTextMessage,
  openOrCreateDataset,
  rebindDatasetPaths,
  resolveInside,
  stableId,
  syncJewelryDataset,
  listDatasetImages,
  readDatasetItems,
  validateDatasetImageAccess,
  saveManualClassification,
  batchSaveProcesses,
  applyCodexResults,
  saveClassificationRun,
  listStoredClassificationRuns,
  markImagesFailed,
};
