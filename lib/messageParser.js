const MAX_CONTENT_LEN = 200;
const MAX_QUOTE_LEN = 80;

function extractXmlTag(xml, tag) {
  if (!xml) return '';
  const match = xml.match(
    new RegExp(`<${tag}><!\\[CDATA\\[(.*?)\\]\\]></${tag}>|<${tag}>([^<]*)</${tag}>`, 's')
  );
  return match ? (match[1] || match[2] || '').trim() : '';
}

function extractXmlBlock(xml, tag) {
  if (!xml) return '';
  const match = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'i'));
  return match ? match[1].trim() : '';
}

function extractXmlAttr(xml, tag, attr) {
  if (!xml) return '';
  const tagMatch = xml.match(new RegExp(`<${tag}\\b([^>]*)/?>`, 'i'));
  if (!tagMatch) return '';
  const attrMatch = tagMatch[1].match(new RegExp(`${attr}="([^"]*)"`, 'i'));
  return attrMatch ? attrMatch[1].trim() : '';
}

function extractFirstXmlValue(xml, names, tags = ['img']) {
  if (!xml) return '';
  for (const name of names) {
    for (const tag of tags) {
      const attrValue = extractXmlAttr(xml, tag, name);
      if (attrValue) return attrValue;
    }
    const tagValue = extractXmlTag(xml, name);
    if (tagValue) return tagValue;
  }
  return '';
}

