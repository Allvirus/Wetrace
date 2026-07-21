const path = require('path');

function datasetKey(datasetDir) {
  if (!datasetDir) throw new Error('请选择 JSON 数据集目录');
  const resolved = path.resolve(datasetDir);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

function createJewelryTaskCoordinator() {
  let classificationChain = Promise.resolve();
  const syncChains = new Map();
  const inFlightImageIds = new Map();

  function getSyncChain(datasetDir) {
    return syncChains.get(datasetKey(datasetDir)) || Promise.resolve();
  }

  function queueSync(datasetDir, task) {
    const key = datasetKey(datasetDir);
    const previousSync = syncChains.get(key) || Promise.resolve();
    const previousClassification = classificationChain;
    const job = Promise.all([
      previousSync.catch(() => {}),
      previousClassification.catch(() => {}),
    ]).then(task);
    const settled = job.catch(() => {});
    syncChains.set(key, settled);
    settled.finally(() => {
      if (syncChains.get(key) === settled) syncChains.delete(key);
    });
    return job;
  }

  function queueRead(datasetDir, task) {
    const key = datasetKey(datasetDir);
    const previousSync = syncChains.get(key) || Promise.resolve();
    const job = previousSync.catch(() => {}).then(task);
    const settled = job.catch(() => {});
    syncChains.set(key, settled);
    settled.finally(() => {
      if (syncChains.get(key) === settled) syncChains.delete(key);
    });
    return job;
  }

  function queueClassification({ datasetDir, imageIds, task }) {
    const key = datasetKey(datasetDir);
    const active = inFlightImageIds.get(key) || new Set();
    const queuedImageIds = [...new Set(imageIds || [])].filter((imageId) => !active.has(imageId));
    if (!queuedImageIds.length) {
      return Promise.resolve({ ok: true, skipped: true, total: 0 });
    }
    queuedImageIds.forEach((imageId) => active.add(imageId));
    inFlightImageIds.set(key, active);

    const previousClassification = classificationChain;
    const previousSync = syncChains.get(key) || Promise.resolve();
    const job = Promise.all([
      previousClassification.catch(() => {}),
      previousSync.catch(() => {}),
    ]).then(() => task(queuedImageIds));
    classificationChain = job.catch(() => {});
    job.finally(() => {
      const current = inFlightImageIds.get(key);
      if (!current) return;
      queuedImageIds.forEach((imageId) => current.delete(imageId));
      if (!current.size) inFlightImageIds.delete(key);
    }).catch(() => {});
    return job;
  }

  function getInFlightImageIds(datasetDir) {
    return [...(inFlightImageIds.get(datasetKey(datasetDir)) || [])];
  }

  return {
    getInFlightImageIds,
    getSyncChain,
    queueClassification,
    queueRead,
    queueSync,
  };
}

module.exports = { createJewelryTaskCoordinator, datasetKey };
