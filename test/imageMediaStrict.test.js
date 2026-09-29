const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { resolveConversationImages } = require('../lib/exportCore');
const {
  buildDatasetImageId,
  findExistingMessageImagePaths,
  getExpectedImageHashes,
  getGroupImageCacheFingerprint,
  initImageExportContext,
  exportChatImages,
  isStrictImageCandidate,
} = require('../lib/imageMedia');

test('group image cache fingerprint tracks selected group and note cache only', () => {
  const accountDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wetrace-media-fingerprint-'));
  const username = 'selected@chatroom';
  const selectedKey = crypto.createHash('md5').update(username).digest('hex');
  const otherKey = crypto.createHash('md5').update('other@chatroom').digest('hex');
  const selectedDir = path.join(accountDir, 'cache', '2026-07', 'Message', selectedKey, 'Bubble');
  const otherDir = path.join(accountDir, 'cache', '2026-07', 'Message', otherKey, 'Bubble');
  const noteDir = path.join(accountDir, 'business', 'favorite', 'temp', 'NoteCache');

  try {
    const empty = getGroupImageCacheFingerprint(accountDir, username);
    fs.mkdirSync(otherDir, { recursive: true });
    fs.writeFileSync(path.join(otherDir, 'other.dat'), 'other');
    assert.equal(getGroupImageCacheFingerprint(accountDir, username), empty);

    fs.mkdirSync(selectedDir, { recursive: true });
    const selectedFile = path.join(selectedDir, 'selected.dat');
    fs.writeFileSync(selectedFile, 'image');
    const selected = getGroupImageCacheFingerprint(accountDir, username);
    assert.notEqual(selected, empty);

    const future = new Date(Date.now() + 2000);
    fs.utimesSync(selectedFile, future, future);
    const updated = getGroupImageCacheFingerprint(accountDir, username);
    assert.notEqual(updated, selected);

    fs.mkdirSync(noteDir, { recursive: true });
    fs.writeFileSync(path.join(noteDir, 'note-cache-file'), 'note');
    assert.notEqual(getGroupImageCacheFingerprint(accountDir, username), updated);
  } finally {
    fs.rmSync(accountDir, { recursive: true, force: true });
  }
});
test('dataset image files use stable globally scoped image IDs', () => {
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wetrace-dataset-images-'));
  const conversationId = 'conv_abc123';
  const message = {
    id: 7,
    serverId: '700',
    createTime: 100,
    type: 3,
    extra: { kind: 'image', recordItems: [{ kind: 'image' }] },
  };
  const mainId = buildDatasetImageId(conversationId, message);
  const recordMessage = { id: '7_record_1', serverId: '700_record_1', createTime: 100 };
  const recordId = buildDatasetImageId(conversationId, recordMessage, 'note_1');
  const mediaDir = path.join(outputDir, 'media', conversationId);
  try {
    fs.mkdirSync(mediaDir, { recursive: true });
    fs.writeFileSync(path.join(mediaDir, `${mainId}.png`), 'main');
    fs.writeFileSync(path.join(mediaDir, `${recordId}.jpg`), 'record');
    fs.writeFileSync(path.join(mediaDir, 'img_unrelated.png'), 'other');
    assert.deepEqual(
      findExistingMessageImagePaths(outputDir, conversationId, message, 'dataset'),
      [
        'media/' + conversationId + '/' + mainId + '.png',
        'media/' + conversationId + '/' + recordId + '.jpg',
      ]
    );
  } finally {
    fs.rmSync(outputDir, { recursive: true, force: true });
  }
});

