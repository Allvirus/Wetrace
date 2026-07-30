const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  listCandidateRules,
  listLearningExamples,
  openLearningDatabase,
  saveLearningSample,
} = require('../lib/jewelryLearningStore');

function makeRecord({
  hash,
  imageId,
  source = 'codex',
  categoryId = 'ring',
  day = '2026-07-28',
  senderWxid = 'sender-a',
}) {
  return {
    schemaVersion: 2,
    datasetId: 'dataset-learning',
    imageId,
    sourceImageId: 'source-' + imageId,
    source: {
      conversation: { username: '43697551884@chatroom' },
      message: { messageId: 'message-' + imageId, senderWxid },
      image: { sha256: hash },
    },
    context: {
      before: [{ messageId: 'context-' + imageId, text: 'ring', senderWxid, distance: 1 }],
      after: [],
    },
    archive: { day },
    current: {
      state: 'classified',
      source,
      jewelryDecision: 'jewelry',
      category: { id: categoryId },
      processes: [{ id: 'x5g' }],
      recognizedText: { value: '5G ring' },
      evidence: ['visual', 'image_text', 'chat_context'],
      updatedAt: new Date().toISOString(),
    },
  };
}

test('Silver samples participate below Gold and manual corrections retain rejected history', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'wetrace-learning-tier-'));
  const dbPath = path.join(temp, 'learning.db');
  const imagePath = path.join(temp, 'sample.png');
  fs.writeFileSync(imagePath, Buffer.from('sample'));
  try {
    const silver = makeRecord({ hash: 'same-hash', imageId: 'guid-a' });
    assert.equal(saveLearningSample(dbPath, { absolutePath: imagePath }, silver), true);
    assert.equal(listLearningExamples(dbPath)[0].tier, 'silver');

    const corrected = makeRecord({
      hash: 'same-hash',
      imageId: 'guid-a',
      source: 'manual',
      categoryId: 'pendant',
    });
    assert.equal(saveLearningSample(dbPath, { absolutePath: imagePath }, corrected), true);
    assert.equal(listLearningExamples(dbPath)[0].tier, 'gold');
    assert.equal(listLearningExamples(dbPath)[0].categoryId, 'pendant');

    const db = openLearningDatabase(dbPath);
    try {
      assert.equal(db.prepare('SELECT count(*) AS count FROM jewelry_learning_rejections').get().count, 1);
      assert.equal(db.prepare('SELECT tier FROM jewelry_learning_samples').get().tier, 'gold');
    } finally {
      db.close();
    }

    const conflictingGold = makeRecord({
      hash: 'same-hash',
      imageId: 'guid-b',
      source: 'manual',
      categoryId: 'ring',
      senderWxid: 'sender-b',
    });
    assert.equal(saveLearningSample(dbPath, { absolutePath: imagePath }, conflictingGold), true);
    assert.equal(listLearningExamples(dbPath).length, 0);
    const conflictDb = openLearningDatabase(dbPath);
    try {
      assert.equal(conflictDb.prepare('SELECT status FROM jewelry_learning_samples').get().status, 'conflict');
    } finally {
      conflictDb.close();
    }
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

test('three independent Silver hashes across dates create a candidate rule', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'wetrace-learning-rule-'));
  const dbPath = path.join(temp, 'learning.db');
  try {
    for (let index = 0; index < 3; index += 1) {
      const imagePath = path.join(temp, 'sample-' + index + '.png');
      fs.writeFileSync(imagePath, Buffer.from('sample-' + index));
      const record = makeRecord({
        hash: 'hash-' + index,
        imageId: 'guid-' + index,
        day: index === 0 ? '2026-07-27' : '2026-07-28',
        senderWxid: 'sender-' + index,
      });
      assert.equal(saveLearningSample(dbPath, { absolutePath: imagePath }, record), true);
    }
    const candidates = listCandidateRules(dbPath);
    assert.equal(candidates.length, 1);
    assert.equal(candidates[0].sampleCount, 3);
    assert.equal(candidates[0].categoryId, 'ring');
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});