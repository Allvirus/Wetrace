const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { getAccountLastActivity } = require('./accountActivity');
const crypto = require('crypto');
const { decompress } = require('fzstd');

const MSG_TYPE_MAP = {
  1: 'text',
  3: 'image',
  34: 'voice',
  42: 'card',
  43: 'video',
  47: 'emoji',
  48: 'location',
  49: 'link',
  10000: 'system',
  10002: 'revoke',
};

function getSqlJsLocateFile() {
  return (file) => {
    const candidates = [
      path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist', file),
    ];

    if (process.resourcesPath) {
      candidates.push(
        path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', 'sql.js', 'dist', file),
        path.join(process.resourcesPath, 'app', 'node_modules', 'sql.js', 'dist', file)
      );
    }

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }

    return candidates[0];
  };
}

function isWeChatAccountDir(dir) {
  return (
    fs.existsSync(path.join(dir, 'db_storage', 'message')) ||
    fs.existsSync(path.join(dir, 'db_storage_decrypted', 'message')) ||
    fs.existsSync(path.join(dir, 'db_storage', 'db_storage_decrypted', 'message'))
  );
}

function normalizeWxRootInput(inputPath) {
  const normalized = path.resolve(inputPath);
  if (!fs.existsSync(normalized)) {
    throw new Error(`路径不存在: ${normalized}`);
  }

  if (isWeChatAccountDir(normalized)) {
    return normalized;
  }

  if (path.basename(normalized) === 'db_storage_decrypted') {
    const parent = path.dirname(normalized);
    return isWeChatAccountDir(parent) ? parent : normalized;
  }

  if (path.basename(normalized) === 'db_storage') {
    const parent = path.dirname(normalized);
    return isWeChatAccountDir(parent) ? parent : normalized;
  }

  return normalized;
}

function parseAccountFolderName(folderName) {
  const match = folderName.match(/^(.+?)_c([a-f0-9]+)$/i);
  return {
    folderName,
    wxid: match ? match[1] : folderName,
    suffix: match ? match[2] : null,
  };
}

function describeAccountMode(summary) {
  if (summary.mode === 'encrypted' && !summary.hasDecrypted) {
    return '首次需解密';
  }
  if (summary.mode === 'decrypted' || summary.mode === 'both') {
    return '就绪';
  }
  return '未知';
}

function getAccountSummary(accountDir) {
  const parsed = parseAccountFolderName(path.basename(accountDir));
  const hasEncrypted = fs.existsSync(path.join(accountDir, 'db_storage', 'message'));
  const hasDecrypted =
    fs.existsSync(path.join(accountDir, 'db_storage_decrypted', 'message')) ||
    fs.existsSync(path.join(accountDir, 'db_storage', 'db_storage_decrypted', 'message'));
  const hasPassphraseCache = fs.existsSync(path.join(accountDir, '.wexin_passphrase'));

  let mode = 'unknown';
  if (hasEncrypted && hasDecrypted) mode = 'both';
  else if (hasEncrypted) mode = 'encrypted';
  else if (hasDecrypted) mode = 'decrypted';

  const summary = {
    path: accountDir,
    folderName: parsed.folderName,
    wxid: parsed.wxid,
    suffix: parsed.suffix,
    hasEncrypted,
    hasDecrypted,
    hasPassphraseCache,
    mode,
    ...getAccountLastActivity(accountDir),
  };
  summary.description = describeAccountMode(summary);
  summary.label = `${parsed.wxid}${summary.description ? `（${summary.description}）` : ''}`;
  return summary;
}

function scanWeChatAccounts(inputPath) {
  const normalized = normalizeWxRootInput(inputPath);

  if (isWeChatAccountDir(normalized)) {
    const summary = getAccountSummary(normalized);
    return {
      rootDir: path.dirname(normalized),
      inputPath: normalized,
      accounts: [summary],
      selectedPath: summary.path,
      needsAccountSelection: false,
    };
  }

  const entries = fs.readdirSync(normalized, { withFileTypes: true });
  const accounts = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(normalized, entry.name))
    .filter(isWeChatAccountDir)
    .map(getAccountSummary)
    .sort((a, b) => a.folderName.localeCompare(b.folderName));

  return {
    rootDir: normalized,
    inputPath: normalized,
    accounts,
    selectedPath: accounts.length === 1 ? accounts[0].path : null,
    needsAccountSelection: accounts.length > 1,
  };
}

function resolveWxDir(inputPath, options = {}) {
  const { accountPath = null } = options;

  if (accountPath) {
    const resolvedAccount = path.resolve(accountPath);
    if (!isWeChatAccountDir(resolvedAccount)) {
      throw new Error('所选不信账号目录无效，请重新选择');
    }
    return resolvedAccount;
  }

  const scan = scanWeChatAccounts(inputPath);

  if (scan.accounts.length === 0) {
    throw new Error(
      '未找到不信账号数据。\n' +
        '请选择 xwechat_files 目录，或包含 db_storage 的 wxid_xxx 账号目录。'
    );
  }

  if (scan.accounts.length === 1) {
    return scan.accounts[0].path;
  }

  throw new Error(
    `该目录下有 ${scan.accounts.length} 个不信账号，请选择要导出的账号。`
  );
}

function getWxDirStatus(inputPath, options = {}) {
  const scan = scanWeChatAccounts(inputPath);

  if (scan.accounts.length === 0) {
    throw new Error(
      '未找到不信账号数据。\n' +
        '请选择 xwechat_files 目录，或包含 db_storage 的 wxid_xxx 账号目录。'
    );
  }

  const accountPath = options.accountPath || scan.selectedPath;
  if (scan.needsAccountSelection && !accountPath) {
    return {
      resolved: null,
      rootDir: scan.rootDir,
      accounts: scan.accounts,
      needsAccountSelection: true,
      hasEncrypted: null,
      hasDecrypted: null,
      mode: null,
    };
  }

  const resolved = resolveWxDir(inputPath, { accountPath });
  const summary = scan.accounts.find((item) => item.path === resolved) || getAccountSummary(resolved);
  const hasEncrypted = summary.hasEncrypted;
  const hasDecrypted = summary.hasDecrypted;
  const mode = summary.mode;

  return {
    resolved,
    rootDir: scan.rootDir,
    accounts: scan.accounts,
    needsAccountSelection: false,
    selectedAccount: summary,
    hasEncrypted,
    hasDecrypted,
    mode,
  };
}

function resolveDecryptedDir(wxDir, preferredDir = null) {
  if (preferredDir) {
    const resolvedPreferred = path.resolve(preferredDir);
    if (fs.existsSync(path.join(resolvedPreferred, 'message'))) return resolvedPreferred;
    throw new Error(`未找到 db_storage_decrypted: ${resolvedPreferred}`);
  }
  const direct = path.join(wxDir, 'db_storage_decrypted');
  if (fs.existsSync(direct)) return direct;

  const nested = path.join(wxDir, 'db_storage', 'db_storage_decrypted');
  if (fs.existsSync(nested)) return nested;

  throw new Error(`未找到 db_storage_decrypted: ${wxDir}`);
}

function inferSelfWxid(wxDir, selfWxid) {
  if (selfWxid) return selfWxid;
  return path.basename(wxDir).replace(/_c[a-f0-9]+$/i, '');
}

