const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { atomicWriteJson, openOrCreateDataset } = require('../lib/jewelryDataset');
const { sourceDay } = require('../lib/jewelryArchive');
const { normalizeClassificationScope } = require('../lib/jewelryClassificationScope');

test('classification scope validates multiple datasets, dates, and group allowlists', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'wetrace-scope-'));
  try {
    const firstDir = path.join(temp, 'first');
    const secondDir = path.join(temp, 'second');
    const first = openOrCreateDataset({ rootDir: firstDir, accountWxid: 'wxid_first' });
    const second = openOrCreateDataset({ rootDir: secondDir, accountWxid: 'wxid_second' });
    const scope = normalizeClassificationScope({
      sources: [
        {
          datasetId: first.manifest.datasetId,
          datasetDir: firstDir,
          accountWxid: 'wxid_first',
          conversationUsernames: ['43697551884@chatroom'],
        },
        {
          datasetId: second.manifest.datasetId,
          datasetDir: secondDir,
          accountWxid: 'wxid_second',
          conversationUsernames: ['43697551884@chatroom'],
        },
      ],
      dateFrom: '2026-07-01',
      dateTo: '2026-07-28',
      states: ['pending', 'failed', 'pending'],
    });
    assert.equal(scope.sources.length, 2);
    assert.deepEqual(scope.states, ['pending', 'failed']);
    assert.equal(scope.dateFrom, '2026-07-01');
    assert.equal(scope.dateTo, '2026-07-28');

    assert.throws(() => normalizeClassificationScope({
      sources: [{ datasetDir: firstDir }, { datasetDir: firstDir }],
    }), /same dataset/);
    assert.throws(() => normalizeClassificationScope({
      sources: [{ datasetDir: firstDir, conversationUsernames: ['outside@chatroom'] }],
    }), /outside the allowlist/);
    assert.throws(() => normalizeClassificationScope({
      sources: [{ datasetDir: firstDir }],
      dateFrom: '2026-08-01',
      dateTo: '2026-07-01',
    }), /date range/);

    first.manifest.classificationPolicy = {
      schemaVersion: 1,
      mode: 'active',
      allowedConversationUsernames: ['43697551884@chatroom', 'future@chatroom'],
    };
    atomicWriteJson(first.paths.manifest, first.manifest);
    const expanded = normalizeClassificationScope({
      sources: [{ datasetDir: firstDir, conversationUsernames: ['future@chatroom'] }],
      day: '2026-07-28',
    });
    assert.deepEqual(expanded.sources[0].conversationUsernames, ['future@chatroom']);
    assert.equal(expanded.day, '2026-07-28');
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

test('source dates use the message datetime or Asia Shanghai for timestamps', () => {
  assert.equal(sourceDay({
    source: { message: { datetime: '2026-07-28 09:00:00', createTime: 1 } },
  }), '2026-07-28');
  assert.equal(sourceDay({
    source: { message: { createTime: Date.UTC(2026, 0, 1, 16, 0, 0) / 1000 } },
  }), '2026-01-02');
});