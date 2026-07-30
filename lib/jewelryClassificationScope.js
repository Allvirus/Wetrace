const path = require('path');
const { prepareJewelryClassification, runJewelryClassification } = require('./codexJewelryClassifier');
const { readDatasetItems } = require('./jewelryDataset');
const { getAllowedJewelryGroups } = require('./jewelryScope');

function validateDay(value, name) {
  if (value == null || value === '') return null;
  const normalized = String(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) throw new Error(name + ' must use YYYY-MM-DD');
  return normalized;
}

function normalizeClassificationScope(options = {}) {
  const requestedSources = Array.isArray(options.sources) && options.sources.length
    ? options.sources
    : [{ datasetDir: options.datasetDir }];
  const dateFrom = validateDay(options.dateFrom, 'dateFrom');
  const dateTo = validateDay(options.dateTo, 'dateTo');
  const day = validateDay(options.day, 'day');
  if (dateFrom && dateTo && dateFrom > dateTo) throw new Error('Classification date range is invalid');

  const datasetIds = new Set();
  const sources = requestedSources.map((source) => {
    if (!source?.datasetDir) throw new Error('Classification source dataset is missing');
    const datasetDir = path.resolve(source.datasetDir);
    const dataset = readDatasetItems(datasetDir);
    if (source.datasetId && source.datasetId !== dataset.manifest.datasetId) {
      throw new Error('Classification source dataset identity does not match');
    }
    if (source.accountWxid && source.accountWxid !== dataset.manifest.account?.wxid) {
      throw new Error('Classification source account identity does not match');
    }
    if (datasetIds.has(dataset.manifest.datasetId)) {
      throw new Error('The same dataset cannot be mounted twice in one classification task');
    }
    datasetIds.add(dataset.manifest.datasetId);
    const allowed = getAllowedJewelryGroups(dataset.manifest);
    const requestedUsernames = Array.isArray(source.conversationUsernames)
      ? [...new Set(source.conversationUsernames.map(String).filter(Boolean))]
      : [...allowed];
    if (requestedUsernames.some((username) => !allowed.has(username))) {
      throw new Error('Classification source contains a group outside the allowlist');
    }
    return {
      datasetId: dataset.manifest.datasetId,
      datasetDir,
      accountWxid: dataset.manifest.account?.wxid || null,
      conversationUsernames: requestedUsernames,
    };
  });

  return {
    sources,
    day,
    dateFrom: day ? null : dateFrom,
    dateTo: day ? null : dateTo,
    includeUnknownDate: Boolean(options.includeUnknownDate),
    states: Array.isArray(options.states) ? [...new Set(options.states)] : null,
    imageIds: Array.isArray(options.imageIds) ? [...new Set(options.imageIds)] : null,
  };
}

function sourceFilters(scope, source) {
  return {
    day: scope.day,
    dateFrom: scope.dateFrom,
    dateTo: scope.dateTo,
    includeUnknownDate: scope.includeUnknownDate,
    conversationUsernames: source.conversationUsernames,
  };
}

function prepareClassificationScope(options = {}) {
  const scope = normalizeClassificationScope(options);
  const sourceJobs = [];
  for (const source of scope.sources) {
    const dataset = readDatasetItems(source.datasetDir);
    const datasetImageIds = scope.imageIds
      ? dataset.items.filter((item) => scope.imageIds.includes(item.imageId)).map((item) => item.imageId)
      : null;
    const prepared = prepareJewelryClassification({
      datasetDir: source.datasetDir,
      imageIds: datasetImageIds,
      eligibleStates: scope.states,
      filters: sourceFilters(scope, source),
      learningDbPath: options.learningDbPath || null,
    });
    sourceJobs.push({
      ...source,
      imageIds: prepared.imageIds,
      targetCount: prepared.targetCount,
      exampleCount: prepared.exampleCount,
      targetBatchSize: prepared.targetBatchSize,
      batchCount: prepared.batchCount,
      attachmentCount: prepared.attachmentCount,
      filters: sourceFilters(scope, source),
    });
  }
  return {
    scope,
    sourceJobs,
    targetCount: sourceJobs.reduce((sum, job) => sum + job.targetCount, 0),
    batchCount: sourceJobs.reduce((sum, job) => sum + job.batchCount, 0),
    attachmentCount: sourceJobs.reduce((sum, job) => sum + job.attachmentCount, 0),
    attachmentLimit: 10,
  };
}

async function runClassificationScope(options = {}) {
  const prepared = options.sourceJobs
    ? { sourceJobs: options.sourceJobs, scope: options.scope || null }
    : prepareClassificationScope(options);
  const runs = [];
  for (const job of prepared.sourceJobs) {
    if (!job.imageIds?.length) continue;
    runs.push(await runJewelryClassification({
      datasetDir: job.datasetDir,
      imageIds: job.imageIds,
      eligibleStates: options.eligibleStates || null,
      filters: job.filters || {},
      learningDbPath: options.learningDbPath || null,
      model: options.model || null,
      reasoningEffort: options.reasoningEffort || 'medium',
      structuredOutput: options.structuredOutput !== false,
      commandOverride: options.commandOverride || null,
      onProgress: options.onProgress || null,
    }));
  }
  return {
    scope: prepared.scope,
    runs,
    total: runs.reduce((sum, run) => sum + Number(run.total || 0), 0),
    completed: runs.reduce((sum, run) => sum + Number(run.completed || 0), 0),
    failed: runs.reduce((sum, run) => sum + Number(run.failed || 0), 0),
  };
}

module.exports = {
  normalizeClassificationScope,
  prepareClassificationScope,
  runClassificationScope,
};