const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PAGE_SZ = 4096;
const KEY_SZ = 32;
const SALT_SZ = 16;
const IV_SZ = 16;
const HMAC_SZ = 64;
const RESERVE_SZ = 80;
const SQLITE_HDR = Buffer.from('SQLite format 3\0');

function deriveMacKey(encKey, salt) {
  const macSalt = Buffer.alloc(salt.length);
  for (let i = 0; i < salt.length; i += 1) {
    macSalt[i] = salt[i] ^ 0x3a;
  }
  return crypto.pbkdf2Sync(encKey, macSalt, 2, KEY_SZ, 'sha512');
}

function deriveEncKeyFromPassphrase(passphrase, salt) {
  const passBuf = Buffer.isBuffer(passphrase) ? passphrase : Buffer.from(passphrase, 'utf8');
  return crypto.pbkdf2Sync(passBuf, salt, 256000, KEY_SZ, 'sha512');
}

function resolveEncKeyForPage(page1, { encKeyHex = null, passphrase = null } = {}) {
  if (encKeyHex) {
    const encKey = Buffer.from(encKeyHex, 'hex');
    if (encKey.length === 32 && verifyEncKey(encKey, page1)) {
      return encKey;
    }
    if (encKey.length === 32 && verifyEncKey(deriveEncKeyFromPassphrase(encKey, page1.subarray(0, SALT_SZ)), page1)) {
      return deriveEncKeyFromPassphrase(encKey, page1.subarray(0, SALT_SZ));
    }
  }

  if (passphrase) {
    const passBuf = Buffer.isBuffer(passphrase) ? passphrase : Buffer.from(passphrase, 'hex');
    const derived = deriveEncKeyFromPassphrase(passBuf, page1.subarray(0, SALT_SZ));
    if (verifyEncKey(derived, page1)) {
      return derived;
    }
  }

  return null;
}

function verifyEncKey(encKey, page1) {
  const salt = page1.subarray(0, SALT_SZ);
  const macKey = deriveMacKey(encKey, salt);
  const hmacData = page1.subarray(SALT_SZ, PAGE_SZ - RESERVE_SZ + IV_SZ);
  const storedHmac = page1.subarray(PAGE_SZ - HMAC_SZ, PAGE_SZ);
  const hm = crypto.createHmac('sha512', macKey).update(hmacData);
  hm.update(Buffer.from([1, 0, 0, 0]));
  return hm.digest().equals(storedHmac);
}

function decryptAesCbcNoPadding(encKey, iv, encrypted) {
  const decipher = crypto.createDecipheriv('aes-256-cbc', encKey, iv);
  // SQLCipher page payloads are full AES blocks without PKCS7 padding (unlike PyCryptodome default).
  decipher.setAutoPadding(false);
  return decipher.update(encrypted);
}

function decryptPage(encKey, pageData, pgno) {
  const iv = pageData.subarray(PAGE_SZ - RESERVE_SZ, PAGE_SZ - RESERVE_SZ + IV_SZ);

  if (pgno === 1) {
    const encrypted = pageData.subarray(SALT_SZ, PAGE_SZ - RESERVE_SZ);
    const decrypted = decryptAesCbcNoPadding(encKey, iv, encrypted);
    const page = Buffer.alloc(PAGE_SZ, 0);
    SQLITE_HDR.copy(page, 0);
    decrypted.copy(page, SQLITE_HDR.length);
    return page;
  }

  const encrypted = pageData.subarray(0, PAGE_SZ - RESERVE_SZ);
  const decrypted = decryptAesCbcNoPadding(encKey, iv, encrypted);
  const page = Buffer.alloc(PAGE_SZ, 0);
  decrypted.copy(page, 0);
  return page;
}

function decryptDatabase(dbPath, outPath, keyMaterial, options = {}) {
  const fd = fs.openSync(dbPath, 'r');
  const page1 = Buffer.alloc(PAGE_SZ);
  fs.readSync(fd, page1, 0, PAGE_SZ, 0);
  fs.closeSync(fd);

  const encKey = resolveEncKeyForPage(page1, {
    encKeyHex: typeof keyMaterial === 'string' ? keyMaterial : keyMaterial?.enc_key,
    passphrase: options.passphrase,
  });
  if (!encKey) {
    return false;
  }

  const fileSize = fs.statSync(dbPath).size;
  let totalPages = Math.floor(fileSize / PAGE_SZ);
  if (fileSize % PAGE_SZ !== 0) totalPages += 1;

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  const outFd = fs.openSync(outPath, 'w');

  const inFd = fs.openSync(dbPath, 'r');
  try {
    for (let pgno = 1; pgno <= totalPages; pgno += 1) {
      const page = Buffer.alloc(PAGE_SZ);
      const bytesRead = fs.readSync(inFd, page, 0, PAGE_SZ, (pgno - 1) * PAGE_SZ);
      if (bytesRead <= 0) break;

      let decrypted;
      try {
        decrypted = decryptPage(encKey, page, pgno);
      } catch (err) {
        return false;
      }
      fs.writeSync(outFd, decrypted, 0, PAGE_SZ);
    }
  } finally {
    fs.closeSync(inFd);
    fs.closeSync(outFd);
  }

  for (const suffix of ['-shm', '-wal']) {
    const residual = outPath + suffix;
    if (fs.existsSync(residual)) {
      try {
        fs.unlinkSync(residual);
      } catch {
        // ignore
      }
    }
  }

  return true;
}

