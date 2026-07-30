const fs = require('fs');
const path = require('path');

function formatMessageLine(msg) {
  const sender = msg.isSelf ? '\u6211' : msg.senderName || msg.senderWxid || '\u672a\u77e5';
  const time = msg.datetime || '';
  const body = msg.content || `[${msg.typeName || '\u6d88\u606f'}]`;
  return `[${time}] ${sender}: ${body}`;
}

function writeTxtChat(chat, outFile) {
  const lines = [
    `# ${chat.displayName}`,
    `# \u7c7b\u578b: ${chat.type === 'group' ? '\u7fa4\u804a' : '\u79c1\u804a'}`,
    `# \u6d88\u606f\u6570: ${chat.messageCount}`,
    '',
  ];

  for (const msg of chat.messages) {
    lines.push(formatMessageLine(msg));
  }

  fs.writeFileSync(outFile, lines.join('\n'), 'utf8');
}

const COMPACT_JSON_THRESHOLD = 5000;

function writeChatFormats(chat, outputDir, formats, fileBase) {
  const files = {};
  const chatsDir = path.join(outputDir, 'chats');

  if (formats.includes('json')) {
    const outFile = path.join(chatsDir, `${fileBase}.json`);
    const jsonText =
      chat.messageCount >= COMPACT_JSON_THRESHOLD
        ? JSON.stringify(chat)
        : JSON.stringify(chat, null, 2);
    fs.writeFileSync(outFile, jsonText, 'utf8');
    files.json = path.relative(outputDir, outFile).replace(/\\/g, '/');
  }

  if (formats.includes('txt')) {
    const outFile = path.join(chatsDir, `${fileBase}.txt`);
    writeTxtChat(chat, outFile);
    files.txt = path.relative(outputDir, outFile).replace(/\\/g, '/');
  }

  return files;
}

module.exports = {
  writeChatFormats,
  COMPACT_JSON_THRESHOLD,
};
