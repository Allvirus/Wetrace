const fs = require('fs');
const os = require('os');
const path = require('path');
const { dayMatchesRange } = require('./jewelryArchive');
const { readDatasetItems, validateDatasetImageAccess, validateTargetJewelryImageIds } = require('./jewelryDataset');
const { openLearningDatabase } = require('./jewelryLearningStore');
const { getBundledSkillRoot, getDefaultLearningDbPath } = require('./jewelrySkill');

const CLIP_MODEL_ID = 'Xenova/clip-vit-base-patch32';
const CLIP_MODEL_VERSION = 'clip-vit-base-patch32-v1';
let extractorPromise = null;

function normalizeVector(values) {
  const vector = Float32Array.from(values);
  let sum = 0;
  for (const value of vector) sum += value * value;
  const magnitude = Math.sqrt(sum);
  if (!magnitude) throw new Error('Image embedding is empty');
  for (let index = 0; index < vector.length; index += 1) vector[index] /= magnitude;
  return vector;
}

function cosineSimilarity(left, right) {
  if (left.length !== right.length) return -1;
  let score = 0;
  for (let index = 0; index < left.length; index += 1) score += left[index] * right[index];
  return score;
}

function vectorToBuffer(vector) {
  return Buffer.from(vector.buffer, vector.byteOffset, vector.byteLength);
}

function bufferToVector(buffer) {
  const copy = Buffer.from(buffer);
  return new Float32Array(copy.buffer, copy.byteOffset, copy.byteLength / Float32Array.BYTES_PER_ELEMENT);
}

async function getClipExtractor() {
  if (!extractorPromise) {
    extractorPromise = import('@huggingface/transformers').then(async ({ env, pipeline }) => {
      env.cacheDir = path.join(getBundledSkillRoot(), 'models');
      return pipeline('image-feature-extraction', CLIP_MODEL_ID);
    }).catch((error) => {
      extractorPromise = null;
      throw error;
    });
  }
  return extractorPromise;
}

async function extractImageEmbedding(imagePath, embeddingProvider = null) {
  if (embeddingProvider) return normalizeVector(await embeddingProvider(imagePath));
  const extractor = await getClipExtractor();
  const output = await extractor(imagePath, { pool: true });
  return normalizeVector(output.data);
}

function itemMatchesScope(item, source, options) {
  const usernames = source.conversationUsernames || options.conversationUsernames;
  if (Array.isArray(usernames) && usernames.length && !usernames.includes(item.conversationUsername)) return false;
  const day = item.classificationRecord.archive.day;
  if (options.day && day !== options.day) return false;
  if (!options.day && !dayMatchesRange(day, options)) return false;
  return item.classificationEligible && item.pathStatus === 'available';
}

function normalizeSources(options) {
  const sources = Array.isArray(options.sources) && options.sources.length
    ? options.sources
    : [{ datasetDir: options.datasetDir, conversationUsernames: options.conversationUsernames || null }];
  return sources.map((source) => {
    if (!source?.datasetDir) throw new Error('Similarity source dataset is missing');
    const dataset = readDatasetItems(source.datasetDir);
    if (source.datasetId && source.datasetId !== dataset.manifest.datasetId) {
      throw new Error('Similarity source dataset identity does not match');
    }
    if (source.accountWxid && source.accountWxid !== dataset.manifest.account?.wxid) {
      throw new Error('Similarity source account identity does not match');
    }
    return {
      ...source,
      datasetId: dataset.manifest.datasetId,
      accountWxid: dataset.manifest.account?.wxid || null,
      dataset,
    };
  });
}

