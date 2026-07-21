const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  decryptAllDatabases,
  getDatabaseSourceFingerprint,
} = require('../lib/decryptDb');
const {
  buildDecryptInfo,
  decryptWeChatData,
  getEncryptedStorageFingerprint,
} = require('../lib/decryptCore');

function createFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wetrace-decrypt-incremental-'));
  const accountDir = path.join(root, 'account');
  const dbDir = path.join(accountDir, 'db_storage');
  const outDir = path.join(root, 'decrypted');
  const dbPath = path.join(dbDir, 'message', 'message_0.db');
  const outPath = path.join(outDir, 'message', 'message_0.db');
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(dbPath, Buffer.alloc(4096, 1));
  fs.writeFileSync(outPath, 'old-output');
  return { root, accountDir, dbDir, outDir, dbPath, outPath };
}

function fakeCopy(calls, shouldSucceed = () => true) {
  return (sourcePath, tempPath) => {
    calls.push(sourcePath);
    fs.writeFileSync(tempPath, fs.readFileSync(sourcePath));
    return shouldSucceed(sourcePath);
  };
}

function keysFor(...relativePaths) {
  return Object.fromEntries(relativePaths.map((rel) => [rel, { enc_key: 'test-key' }]));
}

test('normal conversation scans never escalate to force decrypt', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'electron', 'scanWorker.js'), 'utf8');
  assert.doesNotMatch(source, /ensureDecrypted\(\{[\s\S]*forceDecrypt:\s*true/);
});
test('unchanged database reuses its existing decrypted output', () => {
  const fixture = createFixture();
  try {
    const rel = 'message/message_0.db';
    const sourceFingerprint = getDatabaseSourceFingerprint(fixture.dbPath);
    const before = fs.statSync(fixture.outPath).mtimeMs;
    const calls = [];
    const result = decryptAllDatabases({
      dbDir: fixture.dbDir,
      outDir: fixture.outDir,
      keys: keysFor(rel),
      decryptedFiles: { [rel]: sourceFingerprint },
      decryptDatabaseFn: fakeCopy(calls),
    });

    assert.equal(result.reused, 1);
    assert.equal(result.passed, 0);
    assert.deepEqual(calls, []);
    assert.equal(fs.statSync(fixture.outPath).mtimeMs, before);
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('database and companion state changes bypass reuse', () => {
  const fixture = createFixture();
  try {
    const rel = 'message/message_0.db';
    const initial = getDatabaseSourceFingerprint(fixture.dbPath);
    const calls = [];
    fs.writeFileSync(fixture.dbPath, Buffer.alloc(4096, 2));
    const future = new Date(Date.now() + 2000);
    fs.utimesSync(fixture.dbPath, future, future);

    const changedDb = decryptAllDatabases({
      dbDir: fixture.dbDir,
      outDir: fixture.outDir,
      keys: keysFor(rel),
      decryptedFiles: { [rel]: initial },
      decryptDatabaseFn: fakeCopy(calls),
    });
    assert.equal(changedDb.passed, 1);
    assert.equal(changedDb.reused, 0);

    const afterDb = changedDb.decryptedFiles[rel];
    fs.writeFileSync(fixture.dbPath + '-wal', 'wal-state');
    const changedWal = decryptAllDatabases({
      dbDir: fixture.dbDir,
      outDir: fixture.outDir,
      keys: keysFor(rel),
      decryptedFiles: { [rel]: afterDb },
      decryptDatabaseFn: fakeCopy(calls),
    });
    assert.equal(changedWal.passed, 1);
    assert.equal(changedWal.reused, 0);
    assert.equal(calls.length, 2);
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('force decrypt bypasses an unchanged source fingerprint', () => {
  const fixture = createFixture();
  try {
    const rel = 'message/message_0.db';
    const calls = [];
    const result = decryptAllDatabases({
      dbDir: fixture.dbDir,
      outDir: fixture.outDir,
      keys: keysFor(rel),
      decryptedFiles: { [rel]: getDatabaseSourceFingerprint(fixture.dbPath) },
      forceDecrypt: true,
      decryptDatabaseFn: fakeCopy(calls),
    });

    assert.equal(result.passed, 1);
    assert.equal(result.reused, 0);
    assert.equal(calls.length, 1);
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('failed decryption preserves the previous output', () => {
  const fixture = createFixture();
  try {
    const rel = 'message/message_0.db';
    const previousFingerprint = getDatabaseSourceFingerprint(fixture.dbPath);
    fs.appendFileSync(fixture.dbPath, Buffer.alloc(4096, 3));
    const result = decryptAllDatabases({
      dbDir: fixture.dbDir,
      outDir: fixture.outDir,
      keys: keysFor(rel),
      decryptedFiles: { [rel]: previousFingerprint },
      decryptDatabaseFn: fakeCopy([], () => false),
    });

    assert.equal(result.failed, 1);
    assert.equal(fs.readFileSync(fixture.outPath, 'utf8'), 'old-output');
    assert.equal(result.decryptedFiles[rel], undefined);
    assert.deepEqual(
      fs.readdirSync(path.dirname(fixture.outPath)).filter((name) => name.includes('.tmp-')),
      []
    );
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('legacy size fingerprints bootstrap per-database reuse', () => {
  const fixture = createFixture();
  try {
    const rel = 'message/message_0.db';
    const calls = [];
    const result = decryptAllDatabases({
      dbDir: fixture.dbDir,
      outDir: fixture.outDir,
      keys: {},
      legacyFingerprint: rel + ':' + fs.statSync(fixture.dbPath).size,
      decryptDatabaseFn: fakeCopy(calls),
    });

    assert.equal(result.reused, 1);
    assert.deepEqual(calls, []);
    assert.equal(result.decryptedFiles[rel], getDatabaseSourceFingerprint(fixture.dbPath));
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('legacy info upgrades without decrypting unchanged files', async () => {
  const fixture = createFixture();
  try {
    const rel = 'message/message_0.db';
    fs.writeFileSync(
      path.join(fixture.outDir, 'info.json'),
      JSON.stringify({
        encrypted_fingerprint: rel + ':' + fs.statSync(fixture.dbPath).size,
      })
    );

    const result = await decryptWeChatData({
      wxDir: fixture.accountDir,
      decryptedDir: fixture.outDir,
    });
    const info = JSON.parse(fs.readFileSync(path.join(fixture.outDir, 'info.json'), 'utf8'));

    assert.equal(result.reused, 1);
    assert.equal(result.passed, 0);
    assert.match(info.encrypted_fingerprint, /^v2\|/);
    assert.equal(info.decrypted_files[rel], getDatabaseSourceFingerprint(fixture.dbPath));
    assert.equal(fs.readFileSync(fixture.outPath, 'utf8'), 'old-output');
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
});
test('partial failure keeps global state and reuses completed files on retry', () => {
  const fixture = createFixture();
  try {
    const relA = 'message/message_0.db';
    const relB = 'message/message_1.db';
    const dbB = path.join(fixture.dbDir, 'message', 'message_1.db');
    const outB = path.join(fixture.outDir, 'message', 'message_1.db');
    fs.writeFileSync(dbB, Buffer.alloc(4096, 4));
    fs.writeFileSync(outB, 'old-output-b');

    const calls = [];
    const first = decryptAllDatabases({
      dbDir: fixture.dbDir,
      outDir: fixture.outDir,
      keys: keysFor(relA, relB),
      decryptedFiles: {},
      decryptDatabaseFn: fakeCopy(calls, (sourcePath) => sourcePath !== dbB),
    });
    assert.equal(first.passed, 1);
    assert.equal(first.failed, 1);

    const previousInfo = {
      encrypted_fingerprint: 'legacy-global',
      decrypted_files: { [relB]: 'old-b' },
    };
    const partialInfo = buildDecryptInfo({
      wxDir: fixture.accountDir,
      previousInfo,
      currentFingerprint: getEncryptedStorageFingerprint(fixture.accountDir),
      result: first,
    });
    assert.equal(partialInfo.encrypted_fingerprint, 'legacy-global');
    assert.equal(partialInfo.decrypted_files[relA], first.decryptedFiles[relA]);
    assert.equal(partialInfo.decrypted_files[relB], 'old-b');

    calls.length = 0;
    const retry = decryptAllDatabases({
      dbDir: fixture.dbDir,
      outDir: fixture.outDir,
      keys: keysFor(relA, relB),
      decryptedFiles: partialInfo.decrypted_files,
      decryptDatabaseFn: fakeCopy(calls, () => false),
    });
    assert.equal(retry.reused, 1);
    assert.equal(retry.failed, 1);
    assert.deepEqual(calls, [dbB]);

    const completeInfo = buildDecryptInfo({
      wxDir: fixture.accountDir,
      previousInfo: partialInfo,
      currentFingerprint: getEncryptedStorageFingerprint(fixture.accountDir),
      result: { ...retry, failed: 0, decryptedFiles: { [relB]: 'new-b' } },
    });
    assert.equal(
      completeInfo.encrypted_fingerprint,
      getEncryptedStorageFingerprint(fixture.accountDir)
    );
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
});