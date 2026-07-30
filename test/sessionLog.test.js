const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createScanSession, sanitizeForLog } = require('../lib/sessionLog');

test('diagnostic logs redact common secrets, account ids, and absolute paths', () => {
  const key = 'a'.repeat(64);
  const sanitized = sanitizeForLog(
    `db_key=${key} Authorization: Bearer abc.def path=H:\\private\\wxid_alice\\message.db ` +
      '123456789@chatroom\nforged-line'
  );

  for (const sensitive of ['abc.def', 'wxid_alice', '123456789@chatroom', 'H:']) {
    assert.equal(sanitized.includes(sensitive), false);
  }
  assert.doesNotMatch(sanitized, new RegExp(key));
  assert.match(sanitized, /\[redacted\]/);
  assert.match(sanitized, /\[redacted-path\]/);
  assert.match(sanitized, /\\nforged-line/);
});

test('diagnostic log header requires review before sharing', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wetrace-log-'));
  try {
    const session = createScanSession(tmpDir);
    const header = fs.readFileSync(session.logPath, 'utf8');
    assert.match(header, /Redaction is best-effort/);
    assert.doesNotMatch(header, /\u53ef\u653e\u5fc3\u53d1\u9001/);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
