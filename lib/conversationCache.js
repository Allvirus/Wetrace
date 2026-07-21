const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DatabaseSync } = require('./sqliteRuntime');
const { getEncryptedStorageFingerprint } = require('./decryptCore');

const MAX_SCANS_PER_ACCOUNT = 20;

function getAccountFingerprint(accountPath) {
  return getEncryptedStorageFingerprint(accountPath);
}

function createScanId() {
  return `scan_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

function loadCacheStore(cachePath) {
  if (path.extname(cachePath).toLowerCase() === '.db') {
    if (!fs.existsSync(cachePath)) return {};
    const db = new DatabaseSync(cachePath, { readOnly: true });
    try {
      const table = db.prepare(
        "SELECT count(*) AS count FROM sqlite_master WHERE type = 'table' AND name = 'conversation_cache_store'"
      ).get();
      if (!Number(table?.count)) return {};
      const row = db.prepare(
        'SELECT content_json FROM conversation_cache_store WHERE store_id = ?'
      ).get('default');
      return row ? JSON.parse(row.content_json) : {};
    } catch {
      return {};
    } finally {
      db.close();
    }
  }
  try {
    if (fs.existsSync(cachePath)) {
      const parsed = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
      if (parsed && typeof parsed === 'object') {
        return parsed;
      }
    }
  } catch {
    // ignore broken cache
  }
  return {};
}

function saveCacheStore(cachePath, store) {
  fs.mkdirSync(path.dirname(cachePath), { recursive: true });
  if (path.extname(cachePath).toLowerCase() === '.db') {
    const db = new DatabaseSync(cachePath);
    try {
      db.exec(`
        PRAGMA busy_timeout = 5000;
        CREATE TABLE IF NOT EXISTS conversation_cache_store (
          store_id TEXT PRIMARY KEY,
          content_json TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
      `);
      db.prepare(`
        INSERT INTO conversation_cache_store (store_id, content_json, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(store_id) DO UPDATE SET
          content_json = excluded.content_json,
          updated_at = excluded.updated_at
      `).run('default', JSON.stringify(store), new Date().toISOString());
    } finally {
      db.close();
    }
    return;
  }
  fs.writeFileSync(cachePath, JSON.stringify(store, null, 2), 'utf8');
}

function normalizeAccountEntries(store, accountPath) {
  const raw = store[accountPath];
  if (!raw) {
    return [];
  }
  if (Array.isArray(raw)) {
    return raw
      .filter((entry) => Array.isArray(entry?.conversations) && entry.conversations.length)
      .sort((a, b) => new Date(b.scannedAt || 0) - new Date(a.scannedAt || 0));
  }
  if (Array.isArray(raw.conversations) && raw.conversations.length) {
    return [
      {
        id: raw.id || 'scan_legacy',
        fingerprint: raw.fingerprint || null,
        scannedAt: raw.scannedAt || new Date(0).toISOString(),
        conversationCount: raw.conversationCount,
        totalMessages: raw.totalMessages,
        totalVoiceMessages: raw.totalVoiceMessages || 0,
        selfWxid: raw.selfWxid || null,
        displayName: raw.displayName || null,
        conversations: raw.conversations,
        dbStats: raw.dbStats || null,
      },
    ];
  }
  return [];
}

function toListedEntry(accountPath, entry) {
  return {
    id: entry.id,
    accountPath,
    scannedAt: entry.scannedAt,
    conversationCount: entry.conversationCount,
    totalMessages: entry.totalMessages,
    totalVoiceMessages: entry.totalVoiceMessages || 0,
    selfWxid: entry.selfWxid || null,
    displayName: entry.displayName || null,
    fingerprint: entry.fingerprint || null,
  };
}

function toLoadedEntry(accountPath, entry) {
  return {
    ...toListedEntry(accountPath, entry),
    conversations: entry.conversations,
    dbStats: entry.dbStats || null,
  };
}

function isCacheCurrent(entry, accountPath) {
  if (!entry?.fingerprint || !accountPath) {
    return false;
  }
  return entry.fingerprint === getAccountFingerprint(accountPath);
}

function getLatestConversationCache(cachePath, accountPath) {
  return getConversationCache(cachePath, accountPath);
}

function getConversationCache(cachePath, accountPath, scanId = null) {
  if (!accountPath) {
    return null;
  }

  const store = loadCacheStore(cachePath);
  const entries = normalizeAccountEntries(store, accountPath);
  if (!entries.length) {
    return null;
  }

  entries.sort((a, b) => new Date(b.scannedAt || 0) - new Date(a.scannedAt || 0));

  const entry = scanId ? entries.find((item) => item.id === scanId) : entries[0];
  if (!entry) {
    return null;
  }

  return toLoadedEntry(accountPath, entry);
}

function saveConversationCache(cachePath, accountPath, payload) {
  if (!accountPath || !payload?.conversations?.length) {
    return null;
  }

  const store = loadCacheStore(cachePath);
  const entries = normalizeAccountEntries(store, accountPath);
  const previousEntry = entries[0] || null;
  const entry = {
    id: previousEntry?.id || createScanId(),
    fingerprint: getAccountFingerprint(accountPath),
    scannedAt: new Date().toISOString(),
    conversationCount: payload.conversationCount,
    totalMessages: payload.totalMessages,
    totalVoiceMessages:
      payload.totalVoiceMessages ??
      (payload.conversations || []).reduce((sum, item) => sum + (item.voiceCount || 0), 0),
    selfWxid: payload.selfWxid || null,
    displayName: payload.displayName || null,
    conversations: payload.conversations,
    dbStats: payload.dbStats || null,
  };

  store[accountPath] = [
    entry,
    ...entries.filter((item) => item.id !== entry.id),
  ].slice(0, MAX_SCANS_PER_ACCOUNT);
  saveCacheStore(cachePath, store);
  return toLoadedEntry(accountPath, entry);
}

function clearConversationCache(cachePath, accountPath, scanId = null) {
  const store = loadCacheStore(cachePath);
  const entries = normalizeAccountEntries(store, accountPath);
  if (!entries.length) {
    return false;
  }

  if (!scanId) {
    delete store[accountPath];
    saveCacheStore(cachePath, store);
    return true;
  }

  const nextEntries = entries.filter((entry) => entry.id !== scanId);
  if (nextEntries.length === entries.length) {
    return false;
  }

  if (nextEntries.length) {
    store[accountPath] = nextEntries;
  } else {
    delete store[accountPath];
  }
  saveCacheStore(cachePath, store);
  return true;
}

function updateCacheDisplayName(cachePath, accountPath, displayName) {
  if (!displayName) {
    return false;
  }
  const store = loadCacheStore(cachePath);
  const entries = normalizeAccountEntries(store, accountPath);
  if (!entries.length) {
    return false;
  }
  for (const entry of entries) {
    entry.displayName = displayName;
  }
  store[accountPath] = entries;
  saveCacheStore(cachePath, store);
  return true;
}

function listConversationCaches(cachePath) {
  const store = loadCacheStore(cachePath);
  const caches = [];

  for (const accountPath of Object.keys(store)) {
    const latestEntry = normalizeAccountEntries(store, accountPath)[0];
    if (latestEntry) caches.push(toListedEntry(accountPath, latestEntry));
  }

  return caches.sort((a, b) => new Date(b.scannedAt || 0) - new Date(a.scannedAt || 0));
}

module.exports = {
  getAccountFingerprint,
  getConversationCache,
  getLatestConversationCache,
  isCacheCurrent,
  saveConversationCache,
  clearConversationCache,
  listConversationCaches,
  updateCacheDisplayName,
  MAX_SCANS_PER_ACCOUNT,
};
