const path = require('path');

function getAccountDataPaths(datasetDir) {
  if (!datasetDir) throw new Error('未选择当前账号的数据存放目录');
  const root = path.resolve(datasetDir);
  const runtime = path.join(root, 'runtime');
  return {
    root,
    runtime,
    decryptedDir: path.join(runtime, 'db_storage_decrypted'),
    groupRecordDbPath: path.join(runtime, 'group-records.db'),
    conversationCachePath: path.join(root, 'dataset.db'),
    passphraseCacheDir: runtime,
    imageKeyCacheDir: runtime,
    voiceCacheDir: runtime,
  };
}

module.exports = { getAccountDataPaths };
