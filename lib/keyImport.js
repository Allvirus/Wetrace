const fs = require('fs');
const path = require('path');
const { verifyEncKey } = require('./decryptDb');
const { deriveKeysFromPassphrase } = require('./passphraseScan');

function normalizeImgKeyHex(value) {
  const hex = String(value || '').trim().replace(/[^0-9a-fA-F]/g, '').toLowerCase();
  return /^[0-9a-f]{32}$/.test(hex) ? hex : null;
}

function normalizeImageAesKey(value) {
  const text = String(value || '').trim();
  return /^[A-Za-z0-9]{16}$|^[A-Za-z0-9]{32}$/.test(text) ? text : null;
}

function loadImgKeyFromFile(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;

  const raw = fs.readFileSync(filePath, 'utf8').trim();
  const direct = normalizeImgKeyHex(raw);
  if (direct) return direct;

  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!data || typeof data !== 'object') return null;

  const candidates = [
    data.img_key,
    data.image_key,
    data._img_key,
    data._img_key_hex,
    data.imgKey,
    data.imageKey,
  ];

  for (const value of candidates) {
    const hex = normalizeImgKeyHex(value);
    if (hex) return hex;
  }

  return null;
}

function loadImageAesKeyFromFile(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;

  const raw = fs.readFileSync(filePath, 'utf8').trim();
  const direct = normalizeImageAesKey(raw);
  if (direct) return direct;

  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!data || typeof data !== 'object') return null;

  const candidates = [
    data.image_aes_key,
    data.img_aes_key,
    data.imageAesKey,
    data.imgAesKey,
    data.image_key,
    data.img_key,
  ];

  for (const value of candidates) {
    const key = normalizeImageAesKey(value);
    if (key) return key;
  }

  return null;
}

function loadKeysFromFile(keysPath, dbFiles, saltToDbs) {
  const raw = fs.readFileSync(keysPath, 'utf8');
  const data = JSON.parse(raw);
  const keyMap = {};

  if (data.enc_key && typeof data.enc_key === 'string') {
    const hex = data.enc_key.replace(/^x'|'/g, '');
    for (const item of dbFiles) {
      if (verifyEncKey(Buffer.from(hex.slice(0, 64), 'hex'), item.page1)) {
        keyMap[item.salt] = hex.slice(0, 64);
      } else {
        deriveKeysFromPassphrase(
          Buffer.from(hex.slice(0, 64), 'hex'),
          [item],
          saltToDbs,
          keyMap,
          new Set([item.salt]),
          () => {},
          'import'
        );
      }
    }
    return keyMap;
  }

  for (const item of dbFiles) {
    const rel = item.rel.replace(/\\/g, '/');
    const info = data[rel] || data[item.rel];
    if (info?.enc_key) {
      keyMap[item.salt] = info.enc_key;
      continue;
    }
    if (typeof data === 'object') {
      for (const val of Object.values(data)) {
        if (val && typeof val === 'object' && val.enc_key && val.salt === item.salt) {
          keyMap[item.salt] = val.enc_key;
        }
      }
    }
  }

  if (Object.keys(keyMap).length === 0 && data.key) {
    const hex = String(data.key).replace(/[^0-9a-fA-F]/g, '').slice(0, 64);
    for (const item of dbFiles) {
      if (verifyEncKey(Buffer.from(hex, 'hex'), item.page1)) {
        keyMap[item.salt] = hex;
      }
    }
  }

  return keyMap;
}

function buildKeysJsonFromKeyMap(dbFiles, keyMap, dbDir) {
  const result = { _db_dir: dbDir.replace(/\\/g, '/') };
  for (const item of dbFiles) {
    if (keyMap[item.salt]) {
      result[item.rel] = {
        enc_key: keyMap[item.salt],
        salt: item.salt,
        size_mb: Math.round((item.size / 1024 / 1024) * 10) / 10,
      };
    }
  }
  return result;
}

function tryImportKeysFile({ keysPath, dbFiles, saltToDbs, log }) {
  if (!keysPath || !fs.existsSync(keysPath)) {
    return null;
  }

  log?.(`正在从密钥文件导入: ${keysPath}`);
  const keyMap = loadKeysFromFile(keysPath, dbFiles, saltToDbs);
  if (Object.keys(keyMap).length === 0) {
    log?.('密钥文件未能匹配任何数据库');
    return null;
  }

  log?.(`密钥文件导入成功: ${Object.keys(keyMap).length}/${Object.keys(saltToDbs).length}`);
  return keyMap;
}

function getDefaultKeysPath(wxDir) {
  if (!wxDir) return null;
  const candidates = [
    path.join(wxDir, 'all_keys.json'),
    path.join(wxDir, 'keys.json'),
    path.join(wxDir, '.wexin_keys.json'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

module.exports = {
  loadKeysFromFile,
  loadImgKeyFromFile,
  loadImageAesKeyFromFile,
  buildKeysJsonFromKeyMap,
  tryImportKeysFile,
  getDefaultKeysPath,
};
