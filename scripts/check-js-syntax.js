const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const ROOT_FILES = ['export.js'];
const SOURCE_DIRS = ['electron', 'lib', 'scripts', 'test'];
const EXTENSIONS = new Set(['.js', '.mjs']);

function collectFiles(dir, files) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectFiles(fullPath, files);
    } else if (EXTENSIONS.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }
}

const files = ROOT_FILES.map((name) => path.join(ROOT, name));
for (const name of SOURCE_DIRS) collectFiles(path.join(ROOT, name), files);
files.sort();

for (const filePath of files) {
  const result = spawnSync(process.execPath, ['--check', filePath], {
    encoding: 'utf8',
    windowsHide: true,
  });
  if (result.status !== 0) {
    process.stderr.write(result.stderr || result.stdout);
    process.exit(result.status || 1);
  }
}

console.log('JavaScript syntax verified: ' + files.length + ' files');
