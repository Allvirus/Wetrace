const { pinyin } = require('pinyin-pro');

function normalizeSearchText(value) {
  return String(value || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

function buildPinyinSearchKeys(value) {
  const text = String(value || '').trim();
  if (!text) return [];
  const options = { toneType: 'none', type: 'array', nonZh: 'consecutive' };
  const fullPinyin = pinyin(text, options).join('');
  const initials = pinyin(text, { ...options, pattern: 'initial' }).join('');
  return [...new Set([
    normalizeSearchText(text),
    normalizeSearchText(fullPinyin),
    normalizeSearchText(initials),
  ].filter(Boolean))];
}

function buildPinyinSearchIndex(items) {
  return (Array.isArray(items) ? items : []).map((item) => ({
    id: String(item?.id || ''),
    keys: buildPinyinSearchKeys(item?.text),
  }));
}

module.exports = {
  buildPinyinSearchIndex,
  buildPinyinSearchKeys,
  normalizeSearchText,
};
