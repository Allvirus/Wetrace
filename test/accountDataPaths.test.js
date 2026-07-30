const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { Worker } = require('worker_threads');

const { getAccountDataPaths } = require('../lib/accountDataPaths');
const {
  ensureDecrypted,
  getDecryptedStorageFingerprint,
  getEncryptedStorageFingerprint,
} = require('../lib/decryptCore');
const {
  getConversationCache,
  listConversationCaches,
  saveConversationCache,
} = require('../lib/conversationCache');
const { openOrCreateDataset } = require('../lib/jewelryDataset');
const { openGroupRecordStore } = require('../lib/groupRecordStore');
const { resetAccountDecryptData, resetAllToolTraces } = require('../lib/dataReset');
const {
  getPassphraseCachePath,
  loadCachedPassphrase,
  saveCachedPassphrase,
} = require('../lib/passphraseScan');

function runViewerWorkerAction(action, payload) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const progress = [];
    const worker = new Worker(path.join(__dirname, '..', 'electron', 'viewerWorker.js'), {
      workerData: { action, payload },
    });
    const finish = (handler, value) => {
      if (settled) return;
      settled = true;
      worker.terminate().catch(() => {});
      handler(value);
    };
    worker.on('message', (message) => {
      if (message?.type === 'progress') {
        progress.push(message.event);
        return;
      }
      finish(resolve, { response: message, progress });
    });
    worker.on('error', (error) => finish(reject, error));
    worker.on('exit', (code) => {
      if (!settled) finish(reject, new Error('viewer worker exited with code ' + code));
    });
  });
}

test('SQLite runtime suppresses only its experimental warning', () => {
  const script = [
    "const before = process.emitWarning;",
    "require('./lib/sqliteRuntime');",
    "console.log(process.emitWarning === before ? 'restored' : 'not-restored');",
    "process.emitWarning('sentinel-warning', 'Warning');",
  ].join(' ');
  const child = spawnSync(process.execPath, ['-e', script], {
    cwd: path.join(__dirname, '..'),
    encoding: 'utf8',
  });

  assert.equal(child.status, 0);
  assert.match(child.stdout, /restored/);
  assert.doesNotMatch(child.stderr, /SQLite is an experimental feature/);
  assert.match(child.stderr, /sentinel-warning/);
});

