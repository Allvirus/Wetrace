const crypto = require('crypto');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const IMAGE_SIGNATURES = [
  { ext: 'jpg', bytes: [0xff, 0xd8, 0xff] },
  { ext: 'png', bytes: [0x89, 0x50, 0x4e, 0x47] },
  { ext: 'gif', bytes: [0x47, 0x49, 0x46, 0x38] },
  { ext: 'tiff', bytes: [0x49, 0x49, 0x2a, 0x00] },
  { ext: 'webp', bytes: [0x52, 0x49, 0x46, 0x46], offset: 0, extra: { offset: 8, bytes: [0x57, 0x45, 0x42, 0x50] } },
  { ext: 'bmp', bytes: [0x42, 0x4d] },
  { ext: 'wxgf', bytes: [0x77, 0x78, 0x67, 0x66] },
];

const IMAGE_FILE_RE = /\.(dat|jpg|jpeg|png|gif|webp|bmp)$/i;
const MAX_SCAN_DEPTH = 6;
const MAX_FILE_SIZE = 64 * 1024 * 1024;
const FFMPEG_MAX_BUFFER = 64 * 1024 * 1024;
const BMP_DIB_HEADER_SIZES = new Set([12, 16, 40, 52, 56, 64, 108, 124]);
const V4_HEADER_V1 = Buffer.from([0x07, 0x08, 0x56, 0x31]);
const V4_HEADER_V2 = Buffer.from([0x07, 0x08, 0x56, 0x32]);
const V4_FIXED_AES_KEY_V1 = Buffer.from('cfcd208495d565ef', 'utf8');
const V4_DEFAULT_XOR_KEY = 0x37;
const HEVC_START_CODE_4 = Buffer.from([0x00, 0x00, 0x00, 0x01]);
const HEVC_START_CODE_3 = Buffer.from([0x00, 0x00, 0x01]);
const V4_KEY_PATTERN = Buffer.from([
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x20, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x2f, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
]);
const ZERO_BLOCK_16 = Buffer.alloc(16, 0);
const IMG_KEY_CACHE_FILE = '.wexin_imgkey';
const IMG_KEY_JSON_CANDIDATES = ['all_keys.json', 'keys.json', '.wexin_keys.json'];
const ASCII_KEY16_RE = /(^|[^A-Za-z0-9])([A-Za-z0-9]{16})(?=$|[^A-Za-z0-9])/g;
const ASCII_KEY32_RE = /(^|[^A-Za-z0-9])([A-Za-z0-9]{32})(?=$|[^A-Za-z0-9])/g;
const RW_PROTECT_FLAGS = new Set([0x04, 0x08, 0x40, 0x80]);

function normalizeToken(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '');
}

function addHexTokens(set, value) {
  const text = normalizeToken(value);
  if (!text) return;
  const matches = text.match(/[a-f0-9]{8,}/g) || [];
  for (const match of matches) {
    set.add(match);
  }
}

function extractUrlName(url) {
  const text = String(url || '').trim();
  if (!text) return '';
  try {
    const parsed = new URL(text);
    return path.basename(parsed.pathname || '');
  } catch {
    const clean = text.split('?')[0].split('#')[0];
    return path.basename(clean);
  }
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function safeSegment(value, fallback) {
  const base = String(value || fallback || 'unknown')
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
    .replace(/\s+/g, '_')
    .trim()
    .slice(0, 80);
  return base || fallback || 'unknown';
}

function emitImageDebug(decodeState, message, extra = null) {
  decodeState?.logger?.({
    phase: 'exporting',
    subphase: 'image-debug',
    message,
    imageDebug: extra,
  });
}

function isV4DatBuffer(buffer) {
  return (
    buffer &&
    buffer.length >= 15 &&
    (buffer.subarray(0, 4).equals(V4_HEADER_V1) || buffer.subarray(0, 4).equals(V4_HEADER_V2))
  );
}

function getV4AesKey(buffer, decodeState) {
  if (buffer.subarray(0, 4).equals(V4_HEADER_V1)) {
    return V4_FIXED_AES_KEY_V1;
  }
  return deriveV4AesKeyBytes(decodeState?.imgKeyText || '');
}

function deriveV4AesKeyBytes(keyText) {
  const text = String(keyText || '').trim();
  if (!/^[A-Za-z0-9]{16}$|^[A-Za-z0-9]{32}$/.test(text)) {
    return null;
  }
  return Buffer.from(text.slice(0, 16), 'ascii');
}

function alignedAesBlockSize(aesSize) {
  if (!Number.isFinite(aesSize) || aesSize <= 0) return 0;
  return aesSize % 16 === 0 ? aesSize + 16 : aesSize + (16 - (aesSize % 16));
}

function decryptAesEcbBlocks(buffer, key) {
  const decipher = crypto.createDecipheriv('aes-128-ecb', key, null);
  decipher.setAutoPadding(false);
  return Buffer.concat([decipher.update(buffer), decipher.final()]);
}

function unpadPkcs7(buffer) {
  if (!buffer?.length) return null;
  const pad = buffer[buffer.length - 1];
  if (pad < 1 || pad > 16 || pad > buffer.length) return null;
  for (let i = buffer.length - pad; i < buffer.length; i += 1) {
    if (buffer[i] !== pad) return null;
  }
  return buffer.subarray(0, buffer.length - pad);
}

function detectImageMagicPrefix(buffer) {
  if (!buffer || buffer.length < 2) return null;
  for (const signature of IMAGE_SIGNATURES) {
    const start = signature.offset || 0;
    if (buffer.length < start + signature.bytes.length) continue;
    let matched = true;
    for (let i = 0; i < signature.bytes.length; i += 1) {
      if (buffer[start + i] !== signature.bytes[i]) {
        matched = false;
        break;
      }
    }
    if (!matched) continue;
    if (signature.extra) {
      const extraOffset = signature.extra.offset || 0;
      if (buffer.length < extraOffset + signature.extra.bytes.length) continue;
      for (let i = 0; i < signature.extra.bytes.length; i += 1) {
        if (buffer[extraOffset + i] !== signature.extra.bytes[i]) {
          matched = false;
          break;
        }
      }
      if (!matched) continue;
    }
    return signature.ext;
  }
  return null;
}

function isReliableBlockProbeExt(ext) {
  return ext === 'jpg' || ext === 'png' || ext === 'gif' || ext === 'webp' || ext === 'wxgf';
}

function readImgKeyCache(accountDir) {
  if (!accountDir) return null;
  const cachePath = path.join(accountDir, IMG_KEY_CACHE_FILE);
  try {
    if (!fs.existsSync(cachePath)) return null;
    const text = fs.readFileSync(cachePath, 'utf8').trim();
    return /^[A-Za-z0-9]{16}$|^[A-Za-z0-9]{32}$/.test(text) ? text : null;
  } catch {
    return null;
  }
}

function readImgKeyFromKnownFiles(accountDir, keysPath) {
  const { loadImageAesKeyFromFile } = require('./keyImport');
  const candidates = [];
  if (keysPath) candidates.push(keysPath);
  if (accountDir) {
    candidates.push(path.join(accountDir, IMG_KEY_CACHE_FILE));
    for (const name of IMG_KEY_JSON_CANDIDATES) {
      candidates.push(path.join(accountDir, name));
    }
  }

  for (const filePath of candidates) {
    try {
      const keyText = loadImageAesKeyFromFile(filePath);
      if (keyText) return keyText;
    } catch {
      // Ignore unreadable files.
    }
  }

  return null;
}

function writeImgKeyCache(accountDir, keyText) {
  if (!accountDir || !/^[A-Za-z0-9]{16}$|^[A-Za-z0-9]{32}$/.test(String(keyText || ''))) return;
  const cachePath = path.join(accountDir, IMG_KEY_CACHE_FILE);
  try {
    fs.writeFileSync(cachePath, String(keyText), 'utf8');
  } catch {
    // Ignore cache write failures.
  }
}

function clearImgKeyCache(accountDir) {
  if (!accountDir) return;
  const cachePath = path.join(accountDir, IMG_KEY_CACHE_FILE);
  try {
    if (fs.existsSync(cachePath)) {
      fs.unlinkSync(cachePath);
    }
  } catch {
    // Ignore cache delete failures.
  }
}

function validateImageKeyForV4Dat(keyText, datBuffer) {
  const keyBuffer = deriveV4AesKeyBytes(keyText);
  if (!keyBuffer || !isV4DatBuffer(datBuffer)) return false;
  try {
    const encrypted = datBuffer.subarray(15, 31);
    if (encrypted.length !== 16) return false;
    const decrypted = decryptAesEcbBlocks(encrypted, keyBuffer);
    return isReliableBlockProbeExt(detectImageMagicPrefix(decrypted));
  } catch {
    return false;
  }
}

function tryImageKeyOnCiphertextBlock(keyText, ciphertext) {
  const keyBuffer = deriveV4AesKeyBytes(keyText);
  if (!keyBuffer || !ciphertext || ciphertext.length !== 16) return null;
  try {
    const decrypted = decryptAesEcbBlocks(ciphertext, keyBuffer);
    const ext = detectImageMagicPrefix(decrypted);
    return isReliableBlockProbeExt(ext) ? ext : null;
  } catch {
    return null;
  }
}

function deriveV4XorKeyFromThumb(filePath) {
  try {
    const buffer = fs.readFileSync(filePath);
    if (!isV4DatBuffer(buffer)) return null;
    const xorLen = buffer.readUInt32LE(10);
    const fileData = buffer.subarray(15);
    if (xorLen < 2 || xorLen > fileData.length) return null;
    const xorData = fileData.subarray(fileData.length - xorLen);
    const key1 = xorData[xorData.length - 2] ^ 0xff;
    const key2 = xorData[xorData.length - 1] ^ 0xd9;
    return key1 === key2 ? key1 : null;
  } catch {
    return null;
  }
}

function scanV4XorKey(accountDir) {
  const attachRoot = accountDir ? path.join(accountDir, 'msg', 'attach') : null;
  if (!attachRoot || !fs.existsSync(attachRoot)) return null;

  const counts = new Map();
  const stack = [attachRoot];
  while (stack.length > 0) {
    const current = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }
      if (!entry.isFile() || !entry.name.endsWith('_t.dat')) continue;
      const key = deriveV4XorKeyFromThumb(fullPath);
      if (key == null) continue;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  }

  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  return ranked[0]?.[0] ?? null;
}