function collectDbFiles(dbDir) {
  const dbFiles = [];
  const saltToDbs = {};

  function walk(currentDir) {
    for (const name of fs.readdirSync(currentDir)) {
      const fullPath = path.join(currentDir, name);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        walk(fullPath);
        continue;
      }
      if (!name.endsWith('.db') || name.endsWith('-wal') || name.endsWith('-shm')) {
        continue;
      }
      if (stat.size < PAGE_SZ) continue;

      const page1 = Buffer.alloc(PAGE_SZ);
      const fd = fs.openSync(fullPath, 'r');
      fs.readSync(fd, page1, 0, PAGE_SZ, 0);
      fs.closeSync(fd);

      const rel = path.relative(dbDir, fullPath).replace(/\\/g, '/');
      const salt = page1.subarray(0, SALT_SZ).toString('hex');
      dbFiles.push({ rel, path: fullPath, size: stat.size, salt, page1 });
      if (!saltToDbs[salt]) saltToDbs[salt] = [];
      saltToDbs[salt].push(rel);
    }
  }

  walk(dbDir);
  return { dbFiles, saltToDbs };
}

function getKeyInfo(keys, relPath) {
  const normalized = relPath.replace(/\\/g, '/');
  const variants = [
    relPath,
    normalized,
    normalized.replace(/\//g, '\\'),
    normalized.replace(/\//g, path.sep),
  ];
  for (const candidate of variants) {
    if (keys[candidate] && !candidate.startsWith('_')) {
      return keys[candidate];
    }
  }
  return null;
}

function getDatabaseSourceFingerprint(dbPath) {
  const parts = [];
  for (const suffix of ['', '-wal', '-shm']) {
    const sourcePath = dbPath + suffix;
    const label = suffix || 'db';
    try {
      const stat = fs.statSync(sourcePath);
      parts.push(`${label}:${stat.size}:${Math.trunc(stat.mtimeMs)}`);
    } catch {
      parts.push(`${label}:missing`);
    }
  }
  return crypto.createHash('sha256').update(parts.join('|')).digest('hex');
}

function parseLegacyStorageFingerprint(value) {
  if (typeof value !== 'string' || value.startsWith('v2|')) return null;
  const entries = new Map();
  for (const part of value.split('|')) {
    const separator = part.lastIndexOf(':');
    if (separator <= 0) continue;
    const size = Number(part.slice(separator + 1));
    if (Number.isFinite(size)) {
      entries.set(part.slice(0, separator).replace(/\\/g, '/'), size);
    }
  }
  return entries.size > 0 ? entries : null;
}

function matchesLegacySource(dbPath, rel, legacyFingerprint) {
  const entries = parseLegacyStorageFingerprint(legacyFingerprint);
  if (!entries) return false;

  for (const suffix of ['', '-wal', '-shm']) {
    const sourcePath = dbPath + suffix;
    const sourceRel = rel + suffix;
    let stat = null;
    try {
      stat = fs.statSync(sourcePath);
    } catch {
      // Missing companion files are part of the source state.
    }
    if (entries.has(sourceRel) !== Boolean(stat)) return false;
    if (stat && entries.get(sourceRel) !== stat.size) return false;
  }
  return true;
}

function readStoredSourceFingerprint(value) {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    return value.source_fingerprint || value.sourceFingerprint || null;
  }
  return null;
}

function getDatabaseReuseState({ dbPath, outPath, rel, forceDecrypt, decryptedFiles, legacyFingerprint }) {
  const sourceFingerprint = getDatabaseSourceFingerprint(dbPath);
  const storedFingerprint = readStoredSourceFingerprint(decryptedFiles?.[rel]);
  const canReuse =
    !forceDecrypt &&
    fs.existsSync(outPath) &&
    (storedFingerprint === sourceFingerprint ||
      (!storedFingerprint && matchesLegacySource(dbPath, rel, legacyFingerprint)));
  return { sourceFingerprint, canReuse };
}

function getPendingDatabaseRelativePaths({
  dbDir,
  outDir,
  forceDecrypt = false,
  decryptedFiles = {},
  legacyFingerprint = null,
}) {
  const { dbFiles } = collectDbFiles(dbDir);
  return dbFiles
    .filter(({ rel, path: dbPath }) => {
      const outPath = path.join(outDir, rel.replace(/\//g, path.sep));
      return !getDatabaseReuseState({
        dbPath,
        outPath,
        rel,
        forceDecrypt,
        decryptedFiles,
        legacyFingerprint,
      }).canReuse;
    })
    .map((item) => item.rel);
}

function removeFileIfPresent(filePath) {
  try {
    fs.unlinkSync(filePath);
  } catch (err) {
    if (err?.code !== 'ENOENT') throw err;
  }
}

function decryptAllDatabases({
  dbDir,
  outDir,
  keys,
  onProgress,
  forceDecrypt = false,
  decryptedFiles = {},
  legacyFingerprint = null,
  decryptDatabaseFn = decryptDatabase,
}) {
  const { dbFiles } = collectDbFiles(dbDir);
  const passphrase = keys._passphrase_hex ? Buffer.from(keys._passphrase_hex, 'hex') : null;
  const updatedDecryptedFiles = {};
  let passed = 0;
  let failed = 0;
  let skipped = 0;
  let reused = 0;

  for (let i = 0; i < dbFiles.length; i += 1) {
    const { rel, path: dbPath, size } = dbFiles[i];
    const outPath = path.join(outDir, rel.replace(/\//g, path.sep));
    const { sourceFingerprint, canReuse } = getDatabaseReuseState({
      dbPath,
      outPath,
      rel,
      forceDecrypt,
      decryptedFiles,
      legacyFingerprint,
    });

    if (canReuse) {
      reused += 1;
      updatedDecryptedFiles[rel] = sourceFingerprint;
      onProgress?.({
        phase: 'reused',
        current: i + 1,
        total: dbFiles.length,
        rel,
        message: `\u590d\u7528\u672a\u53d8\u5316\u7684\u6570\u636e\u5e93 (${i + 1}/${dbFiles.length}): ${rel}`,
      });
      continue;
    }

    const keyInfo = getKeyInfo(keys, rel);
    if (!keyInfo && !passphrase) {
      skipped += 1;
      onProgress?.({ message: `\u8df3\u8fc7\uff08\u65e0\u5bc6\u94a5\uff09: ${rel}` });
      continue;
    }

    onProgress?.({
      phase: 'decrypting',
      current: i + 1,
      total: dbFiles.length,
      rel,
      sizeMb: (size / 1024 / 1024).toFixed(1),
    });

    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    const tempPath = `${outPath}.tmp-${process.pid}-${crypto.randomBytes(6).toString('hex')}`;
    let ok = false;
    let failureMessage = null;
    try {
      ok = decryptDatabaseFn(dbPath, tempPath, keyInfo?.enc_key || null, { passphrase });
      if (ok && getDatabaseSourceFingerprint(dbPath) !== sourceFingerprint) {
        ok = false;
        failureMessage = '\u6e90\u6570\u636e\u5e93\u5728\u89e3\u5bc6\u671f\u95f4\u53d1\u751f\u53d8\u5316';
      }
      if (ok) {
        fs.renameSync(tempPath, outPath);
        removeFileIfPresent(outPath + '-shm');
        removeFileIfPresent(outPath + '-wal');
        updatedDecryptedFiles[rel] = sourceFingerprint;
        passed += 1;
      }
    } catch (err) {
      ok = false;
      failureMessage = err?.message || String(err);
    } finally {
      removeFileIfPresent(tempPath);
    }

    if (!ok) {
      failed += 1;
      onProgress?.({
        phase: 'decrypt_failed',
        current: i + 1,
        total: dbFiles.length,
        rel,
        message: `\u89e3\u5bc6\u5931\u8d25: ${rel}${failureMessage ? ` (${failureMessage})` : ''}`,
      });
    }
  }

  return {
    passed,
    failed,
    skipped,
    reused,
    total: dbFiles.length,
    decryptedFiles: updatedDecryptedFiles,
  };
}

module.exports = {
  verifyEncKey,
  deriveEncKeyFromPassphrase,
  resolveEncKeyForPage,
  decryptDatabase,
  collectDbFiles,
  decryptAllDatabases,
  getPendingDatabaseRelativePaths,
  getDatabaseSourceFingerprint,
  parseLegacyStorageFingerprint,
  getKeyInfo,
};
