const crypto = require('crypto');
const { getDecryptedStorageFingerprint } = require('./decryptCore');
const {
  loadConversationMessagesSince,
  loadConversationSnapshot,
  resolveWxDir,
} = require('./exportCore');
const { openGroupRecordStore } = require('./groupRecordStore');
const { getAccountDataPaths } = require('./accountDataPaths');

function getSourceVersion(wxDir, decryptedDir = null) {
  return crypto
    .createHash('sha256')
    .update(getDecryptedStorageFingerprint(wxDir, decryptedDir))
    .digest('hex');
}

async function ensureGroupRecords(payload, store) {
  const wxDir = resolveWxDir(payload.wxDir);
  const sourceVersion = getSourceVersion(wxDir, payload.decryptedDir || null);
  const cached = store.getGroupInfo(payload.username);
  if (cached?.sourceVersion === sourceVersion) {
    return { ...cached, updated: false, addedMessages: 0 };
  }

  let chat;
  let replace = false;
  if (!cached) {
    chat = await loadConversationSnapshot({
      wxDir,
      username: payload.username,
      selfWxid: payload.selfWxid || null,
      decryptedDir: payload.decryptedDir || null,
    });
    replace = true;
  } else {
    chat = await loadConversationMessagesSince({
      wxDir,
      username: payload.username,
      sinceTime: cached.lastCreateTime,
      selfWxid: payload.selfWxid || null,
      decryptedDir: payload.decryptedDir || null,
    });
  }

  if (!chat) throw new Error('未找到该群聊的消息记录');
  const info = store.storeGroup({
    username: payload.username,
    displayName: chat.displayName,
    sourceVersion,
    messages: chat.messages,
    replace,
  });
  store.save();
  return {
    ...info,
    updated: true,
    addedMessages: Math.max(0, info.messageCount - (cached?.messageCount || 0)),
  };
}

async function withGroupStore(payload, callback) {
  const recordDbPath = getAccountDataPaths(payload.datasetDir).groupRecordDbPath;
  const store = await openGroupRecordStore(recordDbPath);
  try {
    const info = await ensureGroupRecords(payload, store);
    return callback(store, info);
  } finally {
    store.close();
  }
}

async function listCachedGroupMembers(payload) {
  return withGroupStore(payload, (store) => ({
    username: payload.username,
    members: store.listMembers(payload.username, payload.startTime),
  }));
}

async function loadCachedConversationMessages(payload) {
  return withGroupStore(payload, (store, info) => ({
    username: payload.username,
    displayName: info.displayName,
    ...store.loadMessages(payload),
  }));
}

async function refreshCachedGroupRecords(payload) {
  return withGroupStore(payload, (_store, info) => info);
}

module.exports = {
  ensureGroupRecords,
  listCachedGroupMembers,
  loadCachedConversationMessages,
  refreshCachedGroupRecords,
};