function collectRecentV4ThumbSamples(accountDir, limit = 8) {
  const attachRoot = accountDir ? path.join(accountDir, 'msg', 'attach') : null;
  if (!attachRoot || !fs.existsSync(attachRoot)) return [];

  const files = [];
  const stack = [attachRoot];
  while (stack.length > 0) {
    const current = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }
      if (!entry.isFile() || !entry.name.endsWith('_t.dat')) continue;
      try {
        const stat = fs.statSync(fullPath);
        files.push({ path: fullPath, mtimeMs: stat.mtimeMs || 0 });
      } catch {
        // Ignore inaccessible files.
      }
    }
  }

  return files
    .sort((a, b) => b.mtimeMs - a.mtimeMs)
    .slice(0, Math.max(limit * 3, limit))
    .map((entry) => {
      try {
        const buffer = fs.readFileSync(entry.path);
        if (!isV4DatBuffer(buffer)) return null;
        const ciphertext = buffer.subarray(15, 31);
        if (ciphertext.length !== 16) return null;
        return {
          path: entry.path,
          ciphertext: Buffer.from(ciphertext),
          mtimeMs: entry.mtimeMs,
        };
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .slice(0, limit);
}

function normalizeWxidAccountId(accountId) {
  const text = String(accountId || '').trim();
  if (!text) return '';
  if (/^wxid_/i.test(text)) {
    const match = text.match(/^(wxid_[^_]+)/i);
    return match ? match[1] : text;
  }
  const match = text.match(/^(.+)_([a-zA-Z0-9]{4})$/);
  return match ? match[1] : text;
}

function collectWxidCandidates(accountDir) {
  const raw = path.basename(String(accountDir || '').replace(/[\\/]+$/, ''));
  if (!raw) return [];
  const candidates = [raw];
  const normalized = normalizeWxidAccountId(raw);
  if (normalized && normalized !== raw) {
    candidates.push(normalized);
  }
  return candidates;
}

function extractWxidSuffix(accountDir) {
  const raw = path.basename(String(accountDir || '').replace(/[\\/]+$/, ''));
  const match = raw.match(/^.+_([0-9a-fA-F]{4})$/);
  return match ? match[1].toLowerCase() : null;
}

function deriveImageKeyFromWxidSuffix(accountDir, xorKey, samples, decodeState) {
  const suffixHex = extractWxidSuffix(accountDir);
  const wxids = collectWxidCandidates(accountDir);
  const templatesHex = (samples || []).map((item) => item.ciphertext.toString('hex'));
  if (!suffixHex || !Number.isInteger(xorKey) || xorKey < 0 || xorKey > 255 || wxids.length === 0 || templatesHex.length === 0) {
    return null;
  }

  emitImageDebug(decodeState, `Image key derive: start xor=${xorKey} suffix=${suffixHex} templates=${templatesHex.length}`, {
    xorKey,
    suffixHex,
    wxids,
    templatePaths: (samples || []).map((item) => item.path),
  });

  try {
    const cliPath = path.join(__dirname, 'imageKeyDeriveCli.js');
    const stdout = execFileSync(process.execPath, [cliPath], {
      input: JSON.stringify({ xorKey, suffixHex, wxids, templatesHex }),
      encoding: 'utf8',
      timeout: 120000,
      maxBuffer: 1024 * 1024,
    });
    const result = JSON.parse(String(stdout || '{}'));
    if (result?.found && result?.aesText) {
      emitImageDebug(
        decodeState,
        `Image key derive: success uin=${result.uin} wxid=${result.wxid}`,
        { xorKey, uin: result.uin, wxid: result.wxid, keyText: result.aesText }
      );
      return String(result.aesText);
    }
  } catch {
    emitImageDebug(decodeState, 'Image key derive: child process failed');
    return null;
  }

  emitImageDebug(decodeState, 'Image key derive: no valid key found');
  return null;
}

function isRwProtect(protect) {
  return RW_PROTECT_FLAGS.has(Number(protect) || 0);
}

function searchAsciiImageKeyCandidates(text, sampleBuffer, triedKeys, stats) {
  const regexes = [
    { pattern: new RegExp(ASCII_KEY32_RE.source, 'g'), width: 32 },
    { pattern: new RegExp(ASCII_KEY16_RE.source, 'g'), width: 16 },
  ];

  for (const { pattern, width } of regexes) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const keyText = match[2];
      if (!keyText || triedKeys.has(keyText)) continue;
      triedKeys.add(keyText);
      if (width === 32) stats.candidates32 += 1;
      else stats.candidates16 += 1;
      if (validateImageKeyForV4Dat(keyText, sampleBuffer)) {
        return { keyText, width };
      }
    }
  }

  return null;
}

function searchAsciiImageKeyCandidatesForSamples(text, samples, triedKeys, stats) {
  const regexes = [
    { pattern: new RegExp(ASCII_KEY32_RE.source, 'g'), width: 32 },
    { pattern: new RegExp(ASCII_KEY16_RE.source, 'g'), width: 16 },
  ];

  for (const { pattern, width } of regexes) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const keyText = match[2];
      if (!keyText || triedKeys.has(keyText)) continue;
      triedKeys.add(keyText);
      if (width === 32) stats.candidates32 += 1;
      else stats.candidates16 += 1;
      for (const sample of samples) {
        const blockExt = tryImageKeyOnCiphertextBlock(keyText, sample.ciphertext);
        if (blockExt) {
          return { keyText, width, samplePath: sample.path, blockExt };
        }
      }
    }
  }

  return null;
}

