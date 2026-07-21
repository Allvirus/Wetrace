const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const crypto = require('crypto');
const os = require('os');
const path = require('path');

const {
  PRODUCT_CATEGORIES,
  JEWELRY_PROCESSES,
  validateProductCategoryId,
  validateProcessIds,
} = require('../lib/jewelryTaxonomy');
const {
  applyCodexResults,
  atomicWriteJson,
  buildImageContext,
  buildImageContexts,
  listDatasetImages,
  listStoredClassificationRuns,
  openOrCreateDataset,
  readJson,
  resolveInside,
  saveManualClassification,
  stableId,
  syncJewelryDataset,
} = require('../lib/jewelryDataset');
const { buildDatasetImageId } = require('../lib/imageMedia');
const { getDecryptedStorageFingerprint } = require('../lib/decryptCore');
const { openGroupRecordStore } = require('../lib/groupRecordStore');
const { getAccountDataPaths } = require('../lib/accountDataPaths');

function text(id, createTime, content, senderWxid = 'alice') {
  return { id, type: 1, createTime, content, senderWxid, senderName: senderWxid };
}

test('fixed jewelry taxonomy enforces one category and de-duplicated processes', () => {
  assert.equal(PRODUCT_CATEGORIES.length, 10);
  assert.equal(JEWELRY_PROCESSES.length, 8);
  assert.equal(validateProductCategoryId('pendant'), 'pendant');
  assert.throws(() => validateProductCategoryId(['pendant', 'ring']), /未知品类/);
  assert.deepEqual(validateProcessIds(['x5g', 'ancient_craft', 'x5g']), ['x5g', 'ancient_craft']);
  assert.throws(() => validateProcessIds(['new_process']), /未知工艺/);
});

test('image context keeps the nearest three useful texts on each side in source order', () => {
  const messages = [
    text(1, 10, 'too old'),
    text(2, 20, 'before 3'),
    { id: 3, type: 10000, createTime: 30, content: 'system' },
    text(4, 40, 'before 2', 'bob'),
    text(5, 50, '[图片]'),
    text(6, 60, 'before 1'),
    { id: 7, type: 3, createTime: 70, content: '[图片]' },
    text(8, 80, 'after 1'),
    { id: 9, type: 34, createTime: 90, content: 'voice' },
    text(10, 100, '<msg>xml</msg>'),
    text(11, 110, 'after 2', 'bob'),
    text(12, 120, 'after 3'),
    text(13, 130, 'too new'),
  ];
  const context = buildImageContext('group@chatroom', messages, 6);
  assert.deepEqual(context.map((item) => item.text), [
    'before 3',
    'before 2',
    'before 1',
    'after 1',
    'after 2',
    'after 3',
  ]);
  assert.deepEqual(context.map((item) => item.createTime), [20, 40, 60, 80, 110, 120]);
  assert.deepEqual(buildImageContexts('group@chatroom', messages).get(6), context);
});

