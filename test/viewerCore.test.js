const test = require('node:test');
const assert = require('node:assert/strict');

const { filterViewerMessages, isImageMessage } = require('../lib/viewerCore');

const messages = [
  { id: 1, senderWxid: 'alice', type: 1, content: 'hello', extra: null },
  { id: 2, senderWxid: 'alice', type: 3, content: '[图片]', extra: { kind: 'image' } },
  { id: 3, senderWxid: 'bob', type: 49, extra: { recordItems: [{ kind: 'image' }] } },
  { id: 4, senderWxid: 'bob', type: 1, content: 'world', extra: null },
];

test('null sender filter keeps every sender', () => {
  assert.deepEqual(filterViewerMessages(messages, { senderWxids: null }).map((item) => item.id), [1, 2, 3, 4]);
});

test('empty sender selection returns no messages', () => {
  assert.deepEqual(filterViewerMessages(messages, { senderWxids: [] }), []);
});

test('member and image filters are applied together', () => {
  assert.deepEqual(
    filterViewerMessages(messages, { senderWxids: ['alice'], imagesOnly: true }).map((item) => item.id),
    [2]
  );
});

test('record messages containing images count as image messages', () => {
  assert.equal(isImageMessage(messages[2]), true);
  assert.equal(isImageMessage(messages[3]), false);
});
