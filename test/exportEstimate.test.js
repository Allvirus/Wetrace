const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  estimateExportDuration,
  recordExportSample,
  DEFAULT_MESSAGES_PER_SEC,
  MAX_MESSAGES_PER_SEC,
} = require('../lib/exportEstimate');

const FIXED_PROFILE = {
  cores: 8,
  model: 'Test CPU',
  level: 6,
  levelLabel: '中等',
  multiplier: 1.1,
};

describe('exportEstimate', () => {
  it('uses faster baseline when no learned sample exists', () => {
    const est = estimateExportDuration({
      messageCount: 300000,
      conversationCount: 120,
      formatCount: 2,
      perfProfile: FIXED_PROFILE,
      learned: null,
    });

    assert.ok(est.maxSec < 240, `expected under 4 min, got ${est.maxSec}s`);
    assert.match(est.rangeText, /分钟|秒/);
  });

  it('learns high throughput after a fast export', () => {
    const learned = recordExportSample(null, {
      durationSec: 28,
      messageCount: 300000,
      voiceCount: 0,
      voiceTranscription: false,
    });

    assert.ok(learned.messagesPerSec > 10000);
    assert.ok(learned.messagesPerSec <= MAX_MESSAGES_PER_SEC);

    const est = estimateExportDuration({
      messageCount: 300000,
      conversationCount: 120,
      formatCount: 2,
      perfProfile: FIXED_PROFILE,
      learned,
    });

    assert.ok(est.maxSec < 90, `expected under 90s after learning, got ${est.maxSec}s`);
  });

  it('does not cap learned throughput at the old 2000 limit', () => {
    const learned = { messagesPerSec: 15000, sampleCount: 2 };
    const est = estimateExportDuration({
      messageCount: 300000,
      conversationCount: 120,
      perfProfile: FIXED_PROFILE,
      learned,
    });

    const impliedMps = 300000 / (est.minSec - 3);
    assert.ok(impliedMps > 5000, 'estimate should reflect learned speed above 5000 msg/s');
  });

  it('ignores extremely short samples under 1 second', () => {
    const learned = recordExportSample(null, {
      durationSec: 0.5,
      messageCount: 1000,
    });
    assert.equal(learned, null);
  });
});