function usernameToTable(username) {
  return `Msg_${crypto.createHash('md5').update(username).digest('hex')}`;
}

function safeFilename(name, fallback) {
  const base = (name || fallback || 'unknown')
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
  return base || 'unknown';
}

function isCommaByteList(value) {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  return trimmed.includes(',') && /^\d+(,\d+)*$/.test(trimmed);
}

function toBuffer(value) {
  if (value == null) return null;
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value);
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (isCommaByteList(trimmed)) {
      return Buffer.from(trimmed.split(',').map((n) => Number(n)));
    }
    return Buffer.from(value, 'utf8');
  }
  return Buffer.from(String(value));
}

function bufferToText(buf) {
  if (!buf || buf.length === 0) return '';
  const text = buf.toString('utf8');
  if (text.includes('\uFFFD') && buf.some((b) => b === 0)) {
    return null;
  }
  return text;
}

function looksLikeZstd(buf) {
  return (
    buf &&
    buf.length >= 4 &&
    buf[0] === 0x28 &&
    buf[1] === 0xb5 &&
    buf[2] === 0x2f &&
    buf[3] === 0xfd
  );
}

function tryZstdDecompress(buffer) {
  if (!buffer || buffer.length === 0) return null;
  try {
    const decoded = Buffer.from(decompress(buffer));
    return bufferToText(decoded);
  } catch {
    return null;
  }
}

function decodeContent(messageContent, compressContent, contentType) {
  const ct = Number(contentType) || 0;

  if (ct === 4) {
    for (const field of [messageContent, compressContent]) {
      const text = tryZstdDecompress(toBuffer(field));
      if (text) return text;
    }
  }

  if (typeof messageContent === 'string' && messageContent.length > 0 && !isCommaByteList(messageContent)) {
    return messageContent;
  }

  const raw = toBuffer(messageContent);
  if (raw && raw.length > 0) {
    const decompressed = tryZstdDecompress(raw);
    if (decompressed) return decompressed;

    const text = bufferToText(raw);
    if (text && !looksLikeZstd(raw)) return text;
  }

  if (typeof compressContent === 'string' && compressContent.length > 0 && !isCommaByteList(compressContent)) {
    return compressContent;
  }

  const rawCompress = toBuffer(compressContent);
  if (rawCompress && rawCompress.length > 0) {
    const decompressed = tryZstdDecompress(rawCompress);
    if (decompressed) return decompressed;

    const text = bufferToText(rawCompress);
    if (text) return text;
  }

  return '';
}

