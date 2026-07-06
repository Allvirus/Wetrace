const fs = require('fs');
const path = require('path');

function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeCsv(value) {
  const text = String(value ?? '');
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function toInlineJson(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}

function isOpaqueBlobText(value) {
  const text = String(value ?? '').trim();
  if (!text || text.length < 180) return false;
  if (/^[a-f0-9]{180,}$/i.test(text)) return true;
  if (/^[a-z0-9+/=_-]{240,}$/i.test(text) && !/\s/.test(text)) return true;
  return false;
}

function sanitizeRenderedText(value) {
  const text = String(value ?? '');
  if (isOpaqueBlobText(text)) {
    return '[\u5df2\u7701\u7565\u957f\u6570\u636e]';
  }
  if (text.length > 4000) {
    return `${text.slice(0, 4000)}\n[\u5df2\u622a\u65ad\u8fc7\u957f\u5185\u5bb9]`;
  }
  return text;
}

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

const CSV_HEADER = '\u4f1a\u8bdd,\u7c7b\u578b,\u65f6\u95f4,\u53d1\u9001\u8005,\u662f\u5426\u672c\u4eba,\u6d88\u606f\u7c7b\u578b,\u5185\u5bb9';
const COMPACT_JSON_THRESHOLD = 5000;

function formatCsvRow(chat, msg) {
  const sender = msg.isSelf ? '\u6211' : msg.senderName || msg.senderWxid || '';
  return [
    escapeCsv(chat.displayName),
    escapeCsv(chat.type === 'group' ? '\u7fa4\u804a' : '\u79c1\u804a'),
    escapeCsv(msg.datetime || ''),
    escapeCsv(sender),
    escapeCsv(msg.isSelf ? '\u662f' : '\u5426'),
    escapeCsv(msg.typeName || ''),
    escapeCsv(msg.content || ''),
  ].join(',');
}

function createCsvWriter(outFile) {
  fs.writeFileSync(outFile, `${CSV_HEADER}\n`, 'utf8');

  return {
    writeChat(chat) {
      if (!chat?.messages?.length) return;
      const lines = new Array(chat.messages.length);
      for (let i = 0; i < chat.messages.length; i += 1) {
        lines[i] = formatCsvRow(chat, chat.messages[i]);
      }
      fs.appendFileSync(outFile, `${lines.join('\n')}\n`, 'utf8');
    },
  };
}

function writeCsvMessages(chats, outFile) {
  const writer = createCsvWriter(outFile);
  for (const chat of chats) {
    writer.writeChat(chat);
  }
}

function splitQuoteContent(content) {
  const text = String(content ?? '');
  const idx = text.indexOf('\n\u21aa ');
  if (idx === -1) return null;
  const replyText = text.slice(0, idx).trim();
  const quoteLine = text.slice(idx + 1).trim();
  if (!quoteLine.startsWith('\u21aa ')) return null;
  return { replyText, quoteLine: quoteLine.slice(2) };
}

function isFileLikeMessage(msg) {
  if (msg.extra?.kind === 'file') return true;
  const content = String(msg.content ?? '').trim();
  if (content.startsWith('[\u6587\u4ef6]')) return true;
  if (msg.type === 3 || msg.type === 34 || msg.type === 43) return false;
  return /^[^\s/\\<>:"|?*]+\.[a-z0-9]{1,10}$/i.test(content);
}

function resolveMessageKind(msg) {
  if (msg.extra?.kind) return msg.extra.kind;
  if (splitQuoteContent(msg.content)) return 'quote_reply';
  if (isFileLikeMessage(msg)) return 'file';
  if (msg.content === '[\u56fe\u7247]' || msg.type === 3) return 'image';
  if (msg.content === '[\u89c6\u9891]' || msg.type === 43) return 'video';
  return null;
}

function renderQuoteBody(replyText, quoteLine) {
  const replyHtml = replyText
    ? `<div class="reply-text">${escapeHtml(replyText).replace(/\n/g, '<br>')}</div>`
    : '';
  const quoteHtml = `<div class="quote-block"><span class="quote-label">\u5f15\u7528</span><span class="quote-content">\u21aa ${escapeHtml(quoteLine)}</span></div>`;
  return `${replyHtml}${quoteHtml}`;
}

function formatFileSizeLabel(bytes) {
  const n = Number(bytes);
  if (!n || n <= 0) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function renderFileBody(title, size) {
  const sizeHtml = size
    ? `<span class="file-size">(${escapeHtml(formatFileSizeLabel(size))})</span>`
    : '';
  return `<div class="file-card"><span class="media-tag">[\u6587\u4ef6]</span><span class="file-name">${escapeHtml(title)}</span>${sizeHtml}</div>`;
}

function isRenderableImageUrl(value) {
  const text = String(value ?? '').trim();
  if (!text) return false;
  if (/^(\.\/|\.\.\/|\/)/.test(text)) return true;
  if (/^[a-zA-Z]:[\\/]/.test(text)) return true;
  if (/^https?:\/\//i.test(text) && text.length <= 2048) return true;
  if (
    text.length <= 2048 &&
    /[\\/]/.test(text) &&
    !/^(javascript|data|blob):/i.test(text) &&
    !/[<>"']/.test(text)
  ) {
    return true;
  }
  return false;
}

function resolveImageUrl(msg) {
  const candidates = [
    msg.extra?.htmlImagePath || msg.extra?.exportedImagePath,
    msg.extra?.imageUrl,
    msg.extra?.bigImgUrl,
    msg.extra?.midImgUrl,
    msg.extra?.thumbUrl,
  ];
  for (const candidate of candidates) {
    if (isRenderableImageUrl(candidate)) return candidate;
  }
  return '';
}

function renderImageCardByUrl(imageUrl, altText = '[\u56fe\u7247]') {
  if (!imageUrl) {
    return `<span class="media-tag">${escapeHtml(altText)}</span>`;
  }

  return `
    <div class="image-card">
      <img class="chat-image" src="${escapeHtml(imageUrl)}" alt="${escapeHtml(altText)}" loading="lazy" referrerpolicy="no-referrer" />
      <a class="media-link" href="${escapeHtml(imageUrl)}" target="_blank" rel="noopener">Open image</a>
    </div>`;
}

function renderImageBody(msg) {
  return renderImageCardByUrl(resolveImageUrl(msg));
}

function renderRecordImageItems(msg) {
  const items = Array.isArray(msg.extra?.recordItems)
    ? msg.extra.recordItems.filter(
      (item) => item?.kind === 'image' && isRenderableImageUrl(item.htmlImagePath || item.exportedImagePath)
    )
    : [];
  return items.map((item) => item.htmlImagePath || item.exportedImagePath);
}

function renderRecordItems(msg) {
  const items = Array.isArray(msg.extra?.recordItems) ? msg.extra.recordItems : [];
  const blocks = [];
  let textLines = [];

  const flushTextLines = () => {
    if (textLines.length === 0) return;
    blocks.push(`<div class="note-text">${escapeHtml(textLines.join('\n')).replace(/\n/g, '<br>')}</div>`);
    textLines = [];
  };

  for (const item of items) {
    if (!item || item.kind === 'html') continue;

    if (item.kind === 'text') {
      const text = sanitizeRenderedText(item.dataDesc || '');
      if (text) textLines.push(text);
      continue;
    }

    if (item.kind === 'image') {
      const imageUrl = item.htmlImagePath || item.exportedImagePath || '';
      if (isRenderableImageUrl(imageUrl)) {
        flushTextLines();
        blocks.push(renderImageCardByUrl(imageUrl));
      }
    }
  }

  flushTextLines();
  return blocks;
}

function renderNoteBody(msg) {
  const recordBlocks = renderRecordItems(msg);
  if (recordBlocks.length > 0) {
    return recordBlocks.join('');
  }

  const lines = sanitizeRenderedText(msg.content || '').split(/\r?\n/);
  const imageUrls = renderRecordImageItems(msg);
  let imageIndex = 0;
  const blocks = [];
  let textLines = [];

  const flushTextLines = () => {
    if (textLines.length === 0) return;
    blocks.push(`<div class="note-text">${escapeHtml(textLines.join('\n')).replace(/\n/g, '<br>')}</div>`);
    textLines = [];
  };

  for (const line of lines) {
    if (line.trim() === '[\u56fe\u7247]' && imageIndex < imageUrls.length) {
      flushTextLines();
      blocks.push(renderImageCardByUrl(imageUrls[imageIndex]));
      imageIndex += 1;
      continue;
    }
    textLines.push(sanitizeRenderedText(line));
  }

  flushTextLines();

  while (imageIndex < imageUrls.length) {
    blocks.push(renderImageCardByUrl(imageUrls[imageIndex]));
    imageIndex += 1;
  }

  return blocks.join('');
}

function renderMessageBody(msg) {
  const kind = resolveMessageKind(msg);
  const isVoice = msg.type === 34 || msg.typeName === 'voice';
  const transcription = msg.extra?.transcription;

  if (isVoice && transcription) {
    const durationMs = msg.extra?.voiceDurationMs || 0;
    const label =
      durationMs > 0 ? `[\u8bed\u97f3 ${(durationMs / 1000).toFixed(1)}s]` : '[\u8bed\u97f3]';
    return `<span class="voice-label">${escapeHtml(label)}</span><span class="voice-text">${escapeHtml(transcription).replace(/\n/g, '<br>')}</span>`;
  }

  if (kind === 'quote_reply') {
    if (msg.extra?.kind === 'quote_reply') {
      const replyText = msg.extra.replyText || '';
      const quotedSender = msg.extra.quotedSenderName || '\u672a\u77e5';
      const quotedPreview = msg.extra.quotedPreview || '';
      const quoteLine = `${quotedSender}\uff1a${quotedPreview}`;
      return renderQuoteBody(replyText, quoteLine);
    }
    const parsed = splitQuoteContent(msg.content);
    if (parsed) {
      return renderQuoteBody(parsed.replyText, parsed.quoteLine);
    }
  }

  if (kind === 'file') {
    const raw = String(msg.content ?? '').trim();
    const title =
      msg.extra?.title ||
      raw.replace(/^\[\u6587\u4ef6\]\s*/, '').replace(/\s*\([^)]+\)\s*$/, '').trim() ||
      raw;
    return renderFileBody(title, msg.extra?.size);
  }

  if (kind === 'image') {
    return renderImageBody(msg);
  }

  if (kind === 'note' || kind === 'chat_record') {
    return renderNoteBody(msg);
  }

  if (kind === 'video') {
    return `<span class="media-tag">${escapeHtml(msg.content || '[\u89c6\u9891]')}</span>`;
  }

  if (kind === 'link' && msg.extra?.url) {
    const title = msg.extra.title || msg.extra.url;
    return `<span class="media-tag">[\u94fe\u63a5]</span> <a class="msg-link" href="${escapeHtml(msg.extra.url)}" target="_blank" rel="noopener">${escapeHtml(title)}</a>`;
  }

  if (kind === 'miniprogram') {
    const title = msg.extra?.title || String(msg.content || '').replace(/^\[\u5c0f\u7a0b\u5e8f\]\s*/, '');
    return `<span class="media-tag">[\u5c0f\u7a0b\u5e8f]</span> ${escapeHtml(title)}`;
  }

  return escapeHtml(sanitizeRenderedText(msg.content || `[${msg.typeName || '\u6d88\u606f'}]`)).replace(/\n/g, '<br>');
}

function renderHtmlMessage(msg) {
  const sender = msg.isSelf ? '\u6211' : msg.senderName || msg.senderWxid || '\u672a\u77e5';
  const align = msg.isSelf ? 'self' : 'other';
  const isVoice = msg.type === 34 || msg.typeName === 'voice';
  const transcription = msg.extra?.transcription;
  const kind = resolveMessageKind(msg);
  const body = renderMessageBody(msg);

  let bubbleClass = 'bubble';
  if (isVoice && transcription) bubbleClass = 'bubble bubble-voice';
  else if (kind === 'quote_reply') bubbleClass = 'bubble bubble-quote';
  else if (kind === 'file') bubbleClass = 'bubble bubble-file';
  else if (kind === 'image' || kind === 'video') bubbleClass = 'bubble bubble-media';

  return `
    <div class="msg ${align}">
      <div class="meta">${escapeHtml(msg.datetime || '')} | ${escapeHtml(sender)}</div>
      <div class="${bubbleClass}">${body}</div>
    </div>`;
}

function writeHtmlChat(chat, outFile, indexRelPath) {
  const renderedMessages = chat.messages.map(renderHtmlMessage);
  const initialRenderCount = Math.min(160, renderedMessages.length);
  const initialMessagesHtml = renderedMessages.slice(0, initialRenderCount).join('\n');
  const deferredMessagesJson = toInlineJson(renderedMessages.slice(initialRenderCount));
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(chat.displayName)} - \u5fae\u8ff9\u5bfc\u51fa</title>
  <style>
    :root { --green: #07c160; --bg: #f5f7fa; --card: #fff; --text: #1f2937; --muted: #6b7280; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif; background: var(--bg); color: var(--text); }
    header { background: linear-gradient(135deg, #07c160, #34d399); color: #fff; padding: 20px 24px; }
    header h1 { margin: 0 0 6px; font-size: 22px; }
    header p { margin: 0; opacity: 0.9; font-size: 13px; }
    .back { display: inline-block; margin-top: 10px; color: #fff; font-size: 13px; text-decoration: none; opacity: 0.85; }
    main { max-width: 860px; margin: 0 auto; padding: 20px 16px 40px; }
    .render-status { max-width: 860px; margin: 16px auto 0; padding: 0 16px; color: #6b7280; font-size: 12px; }
    .msg { margin-bottom: 14px; display: flex; flex-direction: column; content-visibility: auto; contain-intrinsic-size: 88px; }
    .msg.self { align-items: flex-end; }
    .msg.other { align-items: flex-start; }
    .meta { font-size: 11px; color: var(--muted); margin-bottom: 4px; }
    .bubble { max-width: 78%; padding: 10px 14px; border-radius: 14px; line-height: 1.55; font-size: 14px; word-break: break-word; }
    .msg.self .bubble { background: #dcf8c6; border-bottom-right-radius: 4px; }
    .msg.other .bubble { background: var(--card); border: 1px solid #e5e7eb; border-bottom-left-radius: 4px; }
    .bubble-voice { display: flex; flex-direction: column; gap: 6px; }
    .voice-label { font-size: 12px; color: var(--muted); font-weight: 600; }
    .voice-text { font-size: 14px; line-height: 1.55; }
    .bubble-quote { display: flex; flex-direction: column; gap: 8px; }
    .reply-text { font-size: 14px; line-height: 1.55; }
    .quote-block { border-left: 3px solid #9ca3af; padding: 8px 10px; background: rgba(0,0,0,0.05); border-radius: 0 8px 8px 0; font-size: 12px; line-height: 1.5; }
    .msg.self .quote-block { background: rgba(0,0,0,0.07); }
    .quote-label { display: inline-block; font-size: 11px; color: #6b7280; font-weight: 700; letter-spacing: 0.02em; margin-bottom: 4px; }
    .quote-content { display: block; color: #374151; }
    .bubble-file, .bubble-media { padding: 10px 14px; }
    .image-card { display: flex; flex-direction: column; gap: 8px; align-items: flex-start; }
    .chat-image { display: block; max-width: min(420px, 100%); max-height: 480px; border-radius: 10px; background: #f3f4f6; object-fit: contain; }
    .file-card { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
    .note-text { line-height: 1.6; }
    .media-tag { display: inline-block; font-size: 11px; font-weight: 700; color: #6b7280; letter-spacing: 0.02em; margin-right: 2px; }
    .file-icon { font-size: 16px; }
    .file-name { font-weight: 500; word-break: break-all; }
    .file-size { font-size: 12px; color: var(--muted); }
    .msg-link, .media-link { color: #2563eb; text-decoration: none; }
    .msg-link:hover, .media-link:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <header>
    <h1>${escapeHtml(chat.displayName)}</h1>
    <p>${chat.type === 'group' ? '\u7fa4\u804a' : '\u79c1\u804a'} | ${chat.messageCount} \u6761\u6d88\u606f</p>
    ${indexRelPath ? `<a class="back" href="${escapeHtml(indexRelPath)}">\u8fd4\u56de\u7d22\u5f15</a>` : ''}
  </header>
  <div id="renderStatus" class="render-status">
    ${renderedMessages.length > initialRenderCount ? `\u6b63\u5728\u5206\u6279\u52a0\u8f7d\u5269\u4f59 ${renderedMessages.length - initialRenderCount} \u6761\u6d88\u606f...` : ''}
  </div>
  <main id="chatMessages">
    ${initialMessagesHtml}
  </main>
  <script>
    (() => {
      const pending = ${deferredMessagesJson};
      if (!Array.isArray(pending) || pending.length === 0) return;

      const container = document.getElementById('chatMessages');
      const status = document.getElementById('renderStatus');
      const batchSize = 120;
      let index = 0;

      const updateStatus = () => {
        if (!status) return;
        const remaining = pending.length - index;
        status.textContent = remaining > 0
          ? '\\u6b63\\u5728\\u5206\\u6279\\u52a0\\u8f7d\\u5269\\u4f59 ' + remaining + ' \\u6761\\u6d88\\u606f...'
          : '';
      };

      const appendBatch = () => {
        if (!container || index >= pending.length) {
          updateStatus();
          return;
        }
        const chunk = pending.slice(index, index + batchSize).join('');
        container.insertAdjacentHTML('beforeend', chunk);
        index += batchSize;
        updateStatus();
        if (index >= pending.length) return;
        if (typeof requestIdleCallback === 'function') {
          requestIdleCallback(appendBatch, { timeout: 120 });
        } else {
          setTimeout(appendBatch, 16);
        }
      };

      updateStatus();
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(() => appendBatch());
      } else {
        setTimeout(appendBatch, 0);
      }
    })();
  </script>
</body>
</html>`;

  fs.writeFileSync(outFile, html, 'utf8');
}

function writeHtmlIndex({ outputDir, selfWxid, exportedAt, conversations, chatsRelDir }) {
  void chatsRelDir;
  const items = conversations
    .map((conv) => {
      const htmlFile = conv.files?.html || null;
      if (!htmlFile) return '';
      const href = htmlFile.replace(/\\/g, '/');
      return `<li><a href="${escapeHtml(href)}">${escapeHtml(conv.displayName)}</a> <span class="muted">(${conv.messageCount} \u6761 | ${conv.type === 'group' ? '\u7fa4\u804a' : '\u79c1\u804a'})</span></li>`;
    })
    .filter(Boolean)
    .join('\n');

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>\u5fae\u8ff9\u5bfc\u51fa\u7d22\u5f15</title>
  <style>
    body { font-family: "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif; max-width: 720px; margin: 40px auto; padding: 0 20px; color: #1f2937; }
    h1 { color: #07c160; }
    .muted { color: #6b7280; font-size: 13px; }
    ul { line-height: 2; padding-left: 20px; }
    a { color: #059669; text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <h1>\u5fae\u8ff9 Wetrace \u5bfc\u51fa\u7d22\u5f15</h1>
  <p class="muted">\u8d26\u53f7 ${escapeHtml(selfWxid)} | ${escapeHtml(exportedAt)} | \u5171 ${conversations.length} \u4e2a\u4f1a\u8bdd</p>
  <ul>
    ${items}
  </ul>
</body>
</html>`;

  const indexPath = path.join(outputDir, 'index.html');
  fs.writeFileSync(indexPath, html, 'utf8');
  return indexPath;
}

function writeChatFormats(chat, outputDir, formats, fileBase, indexRelPath) {
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

  if (formats.includes('html')) {
    const outFile = path.join(chatsDir, `${fileBase}.html`);
    writeHtmlChat(chat, outFile, indexRelPath);
    files.html = path.relative(outputDir, outFile).replace(/\\/g, '/');
  }

  return files;
}

module.exports = {
  writeChatFormats,
  writeCsvMessages,
  createCsvWriter,
  writeHtmlIndex,
  escapeHtml,
  COMPACT_JSON_THRESHOLD,
};