test('dataset image lookup reuses one directory listing per resolve pass', () => {
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wetrace-dataset-image-cache-'));
  const conversationId = 'conv_cached';
  const first = { id: 1, serverId: '101', createTime: 100, type: 3, extra: { kind: 'image' } };
  const second = { id: 2, serverId: '102', createTime: 200, type: 3, extra: { kind: 'image' } };
  const mediaDir = path.join(outputDir, 'media', conversationId);
  const directoryEntryCache = new Map();
  const originalReadDir = fs.readdirSync;
  let mediaDirectoryReads = 0;
  try {
    fs.mkdirSync(mediaDir, { recursive: true });
    fs.writeFileSync(path.join(mediaDir, buildDatasetImageId(conversationId, first) + '.png'), 'first');
    fs.writeFileSync(path.join(mediaDir, buildDatasetImageId(conversationId, second) + '.jpg'), 'second');
    fs.readdirSync = function cachedReadDir(target, options) {
      if (path.resolve(target) === path.resolve(mediaDir)) mediaDirectoryReads += 1;
      return originalReadDir.call(fs, target, options);
    };
    assert.equal(
      findExistingMessageImagePaths(outputDir, conversationId, first, 'dataset', directoryEntryCache).length,
      1
    );
    assert.equal(
      findExistingMessageImagePaths(outputDir, conversationId, second, 'dataset', directoryEntryCache).length,
      1
    );
    assert.equal(mediaDirectoryReads, 1);
  } finally {
    fs.readdirSync = originalReadDir;
    fs.rmSync(outputDir, { recursive: true, force: true });
  }
});

test('strict image matching accepts only matching content hashes', () => {
  const buffer = Buffer.from('correct image bytes');
  const md5 = crypto.createHash('md5').update(buffer).digest('hex');
  const message = { extra: { md5 } };

  assert.deepEqual([...getExpectedImageHashes(message)], [md5]);
  assert.equal(isStrictImageCandidate(message, { buffer }, 3), true);
  assert.equal(isStrictImageCandidate({ extra: { md5: '0'.repeat(32) } }, { buffer }, 1), false);
});

test('strict image matching rejects ambiguous candidates without hashes', () => {
  const loaded = { buffer: Buffer.from('image') };
  assert.equal(isStrictImageCandidate({ extra: {} }, loaded, 1), true);
  assert.equal(isStrictImageCandidate({ extra: {} }, loaded, 2), false);
});

