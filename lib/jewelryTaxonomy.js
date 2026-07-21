const PRODUCT_CATEGORIES = Object.freeze([
  { id: 'plain_chain', name: '素链' },
  { id: 'pendant', name: '吊坠' },
  { id: 'bangle', name: '手镯' },
  { id: 'bead_bracelet', name: '手串' },
  { id: 'ring', name: '戒指' },
  { id: 'bracelet', name: '手链' },
  { id: 'earring', name: '耳饰' },
  { id: 'collar', name: '项圈' },
  { id: 'necklace_set', name: '套链' },
  { id: 'accessory', name: '配件' },
]);

const JEWELRY_PROCESSES = Object.freeze([
  { id: 'plain_gold', name: '素金' },
  { id: 'ancient_craft', name: '古法' },
  { id: 'x5g', name: 'x5G' },
  { id: 'x3d', name: 'x3D' },
  { id: 'x5d', name: 'x5D' },
  { id: 'wedding', name: '婚庆' },
  { id: 'platinum', name: '铂金' },
  { id: 'white_silver', name: '白银' },
]);

const PRODUCT_CATEGORY_IDS = new Set(PRODUCT_CATEGORIES.map((item) => item.id));
const JEWELRY_PROCESS_IDS = new Set(JEWELRY_PROCESSES.map((item) => item.id));

function uniqueProcessIds(values) {
  return [...new Set((values || []).map(String))];
}

function validateProductCategoryId(value, { allowNull = true } = {}) {
  if (value == null && allowNull) return null;
  if (!PRODUCT_CATEGORY_IDS.has(value)) throw new Error(`未知品类: ${value}`);
  return value;
}

function validateProcessIds(values) {
  const ids = uniqueProcessIds(values);
  for (const id of ids) {
    if (!JEWELRY_PROCESS_IDS.has(id)) throw new Error(`未知工艺: ${id}`);
  }
  return ids;
}

module.exports = {
  PRODUCT_CATEGORIES,
  JEWELRY_PROCESSES,
  PRODUCT_CATEGORY_IDS,
  JEWELRY_PROCESS_IDS,
  uniqueProcessIds,
  validateProductCategoryId,
  validateProcessIds,
};
