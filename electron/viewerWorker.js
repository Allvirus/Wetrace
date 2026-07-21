const { parentPort, workerData } = require('worker_threads');

async function run() {
  const {
    exportFilteredImages,
    resolveConversationImages,
  } = require('../lib/exportCore');
  const {
    listCachedGroupMembers,
    loadCachedConversationMessages,
  } = require('../lib/groupRecordService');
  const { action, payload } = workerData;

  if (action === 'get-data-status') {
    const { resolveWxDir } = require('../lib/exportCore');
    const { getAccountDataPaths } = require('../lib/accountDataPaths');
    const { getEncryptedStorageFingerprint, needsDecrypt } = require('../lib/decryptCore');
    const { getGroupImageCacheFingerprint } = require('../lib/imageMedia');
    const wxDir = resolveWxDir(payload?.accountPath || payload?.wxDir);
    const accountPaths = getAccountDataPaths(payload?.datasetDir);
    return {
      fingerprint: getEncryptedStorageFingerprint(wxDir),
      mediaFingerprint: payload?.username
        ? getGroupImageCacheFingerprint(wxDir, payload.username)
        : null,
      needsSync: needsDecrypt(wxDir, false, accountPaths.decryptedDir),
    };
  }

  if (action === 'ensure-account-runtime') {
    const { resolveWxDir } = require('../lib/exportCore');
    const { getAccountDataPaths } = require('../lib/accountDataPaths');
    const { openOrCreateDataset } = require('../lib/jewelryDataset');
    const { ensureDecrypted, hasDecryptedStorage } = require('../lib/decryptCore');
    const accountPaths = getAccountDataPaths(payload?.datasetDir);
    const wxDir = resolveWxDir(payload?.accountPath || payload?.wxDir);
    openOrCreateDataset({ rootDir: accountPaths.root });
    if (hasDecryptedStorage(wxDir, accountPaths.decryptedDir)) {
      parentPort.postMessage({
        type: 'progress',
        event: {
          phase: 'dataset-sync',
          subphase: 'runtime',
          scope: 'viewer',
          username: payload?.username || null,
          datasetDir: accountPaths.root,
          message: '正在读取已有解密数据',
        },
      });
      return accountPaths;
    }
    await ensureDecrypted({
      wxDir,
      decryptedDir: accountPaths.decryptedDir,
      passphraseCacheDir: accountPaths.passphraseCacheDir,
      loginCapture: false,
      keysPath: payload?.keysPath || null,
      onProgress: (event) => parentPort.postMessage({
        type: 'progress',
        event: {
          phase: 'dataset-sync',
          subphase: 'runtime',
          scope: 'viewer',
          username: payload?.username || null,
          datasetDir: accountPaths.root,
          message: event.message,
        },
      }),
    });
    return accountPaths;
  }

  if (action === 'sync-jewelry-dataset') {
    const { syncJewelryDataset } = require('../lib/jewelryDataset');
    return syncJewelryDataset(payload, (event) => {
      parentPort.postMessage({ type: 'progress', event: { ...event, datasetDir: payload.datasetDir } });
    });
  }

  if (action === 'list-jewelry-images') {
    const { listDatasetImages } = require('../lib/jewelryDataset');
    const { listClassificationRuns } = require('../lib/codexJewelryClassifier');
    return {
      ...listDatasetImages(payload),
      runs: listClassificationRuns(payload.datasetDir),
    };
  }

  if (action === 'list-group-members') {
    return listCachedGroupMembers(payload);
  }
  if (action === 'load-conversation-messages') {
    return loadCachedConversationMessages(payload);
  }
  if (action === 'resolve-conversation-images') {
    return resolveConversationImages({
      ...payload,
      onProgress: (event) => {
        parentPort.postMessage({ type: 'progress', event });
      },
    });
  }
  if (action === 'export-filtered-images') {
    return exportFilteredImages(payload);
  }
  throw new Error(`未知的记录浏览操作: ${action}`);
}

run()
  .then((result) => parentPort.postMessage({ ok: true, result }))
  .catch((err) => parentPort.postMessage({ ok: false, error: err.message }));