function formatLocalDateTime(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function formatDateTime(unixSeconds) {
  if (!unixSeconds) return null;
  return formatLocalDateTime(new Date(unixSeconds * 1000));
}

const { enrichMessage } = require('./messageParser');
const {
  createMessageDbPool,
  queryTableRows,
  queryTableRowsPage,
  queryTableRowsSince,
} = require('./messageDbPool');
const {
  filterViewerMessages,
  isImageMessage,
  matchesViewerFilters,
  normalizeSenderFilter,
} = require('./viewerCore');

function parseGroupContent(content) {
  if (!content || !content.includes(':\n')) {
    return { senderWxid: null, body: content || '' };
  }
  const idx = content.indexOf(':\n');
  const senderWxid = content.slice(0, idx);
  const body = content.slice(idx + 2);
  if (/^(wxid_|[^@\s]+@)/.test(senderWxid)) {
    return { senderWxid, body };
  }
  return { senderWxid: null, body: content };
}

function openDatabase(SQL, filePath) {
  return new SQL.Database(fs.readFileSync(filePath));
}

function queryAll(db, sql) {
  const result = db.exec(sql);
  if (!result[0]) return [];
  const { columns, values } = result[0];
  return values.map((row) => Object.fromEntries(columns.map((col, i) => [col, row[i]])));
}

function loadContacts(decryptedDir, SQL) {
  const contacts = {};
  const contactDbPath = path.join(decryptedDir, 'contact', 'contact.db');
  if (!fs.existsSync(contactDbPath)) return contacts;

  const db = openDatabase(SQL, contactDbPath);
  try {
    for (const row of queryAll(
      db,
      'SELECT username, remark, nick_name FROM contact WHERE username IS NOT NULL'
    )) {
      contacts[row.username] = row.remark || row.nick_name || row.username;
    }
    for (const row of queryAll(
      db,
      'SELECT username, remark, nick_name FROM stranger WHERE username IS NOT NULL'
    )) {
      if (!contacts[row.username]) {
        contacts[row.username] = row.remark || row.nick_name || row.username;
      }
    }
  } finally {
    db.close();
  }
  return contacts;
}

function loadSessions(decryptedDir, SQL) {
  const sessions = {};
  const sessionDbPath = path.join(decryptedDir, 'session', 'session.db');
  if (!fs.existsSync(sessionDbPath)) return sessions;

  const db = openDatabase(SQL, sessionDbPath);
  try {
    for (const row of queryAll(
      db,
      'SELECT username, type, summary, last_sender_display_name, last_timestamp, sort_timestamp FROM SessionTable'
    )) {
      sessions[row.username] = {
        sessionType: row.type,
        summary: row.summary || '',
        lastSender: row.last_sender_display_name || '',
        lastTimestamp: row.last_timestamp || 0,
        sortTimestamp: row.sort_timestamp || 0,
      };
    }
  } finally {
    db.close();
  }
  return sessions;
}

function loadSenderMap(db) {
  const senderMap = {};
  if (!tableExists(db, 'Name2Id')) return senderMap;
  for (const row of queryAll(db, 'SELECT rowid, user_name FROM Name2Id')) {
    if (row.user_name) senderMap[row.rowid] = row.user_name;
  }
  return senderMap;
}

function collectUsernamesFromMessageDbs(msgDbs, SQL) {
  const usernames = new Set();
  for (const dbPath of msgDbs) {
    const db = openDatabase(SQL, dbPath);
    try {
      if (!tableExists(db, 'Name2Id')) continue;
      for (const row of queryAll(db, "SELECT user_name FROM Name2Id WHERE user_name != ''")) {
        usernames.add(row.user_name);
      }
    } finally {
      db.close();
    }
  }
  return usernames;
}

function enrichUsernamesFromSessions(usernames, sessions) {
  if (usernames.size > 0) return usernames;
  for (const username of Object.keys(sessions)) {
    if (username) usernames.add(username);
  }
  return usernames;
}

function getMessageDbs(decryptedDir) {
  const msgDir = path.join(decryptedDir, 'message');
  if (!fs.existsSync(msgDir)) return [];
  return fs
    .readdirSync(msgDir)
    .filter((name) => /^message_\d+\.db$/.test(name))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .map((name) => path.join(msgDir, name));
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

function getMessageDbKey(dbPath) {
  return path.basename(dbPath);
}

function getMessageDbFingerprint(dbPath) {
  const stat = fs.statSync(dbPath);
  return `${path.basename(dbPath)}:${stat.size}`;
}

function buildTableToUsername(usernames) {
  const tableToUsername = new Map();
  for (const username of usernames) {
    tableToUsername.set(usernameToTable(username), username);
  }
  return tableToUsername;
}

function scanMessageDbCounts(dbPath, SQL, tableToUsername) {
  const counts = {};
  const db = openDatabase(SQL, dbPath);
  try {
    for (const { name: table } of listMsgTables(db)) {
      const username = tableToUsername.get(table);
      if (!username) continue;

      const result = db.exec(
        `SELECT count(*) AS c, sum(CASE WHEN local_type = 34 THEN 1 ELSE 0 END) AS v, min(CASE WHEN create_time > 0 THEN create_time END) AS min_t, max(CASE WHEN create_time > 0 THEN create_time END) AS max_t FROM "${table}"`
      );
      const values = result[0]?.values?.[0];
      if (!values) continue;

      const count = Number(values[0]) || 0;
      if (count <= 0) continue;

      counts[username] = [
        count,
        Number(values[1]) || 0,
        Number(values[2]) || 0,
        Number(values[3]) || 0,
      ];
    }
  } finally {
    db.close();
  }
  return counts;
}

function mergeDbStatsToCounts(dbStats) {
  const messageCounts = new Map();
  const voiceCounts = new Map();
  const timestampRanges = new Map();

  for (const entry of Object.values(dbStats || {})) {
    if (!entry?.counts) continue;
    for (const [username, pair] of Object.entries(entry.counts)) {
      const messageCount = Array.isArray(pair) ? pair[0] || 0 : 0;
      const voiceCount = Array.isArray(pair) ? pair[1] || 0 : 0;
      const minTime = Array.isArray(pair) ? Number(pair[2]) || 0 : 0;
      const maxTime = Array.isArray(pair) ? Number(pair[3]) || 0 : 0;
      messageCounts.set(username, (messageCounts.get(username) || 0) + messageCount);
      voiceCounts.set(username, (voiceCounts.get(username) || 0) + voiceCount);
      if (minTime > 0 || maxTime > 0) {
        const existing = timestampRanges.get(username);
        if (!existing) {
          timestampRanges.set(username, {
            first: minTime > 0 ? minTime : 0,
            last: maxTime > 0 ? maxTime : 0,
          });
        } else {
          if (minTime > 0) {
            existing.first = existing.first > 0 ? Math.min(existing.first, minTime) : minTime;
          }
          if (maxTime > 0) {
            existing.last = Math.max(existing.last || 0, maxTime);
          }
        }
      }
    }
  }

  return { messageCounts, voiceCounts, timestampRanges };
}

function buildMessageAndVoiceCounts(msgDbs, SQL, usernames, onProgress) {
  const tableToUsername = buildTableToUsername(usernames);
  const dbStats = {};
  const totalDbs = msgDbs.length;

  const reportDbProgress = (current, message) => {
    if (!onProgress || totalDbs <= 0) return;
    onProgress({
      phase: 'scan',
      subphase: 'counting',
      countingScope: 'message_dbs',
      current,
      total: totalDbs,
      message: message || `正在统计消息库 ${current} / ${totalDbs}`,
    });
  };

  reportDbProgress(0);

  for (let dbIndex = 0; dbIndex < msgDbs.length; dbIndex += 1) {
    const dbPath = msgDbs[dbIndex];
    const key = getMessageDbKey(dbPath);
    dbStats[key] = {
      fingerprint: getMessageDbFingerprint(dbPath),
      counts: scanMessageDbCounts(dbPath, SQL, tableToUsername),
    };
    reportDbProgress(dbIndex + 1);
  }

  const { messageCounts, voiceCounts, timestampRanges } = mergeDbStatsToCounts(dbStats);
  return { messageCounts, voiceCounts, timestampRanges, dbStats };
}

function dbStatsCountsIncludeTimestamps(counts) {
  if (!counts || typeof counts !== 'object') {
    return false;
  }
  for (const pair of Object.values(counts)) {
    if (!Array.isArray(pair) || pair.length < 4) {
      return false;
    }
  }
  return true;
}

function buildMessageAndVoiceCountsIncremental(msgDbs, SQL, usernames, previousDbStats, onProgress) {
  const tableToUsername = buildTableToUsername(usernames);
  const dbStats = {};
  const totalDbs = msgDbs.length;
  let reused = 0;

  const reportDbProgress = (current, message) => {
    if (!onProgress || totalDbs <= 0) return;
    onProgress({
      phase: 'scan',
      subphase: 'counting',
      countingScope: 'message_dbs',
      current,
      total: totalDbs,
      message: message || `正在统计消息库 ${current} / ${totalDbs}`,
    });
  };

  reportDbProgress(0, '正在增量更新会话统计…');

  for (let dbIndex = 0; dbIndex < msgDbs.length; dbIndex += 1) {
    const dbPath = msgDbs[dbIndex];
    const key = getMessageDbKey(dbPath);
    const fingerprint = getMessageDbFingerprint(dbPath);
    const cached = previousDbStats?.[key];

    if (
      cached?.fingerprint === fingerprint &&
      cached?.counts &&
      dbStatsCountsIncludeTimestamps(cached.counts)
    ) {
      dbStats[key] = cached;
      reused += 1;
    } else {
      dbStats[key] = {
        fingerprint,
        counts: scanMessageDbCounts(dbPath, SQL, tableToUsername),
      };
    }

    const progressMessage =
      reused > 0
        ? `增量更新消息库 ${dbIndex + 1} / ${totalDbs}（已复用 ${reused} 个）`
        : `正在统计消息库 ${dbIndex + 1} / ${totalDbs}`;
    reportDbProgress(dbIndex + 1, progressMessage);
  }

  const { messageCounts, voiceCounts, timestampRanges } = mergeDbStatsToCounts(dbStats);
  return { messageCounts, voiceCounts, timestampRanges, dbStats, reused, rescanned: totalDbs - reused };
}

async function listConversations({
  wxDir,
  selfWxid,
  decryptedDir: configuredDecryptedDir = null,
  skipDecrypt = true,
  onProgress,
  incrementalBase = null,
  forceFullScan = false,
}) {
  const resolvedWxDir = resolveWxDir(wxDir);
  if (!skipDecrypt) {
    const { ensureDecrypted } = require('./decryptCore');
    await ensureDecrypted({
      wxDir: resolvedWxDir,
      forceDecrypt: false,
      loginCapture: true,
      decryptedDir: configuredDecryptedDir,
    });
  }

  const decryptedDir = resolveDecryptedDir(resolvedWxDir, configuredDecryptedDir);
  const resolvedSelfWxid = inferSelfWxid(resolvedWxDir, selfWxid);
  const SQL = await createSqlEngine();
  const contacts = loadContacts(decryptedDir, SQL);
  const sessions = loadSessions(decryptedDir, SQL);
  const msgDbs = getMessageDbs(decryptedDir);

  if (msgDbs.length === 0) {
    throw new Error('未找到 message_0.db 等消息数据库文件');
  }

  const usernames = enrichUsernamesFromSessions(
    collectUsernamesFromMessageDbs(msgDbs, SQL),
    sessions
  );

  const usernameList = [...usernames];
  const canIncremental =
    !forceFullScan && incrementalBase?.dbStats && Object.keys(incrementalBase.dbStats).length > 0;

  let messageCounts;
  let voiceCounts;
  let timestampRanges;
  let dbStats;
  let incrementalMeta = null;

  if (canIncremental) {
    const incrementalResult = buildMessageAndVoiceCountsIncremental(
      msgDbs,
      SQL,
      usernameList,
      incrementalBase.dbStats,
      onProgress
    );
    messageCounts = incrementalResult.messageCounts;
    voiceCounts = incrementalResult.voiceCounts;
    timestampRanges = incrementalResult.timestampRanges;
    dbStats = incrementalResult.dbStats;
    incrementalMeta = {
      reusedDbCount: incrementalResult.reused,
      rescannedDbCount: incrementalResult.rescanned,
    };
  } else {
    const fullResult = buildMessageAndVoiceCounts(msgDbs, SQL, usernameList, onProgress);
    messageCounts = fullResult.messageCounts;
    voiceCounts = fullResult.voiceCounts;
    timestampRanges = fullResult.timestampRanges;
    dbStats = fullResult.dbStats;
  }

  onProgress?.({
    phase: 'scan',
    subphase: 'counting',
    countingScope: 'sessions',
    current: 0,
    total: usernameList.length,
    message: '正在整理会话列表…',
  });

  const conversations = [];
  for (const username of usernameList) {
    const messageCount = messageCounts.get(username) || 0;
    if (messageCount === 0) continue;

    const isGroup = username.includes('@chatroom');
    const displayName = contacts[username] || username;
    const session = sessions[username] || {};
    const ts = timestampRanges.get(username) || {};

    conversations.push({
      username,
      displayName,
      type: isGroup ? 'group' : 'private',
      messageCount,
      voiceCount: voiceCounts.get(username) || 0,
      firstTimestamp: ts.first || 0,
      lastTimestamp: ts.last || session.lastTimestamp || 0,
      summary: session.summary || '',
    });
  }

  onProgress?.({
    phase: 'scan',
    subphase: 'counting',
    countingScope: 'sessions',
    current: usernameList.length,
    total: usernameList.length,
    message: `已统计 ${conversations.length} 个有消息的会话`,
  });

  conversations.sort((a, b) => b.messageCount - a.messageCount);

  return {
    wxDir: resolvedWxDir,
    selfWxid: resolvedSelfWxid,
    conversationCount: conversations.length,
    totalMessages: conversations.reduce((sum, item) => sum + item.messageCount, 0),
    totalVoiceMessages: conversations.reduce((sum, item) => sum + (item.voiceCount || 0), 0),
    conversations,
    dbStats,
    incremental: incrementalMeta,
  };
}

function matchesTimeRange(createTime, timeRange) {
  if (!timeRange || timeRange.mode !== 'range') {
    return true;
  }
  const timestamp = Number(createTime) || 0;
  if (timeRange.startTime != null && timestamp < timeRange.startTime) {
    return false;
  }
  if (timeRange.endTime != null && timestamp > timeRange.endTime) {
    return false;
  }
  return true;
}

function countMessagesInRange(pool, username, startTime, endTime) {
  const table = usernameToTable(username);
  const dbPaths = pool.getDbPathsForTable(table);
  if (dbPaths.length === 0) {
    return { messageCount: 0, voiceCount: 0 };
  }

  let messageCount = 0;
  let voiceCount = 0;
  const start = Number(startTime) || 0;
  const end = Number(endTime) || 0;

  for (const dbPath of dbPaths) {
    const db = pool.getDb(dbPath);
    const result = db.exec(
      `SELECT count(*) AS c, sum(CASE WHEN local_type = 34 THEN 1 ELSE 0 END) AS v FROM "${table}" WHERE create_time >= ${start} AND create_time <= ${end}`
    );
    const values = result[0]?.values?.[0];
    if (!values) continue;
    messageCount += Number(values[0]) || 0;
    voiceCount += Number(values[1]) || 0;
  }

  return { messageCount, voiceCount };
}

function getTimeBoundsFromPool(pool, username) {
  const table = usernameToTable(username);
  const dbPaths = pool.getDbPathsForTable(table);
  if (dbPaths.length === 0) {
    return { firstTimestamp: 0, lastTimestamp: 0 };
  }

  let firstTimestamp = 0;
  let lastTimestamp = 0;

  for (const dbPath of dbPaths) {
    const db = pool.getDb(dbPath);
    const result = db.exec(
      `SELECT min(CASE WHEN create_time > 0 THEN create_time END) AS min_t, max(CASE WHEN create_time > 0 THEN create_time END) AS max_t FROM "${table}"`
    );
    const values = result[0]?.values?.[0];
    if (!values) continue;

    const minTime = Number(values[0]) || 0;
    const maxTime = Number(values[1]) || 0;
    if (minTime > 0 && (!firstTimestamp || minTime < firstTimestamp)) {
      firstTimestamp = minTime;
    }
    if (maxTime > 0 && maxTime > lastTimestamp) {
      lastTimestamp = maxTime;
    }
  }

  return { firstTimestamp, lastTimestamp };
}

async function getConversationTimeBounds({ wxDir, username, decryptedDir: configuredDecryptedDir = null }) {
  const resolvedWxDir = resolveWxDir(wxDir);
  const decryptedDir = resolveDecryptedDir(resolvedWxDir, configuredDecryptedDir);
  const msgDbs = getMessageDbs(decryptedDir);
  if (msgDbs.length === 0) {
    throw new Error('未找到 message_0.db 等消息数据库文件');
  }

  const SQL = await createSqlEngine();
  const pool = createMessageDbPool(SQL, msgDbs);
  try {
    return getTimeBoundsFromPool(pool, username);
  } finally {
    pool.close();
  }
}

async function countConversationMessagesInRange({
  wxDir,
  username,
  startTime,
  endTime,
  decryptedDir: configuredDecryptedDir = null,
}) {
  const resolvedWxDir = resolveWxDir(wxDir);
  const decryptedDir = resolveDecryptedDir(resolvedWxDir, configuredDecryptedDir);
  const msgDbs = getMessageDbs(decryptedDir);
  if (msgDbs.length === 0) {
    throw new Error('未找到 message_0.db 等消息数据库文件');
  }

  const SQL = await createSqlEngine();
  const pool = createMessageDbPool(SQL, msgDbs);
  try {
    return countMessagesInRange(pool, username, startTime, endTime);
  } finally {
    pool.close();
  }
}

function buildFriendlyMessage(row, senderMap, { isGroup, contacts, selfWxid }) {
  const type = Number(row.local_type);
  const decoded = decodeContent(
    row.message_content,
    row.compress_content,
    row.WCDB_CT_message_content
  );
  let senderWxid = senderMap[row.real_sender_id] || null;
  let body = decoded;

  if (isGroup) {
    const parsed = parseGroupContent(decoded);
    if (parsed.senderWxid) {
      senderWxid = parsed.senderWxid;
      body = parsed.body;
    }
  }

  const enriched = enrichMessage(type, body, contacts);
  return {
    id: row.local_id,
    serverId: row.server_id != null ? String(row.server_id) : null,
    type,
    typeName: MSG_TYPE_MAP[type] || `type_${type}`,
    createTime: row.create_time,
    datetime: formatDateTime(row.create_time),
    sortSeq: row.sort_seq,
    senderId: row.real_sender_id,
    senderWxid,
    senderName: senderWxid ? contacts[senderWxid] || senderWxid : null,
    isSelf: senderWxid === selfWxid,
    content: enriched.content,
    extra: enriched.extra,
    status: row.status,
  };
}

function exportConversation({
  pool,
  username,
  contacts,
  selfWxid,
  timeRange = null,
  onProgress = null,
  shouldCancel = null,
  progressMeta = null,
}) {
  const table = usernameToTable(username);
  const dbPaths = pool.getDbPathsForTable(table);
  if (dbPaths.length === 0) {
    return null;
  }

  const isGroup = username.includes('@chatroom');
  const displayName = contacts[username] || username;
  const rowMap = new Map();

  for (const dbPath of dbPaths) {
    const db = pool.getDb(dbPath);
    const senderMap = pool.senderMaps.get(dbPath) || {};
    const rows = queryTableRows(db, table);
    for (const row of rows) {
      const key = `${row.create_time}:${row.local_id}:${row.server_id}`;
      if (rowMap.has(key)) continue;
      rowMap.set(key, { row, senderMap });
    }
  }

  const sortedRows = [...rowMap.values()].sort((a, b) => {
    if (a.row.create_time !== b.row.create_time) {
      return a.row.create_time - b.row.create_time;
    }
    return a.row.local_id - b.row.local_id;
  }).filter(({ row }) => matchesTimeRange(row.create_time, timeRange));

  const totalRows = sortedRows.length;
  if (onProgress && totalRows > 0) {
    onProgress({
      phase: 'exporting',
      subphase: 'reading',
      displayName,
      chatMessagesDone: 0,
      chatMessagesTotal: totalRows,
      ...progressMeta,
    });
  }

  const progressStep = totalRows >= 10000 ? 5000 : totalRows >= 3000 ? 2000 : 0;
  const messages = [];

  for (let i = 0; i < sortedRows.length; i += 1) {
    if (shouldCancel?.() && i > 0 && i % 1000 === 0) {
      throw new Error('导出已取消');
    }

    const { row, senderMap } = sortedRows[i];
    messages.push(buildFriendlyMessage(row, senderMap, { isGroup, contacts, selfWxid }));

    if (
      onProgress &&
      progressStep > 0 &&
      ((i + 1) % progressStep === 0 || i + 1 === totalRows)
    ) {
      onProgress({
        phase: 'exporting',
        subphase: 'reading',
        displayName,
        chatMessagesDone: i + 1,
        chatMessagesTotal: totalRows,
        ...progressMeta,
      });
    }
  }

  return {
    username,
    displayName,
    type: isGroup ? 'group' : 'private',
    dbFiles: dbPaths.map((p) => path.basename(p)),
    messageCount: messages.length,
    messages,
  };
}

async function loadConversationSnapshot({
  wxDir,
  username,
  selfWxid = null,
  decryptedDir: configuredDecryptedDir = null,
}) {
  const resolvedWxDir = resolveWxDir(wxDir);
  const decryptedDir = resolveDecryptedDir(resolvedWxDir, configuredDecryptedDir);
  const SQL = await createSqlEngine();
  const contacts = loadContacts(decryptedDir, SQL);
  const pool = createMessageDbPool(SQL, getMessageDbs(decryptedDir));
  try {
    return exportConversation({
      pool,
      username,
      contacts,
      selfWxid: inferSelfWxid(resolvedWxDir, selfWxid),
    });
  } finally {
    pool.close();
  }
}

async function loadConversationMessagesSince({
  wxDir,
  username,
  sinceTime = 0,
  selfWxid = null,
  decryptedDir: configuredDecryptedDir = null,
}) {
  const resolvedWxDir = resolveWxDir(wxDir);
  const decryptedDir = resolveDecryptedDir(resolvedWxDir, configuredDecryptedDir);
  const SQL = await createSqlEngine();
  const contacts = loadContacts(decryptedDir, SQL);
  const pool = createMessageDbPool(SQL, getMessageDbs(decryptedDir));
  const table = usernameToTable(username);
  const isGroup = String(username || '').includes('@chatroom');
  const resolvedSelfWxid = inferSelfWxid(resolvedWxDir, selfWxid);
  const rowMap = new Map();

  try {
    for (const dbPath of pool.getDbPathsForTable(table)) {
      const senderMap = pool.senderMaps.get(dbPath) || {};
      for (const row of queryTableRowsSince(pool.getDb(dbPath), table, sinceTime)) {
        const key = `${row.create_time}:${row.local_id}:${row.server_id}`;
        if (!rowMap.has(key)) rowMap.set(key, { row, senderMap });
      }
    }
  } finally {
    pool.close();
  }

  const messages = [...rowMap.values()]
    .sort((a, b) => {
      if (a.row.create_time !== b.row.create_time) return a.row.create_time - b.row.create_time;
      return a.row.local_id - b.row.local_id;
    })
    .map(({ row, senderMap }) =>
      buildFriendlyMessage(row, senderMap, {
        isGroup,
        contacts,
        selfWxid: resolvedSelfWxid,
      })
    );

  return {
    username,
    displayName: contacts[username] || username,
    type: isGroup ? 'group' : 'private',
    messageCount: messages.length,
    messages,
  };
}

function collectPagedConversationRows(pool, table, cursor, fetchLimit) {
  const rowMap = new Map();
  let sourceHasMore = false;

  for (const dbPath of pool.getDbPathsForTable(table)) {
    const db = pool.getDb(dbPath);
    const senderMap = pool.senderMaps.get(dbPath) || {};
    const rows = queryTableRowsPage(db, table, {
      beforeTime: cursor?.beforeTime,
      beforeLocalId: cursor?.beforeLocalId,
      limit: fetchLimit,
    });
    if (rows.length === fetchLimit) sourceHasMore = true;
    for (const row of rows) {
      const key = `${row.create_time}:${row.local_id}:${row.server_id}`;
      if (!rowMap.has(key)) rowMap.set(key, { row, senderMap });
    }
  }

  return {
    rows: [...rowMap.values()].sort((a, b) => {
      if (a.row.create_time !== b.row.create_time) {
        return b.row.create_time - a.row.create_time;
      }
      return b.row.local_id - a.row.local_id;
    }),
    sourceHasMore,
  };
}

function setViewerImagePreviews(message, relativePaths, outputDir) {
  message.previewImages = relativePaths.map((relativePath) => ({
    url: pathToFileURL(path.join(outputDir, ...relativePath.split('/'))).href,
    relativePath,
  }));
}

function attachViewerImagePreviews(messages, outputDir) {
  for (const message of messages) {
    const relativePaths = [];
    if (message.extra?.outputImagePath) relativePaths.push(message.extra.outputImagePath);
    for (const item of message.extra?.recordItems || []) {
      if (item?.outputImagePath) relativePaths.push(item.outputImagePath);
    }
    setViewerImagePreviews(message, relativePaths, outputDir);
  }
}

function getExpectedMessageImageCount(message) {
  let count = Number(message?.type) === 3 || message?.extra?.kind === 'image' ? 1 : 0;
  count += (message?.extra?.recordItems || []).filter((item) => item?.kind === 'image').length;
  return count;
}
async function resolveConversationImages({
  wxDir,
  username,
  messages,
  decryptedDir: configuredDecryptedDir = null,
  imageKeyCacheDir = null,
  imageOutputDir,
  chatFileBase = null,
  imageLayout = 'export',
  useLegacyExportParser = false,
  imageContextRef = null,
  existingOnly = false,
  keysPath = null,
  onProgress = null,
  progressMeta = null,
}) {
  const imageMessages = (messages || []).filter(isImageMessage);
  if (!imageMessages.length) return { previews: [] };
  const groupLabel = progressMeta?.displayName || username;
  const reportProgress = (subphase, message, extra = null) => {
    onProgress?.({
      ...(progressMeta || {}),
      phase: 'image-resolve',
      subphase,
      message,
      ...(extra || {}),
    });
  };
  const resolvedWxDir = resolveWxDir(wxDir);
  const {
    findExistingMessageImagePaths,
    initImageExportContext,
    exportChatImages,
    getImageExportDebugInfo,
  } = require('./imageMedia');
  fs.mkdirSync(imageOutputDir, { recursive: true });
  const groupCacheKey = crypto.createHash('sha256').update(username).digest('hex').slice(0, 10);
  const resolvedChatFileBase = chatFileBase || `group_${groupCacheKey}`;
  const pending = [];
  let reused = 0;
  for (const message of imageMessages) {
    const existing = findExistingMessageImagePaths(
      imageOutputDir,
      resolvedChatFileBase,
      message,
      imageLayout
    );
    if (existing.length > 0) {
      reused += existing.length;
      setViewerImagePreviews(message, existing, imageOutputDir);
    }
    if (existing.length < getExpectedMessageImageCount(message)) {
      pending.push(message);
    }
  }
  if (reused > 0) {
    reportProgress('cache', `已复用「${groupLabel}」的 ${reused} 张本地图片`);
  }
  let imageStats = { total: 0, exported: 0, failed: 0, reasonCounts: {} };
  if (existingOnly && pending.length > 0) {
    reportProgress(
      'cache-only',
      '本地暂无「' + groupLabel + '」的 ' + pending.length + ' 张图片，等待手动刷新重试'
    );
  }
  if (pending.length > 0 && !existingOnly) {
    const expectedContentScan = Boolean(useLegacyExportParser);
    const expectedStrictMatch = !useLegacyExportParser;
    let imageCtx = imageContextRef?.current || null;
    if (
      imageCtx &&
      (
        imageCtx.outputDir !== imageOutputDir ||
        imageCtx.outputLayout !== imageLayout ||
        imageCtx.allowContentScan !== expectedContentScan ||
        imageCtx.strictMatch !== expectedStrictMatch
      )
    ) {
      imageCtx = null;
    }
    if (!imageCtx) {
      reportProgress('index', '正在建立不信图片索引，首次处理可能需要一些时间');
      const decryptedDir = resolveDecryptedDir(resolvedWxDir, configuredDecryptedDir);
      const SQL = await createSqlEngine();
      imageCtx = initImageExportContext({
        accountDir: resolvedWxDir,
        decryptedDir,
        outputDir: imageOutputDir,
        keyCacheDir: imageKeyCacheDir,
        SQL,
        keysPath,
        logger: onProgress,
        allowContentScan: expectedContentScan,
        strictMatch: expectedStrictMatch,
        outputLayout: imageLayout,
      });
      if (imageContextRef) imageContextRef.current = imageCtx;
      const debugInfo = getImageExportDebugInfo(imageCtx);
      reportProgress(
        'index-ready',
        `图片索引已建立，共发现 ${debugInfo?.fileCount || 0} 个候选文件`,
        { imageDebug: debugInfo }
      );
    } else {
      imageCtx.decodeState.logger = onProgress;
      reportProgress('index-reuse', '正在复用已建立的不信图片索引');
    }
    reportProgress('parsing', `正在解析「${groupLabel}」的 ${pending.length} 条含图片消息`);
    imageStats = exportChatImages({ messages: pending }, imageCtx, resolvedChatFileBase);
    for (const message of pending) {
      const resolved = findExistingMessageImagePaths(
        imageOutputDir,
        resolvedChatFileBase,
        message,
        imageLayout
      );
      setViewerImagePreviews(message, resolved, imageOutputDir);
    }
    reportProgress(
      'done',
      `「${groupLabel}」图片解析完成：成功 ${imageStats.exported}，失败 ${imageStats.failed}`,
      { imageStats }
    );
  }
  return {
    imageStats: {
      ...imageStats,
      reused,
    },
    previews: imageMessages.map((message) => ({
      id: message.id,
      serverId: message.serverId,
      createTime: message.createTime,
      previewImages: message.previewImages || [],
    })),
  };
}

async function listGroupMembers({
  wxDir,
  username,
  selfWxid = null,
  decryptedDir: configuredDecryptedDir = null,
}) {
  if (!String(username || '').includes('@chatroom')) {
    throw new Error('请选择群聊会话');
  }

  const resolvedWxDir = resolveWxDir(wxDir);
  const decryptedDir = resolveDecryptedDir(resolvedWxDir, configuredDecryptedDir);
  const SQL = await createSqlEngine();
  const contacts = loadContacts(decryptedDir, SQL);
  const msgDbs = getMessageDbs(decryptedDir);
  const pool = createMessageDbPool(SQL, msgDbs);
  const resolvedSelfWxid = inferSelfWxid(resolvedWxDir, selfWxid);
  const table = usernameToTable(username);
  const counts = new Map();

  try {
    for (const dbPath of pool.getDbPathsForTable(table)) {
      const db = pool.getDb(dbPath);
      const senderMap = pool.senderMaps.get(dbPath) || {};
      const rows = queryAll(
        db,
        `SELECT real_sender_id AS sender_id, count(*) AS c FROM "${table}" GROUP BY real_sender_id`
      );
      for (const row of rows) {
        const wxid = senderMap[row.sender_id];
        if (!wxid) continue;
        counts.set(wxid, (counts.get(wxid) || 0) + (Number(row.c) || 0));
      }

      for (const row of queryTableRowsPage(db, table, { limit: 1000 })) {
        if (senderMap[row.real_sender_id]) continue;
        const message = buildFriendlyMessage(row, senderMap, {
          isGroup: true,
          contacts,
          selfWxid: resolvedSelfWxid,
        });
        if (!message.senderWxid) continue;
        counts.set(message.senderWxid, (counts.get(message.senderWxid) || 0) + 1);
      }
    }
  } finally {
    pool.close();
  }

  const members = [...counts.entries()]
    .map(([wxid, messageCount]) => ({
      wxid,
      displayName: contacts[wxid] || wxid,
      messageCount,
      isSelf: wxid === resolvedSelfWxid,
    }))
    .sort((a, b) => {
      if (a.isSelf !== b.isSelf) return a.isSelf ? -1 : 1;
      return a.displayName.localeCompare(b.displayName, 'zh-CN');
    });

  return { username, members, selfWxid: resolvedSelfWxid };
}

async function loadConversationMessages({
  wxDir,
  username,
  selfWxid = null,
  decryptedDir: configuredDecryptedDir = null,
  cursor = null,
  limit = 100,
  senderWxids = null,
  imagesOnly = false,
  startTime = null,
  imageOutputDir = null,
  imageKeyCacheDir = null,
}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 100, 20), 200);
  const fetchLimit = Math.min(Math.max(safeLimit * 4, 300), 1000);
  const resolvedWxDir = resolveWxDir(wxDir);
  const decryptedDir = resolveDecryptedDir(resolvedWxDir, configuredDecryptedDir);
  const SQL = await createSqlEngine();
  const contacts = loadContacts(decryptedDir, SQL);
  const msgDbs = getMessageDbs(decryptedDir);
  const pool = createMessageDbPool(SQL, msgDbs);
  const table = usernameToTable(username);
  const isGroup = String(username || '').includes('@chatroom');
  const resolvedSelfWxid = inferSelfWxid(resolvedWxDir, selfWxid);
  const senderFilter = normalizeSenderFilter(senderWxids);
  let page;

  try {
    const collected = collectPagedConversationRows(pool, table, cursor, fetchLimit);
    const messages = [];
    let processed = 0;
    let boundary = null;
    let reachedStart = false;

    for (const entry of collected.rows) {
      if (startTime != null && Number(entry.row.create_time) < Number(startTime)) {
        reachedStart = true;
        break;
      }
      processed += 1;
      boundary = entry.row;
      const message = buildFriendlyMessage(entry.row, entry.senderMap, {
        isGroup,
        contacts,
        selfWxid: resolvedSelfWxid,
      });
      if (!matchesViewerFilters(message, { senderWxids: senderFilter, imagesOnly })) continue;
      messages.push(message);
      if (messages.length >= safeLimit) break;
    }

    const hasMore = !reachedStart && (processed < collected.rows.length || collected.sourceHasMore);
    page = {
      username,
      displayName: contacts[username] || username,
      messages: messages.reverse(),
      hasMore: Boolean(hasMore && boundary),
      nextCursor: hasMore && boundary
        ? { beforeTime: Number(boundary.create_time) || 0, beforeLocalId: Number(boundary.local_id) || 0 }
        : null,
    };
  } finally {
    pool.close();
  }

  if (imageOutputDir && page.messages.some(isImageMessage)) {
    const { initImageExportContext, exportChatImages } = require('./imageMedia');
    fs.mkdirSync(imageOutputDir, { recursive: true });
    const imageCtx = initImageExportContext({
      accountDir: resolvedWxDir,
      decryptedDir,
      outputDir: imageOutputDir,
      keyCacheDir: imageKeyCacheDir,
      SQL,
    });
    exportChatImages(page, imageCtx, safeFilename(page.displayName, username));
    attachViewerImagePreviews(page.messages, imageOutputDir);
  }

  return page;
}

