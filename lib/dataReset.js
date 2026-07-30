const fs = require('fs');
const path = require('path');
const { isWeChatAccountDir } = require('./exportCore');
const { getLogDir } = require('./sessionLog');

const PASSPHRASE_FILES = ['.wexin_passphrase', '.wexin_passphrase.dpapi'];
const DATABASE_KEY_FILES = ['.wexin_keys.json', '.wexin_keys.dpapi'];
const IMAGE_KEY_FILES = ['.wexin_imgkey', '.wexin_imgkey.dpapi'];
const VOICE_CACHE_FILE = '.wetrace_voice_transcriptions.json';

function removePath(targetPath) {
  if (!targetPath || !fs.existsSync(targetPath)) {
    return false;
  }
  try {
    fs.rmSync(targetPath, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
    return !fs.existsSync(targetPath);
  } catch {
    return false;
  }
}

function getAccountDecryptTargets(accountDir, { runtimeDir = null } = {}) {
  const resolved = path.resolve(accountDir);
  const targets = [
    ...PASSPHRASE_FILES.map((name, index) => ({ id: 'passphrase_' + index, label: '密钥缓存', path: path.join(resolved, name) })),
    ...DATABASE_KEY_FILES.map((name, index) => ({ id: 'database_key_' + index, label: '数据库密钥缓存', path: path.join(resolved, name) })),
    ...IMAGE_KEY_FILES.map((name, index) => ({ id: 'image_key_' + index, label: '图片密钥缓存', path: path.join(resolved, name) })),
    { id: 'decrypted', label: '解密数据库', path: path.join(resolved, 'db_storage_decrypted') },
    {
      id: 'decrypted_nested',
      label: '解密数据库（嵌套）',
      path: path.join(resolved, 'db_storage', 'db_storage_decrypted'),
    },
    { id: 'voice_cache', label: '语音转写缓存', path: path.join(resolved, VOICE_CACHE_FILE) },
  ];
  if (runtimeDir) {
    const resolvedRuntime = path.resolve(runtimeDir);
    targets.push(
      ...PASSPHRASE_FILES.map((name, index) => ({ id: 'runtime_passphrase_' + index, label: '账号密钥缓存', path: path.join(resolvedRuntime, name) })),
      ...DATABASE_KEY_FILES.map((name, index) => ({ id: 'runtime_database_key_' + index, label: '账号数据库密钥缓存', path: path.join(resolvedRuntime, name) })),
      ...IMAGE_KEY_FILES.map((name, index) => ({ id: 'runtime_image_key_' + index, label: '账号图片密钥缓存', path: path.join(resolvedRuntime, name) })),
      { id: 'runtime_voice_cache', label: '账号语音转写缓存', path: path.join(resolvedRuntime, VOICE_CACHE_FILE) },
      { id: 'runtime_decrypted', label: '账号解密数据库', path: path.join(resolvedRuntime, 'db_storage_decrypted') }
    );
  }
  return targets;
}

function resetAccountDecryptData(accountDir, options = {}) {
  const resolved = path.resolve(accountDir);
  if (!isWeChatAccountDir(resolved)) {
    throw new Error('所选目录不是有效的不信账号目录');
  }

  const removed = [];
  const skipped = [];

  for (const target of getAccountDecryptTargets(resolved, options)) {
    if (removePath(target.path)) {
      removed.push(target.id);
    } else {
      skipped.push(target.id);
    }
  }

  return {
    accountPath: resolved,
    removed,
    skipped,
  };
}

function clearAccountToolArtifacts(accountDir) {
  const resolved = path.resolve(accountDir);
  const removed = [];
  const skipped = [];

  for (const target of getAccountDecryptTargets(resolved)) {
    if (removePath(target.path)) {
      removed.push(target.id);
    } else {
      skipped.push(target.id);
    }
  }

  return {
    accountPath: resolved,
    removed,
    skipped,
  };
}

function collectAccountPaths(cachePath, additionalAccountPaths = []) {
  const { listConversationCaches } = require('./conversationCache');
  const fromCache = listConversationCaches(cachePath).map((item) => item.accountPath);
  return [...new Set([...fromCache, ...additionalAccountPaths].filter(Boolean))];
}

function clearDatasetRuntimeArtifacts(datasetDir) {
  const root = path.resolve(datasetDir);
  const runtimeDir = path.resolve(root, 'runtime');
  if (!runtimeDir.startsWith(root + path.sep)) {
    throw new Error('Invalid dataset runtime path');
  }
  return {
    datasetDir: root,
    runtimeDir,
    removed: removePath(runtimeDir),
  };
}

function resetAppData(userDataPath, { conversationCachePath, settingsPath } = {}) {
  const resolvedUserData = path.resolve(userDataPath);
  const cachePath = conversationCachePath || path.join(resolvedUserData, 'conversation-cache.json');
  const settingsFile = settingsPath || path.join(resolvedUserData, 'wetrace-settings.json');
  const logDir = getLogDir(resolvedUserData);

  const targets = [
    { id: 'conversation_cache', label: '会话扫描缓存', path: cachePath },
    { id: 'settings', label: '应用设置', path: settingsFile },
    { id: 'logs', label: '诊断日志', path: logDir },
    { id: 'viewer_cache', label: '记录浏览图片缓存', path: path.join(resolvedUserData, 'viewer-cache') },
  ];

  const removed = [];
  const skipped = [];

  for (const target of targets) {
    if (removePath(target.path)) {
      removed.push(target.id);
    } else {
      skipped.push(target.id);
    }
  }

  return {
    userDataPath: resolvedUserData,
    removed,
    skipped,
  };
}

function resetAllToolTraces(userDataPath, {
  conversationCachePath,
  settingsPath,
  additionalAccountPaths,
  datasetDirs,
} = {}) {
  const resolvedUserData = path.resolve(userDataPath);
  const cachePath = conversationCachePath || path.join(resolvedUserData, 'conversation-cache.json');
  const accountPaths = collectAccountPaths(cachePath, additionalAccountPaths);

  const datasets = [];
  for (const datasetDir of [...new Set((datasetDirs || []).filter(Boolean))]) {
    try {
      datasets.push(clearDatasetRuntimeArtifacts(datasetDir));
    } catch (err) {
      datasets.push({ datasetDir, runtimeDir: null, removed: false, error: err.message });
    }
  }

  const accounts = [];
  for (const accountPath of accountPaths) {
    try {
      accounts.push(clearAccountToolArtifacts(accountPath));
    } catch (err) {
      accounts.push({
        accountPath,
        removed: [],
        skipped: [],
        error: err.message,
      });
    }
  }

  const appData = resetAppData(resolvedUserData, { conversationCachePath: cachePath, settingsPath });

  return {
    userDataPath: resolvedUserData,
    accountPaths,
    accounts,
    datasets,
    appData,
  };
}

module.exports = {
  resetAccountDecryptData,
  resetAllToolTraces,
  clearAccountToolArtifacts,
  clearDatasetRuntimeArtifacts,
  getAccountDecryptTargets,
};
