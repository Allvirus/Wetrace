const { app, BrowserWindow, dialog, ipcMain, shell, nativeImage } = require('electron');
const fs = require('fs');
const path = require('path');
const { Worker } = require('worker_threads');
const { resolveWxDir, getWxDirStatus } = require('../lib/exportCore');
const { detectWeChatDataPaths } = require('../lib/wxPathDetect');
const {
  getConversationCache,
  getLatestConversationCache,
  isCacheCurrent,
  saveConversationCache,
  clearConversationCache,
  listConversationCaches,
  updateCacheDisplayName,
} = require('../lib/conversationCache');
const { createScanSession, getLogDir, maskPath } = require('../lib/sessionLog');
const { classifyScanError, buildFeedbackSummary } = require('../lib/errorCatalog');
const { runPreflightChecks } = require('../lib/preflightCheck');
const { createJewelryTaskCoordinator } = require('../lib/jewelryTaskCoordinator');
const { getAccountDataPaths } = require('../lib/accountDataPaths');

let mainWindow = null;
let exportRunning = false;
let scanRunning = false;
let scanCancelRequested = false;
let exportCancelRequested = false;
let currentWorker = null;
let scanWorker = null;

function getSettingsPath() {
  return path.join(app.getPath('userData'), 'wetrace-settings.json');
}

function getConversationCachePath(datasetDir = null) {
  return datasetDir
    ? getAccountDataPaths(datasetDir).conversationCachePath
    : path.join(app.getPath('userData'), 'conversation-cache.json');
}

function getDiagnosticsLogDir() {
  return getLogDir(app.getPath('userData'));
}

function getViewerCacheDir() {
  return path.join(app.getPath('userData'), 'viewer-cache');
}

function clearViewerCache() {
  fs.rmSync(getViewerCacheDir(), { recursive: true, force: true });
}

function buildScanSessionMeta(options = {}) {
  const pkg = require('../package.json');
  const { isDllHookAvailable } = require('../lib/wxKeyHook');
  return {
    app_version: app.getVersion() || pkg.version,
    platform: process.platform,
    arch: process.arch,
    electron: process.versions.electron,
    hook_dll: isDllHookAvailable() ? 'ok' : 'missing',
    wx_dir: maskPath(options.wxDir || ''),
    account_path: maskPath(options.accountPath || ''),
    force_decrypt: options.forceDecrypt ? 'true' : 'false',
    login_capture: options.loginCapture !== false ? 'true' : 'false',
  };
}

function resolveAppIconPath() {
  const candidates = ['icon.ico', 'icon.png', 'logo.svg'];
  for (const name of candidates) {
    const candidate = path.join(__dirname, '..', 'build', name);
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

function createWindow() {
  const iconPath = resolveAppIconPath();
  const icon = iconPath ? nativeImage.createFromPath(iconPath) : undefined;

  mainWindow = new BrowserWindow({
    width: 920,
    height: 820,
    minWidth: 720,
    minHeight: 680,
    title: '微迹 Wetrace',
    icon: icon && !icon.isEmpty() ? icon : iconPath,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

function sendProgress(payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('export-progress', payload);
  }
}

function runScanWorker(options, scanSession = null) {
  return new Promise((resolve, reject) => {
    if (scanWorker) {
      scanWorker.terminate().catch(() => {});
      scanWorker = null;
    }

    scanCancelRequested = false;
    let settled = false;
    const worker = new Worker(path.join(__dirname, 'scanWorker.js'), {
      workerData: { options },
    });
    scanWorker = worker;

    const finish = (handler, value) => {
      if (settled) return;
      settled = true;
      if (scanWorker === worker) {
        scanWorker = null;
      }
      worker.terminate().catch(() => {});
      handler(value);
    };

    worker.on('message', (msg) => {
      if (msg.type === 'progress') {
        scanSession?.append('progress', {
          phase: msg.event?.phase || '',
          subphase: msg.event?.subphase || '',
          current: msg.event?.current || '',
          total: msg.event?.total || '',
          message: msg.event?.message || '',
        });
        sendProgress(msg.event);
      } else if (msg.type === 'done') {
        finish(resolve, msg);
      }
    });

    worker.on('error', (err) => {
      scanSession?.append('worker_error', { message: err.message, stack: err.stack || '' });
      finish(reject, err);
    });

    worker.on('exit', (code) => {
      if (settled) return;
      if (scanCancelRequested) {
        finish(resolve, { ok: false, cancelled: true, error: '扫描已取消' });
        return;
      }
      if (code !== 0) {
        const err = new Error(`扫描任务异常退出 (code ${code})`);
        scanSession?.append('worker_exit', { code: String(code), message: err.message });
        finish(reject, err);
      }
    });
  });
}

let profileWorkerChain = Promise.resolve();

function runProfileWorkerOnce(accounts) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const worker = new Worker(path.join(__dirname, 'profileWorker.js'), {
      workerData: { accounts: accounts || [] },
    });

    const finish = (handler, value) => {
      if (settled) return;
      settled = true;
      worker.terminate().catch(() => {});
      handler(value);
    };

    worker.on('message', (msg) => {
      if (msg.type === 'done') {
        finish(resolve, msg);
      }
    });

    worker.on('error', (err) => {
      finish(reject, err);
    });

    worker.on('exit', (code) => {
      if (!settled && code !== 0) {
        finish(reject, new Error(`资料加载任务异常退出 (code ${code})`));
      }
    });
  });
}

function runProfileWorker(accounts) {
  const job = profileWorkerChain.then(() => runProfileWorkerOnce(accounts));
  profileWorkerChain = job.catch(() => {});
  return job;
}

let viewerWorkerChain = Promise.resolve();
let viewerImageWorkerChain = Promise.resolve();
let accountRuntimeChain = Promise.resolve();
const accountRuntimeJobs = new Map();
const jewelryTasks = createJewelryTaskCoordinator();

function sendJewelryProgress(payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('jewelry-progress', payload);
  }
}