function extractImageKeyFromWeixinRwMemory(samples, decodeState) {
  if (!samples || samples.length === 0) return null;
  try {
    const { getWeChatProcesses, openProcess, closeProcess, enumRegions, readProcessMemory } = require('./winMemory');
    const processes = getWeChatProcesses().filter((proc) => proc.imageName.toLowerCase() === 'weixin.exe');
    const triedKeys = new Set();
    emitImageDebug(decodeState, `Image key RW scan: processes=${processes.length} samples=${samples.length}`, {
      processes: processes.map((proc) => ({ pid: proc.pid, imageName: proc.imageName, memKb: proc.memKb })),
      samplePaths: samples.map((item) => item.path),
    });

    for (const proc of processes) {
      const handle = openProcess(proc.pid);
      if (!handle) continue;
      try {
        const regions = enumRegions(handle).filter((region) => isRwProtect(region.protect));
        const chunkSize = 256 * 1024;
        const overlapBytes = 31;
        let carry = Buffer.alloc(0);
        const stats = { candidates32: 0, candidates16: 0 };
        emitImageDebug(decodeState, `Image key RW scan: pid=${proc.pid} rwRegions=${regions.length}`, {
          pid: proc.pid,
          imageName: proc.imageName,
          rwRegionCount: regions.length,
        });

        for (const region of regions) {
          for (let offset = 0; offset < region.size; offset += chunkSize) {
            const readSize = Math.min(chunkSize, region.size - offset);
            const data = readProcessMemory(handle, Number(region.base) + offset, readSize);
            if (!data || data.length < 16) {
              carry = Buffer.alloc(0);
              continue;
            }
            const scanBuffer = carry.length > 0 ? Buffer.concat([carry, data]) : data;
            const hit = searchAsciiImageKeyCandidatesForSamples(
              scanBuffer.toString('latin1'),
              samples,
              triedKeys,
              stats
            );
            if (hit?.keyText) {
              emitImageDebug(
                decodeState,
                `Image key RW scan: success pid=${proc.pid} keyWidth=${hit.width} ext=${hit.blockExt}`,
                {
                  pid: proc.pid,
                  imageName: proc.imageName,
                  keyWidth: hit.width,
                  keyText: hit.keyText,
                  samplePath: hit.samplePath,
                  blockExt: hit.blockExt,
                  candidates32: stats.candidates32,
                  candidates16: stats.candidates16,
                }
              );
              return hit.keyText;
            }
            carry = scanBuffer.subarray(Math.max(0, scanBuffer.length - overlapBytes));
          }
          carry = Buffer.alloc(0);
        }
      } finally {
        closeProcess(handle);
      }
    }
  } catch {
    emitImageDebug(decodeState, 'Image key RW scan: unexpected exception');
    return null;
  }

  emitImageDebug(decodeState, 'Image key RW scan: no valid key found');
  return null;
}

function extractImageKeyFromWeChatMemory(sampleBuffer, decodeState) {
  try {
    const recentSamples = collectRecentV4ThumbSamples(decodeState?.accountDir, 8);
    const derivedKey = deriveImageKeyFromWxidSuffix(decodeState?.accountDir, decodeState?.v4XorKey ?? V4_DEFAULT_XOR_KEY, recentSamples, decodeState);
    if (derivedKey) {
      return derivedKey;
    }

    const { getWeChatProcesses, openProcess, closeProcess, enumRegions, readProcessMemory } = require('./winMemory');
    const rwKey = extractImageKeyFromWeixinRwMemory(recentSamples, decodeState);
    if (rwKey) {
      return rwKey;
    }
    const processes = getWeChatProcesses().sort((a, b) => {
      const aMain = a.imageName.toLowerCase() === 'weixin.exe' ? 1 : 0;
      const bMain = b.imageName.toLowerCase() === 'weixin.exe' ? 1 : 0;
      if (aMain !== bMain) return bMain - aMain;
      return b.memKb - a.memKb;
    });
    const triedKeys = new Set();
    emitImageDebug(
      decodeState,
      `Image key memory scan: processes=${processes.length}`,
      { processes: processes.map((proc) => ({ pid: proc.pid, imageName: proc.imageName, memKb: proc.memKb })) }
    );

    for (const proc of processes) {
      const handle = openProcess(proc.pid);
      if (!handle) {
        emitImageDebug(
          decodeState,
          `Image key memory scan: open process failed pid=${proc.pid} name=${proc.imageName}`,
          { pid: proc.pid, imageName: proc.imageName, memKb: proc.memKb }
        );
        continue;
      }

      try {
        const regions = enumRegions(handle);
        const chunkSize = 256 * 1024;
        const overlapBytes = 31;
        let reads = 0;
        let carry = Buffer.alloc(0);
        const stats = { candidates32: 0, candidates16: 0 };
        const maxReads = proc.imageName.toLowerCase() === 'weixin.exe' ? 4096 : 2048;
        emitImageDebug(
          decodeState,
          `Image key memory scan: pid=${proc.pid} name=${proc.imageName} regions=${regions.length} maxReads=${maxReads}`,
          { pid: proc.pid, imageName: proc.imageName, memKb: proc.memKb, regionCount: regions.length, maxReads }
        );

        for (let regionIndex = 0; regionIndex < regions.length; regionIndex += 1) {
          const region = regions[regionIndex];
          for (let offset = 0; offset < region.size; offset += chunkSize) {
            const readSize = Math.min(chunkSize, region.size - offset);
            const data = readProcessMemory(handle, Number(region.base) + offset, readSize);
            reads += 1;
            if (!data || data.length < 16) {
              carry = Buffer.alloc(0);
              if (reads >= maxReads) break;
              continue;
            }

            const scanBuffer = carry.length > 0 ? Buffer.concat([carry, data]) : data;
            const hit = searchAsciiImageKeyCandidates(scanBuffer.toString('latin1'), sampleBuffer, triedKeys, stats);
            if (hit?.keyText) {
              emitImageDebug(
                decodeState,
                `Image key memory scan: success pid=${proc.pid} name=${proc.imageName} keyWidth=${hit.width}`,
                {
                  pid: proc.pid,
                  imageName: proc.imageName,
                  keyWidth: hit.width,
                  keyText: hit.keyText,
                  candidates32: stats.candidates32,
                  candidates16: stats.candidates16,
                }
              );
              return hit.keyText;
            }

            carry = scanBuffer.subarray(Math.max(0, scanBuffer.length - overlapBytes));
            if (reads >= maxReads) break;
          }
          carry = Buffer.alloc(0);
          if (reads >= maxReads) break;
        }
      } finally {
        closeProcess(handle);
      }
    }
  } catch {
    emitImageDebug(decodeState, 'Image key memory scan: unexpected exception');
    return null;
  }

  emitImageDebug(decodeState, 'Image key memory scan: no valid key found');
  return null;
}

function decodeV4DatBufferWithKeyText(buffer, keyText, xorKey) {
  const aesKey = buffer.subarray(0, 4).equals(V4_HEADER_V1) ? V4_FIXED_AES_KEY_V1 : deriveV4AesKeyBytes(keyText);
  if (!aesKey || !isV4DatBuffer(buffer)) return null;

  const aesLen = buffer.readUInt32LE(6);
  const xorLen = buffer.readUInt32LE(10);
  const fileData = buffer.subarray(15);
  if (fileData.length === 0) return null;

  let aesLen0 = alignedAesBlockSize(aesLen);
  if (aesLen0 > fileData.length) aesLen0 = fileData.length;
  if (aesLen0 % 16 !== 0) return null;

  let aesDecrypted;
  try {
    aesDecrypted = decryptAesEcbBlocks(fileData.subarray(0, aesLen0), aesKey);
  } catch {
    return null;
  }

  const aesUnpadded = unpadPkcs7(aesDecrypted);
  if (!aesUnpadded) return null;

  const out = [aesUnpadded];
  const middleStart = aesLen0;
  const middleEnd = fileData.length - xorLen;
  if (middleStart < middleEnd) {
    out.push(fileData.subarray(middleStart, middleEnd));
  }

  if (xorLen > 0 && middleEnd >= 0 && middleEnd < fileData.length) {
    const tail = Buffer.from(fileData.subarray(middleEnd));
    for (let i = 0; i < tail.length; i += 1) {
      tail[i] ^= xorKey;
    }
    out.push(tail);
  }

  const decoded = Buffer.concat(out);
  const ext = detectImageFormat(decoded);
  if (!ext) return null;
  return {
    buffer: decoded,
    ext,
    sourceKind: 'decoded-dat-v4',
    xorKey,
  };
}