async function exportFilteredImages({
  wxDir,
  outputDir,
  username,
  selfWxid = null,
  decryptedDir: configuredDecryptedDir = null,
  imageKeyCacheDir = null,
  senderWxids = null,
  startTime = null,
  endTime = null,
}) {
  const resolvedWxDir = resolveWxDir(wxDir);
  const decryptedDir = resolveDecryptedDir(resolvedWxDir, configuredDecryptedDir);
  const SQL = await createSqlEngine();
  const contacts = loadContacts(decryptedDir, SQL);
  const msgDbs = getMessageDbs(decryptedDir);
  const pool = createMessageDbPool(SQL, msgDbs);
  const resolvedSelfWxid = inferSelfWxid(resolvedWxDir, selfWxid);
  let chat;

  try {
    chat = exportConversation({
      pool,
      username,
      contacts,
      selfWxid: resolvedSelfWxid,
      timeRange: startTime || endTime
        ? { mode: 'range', startTime: Number(startTime) || 0, endTime: Number(endTime) || Number.MAX_SAFE_INTEGER }
        : { mode: 'all' },
    });
  } finally {
    pool.close();
  }

  if (!chat) throw new Error('未找到该群聊的消息记录');
  chat.messages = filterViewerMessages(chat.messages, { senderWxids, imagesOnly: true });
  chat.messageCount = chat.messages.length;
  fs.mkdirSync(outputDir, { recursive: true });

  const { initImageExportContext, exportChatImages } = require('./imageMedia');
  const imageCtx = initImageExportContext({
    accountDir: resolvedWxDir,
    decryptedDir,
    outputDir,
    keyCacheDir: imageKeyCacheDir,
    SQL,
  });
  const fileBase = safeFilename(chat.displayName, username);
  const stats = exportChatImages(chat, imageCtx, fileBase);
  const manifestDir = path.join(outputDir, 'chats', `${fileBase}.media`);
  fs.mkdirSync(manifestDir, { recursive: true });
  const manifestPath = path.join(manifestDir, 'images.json');
  const manifest = chat.messages.map((message) => ({
    id: message.id,
    createTime: message.createTime,
    datetime: message.datetime,
    senderWxid: message.senderWxid,
    senderName: message.senderName,
    imagePath: message.extra?.outputImagePath || null,
    recordImages: (message.extra?.recordItems || [])
      .map((item) => item?.outputImagePath)
      .filter(Boolean),
  }));
  fs.writeFileSync(manifestPath, `\uFEFF${JSON.stringify(manifest, null, 2).replace(/\n/g, '\r\n')}`, 'utf8');

  return {
    username,
    displayName: chat.displayName,
    outputDir,
    manifestPath,
    ...stats,
  };
}

