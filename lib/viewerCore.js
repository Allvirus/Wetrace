function normalizeSenderFilter(senderWxids) {
  if (senderWxids == null) return null;
  return new Set((senderWxids || []).map((item) => String(item || '').trim()).filter(Boolean));
}

function isImageMessage(message) {
  return (
    Number(message?.type) === 3 ||
    message?.extra?.kind === 'image' ||
    (Array.isArray(message?.extra?.recordItems) &&
      message.extra.recordItems.some((item) => item?.kind === 'image'))
  );
}

function matchesViewerFilters(message, { senderWxids = null, imagesOnly = false } = {}) {
  const senders = senderWxids instanceof Set ? senderWxids : normalizeSenderFilter(senderWxids);
  if (senders && !senders.has(message?.senderWxid)) {
    return false;
  }
  return !imagesOnly || isImageMessage(message);
}

function filterViewerMessages(messages, options = {}) {
  const senders = normalizeSenderFilter(options.senderWxids);
  return (messages || []).filter((message) =>
    matchesViewerFilters(message, { ...options, senderWxids: senders })
  );
}

module.exports = {
  filterViewerMessages,
  isImageMessage,
  matchesViewerFilters,
  normalizeSenderFilter,
};