function runViewerWorkerOnce(action, payload) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const worker = new Worker(path.join(__dirname, 'viewerWorker.js'), {
      workerData: { action, payload },
    });

    const finish = (handler, value) => {
      if (settled) return;
      settled = true;
      worker.terminate().catch(() => {});
      handler(value);
    };

    worker.on('message', (msg) => {
      if (msg?.type === 'progress') {
        sendJewelryProgress(msg.event);
        return;
      }
      finish(resolve, msg);
    });
    worker.on('error', (err) => finish(reject, err));
    worker.on('exit', (code) => {
      if (!settled && code !== 0) {
        finish(reject, new Error(`记录浏览任务异常退出 (code ${code})`));
      }
    });
  });
}

function runViewerWorker(action, payload) {
  const job = viewerWorkerChain.then(() => runViewerWorkerOnce(action, payload));
  viewerWorkerChain = job.catch(() => {});
  return job;
}

function runViewerImageWorker(action, payload) {
  const job = viewerImageWorkerChain.then(() => runViewerWorkerOnce(action, payload));
  viewerImageWorkerChain = job.catch(() => {});
  return job;
}

function ensureAccountRuntime(payload) {
  const runtimeKey = payload?.datasetDir ? path.resolve(payload.datasetDir).toLowerCase() : '';
  const activeJob = accountRuntimeJobs.get(runtimeKey);
  if (activeJob) return activeJob;

  const job = accountRuntimeChain.then(async () => {
    const response = await runViewerWorker('ensure-account-runtime', payload || {});
    if (!response?.ok) throw new Error(response?.error || '账号运行时准备失败');
    return response.result;
  });
  accountRuntimeChain = job.catch(() => {});
  accountRuntimeJobs.set(runtimeKey, job);
  job.finally(() => {
    if (accountRuntimeJobs.get(runtimeKey) === job) accountRuntimeJobs.delete(runtimeKey);
  }).catch(() => {});
  return job;
}

function queueJewelryClassification({ datasetDir, imageIds, eligibleStates = null }) {
  return jewelryTasks.queueClassification({
    datasetDir,
    imageIds,
    task: async (queuedImageIds) => {
      const { runJewelryClassification } = require('../lib/codexJewelryClassifier');
      return runJewelryClassification({
        datasetDir,
        imageIds: queuedImageIds,
        eligibleStates,
        onProgress: sendJewelryProgress,
      });
    },
  }).catch((err) => {
    sendJewelryProgress({ phase: 'classification-failed', error: err.message });
    throw err;
  });
}

ipcMain.handle('load-settings', async () => {
  const settingsPath = getSettingsPath();
  try {
    if (fs.existsSync(settingsPath)) {
      return JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    }
  } catch {
    // ignore broken settings file
  }
  return {};
});

ipcMain.handle('save-settings', async (_event, settings) => {
  const settingsPath = getSettingsPath();
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  fs.writeFileSync(settingsPath, JSON.stringify(settings || {}, null, 2), 'utf8');
  return { ok: true };
});