function buildImageKeyMappingDebug(msg, candidate, imageCtx) {
  const result = {
    aesKey: msg.extra?.aesKey || null,
    thumbAesKey: msg.extra?.thumbAesKey || null,
    originSourceMd5: msg.extra?.originSourceMd5 || null,
  };
  if (!candidate?.path) return result;

  result.sourcePath = candidate.path;
  try {
    const buffer = fs.readFileSync(candidate.path);
    result.headerHex = buffer.subarray(0, 16).toString('hex');
    result.isV4 = isV4DatBuffer(buffer);
    if (result.isV4) {
      result.aesLen = buffer.readUInt32LE(6);
      result.xorLen = buffer.readUInt32LE(10);
    }
    if (msg.extra?.aesKey && result.isV4) {
      result.blockProbeExt = tryImageKeyOnCiphertextBlock(msg.extra.aesKey, buffer.subarray(15, 31));
      const decoded = decodeV4DatBufferWithKeyText(
        buffer,
        msg.extra.aesKey,
        imageCtx?.decodeState?.v4XorKey ?? V4_DEFAULT_XOR_KEY
      );
      result.fullDecodeExt = decoded?.ext || null;
    }
  } catch {
    // Ignore probe failures.
  }
  return result;
}

function resolveV4DecodeState(decodeState, sampleBuffer) {
  if (!decodeState) return null;

  if (decodeState.v4XorKey == null) {
    decodeState.v4XorKey = scanV4XorKey(decodeState.accountDir) ?? V4_DEFAULT_XOR_KEY;
    emitImageDebug(decodeState, `Image decode: v4 xor key=${decodeState.v4XorKey}`);
  }

  if (sampleBuffer.subarray(0, 4).equals(V4_HEADER_V2) && !decodeState.imgKeyText) {
    if (!decodeState.imgKeyTried) {
      decodeState.imgKeyTried = true;
      decodeState.imgKeyText =
        readImgKeyFromKnownFiles(decodeState.accountDir, decodeState.keysPath) ||
        readImgKeyCache(decodeState.accountDir);
      if (decodeState.imgKeyText) {
        if (validateImageKeyForV4Dat(decodeState.imgKeyText, sampleBuffer)) {
          emitImageDebug(decodeState, 'Image decode: img key loaded from file/cache');
        } else {
          emitImageDebug(decodeState, 'Image decode: img key loaded from file/cache, probe skipped for current sample');
        }
      } else {
        emitImageDebug(decodeState, 'Image decode: img key not found in file/cache, scanning memory');
      }
      if (!decodeState.imgKeyText) {
        decodeState.imgKeyText = extractImageKeyFromWeChatMemory(sampleBuffer, decodeState);
        if (decodeState.imgKeyText) {
          writeImgKeyCache(decodeState.accountDir, decodeState.imgKeyText);
          emitImageDebug(decodeState, 'Image decode: img key cached to account dir');
        }
      }
    }
  }

  return decodeState;
}

function isValidBmpBuffer(buffer) {
  if (!buffer || buffer.length < 26) return false;
  if (buffer[0] !== 0x42 || buffer[1] !== 0x4d) return false;

  const fileSize = buffer.readUInt32LE(2);
  const pixelOffset = buffer.readUInt32LE(10);
  const dibSize = buffer.readUInt32LE(14);

  if (!BMP_DIB_HEADER_SIZES.has(dibSize)) return false;
  if (pixelOffset < 14 + dibSize || pixelOffset >= buffer.length) return false;
  if (fileSize !== 0 && Math.abs(fileSize - buffer.length) > 16) return false;

  return true;
}

function isSignatureBufferValid(signature, buffer) {
  if (!signature || !buffer) return false;
  if (signature.ext === 'bmp') {
    return isValidBmpBuffer(buffer);
  }
  return true;
}

function detectImageFormat(buffer) {
  if (!buffer || buffer.length < 4) return null;
  for (const signature of IMAGE_SIGNATURES) {
    const start = signature.offset || 0;
    if (buffer.length < start + signature.bytes.length) continue;
    let matched = true;
    for (let i = 0; i < signature.bytes.length; i += 1) {
      if (buffer[start + i] !== signature.bytes[i]) {
        matched = false;
        break;
      }
    }
    if (!matched) continue;
    if (signature.extra) {
      const extraOffset = signature.extra.offset || 0;
      if (buffer.length < extraOffset + signature.extra.bytes.length) continue;
      for (let i = 0; i < signature.extra.bytes.length; i += 1) {
        if (buffer[extraOffset + i] !== signature.extra.bytes[i]) {
          matched = false;
          break;
        }
      }
      if (!matched) continue;
    }
    if (!isSignatureBufferValid(signature, buffer)) continue;
    return signature.ext;
  }
  return null;
}

function extractHevcBitstreamFromWxgf(buffer) {
  if (!buffer || buffer.length < 8 || buffer.subarray(0, 4).toString('ascii') !== 'wxgf') {
    return null;
  }

  let start = buffer.indexOf(HEVC_START_CODE_4);
  if (start < 0) {
    start = buffer.indexOf(HEVC_START_CODE_3);
  }
  if (start < 0) {
    return null;
  }
  return buffer.subarray(start);
}

function runBinaryWithInput(command, args, input) {
  try {
    return execFileSync(command, args, {
      input,
      maxBuffer: FFMPEG_MAX_BUFFER,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });
  } catch {
    return null;
  }
}

