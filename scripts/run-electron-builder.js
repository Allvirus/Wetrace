const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const rootDir = path.join(__dirname, '..');
const packagePath = path.join(rootDir, 'package.json');
const original = fs.readFileSync(packagePath);
const hasBom = original.length >= 3 && original[0] === 0xef && original[1] === 0xbb && original[2] === 0xbf;
const executable = path.join(
  rootDir,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'electron-builder.cmd' : 'electron-builder'
);

let result;
try {
  if (hasBom) fs.writeFileSync(packagePath, original.subarray(3));
  result = spawnSync(executable, process.argv.slice(2), {
    cwd: rootDir,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
} finally {
  if (hasBom) fs.writeFileSync(packagePath, original);
}

if (result?.error) throw result.error;
process.exitCode = result?.status ?? 1;
