const fs = require('fs');
const path = require('path');
const { extractKeysFromWeChat } = require('./keyScan');
const { decryptAllDatabases } = require('./decryptDb');

function getDbStorageDir(wxDir) {
  return path.join(wxDir, 'db_storage');
}

function getDecryptedDir(wxDir) {
  return path.join(wxDir, 'db_storage_decrypted');
}

function getDecryptedDirCandidates(wxDir) {
  return [
    getDecryptedDir(wxDir),
    path.join(wxDir, 'db_storage', 'db_storage_decrypted'),
  ];
}

function resolveDecryptedDir(wxDir, preferredDir = null) {
  if (preferredDir) {
    const resolvedPreferred = path.resolve(preferredDir);
    return fs.existsSync(path.join(resolvedPreferred, 'message')) ? resolvedPreferred : null;
  }
  for (const candidate of getDecryptedDirCandidates(wxDir)) {
    if (fs.existsSync(path.join(candidate, 'message'))) {
      return candidate;
    }
  }
  return null;
}

function hasEncryptedStorage(wxDir) {
  const dbDir = getDbStorageDir(wxDir);
  return fs.existsSync(path.join(dbDir, 'message')) || fs.existsSync(dbDir);
}

function hasDecryptedStorage(wxDir, preferredDir = null) {
  return resolveDecryptedDir(wxDir, preferredDir) != null;
}

function collectDbStorageFingerprint(dbDir) {
  if (!dbDir || !fs.existsSync(dbDir)) {
    return 'empty';
  }

  const parts = [];

  function walk(currentDir) {
    for (const name of fs.readdirSync(currentDir)) {
      const fullPath = path.join(currentDir, name);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        walk(fullPath);
        continue;
      }
      if (!name.endsWith('.db') && !name.endsWith('-wal') && !name.endsWith('-shm')) {
        continue;
      }
      const rel = path.relative(dbDir, fullPath).replace(/\\/g, '/');
      parts.push(`${rel}:${stat.size}:${Math.trunc(stat.mtimeMs)}`);
    }
  }

  walk(dbDir);
  return parts.length > 0 ? `v2|${parts.sort().join('|')}` : 'v2|empty';
}

function getEncryptedStorageFingerprint(wxDir) {
  return collectDbStorageFingerprint(getDbStorageDir(wxDir));
}

function readInfoFile(decryptedDir) {
  if (!decryptedDir) return null;
  const infoPath = path.join(decryptedDir, 'info.json');
  try {
    if (fs.existsSync(infoPath)) {
      const parsed = JSON.parse(fs.readFileSync(infoPath, 'utf8'));
      if (parsed && typeof parsed === 'object') {
        return parsed;
      }
    }
  } catch {
    // ignore broken info.json
  }
  return null;
}

function readDecryptInfo(wxDir, preferredDir = null) {
  return readInfoFile(resolveDecryptedDir(wxDir, preferredDir));
}

function getDecryptedStorageFingerprint(wxDir, preferredDir = null) {
  const recorded = readDecryptInfo(wxDir, preferredDir)?.encrypted_fingerprint;
  if (recorded) return recorded;
  return collectDbStorageFingerprint(resolveDecryptedDir(wxDir, preferredDir));
}

function needsDecrypt(wxDir, force = false, preferredDir = null) {
  if (force) return hasEncryptedStorage(wxDir);
  if (!hasEncryptedStorage(wxDir)) return false;
  if (!hasDecryptedStorage(wxDir, preferredDir)) return true;

  const currentFingerprint = getEncryptedStorageFingerprint(wxDir);
  const info = readDecryptInfo(wxDir, preferredDir);
  if (!info?.encrypted_fingerprint) {
    return true;
  }

  return info.encrypted_fingerprint !== currentFingerprint;
}

function buildDecryptInfo({ wxDir, previousInfo, currentFingerprint, result }) {
  const prior = previousInfo && typeof previousInfo === 'object' ? previousInfo : {};
  const priorFiles =
    prior.decrypted_files && typeof prior.decrypted_files === 'object' ? prior.decrypted_files : {};
  const complete = result.failed === 0 && result.skipped === 0;
  const payload = {
    ...prior,
    wx_dir: wxDir.replace(/\\/g, '/'),
    decrypted_by: 'wexinchat-exporter',
    decrypted_at: new Date().toISOString(),
    decrypted_files: {
      ...priorFiles,
      ...result.decryptedFiles,
    },
  };

  if (complete) {
    payload.encrypted_fingerprint = currentFingerprint;
  } else if (prior.encrypted_fingerprint) {
    payload.encrypted_fingerprint = prior.encrypted_fingerprint;
  } else {
    delete payload.encrypted_fingerprint;
  }
  return payload;
}

