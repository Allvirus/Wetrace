const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  CLASSIFICATION_BATCH_SIZE,
  buildPrompt,
  cancelJewelryClassification,
  createOutputSchema,
  listClassificationRuns,
  runJewelryClassification,
  validateBatchResults,
} = require('../lib/codexJewelryClassifier');
const {
  atomicWriteJson,
  openOrCreateDataset,
  readJson,
  resolveInside,
} = require('../lib/jewelryDataset');

const items = [{
  imageId: 'img_one',
  messageText: '新品 5G 吊坠',
  context: [
    { datetime: '2026-01-01 10:00:00', senderName: 'Alice', text: '前文' },
    { datetime: '2026-01-01 10:01:00', senderName: 'Bob', text: '后文' },
  ],
}];

function validResult(overrides = {}) {
  return {
    imageId: 'img_one',
    categoryId: 'pendant',
    categoryDecision: 'selected',
    processIds: ['x5g'],
    processDecision: 'selected',
    recognizedText: '5G',
    evidence: ['visual', 'image_text', 'chat_context'],
    reason: 'Text and context agree.',
    ...overrides,
  };
}

test('Codex classification schema uses fixed labels and batches eight images', () => {
  assert.equal(CLASSIFICATION_BATCH_SIZE, 8);
  const schema = createOutputSchema(['img_one']);
  const resultSchema = schema.properties.results.items.properties;
  assert.deepEqual(resultSchema.categoryDecision.enum, ['selected', 'uncertain']);
  assert.equal(resultSchema.categoryId.anyOf[0].enum.length, 10);
  assert.equal(resultSchema.processIds.items.enum.length, 8);
  assert.equal(resultSchema.processIds.uniqueItems, true);
});

test('Codex prompt binds image text and chronological chat context', () => {
  const prompt = buildPrompt(items);
  assert.match(prompt, /IMAGE 1: img_one/);
  assert.ok(prompt.indexOf('Alice: 前文') < prompt.indexOf('Bob: 后文'));
  assert.match(prompt, /Associated message: 新品 5G 吊坠/);
});

test('Codex results reject unknown labels, inconsistent states, and missing decisions', () => {
  assert.deepEqual(validateBatchResults({ results: [validResult()] }, items)[0].processIds, ['x5g']);
  assert.deepEqual(
    validateBatchResults({ results: [validResult({ processIds: ['x5g', 'x5g'] })] }, items)[0].processIds,
    ['x5g']
  );
  assert.throws(
    () => validateBatchResults({ results: [validResult({ categoryId: 'watch' })] }, items),
    /无效品类/
  );
  assert.throws(
    () => validateBatchResults({ results: [validResult({ processIds: ['laser'] })] }, items),
    /无效工艺/
  );
  assert.throws(
    () => validateBatchResults({ results: [validResult({ categoryDecision: undefined })] }, items),
    /品类判断状态/
  );
  assert.throws(
    () => validateBatchResults({ results: [validResult({ processDecision: 'none', processIds: ['x5g'] })] }, items),
    /工艺与判断状态不一致/
  );
});

