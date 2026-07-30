const { DatabaseSync } = require('./sqliteRuntime');

const MSG_SELECT_COLUMNS =
  'local_id, server_id, local_type, sort_seq, real_sender_id, create_time, status, message_content, compress_content, source, WCDB_CT_message_content';
const MAX_SQLITE_INTEGER = 9223372036854775807n;
const MAX_SAFE_BIGINT = BigInt(Number.MAX_SAFE_INTEGER);
const MIN_SAFE_BIGINT = BigInt(Number.MIN_SAFE_INTEGER);

function openDatabase(_SQL, filePath) {
  return new DatabaseSync(filePath, { readOnly: true });
}

function normalizeSqliteValue(value) {
  if (typeof value !== 'bigint') return value;
  if (value >= MIN_SAFE_BIGINT && value <= MAX_SAFE_BIGINT) return Number(value);
  return value.toString();
}

function normalizeSqliteRow(row) {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key, normalizeSqliteValue(value)])
  );
}

function prepareIntegerSafe(db, sql) {
  const statement = db.prepare(sql);
  statement.setReadBigInts(true);
  return statement;
}

function queryAll(db, sql, ...params) {
  return prepareIntegerSafe(db, sql).all(...params).map(normalizeSqliteRow);
}

function toSqliteInteger(value, fallback = 0) {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'string' && /^-?\d+$/.test(value.trim())) {
    const parsed = BigInt(value.trim());
    return parsed >= MIN_SAFE_BIGINT && parsed <= MAX_SAFE_BIGINT ? Number(parsed) : parsed;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
}

function compareSqliteIntegers(left, right) {
  try {
    const leftBigInt = BigInt(left ?? 0);
    const rightBigInt = BigInt(right ?? 0);
    return leftBigInt < rightBigInt ? -1 : leftBigInt > rightBigInt ? 1 : 0;
  } catch {
    return (Number(left) || 0) - (Number(right) || 0);
  }
}

function quoteIdentifier(value) {
  return '"' + String(value).replace(/"/g, '""') + '"';
}

function tableExists(db, tableName) {
  const row = db.prepare("SELECT count(*) AS c FROM sqlite_master WHERE type = ? AND name = ?")
    .get('table', tableName);
  return Number(row?.c) > 0;
}
function listMsgTables(db) {
  return queryAll(
    db,
    "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'Msg_%'"
  );
}

function loadSenderMap(db) {
  const senderMap = {};
  if (!tableExists(db, 'Name2Id')) return senderMap;
  for (const row of queryAll(db, 'SELECT rowid, user_name FROM Name2Id')) {
    if (row.user_name) senderMap[row.rowid] = row.user_name;
  }
  return senderMap;
}

function collectUsernames(db) {
  const usernames = new Set();
  if (!tableExists(db, 'Name2Id')) return usernames;
  for (const row of queryAll(db, "SELECT user_name FROM Name2Id WHERE user_name != ''")) {
    usernames.add(row.user_name);
  }
  return usernames;
}

/**
 * Build table indexes with one database open at a time and keep a small
 * read-only connection cache for synchronous queries.
 */
function createMessageDbPool(SQL, msgDbs, { maxOpen = 4 } = {}) {
  const dbs = new Map();
  const senderMaps = new Map();
  const tableToDbPaths = new Map();
  const usernames = new Set();
  const safeMaxOpen = Math.max(1, Math.min(Number(maxOpen) || 4, 16));

  for (const dbPath of msgDbs) {
    const db = openDatabase(SQL, dbPath);
    try {
      for (const name of collectUsernames(db)) usernames.add(name);
      for (const { name: table } of listMsgTables(db)) {
        if (!tableToDbPaths.has(table)) tableToDbPaths.set(table, []);
        tableToDbPaths.get(table).push(dbPath);
      }
    } finally {
      db.close();
    }
  }

  function getDb(dbPath) {
    if (dbs.has(dbPath)) {
      const db = dbs.get(dbPath);
      dbs.delete(dbPath);
      dbs.set(dbPath, db);
      return db;
    }

    const db = openDatabase(SQL, dbPath);
    dbs.set(dbPath, db);
    if (!senderMaps.has(dbPath)) senderMaps.set(dbPath, loadSenderMap(db));
    while (dbs.size > safeMaxOpen) {
      const oldestPath = dbs.keys().next().value;
      const oldest = dbs.get(oldestPath);
      dbs.delete(oldestPath);
      oldest.close();
    }
    return db;
  }

  return {
    msgDbs,
    getDb,
    getDbPathsForTable(table) {
      return tableToDbPaths.get(table) || [];
    },
    getOpenCount() {
      return dbs.size;
    },
    senderMaps,
    usernames,
    close() {
      for (const db of dbs.values()) db.close();
      dbs.clear();
      senderMaps.clear();
    },
  };
}
function queryTableRows(db, table) {
  const sql = 'SELECT ' + MSG_SELECT_COLUMNS + ' FROM ' + quoteIdentifier(table);
  return [...prepareIntegerSafe(db, sql).iterate()].map(normalizeSqliteRow);
}
function queryTableRowsPage(db, table, { beforeTime = null, beforeLocalId = null, limit = 300 } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 300, 1), 1000);
  const cursorTime = Number(beforeTime);
  const hasCursor = Number.isFinite(cursorTime) && cursorTime > 0;
  const safeLocalId = toSqliteInteger(beforeLocalId, MAX_SQLITE_INTEGER);
  const where = hasCursor
    ? 'WHERE (create_time < ? OR (create_time = ? AND local_id < ?))'
    : '';
  const sql = `SELECT ${MSG_SELECT_COLUMNS} FROM ${quoteIdentifier(table)} ${where} ` +
    'ORDER BY create_time DESC, local_id DESC LIMIT ?';
  const params = hasCursor
    ? [cursorTime, cursorTime, safeLocalId, safeLimit]
    : [safeLimit];
  return queryAll(db, sql, ...params);
}

function queryTableRowsSince(db, table, sinceTime = 0) {
  const safeSinceTime = Math.max(Number(sinceTime) || 0, 0);
  return queryAll(
    db,
    `SELECT ${MSG_SELECT_COLUMNS} FROM ${quoteIdentifier(table)} ` +
      'WHERE create_time >= ? ORDER BY create_time ASC, local_id ASC',
    safeSinceTime
  );
}

module.exports = {
  createMessageDbPool,
  queryTableRows,
  queryTableRowsPage,
  queryTableRowsSince,
  compareSqliteIntegers,
  MSG_SELECT_COLUMNS,
};
