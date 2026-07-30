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

  if (action === 'refresh-current-group') {
    const { resolveWxDir } = require('../lib/exportCore');
    const { getAccountDataPaths } = require('../lib/accountDataPaths');
    const { openOrCreateDataset } = require('../lib/jewelryDataset');
    const {
      ensureDecrypted,
      getEncryptedStorageFingerprint,
      needsDecrypt,
    } = require('../lib/decryptCore');
    const { getGroupImageCacheFingerprint } = require('../lib/imageMedia');
    const { refreshCachedGroupRecords } = require('../lib/groupRecordService');
    const wxDir = resolveWxDir(payload?.accountPath || payload?.wxDir);
    const accountPaths = getAccountDataPaths(payload?.datasetDir);
    const progress = (subphase, message, state = 'syncing') => parentPort.postMessage({
      type: 'progress',
      event: {
        phase: 'viewer-refresh',
        subphase,
        state,
        scope: 'viewer',
        username: payload?.username || null,
        datasetDir: accountPaths.root,
        message,
      },
    });

    openOrCreateDataset({ rootDir: accountPaths.root });
    progress('check', '正在检查当前群的新记录');
    const sourceNeedsSync = needsDecrypt(wxDir, false, accountPaths.decryptedDir);
    let decryptResult = { skipped: true };
    if (sourceNeedsSync) {
      progress('decrypt', '检测到数据库变化，正在增量读取变化文件');
      decryptResult = await ensureDecrypted({
        wxDir,
        decryptedDir: accountPaths.decryptedDir,
        passphraseCacheDir: accountPaths.passphraseCacheDir,
        keyCachePath: accountPaths.databaseKeysPath,
        loginCapture: false,
        onProgress: (event) => {
          const message = event.phase === 'keys'
            ? '正在读取或派生变化数据库的密钥'
            : event.current && event.total
              ? `正在增量更新数据库 ${event.current}/${event.total}`
              : '正在增量更新变化的数据库文件';
          progress(event.phase === 'keys' ? 'keys' : 'decrypt', message);
        },
      });
    } else {
      progress('unchanged', '数据库没有变化，跳过解密');
    }

    progress('group', '正在追加当前群的新消息');
    const group = await refreshCachedGroupRecords({
      ...payload,
      wxDir,
      decryptedDir: accountPaths.decryptedDir,
    });
    const needsSync = needsDecrypt(wxDir, false, accountPaths.decryptedDir);
    const warning = decryptResult.usedFallback
      ? '新记录暂未读取，继续使用已有群聊数据'
      : null;
    progress(
      'done',
      warning || (group.addedMessages > 0
        ? `当前群新增 ${group.addedMessages} 条消息`
        : '当前群没有发现新消息'),
      warning ? 'warning' : 'ready'
    );
    return {
      recordsChanged: sourceNeedsSync && !needsSync,
      needsSync,
      warning: decryptResult.warning || warning,
      fingerprint: getEncryptedStorageFingerprint(wxDir),
      mediaFingerprint: getGroupImageCacheFingerprint(wxDir, payload.username),
      decrypt: {
        passed: Number(decryptResult.passed) || 0,
        reused: Number(decryptResult.reused) || 0,
        failed: Number(decryptResult.failed) || 0,
      },
      group,
    };
  }

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

  if (action === 'list-note-hydration-tasks') {
    const { listNoteHydrationTasks } = require('../lib/noteHydration');
    return listNoteHydrationTasks(payload);
  }
  if (action === 'update-note-hydration-task') {
    const { updateNoteHydrationTaskState } = require('../lib/noteHydration');
    return updateNoteHydrationTaskState(payload);
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
