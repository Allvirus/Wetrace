const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('./sqliteRuntime');
const { isTargetJewelryGroup } = require('./jewelryScope');

function tableColumns(db, tableName) {
  return new Set(db.prepare('PRAGMA table_info(' + tableName + ')').all().map((row) => row.name));
}

function ensureColumn(db, tableName, columnName, definition) {
  if (!tableColumns(db, tableName).has(columnName)) {
    db.exec('ALTER TABLE ' + tableName + ' ADD COLUMN ' + columnName + ' ' + definition);
  }
}

function openLearningDatabase(dbPath) {
  if (!dbPath) return null;
  fs.mkdirSync(path.dirname(path.resolve(dbPath)), { recursive: true });
  const db = new DatabaseSync(path.resolve(dbPath));
  db.exec([
    'PRAGMA journal_mode = WAL;',
    'PRAGMA synchronous = NORMAL;',
    'CREATE TABLE IF NOT EXISTS jewelry_learning_samples (',
    'sha256 TEXT PRIMARY KEY, image_id TEXT NOT NULL, source_image_id TEXT NOT NULL,',
    'image_path TEXT NOT NULL, jewelry_decision TEXT NOT NULL, category_id TEXT,',
    'process_ids_json TEXT NOT NULL, source_refs_json TEXT NOT NULL, verified_at TEXT NOT NULL',
    ');',
    'CREATE TABLE IF NOT EXISTS jewelry_learning_rejections (',
    'id INTEGER PRIMARY KEY AUTOINCREMENT, sha256 TEXT NOT NULL, rejected_label_json TEXT NOT NULL,',
    'replacement_label_json TEXT, source_ref_json TEXT NOT NULL, rejected_at TEXT NOT NULL',
    ');',
    'CREATE TABLE IF NOT EXISTS jewelry_candidate_rules (',
    'rule_key TEXT PRIMARY KEY, jewelry_decision TEXT NOT NULL, category_id TEXT,',
    'process_ids_json TEXT NOT NULL, sample_count INTEGER NOT NULL, day_count INTEGER NOT NULL,',
    'sender_count INTEGER NOT NULL, status TEXT NOT NULL, updated_at TEXT NOT NULL',
    ');',
    'CREATE TABLE IF NOT EXISTS jewelry_learning_sources (',
    'dataset_id TEXT NOT NULL, conversation_username TEXT NOT NULL, silver_enabled INTEGER NOT NULL DEFAULT 1,',
    'updated_at TEXT NOT NULL, PRIMARY KEY (dataset_id, conversation_username)',
    ');',
    'CREATE TABLE IF NOT EXISTS jewelry_image_embeddings (',
    'sha256 TEXT NOT NULL, model_version TEXT NOT NULL, dimensions INTEGER NOT NULL,',
    'vector_blob BLOB NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY (sha256, model_version)',
    ');',
    'CREATE TABLE IF NOT EXISTS jewelry_embedding_refs (',
    'sha256 TEXT NOT NULL, model_version TEXT NOT NULL, dataset_id TEXT NOT NULL, image_id TEXT NOT NULL,',
    'conversation_username TEXT NOT NULL, day TEXT NOT NULL, updated_at TEXT NOT NULL,',
    'PRIMARY KEY (model_version, dataset_id, image_id)',
    ');',
  ].join('\n'));
  ensureColumn(db, 'jewelry_learning_samples', 'tier', "TEXT NOT NULL DEFAULT 'gold'");
  ensureColumn(db, 'jewelry_learning_samples', 'status', "TEXT NOT NULL DEFAULT 'active'");
  ensureColumn(db, 'jewelry_learning_samples', 'dataset_id', 'TEXT');
  ensureColumn(db, 'jewelry_learning_samples', 'source_username', 'TEXT');
  ensureColumn(db, 'jewelry_learning_samples', 'evidence_json', "TEXT NOT NULL DEFAULT '[]'");
  ensureColumn(db, 'jewelry_learning_samples', 'conflict_json', "TEXT NOT NULL DEFAULT '[]'");
  return db;
}

function labelValue(current) {
  return {
    jewelryDecision: current.jewelryDecision,
    categoryId: current.category?.id || null,
    processIds: (current.processes || []).map((entry) => entry.id).sort(),
  };
}

function labelSignature(value) {
  return [
    value.jewelryDecision,
    value.categoryId || '',
    ...(value.processIds || []),
  ].join(':');
}

function sourceReference(record) {
  return {
    datasetId: record.datasetId || null,
    imageId: record.imageId,
    sourceImageId: record.sourceImageId,
    conversationUsername: record.source?.conversation?.username || null,
    day: record.archive?.day || 'unknown-date',
    senderWxid: record.source?.message?.senderWxid || null,
    messageId: record.source?.message?.messageId || null,
  };
}