ipcMain.handle('get-app-info', async () => {
  const pkg = require('../package.json');
  const { isWhisperModelBundled, isVoiceTranscriptionAvailable } = require('../lib/voiceTranscription');
  const { getPerfProfile } = require('../lib/exportEstimate');
  const whisperModelBundled = isWhisperModelBundled();
  return {
    name: app.getName() || pkg.build?.productName || '微迹 Wetrace',
    version: app.getVersion() || pkg.version,
    description: '珍藏每一段对话',
    whisperModelBundled,
    voiceTranscriptionAvailable: isVoiceTranscriptionAvailable(),
    perfProfile: getPerfProfile(),
  };
});

ipcMain.handle('get-data-status', async (_event, payload) => {
  try {
    const response = await runViewerWorkerOnce('get-data-status', payload || {});
    if (!response?.ok) return { ok: false, error: response?.error || '无法检查数据' };
    return { ok: true, ...response.result };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('build-pinyin-search-index', async (_event, payload) => {
  try {
    const { buildPinyinSearchIndex } = require('../lib/pinyinSearch');
    const items = Array.isArray(payload?.items) ? payload.items.slice(0, 5000) : [];
    return { ok: true, items: buildPinyinSearchIndex(items) };
  } catch (err) {
    return { ok: false, error: err.message, items: [] };
  }
});

ipcMain.handle('list-group-members', async (_event, payload) => {
  try {
    const accountPaths = await ensureAccountRuntime(payload);
    return await runViewerWorker('list-group-members', {
      ...(payload || {}),
      decryptedDir: accountPaths.decryptedDir,
    });
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('load-conversation-messages', async (_event, payload) => {
  try {
    const accountPaths = await ensureAccountRuntime(payload);
    return await runViewerWorker('load-conversation-messages', {
      ...(payload || {}),
      decryptedDir: accountPaths.decryptedDir,
    });
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('resolve-conversation-images', async (_event, payload) => {
  try {
    const accountPaths = await ensureAccountRuntime(payload);
    let imageOutputDir = accountPaths.root;
    let chatFileBase = payload?.chatFileBase || null;
    const imageLayout = 'dataset';
    const { openOrCreateDataset } = require('../lib/jewelryDataset');
    const { manifest } = openOrCreateDataset({ rootDir: accountPaths.root });
    const conversation = (manifest.conversations || []).find((item) => item.username === payload.username);
    if (!conversation) throw new Error('当前群聊尚未写入 SQLite 数据集');
    chatFileBase = conversation.conversationId;
    return await runViewerImageWorker('resolve-conversation-images', {
      ...(payload || {}),
      imageOutputDir,
      chatFileBase,
      imageLayout,
      decryptedDir: accountPaths.decryptedDir,
      imageKeyCacheDir: accountPaths.imageKeyCacheDir,
      useLegacyExportParser: true,
    });
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('export-filtered-images', async (_event, payload) => {
  try {
    const accountPaths = await ensureAccountRuntime(payload);
    return await runViewerWorker('export-filtered-images', {
      ...(payload || {}),
      decryptedDir: accountPaths.decryptedDir,
      imageKeyCacheDir: accountPaths.imageKeyCacheDir,
    });
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('get-jewelry-taxonomy', async () => {
  const { PRODUCT_CATEGORIES, JEWELRY_PROCESSES } = require('../lib/jewelryTaxonomy');
  return { ok: true, productCategories: PRODUCT_CATEGORIES, processes: JEWELRY_PROCESSES };
});

ipcMain.handle('sync-jewelry-dataset', async (_event, payload) => {
  try {
    const accountPaths = await ensureAccountRuntime(payload);
    const result = await jewelryTasks.queueSync(payload?.datasetDir, () =>
      runViewerWorker('sync-jewelry-dataset', {
        ...(payload || {}),
          decryptedDir: accountPaths.decryptedDir,
        imageKeyCacheDir: accountPaths.imageKeyCacheDir,
      })
    );
    return result;
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('list-jewelry-images', async (_event, payload) => {
  try {
    const response = await jewelryTasks.queueRead(payload?.datasetDir, () =>
      runViewerWorker('list-jewelry-images', payload || {})
    );
    if (response.ok) {
      const { validateDatasetImageAccess } = require('../lib/jewelryDataset');
      response.result.items = (response.result.items || []).map((item) =>
        validateDatasetImageAccess(payload.datasetDir, item)
      );
    }
    return response;
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('save-jewelry-classification', async (_event, payload) => {
  try {
    await jewelryTasks.getSyncChain(payload?.datasetDir);
    const { saveManualClassification } = require('../lib/jewelryDataset');
    return { ok: true, result: saveManualClassification(payload || {}) };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('batch-save-jewelry-processes', async (_event, payload) => {
  try {
    await jewelryTasks.getSyncChain(payload?.datasetDir);
    const { batchSaveProcesses } = require('../lib/jewelryDataset');
    return { ok: true, result: batchSaveProcesses(payload || {}) };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('retry-jewelry-classification', async (_event, payload) => {
  try {
    if (!payload?.datasetDir || !Array.isArray(payload.imageIds) || !payload.imageIds.length) {
      throw new Error('请选择要重试的图片');
    }
    queueJewelryClassification({ datasetDir: payload.datasetDir, imageIds: payload.imageIds }).catch(() => {});
    return { ok: true, result: { queued: payload.imageIds.length } };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('cancel-jewelry-classification', async () => {
  const { cancelJewelryClassification } = require('../lib/codexJewelryClassifier');
  return { ok: true, result: cancelJewelryClassification() };
});

ipcMain.handle('estimate-export', async (_event, params) => {
  const { estimateExportDuration, getPerfProfile } = require('../lib/exportEstimate');
  const settingsPath = getSettingsPath();
  let learned = null;
  try {
    if (fs.existsSync(settingsPath)) {
      learned = JSON.parse(fs.readFileSync(settingsPath, 'utf8')).exportPerf || null;
    }
  } catch {
    // ignore broken settings
  }
  return estimateExportDuration({
    perfProfile: getPerfProfile(),
    ...(params || {}),
    learned,
  });
});

ipcMain.handle('count-conversation-range', async (_event, options) => {
  try {
    const { countConversationMessagesInRange } = require('../lib/exportCore');
    const accountPaths = await ensureAccountRuntime(options);
    const result = await countConversationMessagesInRange({
      ...(options || {}),
      decryptedDir: accountPaths.decryptedDir,
    });
    return { ok: true, ...result };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('get-conversation-time-bounds', async (_event, options) => {
  try {
    const { getConversationTimeBounds } = require('../lib/exportCore');
    const accountPaths = await ensureAccountRuntime(options);
    const result = await getConversationTimeBounds({
      ...(options || {}),
      decryptedDir: accountPaths.decryptedDir,
    });
    return { ok: true, ...result };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('record-export-perf', async (_event, sample) => {
  const { recordExportSample } = require('../lib/exportEstimate');
  const settingsPath = getSettingsPath();
  let settings = {};
  try {
    if (fs.existsSync(settingsPath)) {
      settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    }
  } catch {
    // ignore broken settings
  }
  settings.exportPerf = recordExportSample(settings.exportPerf, sample || {});
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
  return { ok: true, exportPerf: settings.exportPerf };
});

ipcMain.handle('detect-wx-paths', async () => {
  try {
    return { ok: true, paths: detectWeChatDataPaths() };
  } catch (err) {
    return { ok: false, error: err.message, paths: [] };
  }
});

ipcMain.handle('pick-file', async (_event, { title, filters, defaultPath }) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title,
    defaultPath,
    properties: ['openFile'],
    filters: filters || [{ name: 'JSON', extensions: ['json'] }],
  });
  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  return result.filePaths[0];
});

ipcMain.handle('pick-directory', async (_event, { title, defaultPath }) => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return null;
  }
  const result = await dialog.showOpenDialog(mainWindow, {
    title,
    defaultPath,
    properties: ['openDirectory', 'createDirectory'],
  });
  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  return result.filePaths[0];
});

ipcMain.handle('is-directory-empty', async (_event, dirPath) => {
  try {
    if (!dirPath || !fs.existsSync(dirPath)) {
      return { ok: true, empty: true };
    }
    const stat = fs.statSync(dirPath);
    if (!stat.isDirectory()) {
      return { ok: false, error: '路径不是文件夹' };
    }
    const entries = fs.readdirSync(dirPath);
    return { ok: true, empty: entries.length === 0, count: entries.length };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('validate-wx-dir', async (_event, payload) => {
  const wxDir = typeof payload === 'string' ? payload : payload?.wxDir;
  const accountPath = typeof payload === 'object' ? payload?.accountPath : null;
  try {
    const status = getWxDirStatus(wxDir, { accountPath });
    if (status.needsAccountSelection) {
      return { ok: true, ...status, readiness: null };
    }
    return { ok: true, ...status, readiness: null };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('enrich-accounts', async (_event, { accounts }) => {
  try {
    const msg = await runProfileWorker(accounts || []);
    if (msg.ok) {
      return { ok: true, accounts: msg.accounts || [] };
    }
    return { ok: false, error: msg.error, accounts: accounts || [] };
  } catch (err) {
    return { ok: false, error: err.message, accounts: accounts || [] };
  }
});

ipcMain.handle('check-wechat-status', async (_event, payload) => {
  const wxDir = typeof payload === 'string' ? payload : payload?.wxDir;
  const accountPath = typeof payload === 'object' ? payload?.accountPath : null;
  try {
    const { checkWeChatReadiness } = require('../lib/wechatStatus');
    const { scanWeChatAccounts } = require('../lib/exportCore');
    let resolved = accountPath || null;
    if (!resolved && wxDir) {
      const scan = scanWeChatAccounts(wxDir);
      resolved = scan.selectedPath;
    }
    if (!resolved && wxDir) {
      resolved = resolveWxDir(wxDir, { accountPath });
    }
    const readiness = checkWeChatReadiness(resolved || wxDir);
    return { ok: true, readiness, resolved };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('load-conversation-cache', async (_event, { accountPath, scanId, datasetDir }) => {
  try {
    const cache =
      getConversationCache(getConversationCachePath(datasetDir), accountPath, scanId || null) ||
      getConversationCache(getConversationCachePath(), accountPath, scanId || null);
    if (!cache) {
      return { ok: true, cache: null };
    }
    return { ok: true, cache };
  } catch (err) {
    return { ok: false, error: err.message, cache: null };
  }
});

ipcMain.handle('clear-conversation-cache', async (_event, { accountPath, scanId, datasetDir }) => {
  try {
    clearConversationCache(getConversationCachePath(datasetDir), accountPath, scanId || null);
    clearConversationCache(getConversationCachePath(), accountPath, scanId || null);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('patch-conversation-cache-label', async (_event, { accountPath, displayName, datasetDir }) => {
  try {
    if (!datasetDir) return { ok: false };
    const updated = updateCacheDisplayName(getConversationCachePath(datasetDir), accountPath, displayName);
    return { ok: updated };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('list-conversation-caches', async (_event, payload) => {
  try {
    const datasetDirs = [...new Set((payload?.datasetDirs || []).filter(Boolean))];
    const datasetCaches = datasetDirs.flatMap((datasetDir) =>
      listConversationCaches(getConversationCachePath(datasetDir))
    );
    const legacyCaches = listConversationCaches(getConversationCachePath());
    datasetCaches.sort((a, b) => new Date(b.scannedAt || 0) - new Date(a.scannedAt || 0));
    legacyCaches.sort((a, b) => new Date(b.scannedAt || 0) - new Date(a.scannedAt || 0));
    const caches = [];
    const seenAccounts = new Set();
    for (const item of [...datasetCaches, ...legacyCaches]) {
      const key = path.resolve(item.accountPath).toLowerCase();
      if (seenAccounts.has(key)) continue;
      seenAccounts.add(key);
      caches.push(item);
    }
    caches.sort((a, b) => new Date(b.scannedAt || 0) - new Date(a.scannedAt || 0));
    return { ok: true, caches };
  } catch (err) {
    return { ok: false, error: err.message, caches: [] };
  }
});

ipcMain.handle('get-scan-requirements', async (_event, payload) => {
  try {
    const { needsDecrypt, hasDecryptedStorage } = require('../lib/decryptCore');
    const accountPath = payload?.accountPath;
    if (!accountPath) {
      return { ok: false, error: '未选择账号' };
    }
    const forceDecrypt = Boolean(payload?.forceDecrypt);
    const accountPaths = getAccountDataPaths(payload?.datasetDir);
    const hasTargetDecrypted = hasDecryptedStorage(accountPath, accountPaths.decryptedDir);
    const canMigrateLegacy =
      !forceDecrypt &&
      !hasTargetDecrypted &&
      hasDecryptedStorage(accountPath) &&
      !needsDecrypt(accountPath, false);
    const targetNeedsDecrypt = needsDecrypt(accountPath, forceDecrypt, accountPaths.decryptedDir);
    return {
      ok: true,
      accountPath,
      needsDecrypt: targetNeedsDecrypt && !canMigrateLegacy,
      hasDecrypted: hasTargetDecrypted || canMigrateLegacy,
    };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('run-preflight', async (_event, payload) => {
  try {
    const result = runPreflightChecks({
      wxDir: payload?.wxDir,
      accountPath: payload?.accountPath || null,
      readiness: payload?.readiness || null,
    });
    return { ok: true, ...result };
  } catch (err) {
    return { ok: false, error: err.message, checks: [] };
  }
});

ipcMain.handle('get-log-dir', async () => {
  const logDir = getDiagnosticsLogDir();
  fs.mkdirSync(logDir, { recursive: true });
  return { ok: true, logDir };
});

ipcMain.handle('open-log-dir', async () => {
  const logDir = getDiagnosticsLogDir();
  fs.mkdirSync(logDir, { recursive: true });
  await shell.openPath(logDir);
  return { ok: true, logDir };
});

ipcMain.handle('open-user-data-dir', async () => {
  const userDataPath = app.getPath('userData');
  fs.mkdirSync(userDataPath, { recursive: true });
  await shell.openPath(userDataPath);
  return { ok: true, userDataPath };
});

ipcMain.handle('reset-account-decrypt-data', async (_event, payload) => {
  if (scanRunning || exportRunning) {
    return { ok: false, error: '扫描或导出进行中，请稍后再试' };
  }
  try {
    const accountPath = payload?.accountPath;
    if (!accountPath) {
      return { ok: false, error: '未选择账号' };
    }
    const accountPaths = getAccountDataPaths(payload?.datasetDir);
    const { resetAccountDecryptData } = require('../lib/dataReset');
    const result = resetAccountDecryptData(accountPath, { runtimeDir: accountPaths.runtime });
    clearConversationCache(accountPaths.conversationCachePath, result.accountPath);
    return { ok: true, ...result };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('reset-all-tool-traces', async (_event, payload) => {
  if (scanRunning || exportRunning) {
    return { ok: false, error: '扫描或导出进行中，请稍后再试' };
  }
  try {
    const { resetAllToolTraces } = require('../lib/dataReset');
    const userDataPath = app.getPath('userData');
    const additionalAccountPaths = Array.isArray(payload?.additionalAccountPaths)
      ? payload.additionalAccountPaths
      : [];
    const result = resetAllToolTraces(userDataPath, {
      conversationCachePath: getConversationCachePath(),
      settingsPath: getSettingsPath(),
      additionalAccountPaths,
    });
    return { ok: true, ...result };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('scan-conversations', async (_event, options) => {
  if (scanRunning) {
    return { ok: false, error: '扫描正在进行中' };
  }

  let accountPaths;
  try {
    accountPaths = getAccountDataPaths(options?.datasetDir);
    const { openOrCreateDataset } = require('../lib/jewelryDataset');
    openOrCreateDataset({
      rootDir: accountPaths.root,
      accountWxid: options?.accountWxid || null,
      accountName: options?.displayName || null,
    });
  } catch (err) {
    return { ok: false, error: err.message };
  }

  scanRunning = true;
  const scanSession = createScanSession(app.getPath('userData'), buildScanSessionMeta(options));
  scanSession.append('scan_start', { message: '开始扫描会话' });

  const { needsDecrypt, hasDecryptedStorage } = require('../lib/decryptCore');
  const accountPath = options?.accountPath || null;
  const forceDecrypt = Boolean(options?.forceDecrypt);
  const hasTargetDecrypted = accountPath && hasDecryptedStorage(accountPath, accountPaths.decryptedDir);
  const canMigrateLegacy =
    accountPath &&
    !forceDecrypt &&
    !hasTargetDecrypted &&
    hasDecryptedStorage(accountPath) &&
    !needsDecrypt(accountPath, false);
  const mustDecrypt =
    accountPath && needsDecrypt(accountPath, forceDecrypt, accountPaths.decryptedDir) && !canMigrateLegacy;
  const clientPreflightOk = Boolean(options?.clientPreflightOk);

  let preflight = null;
  if (mustDecrypt && !clientPreflightOk) {
    try {
      preflight = runPreflightChecks({
        wxDir: options?.wxDir,
        accountPath,
      });
      scanSession.append('preflight', {
        ok: preflight.ok ? 'true' : 'false',
        blocking: preflight.blocking.map((item) => item.id).join(','),
        warnings: preflight.warnings.map((item) => item.id).join(','),
      });
      for (const check of preflight.checks) {
        scanSession.append('preflight_check', {
          id: check.id,
          level: check.level,
          label: check.label,
          detail: check.detail,
        });
      }

      if (!preflight.ok) {
        const errorInfo = {
          code: 'WTR-P001',
          title: '环境检查未通过',
          userMessage:
            '扫描前环境检查未通过，请先处理以下问题：\n\n' +
            preflight.blockingMessage,
          suggestions: preflight.blocking.map((item) => item.detail || item.label).filter(Boolean),
          rawMessage: preflight.blockingMessage,
        };
        scanSession.finalize({
          ok: false,
          code: errorInfo.code,
          message: errorInfo.rawMessage,
        });
        scanRunning = false;
        return {
          ok: false,
          error: errorInfo.userMessage,
          errorInfo,
          feedbackSummary: buildFeedbackSummary(errorInfo, scanSession.fileName),
          logFileName: scanSession.fileName,
          logDir: scanSession.logDir,
          preflight,
          preflightBlocked: true,
        };
      }
    } catch (err) {
      scanSession.append('preflight_error', { message: err.message });
    }
  } else {
    scanSession.append('preflight', {
      skipped: mustDecrypt ? 'client_verified' : 'decrypt_not_required',
      needs_decrypt: mustDecrypt ? 'true' : 'false',
    });
  }

  try {
    const resolvedAccountPath = accountPath || options?.wxDir || null;
    let latestCache = null;

    if (resolvedAccountPath && !forceDecrypt) {
      latestCache = getLatestConversationCache(accountPaths.conversationCachePath, resolvedAccountPath);
      const targetReady =
        hasDecryptedStorage(resolvedAccountPath, accountPaths.decryptedDir) &&
        !needsDecrypt(resolvedAccountPath, false, accountPaths.decryptedDir);
      if (latestCache && isCacheCurrent(latestCache, resolvedAccountPath) && targetReady) {
        scanSession.append('scan_skip', { reason: 'fingerprint_unchanged' });
        scanSession.finalize({ ok: true, code: 'OK', message: 'cache reused' });
        return {
          ok: true,
          unchanged: true,
          fromCache: true,
          conversations: latestCache.conversations,
          conversationCount: latestCache.conversationCount,
          totalMessages: latestCache.totalMessages,
          totalVoiceMessages: latestCache.totalVoiceMessages,
          wxDir: resolvedAccountPath,
          selfWxid: latestCache.selfWxid,
          logFileName: scanSession.fileName,
          logDir: scanSession.logDir,
        };
      }
    }

    const scanOptions = {
      ...options,
      decryptedDir: accountPaths.decryptedDir,
      passphraseCacheDir: accountPaths.passphraseCacheDir,
      incrementalBase:
        latestCache?.dbStats && !forceDecrypt ? { dbStats: latestCache.dbStats } : null,
    };

    const msg = await runScanWorker(scanOptions, scanSession);
    if (msg.ok) {
      scanSession.finalize({ ok: true, code: 'OK', message: 'scan completed' });
      const saveAccountPath = options.accountPath || msg.wxDir;
      saveConversationCache(accountPaths.conversationCachePath, saveAccountPath, {
        conversationCount: msg.conversationCount,
        totalMessages: msg.totalMessages,
        totalVoiceMessages: msg.totalVoiceMessages,
        selfWxid: msg.selfWxid,
        displayName: options.displayName || null,
        conversations: msg.conversations,
        dbStats: msg.dbStats || null,
      });
      if (msg.incremental?.reusedDbCount > 0) {
        scanSession.append('scan_incremental', {
          reused_db_count: String(msg.incremental.reusedDbCount),
          rescanned_db_count: String(msg.incremental.rescannedDbCount),
        });
      }
      return {
        ok: true,
        conversations: msg.conversations,
        conversationCount: msg.conversationCount,
        totalMessages: msg.totalMessages,
        totalVoiceMessages: msg.totalVoiceMessages,
        wxDir: msg.wxDir,
        selfWxid: msg.selfWxid,
        incremental: msg.incremental || null,
        logFileName: scanSession.fileName,
        logDir: scanSession.logDir,
      };
    }

    const errorInfo = classifyScanError(new Error(msg.error || '扫描失败'));
    scanSession.append('scan_error', {
      code: errorInfo.code,
      raw: errorInfo.rawMessage,
      message: msg.error || '',
    });
    scanSession.finalize({
      ok: false,
      code: errorInfo.code,
      message: errorInfo.rawMessage,
      cancelled: Boolean(msg.cancelled),
    });

    return {
      ok: false,
      error: errorInfo.userMessage,
      errorInfo,
      feedbackSummary: buildFeedbackSummary(errorInfo, scanSession.fileName),
      cancelled: Boolean(msg.cancelled),
      logFileName: scanSession.fileName,
      logDir: scanSession.logDir,
      preflight,
    };
  } catch (err) {
    if (scanCancelRequested) {
      scanSession.finalize({ ok: false, code: 'WTR-E009', message: '扫描已取消', cancelled: true });
      return {
        ok: false,
        cancelled: true,
        error: '扫描已取消',
        logFileName: scanSession.fileName,
        logDir: scanSession.logDir,
      };
    }

    const errorInfo = classifyScanError(err);
    scanSession.append('scan_error', {
      code: errorInfo.code,
      raw: errorInfo.rawMessage,
      message: err.message,
      stack: err.stack || '',
    });
    scanSession.finalize({
      ok: false,
      code: errorInfo.code,
      message: errorInfo.rawMessage,
    });

    return {
      ok: false,
      error: errorInfo.userMessage,
      errorInfo,
      feedbackSummary: buildFeedbackSummary(errorInfo, scanSession.fileName),
      logFileName: scanSession.fileName,
      logDir: scanSession.logDir,
      preflight,
    };
  } finally {
    scanRunning = false;
    scanWorker = null;
  }
});

ipcMain.handle('cancel-scan', async () => {
  scanCancelRequested = true;
  scanRunning = false;
  const worker = scanWorker;
  if (!worker) {
    return { ok: true, cancelled: true };
  }
  worker.postMessage({ type: 'cancel' });
  await worker.terminate().catch(() => {});
  if (scanWorker === worker) {
    scanWorker = null;
  }
  return { ok: true, cancelled: true };
});

function runExportInWorker(options) {
  return new Promise((resolve, reject) => {
    exportCancelRequested = false;
    let settled = false;
    const worker = new Worker(path.join(__dirname, 'exportWorker.js'), {
      workerData: {
        wxDir: options.wxDir,
        outputDir: options.outputDir,
        selfWxid: options.selfWxid,
        forceDecrypt: options.forceDecrypt,
        loginCapture: options.loginCapture,
        keysPath: options.keysPath,
        decryptedDir: options.decryptedDir,
        passphraseCacheDir: options.passphraseCacheDir,
        imageKeyCacheDir: options.imageKeyCacheDir,
        voiceCacheDir: options.voiceCacheDir,
        formats: options.formats,
        selectedUsernames: options.selectedUsernames,
        selectedConversations: options.selectedConversations,
        voiceTranscription: options.voiceTranscription,
      },
    });
    currentWorker = worker;

    const finish = (handler, value) => {
      if (settled) return;
      settled = true;
      if (currentWorker === worker) {
        currentWorker = null;
      }
      worker.terminate().catch(() => {});
      handler(value);
    };

    worker.on('message', (msg) => {
      if (msg.type === 'progress') {
        sendProgress(msg.event);
      } else if (msg.type === 'done') {
        finish(resolve, msg);
      }
    });

    worker.on('error', (err) => {
      finish(reject, err);
    });

    worker.on('exit', (code) => {
      if (settled) return;
      if (exportCancelRequested) {
        finish(resolve, { ok: false, cancelled: true, error: '导出已取消' });
        return;
      }
      if (code !== 0) {
        finish(reject, new Error(`导出任务异常退出 (code ${code})`));
      }
    });
  });
}

ipcMain.handle('start-export', async (_event, options) => {
  if (exportRunning) {
    return { ok: false, error: '导出任务正在进行中' };
  }

  exportRunning = true;
  try {
    const accountPaths = getAccountDataPaths(options?.datasetDir);
    const msg = await runExportInWorker({
      wxDir: options.wxDir,
      outputDir: options.outputDir,
      selfWxid: options.selfWxid || null,
      forceDecrypt: Boolean(options.forceDecrypt),
      loginCapture: options.loginCapture !== false,
      keysPath: options.keysPath || null,
      decryptedDir: accountPaths.decryptedDir,
      passphraseCacheDir: accountPaths.passphraseCacheDir,
      imageKeyCacheDir: accountPaths.imageKeyCacheDir,
      voiceCacheDir: accountPaths.voiceCacheDir,
      formats: options.formats || ['json'],
      selectedUsernames: options.selectedUsernames || null,
      selectedConversations: options.selectedConversations || null,
      voiceTranscription: Boolean(options.voiceTranscription),
    });
    if (msg.ok) {
      return { ok: true, result: msg.result };
    }
    if (!msg.cancelled) {
      sendProgress({ phase: 'error', message: msg.error });
    }
    return { ok: false, error: msg.error, cancelled: Boolean(msg.cancelled) };
  } catch (err) {
    if (exportCancelRequested) {
      return { ok: false, cancelled: true, error: '导出已取消' };
    }
    sendProgress({ phase: 'error', message: err.message });
    return { ok: false, error: err.message };
  } finally {
    exportRunning = false;
    currentWorker = null;
  }
});

ipcMain.handle('cancel-export', async () => {
  exportCancelRequested = true;
  exportRunning = false;
  const worker = currentWorker;
  if (!worker) {
    return { ok: true, cancelled: true };
  }
  worker.postMessage({ type: 'cancel' });
  await worker.terminate().catch(() => {});
  if (currentWorker === worker) {
    currentWorker = null;
  }
  return { ok: true, cancelled: true };
});

ipcMain.handle('open-path', async (_event, targetPath) => {
  await shell.openPath(targetPath);
});

ipcMain.handle('show-error-dialog', async (_event, { title, message, detail }) => {
  await dialog.showMessageBox(mainWindow, {
    type: 'error',
    title: title || '操作失败',
    message,
    detail: detail || '',
    buttons: ['知道了'],
  });
});

app.whenReady().then(() => {
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.wetrace.exporter');
  }
  clearViewerCache();
  createWindow();
});

app.on('before-quit', clearViewerCache);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
