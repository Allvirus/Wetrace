const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('./sqliteRuntime');

function resolveDatasetDocument(filePath) {
  const resolved = path.resolve(filePath);
  const fileName = path.basename(resolved);
  const parent = path.dirname(resolved);
  const parentName = path.basename(parent).toLowerCase();

  if (fileName.toLowerCase() === 'dataset.json') {
    return {
      rootDir: parent,
      dbPath: path.join(parent, 'dataset.db'),
      kind: 'manifest',
      documentId: 'dataset',
    };
  }
  if (!fileName.toLowerCase().endsWith('.json')) return null;

  const documentId = path.basename(fileName, path.extname(fileName));
  if (parentName === 'conversations' || parentName === 'annotations') {
    const rootDir = path.dirname(parent);
    return {
      rootDir,
      dbPath: path.join(rootDir, 'conversations', `${documentId}.db`),
      kind: parentName === 'conversations' ? 'conversation' : 'annotation',
      documentId,
    };
  }
  if (parentName === 'runs' && path.basename(path.dirname(parent)).toLowerCase() === 'classification') {
    const rootDir = path.dirname(path.dirname(parent));
    return {
      rootDir,
      dbPath: path.join(rootDir, 'dataset.db'),
      kind: 'run',
      documentId,
    };
  }
  return null;
}

function openDocumentDatabase(dbPath, { readOnly = false } = {}) {
  if (!readOnly) fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath, { readOnly });
  db.exec('PRAGMA busy_timeout = 5000');
  if (!readOnly) {
    db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
      CREATE TABLE IF NOT EXISTS dataset_documents (
        kind TEXT NOT NULL,
        document_id TEXT NOT NULL,
        content_json TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (kind, document_id)
      );
    `);
  }
  return db;
}

function writeDatasetDocument(filePath, value) {
  const target = resolveDatasetDocument(filePath);
  if (!target) return false;
  const db = openDocumentDatabase(target.dbPath);
  try {
    db.prepare(`
      INSERT INTO dataset_documents (kind, document_id, content_json, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(kind, document_id) DO UPDATE SET
        content_json = excluded.content_json,
        updated_at = excluded.updated_at
    `).run(target.kind, target.documentId, JSON.stringify(value), new Date().toISOString());
  } finally {
    db.close();
  }
  return true;
}

function readDatasetDocument(filePath) {
  const target = resolveDatasetDocument(filePath);
  if (!target) return { handled: false, found: false, value: null };
  if (!fs.existsSync(target.dbPath)) return { handled: true, found: false, value: null };

  const db = openDocumentDatabase(target.dbPath, { readOnly: true });
  try {
    const table = db.prepare(
      "SELECT count(*) AS count FROM sqlite_master WHERE type = 'table' AND name = 'dataset_documents'"
    ).get();
    if (!Number(table?.count)) return { handled: true, found: false, value: null };
    const row = db.prepare(
      'SELECT content_json FROM dataset_documents WHERE kind = ? AND document_id = ?'
    ).get(target.kind, target.documentId);
    return {
      handled: true,
      found: Boolean(row),
      value: row ? JSON.parse(row.content_json) : null,
    };
  } finally {
    db.close();
  }
}

function listDatasetDocuments(rootDir, kind) {
  const dbPath = path.join(path.resolve(rootDir), 'dataset.db');
  if (!fs.existsSync(dbPath)) return [];
  const db = openDocumentDatabase(dbPath, { readOnly: true });
  try {
    const table = db.prepare(
      "SELECT count(*) AS count FROM sqlite_master WHERE type = 'table' AND name = 'dataset_documents'"
    ).get();
    if (!Number(table?.count)) return [];
    return db.prepare(
      'SELECT content_json FROM dataset_documents WHERE kind = ? ORDER BY updated_at DESC'
    ).all(kind).map((row) => JSON.parse(row.content_json));
  } finally {
    db.close();
  }
}

module.exports = {
  listDatasetDocuments,
  readDatasetDocument,
  resolveDatasetDocument,
  writeDatasetDocument,
};
