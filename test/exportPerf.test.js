const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const initSqlJs = require('sql.js');
const {
  createMessageDbPool,
  queryTableRows,
  queryTableRowsPage,
} = require('../lib/messageDbPool');
const {
  COMPACT_JSON_THRESHOLD,
  writeChatFormats,
} = require('../lib/exportFormats');
const {
  countConversationMessagesInRange,
  getConversationTimeBounds,
} = require('../lib/exportCore');

async function createTestSql() {
  return initSqlJs({
    locateFile: (file) =>
      path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist', file),
  });
}

function createTempDb(SQL, setupFn) {
  const db = new SQL.Database();
  setupFn(db);
  const bytes = db.export();
  db.close();

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wetrace-test-'));
  const dbPath = path.join(tmpDir, 'message_0.db');
  fs.writeFileSync(dbPath, Buffer.from(bytes));
  return { tmpDir, dbPath };
}

describe('messageDbPool', () => {
  it('builds table index and reuses open databases', async () => {
    const SQL = await createTestSql();
    const { tmpDir, dbPath } = createTempDb(SQL, (db) => {
      db.run('CREATE TABLE Name2Id (rowid INTEGER PRIMARY KEY, user_name TEXT)');
      db.run("INSERT INTO Name2Id (user_name) VALUES ('wxid_alice')");
      db.run(
        'CREATE TABLE Msg_7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d (local_id INTEGER, server_id INTEGER, local_type INTEGER, sort_seq INTEGER, real_sender_id INTEGER, create_time INTEGER, status INTEGER, message_content TEXT, compress_content TEXT, source TEXT, WCDB_CT_message_content INTEGER)'
      );
      db.run(
        "INSERT INTO Msg_7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d VALUES (1, 4817199625088102043, 1, 4817199625088102043, 1, 1700000000, 0, 'hello', '', '', 0)"
      );
    });

    try {
      const pool = createMessageDbPool(SQL, [dbPath]);
      try {
        assert.ok(pool.usernames.has('wxid_alice'));
        assert.equal(pool.getOpenCount(), 0);
        const paths = pool.getDbPathsForTable('Msg_7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d');
        assert.deepEqual(paths, [dbPath]);

        const db = pool.getDb(dbPath);
        assert.equal(pool.getOpenCount(), 1);
        assert.equal(pool.senderMaps.get(dbPath)[1], 'wxid_alice');
        const rows = queryTableRows(db, 'Msg_7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d');
        assert.equal(rows.length, 1);
        assert.equal(rows[0].message_content, 'hello');
        assert.equal(rows[0].server_id, '4817199625088102043');
        assert.equal(rows[0].sort_seq, '4817199625088102043');
      } finally {
        pool.close();
      }
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('caps cached query connections', async () => {
    const SQL = await createTestSql();
    const databases = Array.from({ length: 3 }, (_, index) => createTempDb(SQL, (db) => {
      db.run(`CREATE TABLE Msg_${index} (id INTEGER)`);
    }));

    try {
      const pool = createMessageDbPool(SQL, databases.map((item) => item.dbPath), { maxOpen: 2 });
      try {
        assert.equal(pool.getOpenCount(), 0);
        for (const { dbPath } of databases) pool.getDb(dbPath);
        assert.equal(pool.getOpenCount(), 2);
      } finally {
        pool.close();
      }
    } finally {
      for (const { tmpDir } of databases) fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('pages backward without repeating rows that share a timestamp', async () => {
    const SQL = await createTestSql();
    const table = 'Msg_7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d';
    const { tmpDir, dbPath } = createTempDb(SQL, (db) => {
      db.run('CREATE TABLE Name2Id (rowid INTEGER PRIMARY KEY, user_name TEXT)');
      db.run(`CREATE TABLE ${table} (local_id INTEGER, server_id INTEGER, local_type INTEGER, sort_seq INTEGER, real_sender_id INTEGER, create_time INTEGER, status INTEGER, message_content TEXT, compress_content TEXT, source TEXT, WCDB_CT_message_content INTEGER)`);
      db.run(`INSERT INTO ${table} VALUES (1, 101, 1, 1, 1, 100, 0, 'old', '', '', 0)`);
      db.run(`INSERT INTO ${table} VALUES (2, 102, 1, 2, 1, 200, 0, 'same-a', '', '', 0)`);
      db.run(`INSERT INTO ${table} VALUES (3, 4817199625088102043, 1, 3, 1, 200, 0, 'same-b', '', '', 0)`);
    });

    try {
      const pool = createMessageDbPool(SQL, [dbPath]);
      try {
        const first = queryTableRowsPage(pool.getDb(dbPath), table, { limit: 2 });
        assert.deepEqual(first.map((row) => row.local_id), [3, 2]);
        assert.equal(first[0].server_id, '4817199625088102043');
        const second = queryTableRowsPage(pool.getDb(dbPath), table, {
          beforeTime: first[1].create_time,
          beforeLocalId: first[1].local_id,
          limit: 2,
        });
        assert.deepEqual(second.map((row) => row.local_id), [1]);
      } finally {
        pool.close();
      }
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('reads time bounds and range counts through disk-backed connections', async () => {
    const SQL = await createTestSql();
    const username = 'wxid_alice';
    const table = `Msg_${crypto.createHash('md5').update(username).digest('hex')}`;
    const { tmpDir, dbPath } = createTempDb(SQL, (db) => {
      db.run('CREATE TABLE Name2Id (rowid INTEGER PRIMARY KEY, user_name TEXT)');
      db.run(`CREATE TABLE ${table} (local_id INTEGER, server_id INTEGER, local_type INTEGER, sort_seq INTEGER, real_sender_id INTEGER, create_time INTEGER, status INTEGER, message_content TEXT, compress_content TEXT, source TEXT, WCDB_CT_message_content INTEGER)`);
      db.run(`INSERT INTO ${table} VALUES (1, 101, 1, 1, 1, 100, 0, 'old', '', '', 0)`);
      db.run(`INSERT INTO ${table} VALUES (2, 102, 34, 2, 1, 200, 0, 'voice', '', '', 0)`);
      db.run(`INSERT INTO ${table} VALUES (3, 103, 1, 3, 1, 300, 0, 'new', '', '', 0)`);
    });
    const accountDir = path.join(tmpDir, 'wxid_self');
    const messageDir = path.join(accountDir, 'db_storage_decrypted', 'message');
    fs.mkdirSync(messageDir, { recursive: true });
    fs.renameSync(dbPath, path.join(messageDir, 'message_0.db'));

    try {
      assert.deepEqual(
        await getConversationTimeBounds({ wxDir: accountDir, username }),
        { firstTimestamp: 100, lastTimestamp: 300 }
      );
      assert.deepEqual(
        await countConversationMessagesInRange({
          wxDir: accountDir,
          username,
          startTime: 150,
          endTime: 300,
        }),
        { messageCount: 2, voiceCount: 1 }
      );
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

describe('exportFormats', () => {
  it('uses compact json for large chats', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wetrace-json-'));
    const outputDir = path.join(tmpDir, 'out');
    fs.mkdirSync(path.join(outputDir, 'chats'), { recursive: true });

    try {
      const messages = Array.from({ length: COMPACT_JSON_THRESHOLD }, (_, i) => ({
        id: i,
        content: `msg-${i}`,
        typeName: 'text',
      }));

      writeChatFormats(
        {
          displayName: 'BigChat',
          type: 'private',
          messageCount: messages.length,
          messages,
        },
        outputDir,
        ['json'],
        'BigChat'
      );

      const jsonPath = path.join(outputDir, 'chats', 'BigChat.json');
      const text = fs.readFileSync(jsonPath, 'utf8');
      assert.ok(!text.includes('\n  "id"'), 'large chat json should be compact');
      assert.match(text, /"messageCount":5000/);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

});
