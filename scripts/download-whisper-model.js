#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const https = require('https');
const { Transform } = require('stream');
const { pipeline } = require('stream/promises');
const { FILE_MANIFEST, MODEL_ID, MODEL_REVISION } = require('../lib/whisperModelManifest');

const HF_ENDPOINT = (process.env.WETRACE_HF_ENDPOINT || 'https://huggingface.co').replace(/\/$/, '');
const endpointUrl = new URL(HF_ENDPOINT);
if (endpointUrl.protocol !== 'https:') {
  throw new Error('WETRACE_HF_ENDPOINT must use HTTPS');
}

const OUT_ROOT = path.join(__dirname, '..', 'assets', 'models');
const OUT_DIR = path.join(OUT_ROOT, 'Xenova', 'whisper-small');
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_REDIRECTS = 8;
const USER_AGENT = 'wetrace-model-downloader/2.0';

const REQUIRED_FILES = Object.keys(FILE_MANIFEST);

function getDirSize(dir) {
  let total = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      total += getDirSize(full);
    } else {
      total += fs.statSync(full).size;
    }
  }
  return total;
}

function resolveOutputPath(relPath) {
  if (!Object.hasOwn(FILE_MANIFEST, relPath)) {
    throw new Error('Model file is not in the pinned manifest: ' + relPath);
  }
  const root = path.resolve(OUT_DIR);
  const resolved = path.resolve(root, ...relPath.split('/'));
  if (!resolved.startsWith(root + path.sep)) {
    throw new Error('Model file escapes the output directory: ' + relPath);
  }
  return resolved;
}

function openHttpsStream(url, redirects = 0) {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:') {
    return Promise.reject(new Error('Refusing non-HTTPS model URL: ' + parsed.href));
  }
  return new Promise((resolve, reject) => {
    const req = https.get(parsed, { headers: { 'User-Agent': USER_AGENT } }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        if (redirects >= MAX_REDIRECTS) {
          res.resume();
          reject(new Error('Too many redirects: ' + parsed.href));
          return;
        }
        const nextUrl = new URL(res.headers.location, parsed);
        res.resume();
        resolve(openHttpsStream(nextUrl, redirects + 1));
        return;
      }
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error('HTTP ' + res.statusCode + ': ' + parsed.href));
        return;
      }
      resolve(res);
    });
    req.setTimeout(REQUEST_TIMEOUT_MS, () => req.destroy(new Error('Model download timed out')));
    req.once('error', reject);
  });
}

async function hashFile(filePath) {
  const hash = crypto.createHash('sha256');
  const input = fs.createReadStream(filePath);
  input.on('data', (chunk) => hash.update(chunk));
  await new Promise((resolve, reject) => {
    input.once('end', resolve);
    input.once('error', reject);
  });
  return hash.digest('hex');
}

async function inspectModelFile(relPath) {
  const expected = FILE_MANIFEST[relPath];
  const filePath = resolveOutputPath(relPath);
  try {
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) return { ok: false, reason: 'not-file' };
    if (stat.size !== expected.size) return { ok: false, reason: 'size-mismatch' };
    const sha256 = await hashFile(filePath);
    if (sha256 !== expected.sha256) return { ok: false, reason: 'sha256-mismatch' };
    return { ok: true, size: stat.size, sha256 };
  } catch (err) {
    if (err.code === 'ENOENT') return { ok: false, reason: 'missing' };
    throw err;
  }
}

async function downloadFile(relPath) {
  const expected = FILE_MANIFEST[relPath];
  const outFile = resolveOutputPath(relPath);
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  const encodedPath = relPath.split('/').map(encodeURIComponent).join('/');
  const url = new URL(
    MODEL_ID + '/resolve/' + MODEL_REVISION + '/' + encodedPath,
    HF_ENDPOINT + '/'
  );
  const tempPath = outFile + '.download-' + process.pid + '-' + Date.now();
  let response;
  try {
    response = await openHttpsStream(url);
    const declaredLength = Number(response.headers['content-length']);
    if (Number.isFinite(declaredLength) && declaredLength !== expected.size) {
      throw new Error('Unexpected content length for ' + relPath);
    }
    let received = 0;
    const hash = crypto.createHash('sha256');
    const verifier = new Transform({
      transform(chunk, _encoding, callback) {
        received += chunk.length;
        if (received > expected.size) {
          callback(new Error('Model file exceeds pinned size: ' + relPath));
          return;
        }
        hash.update(chunk);
        callback(null, chunk);
      },
    });
    await pipeline(response, verifier, fs.createWriteStream(tempPath, { flags: 'wx' }));
    const sha256 = hash.digest('hex');
    if (received !== expected.size || sha256 !== expected.sha256) {
      throw new Error('Integrity check failed for ' + relPath);
    }
    if (fs.existsSync(outFile)) fs.unlinkSync(outFile);
    fs.renameSync(tempPath, outFile);
    return received;
  } catch (err) {
    response?.destroy();
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    throw err;
  }
}

async function main() {
  const force = process.argv.includes('--force');
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const invalidFiles = [];
  for (const relPath of REQUIRED_FILES) {
    const inspected = await inspectModelFile(relPath);
    if (!inspected.ok) invalidFiles.push(relPath);
  }
  if (!force && invalidFiles.length === 0) {
    const sizeMb = Math.round(getDirSize(OUT_DIR) / (1024 * 1024));
    console.log('Pinned speech model is ready (' + sizeMb + ' MB): ' + OUT_DIR);
    return;
  }

  const files = force ? REQUIRED_FILES : invalidFiles;
  console.log('Downloading pinned ' + MODEL_ID + '@' + MODEL_REVISION + ' ...');
  console.log(files.length + ' file(s) require download or repair');
  let downloaded = 0;
  for (let i = 0; i < files.length; i += 1) {
    const relPath = files[i];
    process.stdout.write('[' + (i + 1) + '/' + files.length + '] ' + relPath + ' ... ');
    const bytes = await downloadFile(relPath);
    downloaded += bytes;
    console.log(Math.round(bytes / 1024) + ' KB');
  }

  for (const relPath of REQUIRED_FILES) {
    const inspected = await inspectModelFile(relPath);
    if (!inspected.ok) throw new Error('Installed model verification failed: ' + relPath);
  }
  const sizeMb = Math.round(getDirSize(OUT_DIR) / (1024 * 1024));
  console.log('Pinned model verified (' + sizeMb + ' MB, downloaded ' +
    Math.round(downloaded / (1024 * 1024)) + ' MB): ' + OUT_DIR);
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Speech model download failed:', err.message);
    console.error('Use an HTTPS HuggingFace endpoint and retry. TLS verification cannot be disabled.');
    process.exitCode = 1;
  });
}

module.exports = {
  FILE_MANIFEST,
  MODEL_REVISION,
  downloadFile,
  inspectModelFile,
  resolveOutputPath,
};