async function createSqlEngine() {
  return initSqlJs({ locateFile: getSqlJsLocateFile() });
}

/**
 * @param {object} options
 * @param {string} options.wxDir - 不信账号目录或 xwechat_files 目录
 * @param {string} options.outputDir - JSON 导出目录
 * @param {string} [options.selfWxid] - 当前账号 wxid，可自动推断
 * @param {(event: object) => void} [options.onProgress]
 */
async function exportWeChatChats({
  wxDir,
  outputDir,
  selfWxid,
  decryptedDir: configuredDecryptedDir = null,
  passphraseCacheDir = null,
  imageKeyCacheDir = null,
  voiceCacheDir = null,
  forceDecrypt = false,
  loginCapture = true,
  keysPath = null,
  formats = ['json'],
  selectedUsernames = null,
  selectedConversations = null,
  voiceTranscription = false,
  shouldCancel = null,
  onProgress,
}) {
  const normalizedFormats = ['json'];
  const resolvedWxDir = resolveWxDir(wxDir);
  const { ensureDecrypted, hasDecryptedStorage } = require('./decryptCore');

  onProgress?.({
    phase: 'init',
    message: `不信目录: ${resolvedWxDir}`,
  });

  if (forceDecrypt) {
    onProgress?.({ phase: 'init', message: '正在强制重新解密…' });
    await ensureDecrypted({
      wxDir: resolvedWxDir,
      forceDecrypt: true,
      loginCapture,
      keysPath,
      decryptedDir: configuredDecryptedDir,
      passphraseCacheDir,
      onProgress,
    });
  } else if (!hasDecryptedStorage(resolvedWxDir, configuredDecryptedDir)) {
    throw new Error(
      '未找到已解密数据库。请先在第二步「扫描会话」，或选择历史扫描记录；若需同步不信最新数据，请使用「重新扫描」。'
    );
  } else {
    onProgress?.({
      phase: 'init',
      message: '正在加载已解密数据…',
    });
  }

  const decryptedDir = resolveDecryptedDir(resolvedWxDir, configuredDecryptedDir);
  const resolvedSelfWxid = inferSelfWxid(resolvedWxDir, selfWxid);
  const chatsDir = path.join(outputDir, 'chats');

  onProgress?.({
    phase: 'init',
    message: `不信目录: ${resolvedWxDir}`,
  });
  onProgress?.({
    phase: 'init',
    message: `当前账号: ${resolvedSelfWxid}`,
  });

  const SQL = await createSqlEngine();
  const contacts = loadContacts(decryptedDir, SQL);
  const sessions = loadSessions(decryptedDir, SQL);
  const msgDbs = getMessageDbs(decryptedDir);

  if (msgDbs.length === 0) {
    throw new Error('未找到 message_0.db 等消息数据库文件');
  }

  onProgress?.({
    phase: 'init',
    message: `已加载 ${msgDbs.length} 个消息库，${Object.keys(contacts).length} 个联系人`,
  });

  fs.mkdirSync(chatsDir, { recursive: true });
  fs.mkdirSync(outputDir, { recursive: true });

  const pool = createMessageDbPool(SQL, msgDbs);
  const usernames = enrichUsernamesFromSessions(pool.usernames, sessions);

  const { writeChatFormats } = require('./exportFormats');
  const { initImageExportContext, exportChatImages, getImageExportDebugInfo } = require('./imageMedia');
  const {
    initVoiceTranscriptionContext,
    transcribeChatVoiceMessages,
    finalizeVoiceTranscription,
    assertVoiceTranscriptionAvailable,
  } = require('./voiceTranscription');

  let voiceCtx = null;
  if (voiceTranscription) {
    assertVoiceTranscriptionAvailable();
    onProgress?.({
      phase: 'voice-transcription',
      subphase: 'init',
      message: '已启用语音转文字，导出时间可能明显变长…',
    });
    voiceCtx = initVoiceTranscriptionContext({
      SQL,
      decryptedDir,
      wxDir: resolvedWxDir,
      cacheDir: voiceCacheDir,
    });
  }

  const imageCtx = initImageExportContext({
    accountDir: resolvedWxDir,
    decryptedDir,
    outputDir,
    keyCacheDir: imageKeyCacheDir,
    SQL,
    keysPath,
    logger: onProgress,
  });
  if (imageCtx) {
    const imageDebug = getImageExportDebugInfo(imageCtx);
    onProgress?.({
      phase: 'exporting',
      subphase: 'image-debug',
      message:
        `Image export init: roots=${imageDebug?.rootCount || 0}, files=${imageDebug?.fileCount || 0}, ` +
        `hardlinks=${imageDebug?.hardlinkCount || 0}, cachedImgKey=${imageDebug?.hasCachedImgKey ? 'yes' : 'no'}`,
      imageDebug,
    });
  }

  const exportedAt = formatLocalDateTime(new Date());
  const conversations = [];
  let exportedCount = 0;
  let totalMessages = 0;
  const usedNames = new Set();
  let usernameList = [...usernames];
  const selectionMap = new Map();

  if (Array.isArray(selectedConversations) && selectedConversations.length > 0) {
    for (const item of selectedConversations) {
      if (!item?.username) continue;
      selectionMap.set(item.username, item.timeRange || { mode: 'all' });
    }
    usernameList = usernameList.filter((name) => selectionMap.has(name));
  } else if (Array.isArray(selectedUsernames) && selectedUsernames.length > 0) {
    const selectedSet = new Set(selectedUsernames);
    usernameList = usernameList.filter((name) => selectedSet.has(name));
    for (const name of usernameList) {
      selectionMap.set(name, { mode: 'all' });
    }
  }

  try {
    for (let i = 0; i < usernameList.length; i += 1) {
      if (shouldCancel?.()) {
        throw new Error('导出已取消');
      }

      const username = usernameList[i];
      const chatDisplayName = contacts[username] || username;
      const progressMeta = {
        scanned: i + 1,
        totalCandidates: usernameList.length,
        totalMessages,
      };

      onProgress?.({
        phase: 'exporting',
        subphase: 'start',
        displayName: chatDisplayName,
        ...progressMeta,
      });

      const chat = exportConversation({
        pool,
        username,
        contacts,
        selfWxid: resolvedSelfWxid,
        timeRange: selectionMap.get(username) || { mode: 'all' },
        onProgress,
        shouldCancel,
        progressMeta,
      });
      if (!chat || chat.messageCount === 0) continue;

      if (voiceCtx) {
        await transcribeChatVoiceMessages({
          chat,
          voiceCtx,
          onProgress,
          shouldCancel,
        });
      }

      let fileBase = safeFilename(chat.displayName, username);
      if (usedNames.has(fileBase)) {
        fileBase = safeFilename(`${fileBase}_${username.replace('@', '_at_')}`, username);
      }
      usedNames.add(fileBase);

      if (imageCtx) {
        const imageExportStats = exportChatImages(chat, imageCtx, fileBase);
        if (imageExportStats.total > 0) {
          const summary =
            `Image export [${chat.displayName}]: total=${imageExportStats.total}, ` +
            `exported=${imageExportStats.exported}, failed=${imageExportStats.failed}`;
          onProgress?.({
            phase: 'exporting',
            subphase: 'image-debug',
            message:
              imageExportStats.failed > 0
                ? `${summary}, reasons=${JSON.stringify(imageExportStats.reasonCounts)}`
                : summary,
            imageDebug: imageExportStats,
          });
        }
      }

      const session = sessions[username] || {};
      const payload = {
        ...chat,
        session,
        exportedAt,
      };

      const files = writeChatFormats(payload, outputDir, normalizedFormats, fileBase, null);

      conversations.push({
        username,
        displayName: chat.displayName,
        type: chat.type,
        messageCount: chat.messageCount,
        files,
        file: files.json || null,
        lastTimestamp: session.lastTimestamp || 0,
        summary: session.summary || '',
      });

      exportedCount += 1;
      totalMessages += chat.messageCount;

      onProgress?.({
        phase: 'exporting',
        current: exportedCount,
        scanned: i + 1,
        totalCandidates: usernameList.length,
        displayName: chat.displayName,
        messageCount: chat.messageCount,
        totalMessages,
      });
    }
  } finally {
    pool.close();
  }

  conversations.sort((a, b) => b.messageCount - a.messageCount);

  if (voiceCtx) {
    finalizeVoiceTranscription(voiceCtx, onProgress);
  }

  const index = {
    exportedAt,
    selfWxid: resolvedSelfWxid,
    sourceDir: resolvedWxDir,
    formats: normalizedFormats,
    voiceTranscription: Boolean(voiceTranscription),
    conversationCount: exportedCount,
    totalMessages,
    conversations,
  };
  const indexPath = path.join(outputDir, 'conversations.json');
  fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf8');
  fs.writeFileSync(path.join(outputDir, 'contacts.json'), JSON.stringify(contacts, null, 2), 'utf8');

  const result = {
    wxDir: resolvedWxDir,
    outputDir,
    selfWxid: resolvedSelfWxid,
    formats: normalizedFormats,
    voiceTranscription: Boolean(voiceTranscription),
    conversationCount: exportedCount,
    totalMessages,
    indexPath,
    htmlIndexPath: null,
    contactsPath: path.join(outputDir, 'contacts.json'),
    chatsDir,
  };

  onProgress?.({ phase: 'done', ...result });
  return result;
}

module.exports = {
  exportWeChatChats,
  exportFilteredImages,
  loadConversationMessagesSince,
  loadConversationSnapshot,
  loadConversationMessages,
  listGroupMembers,
  resolveConversationImages,
  listConversations,
  countConversationMessagesInRange,
  getConversationTimeBounds,
  resolveWxDir,
  resolveDecryptedDir,
  getWxDirStatus,
  scanWeChatAccounts,
  isWeChatAccountDir,
  MSG_TYPE_MAP,
};
