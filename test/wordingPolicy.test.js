const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const ignoredDirectories = new Set(['.git', 'node_modules', 'dist', 'coverage']);
const projectEntries = [
  '.agents', '.codex', '.github', 'assets', 'build', 'electron', 'lib', 'native',
  'plan', 'scripts', 'test', '.gitignore', 'export.js', 'package-lock.json',
  'package.json', 'README.md',
];
const textExtensions = new Set([
  '.bat', '.c', '.cc', '.cmd', '.conf', '.cpp', '.css', '.h', '.html', '.ini',
  '.js', '.json', '.jsx', '.md', '.mjs', '.ps1', '.rc', '.svg', '.toml', '.ts',
  '.tsx', '.txt', '.xml', '.yaml', '.yml',
]);
const bannedLiteral = '\u5fae\u4fe1';

function collectTextFiles(dirPath, files = []) {
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) collectTextFiles(fullPath, files);
    else if (textExtensions.has(path.extname(entry.name).toLowerCase())) files.push(fullPath);
  }
  return files;
}

test('project wording follows the configured brand policy', () => {
  const projectFiles = [];
  for (const entry of projectEntries) {
    const entryPath = path.join(root, entry);
    if (!fs.existsSync(entryPath)) continue;
    if (fs.statSync(entryPath).isDirectory()) collectTextFiles(entryPath, projectFiles);
    else projectFiles.push(entryPath);
  }
  const offenders = projectFiles
    .filter((filePath) => fs.readFileSync(filePath, 'utf8').includes(bannedLiteral))
    .map((filePath) => path.relative(root, filePath));
  assert.deepEqual(offenders, []);
});
