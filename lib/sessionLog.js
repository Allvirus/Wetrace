const fs = require('fs');
const path = require('path');
const os = require('os');

const MAX_LOG_FILES = 10;
const HEX_KEY_PATTERN = /\b[0-9a-fA-F]{64}\b/g;
const PASSPHRASE_PATTERN = /passphrase[^\n]*/gi;
const BEARER_TOKEN_PATTERN = /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi;
const SENSITIVE_ASSIGNMENT_PATTERN = /\b(password|secret|token|authorization|cookie|(?:database|image|db)[_-]?key)\s*[:=]\s*(?:"[^"\r\n]*"|'[^'\r\n]*'|[^\s,;]+)/gi;

function getLogDir(userDataPath) {
  return path.join(userDataPath, 'logs');
}

function maskPath(input) {
  if (!input || typeof input !== 'string') return input || '';
  let masked = input.replace(/\\/g, '/');
  const home = (os.homedir() || '').replace(/\\/g, '/');
  if (home) {
    const escapedHome = home.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    masked = masked.replace(new RegExp(escapedHome, 'gi'), '~');
  }
  masked = masked.replace(/\bwxid_[A-Za-z0-9_-]+/gi, 'wxid_***');
  masked = masked.replace(/\b[0-9A-Za-z_-]{5,}@chatroom\b/gi, '[redacted-account]');
  masked = masked.replace(/\b[A-Za-z]:\/(?:[^/\s]+\/)*[^/\s]*/g, '[redacted-path]');
  masked = masked.replace(/(^|\s)\/\/[^/\s]+\/[^\s]+/g, '$1[redacted-path]');
  return masked;
}

function sanitizeForLog(text) {
  if (text == null) return '';
  let value = String(text);
  value = value.replace(BEARER_TOKEN_PATTERN, 'Bearer [redacted]');
  value = value.replace(SENSITIVE_ASSIGNMENT_PATTERN, '$1=[redacted]');
  value = value.replace(HEX_KEY_PATTERN, '[redacted-key]');
  value = value.replace(PASSPHRASE_PATTERN, 'passphrase [redacted]');
  value = maskPath(value);
  return value.replace(/\r?\n/g, '\\n').slice(0, 4000);
}

function formatLogLine(type, payload) {
  const ts = new Date().toISOString();
  if (typeof payload === 'string') {
    return `[${ts}] [${type}] ${sanitizeForLog(payload)}`;
  }
  const parts = [`[${ts}] [${type}]`];
  for (const [key, val] of Object.entries(payload)) {
    if (val == null || val === '') continue;
    parts.push(`${key}=${sanitizeForLog(String(val))}`);
  }
  return parts.join(' ');
}

function pruneOldLogs(logDir) {
  try {
    if (!fs.existsSync(logDir)) return;
    const files = fs
      .readdirSync(logDir)
      .filter((name) => name.startsWith('scan-') && name.endsWith('.log'))
      .map((name) => {
        const fullPath = path.join(logDir, name);
        return { fullPath, mtime: fs.statSync(fullPath).mtimeMs };
      })
      .sort((a, b) => b.mtime - a.mtime);
    for (const file of files.slice(MAX_LOG_FILES)) {
      try {
        fs.unlinkSync(file.fullPath);
      } catch {
        // ignore
      }
    }
  } catch {
    // ignore
  }
}

function createScanSession(userDataPath, meta = {}) {
  const logDir = getLogDir(userDataPath);
  fs.mkdirSync(logDir, { recursive: true });
  pruneOldLogs(logDir);

  const stamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '-').slice(0, 19);
  const suffix = Math.random().toString(36).slice(2, 6);
  const fileName = `scan-${stamp}-${suffix}.log`;
  const logPath = path.join(logDir, fileName);

  const header = [
    '# Wetrace diagnostic log',
    '# Redaction is best-effort. Review this file before sharing it.',
    `# created_at=${new Date().toISOString()}`,
    `# log_file=${fileName}`,
    '',
  ].join('\n');

  fs.writeFileSync(logPath, header, 'utf8');

  if (meta && Object.keys(meta).length > 0) {
    appendSessionLog(logPath, 'meta', meta);
  }

  return {
    logDir,
    logPath,
    fileName,
    append(type, payload) {
      appendSessionLog(logPath, type, payload);
    },
    finalize(result) {
      finalizeSessionLog(logPath, result);
      return { logDir, logPath, fileName };
    },
  };
}

function appendSessionLog(logPath, type, payload) {
  if (!logPath) return;
  const line = `${formatLogLine(type, payload)}\n`;
  try {
    fs.appendFileSync(logPath, line, 'utf8');
  } catch {
    // ignore logging failures
  }
}

function finalizeSessionLog(logPath, result = {}) {
  appendSessionLog(logPath, 'result', {
    ok: result.ok ? 'true' : 'false',
    code: result.code || '',
    message: result.message || '',
    cancelled: result.cancelled ? 'true' : 'false',
  });
}

module.exports = {
  getLogDir,
  maskPath,
  sanitizeForLog,
  createScanSession,
  appendSessionLog,
  finalizeSessionLog,
};
