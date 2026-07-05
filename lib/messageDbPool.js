const fs = require('fs');

const MSG_SELECT_COLUMNS =
  'local_id, server_id, local_type, sort_seq, real_sender_id, create_time, status, message_content, compress_content, source, WCDB_CT_message_content';

function openDatabase(SQL, filePath) {
  return new SQL.Database(fs.readFileSync(filePath));
}

function queryAll(db, sql) {
  const result = db.exec(sql);
  if (!result[0]) return [];
  const { columns, values } = result[0];
  return values.map((row) => Object.fromEntries(columns.map((col, i) => [col, row[i]])));
}

function tableExists(db, tableName) {
  const rows = db.exec(
    `SELECT count(*) AS c FROM sqlite_master WHERE type='table' AND name='${tableName.replace(/'/g, "''")}'`
  );
  return rows[0]?.values?.[0]?.[0] > 0;
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
 * 一次性打开所有 message_*.db，构建表→库路径索引，避免每个会话重复读盘。
 */
function createMessageDbPool(SQL, msgDbs) {
  const dbs = new Map();
  const senderMaps = new Map();
  const tableToDbPaths = new Map();
  const usernames = new Set();

  for (const dbPath of msgDbs) {
    const db = openDatabase(SQL, dbPath);
    dbs.set(dbPath, db);
    senderMaps.set(dbPath, loadSenderMap(db));

    for (const name of collectUsernames(db)) {
      usernames.add(name);
    }

    for (const { name: table } of listMsgTables(db)) {
      if (!tableToDbPaths.has(table)) {
        tableToDbPaths.set(table, []);
      }
      tableToDbPaths.get(table).push(dbPath);
    }
  }

  return {
    msgDbs,
    getDb(dbPath) {
      return dbs.get(dbPath);
    },
    getDbPathsForTable(table) {
      return tableToDbPaths.get(table) || [];
    },
    senderMaps,
    usernames,
    close() {
      for (const db of dbs.values()) {
        db.close();
      }
      dbs.clear();
    },
  };
}

function queryTableRows(db, table) {
  const rows = [];
  const stmt = db.prepare(`SELECT ${MSG_SELECT_COLUMNS} FROM "${table}"`);
  try {
    while (stmt.step()) {
      rows.push(stmt.getAsObject());
    }
  } finally {
    stmt.free();
  }
  return rows;
}

module.exports = {
  createMessageDbPool,
  queryTableRows,
  MSG_SELECT_COLUMNS,
};
