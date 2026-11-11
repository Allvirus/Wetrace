const CLASSIFICATION_SCOPE_VERSION = 2;

function ensureClassificationPolicy(manifest) {
  const configured = manifest?.classificationPolicy;
  const normalized = {
    schemaVersion: CLASSIFICATION_SCOPE_VERSION,
    mode: 'active',
  };
  const changed = JSON.stringify(configured || null) !== JSON.stringify(normalized);
  if (manifest && changed) manifest.classificationPolicy = normalized;
  return { changed, policy: normalized };
}

function getAllowedJewelryGroups(manifest = null) {
  return new Set((manifest?.conversations || []).map((entry) => entry.username).filter(Boolean));
}

function isAllowedJewelryGroup(username) {
  return Boolean(String(username || '').trim());
}

module.exports = {
  CLASSIFICATION_SCOPE_VERSION,
  ensureClassificationPolicy,
  getAllowedJewelryGroups,
  isAllowedJewelryGroup,
};
