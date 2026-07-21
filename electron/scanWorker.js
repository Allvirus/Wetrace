const { parentPort, workerData } = require('worker_threads');

let cancelled = false;

parentPort.on('message', (msg) => {
  if (msg?.type === 'cancel') {
    cancelled = true;
  }
});

function postProgress(event) {
  parentPort.postMessage({ type: 'progress', event });
}

async function scanConversations(options) {
  const { resolveWxDir, listConversations } = require('../lib/exportCore');
  const { needsDecrypt, ensureDecrypted, hasDecryptedStorage } = require('../lib/decryptCore');
  const wxDir = resolveWxDir(options.wxDir, { accountPath: options.accountPath });
  const forceDecrypt = Boolean(options.forceDecrypt);

  const listOnce = async () =>
    listConversations({
      wxDir,
      selfWxid: options.selfWxid || null,
      decryptedDir: options.decryptedDir || null,
      skipDecrypt: true,
      incrementalBase: options.incrementalBase || null,
      forceFullScan: forceDecrypt,
      onProgress: (event) => {
        if (cancelled) return;
        postProgress(event);
      },
    });

  const decryptOptions = {
    wxDir,
    forceDecrypt,
    loginCapture: options.loginCapture !== false,
    keysPath: options.keysPath || null,
    decryptedDir: options.decryptedDir || null,
    passphraseCacheDir: options.passphraseCacheDir || null,
    onProgress: (event) => {
      if (cancelled) return;
      postProgress(event);
    },
  };

  const requiresDecrypt = needsDecrypt(wxDir, forceDecrypt, options.decryptedDir || null);
  if (requiresDecrypt) {
    if (hasDecryptedStorage(wxDir, options.decryptedDir || null)) {
      postProgress({ phase: 'scan', message: '检测到不信数据有更新，正在同步…' });
    } else {
      postProgress({ phase: 'scan', message: '首次扫描需要解密，可能需要几分钟…' });
    }

    await ensureDecrypted(decryptOptions);
    if (cancelled) throw new Error('扫描已取消');
  }

  postProgress({ phase: 'scan', message: '正在读取会话列表…' });

  if (!requiresDecrypt) {
    await ensureDecrypted(decryptOptions);
    if (cancelled) throw new Error('scan cancelled');
  }

  try {
    return await listOnce();
  } catch (firstErr) {
    if (cancelled) throw new Error('\u626b\u63cf\u5df2\u53d6\u6d88');
    postProgress({
      phase: 'scan',
      message: '\u8bfb\u53d6\u5931\u8d25\uff0c\u5df2\u505c\u6b62\u81ea\u52a8\u5168\u91cf\u91cd\u89e3\u5bc6',
    });
    throw firstErr;
  }
}

async function run() {
  const { options } = workerData;
  const result = await scanConversations(options);
  return result;
}

run()
  .then((result) => {
    if (cancelled) {
      parentPort.postMessage({ type: 'done', ok: false, error: '扫描已取消', cancelled: true });
      return;
    }
    parentPort.postMessage({ type: 'done', ok: true, ...result });
  })
  .catch((err) => {
    parentPort.postMessage({
      type: 'done',
      ok: false,
      error: err.message,
      cancelled: cancelled || err.message === '扫描已取消',
    });
  });
