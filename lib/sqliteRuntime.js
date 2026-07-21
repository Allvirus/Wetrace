const originalEmitWarning = process.emitWarning;

process.emitWarning = function emitWarningWithoutSqliteExperimental(warning, typeOrOptions, ...args) {
  const warningType = typeof typeOrOptions === 'string'
    ? typeOrOptions
    : typeOrOptions?.type || warning?.name;
  const message = warning instanceof Error ? warning.message : String(warning || '');
  if (warningType === 'ExperimentalWarning' && message.includes('SQLite is an experimental feature')) {
    return;
  }
  return originalEmitWarning.call(this, warning, typeOrOptions, ...args);
};

try {
  module.exports = require('node:sqlite');
} finally {
  process.emitWarning = originalEmitWarning;
}
