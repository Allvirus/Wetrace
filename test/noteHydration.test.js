const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { getAccountDataPaths } = require('../lib/accountDataPaths');
const { openGroupRecordStore } = require('../lib/groupRecordStore');
const {
  atomicWriteJson,
  openOrCreateDataset,
  resolveInside,
  stableId,
} = require('../lib/jewelryDataset');
const {
  listNoteHydrationTasks,
  updateNoteHydrationTaskState,
} = require('../lib/noteHydration');
const { downloadNoteResources } = require('../lib/noteResourceDownloader');

test('note hydration tasks track only real note images and preserve attempt state', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wetrace-note-tasks-'));
  const username = 'notes@chatroom';
  const conversationId = stableId('conv', username);
  const messageId = stableId('msg', username + ':900');
  try {
    const { paths, manifest } = openOrCreateDataset({ rootDir: root });
    const availableRelative = `media/${conversationId}/img_available.png`;
    const missingRelative = `media/${conversationId}/img_missing.missing`;
    const skippedRelative = `media/${conversationId}/img_gif.gif`;
    const availablePath = resolveInside(root, availableRelative);
    fs.mkdirSync(path.dirname(availablePath), { recursive: true });
    fs.writeFileSync(availablePath, Buffer.from('image'));

    manifest.conversations.push({
      conversationId,
      username,
      displayName: 'Notes',
      messageFile: `conversations/${conversationId}.json`,
      annotationFile: `annotations/${conversationId}.json`,
    });
    atomicWriteJson(paths.manifest, manifest);
    const conversationPath = resolveInside(root, manifest.conversations[0].messageFile);
    const conversation = {
      schemaVersion: 1,
      conversationId,
      username,
      displayName: 'Notes',
      messages: [{
        messageId,
        sourceLocalId: 9,
        sourceServerId: '900',
        createTime: 100,
        datetime: '2026-07-21 10:00:00',
        senderWxid: 'alice',
        senderName: 'Alice',
        text: '款式 A',
        images: [
          {
            imageId: 'img_available',
            relativePath: availableRelative,
            absolutePath: availablePath,
            pathStatus: 'available',
            isRealImage: true,
            classificationEligible: true,
          },
          {
            imageId: 'img_missing',
            relativePath: missingRelative,
            absolutePath: resolveInside(root, missingRelative),
            pathStatus: 'missing',
            isRealImage: true,
            classificationEligible: true,
          },
          {
            imageId: 'img_gif',
            relativePath: skippedRelative,
            absolutePath: resolveInside(root, skippedRelative),
            pathStatus: 'missing',
            isRealImage: false,
            classificationEligible: false,
          },
        ],
      }],
    };
    conversation.messages.push({
      messageId: stableId('msg', username + ':901'),
      sourceLocalId: 10,
      sourceServerId: '901',
      createTime: 101,
      datetime: '2026-07-21 10:00:01',
      senderWxid: 'alice',
      senderName: 'Alice',
      text: 'GIF only',
      images: [{
        imageId: 'img_gif_only',
        relativePath: skippedRelative,
        absolutePath: resolveInside(root, skippedRelative),
        pathStatus: 'missing',
        isRealImage: false,
        classificationEligible: false,
      }],
    });
    atomicWriteJson(conversationPath, conversation);

    const store = await openGroupRecordStore(getAccountDataPaths(root).groupRecordDbPath);
    store.storeGroup({
      username,
      displayName: 'Notes',
      sourceVersion: 'v1',
      replace: true,
      messages: [{
        id: 9,
        serverId: '900',
        type: 49,
        typeName: 'note',
        createTime: 100,
        datetime: '2026-07-21 10:00:00',
        senderWxid: 'alice',
        senderName: 'Alice',
        content: '款式 A',
        extra: {
          kind: 'note',
          recordItems: [
            { kind: 'text', dataDesc: '款式 A' },
            { kind: 'image', fullMd5: '11111111111111111111111111111111' },
            {
              kind: 'image',
              fullMd5: '22222222222222222222222222222222',
              cdnDataUrl: 'aabb',
              cdnDataKey: 'ccdd',
              dataSize: 5,
            },
            { kind: 'image', fullMd5: '33333333333333333333333333333333' },
          ],
        },
      }, {
        id: 10,
        serverId: '901',
        type: 49,
        typeName: 'note',
        createTime: 101,
        datetime: '2026-07-21 10:00:01',
        senderWxid: 'alice',
        senderName: 'Alice',
        content: 'GIF only',
        extra: {
          kind: 'note',
          recordItems: [
            { kind: 'text', dataDesc: 'GIF only' },
            { kind: 'image', fullMd5: '44444444444444444444444444444444' },
          ],
        },
      }],
    });
    store.close();

    let listed = await listNoteHydrationTasks({ datasetDir: root, username });
    assert.equal(listed.tasks.length, 1);
    assert.equal(listed.tasks[0].expectedCount, 2);
    assert.equal(listed.tasks[0].availableCount, 1);
    assert.equal(listed.tasks[0].missingCount, 1);
    assert.equal(listed.summary.downloadableImages, 1);
    assert.equal(listed.tasks[0].imageItems[1].resourceDownloadable, true);
    assert.equal(listed.tasks[0].imageItems[1].resourceDescriptor, undefined);
    const listedWithDescriptors = await listNoteHydrationTasks({
      datasetDir: root,
      username,
      includeResourceDescriptors: true,
    });
    assert.equal(listedWithDescriptors.tasks[0].imageItems[1].resourceDescriptor.cdnDataKey, 'ccdd');
    const rangeFiltered = await listNoteHydrationTasks({
      datasetDir: root,
      username,
      startTime: 101,
    });
    assert.equal(rangeFiltered.tasks.length, 0);
    assert.equal(rangeFiltered.summary.missingImages, 0);
    assert.deepEqual(
      listed.tasks[0].imageItems.map((item) => item.imageId),
      ['img_available', 'img_missing']
    );

    const running = updateNoteHydrationTaskState({
      datasetDir: root,
      taskId: listed.tasks[0].taskId,
      status: 'running',
      incrementAttempt: true,
    });
    const failed = updateNoteHydrationTaskState({
      datasetDir: root,
      taskId: listed.tasks[0].taskId,
      status: 'failed',
      error: 'not found',
    });
    assert.equal(failed.attempts, 1);
    assert.equal(failed.lastAttemptAt, running.lastAttemptAt);

    updateNoteHydrationTaskState({
      datasetDir: root,
      taskId: listed.tasks[0].taskId,
      status: 'completed',
    });
    listed = await listNoteHydrationTasks({ datasetDir: root, username });
    assert.equal(listed.tasks[0].status, 'pending');

    const recoveredRelative = `media/${conversationId}/img_missing.png`;
    fs.writeFileSync(resolveInside(root, recoveredRelative), Buffer.from('recovered'));
    conversation.messages[0].images[1].relativePath = recoveredRelative;
    conversation.messages[0].images[1].absolutePath = resolveInside(root, recoveredRelative);
    conversation.messages[0].images[1].pathStatus = 'available';
    atomicWriteJson(conversationPath, conversation);
    listed = await listNoteHydrationTasks({ datasetDir: root, username });
    assert.equal(listed.tasks[0].status, 'completed');
    assert.equal(listed.summary.missingImages, 0);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('resource downloader deduplicates, validates, and reuses dataset cache', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wetrace-note-resource-'));
  try {
    openOrCreateDataset({ rootDir: root });
    const first = Buffer.from('first-image');
    const second = Buffer.from('second-image');
    const descriptor = (buffer, suffix) => ({
      fullMd5: require('crypto').createHash('md5').update(buffer).digest('hex'),
      cdnDataUrl: 'aa' + suffix,
      cdnDataKey: 'bb' + suffix,
      dataSize: buffer.length,
    });
    const firstDescriptor = descriptor(first, '11');
    const secondDescriptor = descriptor(second, '22');
    const calls = [];
    const provider = {
      name: 'fake-provider',
      available: true,
      async download({ descriptor: item, outputPath }) {
        calls.push(item.fullMd5);
        fs.writeFileSync(outputPath, item.fullMd5 === firstDescriptor.fullMd5 ? first : second);
      },
    };
    const tasks = [{
      taskId: 'task_one',
      missingCount: 2,
      imageItems: [
        { available: false, resourceDescriptor: firstDescriptor },
        { available: false, resourceDescriptor: secondDescriptor },
      ],
    }, {
      taskId: 'task_two',
      missingCount: 1,
      imageItems: [{ available: false, resourceDescriptor: firstDescriptor }],
    }];

    const result = await downloadNoteResources({ datasetDir: root, tasks, provider });
    assert.equal(result.uniqueResources, 2);
    assert.equal(result.downloaded, 2);
    assert.equal('paused' in result, false);
    assert.equal(result.cached, 0);
    assert.deepEqual(result.hydratedTaskIds, ['task_one', 'task_two']);
    assert.deepEqual(calls.sort(), [firstDescriptor.fullMd5, secondDescriptor.fullMd5].sort());

    const cacheDir = getAccountDataPaths(root).noteResourceCacheDir;
    assert.deepEqual(fs.readFileSync(path.join(cacheDir, firstDescriptor.fullMd5 + '.bin')), first);
    assert.deepEqual(fs.readFileSync(path.join(cacheDir, secondDescriptor.fullMd5 + '.bin')), second);

    const cached = await downloadNoteResources({
      datasetDir: root,
      tasks,
      provider: { name: 'offline', available: false },
    });
    assert.equal(cached.cached, 2);
    assert.equal(cached.downloaded, 0);
    assert.deepEqual(cached.hydratedTaskIds, ['task_one', 'task_two']);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('resource downloader rejects invalid output without leaving partial files', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wetrace-note-resource-invalid-'));
  try {
    openOrCreateDataset({ rootDir: root });
    const expected = Buffer.from('expected');
    const fullMd5 = require('crypto').createHash('md5').update(expected).digest('hex');
    const result = await downloadNoteResources({
      datasetDir: root,
      tasks: [{
        taskId: 'task_bad',
        missingCount: 2,
        imageItems: [{
          available: false,
          resourceDescriptor: {
            fullMd5,
            cdnDataUrl: 'aabb',
            cdnDataKey: 'ccdd',
            dataSize: expected.length,
          },
        }, {
          available: false,
          resourceDescriptor: { fullMd5: 'bad' },
        }],
      }],
      provider: {
        name: 'bad-provider',
        available: true,
        async download({ outputPath }) {
          fs.writeFileSync(outputPath, Buffer.from('mismatch'));
        },
      },
    });
    assert.equal(result.invalidDescriptors, 1);
    assert.equal(result.downloaded, 0);
    assert.equal(result.errors.length, 1);
    assert.match(result.errors[0].error, /md5-mismatch/);
    const files = fs.readdirSync(getAccountDataPaths(root).noteResourceCacheDir);
    assert.deepEqual(files, []);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