async function ensureEmbedding(db, item, embeddingProvider) {
  const sha256 = String(item.classificationRecord.source.image.sha256 || '');
  if (!sha256) return null;
  const existing = db.prepare([
    'SELECT vector_blob, dimensions FROM jewelry_image_embeddings',
    'WHERE sha256 = ? AND model_version = ?',
  ].join(' ')).get(sha256, CLIP_MODEL_VERSION);
  let vector;
  if (existing) {
    vector = bufferToVector(existing.vector_blob);
  } else {
    vector = await extractImageEmbedding(item.absolutePath, embeddingProvider);
    db.prepare([
      'INSERT INTO jewelry_image_embeddings',
      '(sha256, model_version, dimensions, vector_blob, created_at) VALUES (?, ?, ?, ?, ?)',
    ].join(' ')).run(
      sha256,
      CLIP_MODEL_VERSION,
      vector.length,
      vectorToBuffer(vector),
      new Date().toISOString()
    );
  }
  const record = item.classificationRecord;
  db.prepare([
    'INSERT INTO jewelry_embedding_refs',
    '(sha256, model_version, dataset_id, image_id, conversation_username, day, updated_at)',
    'VALUES (?, ?, ?, ?, ?, ?, ?)',
    'ON CONFLICT(model_version, dataset_id, image_id) DO UPDATE SET',
    'sha256 = excluded.sha256, conversation_username = excluded.conversation_username,',
    'day = excluded.day, updated_at = excluded.updated_at',
  ].join(' ')).run(
    sha256,
    CLIP_MODEL_VERSION,
    record.datasetId,
    record.imageId,
    record.source.conversation.username,
    record.archive.day,
    new Date().toISOString()
  );
  return vector;
}

async function indexSimilaritySources(options = {}) {
  const learningDbPath = options.learningDbPath || getDefaultLearningDbPath();
  const sources = normalizeSources(options);
  const db = openLearningDatabase(learningDbPath);
  let indexed = 0;
  let reused = 0;
  let skipped = 0;
  try {
    for (const source of sources) {
      const items = source.dataset.items
        .filter((item) => itemMatchesScope(item, source, options))
        .sort((left, right) =>
          String(right.classificationRecord.archive.day).localeCompare(String(left.classificationRecord.archive.day)) ||
          Number(left.createTime) - Number(right.createTime) ||
          String(left.imageId).localeCompare(String(right.imageId))
        );
      for (const rawItem of items) {
        const item = validateDatasetImageAccess(source.datasetDir, rawItem);
        if (item.pathStatus !== 'available' || !item.classificationRecord.source.image.sha256) {
          skipped += 1;
          continue;
        }
        const existing = db.prepare([
          'SELECT 1 AS found FROM jewelry_image_embeddings',
          'WHERE sha256 = ? AND model_version = ?',
        ].join(' ')).get(item.classificationRecord.source.image.sha256, CLIP_MODEL_VERSION);
        await ensureEmbedding(db, item, options.embeddingProvider);
        if (existing) reused += 1;
        else indexed += 1;
        options.onProgress?.({ phase: 'similarity-index', indexed, reused, skipped });
      }
    }
    return { indexed, reused, skipped };
  } finally {
    db.close();
  }
}

function labelRerankScore(visualScore, queryCurrent, candidateCurrent) {
  const reliableQuery = queryCurrent?.state === 'classified' && queryCurrent?.category?.id;
  if (!reliableQuery) return visualScore;
  const categoryBoost = queryCurrent.category.id === candidateCurrent?.category?.id ? 0.1 : 0;
  const queryProcesses = new Set((queryCurrent.processes || []).map((entry) => entry.id));
  const candidateProcesses = new Set((candidateCurrent?.processes || []).map((entry) => entry.id));
  const union = new Set([...queryProcesses, ...candidateProcesses]);
  const overlap = [...queryProcesses].filter((id) => candidateProcesses.has(id)).length;
  const processBoost = union.size ? 0.05 * overlap / union.size : 0;
  return visualScore * 0.85 + categoryBoost + processBoost;
}