function normalizeSourceRefs(raw) {
  const parsed = raw ? JSON.parse(raw) : [];
  return parsed.map((entry) => typeof entry === 'string'
    ? { datasetId: null, imageId: entry }
    : entry);
}

function isSilverResult(record) {
  const current = record?.current || {};
  const evidence = new Set(current.evidence || []);
  const hasImageText = evidence.has('image_text') && Boolean(current.recognizedText?.value?.trim());
  const hasContext = evidence.has('chat_context') &&
    [...(record.context?.before || []), ...(record.context?.after || [])].some((entry) => entry.text?.trim());
  return current.source === 'codex' &&
    ['classified', 'not_jewelry'].includes(current.state) &&
    evidence.has('visual') &&
    (hasImageText || hasContext);
}

function learningTier(record) {
  if (record?.current?.source === 'manual') return 'gold';
  return isSilverResult(record) ? 'silver' : null;
}

function sourceRefKey(ref) {
  return [ref.datasetId || '', ref.imageId || ''].join(':');
}

function refreshCandidateRules(db) {
  const rows = db.prepare(
    "SELECT * FROM jewelry_learning_samples WHERE tier = 'silver' AND status = 'active'"
  ).all();
  const groups = new Map();
  for (const row of rows) {
    const value = {
      jewelryDecision: row.jewelry_decision,
      categoryId: row.category_id,
      processIds: JSON.parse(row.process_ids_json || '[]'),
    };
    const key = labelSignature(value);
    const group = groups.get(key) || { value, hashes: new Set(), days: new Set(), senders: new Set() };
    group.hashes.add(row.sha256);
    for (const ref of normalizeSourceRefs(row.source_refs_json)) {
      if (ref.day && ref.day !== 'unknown-date') group.days.add(ref.day);
      if (ref.senderWxid) group.senders.add(ref.senderWxid);
    }
    groups.set(key, group);
  }
  db.exec('DELETE FROM jewelry_candidate_rules');
  const insert = db.prepare([
    'INSERT INTO jewelry_candidate_rules',
    '(rule_key, jewelry_decision, category_id, process_ids_json, sample_count, day_count, sender_count, status, updated_at)',
    'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
  ].join(' '));
  const updatedAt = new Date().toISOString();
  for (const [key, group] of groups) {
    const candidate = group.hashes.size >= 3 && (group.days.size >= 2 || group.senders.size >= 2);
    insert.run(
      key,
      group.value.jewelryDecision,
      group.value.categoryId,
      JSON.stringify(group.value.processIds),
      group.hashes.size,
      group.days.size,
      group.senders.size,
      candidate ? 'candidate' : 'insufficient',
      updatedAt
    );
  }
}
function saveLearningSample(dbPath, item, record, { allowedConversationUsernames = null } = {}) {
  const current = record?.current || {};
  const sha256 = String(record?.source?.image?.sha256 || '');
  const username = String(record?.source?.conversation?.username || '');
  const allowed = Array.isArray(allowedConversationUsernames)
    ? allowedConversationUsernames.includes(username)
    : isTargetJewelryGroup(username);
  const tier = learningTier(record);
  if (!dbPath || !sha256 || !allowed || !tier) return false;
  if (!['jewelry', 'not_jewelry'].includes(current.jewelryDecision)) return false;

  const db = openLearningDatabase(dbPath);
  try {
    const previous = db.prepare(
      'SELECT * FROM jewelry_learning_samples WHERE sha256 = ?'
    ).get(sha256);
    const incomingLabel = labelValue(current);
    const incomingSignature = labelSignature(incomingLabel);
    const ref = sourceReference(record);
    const refs = new Map(normalizeSourceRefs(previous?.source_refs_json).map((entry) => [sourceRefKey(entry), entry]));
    const sameSource = refs.has(sourceRefKey(ref));
    refs.set(sourceRefKey(ref), ref);

    if (previous) {
      const previousLabel = {
        jewelryDecision: previous.jewelry_decision,
        categoryId: previous.category_id,
        processIds: JSON.parse(previous.process_ids_json || '[]'),
      };
      const conflicting = labelSignature(previousLabel) !== incomingSignature;
      if (conflicting && previous.tier === 'gold' && tier === 'gold' && !sameSource) {
        const conflicts = JSON.parse(previous.conflict_json || '[]');
        conflicts.push({ label: incomingLabel, sourceRef: ref, createdAt: current.updatedAt });
        db.prepare([
          "UPDATE jewelry_learning_samples SET status = 'conflict', source_refs_json = ?,",
          'conflict_json = ?, verified_at = ? WHERE sha256 = ?',
        ].join(' ')).run(JSON.stringify([...refs.values()]), JSON.stringify(conflicts), current.updatedAt, sha256);
        refreshCandidateRules(db);
        return true;
      }
      if (conflicting && previous.tier === 'gold' && tier === 'silver') {
        db.prepare([
          'INSERT INTO jewelry_learning_rejections',
          '(sha256, rejected_label_json, replacement_label_json, source_ref_json, rejected_at)',
          'VALUES (?, ?, ?, ?, ?)',
        ].join(' ')).run(
          sha256,
          JSON.stringify(incomingLabel),
          JSON.stringify(previousLabel),
          JSON.stringify(ref),
          current.updatedAt
        );
        return false;
      }
      if (conflicting) {
        db.prepare([
          'INSERT INTO jewelry_learning_rejections',
          '(sha256, rejected_label_json, replacement_label_json, source_ref_json, rejected_at)',
          'VALUES (?, ?, ?, ?, ?)',
        ].join(' ')).run(
          sha256,
          JSON.stringify(previousLabel),
          JSON.stringify(incomingLabel),
          JSON.stringify(ref),
          current.updatedAt
        );
      }
    }

    const effectiveTier = previous?.tier === 'gold' && !sameSource ? 'gold' : tier;
    db.prepare([
      'INSERT INTO jewelry_learning_samples',
      '(sha256, image_id, source_image_id, image_path, jewelry_decision, category_id,',
      'process_ids_json, source_refs_json, verified_at, tier, status, dataset_id, source_username, evidence_json, conflict_json)',
      'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      'ON CONFLICT(sha256) DO UPDATE SET',
      'image_id = excluded.image_id, source_image_id = excluded.source_image_id, image_path = excluded.image_path,',
      'jewelry_decision = excluded.jewelry_decision, category_id = excluded.category_id,',
      'process_ids_json = excluded.process_ids_json, source_refs_json = excluded.source_refs_json,',
      'verified_at = excluded.verified_at, tier = excluded.tier, status = excluded.status,',
      'dataset_id = excluded.dataset_id, source_username = excluded.source_username,',
      'evidence_json = excluded.evidence_json, conflict_json = excluded.conflict_json',
    ].join(' ')).run(
      sha256,
      record.imageId,
      record.sourceImageId,
      item.absolutePath,
      incomingLabel.jewelryDecision,
      incomingLabel.categoryId,
      JSON.stringify(incomingLabel.processIds),
      JSON.stringify([...refs.values()]),
      current.updatedAt,
      effectiveTier,
      'active',
      record.datasetId || null,
      username,
      JSON.stringify(current.evidence || []),
      '[]'
    );
    refreshCandidateRules(db);
    return true;
  } finally {
    db.close();
  }
}
function listLearningExamples(dbPath, limit = 2) {
  if (!dbPath || !fs.existsSync(dbPath)) return [];
  const db = openLearningDatabase(dbPath);
  try {
    const rows = db.prepare([
      "SELECT * FROM jewelry_learning_samples WHERE status = 'active'",
      "ORDER BY CASE tier WHEN 'gold' THEN 0 ELSE 1 END, verified_at DESC LIMIT 100",
    ].join(' ')).all();
    const examples = [];
    const signatures = new Set();
    let silverCount = 0;
    for (const row of rows) {
      if (!fs.existsSync(row.image_path)) continue;
      if (row.tier === 'silver' && examples.some((entry) => entry.tier === 'gold') && silverCount >= 1) continue;
      const processIds = JSON.parse(row.process_ids_json || '[]');
      const signature = labelSignature({
        jewelryDecision: row.jewelry_decision,
        categoryId: row.category_id,
        processIds,
      });
      if (signatures.has(signature)) continue;
      signatures.add(signature);
      if (row.tier === 'silver') silverCount += 1;
      examples.push({
        imageId: row.image_id,
        absolutePath: row.image_path,
        jewelryDecision: row.jewelry_decision,
        categoryId: row.category_id,
        processIds,
        tier: row.tier || 'gold',
        sourceRefs: normalizeSourceRefs(row.source_refs_json),
      });
      if (examples.length >= limit) break;
    }
    return examples;
  } finally {
    db.close();
  }
}

function listCandidateRules(dbPath, limit = 5) {
  if (!dbPath || !fs.existsSync(dbPath)) return [];
  const db = openLearningDatabase(dbPath);
  try {
    return db.prepare([
      "SELECT * FROM jewelry_candidate_rules WHERE status = 'candidate'",
      'ORDER BY sample_count DESC, updated_at DESC LIMIT ?',
    ].join(' ')).all(Math.max(1, Math.min(Number(limit) || 5, 20))).map((row) => ({
      jewelryDecision: row.jewelry_decision,
      categoryId: row.category_id,
      processIds: JSON.parse(row.process_ids_json || '[]'),
      sampleCount: Number(row.sample_count) || 0,
    }));
  } finally {
    db.close();
  }
}
module.exports = { listCandidateRules, listLearningExamples, openLearningDatabase, saveLearningSample };