function countHevcFrames(hevc) {
  const output = runBinaryWithInput(
    'ffprobe',
    [
      '-v', 'error',
      '-count_frames',
      '-select_streams', 'v:0',
      '-show_entries', 'stream=nb_read_frames',
      '-of', 'default=nw=1:nk=1',
      '-f', 'hevc',
      '-i', 'pipe:0',
    ],
    hevc
  );
  if (!output?.length) return null;

  const text = output.toString('utf8').trim();
  if (!text) return null;
  const lines = text.split(/\r?\n/).filter(Boolean);
  const value = Number(lines[lines.length - 1]);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function decodeWxgfBuffer(buffer) {
  const hevc = extractHevcBitstreamFromWxgf(buffer);
  if (!hevc?.length) return null;

  const frameCount = countHevcFrames(hevc);
  if (frameCount && frameCount > 1) {
    const gif = runBinaryWithInput(
      'ffmpeg',
      [
        '-hide_banner',
        '-loglevel', 'error',
        '-f', 'hevc',
        '-i', 'pipe:0',
        '-filter_complex', '[0:v]split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse',
        '-loop', '0',
        '-f', 'gif',
        '-',
      ],
      hevc
    );
    if (gif?.length) {
      return { buffer: gif, ext: 'gif', sourceKind: 'decoded-wxgf' };
    }
  }

  const png = runBinaryWithInput(
    'ffmpeg',
    [
      '-hide_banner',
      '-loglevel', 'error',
      '-f', 'hevc',
      '-i', 'pipe:0',
      '-frames:v', '1',
      '-f', 'image2pipe',
      '-vcodec', 'png',
      '-',
    ],
    hevc
  );
  if (!png?.length) return null;

  return { buffer: png, ext: 'png', sourceKind: 'decoded-wxgf' };
}

function decodeDatBuffer(buffer) {
  if (!buffer || buffer.length < 4) return null;
  if (isV4DatBuffer(buffer)) return null;

  for (const signature of IMAGE_SIGNATURES) {
    const key = buffer[0] ^ signature.bytes[0];
    let matched = true;

    for (let i = 0; i < signature.bytes.length; i += 1) {
      if ((buffer[i] ^ key) !== signature.bytes[i]) {
        matched = false;
        break;
      }
    }
    if (!matched) continue;

    if (signature.extra) {
      const extraOffset = signature.extra.offset || 0;
      if (buffer.length < extraOffset + signature.extra.bytes.length) continue;
      for (let i = 0; i < signature.extra.bytes.length; i += 1) {
        if ((buffer[extraOffset + i] ^ key) !== signature.extra.bytes[i]) {
          matched = false;
          break;
        }
      }
      if (!matched) continue;
    }

    const decoded = Buffer.allocUnsafe(buffer.length);
    for (let i = 0; i < buffer.length; i += 1) {
      decoded[i] = buffer[i] ^ key;
    }
    if (!isSignatureBufferValid(signature, decoded)) continue;
    return { buffer: decoded, ext: signature.ext, xorKey: key };
  }

  return null;
}

function decodeV4DatBuffer(buffer, decodeState) {
  if (!isV4DatBuffer(buffer)) return null;

  const state = resolveV4DecodeState(decodeState, buffer);
  return decodeV4DatBufferWithKeyText(buffer, state?.imgKeyText || '', state?.v4XorKey ?? V4_DEFAULT_XOR_KEY);
}

function loadImageBuffer(filePath, decodeState = null, options = {}) {
  const { decodeWxgf = true } = options;
  const buffer = fs.readFileSync(filePath);
  const directFormat = detectImageFormat(buffer);
  if (directFormat) {
    if (directFormat === 'wxgf' && decodeWxgf) {
      const decodedWxgf = decodeWxgfBuffer(buffer);
      if (decodedWxgf) {
        return decodedWxgf;
      }
    }
    return { buffer, ext: directFormat, sourceKind: 'file' };
  }

  const decodedV4 = decodeV4DatBuffer(buffer, decodeState);
  if (decodedV4) {
    if (decodedV4.ext === 'wxgf' && decodeWxgf) {
      const decodedWxgf = decodeWxgfBuffer(decodedV4.buffer);
      if (decodedWxgf) {
        return {
          buffer: decodedWxgf.buffer,
          ext: decodedWxgf.ext,
          sourceKind: `${decodedV4.sourceKind || 'decoded-dat-v4'}-wxgf`,
        };
      }
    }
    return decodedV4;
  }

  const decoded = decodeDatBuffer(buffer);
  if (decoded) {
    if (decoded.ext === 'wxgf' && decodeWxgf) {
      const decodedWxgf = decodeWxgfBuffer(decoded.buffer);
      if (decodedWxgf) {
        return {
          buffer: decodedWxgf.buffer,
          ext: decodedWxgf.ext,
          sourceKind: 'decoded-dat-wxgf',
        };
      }
    }
    return {
      buffer: decoded.buffer,
      ext: decoded.ext,
      sourceKind: 'decoded-dat',
      xorKey: decoded.xorKey,
    };
  }

  return null;
}

function ensureLoadedImage(entry, decodeState = null, options = {}) {
  const cacheKey = options.decodeWxgf === false ? 'loadedImageNoWxgf' : 'loadedImage';
  if (entry[cacheKey] !== undefined) {
    return entry[cacheKey];
  }

  try {
    entry[cacheKey] = loadImageBuffer(entry.path, decodeState, options) || null;
  } catch {
    entry[cacheKey] = null;
  }

  return entry[cacheKey];
}

function computeBufferMd5(buffer) {
  return crypto.createHash('md5').update(buffer).digest('hex');
}

function collectMessageImageTokens(msg) {
  const tokens = new Set();
  const values = [
    msg.extra?.md5,
    msg.extra?.newMd5,
    msg.extra?.thumbMd5,
    msg.extra?.urlName,
    extractUrlName(msg.extra?.imageUrl),
    extractUrlName(msg.extra?.bigImgUrl),
    extractUrlName(msg.extra?.midImgUrl),
    extractUrlName(msg.extra?.thumbUrl),
  ];

  for (const value of values) {
    const normalized = normalizeToken(value);
    if (!normalized) continue;
    tokens.add(normalized);

    const noExt = normalized.replace(/\.[^.]+$/, '');
    if (noExt) tokens.add(noExt);
    addHexTokens(tokens, normalized);
    addHexTokens(tokens, noExt);
  }

  return [...tokens].filter(Boolean);
}

function buildHardlinkMap(SQL, decryptedDir) {
  const hardlinkDbPath = path.join(decryptedDir, 'hardlink', 'hardlink.db');
  const hardlinkMap = new Map();
  if (!SQL || !fs.existsSync(hardlinkDbPath)) {
    return hardlinkMap;
  }

  let db = null;
  try {
    db = new SQL.Database(fs.readFileSync(hardlinkDbPath));
    const rows = db.exec(
      'SELECT md5, file_name FROM image_hardlink_info_v4 WHERE md5 IS NOT NULL AND file_name IS NOT NULL'
    );
    const values = rows[0]?.values || [];
    for (const row of values) {
      const md5 = normalizeToken(row[0]);
      const fileName = normalizeToken(row[1]);
      if (!md5 || !fileName) continue;
      if (!hardlinkMap.has(md5)) hardlinkMap.set(md5, new Set());
      hardlinkMap.get(md5).add(fileName);
    }
  } catch {
    return hardlinkMap;
  } finally {
    if (db) db.close();
  }

  return new Map([...hardlinkMap.entries()].map(([key, value]) => [key, [...value]]));
}

function getCandidateRoots(accountDir, decryptedDir) {
  const roots = [
    path.join(accountDir, 'FileStorage'),
    path.join(accountDir, 'FileStorage', 'Image'),
    path.join(accountDir, 'FileStorage', 'Image2'),
    path.join(accountDir, 'Image'),
    path.join(accountDir, 'Image2'),
    path.join(accountDir, 'image'),
    path.join(accountDir, 'image2'),
    path.join(accountDir, 'msg', 'attach'),
    path.join(accountDir, 'Cache'),
    path.join(accountDir, 'cache'),
    path.join(accountDir, 'MsgAttach'),
    path.join(accountDir, 'msgattach'),
    path.join(accountDir, 'Temp'),
    path.join(accountDir, 'temp'),
    path.join(accountDir, 'business', 'favorite'),
    path.join(accountDir, 'business', 'favorite', 'thumb'),
    path.join(accountDir, 'business', 'favorite', 'mid'),
    path.join(accountDir, 'business', 'favorite', 'data'),
    path.join(accountDir, 'business', 'favorite', 'temp'),
    path.join(accountDir, 'business', 'favorite', 'temp', 'NoteCache'),
    path.join(decryptedDir, 'image'),
    path.join(decryptedDir, 'image2'),
  ];

  return [...new Set(roots.map((item) => path.resolve(item)))].filter((item) => {
    try {
      return fs.existsSync(item) && fs.statSync(item).isDirectory();
    } catch {
      return false;
    }
  });
}

function isFavoriteMediaPath(fullPath) {
  const normalized = String(fullPath || '').replace(/\//g, '\\').toLowerCase();
  return (
    normalized.includes('\\business\\favorite\\thumb\\') ||
    normalized.includes('\\business\\favorite\\mid\\') ||
    normalized.includes('\\business\\favorite\\data\\') ||
    normalized.includes('\\business\\favorite\\temp\\notecache\\')
  );
}

function isRecordImagePath(fullPath) {
  const normalized = String(fullPath || '').replace(/\//g, '\\').toLowerCase();
  return normalized.includes('\\msg\\attach\\') && normalized.includes('\\rec\\') && normalized.includes('\\img\\');
}

function isCacheImageTempPath(fullPath) {
  const normalized = String(fullPath || '').replace(/\//g, '\\').toLowerCase();
  return normalized.includes('\\cache\\') && normalized.includes('\\message\\') && normalized.includes('\\imagetemp\\');
}

function shouldIncludeFile(entry, fullPath) {
  return entry.isFile() && (
    IMAGE_FILE_RE.test(entry.name) ||
    isFavoriteMediaPath(fullPath) ||
    isRecordImagePath(fullPath) ||
    isCacheImageTempPath(fullPath)
  );
}

function scanImageFiles(rootDir, depth, results) {
  if (depth > MAX_SCAN_DEPTH) return;

  let entries;
  try {
    entries = fs.readdirSync(rootDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const fullPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      scanImageFiles(fullPath, depth + 1, results);
      continue;
    }

    if (!shouldIncludeFile(entry, fullPath)) continue;

    try {
      const stat = fs.statSync(fullPath);
      if (!stat.isFile() || stat.size <= 0 || stat.size > MAX_FILE_SIZE) continue;
      results.push({
        path: fullPath,
        name: entry.name,
        nameLower: entry.name.toLowerCase(),
        mtimeMs: stat.mtimeMs || 0,
        size: stat.size,
      });
    } catch {
      // Ignore inaccessible files.
    }
  }
}

function collectFileTokens(entry) {
  const tokens = new Set();
  const nameLower = entry.nameLower;
  tokens.add(nameLower);

  const noExt = nameLower.replace(/\.[^.]+$/, '');
  if (noExt) tokens.add(noExt);
  addHexTokens(tokens, nameLower);
  addHexTokens(tokens, noExt);
  return [...tokens];
}

function buildImageIndex(accountDir, decryptedDir, SQL) {
  const files = [];
  const roots = getCandidateRoots(accountDir, decryptedDir);
  for (const root of roots) {
    scanImageFiles(root, 0, files);
  }

  const tokenMap = new Map();
  files.forEach((entry, index) => {
    for (const token of collectFileTokens(entry)) {
      if (!tokenMap.has(token)) tokenMap.set(token, []);
      tokenMap.get(token).push(index);
    }
  });

  return {
    roots,
    files,
    tokenMap,
    noteCache: buildNoteCacheIndex(accountDir),
    hardlinkMap: buildHardlinkMap(SQL, decryptedDir),
    contentMd5Map: null,
  };
}

function ensureContentMd5Map(index) {
  if (index.contentMd5Map) {
    return index.contentMd5Map;
  }

  const contentMd5Map = new Map();
  index.files.forEach((entry, fileIndex) => {
    const loaded = ensureLoadedImage(entry, index.decodeState || null, { decodeWxgf: false });
    if (!loaded?.buffer?.length) return;

    const md5 = computeBufferMd5(loaded.buffer);
    if (!md5) return;

    if (!contentMd5Map.has(md5)) contentMd5Map.set(md5, []);
    contentMd5Map.get(md5).push(fileIndex);
  });

  index.contentMd5Map = contentMd5Map;
  return contentMd5Map;
}

function pickClosestByTime(entries, msg) {
  return [...entries].sort((a, b) => {
    const aDelta = Math.abs((a.mtimeMs || 0) - ((msg.createTime || 0) * 1000));
    const bDelta = Math.abs((b.mtimeMs || 0) - ((msg.createTime || 0) * 1000));
    if (aDelta !== bDelta) return aDelta - bDelta;
    return a.size - b.size;
  })[0] || null;
}

function pickByContentMd5(index, msg) {
  const hashes = [
    normalizeToken(msg.extra?.md5),
    normalizeToken(msg.extra?.newMd5),
    normalizeToken(msg.extra?.thumbMd5),
  ].filter(Boolean);

  if (hashes.length === 0) return null;

  const contentMd5Map = ensureContentMd5Map(index);
  for (const hash of hashes) {
    const hits = contentMd5Map.get(hash);
    if (!hits || hits.length === 0) continue;
    const entries = hits.map((fileIndex) => index.files[fileIndex]);
    const picked = pickClosestByTime(entries, msg);
    if (picked) return picked;
  }

  return null;
}

function pickByHardlinkMap(index, msg) {
  const hashes = [
    normalizeToken(msg.extra?.md5),
    normalizeToken(msg.extra?.newMd5),
    normalizeToken(msg.extra?.thumbMd5),
  ].filter(Boolean);

  if (hashes.length === 0 || !index.hardlinkMap || index.hardlinkMap.size === 0) {
    return null;
  }

  const scores = new Map();
  for (const hash of hashes) {
    const fileNames = index.hardlinkMap.get(hash);
    if (!fileNames) continue;

    for (const fileName of fileNames) {
      const hits = index.tokenMap.get(fileName);
      if (!hits) continue;
      for (const fileIndex of hits) {
        scores.set(fileIndex, (scores.get(fileIndex) || 0) + 200);
      }
    }
  }

  if (scores.size === 0) return null;

  const candidates = [...scores.entries()]
    .map(([fileIndex, score]) => ({ entry: index.files[fileIndex], score }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const aDelta = Math.abs((a.entry.mtimeMs || 0) - ((msg.createTime || 0) * 1000));
      const bDelta = Math.abs((b.entry.mtimeMs || 0) - ((msg.createTime || 0) * 1000));
      if (aDelta !== bDelta) return aDelta - bDelta;
      return a.entry.size - b.entry.size;
    });

  return candidates[0]?.entry || null;
}

function rankEntriesByTime(entries, msg) {
  return [...entries].sort((a, b) => {
    const aDelta = Math.abs((a.mtimeMs || 0) - ((msg.createTime || 0) * 1000));
    const bDelta = Math.abs((b.mtimeMs || 0) - ((msg.createTime || 0) * 1000));
    if (aDelta !== bDelta) return aDelta - bDelta;
    return a.size - b.size;
  });
}

function collectCandidateEntries(index, msg) {
  const seenPaths = new Set();
  const candidates = [];
  const pushEntries = (entries) => {
    for (const entry of entries || []) {
      if (!entry?.path || seenPaths.has(entry.path)) continue;
      seenPaths.add(entry.path);
      candidates.push(entry);
    }
  };

  const hardlinkCandidate = pickByHardlinkMap(index, msg);
  if (hardlinkCandidate) {
    pushEntries([hardlinkCandidate]);
  }

  const tokens = collectMessageImageTokens(msg);
  if (tokens.length > 0) {
    const scores = new Map();
    for (const token of tokens) {
      const hits = index.tokenMap.get(token);
      if (!hits) continue;
      const weight = token.length >= 32 ? 100 : token.length >= 16 ? 40 : 10;
      for (const fileIndex of hits) {
        scores.set(fileIndex, (scores.get(fileIndex) || 0) + weight);
      }
    }

    if (scores.size > 0) {
      const ranked = [...scores.entries()]
        .map(([fileIndex, score]) => ({ entry: index.files[fileIndex], score }))
        .sort((a, b) => {
          if (b.score !== a.score) return b.score - a.score;
          const aDelta = Math.abs((a.entry.mtimeMs || 0) - ((msg.createTime || 0) * 1000));
          const bDelta = Math.abs((b.entry.mtimeMs || 0) - ((msg.createTime || 0) * 1000));
          if (aDelta !== bDelta) return aDelta - bDelta;
          return a.entry.size - b.entry.size;
        })
        .map((item) => item.entry);
      pushEntries(ranked);
    }
  }

  const md5Candidate = pickByContentMd5(index, msg);
  if (md5Candidate) {
    pushEntries([md5Candidate]);
  }

  return candidates;
}

function pickBestCandidate(index, msg) {
  return collectCandidateEntries(index, msg)[0] || null;
}

function buildOutputRelativePath(chatFileBase, msg, ext, variant = '') {
  const suffix = variant ? `_${safeSegment(variant, 'part')}` : '';
  const fileName = `${msg.createTime || 0}_${msg.id || msg.serverId || 'image'}${suffix}.${ext}`;
  return path.posix.join('chats', `${safeSegment(chatFileBase, 'chat')}.media`, 'media', safeSegment(fileName, 'image'));
}

function buildChatRelativePath(chatFileBase, msg, ext, variant = '') {
  const suffix = variant ? `_${safeSegment(variant, 'part')}` : '';
  const fileName = `${msg.createTime || 0}_${msg.id || msg.serverId || 'image'}${suffix}.${ext}`;
  return path.posix.join('.', `${safeSegment(chatFileBase, 'chat')}.media`, 'media', safeSegment(fileName, 'image'));
}

function buildNoteCacheIndex(accountDir) {
  const noteCacheDir = accountDir
    ? path.join(accountDir, 'business', 'favorite', 'temp', 'NoteCache')
    : '';
  const result = {
    dir: noteCacheDir,
    batches: [],
    usedBatchIds: new Set(),
  };
  if (!noteCacheDir || !fs.existsSync(noteCacheDir)) {
    return result;
  }

  let entries;
  try {
    entries = fs.readdirSync(noteCacheDir, { withFileTypes: true });
  } catch {
    return result;
  }

  const batches = new Map();
  for (const entry of entries) {
    if (!entry.isFile() || !/\.jpg$/i.test(entry.name)) continue;
    const match = entry.name.match(/_(\d{17})_(\d+)\.jpg$/i);
    if (!match) continue;

    const fullPath = path.join(noteCacheDir, entry.name);
    let stat;
    try {
      stat = fs.statSync(fullPath);
    } catch {
      continue;
    }
    if (!stat.isFile() || stat.size <= 0) continue;

    const batchId = match[1];
    const orderNum = Number(match[2]) || 0;
    if (!batches.has(batchId)) batches.set(batchId, []);
    batches.get(batchId).push({
      path: fullPath,
      size: stat.size,
      mtimeMs: stat.mtimeMs || 0,
      orderNum,
    });
  }

  result.batches = [...batches.entries()]
    .map(([id, files]) => {
      const sortedFiles = files.sort((a, b) => {
        if (a.orderNum !== b.orderNum) return a.orderNum - b.orderNum;
        if (a.mtimeMs !== b.mtimeMs) return a.mtimeMs - b.mtimeMs;
        return a.size - b.size;
      });
      return {
        id,
        files: sortedFiles,
        count: sortedFiles.length,
        firstMtimeMs: Math.min(...sortedFiles.map((item) => item.mtimeMs || 0)),
        lastMtimeMs: Math.max(...sortedFiles.map((item) => item.mtimeMs || 0)),
      };
    })
    .sort((a, b) => {
      if (a.firstMtimeMs !== b.firstMtimeMs) return a.firstMtimeMs - b.firstMtimeMs;
      return a.id.localeCompare(b.id);
    });

  return result;
}

function pickNoteCacheBatchSequence(noteCache, neededCount) {
  if (!noteCache || neededCount <= 0) return null;
  const available = (noteCache.batches || []).filter(
    (batch) => !noteCache.usedBatchIds.has(batch.id) && batch.count > 0
  );
  if (available.length === 0) return null;

  let best = null;
  const consider = (selected) => {
    const total = selected.reduce((sum, batch) => sum + batch.count, 0);
    if (total !== neededCount) return;
    const first = Math.min(...selected.map((batch) => batch.firstMtimeMs));
    const last = Math.max(...selected.map((batch) => batch.lastMtimeMs));
    const candidate = {
      batches: [...selected].sort((a, b) => a.firstMtimeMs - b.firstMtimeMs),
      span: last - first,
      batchCount: selected.length,
      lastMtimeMs: last,
    };
    if (
      !best ||
      candidate.span < best.span ||
      (candidate.span === best.span && candidate.batchCount < best.batchCount) ||
      (candidate.span === best.span &&
        candidate.batchCount === best.batchCount &&
        candidate.lastMtimeMs > best.lastMtimeMs)
    ) {
      best = candidate;
    }
  };

  const visit = (startIndex, selected, currentCount) => {
    if (currentCount >= neededCount || selected.length >= 4) {
      consider(selected);
      return;
    }
    for (let i = startIndex; i < available.length; i += 1) {
      const batch = available[i];
      if (currentCount + batch.count > neededCount) continue;
      selected.push(batch);
      visit(i + 1, selected, currentCount + batch.count);
      selected.pop();
    }
  };

  visit(0, [], 0);
  if (!best) return null;

  return {
    batches: best.batches,
    files: best.batches.flatMap((batch) => batch.files),
  };
}

function computeImageFileMd5(filePath, decodeState, cacheTarget) {
  if (cacheTarget && cacheTarget.imageContentMd5 !== undefined) {
    return cacheTarget.imageContentMd5;
  }

  let value = null;
  try {
    const loaded = loadImageBuffer(filePath, decodeState, { decodeWxgf: false });
    value = loaded?.buffer?.length ? computeBufferMd5(loaded.buffer) : null;
  } catch {
    value = null;
  }

  if (cacheTarget) {
    cacheTarget.imageContentMd5 = value;
  }
  return value;
}

function getRecordItemExpectedMd5(item, imageCtx) {
  if (!item) return null;
  if (item.expectedImageMd5 !== undefined) {
    return item.expectedImageMd5;
  }

  let value = null;
  if (item.localImageSourcePath) {
    value = computeImageFileMd5(item.localImageSourcePath, imageCtx?.decodeState || null, item);
  }
  if (!value) {
    const fullMd5 = normalizeToken(item.fullMd5);
    if (/^[a-f0-9]{32}$/.test(fullMd5 || '')) {
      value = fullMd5;
    }
  }

  item.expectedImageMd5 = value;
  return value;
}

function pickMatchedNoteCacheBatchSequence(noteCache, recordItems, imageCtx) {
  if (!noteCache || !Array.isArray(recordItems) || recordItems.length === 0) {
    return null;
  }

  const available = (noteCache.batches || []).filter(
    (batch) => !noteCache.usedBatchIds.has(batch.id) && batch.count === recordItems.length
  );
  if (available.length === 0) {
    return null;
  }

  let best = null;
  for (const batch of available) {
    let matchedCount = 0;
    let comparedCount = 0;
    for (let itemIndex = 0; itemIndex < recordItems.length; itemIndex += 1) {
      const expectedMd5 = getRecordItemExpectedMd5(recordItems[itemIndex], imageCtx);
      if (!expectedMd5) continue;
      comparedCount += 1;
      const actualMd5 = computeImageFileMd5(
        batch.files[itemIndex].path,
        imageCtx?.decodeState || null,
        batch.files[itemIndex]
      );
      if (actualMd5 && actualMd5 === expectedMd5) {
        matchedCount += 1;
      }
    }

    if (matchedCount === 0) {
      continue;
    }

    if (
      !best ||
      matchedCount > best.matchedCount ||
      (matchedCount === best.matchedCount && comparedCount > best.comparedCount) ||
      (matchedCount === best.matchedCount &&
        comparedCount === best.comparedCount &&
        batch.lastMtimeMs > best.batch.lastMtimeMs)
    ) {
      best = { batch, matchedCount, comparedCount };
    }
  }

  if (!best) {
    return null;
  }

  return {
    batches: [best.batch],
    files: best.batch.files,
  };
}

function initImageExportContext({ accountDir, decryptedDir, outputDir, SQL = null, keysPath = null, logger = null }) {
  const decodeState = {
    accountDir,
    keysPath,
    logger,
    v4XorKey: null,
    imgKeyText: null,
    imgKeyTried: false,
  };
  const index = buildImageIndex(accountDir, decryptedDir, SQL);
  index.decodeState = decodeState;
  return {
    accountDir,
    decryptedDir,
    outputDir,
    decodeState,
    index,
  };
}

function getImageExportDebugInfo(imageCtx) {
  if (!imageCtx?.index) return null;
  return {
    rootCount: imageCtx.index.roots?.length || 0,
    fileCount: imageCtx.index.files?.length || 0,
    hardlinkCount: imageCtx.index.hardlinkMap?.size || 0,
    roots: (imageCtx.index.roots || []).slice(0, 8),
    noteCacheBatchCount: imageCtx.index.noteCache?.batches?.length || 0,
    hasCachedImgKey: Boolean(
      readImgKeyFromKnownFiles(imageCtx.accountDir, imageCtx.decodeState?.keysPath) ||
      readImgKeyCache(imageCtx.accountDir)
    ),
  };
}

function writeLoadedImageOutput(msg, imageCtx, chatFileBase, loaded, sourcePath, variant = '', sourceKind = null) {
  const outputRelativePath = buildOutputRelativePath(chatFileBase, msg, loaded.ext, variant);
  const chatRelativePath = buildChatRelativePath(chatFileBase, msg, loaded.ext, variant);
  const absolutePath = path.join(imageCtx.outputDir, ...outputRelativePath.split('/'));
  ensureDir(path.dirname(absolutePath));
  try {
    fs.writeFileSync(absolutePath, loaded.buffer);
  } catch (err) {
    return {
      ok: false,
      reason: 'write-failed',
      sourcePath,
      error: err.message,
    };
  }

  return {
    ok: true,
    reason: 'exported',
    sourcePath,
    ext: loaded.ext,
    sourceKind: sourceKind || loaded.sourceKind,
    exportedImagePath: chatRelativePath,
    htmlImagePath: chatRelativePath,
    outputImagePath: outputRelativePath,
    localImageSourcePath: sourcePath,
  };
}

function exportImageLike(msg, imageCtx, chatFileBase, variant = '') {
  const candidates = collectCandidateEntries(imageCtx.index, msg);
  if (candidates.length === 0) {
    return {
      ok: false,
      reason: 'no-candidate',
      candidateCount: 0,
      keyDebug: buildImageKeyMappingDebug(msg, null, imageCtx),
    };
  }

  let skippedUnsupported = false;
  let unsupportedSourcePath = null;
  for (const candidate of candidates) {
    const loaded = ensureLoadedImage(candidate, imageCtx.decodeState);
    if (!loaded?.buffer?.length) continue;
    if (loaded.ext === 'wxgf') {
      skippedUnsupported = true;
      unsupportedSourcePath = candidate.path;
      continue;
    }

    const written = writeLoadedImageOutput(msg, imageCtx, chatFileBase, loaded, candidate.path, variant);
    if (!written.ok) {
      written.candidateCount = candidates.length;
      return written;
    }
    written.candidateCount = candidates.length;
    return written;
  }

  if (skippedUnsupported) {
    return {
      ok: false,
      reason: 'unsupported-format',
      candidateCount: candidates.length,
      sourcePath: unsupportedSourcePath,
      error: 'wxgf-skipped',
      keyDebug: buildImageKeyMappingDebug(msg, candidates[0] || null, imageCtx),
    };
  }

  return {
    ok: false,
    reason: 'decode-failed',
    candidateCount: candidates.length,
    sourcePath: candidates[0]?.path || null,
    keyDebug: buildImageKeyMappingDebug(msg, candidates[0] || null, imageCtx),
  };
}

function exportMessageImage(msg, imageCtx, chatFileBase) {
  const result = exportImageLike(msg, imageCtx, chatFileBase);
  if (!result.ok) {
    return result;
  }

  msg.extra = {
    ...(msg.extra || {}),
    exportedImagePath: result.exportedImagePath,
    htmlImagePath: result.htmlImagePath,
    outputImagePath: result.outputImagePath,
    localImageSourcePath: result.localImageSourcePath,
    imageSourceKind: result.sourceKind,
  };

  return result;
}

function buildRecordImageMessage(msg, item, itemIndex) {
  return {
    id: `${msg.id || msg.serverId || 'record'}_record_${itemIndex + 1}`,
    serverId: msg.serverId ? `${msg.serverId}_record_${itemIndex + 1}` : null,
    createTime: msg.createTime,
    extra: {
      kind: 'image',
      md5: item.fullMd5 || '',
      newMd5: item.fullMd5 || '',
      thumbMd5: item.thumbFullMd5 || '',
      imageUrl: item.cdnDataUrl || '',
      bigImgUrl: item.cdnDataUrl || '',
      midImgUrl: item.cdnDataUrl || '',
      thumbUrl: item.cdnThumbUrl || '',
      aesKey: item.cdnDataKey || '',
      thumbAesKey: item.cdnThumbKey || '',
    },
  };
}

function exportRecordItemImage(msg, item, itemIndex, imageCtx, chatFileBase) {
  const imageMsg = buildRecordImageMessage(msg, item, itemIndex);
  const result = exportImageLike(imageMsg, imageCtx, chatFileBase, `note_${itemIndex + 1}`);
  if (!result.ok) {
    return result;
  }

  item.exportedImagePath = result.exportedImagePath;
  item.htmlImagePath = result.htmlImagePath;
  item.outputImagePath = result.outputImagePath;
  item.localImageSourcePath = result.localImageSourcePath;
  item.imageSourceKind = result.sourceKind;
  item.imageExt = result.ext;
  return result;
}

function exportRecordItemsFromNoteCache(
  msg,
  recordItems,
  imageCtx,
  chatFileBase,
  targetIndexes = null,
  options = {}
) {
  const { requireMatch = false } = options;
  const matchedAssignment = pickMatchedNoteCacheBatchSequence(imageCtx?.index?.noteCache, recordItems, imageCtx);
  const assignment =
    matchedAssignment ||
    (!requireMatch ? pickNoteCacheBatchSequence(imageCtx?.index?.noteCache, recordItems.length) : null);
  if (!assignment || assignment.files.length !== recordItems.length) {
    return null;
  }

  assignment.batches.forEach((batch) => imageCtx.index.noteCache.usedBatchIds.add(batch.id));
  return recordItems.map((item, itemIndex) => {
    if (targetIndexes && !targetIndexes.has(itemIndex)) {
      return { ok: true, reason: 'skipped' };
    }

    const fileEntry = assignment.files[itemIndex];
    const imageMsg = buildRecordImageMessage(msg, item, itemIndex);
    let loaded = null;
    try {
      loaded = loadImageBuffer(fileEntry.path, imageCtx.decodeState);
    } catch {
      loaded = null;
    }
    if (!loaded?.buffer?.length || loaded.ext === 'wxgf') {
      return {
        ok: false,
        reason: 'note-cache-failed',
        sourcePath: fileEntry.path,
        error: loaded?.ext === 'wxgf' ? 'wxgf-skipped' : null,
      };
    }

    const result = writeLoadedImageOutput(
      imageMsg,
      imageCtx,
      chatFileBase,
      loaded,
      fileEntry.path,
      `note_${itemIndex + 1}`,
      'note-cache'
    );
    if (!result.ok) {
      return result;
    }

    item.exportedImagePath = result.exportedImagePath;
    item.htmlImagePath = result.htmlImagePath;
    item.outputImagePath = result.outputImagePath;
    item.localImageSourcePath = result.localImageSourcePath;
    item.imageSourceKind = result.sourceKind;
    item.imageExt = result.ext;
    return result;
  });
}

function exportChatImages(chat, imageCtx, chatFileBase) {
  let exported = 0;
  let total = 0;
  const reasonCounts = {};
  const samples = [];
  for (const msg of chat.messages) {
    if (msg.type === 3 || msg.extra?.kind === 'image') {
      total += 1;
      const result = exportMessageImage(msg, imageCtx, chatFileBase);
      if (result.ok) {
        exported += 1;
      } else {
        reasonCounts[result.reason] = (reasonCounts[result.reason] || 0) + 1;
        if (samples.length < 3) {
          samples.push({
            id: msg.id || msg.serverId || null,
            createTime: msg.createTime || null,
            reason: result.reason,
            candidateCount: result.candidateCount || 0,
            sourcePath: result.sourcePath || null,
            error: result.error || null,
            md5: msg.extra?.md5 || null,
            aesKey: msg.extra?.aesKey || null,
            thumbAesKey: msg.extra?.thumbAesKey || null,
            keyDebug: result.keyDebug || null,
          });
        }
      }
    }

    const recordItems = Array.isArray(msg.extra?.recordItems)
      ? msg.extra.recordItems.filter((item) => item?.kind === 'image')
      : [];
    const pendingRecordFailures = [];
    for (let itemIndex = 0; itemIndex < recordItems.length; itemIndex += 1) {
      const item = recordItems[itemIndex];
      total += 1;
      const result = exportRecordItemImage(msg, item, itemIndex, imageCtx, chatFileBase);
      if (result.ok) {
        exported += 1;
        continue;
      }
      pendingRecordFailures.push({ item, itemIndex, result });
    }

    let handledByNoteCache = false;
    if (pendingRecordFailures.length > 0 && recordItems.length > 0) {
      const failedIndexes = new Set(pendingRecordFailures.map(({ itemIndex }) => itemIndex));
      const noteCacheResults = exportRecordItemsFromNoteCache(
        msg,
        recordItems,
        imageCtx,
        chatFileBase,
        failedIndexes,
        { requireMatch: pendingRecordFailures.length !== recordItems.length }
      );
      if (noteCacheResults) {
        handledByNoteCache = true;
        const remainingFailures = [];
        for (const failure of pendingRecordFailures) {
          const result = noteCacheResults[failure.itemIndex];
          if (result?.ok) {
            exported += 1;
            continue;
          }
          remainingFailures.push({
            item: failure.item,
            result: result || failure.result,
          });
        }
        pendingRecordFailures.length = 0;
        pendingRecordFailures.push(...remainingFailures);
      }
    }

    for (const { item, result } of pendingRecordFailures) {
      reasonCounts[result.reason] = (reasonCounts[result.reason] || 0) + 1;
      if (samples.length < 3) {
        samples.push({
          id: msg.id || msg.serverId || null,
          createTime: msg.createTime || null,
          reason: result.reason,
          candidateCount: result.candidateCount || 0,
          sourcePath: result.sourcePath || null,
          error: result.error || null,
          md5: item.fullMd5 || item.thumbFullMd5 || null,
          aesKey: item.cdnDataKey || null,
          thumbAesKey: item.cdnThumbKey || null,
          keyDebug: result.keyDebug || null,
        });
      }
    }
  }
  return {
    total,
    exported,
    failed: total - exported,
    reasonCounts,
    samples,
  };
}

module.exports = {
  initImageExportContext,
  exportChatImages,
  getImageExportDebugInfo,
  detectImageFormat,
  decodeDatBuffer,
};
