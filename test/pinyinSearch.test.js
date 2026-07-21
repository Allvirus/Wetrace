const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildPinyinSearchIndex,
  buildPinyinSearchKeys,
  normalizeSearchText,
} = require('../lib/pinyinSearch');

test('Chinese group names expose normalized full pinyin and initials', () => {
  const keys = buildPinyinSearchKeys('\u5b66\u4e60\u798f\u5229\u7fa4');
  assert.ok(keys.includes('xuexifuliqun'));
  assert.ok(keys.includes('xxflq'));
});

test('pinyin index keeps stable group ids and normalizes punctuation', () => {
  const items = buildPinyinSearchIndex([
    { id: 'group@chatroom', text: 'A-\u73e0\u5b9d 2' },
  ]);
  assert.equal(items[0].id, 'group@chatroom');
  assert.ok(items[0].keys.includes('azhubao2'));
  assert.equal(normalizeSearchText(' Xue-Xi '), 'xuexi');
});