test('viewer runtime preparation runs outside the main event loop', async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'wetrace-runtime-worker-'));
  const accountDir = path.join(temp, 'source-account');
  const encryptedDir = path.join(accountDir, 'db_storage');
  const legacyDecryptedDir = path.join(accountDir, 'db_storage_decrypted');
  const datasetDir = path.join(temp, 'dataset');
  let ticks = 0;
  const heartbeat = setInterval(() => { ticks += 1; }, 1);

  try {
    fs.mkdirSync(path.join(encryptedDir, 'message'), { recursive: true });
    fs.writeFileSync(path.join(encryptedDir, 'message', 'message_0.db'), 'encrypted');
    fs.mkdirSync(path.join(legacyDecryptedDir, 'message'), { recursive: true });
    fs.writeFileSync(path.join(legacyDecryptedDir, 'message', 'message_0.db'), Buffer.alloc(1024 * 1024));
    fs.writeFileSync(path.join(legacyDecryptedDir, 'info.json'), JSON.stringify({
      encrypted_fingerprint: getEncryptedStorageFingerprint(accountDir),
    }));

    const { response } = await runViewerWorkerAction(
      'ensure-account-runtime',
      { accountPath: accountDir, datasetDir }
    );

    assert.equal(response.ok, true);
    assert.ok(ticks > 0);
    assert.equal(response.result.decryptedDir, getAccountDataPaths(datasetDir).decryptedDir);
    assert.equal(fs.existsSync(path.join(datasetDir, 'dataset.db')), true);
  } finally {
    clearInterval(heartbeat);
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

test('viewer uses existing decrypted data until manual refresh', async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'wetrace-runtime-stale-'));
  const accountDir = path.join(temp, 'source-account');
  const encryptedDir = path.join(accountDir, 'db_storage');
  const datasetDir = path.join(temp, 'dataset');
  const paths = getAccountDataPaths(datasetDir);

  try {
    fs.mkdirSync(path.join(encryptedDir, 'message'), { recursive: true });
    fs.writeFileSync(path.join(encryptedDir, 'message', 'message_0.db'), 'new encrypted data');
    openOrCreateDataset({ rootDir: datasetDir, accountWxid: 'account_test' });
    fs.mkdirSync(path.join(paths.decryptedDir, 'message'), { recursive: true });
    fs.writeFileSync(path.join(paths.decryptedDir, 'message', 'message_0.db'), 'existing decrypted data');
    fs.writeFileSync(path.join(paths.decryptedDir, 'info.json'), JSON.stringify({
      encrypted_fingerprint: 'stale-fingerprint',
    }));

    const runtime = await runViewerWorkerAction(
      'ensure-account-runtime',
      { accountPath: accountDir, datasetDir }
    );
    const status = await runViewerWorkerAction(
      'get-data-status',
      { accountPath: accountDir, datasetDir }
    );
    const progressText = runtime.progress.map((event) => event.message).join('\n');

    assert.equal(runtime.response.ok, true);
    assert.match(progressText, /正在读取已有解密数据/);
    assert.doesNotMatch(progressText, /提取数据库密钥|解密数据库文件|解密中/);
    assert.equal(status.response.ok, true);
    assert.equal(status.response.result.needsSync, true);
    assert.equal(
      JSON.parse(fs.readFileSync(path.join(paths.decryptedDir, 'info.json'), 'utf8')).encrypted_fingerprint,
      'stale-fingerprint'
    );
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

test('current group refresh skips account scan when source data is unchanged', async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'wetrace-current-group-refresh-'));
  const accountDir = path.join(temp, 'source-account');
  const datasetDir = path.join(temp, 'dataset');
  const paths = getAccountDataPaths(datasetDir);
  const username = 'refresh-test@chatroom';

  try {
    openOrCreateDataset({ rootDir: datasetDir, accountWxid: 'account_test' });
    fs.mkdirSync(path.join(accountDir, 'db_storage', 'message'), { recursive: true });
    fs.writeFileSync(path.join(accountDir, 'db_storage', 'message', 'message_0.db'), 'encrypted');
    fs.mkdirSync(path.join(paths.decryptedDir, 'message'), { recursive: true });
    fs.writeFileSync(path.join(paths.decryptedDir, 'message', 'message_0.db'), 'decrypted');
    fs.writeFileSync(path.join(paths.decryptedDir, 'info.json'), JSON.stringify({
      encrypted_fingerprint: getEncryptedStorageFingerprint(accountDir),
    }));
    const sourceVersion = crypto
      .createHash('sha256')
      .update(getDecryptedStorageFingerprint(accountDir, paths.decryptedDir))
      .digest('hex');
    const store = await openGroupRecordStore(paths.groupRecordDbPath);
    store.storeGroup({
      username,
      displayName: 'Refresh Test',
      sourceVersion,
      replace: true,
      messages: [{
        id: 1,
        serverId: '101',
        type: 1,
        typeName: 'text',
        createTime: 100,
        senderWxid: 'alice',
        senderName: 'Alice',
        content: 'existing',
      }],
    });
    store.close();

    const { response, progress } = await runViewerWorkerAction('refresh-current-group', {
      accountPath: accountDir,
      datasetDir,
      username,
      displayName: 'Refresh Test',
      selfWxid: 'account_test',
    });

    assert.equal(response.ok, true);
    assert.equal(response.result.needsSync, false);
    assert.equal(response.result.group.addedMessages, 0);
    assert.equal(response.result.group.messageCount, 1);
    assert.ok(progress.some((event) => event.subphase === 'unchanged'));
    assert.ok(progress.some((event) => event.subphase === 'done'));
    assert.ok(progress.every((event) => event.phase === 'viewer-refresh'));
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

test('conversation scan history exposes and updates only the latest entry', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'wetrace-scan-history-'));
  const accountDir = path.join(temp, 'source-account');
  const cachePath = path.join(temp, 'conversation-cache.json');
  const conversations = [{ username: 'group@chatroom', displayName: 'Group' }];

  try {
    fs.mkdirSync(accountDir, { recursive: true });
    fs.writeFileSync(cachePath, JSON.stringify({
      [accountDir]: [
        { id: 'scan_new', scannedAt: '2026-01-02T00:00:00.000Z', conversations, totalMessages: 2 },
        { id: 'scan_old', scannedAt: '2026-01-01T00:00:00.000Z', conversations, totalMessages: 1 },
      ],
    }));

    assert.deepEqual(listConversationCaches(cachePath).map((item) => item.id), ['scan_new']);
    const updated = saveConversationCache(cachePath, accountDir, {
      conversationCount: 1,
      totalMessages: 3,
      conversations,
    });
    const stored = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
    assert.equal(updated.id, 'scan_new');
    assert.deepEqual(stored[accountDir].map((item) => item.id), ['scan_new', 'scan_old']);
    assert.equal(stored[accountDir][0].totalMessages, 3);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

test('passphrase cache is DPAPI protected and removes legacy plaintext', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wetrace-passphrase-cache-'));
  try {
    const legacyPath = path.join(root, '.wexin_passphrase');
    fs.writeFileSync(legacyPath, 'legacy-plaintext');
    saveCachedPassphrase(root, 'secret-passphrase');
    const protectedText = fs.readFileSync(getPassphraseCachePath(root), 'utf8');
    assert.match(protectedText, /^wetrace-dpapi-v1:/);
    assert.doesNotMatch(protectedText, /secret-passphrase/);
    assert.equal(loadCachedPassphrase(root), 'secret-passphrase');
    assert.equal(fs.existsSync(legacyPath), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('reset removes account secrets and dataset runtime without deleting dataset content', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wetrace-reset-'));
  const accountDir = path.join(root, 'account');
  const datasetDir = path.join(root, 'dataset');
  const runtimeDir = path.join(datasetDir, 'runtime');
  const bodyPath = path.join(datasetDir, 'conversations', 'group.json');
  try {
    fs.mkdirSync(path.join(accountDir, 'db_storage', 'message'), { recursive: true });
    fs.mkdirSync(path.join(runtimeDir, 'db_storage_decrypted'), { recursive: true });
    fs.mkdirSync(path.dirname(bodyPath), { recursive: true });
    fs.writeFileSync(path.join(accountDir, '.wexin_keys.json'), 'legacy-key');
    fs.writeFileSync(path.join(runtimeDir, '.wexin_keys.dpapi'), 'protected-key');
    fs.writeFileSync(path.join(runtimeDir, '.wexin_passphrase'), 'legacy-passphrase');
    fs.writeFileSync(bodyPath, '{}');

    resetAccountDecryptData(accountDir, { runtimeDir });
    assert.equal(fs.existsSync(path.join(accountDir, '.wexin_keys.json')), false);
    assert.equal(fs.existsSync(path.join(runtimeDir, '.wexin_keys.dpapi')), false);
    assert.equal(fs.existsSync(path.join(runtimeDir, '.wexin_passphrase')), false);

    fs.mkdirSync(runtimeDir, { recursive: true });
    fs.writeFileSync(path.join(runtimeDir, 'group-records.db'), 'messages');
    const result = resetAllToolTraces(path.join(root, 'user-data'), {
      additionalAccountPaths: [accountDir],
      datasetDirs: [datasetDir],
    });
    assert.equal(result.datasets[0].removed, true);
    assert.equal(fs.existsSync(runtimeDir), false);
    assert.equal(fs.existsSync(bodyPath), true);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('account generated data stays under the selected dataset root', async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'wetrace-account-root-'));
  const accountDir = path.join(temp, 'source-account');
  const datasetDir = path.join(temp, 'selected-dataset');
  const encryptedDir = path.join(accountDir, 'db_storage');
  const legacyDecryptedDir = path.join(accountDir, 'db_storage_decrypted');
  const paths = getAccountDataPaths(datasetDir);

  try {
    fs.mkdirSync(path.join(encryptedDir, 'message'), { recursive: true });
    fs.writeFileSync(path.join(encryptedDir, 'message', 'message_0.db'), 'encrypted');
    fs.mkdirSync(path.join(legacyDecryptedDir, 'message'), { recursive: true });
    fs.writeFileSync(path.join(legacyDecryptedDir, 'message', 'message_0.db'), 'decrypted');
    fs.writeFileSync(path.join(legacyDecryptedDir, 'info.json'), JSON.stringify({
      encrypted_fingerprint: getEncryptedStorageFingerprint(accountDir),
    }));
    fs.writeFileSync(path.join(accountDir, '.wexin_passphrase'), 'cached-passphrase');

    openOrCreateDataset({ rootDir: datasetDir, accountWxid: 'account_test' });
    const result = await ensureDecrypted({
      wxDir: accountDir,
      decryptedDir: paths.decryptedDir,
      passphraseCacheDir: paths.passphraseCacheDir,
    });

    assert.equal(result.skipped, true);
    assert.equal(result.decryptedDir, paths.decryptedDir);
    assert.equal(fs.existsSync(path.join(paths.decryptedDir, 'message', 'message_0.db')), true);
    assert.equal(fs.existsSync(path.join(accountDir, '.wexin_passphrase')), false);
    assert.equal(fs.existsSync(path.join(paths.runtime, '.wexin_passphrase')), false);
    assert.equal(fs.existsSync(getPassphraseCachePath(paths.runtime)), false);
    assert.equal(fs.existsSync(path.join(legacyDecryptedDir, 'message', 'message_0.db')), true);
    assert.equal(path.dirname(paths.groupRecordDbPath), paths.runtime);
    assert.equal(paths.databaseKeysPath, path.join(paths.runtime, '.wexin_keys.dpapi'));
    assert.equal(paths.imageKeyCacheDir, paths.runtime);
    assert.equal(paths.voiceCacheDir, paths.runtime);

    const groupStore = await openGroupRecordStore(paths.groupRecordDbPath);
    groupStore.close();
    assert.equal(fs.existsSync(paths.groupRecordDbPath), true);

    const firstCache = saveConversationCache(paths.conversationCachePath, accountDir, {
      conversationCount: 1,
      totalMessages: 2,
      selfWxid: 'account_test',
      conversations: [{ username: 'group@chatroom', displayName: 'Group' }],
    });
    const secondCache = saveConversationCache(paths.conversationCachePath, accountDir, {
      conversationCount: 1,
      totalMessages: 3,
      selfWxid: 'account_test',
      conversations: [{ username: 'group@chatroom', displayName: 'Group' }],
    });
    const cache = getConversationCache(paths.conversationCachePath, accountDir);
    assert.equal(listConversationCaches(paths.conversationCachePath).length, 1);
    assert.equal(secondCache.id, firstCache.id);
    assert.equal(cache.conversationCount, 1);
    assert.equal(cache.totalMessages, 3);
    assert.equal(fs.existsSync(path.join(paths.runtime, 'conversation-cache.json')), false);
    assert.equal(fs.existsSync(path.join(datasetDir, 'dataset.db')), true);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});
