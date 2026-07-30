const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  atomicWriteJson,
  openOrCreateDataset,
  readDatasetItems,
  resolveInside,
} = require('../lib/jewelryDataset');
const { openLearningDatabase } = require('../lib/jewelryLearningStore');
const {
  cosineSimilarity,
  normalizeVector,
  searchSimilarImage,
} = require('../lib/jewelrySimilarity');

function createSimilarityDataset(rootDir) {
  const conversationId = 'conv_similarity';
  const opened = openOrCreateDataset({ rootDir, accountWxid: 'wxid_similarity' });
  const messages = [];
  const annotations = {};
  const definitions = [
    { id: 'query', sha: 'sha-query', category: 'ring', process: 'x5g' },
    { id: 'near', sha: 'sha-near', category: 'ring', process: 'x5g' },
    { id: 'far', sha: 'sha-far', category: 'pendant', process: 'plain_gold' },
  ];
  for (let index = 0; index < definitions.length; index += 1) {
    const definition = definitions[index];
    const relativePath = ['media', conversationId, definition.id + '.png'].join('/');
    const absolutePath = resolveInside(rootDir, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, Buffer.from(definition.id));
    messages.push({
      messageId: 'message-' + definition.id,
      sourceLocalId: index + 1,
      createTime: 100 + index,
      datetime: '2026-07-28 10:00:0' + index,
      senderWxid: 'sender-' + index,
      senderName: 'Sender ' + index,
      text: '',
      images: [{
        imageId: definition.id,
        absolutePath,
        relativePath,
        pathStatus: 'available',
        sha256: definition.sha,
        mediaKind: 'image',
        classificationEligible: true,
        conversationId,
        messageId: 'message-' + definition.id,
        senderWxid: 'sender-' + index,
        senderName: 'Sender ' + index,
        createTime: 100 + index,
        datetime: '2026-07-28 10:00:0' + index,
        context: [],
      }],
    });
    annotations[definition.id] = {
      imageId: definition.id,
      state: 'classified',
      jewelryDecision: 'jewelry',
      productCategory: { id: definition.category, decision: 'selected' },
      processes: { ids: [definition.process], decision: 'selected' },
      recognizedText: { value: '', source: null, manuallyCorrected: false },
      evidence: ['visual'],
      reason: '',
      source: 'manual',
      manualLocked: true,
      updatedAt: new Date(0).toISOString(),
    };
  }
  opened.manifest.conversations = [{
    conversationId,
    username: '43697551884@chatroom',
    displayName: 'Similarity group',
    messageFile: 'conversations/' + conversationId + '.json',
    annotationFile: 'annotations/' + conversationId + '.json',
  }];
  atomicWriteJson(opened.paths.manifest, opened.manifest);
  atomicWriteJson(path.join(opened.paths.conversations, conversationId + '.json'), {
    schemaVersion: 2,
    conversationId,
    username: '43697551884@chatroom',
    displayName: 'Similarity group',
    messages,
  });
  atomicWriteJson(path.join(opened.paths.annotations, conversationId + '.json'), {
    schemaVersion: 2,
    conversationId,
    items: annotations,
  });
  return readDatasetItems(rootDir).items;
}

test('similarity search stores de-duplicated vectors and reranks traceable GUID results', async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'wetrace-similarity-'));
  const datasetDir = path.join(temp, 'dataset');
  const learningDbPath = path.join(temp, 'learning.db');
  try {
    const items = createSimilarityDataset(datasetDir);
    const query = items.find((item) => item.sourceImageId === 'query');
    const vectors = {
      'query.png': [1, 0],
      'near.png': [0.99, 0.1],
      'far.png': [0, 1],
    };
    const embeddingProvider = async (imagePath) => vectors[path.basename(imagePath)];
    const result = await searchSimilarImage({
      sources: [{ datasetDir }],
      imageId: query.imageId,
      day: '2026-07-28',
      topK: 10,
      learningDbPath,
      embeddingProvider,
    });
    assert.equal(result.results.length, 2);
    assert.equal(result.results[0].sourceImageId, 'near');
    assert.equal(result.results[0].datasetId, query.datasetId);
    assert.ok(result.results[0].score > result.results[1].score);
    assert.ok(result.results.every((item) => item.imageId && item.day === '2026-07-28'));

    const db = openLearningDatabase(learningDbPath);
    try {
      assert.equal(db.prepare('SELECT count(*) AS count FROM jewelry_image_embeddings').get().count, 3);
      assert.equal(db.prepare('SELECT count(*) AS count FROM jewelry_embedding_refs').get().count, 3);
    } finally {
      db.close();
    }
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

test('cosine helper normalizes vectors without changing visual ordering', () => {
  const left = normalizeVector([3, 0]);
  const near = normalizeVector([2, 1]);
  const far = normalizeVector([0, 4]);
  assert.ok(cosineSimilarity(left, near) > cosineSimilarity(left, far));
});