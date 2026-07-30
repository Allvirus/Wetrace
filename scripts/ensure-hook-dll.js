const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const dllPath = path.join(__dirname, '..', 'assets', 'dll', 'wexin_hook.dll');
const checksumPath = dllPath + '.sha256';const minSize = 32 * 1024;

if (!fs.existsSync(dllPath)) {
  console.error('打包前缺少 assets/dll/wexin_hook.dll');
  console.error('请先在本机执行: npm run build:hook');
  process.exit(1);
}

const size = fs.statSync(dllPath).size;
if (size < minSize) {
  console.error(`wexin_hook.dll 文件过小 (${size} 字节)，可能无效`);
  console.error('请重新执行: npm run build:hook');
  process.exit(1);
}

const data = fs.readFileSync(dllPath);
const peOffset = data.length >= 0x40 ? data.readUInt32LE(0x3c) : -1;
const isPe = data.subarray(0, 2).toString('ascii') === 'MZ' &&
  peOffset >= 0 && peOffset + 4 <= data.length && data.readUInt32LE(peOffset) === 0x00004550;
if (!isPe) {
  console.error('wexin_hook.dll is not a valid PE file');
  process.exit(1);
}

const sha256 = crypto.createHash('sha256').update(data).digest('hex');
const expected = fs.existsSync(checksumPath) ? fs.readFileSync(checksumPath, 'utf8').trim().toLowerCase() : '';
if (!/^[a-f0-9]{64}$/.test(expected) || expected !== sha256) {
  console.error('wexin_hook.dll SHA-256 does not match assets/dll/wexin_hook.dll.sha256');
  process.exit(1);
}

const escapedDllPath = dllPath.replace(/'/g, "''"); const signatureCommand = "(Get-AuthenticodeSignature -LiteralPath '" + escapedDllPath + "').Status"; const signature = spawnSync('powershell.exe', [   '-NoProfile',   '-NonInteractive',   '-Command',   signatureCommand, ], { encoding: 'utf8', windowsHide: true });
const signatureStatus = signature.status === 0 ? signature.stdout.trim() : 'UnknownError';
if (signatureStatus !== 'Valid') {
  const message = 'WARNING: wexin_hook.dll Authenticode status is ' + signatureStatus;
  if (process.env.WETRACE_REQUIRE_SIGNED_ARTIFACTS === '1') {
    console.error(message);
    process.exit(1);
  }
  console.warn(message);
}

console.log('wexin_hook.dll ready (' + Math.round(size / 1024) + ' KB, SHA-256 ' + sha256 + ')');