function writeInfoJson(wxDir, decryptedDir, options) {
  const infoPath = path.join(decryptedDir || getDecryptedDir(wxDir), 'info.json');
  const payload = buildDecryptInfo({ wxDir, ...options });
  const tempPath = `${infoPath}.tmp-${process.pid}`;
  fs.mkdirSync(path.dirname(infoPath), { recursive: true });
  try {
    fs.writeFileSync(tempPath, JSON.stringify(payload, null, 2), 'utf8');
    fs.renameSync(tempPath, infoPath);
  } finally {
    try {
      fs.unlinkSync(tempPath);
    } catch (err) {
      if (err?.code !== 'ENOENT') throw err;
    }
  }
  return infoPath;
}

function migrateLegacyAccountData(wxDir, preferredDir, passphraseCacheDir, onProgress) {
  if (!preferredDir) return;
  const resolvedPreferred = path.resolve(preferredDir);
  if (!resolveDecryptedDir(wxDir, resolvedPreferred)) {
    const legacyDir = resolveDecryptedDir(wxDir);
    if (legacyDir && path.resolve(legacyDir) !== resolvedPreferred) {
      onProgress?.({ phase: 'decrypt', message: '正在把已有解密数据库复制到当前账号的数据目录...' });
      fs.mkdirSync(path.dirname(resolvedPreferred), { recursive: true });
      fs.cpSync(legacyDir, resolvedPreferred, { recursive: true, force: true });
    }
  }
  if (passphraseCacheDir) {
    const legacyPassphrase = path.join(wxDir, '.wexin_passphrase');
    const targetPassphrase = path.join(passphraseCacheDir, '.wexin_passphrase');
    if (fs.existsSync(legacyPassphrase) && !fs.existsSync(targetPassphrase)) {
      fs.mkdirSync(passphraseCacheDir, { recursive: true });
      fs.copyFileSync(legacyPassphrase, targetPassphrase);
    }
  }
}

