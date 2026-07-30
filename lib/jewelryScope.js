const TARGET_JEWELRY_GROUP_USERNAME = '43697551884@chatroom';
const CLASSIFICATION_SCOPE_VERSION = 1;

function ensureClassificationPolicy(manifest) {
  const configured = manifest?.classificationPolicy;
  const allowedConversationUsernames = Array.isArray(configured?.allowedConversationUsernames)
    ? [...new Set(configured.allowedConversationUsernames.map(String).filter(Boolean))]
    : [];
  const normalized = {
    schemaVersion: CLASSIFICATION_SCOPE_VERSION,
    mode: configured?.mode === 'active' ? 'active' : 'test',
    allowedConversationUsernames: allowedConversationUsernames.length
      ? allowedConversationUsernames
      : [TARGET_JEWELRY_GROUP_USERNAME],
  };
  const changed = JSON.stringify(configured || null) !== JSON.stringify(normalized);
  if (manifest && changed) manifest.classificationPolicy = normalized;
  return { changed, policy: normalized };
}

function getAllowedJewelryGroups(manifest = null) {
  return new Set(ensureClassificationPolicy(manifest).policy.allowedConversationUsernames);
}

function isAllowedJewelryGroup(username, manifest = null) {
  return getAllowedJewelryGroups(manifest).has(String(username || ''));
}

function isTargetJewelryGroup(username) {
  return String(username || '') === TARGET_JEWELRY_GROUP_USERNAME;
}

module.exports = {
  CLASSIFICATION_SCOPE_VERSION,
  TARGET_JEWELRY_GROUP_USERNAME,
  ensureClassificationPolicy,
  getAllowedJewelryGroups,
  isAllowedJewelryGroup,
  isTargetJewelryGroup,
};