test('legacy dataset JSON documents migrate into SQLite without deleting source files', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'wetrace-legacy-dataset-'));
  const conversationId = 'conv_legacy';
  const messageFile = `conversations/${conversationId}.json`;
  const annotationFile = `annotations/${conversationId}.json`;
  const runFile = 'classification/runs/run_legacy.json';
  try {
    fs.mkdirSync(path.join(temp, 'conversations'), { recursive: true });
    fs.mkdirSync(path.join(temp, 'annotations'), { recursive: true });
    fs.mkdirSync(path.join(temp, 'classification', 'runs'), { recursive: true });
    const manifest = {
      schemaVersion: 1,
      datasetId: 'legacy-dataset',
      account: { wxid: 'wxid_legacy', displayName: 'Legacy' },
      conversations: [{
        conversationId,
        username: 'legacy@chatroom',
        displayName: 'Legacy group',
        messageFile,
        annotationFile,
      }],
    };
    const conversation = {
      schemaVersion: 1,
      conversationId,
      displayName: 'Legacy group',
      messages: [],
    };
    const annotations = { schemaVersion: 1, conversationId, items: {} };
    const run = {
      schemaVersion: 1,
      runId: 'run_legacy',
      status: 'completed',
      createdAt: new Date(0).toISOString(),
    };
    fs.writeFileSync(path.join(temp, 'dataset.json'), JSON.stringify(manifest));
    fs.writeFileSync(resolveInside(temp, messageFile), JSON.stringify(conversation));
    fs.writeFileSync(resolveInside(temp, annotationFile), JSON.stringify(annotations));
    fs.writeFileSync(resolveInside(temp, runFile), JSON.stringify(run));

    const opened = openOrCreateDataset({ rootDir: temp, accountWxid: 'wxid_legacy' });
    assert.equal(opened.manifest.datasetId, 'legacy-dataset');
    assert.equal(fs.existsSync(path.join(temp, 'dataset.db')), true);
    assert.equal(fs.existsSync(path.join(temp, 'conversations', `${conversationId}.db`)), true);
    assert.deepEqual(readJson(resolveInside(temp, messageFile)), conversation);
    assert.deepEqual(readJson(resolveInside(temp, annotationFile)), annotations);
    assert.equal(listStoredClassificationRuns(temp)[0].runId, 'run_legacy');
    assert.equal(fs.existsSync(path.join(temp, 'dataset.json')), true);
    assert.equal(fs.existsSync(resolveInside(temp, messageFile)), true);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

test('dataset sync filters stored members while retaining same-group image context', async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'wetrace-jewelry-sync-'));
  const accountDir = path.join(temp, 'wxid_self_cabc');
  const decryptedDir = path.join(accountDir, 'db_storage_decrypted');
  const datasetDir = path.join(temp, 'dataset');
  const recordDbPath = getAccountDataPaths(datasetDir).groupRecordDbPath;
  const username = 'sync@chatroom';
  const conversationId = stableId('conv', username);
  const imageMessage = {
    id: 5,
    serverId: '105',
    type: 3,
    typeName: 'image',
    createTime: 50,
    datetime: '2026-01-01 00:00:50',
    senderWxid: 'alice',
    senderName: 'Alice',
    content: '[图片]',
    extra: { kind: 'image' },
  };
  const gifMessage = {
    id: 10,
    serverId: '110',
    type: 3,
    typeName: 'image',
    createTime: 55,
    datetime: '2026-01-01 00:00:55',
    senderWxid: 'alice',
    senderName: 'Alice',
    content: '[图片]',
    extra: { kind: 'image', imageUrl: 'https://example.invalid/sticker.gif' },
  };
  const lateImage = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    'base64'
  );
  const lateImageMd5 = crypto.createHash('md5').update(lateImage).digest('hex');
  const missingImageMessage = {
    id: 11,
    serverId: '111',
    type: 3,
    typeName: 'image',
    createTime: 65,
    datetime: '2026-01-01 00:01:05',
    senderWxid: 'alice',
    senderName: 'Alice',
    content: '[图片]',
    extra: { kind: 'image', md5: lateImageMd5 },
  };

  try {
    fs.mkdirSync(path.join(decryptedDir, 'message'), { recursive: true });
    fs.writeFileSync(path.join(decryptedDir, 'info.json'), JSON.stringify({ encrypted_fingerprint: 'sync-v1' }));
    openOrCreateDataset({ rootDir: datasetDir, accountWxid: 'wxid_self' });
    const sourceVersion = crypto
      .createHash('sha256')
      .update(getDecryptedStorageFingerprint(accountDir))
      .digest('hex');
    const imageSourceVersion = sourceVersion + ':empty:partial-note-v2';
    const store = await openGroupRecordStore(recordDbPath);
    store.storeGroup({
      username,
      displayName: 'Sync group',
      sourceVersion,
      replace: true,
      messages: [
        { ...text(1, 10, 'Bob before 1', 'bob'), serverId: '101' },
        { ...text(2, 20, 'Alice before', 'alice'), serverId: '102' },
        { id: 3, serverId: '103', type: 10000, createTime: 30, content: 'system', senderWxid: 'system' },
        { ...text(4, 40, 'Bob before 2', 'bob'), serverId: '104' },
        imageMessage,
        gifMessage,
        { ...text(6, 60, 'Bob after 1', 'bob'), serverId: '106' },
        missingImageMessage,
        { ...text(7, 70, '<msg>raw xml</msg>', 'alice'), serverId: '107' },
        { ...text(8, 80, 'Alice after', 'alice'), serverId: '108' },
        { ...text(9, 90, 'Bob after 2', 'bob'), serverId: '109' },
      ],
    });
    store.close();

    const imageId = buildDatasetImageId(conversationId, imageMessage);
    const gifImageId = buildDatasetImageId(conversationId, gifMessage);
    const missingImageId = buildDatasetImageId(conversationId, missingImageMessage);
    const imagePath = resolveInside(datasetDir, `media/${conversationId}/${imageId}.png`);
    fs.mkdirSync(path.dirname(imagePath), { recursive: true });
    fs.writeFileSync(imagePath, Buffer.from('existing image'));

    const progressEvents = [];
    const result = await syncJewelryDataset({
      wxDir: accountDir,
      datasetDir,
      selfWxid: 'wxid_self',
      selections: [{
        username,
        displayName: 'Sync group',
        senderWxids: ['alice'],
        includeText: true,
        includeImages: true,
      }],
    }, (event) => progressEvents.push(event));
    assert.deepEqual(result.pendingImageIds, [imageId]);
    assert.equal(result.syncedSqliteMessages, 5);
    const conversationDbPath = path.join(datasetDir, 'conversations', `${conversationId}.db`);
    assert.equal(fs.existsSync(conversationDbPath), true);
    const datasetManifest = readJson(path.join(datasetDir, 'dataset.json'));
    assert.equal(fs.existsSync(path.join(datasetDir, 'dataset.db')), true);
    assert.equal(fs.existsSync(path.join(datasetDir, 'dataset.json')), false);
    assert.equal(
      datasetManifest.conversations[0].sqliteFile,
      `conversations/${conversationId}.db`
    );
    assert.equal(datasetManifest.conversations[0].sqliteMessageCount, 5);
    const conversationStore = await openGroupRecordStore(conversationDbPath);
    try {
      const sqliteMessages = conversationStore.loadAllMessages({ username });
      assert.deepEqual(sqliteMessages.map((message) => message.senderWxid), [
        'alice',
        'alice',
        'alice',
        'alice',
        'alice',
      ]);
      assert.deepEqual(sqliteMessages.map((message) => message.content), [
        'Alice before',
        '[图片]',
        '[图片]',
        '[图片]',
        'Alice after',
      ]);
      assert.equal(
        sqliteMessages.find((message) => message.serverId === '105').extra.outputImagePath,
        `media/${conversationId}/${imageId}.png`
      );
    } finally {
      conversationStore.close();
    }
    const conversation = readJson(
      path.join(datasetDir, 'conversations', `${conversationId}.json`)
    );
    assert.equal(
      fs.existsSync(path.join(datasetDir, 'conversations', `${conversationId}.json`)),
      false
    );
    assert.deepEqual(conversation.messages.map((message) => message.senderWxid), ['alice', 'alice', 'alice', 'alice', 'alice']);
    assert.deepEqual(conversation.messages.map((message) => message.text), ['Alice before', '', '', '', 'Alice after']);
    assert.deepEqual(conversation.messages[1].images[0].context.map((item) => item.text), [
      'Bob before 1',
      'Alice before',
      'Bob before 2',
      'Bob after 1',
      'Alice after',
      'Bob after 2',
    ]);
    assert.equal(conversation.messages[1].images[0].absolutePath, imagePath);
    assert.equal(conversation.messages[1].images[0].relativePath, `media/${conversationId}/${imageId}.png`);
    assert.equal(conversation.messages[1].images[0].mediaKind, 'image');
    assert.equal(conversation.messages[1].images[0].isRealImage, true);
    assert.equal(conversation.messages[1].images[0].classificationEligible, true);
    assert.equal(conversation.messages[1].images[0].classificationSkipReason, null);
    assert.equal(conversation.messages[2].images[0].mediaKind, 'gif');
    assert.equal(conversation.messages[2].images[0].isRealImage, false);
    assert.equal(conversation.messages[2].images[0].classificationEligible, false);
    assert.equal(conversation.messages[2].images[0].pathStatus, 'missing');
    assert.equal(conversation.messages[3].images[0].pathStatus, 'missing');
    assert.equal(conversation.messages[3].images[0].lastResolveSourceVersion, imageSourceVersion);
    const annotations = readJson(
      path.join(datasetDir, 'annotations', `${conversationId}.json`)
    );
    assert.equal(
      fs.existsSync(path.join(datasetDir, 'annotations', `${conversationId}.json`)),
      false
    );
    assert.equal(annotations.items[gifImageId].state, 'skipped');
    assert.equal(annotations.items[missingImageId].state, 'failed');
    assert.ok(progressEvents.some((event) => event.phase === 'image-resolve' && event.subphase === 'cache'));
    assert.ok(progressEvents.some((event) => event.phase === 'dataset-sync' && event.subphase === 'sqlite'));
    assert.ok(progressEvents.some((event) => event.phase === 'dataset-sync' && event.subphase === 'done'));
    delete conversation.messages[3].images[0].lastResolveSourceVersion;
    atomicWriteJson(path.join(datasetDir, 'conversations', conversationId + '.json'), conversation);

    const originalReadFileSync = fs.readFileSync;
    const originalWriteFileSync = fs.writeFileSync;
    let repeatedImageReads = 0;
    let repeatedDatasetWrites = 0;
    fs.readFileSync = function instrumentedRead(filePath, ...args) {
      if (path.resolve(filePath) === path.resolve(imagePath)) repeatedImageReads += 1;
      return originalReadFileSync.call(this, filePath, ...args);
    };
    fs.writeFileSync = function instrumentedWrite(filePath, ...args) {
      if (path.resolve(filePath).startsWith(`${path.resolve(datasetDir)}${path.sep}`)) repeatedDatasetWrites += 1;
      return originalWriteFileSync.call(this, filePath, ...args);
    };
    const repeatedProgress = [];
    let repeated;
    try {
      repeated = await syncJewelryDataset({
        wxDir: accountDir,
        datasetDir,
        selfWxid: 'wxid_self',
        selections: [{
          username,
          displayName: 'Sync group',
          senderWxids: ['alice'],
          includeText: true,
          includeImages: true,
        }],
      }, (event) => repeatedProgress.push(event));
    } finally {
      fs.readFileSync = originalReadFileSync;
      fs.writeFileSync = originalWriteFileSync;
    }
    const repeatedConversation = readJson(
      path.join(datasetDir, 'conversations', `${conversationId}.json`)
    );
    assert.equal(repeatedConversation.messages.length, 5);
    assert.equal(repeatedConversation.messages[3].images[0].lastResolveSourceVersion, imageSourceVersion);
    assert.deepEqual(repeated.pendingImageIds, [imageId]);
    assert.equal(repeated.syncedMessages, 0);
    assert.equal(repeated.syncedSqliteMessages, 0);
    assert.equal(repeatedImageReads, 0);
    assert.equal(repeatedDatasetWrites, 0);
    assert.equal(
      repeatedProgress.some((event) => event.phase === 'image-resolve' && event.subphase === 'parsing'),
      false
    );
    const forcedProgress = [];
    await syncJewelryDataset({
      wxDir: accountDir,
      datasetDir,
      selfWxid: 'wxid_self',
      forceImageResolve: true,
      selections: [{
        username,
        displayName: 'Sync group',
        senderWxids: ['alice'],
        includeText: true,
        includeImages: true,
      }],
    }, (event) => forcedProgress.push(event));
    assert.ok(
      forcedProgress.some((event) => event.phase === 'image-resolve' && event.subphase === 'parsing')
    );

    const noteCacheDir = path.join(accountDir, 'business', 'favorite', 'temp', 'NoteCache');
    fs.mkdirSync(noteCacheDir, { recursive: true });
    fs.writeFileSync(path.join(noteCacheDir, 'late-image-cache'), lateImage);
    const recoveredProgress = [];
    const recovered = await syncJewelryDataset({
      wxDir: accountDir,
      datasetDir,
      selfWxid: 'wxid_self',
      selections: [{
        username,
        displayName: 'Sync group',
        senderWxids: ['alice'],
        includeText: true,
        includeImages: true,
      }],
    }, (event) => recoveredProgress.push(event));
    const recoveredConversation = readJson(
      path.join(datasetDir, 'conversations', conversationId + '.json')
    );
    const recoveredImage = recoveredConversation.messages
      .flatMap((message) => message.images || [])
      .find((image) => image.imageId === missingImageId);
    const recoveredPath = path.join(datasetDir, 'media', conversationId, missingImageId + '.png');
    assert.equal(recoveredImage.pathStatus, 'available');
    assert.equal(recoveredImage.absolutePath, recoveredPath);
    assert.notEqual(recoveredImage.lastResolveSourceVersion, imageSourceVersion);
    assert.deepEqual(fs.readFileSync(recoveredPath), lateImage);
    assert.ok(recovered.pendingImageIds.includes(missingImageId));
    assert.ok(
      recoveredProgress.some((event) => event.phase === 'image-resolve' && event.subphase === 'parsing')
    );
    assert.ok(
      recoveredProgress.some((event) =>
        event.phase === 'image-resolve' &&
        event.subphase === 'done' &&
        event.imageStats?.exported === 1
      )
    );

    const repeatedStore = await openGroupRecordStore(conversationDbPath);
    try {
      assert.equal(repeatedStore.getGroupInfo(username).messageCount, 5);
    } finally {
      repeatedStore.close();
    }
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

test('classification listing paginates filtered SQLite results', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'wetrace-jewelry-pages-'));
  const conversationId = 'conv_pages';
  try {
    const { paths, manifest } = openOrCreateDataset({ rootDir: temp, accountWxid: 'wxid_pages' });
    const messages = [];
    const items = {};
    for (let index = 0; index < 120; index += 1) {
      const imageId = `img_${String(index).padStart(3, '0')}`;
      const relativePath = `media/${conversationId}/${imageId}.${index === 0 ? 'png' : 'missing'}`;
      messages.push({
        messageId: `msg_${index}`,
        createTime: index,
        senderWxid: 'alice',
        senderName: 'Alice',
        text: '',
        images: [{
          imageId,
          absolutePath: resolveInside(temp, relativePath),
          relativePath,
          pathStatus: 'missing',
          sha256: null,
          conversationId,
          context: [],
        }],
      });
      items[imageId] = {
        imageId,
        state: 'needs_review',
        productCategory: { id: null, decision: 'uncertain' },
        processes: { ids: [], decision: 'uncertain' },
        recognizedText: { value: '', source: null, manuallyCorrected: false },
        manualLocked: false,
        updatedAt: new Date(0).toISOString(),
      };
    }
    const messageFile = `conversations/${conversationId}.json`;
    const annotationFile = `annotations/${conversationId}.json`;
    manifest.conversations.push({
      conversationId,
      username: 'pages@chatroom',
      displayName: 'Pages',
      messageFile,
      annotationFile,
    });
    atomicWriteJson(paths.manifest, manifest);
    atomicWriteJson(resolveInside(temp, messageFile), { schemaVersion: 1, conversationId, displayName: 'Pages', messages });
    atomicWriteJson(resolveInside(temp, annotationFile), { schemaVersion: 1, conversationId, items });
    const availablePath = resolveInside(temp, messages[0].images[0].relativePath);
    fs.mkdirSync(path.dirname(availablePath), { recursive: true });
    fs.writeFileSync(availablePath, Buffer.from('available image'));

    const middle = listDatasetImages({ datasetDir: temp, filters: { state: 'needs_review' }, offset: 50, limit: 50 });
    assert.equal(middle.total, 120);
    assert.equal(middle.offset, 50);
    assert.equal(middle.items.length, 50);
    assert.equal(middle.hasMore, true);
    const last = listDatasetImages({ datasetDir: temp, offset: 100, limit: 50 });
    assert.equal(last.items.length, 20);
    assert.equal(last.hasMore, false);
    assert.equal(listDatasetImages({ datasetDir: temp, filters: { pathStatus: 'available' } }).total, 1);
    assert.equal(listDatasetImages({ datasetDir: temp, filters: { pathStatus: 'missing' } }).total, 119);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

test('non-classifiable media is marked and excluded from image review queues', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'wetrace-media-kind-'));
  const conversationId = 'conv_media_kind';
  const messageFile = `conversations/${conversationId}.json`;
  const annotationFile = `annotations/${conversationId}.json`;
  try {
    const { paths, manifest } = openOrCreateDataset({ rootDir: temp, accountWxid: 'wxid_media' });
    const buildImage = (imageId, relativePath) => ({
      imageId,
      absolutePath: resolveInside(temp, relativePath),
      relativePath,
      pathStatus: 'missing',
      sha256: null,
      conversationId,
      messageId: `msg_${imageId}`,
      senderWxid: 'alice',
      senderName: 'Alice',
      createTime: 1,
      context: [],
    });
    const normalPath = `media/${conversationId}/img_normal.png`;
    fs.mkdirSync(path.dirname(resolveInside(temp, normalPath)), { recursive: true });
    fs.writeFileSync(resolveInside(temp, normalPath), Buffer.from('normal image'));
    const messages = [
      {
        messageId: 'msg_normal',
        type: 3,
        typeName: 'image',
        createTime: 1,
        text: '',
        images: [buildImage('img_normal', normalPath)],
      },
      {
        messageId: 'msg_missing',
        type: 3,
        typeName: 'image',
        createTime: 2,
        text: '',
        images: [buildImage('img_missing', `media/${conversationId}/img_missing.missing`)],
      },
      {
        messageId: 'msg_gif',
        type: 3,
        typeName: 'image',
        createTime: 3,
        text: '',
        images: [buildImage('img_gif', `media/${conversationId}/img_gif.gif`)],
      },
      {
        messageId: 'msg_emoji',
        type: 47,
        typeName: 'emoji',
        createTime: 4,
        text: '',
        images: [buildImage('img_emoji', `media/${conversationId}/img_emoji.missing`)],
      },
    ];
    manifest.conversations.push({
      conversationId,
      username: 'media@chatroom',
      displayName: 'Media group',
      messageFile,
      annotationFile,
    });
    atomicWriteJson(paths.manifest, manifest);
    atomicWriteJson(resolveInside(temp, messageFile), {
      schemaVersion: 1,
      conversationId,
      displayName: 'Media group',
      messages,
    });
    atomicWriteJson(resolveInside(temp, annotationFile), {
      schemaVersion: 1,
      conversationId,
      items: {},
    });

    const eligible = listDatasetImages({ datasetDir: temp });
    assert.equal(eligible.total, 2);
    assert.deepEqual(
      new Set(eligible.items.map((item) => item.imageId)),
      new Set(['img_normal', 'img_missing'])
    );
    const missing = listDatasetImages({ datasetDir: temp, filters: { pathStatus: 'missing' } });
    assert.deepEqual(missing.items.map((item) => item.imageId), ['img_missing']);

    const skipped = listDatasetImages({
      datasetDir: temp,
      filters: { classificationEligible: false },
    });
    assert.equal(skipped.total, 2);
    assert.deepEqual(
      Object.fromEntries(skipped.items.map((item) => [item.imageId, item.mediaKind])),
      { img_emoji: 'emoji', img_gif: 'gif' }
    );
    assert.ok(skipped.items.every((item) =>
      item.isRealImage === false &&
      item.classificationEligible === false &&
      item.annotation.state === 'skipped'
    ));
    assert.throws(() => saveManualClassification({
      datasetDir: temp,
      imageId: 'img_gif',
      categoryId: 'pendant',
      processIds: [],
      processDecision: 'none',
    }), /不是可分类的真实图片/);

    const persisted = readJson(resolveInside(temp, messageFile));
    const persistedImages = persisted.messages.flatMap((message) => message.images);
    assert.equal(persistedImages.find((item) => item.imageId === 'img_normal').isRealImage, true);
    assert.equal(persistedImages.find((item) => item.imageId === 'img_missing').classificationEligible, true);
    assert.equal(persistedImages.find((item) => item.imageId === 'img_gif').classificationSkipReason, 'gif');
    assert.equal(persistedImages.find((item) => item.imageId === 'img_emoji').classificationSkipReason, 'emoji');
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

test('dataset paths are rebound after a move and manual locks survive Codex results', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'wetrace-jewelry-dataset-'));
  const firstRoot = path.join(temp, 'first');
  const secondRoot = path.join(temp, 'moved');
  const conversationId = 'conv_test';
  const imageId = 'img_test';

  try {
    const { paths, manifest } = openOrCreateDataset({ rootDir: firstRoot, accountWxid: 'wxid_self' });
    const relativePath = `media/${conversationId}/${imageId}.png`;
    const absolutePath = resolveInside(firstRoot, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, Buffer.from('image'));
    manifest.conversations.push({
      conversationId,
      username: 'group@chatroom',
      displayName: 'Group',
      messageFile: `conversations/${conversationId}.json`,
      annotationFile: `annotations/${conversationId}.json`,
    });
    atomicWriteJson(paths.manifest, manifest);
    atomicWriteJson(path.join(paths.conversations, `${conversationId}.json`), {
      schemaVersion: 1,
      conversationId,
      username: 'group@chatroom',
      displayName: 'Group',
      messages: [{
        messageId: 'msg_test',
        createTime: 100,
        senderWxid: 'alice',
        senderName: 'Alice',
        text: '5G pendant',
        images: [{
          imageId,
          absolutePath,
          relativePath,
          pathStatus: 'available',
          sha256: 'hash',
          conversationId,
          messageId: 'msg_test',
          senderWxid: 'alice',
          senderName: 'Alice',
          createTime: 100,
          context: [],
        }],
      }],
    });
    atomicWriteJson(path.join(paths.annotations, `${conversationId}.json`), {
      schemaVersion: 1,
      conversationId,
      items: {
        [imageId]: {
          imageId,
          state: 'needs_review',
          productCategory: { id: null, decision: 'uncertain' },
          processes: { ids: [], decision: 'uncertain' },
          recognizedText: { value: '', source: null, manuallyCorrected: false },
          contextMessageIds: [],
          evidence: [],
          reason: '',
          source: null,
          runId: null,
          manualLocked: false,
          updatedAt: new Date(0).toISOString(),
        },
      },
    });

    fs.renameSync(firstRoot, secondRoot);
    let listed = listDatasetImages({ datasetDir: secondRoot });
    assert.equal(listed.items[0].absolutePath, path.join(secondRoot, ...relativePath.split('/')));
    assert.equal(listed.items[0].pathStatus, 'available');

    assert.throws(() => saveManualClassification({
      datasetDir: secondRoot,
      imageId,
      categoryId: null,
      processIds: [],
      processDecision: 'none',
    }), /未知品类/);
    saveManualClassification({
      datasetDir: secondRoot,
      imageId,
      categoryId: 'pendant',
      processIds: ['x5g', 'x5g'],
      processDecision: 'selected',
      recognizedText: '5G',
    });
    applyCodexResults({
      datasetDir: secondRoot,
      runId: 'run_later',
      results: [{
        imageId,
        categoryId: 'ring',
        categoryDecision: 'selected',
        processIds: [],
        processDecision: 'none',
        recognizedText: 'ring',
        evidence: ['visual'],
        reason: 'later result',
      }],
    });
    listed = listDatasetImages({ datasetDir: secondRoot });
    assert.equal(listed.items[0].annotation.productCategory.id, 'pendant');
    assert.deepEqual(listed.items[0].annotation.processes.ids, ['x5g']);
    assert.equal(listed.items[0].annotation.recognizedText.value, '5G');
    assert.equal(listed.items[0].annotation.manualLocked, true);

    assert.throws(() => resolveInside(secondRoot, '../outside.png'), /超出数据集目录/);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});
