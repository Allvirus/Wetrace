const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const initSqlJs = require('sql.js');
const {
  createMessageDbPool,
  queryTableRows,
} = require('../lib/messageDbPool');
const {
  createCsvWriter,
  COMPACT_JSON_THRESHOLD,
  writeChatFormats,
} = require('../lib/exportFormats');

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
        "INSERT INTO Msg_7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d VALUES (1, 100, 1, 1, 1, 1700000000, 0, 'hello', '', '', 0)"
      );
    });

    try {
      const pool = createMessageDbPool(SQL, [dbPath]);
      try {
        assert.ok(pool.usernames.has('wxid_alice'));
        const paths = pool.getDbPathsForTable('Msg_7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d');
        assert.deepEqual(paths, [dbPath]);

        const db = pool.getDb(dbPath);
        const rows = queryTableRows(db, 'Msg_7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d');
        assert.equal(rows.length, 1);
        assert.equal(rows[0].message_content, 'hello');
      } finally {
        pool.close();
      }
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

describe('exportFormats', () => {
  it('streams csv rows per chat', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wetrace-csv-'));
    const outFile = path.join(tmpDir, 'messages.csv');

    try {
      const writer = createCsvWriter(outFile);
      writer.writeChat({
        displayName: 'Alice',
        type: 'private',
        messages: [
          {
            datetime: '2024-01-01 12:00:00',
            isSelf: true,
            senderName: '我',
            typeName: 'text',
            content: 'hi',
          },
        ],
      });

      const text = fs.readFileSync(outFile, 'utf8');
      assert.match(text, /^会话,类型,时间/);
      assert.match(text, /Alice,私聊/);
      assert.match(text, /,hi$/m);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

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

  it('batches html rendering while preserving exported image paths', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wetrace-html-'));
    const outputDir = path.join(tmpDir, 'out');
    fs.mkdirSync(path.join(outputDir, 'chats'), { recursive: true });

    try {
      const messages = Array.from({ length: 200 }, (_, i) => ({
        id: i,
        datetime: `2024-01-01 12:${String(i % 60).padStart(2, '0')}:00`,
        isSelf: i % 2 === 0,
        senderName: i % 2 === 0 ? '\u6211' : 'Alice',
        type: i === 180 ? 3 : 1,
        typeName: i === 180 ? 'image' : 'text',
        content: i === 180 ? '[\u56fe\u7247]' : `msg-${i}`,
        extra:
          i === 180
            ? { kind: 'image', htmlImagePath: './BigChat.media/media/1700000000_180.png' }
            : {},
      }));

      writeChatFormats(
        {
          displayName: 'BigChat',
          type: 'private',
          messageCount: messages.length,
          messages,
        },
        outputDir,
        ['html'],
        'BigChat',
        '../index.html'
      );

      const htmlPath = path.join(outputDir, 'chats', 'BigChat.html');
      const text = fs.readFileSync(htmlPath, 'utf8');
      assert.match(text, /requestIdleCallback/);
      assert.match(text, /id="renderStatus"/);
      assert.match(text, /id="chatMessages"/);
      assert.match(text, /\.\/BigChat\.media\/media\/1700000000_180\.png/);
      assert.match(text, /Open image/);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
