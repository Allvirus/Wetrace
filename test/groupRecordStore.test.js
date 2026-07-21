const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const crypto = require('crypto');
const os = require('os');
const path = require('path');
const initSqlJs = require('sql.js');
const { loadCachedConversationMessages } = require('../lib/groupRecordService');
const { openGroupRecordStore } = require('../lib/groupRecordStore');
const { getAccountDataPaths } = require('../lib/accountDataPaths');

function message(id, createTime, senderWxid, type = 1) {
  return {
    id,
    serverId: String(1000 + id),
    type,
    typeName: type === 3 ? 'image' : 'text',
    createTime,
    datetime: `2026-01-01 00:00:0${id}`,
    senderId: id,
    senderWxid,
    senderName: senderWxid === 'alice' ? 'Alice' : 'Bob',
    isSelf: false,
    content: type === 3 ? '[图片]' : `message-${id}`,
    extra: type === 3 ? { kind: 'image', md5: `image-${id}` } : null,
    status: 0,
  };
}

test('group record store persists indexed messages and supports filters', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wetrace-group-records-'));
  const dbPath = path.join(tmpDir, 'account', 'group-records.db');
  const username = 'group@chatroom';

  try {
    let store = await openGroupRecordStore(dbPath);
    store.storeGroup({
      username,
      displayName: 'Test group',
      sourceVersion: 'v1',
      replace: true,
      messages: [
        message(1, 100, 'alice'),
        message(2, 200, 'alice', 3),
        message(3, 300, 'bob'),
        message(4, 400, 'bob', 3),
      ],
    });
    store.save();
    store.close();

    assert.equal(fs.readFileSync(dbPath).subarray(0, 16).toString('binary'), 'SQLite format 3\u0000');

    store = await openGroupRecordStore(dbPath);
    assert.equal(store.getGroupInfo(username).messageCount, 4);
    assert.deepEqual(store.listMembers(username).map((item) => [item.wxid, item.messageCount]), [
      ['alice', 2],
      ['bob', 2],
    ]);

    const first = store.loadMessages({ username, limit: 2 });
    assert.deepEqual(first.messages.map((item) => item.id), [3, 4]);
    assert.equal(first.hasMore, true);
    const second = store.loadMessages({ username, limit: 2, cursor: first.nextCursor });
    assert.deepEqual(second.messages.map((item) => item.id), [1, 2]);
    assert.deepEqual(
      store.loadMessages({ username, senderWxids: ['alice'], imagesOnly: true }).messages.map((item) => item.id),
      [2]
    );

    store.storeGroup({
      username,
      displayName: 'Test group',
      sourceVersion: 'v2',
      messages: [message(5, 500, 'alice')],
    });
    assert.equal(store.getGroupInfo(username).messageCount, 5);
    store.save();
    store.close();
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('group record service builds once and merges newly decrypted messages', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wetrace-group-service-'));
  const accountDir = path.join(tmpDir, 'wxid_self_cabc');
  const decryptedDir = path.join(accountDir, 'db_storage_decrypted');
  const messageDir = path.join(decryptedDir, 'message');
  const messageDbPath = path.join(messageDir, 'message_0.db');
  const datasetDir = path.join(tmpDir, 'dataset');
  const recordDbPath = getAccountDataPaths(datasetDir).groupRecordDbPath;
  const legacyRecordDbPath = path.join(tmpDir, 'legacy', 'group-records.db');
  const username = 'service-test@chatroom';
  const table = `Msg_${crypto.createHash('md5').update(username).digest('hex')}`;
  const SQL = await initSqlJs({
    locateFile: (file) => path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist', file),
  });

  try {
    fs.mkdirSync(messageDir, { recursive: true });
    let db = new SQL.Database();
    db.run('CREATE TABLE Name2Id (rowid INTEGER PRIMARY KEY, user_name TEXT)');
    db.run("INSERT INTO Name2Id (rowid, user_name) VALUES (1, 'alice')");
    db.run(`CREATE TABLE ${table} (local_id INTEGER, server_id INTEGER, local_type INTEGER, sort_seq INTEGER, real_sender_id INTEGER, create_time INTEGER, status INTEGER, message_content TEXT, compress_content TEXT, source TEXT, WCDB_CT_message_content INTEGER)`);
    db.run(`INSERT INTO ${table} VALUES (1, 101, 1, 1, 1, 100, 0, 'first', '', '', 0)`);
    db.run(`INSERT INTO ${table} VALUES (2, 102, 1, 2, 1, 200, 0, 'second', '', '', 0)`);
    fs.writeFileSync(messageDbPath, Buffer.from(db.export()));
    db.close();
    fs.writeFileSync(path.join(decryptedDir, 'info.json'), JSON.stringify({ encrypted_fingerprint: 'v1' }));

    const first = await loadCachedConversationMessages({
      wxDir: accountDir,
      username,
      datasetDir,
      recordDbPath: legacyRecordDbPath,
      limit: 10,
    });
    assert.deepEqual(first.messages.map((item) => item.id), [1, 2]);
    assert.equal(fs.existsSync(recordDbPath), true);
    assert.equal(fs.existsSync(legacyRecordDbPath), false);

    db = new SQL.Database(fs.readFileSync(messageDbPath));
    db.run(`INSERT INTO ${table} VALUES (3, 103, 1, 3, 1, 300, 0, 'third', '', '', 0)`);
    fs.writeFileSync(messageDbPath, Buffer.from(db.export()));
    db.close();
    fs.writeFileSync(path.join(decryptedDir, 'info.json'), JSON.stringify({ encrypted_fingerprint: 'v2' }));

    const second = await loadCachedConversationMessages({
      wxDir: accountDir,
      username,
      datasetDir,
      recordDbPath: legacyRecordDbPath,
      limit: 10,
    });
    assert.deepEqual(second.messages.map((item) => item.id), [1, 2, 3]);
    assert.equal(new Set(second.messages.map((item) => item.id)).size, 3);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
