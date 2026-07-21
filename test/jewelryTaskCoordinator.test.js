const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const { createJewelryTaskCoordinator } = require('../lib/jewelryTaskCoordinator');

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

test('task coordinator serializes sync and classification and de-duplicates image IDs', async () => {
  const coordinator = createJewelryTaskCoordinator();
  const datasetDir = path.join(process.cwd(), 'dataset-a');
  const gate = deferred();
  const events = [];

  const first = coordinator.queueClassification({
    datasetDir,
    imageIds: ['img_1', 'img_2'],
    task: async (imageIds) => {
      events.push(`classification:${imageIds.join(',')}`);
      await gate.promise;
      events.push('classification:done');
    },
  });
  const duplicate = coordinator.queueClassification({
    datasetDir,
    imageIds: ['img_2', 'img_3'],
    task: async (imageIds) => { events.push(`classification:${imageIds.join(',')}`); },
  });
  const sync = coordinator.queueSync(datasetDir, async () => { events.push('sync'); });

  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(coordinator.getInFlightImageIds(datasetDir).sort(), ['img_1', 'img_2', 'img_3']);
  assert.deepEqual(events, ['classification:img_1,img_2']);
  gate.resolve();
  await Promise.all([first, duplicate, sync]);
  assert.deepEqual(events, [
    'classification:img_1,img_2',
    'classification:done',
    'classification:img_3',
    'sync',
  ]);
  assert.deepEqual(coordinator.getInFlightImageIds(datasetDir), []);
});

test('manual callers can wait for the active dataset sync', async () => {
  const coordinator = createJewelryTaskCoordinator();
  const datasetDir = path.join(process.cwd(), 'dataset-b');
  const gate = deferred();
  const sync = coordinator.queueSync(datasetDir, () => gate.promise);
  let released = false;
  const waiting = coordinator.getSyncChain(datasetDir).then(() => { released = true; });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(released, false);
  gate.resolve();
  await Promise.all([sync, waiting]);
  assert.equal(released, true);
});
