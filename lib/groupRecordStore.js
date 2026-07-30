const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('./sqliteRuntime');

function isImageMessage(message) {
  return (
    Number(message?.type) === 3 ||
    message?.extra?.kind === 'image' ||
    (Array.isArray(message?.extra?.recordItems) &&
      message.extra.recordItems.some((item) => item?.kind === 'image'))
  );
}

function messageKey(message) {
  return `${message.createTime || 0}:${message.id || 0}:${message.serverId || ''}`;
}

function parseExtra(value) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function toMessage(row) {
  return {
    id: Number(row.local_id) || 0,
    serverId: row.server_id || null,
    type: Number(row.type) || 0,
    typeName: row.type_name || '',
    createTime: Number(row.create_time) || 0,
    datetime: row.datetime || null,
    sortSeq: Number(row.sort_seq) || 0,
    senderId: Number(row.sender_id) || 0,
    senderWxid: row.sender_wxid || null,
    senderName: row.sender_name || null,
    isSelf: Boolean(row.is_self),
    content: row.content || '',
    extra: parseExtra(row.extra_json),
    status: Number(row.status) || 0,
  };
}

async function openGroupRecordStore(dbPath) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS groups (
      username TEXT PRIMARY KEY,
      display_name TEXT NOT NULL,
      source_version TEXT NOT NULL,
      cached_at TEXT NOT NULL,
      message_count INTEGER NOT NULL DEFAULT 0,
      last_create_time INTEGER NOT NULL DEFAULT 0,
      last_local_id INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS messages (
      username TEXT NOT NULL,
      message_key TEXT NOT NULL,
      local_id INTEGER NOT NULL,
      server_id TEXT,
      type INTEGER NOT NULL,
      type_name TEXT,
      create_time INTEGER NOT NULL,
      datetime TEXT,
      sort_seq INTEGER,
      sender_id INTEGER,
      sender_wxid TEXT,
      sender_name TEXT,
      is_self INTEGER NOT NULL DEFAULT 0,
      content TEXT,
      extra_json TEXT,
      status INTEGER,
      has_image INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (username, message_key)
    );
    CREATE INDEX IF NOT EXISTS idx_group_messages_page
      ON messages (username, create_time DESC, local_id DESC);
    CREATE INDEX IF NOT EXISTS idx_group_messages_sender
      ON messages (username, sender_wxid, create_time DESC, local_id DESC);
    CREATE INDEX IF NOT EXISTS idx_group_messages_image
      ON messages (username, has_image, create_time DESC, local_id DESC);
  `);

  const getGroupStmt = db.prepare('SELECT * FROM groups WHERE username = ?');
  const deleteGroupMessagesStmt = db.prepare('DELETE FROM messages WHERE username = ?');
  const insertMessageStmt = db.prepare(`
    INSERT OR REPLACE INTO messages (
      username, message_key, local_id, server_id, type, type_name, create_time, datetime,
      sort_seq, sender_id, sender_wxid, sender_name, is_self, content, extra_json, status, has_image
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const groupStatsStmt = db.prepare(
    'SELECT count(*) AS c, max(create_time) AS max_t FROM messages WHERE username = ?'
  );
  const lastMessageStmt = db.prepare(
    'SELECT local_id FROM messages WHERE username = ? ORDER BY create_time DESC, local_id DESC LIMIT 1'
  );
  const upsertGroupStmt = db.prepare(`
    INSERT OR REPLACE INTO groups (
      username, display_name, source_version, cached_at, message_count, last_create_time, last_local_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  function getGroupInfo(username) {
    const row = getGroupStmt.get(username);
    if (!row) return null;
    return {
      username: row.username,
      displayName: row.display_name,
      sourceVersion: row.source_version,
      cachedAt: row.cached_at,
      messageCount: Number(row.message_count) || 0,
      lastCreateTime: Number(row.last_create_time) || 0,
      lastLocalId: Number(row.last_local_id) || 0,
    };
  }

  function writeMessages(username, messages) {
    for (const message of messages || []) {
      insertMessageStmt.run(
        username,
        messageKey(message),
        Number(message.id) || 0,
        message.serverId == null ? null : String(message.serverId),
        Number(message.type) || 0,
        message.typeName || '',
        Number(message.createTime) || 0,
        message.datetime || null,
        Number(message.sortSeq) || 0,
        Number(message.senderId) || 0,
        message.senderWxid || null,
        message.senderName || null,
        message.isSelf ? 1 : 0,
        message.content || '',
        message.extra ? JSON.stringify(message.extra) : null,
        Number(message.status) || 0,
        isImageMessage(message) ? 1 : 0
      );
    }
  }

  function updateGroupMeta(username, displayName, sourceVersion) {
    const stats = groupStatsStmt.get(username) || {};
    const last = lastMessageStmt.get(username) || {};
    upsertGroupStmt.run(
      username,
      displayName || username,
      sourceVersion,
      new Date().toISOString(),
      Number(stats.c) || 0,
      Number(stats.max_t) || 0,
      Number(last.local_id) || 0
    );
  }

  function storeGroup({ username, displayName, sourceVersion, messages, replace = false }) {
    db.exec('BEGIN IMMEDIATE');
    try {
      if (replace) deleteGroupMessagesStmt.run(username);
      writeMessages(username, messages);
      updateGroupMeta(username, displayName, sourceVersion);
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
    return getGroupInfo(username);
  }

  function listMembers(username, startTime = null) {
    const timeCondition = startTime == null ? '' : ' AND create_time >= ?';
    const params = startTime == null ? [username] : [username, Number(startTime) || 0];
    return db.prepare(`
      SELECT sender_wxid, max(sender_name) AS sender_name, max(is_self) AS is_self, count(*) AS message_count
      FROM messages
      WHERE username = ? AND sender_wxid IS NOT NULL AND sender_wxid != ''${timeCondition}
      GROUP BY sender_wxid
      ORDER BY is_self DESC, sender_name COLLATE NOCASE ASC
    `).all(...params).map((row) => ({
      wxid: row.sender_wxid,
      displayName: row.sender_name || row.sender_wxid,
      messageCount: Number(row.message_count) || 0,
      isSelf: Boolean(row.is_self),
    }));
  }

  function loadMessages({ username, cursor = null, limit = 100, senderWxids = null, imagesOnly = false, startTime = null }) {
    const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 200);
    if (Array.isArray(senderWxids) && senderWxids.length === 0) {
      return { messages: [], hasMore: false, nextCursor: null };
    }
    const conditions = ['username = ?'];
    const params = [username];
    if (cursor?.beforeTime != null) {
      conditions.push('(create_time < ? OR (create_time = ? AND local_id < ?))');
      params.push(
        Number(cursor.beforeTime) || 0,
        Number(cursor.beforeTime) || 0,
        Number(cursor.beforeLocalId) || Number.MAX_SAFE_INTEGER
      );
    }
    if (startTime != null) {
      conditions.push('create_time >= ?');
      params.push(Number(startTime) || 0);
    }
    if (imagesOnly) conditions.push('has_image = 1');
    if (Array.isArray(senderWxids)) {
      conditions.push(`sender_wxid IN (${senderWxids.map(() => '?').join(', ')})`);
      params.push(...senderWxids);
    }

    const rows = db.prepare(`
      SELECT * FROM messages WHERE ${conditions.join(' AND ')}
      ORDER BY create_time DESC, local_id DESC LIMIT ?
    `).all(...params, safeLimit + 1);
    const hasMore = rows.length > safeLimit;
    const pageRows = rows.slice(0, safeLimit);
    const boundary = pageRows[pageRows.length - 1];
    return {
      messages: pageRows.map(toMessage).reverse(),
      hasMore,
      nextCursor: hasMore && boundary
        ? { beforeTime: Number(boundary.create_time) || 0, beforeLocalId: Number(boundary.local_id) || 0 }
        : null,
    };
  }

  function loadAllMessages({ username, senderWxids = null, startTime = null, endTime = null }) {
    if (Array.isArray(senderWxids) && senderWxids.length === 0) return [];
    const conditions = ['username = ?'];
    const params = [username];
    if (startTime != null) {
      conditions.push('create_time >= ?');
      params.push(Number(startTime) || 0);
    }
    if (endTime != null) {
      conditions.push('create_time <= ?');
      params.push(Number(endTime) || Number.MAX_SAFE_INTEGER);
    }
    if (Array.isArray(senderWxids)) {
      conditions.push(`sender_wxid IN (${senderWxids.map(() => '?').join(', ')})`);
      params.push(...senderWxids);
    }
    return db.prepare(`
      SELECT * FROM messages WHERE ${conditions.join(' AND ')}
      ORDER BY create_time ASC, local_id ASC
    `).all(...params).map(toMessage);
  }

  return {
    getGroupInfo,
    listMembers,
    loadAllMessages,
    loadMessages,
    storeGroup,
    save() {},
    close() {
      db.close();
    },
  };
}

module.exports = { openGroupRecordStore };