function createFakeDataset(rootDir, { extension = 'png' } = {}) {
  const conversationId = 'conv_fake';
  const imageId = 'img_fake';
  const { paths, manifest } = openOrCreateDataset({ rootDir, accountWxid: 'wxid_fake' });
  const relativePath = `media/${conversationId}/${imageId}.${extension}`;
  const absolutePath = resolveInside(rootDir, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, Buffer.from('fake image'));
  manifest.conversations.push({
    conversationId,
    username: 'fake@chatroom',
    displayName: 'Fake group',
    messageFile: `conversations/${conversationId}.json`,
    annotationFile: `annotations/${conversationId}.json`,
  });
  atomicWriteJson(paths.manifest, manifest);
  atomicWriteJson(path.join(paths.conversations, `${conversationId}.json`), {
    schemaVersion: 1,
    conversationId,
    username: 'fake@chatroom',
    displayName: 'Fake group',
    messages: [{
      messageId: 'msg_fake',
      createTime: 100,
      senderWxid: 'alice',
      senderName: 'Alice',
      text: '5G pendant',
      images: [{
        imageId,
        absolutePath,
        relativePath,
        pathStatus: 'available',
        sha256: 'fake',
        conversationId,
        messageId: 'msg_fake',
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
        state: 'pending',
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
  return { imageId, annotationPath: path.join(paths.annotations, `${conversationId}.json`) };
}

test('Codex classification skips GIF media before launching the CLI', async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'wetrace-skip-gif-'));
  const datasetDir = path.join(temp, 'dataset');
  try {
    const { imageId, annotationPath } = createFakeDataset(datasetDir, { extension: 'gif' });
    const result = await runJewelryClassification({
      datasetDir,
      imageIds: [imageId],
      commandOverride: { command: 'missing-codex-command' },
    });
    assert.equal(result.skipped, true);
    assert.equal(result.total, 0);
    const annotation = readJson(annotationPath).items[imageId];
    assert.equal(annotation.state, 'skipped');
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

function writeFakeCodex(scriptPath) {
  fs.writeFileSync(scriptPath, `
const fs = require('fs');
const args = process.argv.slice(2);
if (args.includes('exec') && args.includes('--help')) {
  process.stdout.write('--image --output-schema');
  process.exit(0);
}
if (args.includes('login') && args.includes('status')) process.exit(0);
const outputIndex = args.indexOf('--output-last-message');
const schemaIndex = args.indexOf('--output-schema');
if (args.includes('--fail')) {
  process.stderr.write('fake classification failure');
  process.exit(2);
}
const finish = () => {
  const schema = JSON.parse(fs.readFileSync(args[schemaIndex + 1], 'utf8'));
  const ids = schema.properties.results.items.properties.imageId.enum;
  const results = ids.map((imageId) => ({
    imageId,
    categoryId: 'pendant',
    categoryDecision: 'selected',
    processIds: ['x5g'],
    processDecision: 'selected',
    recognizedText: '5G',
    evidence: ['visual', 'image_text'],
    reason: 'fake result'
  }));
  fs.writeFileSync(args[outputIndex + 1], JSON.stringify({ results }));
  process.stdout.write(JSON.stringify({ type: 'item.completed' }) + '\\n');
};
process.stdin.resume();
if (args.includes('--slow')) setTimeout(finish, 2000);
else finish();
`, 'utf8');
}

test('fake Codex CLI covers progress, failure, retry, and cancellation without account usage', async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'wetrace-fake-codex-'));
  const datasetDir = path.join(temp, 'dataset');
  const fakePath = path.join(temp, 'fake-codex.js');
  try {
    const { imageId, annotationPath } = createFakeDataset(datasetDir);
    writeFakeCodex(fakePath);
    const progress = [];
    const failedRun = await runJewelryClassification({
      datasetDir,
      imageIds: [imageId],
      commandOverride: { command: process.execPath, prefixArgs: [fakePath, '--fail'] },
      onProgress: (event) => progress.push(event.phase),
    });
    assert.equal(failedRun.status, 'completed_with_errors');
    assert.equal(readJson(annotationPath).items[imageId].state, 'failed');

    const retriedRun = await runJewelryClassification({
      datasetDir,
      imageIds: [imageId],
      commandOverride: { command: process.execPath, prefixArgs: [fakePath] },
      onProgress: (event) => progress.push(event.phase),
    });
    assert.equal(retriedRun.status, 'completed');
    const retried = readJson(annotationPath).items[imageId];
    assert.equal(retried.state, 'classified');
    assert.equal(retried.productCategory.id, 'pendant');
    assert.deepEqual(retried.processes.ids, ['x5g']);
    assert.ok(progress.includes('classification-event'));

    const autoDuplicate = await runJewelryClassification({
      datasetDir,
      imageIds: [imageId],
      eligibleStates: ['pending'],
      commandOverride: { command: process.execPath, prefixArgs: [fakePath, '--fail'] },
    });
    assert.equal(autoDuplicate.skipped, true);

    const cancelling = runJewelryClassification({
      datasetDir,
      imageIds: [imageId],
      commandOverride: { command: process.execPath, prefixArgs: [fakePath, '--slow'] },
    });
    setTimeout(() => cancelJewelryClassification(), 100);
    const cancelledRun = await cancelling;
    assert.equal(cancelledRun.status, 'cancelled');
    const afterCancel = readJson(annotationPath).items[imageId];
    assert.ok(listClassificationRuns(datasetDir).length >= 2);
    assert.equal(fs.existsSync(path.join(datasetDir, 'classification', 'runs')), false);
    assert.equal(afterCancel.state, 'classified');
    assert.equal(afterCancel.productCategory.id, 'pendant');
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});