function decodeXmlEntities(text) {
  const input = String(text ?? '');
  if (!input) return '';
  return input
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

function looksLikeEscapedXml(content) {
  const text = String(content ?? '').trim();
  return text.startsWith('&lt;') && (text.includes('&lt;msg') || text.includes('&lt;appmsg'));
}

function isXmlLike(content) {
  if (!content) return false;
  const trimmed = content.trim();
  return (
    trimmed.startsWith('<?xml') ||
    trimmed.startsWith('<msg>') ||
    trimmed.startsWith('<msg ') ||
    (trimmed.startsWith('<') &&
      (trimmed.includes('<appmsg') ||
        trimmed.includes('<refermsg') ||
        trimmed.includes('<appattach') ||
        trimmed.includes('<voicemsg') ||
        trimmed.includes('<img')))
  );
}

function formatFileSize(bytes) {
  const n = Number(bytes);
  if (!n || n <= 0) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function truncate(text, maxLen = MAX_CONTENT_LEN) {
  const s = String(text ?? '').trim();
  if (s.length <= maxLen) return s;
  return `${s.slice(0, maxLen)}...`;
}

function resolveSenderName(wxid, displayName, contacts) {
  if (displayName) return displayName;
  if (wxid && contacts?.[wxid]) return contacts[wxid];
  if (wxid) return wxid;
  return '\u672a\u77e5';
}

function quotedTypeLabel(quotedType, quotedContent) {
  const t = Number(quotedType);
  if (t === 3) return '[\u56fe\u7247]';
  if (t === 34) return '[\u8bed\u97f3]';
  if (t === 43) return '[\u89c6\u9891]';
  if (t === 47) return '[\u8868\u60c5]';
  if (t === 48) return '[\u4f4d\u7f6e]';

  const normalizedQuotedContent = looksLikeEscapedXml(quotedContent)
    ? decodeXmlEntities(quotedContent)
    : quotedContent;

  if (t === 49 || isXmlLike(normalizedQuotedContent)) {
    const parsed = parseAppMsgFromXml(normalizedQuotedContent);
    if (parsed?.kind === 'file') {
      return parsed.title ? `[\u6587\u4ef6] ${parsed.title}` : '[\u6587\u4ef6]';
    }
    if (parsed?.kind === 'note') {
      const preview = parsed.recordText || parsed.des || parsed.title;
      return preview ? truncate(preview, MAX_QUOTE_LEN) : '[\u7b14\u8bb0]';
    }
    if (parsed?.kind === 'chat_record') {
      const preview = parsed.recordText || parsed.des || parsed.title;
      return preview ? truncate(preview, MAX_QUOTE_LEN) : '[\u804a\u5929\u8bb0\u5f55]';
    }

    const title = extractXmlTag(normalizedQuotedContent, 'title');
    const fileext = extractXmlTag(normalizedQuotedContent, 'fileext');
    const appType = extractXmlTag(normalizedQuotedContent, 'type');
    if (appType === '6' || fileext) {
      return title ? `[\u6587\u4ef6] ${title}` : '[\u6587\u4ef6]';
    }
    if (title) return title;
    return '[\u6d88\u606f]';
  }

  if (quotedContent) return truncate(quotedContent, MAX_QUOTE_LEN);
  return '[\u6d88\u606f]';
}

function getFileExtension(name) {
  const match = String(name ?? '').match(/\.([a-z0-9]{1,10})$/i);
  return match ? match[1].toLowerCase() : '';
}

function looksLikeFilename(text) {
  const s = String(text ?? '').trim();
  if (!s || s.includes('\n') || s.includes('<') || s.includes(' ')) return false;
  if (s.length > 160) return false;
  return /^[^\s/\\<>:"|?*]+\.[a-z0-9]{1,10}$/i.test(s);
}

function hasAppMsgMarkers(content) {
  return (
    content.includes('<appmsg') ||
    content.includes('<refermsg') ||
    content.includes('<appattach') ||
    content.includes('<recorditem')
  );
}

function parseRecordInfo(recordXml) {
  const normalizedXml = looksLikeEscapedXml(recordXml)
    ? decodeXmlEntities(recordXml)
    : String(recordXml ?? '');
  if (!normalizedXml) return null;

  const recordBody = extractXmlBlock(normalizedXml, 'recordinfo');
  const recordInfoXml = recordBody ? `<recordinfo>${recordBody}</recordinfo>` : normalizedXml;
  const info = extractXmlTag(recordInfoXml, 'info');
  const desc = extractXmlTag(recordInfoXml, 'desc');
  const editUsr = extractXmlTag(recordInfoXml, 'editusr');
  const editTime = extractXmlTag(recordInfoXml, 'edittime');
  const fromScene = extractXmlTag(recordInfoXml, 'fromscene');

  if (!info && !desc && !editUsr && !editTime && !fromScene) {
    return null;
  }

  return {
    xml: recordInfoXml,
    info,
    desc,
    text: desc || info || '',
    editUsr,
    editTime: editTime ? Number(editTime) || 0 : 0,
    fromScene: fromScene ? Number(fromScene) || 0 : 0,
  };
}

function extractDataItemAttr(attrText, attrName) {
  const match = String(attrText || '').match(new RegExp(`${attrName}="([^"]*)"`, 'i'));
  return match ? match[1].trim() : '';
}

function parseRecordDataItems(recordInfoXml) {
  const text = String(recordInfoXml || '');
  if (!text || !text.includes('<dataitem')) return [];

  const items = [];
  const regex = /<dataitem\b([^>]*)>([\s\S]*?)<\/dataitem>/gi;
  let match;
  let index = 0;
  while ((match = regex.exec(text))) {
    const attrs = match[1] || '';
    const inner = match[2] || '';
    const itemXml = `<dataitem${attrs}>${inner}</dataitem>`;
    const dataType = extractDataItemAttr(attrs, 'datatype');

    items.push({
      index,
      kind:
        dataType === '2' ? 'image'
          : dataType === '8' ? 'html'
            : dataType === '1' ? 'text'
              : 'item',
      htmlId: extractDataItemAttr(attrs, 'htmlid'),
      dataType,
      subType: extractDataItemAttr(attrs, 'subtype'),
      dataId: extractDataItemAttr(attrs, 'dataid'),
      dataFmt: extractXmlTag(itemXml, 'datafmt'),
      dataDesc: extractXmlTag(itemXml, 'datadesc'),
      fullMd5: extractXmlTag(itemXml, 'fullmd5'),
      thumbFullMd5: extractXmlTag(itemXml, 'thumbfullmd5'),
      head256Md5: extractXmlTag(itemXml, 'head256md5'),
      thumbHead256Md5: extractXmlTag(itemXml, 'thumbhead256md5'),
      cdnDataUrl: extractXmlTag(itemXml, 'cdndataurl'),
      cdnThumbUrl: extractXmlTag(itemXml, 'cdnthumburl'),
      cdnDataKey: extractXmlTag(itemXml, 'cdndatakey'),
      cdnThumbKey: extractXmlTag(itemXml, 'cdnthumbkey'),
      dataSize: Number(extractXmlTag(itemXml, 'datasize')) || 0,
      thumbSize: Number(extractXmlTag(itemXml, 'thumbsize')) || 0,
      fileType: extractXmlTag(itemXml, 'filetype'),
      thumbFileType: extractXmlTag(itemXml, 'thumbfiletype'),
    });
    index += 1;
  }

  return items;
}

function parseAppMsgFromXml(content) {
  if (!content || !hasAppMsgMarkers(content)) return null;

  const appmsgBlock = extractXmlBlock(content, 'appmsg') || content;
  const attachBlock = extractXmlBlock(appmsgBlock, 'appattach');
  const appType = extractXmlTag(appmsgBlock, 'type');
  const title = extractXmlTag(appmsgBlock, 'title');
  const des = extractXmlTag(appmsgBlock, 'des');
  const url = extractXmlTag(appmsgBlock, 'url');
  const fileext = extractXmlTag(attachBlock, 'fileext') || extractXmlTag(appmsgBlock, 'fileext');
  const totallen = extractXmlTag(attachBlock, 'totallen') || extractXmlTag(appmsgBlock, 'totallen');
  const attachid = extractXmlTag(attachBlock, 'attachid');
  const recordItem = extractXmlTag(appmsgBlock, 'recorditem');
  const recordInfo = parseRecordInfo(recordItem);

  const referBlock = extractXmlBlock(appmsgBlock, 'refermsg');
  if (referBlock || appType === '57') {
    const refer = referBlock || '';
    return {
      kind: 'quote_reply',
      replyText: title,
      quotedContent: extractXmlTag(refer, 'content'),
      quotedFrom: extractXmlTag(refer, 'fromusr') || extractXmlTag(refer, 'chatusr'),
      quotedDisplayName: extractXmlTag(refer, 'displayname'),
      quotedType: extractXmlTag(refer, 'type'),
    };
  }

  if (recordInfo) {
    const recordItems = parseRecordDataItems(recordInfo.xml);
    const recordPayload = {
      appType,
      title,
      des,
      url,
      recordText: recordInfo.text || des || title || '',
      recordInfo: recordInfo.info,
      recordDesc: recordInfo.desc,
      recordXml: recordInfo.xml,
      recordItems,
      recordImageCount: recordItems.filter((item) => item.kind === 'image').length,
      editUsr: recordInfo.editUsr,
      editTime: recordInfo.editTime,
      fromScene: recordInfo.fromScene,
    };

    if (appType === '24') {
      return { kind: 'note', ...recordPayload };
    }

    if (appType === '19') {
      return { kind: 'chat_record', ...recordPayload };
    }

    return { kind: 'appmsg', ...recordPayload };
  }

  const isFile =
    appType === '6' ||
    appType === '74' ||
    Boolean(fileext) ||
    (attachid && title && (looksLikeFilename(title) || fileext));

  if (isFile) {
    return {
      kind: 'file',
      title: title || (fileext ? `\u672a\u547d\u540d.${fileext}` : '\u672a\u547d\u540d\u6587\u4ef6'),
      fileext,
      size: totallen ? Number(totallen) : 0,
    };
  }

  if (appType === '5') {
    return { kind: 'link', title, des, url };
  }

  if (appType === '33' || appType === '36') {
    return { kind: 'miniprogram', title, des };
  }

  if (title || des || url) {
    return { kind: 'appmsg', appType, title, des, url };
  }

  return { kind: 'appmsg_unknown', appType };
}

function parsePlainFile(type, content) {
  const trimmed = String(content ?? '').trim();
  if (!trimmed || isXmlLike(trimmed)) return null;

  if (looksLikeFilename(trimmed)) {
    return {
      kind: 'file',
      title: trimmed,
      fileext: getFileExtension(trimmed),
      size: 0,
    };
  }

  if (type === 49 && trimmed && !trimmed.includes('\n')) {
    return { kind: 'appmsg', title: trimmed };
  }

  return null;
}

function parseVoiceDurationMs(content) {
  if (!content || !content.includes('<voicemsg')) return 0;
  const match = content.match(/voicelength="(\d+)"/i);
  return match ? Number(match[1]) || 0 : 0;
}

function extractUrlName(url) {
  const text = String(url || '').trim();
  if (!text) return '';
  try {
    const parsed = new URL(text);
    return parsed.pathname ? parsed.pathname.split('/').pop() || '' : '';
  } catch {
    return text.split('?')[0].split('#')[0].split('/').pop() || '';
  }
}

function parseImageMessage(content, source) {
  const tags = ['img', 'msg', 'msgsource'];
  const thumbUrl =
    extractFirstXmlValue(content, ['cdnthumburl', 'thumburl', 'thumb_url'], tags) ||
    extractFirstXmlValue(source, ['cdnthumburl', 'thumburl', 'thumb_url'], tags);
  const midImgUrl =
    extractFirstXmlValue(content, ['cdnmidimgurl', 'midimgurl', 'mid_img_url'], tags) ||
    extractFirstXmlValue(source, ['cdnmidimgurl', 'midimgurl', 'mid_img_url'], tags);
  const bigImgUrl =
    extractFirstXmlValue(content, ['cdnbigimgurl', 'bigimgurl', 'big_img_url'], tags) ||
    extractFirstXmlValue(source, ['cdnbigimgurl', 'bigimgurl', 'big_img_url'], tags);
  const imageUrl = bigImgUrl || midImgUrl || thumbUrl || '';
  const md5 =
    extractFirstXmlValue(content, ['md5', 'imgmd5'], tags) ||
    extractFirstXmlValue(source, ['md5', 'imgmd5'], tags);
  const newMd5 =
    extractFirstXmlValue(content, ['newmd5'], tags) ||
    extractFirstXmlValue(source, ['newmd5'], tags);
  const thumbMd5 =
    extractFirstXmlValue(content, ['thumbmd5'], tags) ||
    extractFirstXmlValue(source, ['thumbmd5'], tags);
  const aesKey =
    extractFirstXmlValue(content, ['aeskey'], tags) ||
    extractFirstXmlValue(source, ['aeskey'], tags);
  const thumbAesKey =
    extractFirstXmlValue(content, ['cdnthumbaeskey'], tags) ||
    extractFirstXmlValue(source, ['cdnthumbaeskey'], tags);
  const originSourceMd5 =
    extractFirstXmlValue(content, ['originsourcemd5'], tags) ||
    extractFirstXmlValue(source, ['originsourcemd5'], tags);

  return {
    kind: 'image',
    imageUrl,
    thumbUrl,
    midImgUrl,
    bigImgUrl,
    md5,
    newMd5,
    thumbMd5,
    aesKey,
    thumbAesKey,
    originSourceMd5,
    urlName: extractUrlName(imageUrl || bigImgUrl || midImgUrl || thumbUrl),
    raw: content,
    rawSource: source,
  };
}

function parseMessagePayload(type, content, source) {
  if (!content && !source) {
    return { kind: 'empty', raw: content, rawSource: source };
  }

  if (type === 34) {
    return { kind: 'voice', durationMs: parseVoiceDurationMs(content), raw: content };
  }

  if (type === 3) {
    return parseImageMessage(content, source);
  }

  if (type === 43) {
    const playLength = extractXmlAttr(content, 'videomsg', 'playlength');
    return { kind: 'video', playLength: playLength ? Number(playLength) : 0, raw: content };
  }

  if (type === 47) {
    return { kind: 'emoji', raw: content };
  }

  if (type === 48) {
    const label =
      extractXmlAttr(content, 'location', 'label') ||
      extractXmlAttr(content, 'location', 'poiname');
    return { kind: 'location', label, raw: content };
  }

  const appMsg = parseAppMsgFromXml(content);
  if (appMsg) {
    return { ...appMsg, raw: content };
  }

  const plainFile = parsePlainFile(type, content);
  if (plainFile) {
    return { ...plainFile, raw: content };
  }

  if (isXmlLike(content)) {
    const title = extractXmlTag(content, 'title');
    const des = extractXmlTag(content, 'des');
    if (title || des) {
      return { kind: 'appmsg', title, des, raw: content };
    }
    return { kind: 'xml_unknown', raw: content };
  }

  return { kind: 'text', text: content, raw: content };
}

function formatFriendlyMessage(parsed, contacts = {}) {
  if (parsed.kind === 'image') {
    return {
      content: '[\u56fe\u7247]',
      extra: {
        kind: 'image',
        imageUrl: parsed.imageUrl || '',
        thumbUrl: parsed.thumbUrl || '',
        midImgUrl: parsed.midImgUrl || '',
        bigImgUrl: parsed.bigImgUrl || '',
        md5: parsed.md5 || '',
        newMd5: parsed.newMd5 || '',
        thumbMd5: parsed.thumbMd5 || '',
        aesKey: parsed.aesKey || '',
        thumbAesKey: parsed.thumbAesKey || '',
        originSourceMd5: parsed.originSourceMd5 || '',
        urlName: parsed.urlName || '',
      },
    };
  }

  switch (parsed.kind) {
    case 'empty':
      return { content: '', extra: null };

    case 'voice': {
      const durationMs = parsed.durationMs || 0;
      const label =
        durationMs > 0 ? `[\u8bed\u97f3 ${(durationMs / 1000).toFixed(1)}s]` : '[\u8bed\u97f3]';
      return {
        content: label,
        extra: { kind: 'voice', voiceDurationMs: durationMs },
      };
    }

    case 'image':
      return { content: '[\u56fe\u7247]', extra: { kind: 'image' } };

    case 'video': {
      const sec = parsed.playLength > 0 ? ` ${parsed.playLength}s` : '';
      return {
        content: `[\u89c6\u9891${sec}]`,
        extra: { kind: 'video', playLength: parsed.playLength },
      };
    }

    case 'emoji':
      return { content: '[\u8868\u60c5]', extra: { kind: 'emoji' } };

    case 'location': {
      const label = parsed.label || '\u672a\u77e5\u4f4d\u7f6e';
      return {
        content: `[\u4f4d\u7f6e] ${label}`,
        extra: { kind: 'location', label: parsed.label },
      };
    }

    case 'quote_reply': {
      const replyText = parsed.replyText || '';
      const quotedSender = resolveSenderName(
        parsed.quotedFrom,
        parsed.quotedDisplayName,
        contacts
      );
      const quotedPreview = quotedTypeLabel(parsed.quotedType, parsed.quotedContent);
      const quoteLine = `\u21aa ${quotedSender}\uff1a${quotedPreview}`;
      const content = replyText ? `${replyText}\n${quoteLine}` : quoteLine;
      return {
        content: truncate(content, MAX_CONTENT_LEN + MAX_QUOTE_LEN),
        extra: {
          kind: 'quote_reply',
          replyText,
          quotedContent: parsed.quotedContent,
          quotedFrom: parsed.quotedFrom,
          quotedSenderName: quotedSender,
          quotedPreview,
          quotedType: parsed.quotedType,
        },
      };
    }

    case 'file': {
      const sizeLabel = parsed.size ? ` (${formatFileSize(parsed.size)})` : '';
      return {
        content: `[\u6587\u4ef6] ${parsed.title}${sizeLabel}`,
        extra: {
          kind: 'file',
          title: parsed.title,
          fileext: parsed.fileext,
          size: parsed.size,
        },
      };
    }

    case 'link': {
      const main = parsed.title || parsed.des || parsed.url || '\u94fe\u63a5';
      return {
        content: `[\u94fe\u63a5] ${main}`,
        extra: { kind: 'link', title: parsed.title, des: parsed.des, url: parsed.url },
      };
    }

    case 'miniprogram': {
      const main = parsed.title || parsed.des || '\u5c0f\u7a0b\u5e8f';
      return {
        content: `[\u5c0f\u7a0b\u5e8f] ${main}`,
        extra: { kind: 'miniprogram', title: parsed.title, des: parsed.des },
      };
    }

    case 'note': {
      const main = parsed.recordText || parsed.des || parsed.title || '[\u7b14\u8bb0]';
      return {
        content: main,
        extra: {
          kind: 'note',
          appType: parsed.appType,
          title: parsed.title,
          des: parsed.des,
          url: parsed.url,
          recordText: parsed.recordText,
          recordInfo: parsed.recordInfo,
          recordDesc: parsed.recordDesc,
          recordXml: parsed.recordXml,
          recordItems: parsed.recordItems,
          recordImageCount: parsed.recordImageCount,
          editUsr: parsed.editUsr,
          editTime: parsed.editTime,
          fromScene: parsed.fromScene,
        },
      };
    }

    case 'chat_record': {
      const main = parsed.recordText || parsed.des || parsed.title || '[\u804a\u5929\u8bb0\u5f55]';
      return {
        content: main,
        extra: {
          kind: 'chat_record',
          appType: parsed.appType,
          title: parsed.title,
          des: parsed.des,
          url: parsed.url,
          recordText: parsed.recordText,
          recordInfo: parsed.recordInfo,
          recordDesc: parsed.recordDesc,
          recordXml: parsed.recordXml,
          recordItems: parsed.recordItems,
          recordImageCount: parsed.recordImageCount,
          editUsr: parsed.editUsr,
          editTime: parsed.editTime,
          fromScene: parsed.fromScene,
        },
      };
    }

    case 'appmsg': {
      const main = parsed.title || parsed.des || parsed.url || '[\u5e94\u7528\u6d88\u606f]';
      return {
        content: truncate(main),
        extra: {
          kind: 'appmsg',
          appType: parsed.appType,
          title: parsed.title,
          des: parsed.des,
          url: parsed.url,
          recordText: parsed.recordText,
          recordInfo: parsed.recordInfo,
          recordDesc: parsed.recordDesc,
          recordXml: parsed.recordXml,
          recordItems: parsed.recordItems,
          recordImageCount: parsed.recordImageCount,
          editUsr: parsed.editUsr,
          editTime: parsed.editTime,
          fromScene: parsed.fromScene,
        },
      };
    }

    case 'appmsg_unknown':
    case 'xml_unknown':
      return { content: '[\u5e94\u7528\u6d88\u606f]', extra: { kind: parsed.kind } };

    case 'text':
    default:
      return { content: parsed.text ?? parsed.raw ?? '', extra: null };
  }
}

function enrichMessage(type, content, contacts = {}, source = '') {
  const parsed = parseMessagePayload(type, content, source);
  const result = formatFriendlyMessage(parsed, contacts);

  if (result.content && isXmlLike(result.content)) {
    const title = extractXmlTag(result.content, 'title');
    const des = extractXmlTag(result.content, 'des');
    result.content = title || des || '[\u5e94\u7528\u6d88\u606f]';
    result.extra = { ...(result.extra || {}), kind: result.extra?.kind || 'xml_fallback' };
  }

  return result;
}

module.exports = {
  enrichMessage,
  parseMessagePayload,
  formatFriendlyMessage,
  extractXmlTag,
  isXmlLike,
  formatFileSize,
  truncate,
};