async function searchSimilarImage(options = {}) {
  const topK = Math.max(1, Math.min(Number(options.topK) || 30, 100));
  const minScore = Number.isFinite(Number(options.minScore)) ? Number(options.minScore) : 0;
  const learningDbPath = options.learningDbPath || getDefaultLearningDbPath();
  const sources = normalizeSources(options);
  let queryItem = null;
  let queryPath = options.imagePath || null;
  let temporaryPath = null;

  try {
    if (options.imageId) {
      for (const source of sources) {
        const item = source.dataset.items.find((entry) => entry.imageId === options.imageId);
        if (!item) continue;
        validateTargetJewelryImageIds(source.datasetDir, [options.imageId]);
        queryItem = validateDatasetImageAccess(source.datasetDir, item);
        queryPath = queryItem.absolutePath;
        break;
      }
      if (!queryItem) throw new Error('Similarity query GUID was not found in the selected sources');
    } else if (options.imageBytes) {
      temporaryPath = path.join(os.tmpdir(), 'wetrace-query-' + process.pid + '-' + Date.now() + '.img');
      fs.writeFileSync(temporaryPath, Buffer.from(options.imageBytes));
      queryPath = temporaryPath;
    }
    if (!queryPath || !fs.existsSync(queryPath)) throw new Error('Similarity query image is unavailable');
    if (options.addToTraining) throw new Error('External training ingestion requires explicit source metadata');

    await indexSimilaritySources({ ...options, sources, learningDbPath });
    const db = openLearningDatabase(learningDbPath);
    try {
      let queryVector = null;
      const querySha = queryItem?.classificationRecord?.source?.image?.sha256 || null;
      if (querySha) {
        const row = db.prepare([
          'SELECT vector_blob FROM jewelry_image_embeddings',
          'WHERE sha256 = ? AND model_version = ?',
        ].join(' ')).get(querySha, CLIP_MODEL_VERSION);
        if (row) queryVector = bufferToVector(row.vector_blob);
      }
      if (!queryVector) queryVector = await extractImageEmbedding(queryPath, options.embeddingProvider);

      const vectors = new Map(db.prepare([
        'SELECT sha256, vector_blob FROM jewelry_image_embeddings WHERE model_version = ?',
      ].join(' ')).all(CLIP_MODEL_VERSION).map((row) => [row.sha256, bufferToVector(row.vector_blob)]));
      const results = [];
      for (const source of sources) {
        for (const rawItem of source.dataset.items) {
          if (!itemMatchesScope(rawItem, source, options)) continue;
          if (queryItem && rawItem.imageId === queryItem.imageId && rawItem.datasetId === queryItem.datasetId) continue;
          const sha256 = rawItem.classificationRecord.source.image.sha256;
          const vector = vectors.get(sha256);
          if (!vector) continue;
          const visualScore = cosineSimilarity(queryVector, vector);
          const score = labelRerankScore(
            visualScore,
            queryItem?.classificationRecord?.current,
            rawItem.classificationRecord.current
          );
          if (score < minScore) continue;
          const item = validateDatasetImageAccess(source.datasetDir, rawItem);
          results.push({
            datasetId: source.datasetId,
            imageId: item.imageId,
            sourceImageId: item.sourceImageId,
            previewUrl: item.previewUrl,
            score,
            visualScore,
            day: item.classificationRecord.archive.day,
            conversation: item.classificationRecord.source.conversation,
            current: item.classificationRecord.current,
          });
        }
      }
      results.sort((left, right) => right.score - left.score || right.visualScore - left.visualScore);
      return {
        modelVersion: CLIP_MODEL_VERSION,
        query: queryItem ? { datasetId: queryItem.datasetId, imageId: queryItem.imageId } : { temporary: true },
        results: results.slice(0, topK),
      };
    } finally {
      db.close();
    }
  } finally {
    if (temporaryPath) {
      try { fs.rmSync(temporaryPath, { force: true }); } catch {}
    }
  }
}

module.exports = {
  CLIP_MODEL_ID,
  CLIP_MODEL_VERSION,
  cosineSimilarity,
  indexSimilaritySources,
  labelRerankScore,
  normalizeVector,
  searchSimilarImage,
};