async function decryptWeChatData({
  wxDir,
  forceDecrypt = false,
  loginCapture = true,
  keysPath = null,
  decryptedDir = null,
  passphraseCacheDir = null,
  onProgress,
}) {
  const dbDir = getDbStorageDir(wxDir);
  const outDir = decryptedDir ? path.resolve(decryptedDir) : getDecryptedDir(wxDir);

  if (!hasEncryptedStorage(wxDir)) {
    throw new Error('\u672a\u627e\u5230\u52a0\u5bc6\u7684 db_storage \u76ee\u5f55');
  }

  const previousInfo = readInfoFile(outDir);
  const currentFingerprint = getEncryptedStorageFingerprint(wxDir);
  const incrementalOptions = {
    dbDir,
    outDir,
    decryptedFiles: previousInfo?.decrypted_files || {},
    legacyFingerprint: previousInfo?.encrypted_fingerprint || null,
  };

  if (!forceDecrypt) {
    const reuseProbe = decryptAllDatabases({ ...incrementalOptions, keys: {} });
    if (reuseProbe.total > 0 && reuseProbe.reused === reuseProbe.total) {
      onProgress?.({
        phase: 'decrypt',
        message: `\u6570\u636e\u5e93\u6587\u4ef6\u5747\u672a\u53d8\u5316\uff0c\u5df2\u590d\u7528 ${reuseProbe.reused} \u4e2a\u89e3\u5bc6\u6587\u4ef6`,
      });
      const infoPath = writeInfoJson(wxDir, outDir, {
        previousInfo,
        currentFingerprint,
        result: reuseProbe,
      });
      return {
        wxDir,
        decryptedDir: outDir,
        infoPath,
        ...reuseProbe,
      };
    }
  }

  onProgress?.({
    phase: 'decrypt',
    message: '\u6b63\u5728\u4ece\u4e0d\u4fe1\u8fdb\u7a0b\u5185\u5b58\u63d0\u53d6\u6570\u636e\u5e93\u5bc6\u94a5...',
  });
  fs.mkdirSync(path.dirname(outDir), { recursive: true });
  const keys = await extractKeysFromWeChat({
    dbDir,
    wxDir,
    onProgress,
    loginCapture,
    keysPath,
    passphraseCacheDir,
  });

  onProgress?.({
    phase: 'decrypt',
    message: '\u6b63\u5728\u68c0\u67e5\u5e76\u89e3\u5bc6\u53d1\u751f\u53d8\u5316\u7684\u6570\u636e\u5e93\u6587\u4ef6...',
  });
  const result = decryptAllDatabases({
    ...incrementalOptions,
    keys,
    forceDecrypt,
    onProgress: (event) => {
      if (event.phase === 'decrypting') {
        onProgress?.({
          phase: 'decrypt',
          message: `\u89e3\u5bc6\u4e2d (${event.current}/${event.total}): ${event.rel} (${event.sizeMb}MB)`,
          ...event,
        });
      } else if (event.message) {
        onProgress?.({ phase: 'decrypt', message: event.message });
      }
    },
  });

  const infoPath = writeInfoJson(wxDir, outDir, {
    previousInfo,
    currentFingerprint,
    result,
  });

  onProgress?.({
    phase: 'decrypt',
    message: `\u89e3\u5bc6\u5b8c\u6210: ${result.passed} \u6210\u529f, ${result.reused} \u590d\u7528, ${result.failed} \u5931\u8d25, ${result.skipped} \u8df3\u8fc7`,
  });

  if (result.passed === 0 && result.reused === 0 && result.failed > 0) {
    throw new Error(
      `\u6240\u6709\u6570\u636e\u5e93\u89e3\u5bc6\u5931\u8d25\uff08${result.failed} \u4e2a\uff09\u3002\u8bf7\u786e\u8ba4\u4e0d\u4fe1\u5df2\u767b\u5f55\u4e14 Hook \u6355\u83b7\u7684 passphrase \u6709\u6548\u3002`
    );
  }

  return {
    wxDir,
    decryptedDir: outDir,
    infoPath,
    ...result,
  };
}

async function ensureDecrypted({
  wxDir,
  forceDecrypt = false,
  loginCapture = true,
  keysPath = null,
  decryptedDir = null,
  passphraseCacheDir = null,
  onProgress,
}) {
  migrateLegacyAccountData(wxDir, decryptedDir, passphraseCacheDir, onProgress);
  if (!needsDecrypt(wxDir, forceDecrypt, decryptedDir)) {
    const resolvedDecryptedDir = resolveDecryptedDir(wxDir, decryptedDir);
    if (resolvedDecryptedDir) {
      onProgress?.({ phase: 'decrypt', message: '已存在解密数据库，跳过解密步骤' });
      return { skipped: true, decryptedDir: resolvedDecryptedDir };
    }
    throw new Error('未找到 db_storage 或 db_storage_decrypted');
  }

  if (!hasEncryptedStorage(wxDir)) {
    throw new Error('未找到加密的 db_storage 目录');
  }

  try {
    const result = await decryptWeChatData({
      wxDir,
      forceDecrypt,
      loginCapture,
      keysPath,
      decryptedDir,
      passphraseCacheDir,
      onProgress,
    });
    return { skipped: false, ...result };
  } catch (err) {
    const fallbackDir = resolveDecryptedDir(wxDir, decryptedDir);
    if (fallbackDir && !forceDecrypt) {
      onProgress?.({
        phase: 'decrypt',
        message:
          '无法从不信内存提取新密钥，将使用已有的 db_storage_decrypted。\n' +
          '提示：如需完整重新解密，请打开不信并浏览几个聊天后，使用高级功能中的「重置解密数据」。',
      });
      return {
        skipped: true,
        usedFallback: true,
        decryptedDir: fallbackDir,
        warning: err.message,
      };
    }

    throw err;
  }
}

module.exports = {
  getDbStorageDir,
  getDecryptedDir,
  resolveDecryptedDir,
  hasEncryptedStorage,
  hasDecryptedStorage,
  getEncryptedStorageFingerprint,
  getDecryptedStorageFingerprint,
  buildDecryptInfo,
  needsDecrypt,
  decryptWeChatData,
  ensureDecrypted,
};