test('flat NoteCache files are matched by content MD5', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wetrace-flat-note-cache-'));
  const accountDir = path.join(tmpDir, 'wxid_self');
  const decryptedDir = path.join(accountDir, 'db_storage_decrypted');
  const outputDir = path.join(tmpDir, 'dataset');
  const noteCacheDir = path.join(accountDir, 'business', 'favorite', 'temp', 'NoteCache');
  const image = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    'base64'
  );
  const md5 = crypto.createHash('md5').update(image).digest('hex');
  const message = {
    id: 9,
    serverId: '900',
    createTime: 100,
    type: 49,
    extra: {
      kind: 'note',
      recordItems: [{ kind: 'image', fullMd5: md5 }],
    },
  };

  try {
    fs.mkdirSync(noteCacheDir, { recursive: true });
    fs.writeFileSync(path.join(noteCacheDir, 'cache-file-without-extension'), image);
    const imageCtx = initImageExportContext({
      accountDir,
      decryptedDir,
      outputDir,
      allowContentScan: false,
      strictMatch: true,
      outputLayout: 'dataset',
    });
    const result = exportChatImages({ messages: [message] }, imageCtx, 'conv_flat_cache');
    const outputPath = message.extra.recordItems[0].outputImagePath;

    assert.equal(result.exported, 1);
    assert.ok(outputPath);
    assert.deepEqual(fs.readFileSync(path.join(outputDir, ...outputPath.split('/'))), image);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('dataset resource cache is parsed by the existing note image flow', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wetrace-resource-cache-image-'));
  const accountDir = path.join(tmpDir, 'account');
  const decryptedDir = path.join(tmpDir, 'decrypted');
  const outputDir = path.join(tmpDir, 'dataset');
  const resourceCacheDir = path.join(outputDir, 'runtime', 'note-resource-cache');
  const image = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    'base64'
  );
  const md5 = crypto.createHash('md5').update(image).digest('hex');
  const message = {
    id: 10,
    serverId: '1000',
    createTime: 200,
    type: 49,
    extra: {
      kind: 'note',
      recordItems: [{ kind: 'image', fullMd5: md5 }],
    },
  };
  try {
    fs.mkdirSync(resourceCacheDir, { recursive: true });
    fs.writeFileSync(path.join(resourceCacheDir, md5 + '.bin'), image);
    const imageCtx = initImageExportContext({
      accountDir,
      decryptedDir,
      outputDir,
      resourceCacheDir,
      allowContentScan: false,
      strictMatch: true,
      outputLayout: 'dataset',
    });
    const result = exportChatImages({ messages: [message] }, imageCtx, 'conv_resource_cache');
    const outputPath = message.extra.recordItems[0].outputImagePath;
    assert.equal(result.exported, 1);
    assert.ok(outputPath);
    assert.deepEqual(fs.readFileSync(path.join(outputDir, ...outputPath.split('/'))), image);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
test('persistent image lookup is scoped to the exact message prefix', () => {
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wetrace-persistent-images-'));
  const chatFileBase = 'group_abc123';
  const mediaDir = path.join(outputDir, 'chats', `${chatFileBase}.media`, 'media');
  try {
    fs.mkdirSync(mediaDir, { recursive: true });
    for (const name of ['100_7.jpg', '100_7_note_1.png', '100_70.jpg', '200_7.jpg']) {
      fs.writeFileSync(path.join(mediaDir, name), name);
    }
    assert.deepEqual(
      findExistingMessageImagePaths(outputDir, chatFileBase, { createTime: 100, id: 7 }),
      [
        'chats/group_abc123.media/media/100_7_note_1.png',
        'chats/group_abc123.media/media/100_7.jpg',
      ]
    );
  } finally {
    fs.rmSync(outputDir, { recursive: true, force: true });
  }
});

test('partial dataset note cache retries only the missing record images', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wetrace-partial-note-'));
  const accountDir = path.join(tmpDir, 'wxid_self_cabc');
  const imageOutputDir = path.join(tmpDir, 'dataset');
  const noteCacheDir = path.join(accountDir, 'business', 'favorite', 'temp', 'NoteCache');
  const conversationId = 'conv_partial_note';
  const firstImage = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    'base64'
  );
  const secondImage = Buffer.concat([firstImage, Buffer.from([0])]);
  const message = {
    id: 7,
    serverId: '700',
    createTime: 100,
    type: 49,
    extra: {
      kind: 'note',
      recordItems: [
        { kind: 'image', fullMd5: crypto.createHash('md5').update(firstImage).digest('hex') },
        { kind: 'image', fullMd5: crypto.createHash('md5').update(secondImage).digest('hex') },
      ],
    },
  };
  const firstId = buildDatasetImageId(
    conversationId,
    { id: '7_record_1', serverId: '700_record_1', createTime: 100 },
    'note_1'
  );
  const secondId = buildDatasetImageId(
    conversationId,
    { id: '7_record_2', serverId: '700_record_2', createTime: 100 },
    'note_2'
  );
  const firstRelativePath = 'media/' + conversationId + '/' + firstId + '.png';
  const secondRelativePath = 'media/' + conversationId + '/' + secondId + '.png';
  const events = [];

  try {
    fs.mkdirSync(path.join(accountDir, 'db_storage_decrypted', 'message'), { recursive: true });
    fs.mkdirSync(noteCacheDir, { recursive: true });
    fs.mkdirSync(path.dirname(path.join(imageOutputDir, firstRelativePath)), { recursive: true });
    fs.writeFileSync(path.join(imageOutputDir, firstRelativePath), firstImage);
    fs.writeFileSync(path.join(noteCacheDir, 'new-cache-name-without-extension'), secondImage);

    const result = await resolveConversationImages({
      wxDir: accountDir,
      username: 'partial@chatroom',
      imageOutputDir,
      chatFileBase: conversationId,
      imageLayout: 'dataset',
      useLegacyExportParser: true,
      messages: [message],
      onProgress: (event) => events.push(event),
    });

    assert.equal(result.imageStats.exported, 1);
    assert.equal(result.imageStats.failed, 1);
    assert.deepEqual(
      result.previews[0].previewImages.map((item) => item.relativePath),
      [firstRelativePath, secondRelativePath]
    );
    assert.deepEqual(fs.readFileSync(path.join(imageOutputDir, secondRelativePath)), secondImage);
    assert.ok(events.some((event) => event.subphase === 'parsing'));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
test('viewer reuses persistent images without rebuilding the WeChat image index', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wetrace-persistent-reuse-'));
  const accountDir = path.join(tmpDir, 'wxid_self_cabc');
  const imageOutputDir = path.join(tmpDir, 'images-v1');
  const username = 'persistent@chatroom';
  const groupKey = crypto.createHash('sha256').update(username).digest('hex').slice(0, 10);
  const mediaDir = path.join(imageOutputDir, 'chats', `group_${groupKey}.media`, 'media');
  try {
    fs.mkdirSync(path.join(accountDir, 'db_storage_decrypted', 'message'), { recursive: true });
    fs.mkdirSync(mediaDir, { recursive: true });
    fs.writeFileSync(path.join(mediaDir, '100_7.jpg'), 'cached image');
    const result = await resolveConversationImages({
      wxDir: accountDir,
      username,
      imageOutputDir,
      messages: [{ id: 7, createTime: 100, type: 3, extra: { kind: 'image' } }],
    });
    assert.equal(result.previews.length, 1);
    assert.equal(result.previews[0].previewImages.length, 1);
    assert.match(result.previews[0].previewImages[0].relativePath, /100_7\.jpg$/);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('viewer existing-only preview does not build an image index for missing images', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wetrace-existing-only-'));
  const accountDir = path.join(tmpDir, 'wxid_self_cabc');
  const imageOutputDir = path.join(tmpDir, 'dataset');
  const events = [];
  try {
    fs.mkdirSync(path.join(accountDir, 'db_storage_decrypted', 'message'), { recursive: true });
    const result = await resolveConversationImages({
      wxDir: accountDir,
      username: 'missing@chatroom',
      imageOutputDir,
      chatFileBase: 'conv_missing',
      imageLayout: 'dataset',
      existingOnly: true,
      messages: [{ id: 9, createTime: 900, type: 3, extra: { kind: 'image' } }],
      onProgress: (event) => events.push(event),
    });

    assert.equal(result.previews[0].previewImages.length, 0);
    assert.ok(events.some((event) => event.subphase === 'cache-only'));
    assert.equal(events.some((event) => ['index', 'index-ready', 'parsing'].includes(event.subphase)), false);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('legacy export image parsing content-scans and reuses one image index', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wetrace-legacy-image-flow-'));
  const accountDir = path.join(tmpDir, 'wxid_self_cabc');
  const sourceDir = path.join(accountDir, 'FileStorage', 'Image');
  const imageOutputDir = path.join(tmpDir, 'dataset');
  const image = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    'base64'
  );
  const secondImage = Buffer.concat([image, Buffer.from([0])]);
  const contextRef = { current: null };
  const events = [];
  try {
    fs.mkdirSync(path.join(accountDir, 'db_storage_decrypted', 'message'), { recursive: true });
    fs.mkdirSync(sourceDir, { recursive: true });
    fs.writeFileSync(path.join(sourceDir, 'unrelated-a.png'), image);
    fs.writeFileSync(path.join(sourceDir, 'unrelated-b.png'), secondImage);
    const first = await resolveConversationImages({
      wxDir: accountDir,
      username: 'first@chatroom',
      imageOutputDir,
      chatFileBase: 'conv_first',
      imageLayout: 'dataset',
      useLegacyExportParser: true,
      imageContextRef: contextRef,
      messages: [{ id: 1, createTime: 100, type: 3, extra: { md5: crypto.createHash('md5').update(image).digest('hex') } }],
      onProgress: (event) => events.push(event),
      progressMeta: { displayName: 'First' },
    });
    const sharedContext = contextRef.current;
    const second = await resolveConversationImages({
      wxDir: accountDir,
      username: 'second@chatroom',
      imageOutputDir,
      chatFileBase: 'conv_second',
      imageLayout: 'dataset',
      useLegacyExportParser: true,
      imageContextRef: contextRef,
      messages: [{ id: 2, createTime: 200, type: 3, extra: { md5: crypto.createHash('md5').update(secondImage).digest('hex') } }],
      onProgress: (event) => events.push(event),
      progressMeta: { displayName: 'Second' },
    });

    assert.equal(first.previews[0].previewImages.length, 1);
    assert.equal(second.previews[0].previewImages.length, 1);
    assert.equal(contextRef.current, sharedContext);
    assert.ok(events.some((event) => event.phase === 'image-resolve' && event.subphase === 'index-ready'));
    assert.ok(events.some((event) => event.phase === 'image-resolve' && event.subphase === 'index-reuse'));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
