const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('exporter', {
  getAppInfo: () => ipcRenderer.invoke('get-app-info'),
  getDataStatus: (payload) => ipcRenderer.invoke('get-data-status', payload),
  refreshCurrentGroup: (payload) => ipcRenderer.invoke('refresh-current-group', payload),
  buildPinyinSearchIndex: (payload) => ipcRenderer.invoke('build-pinyin-search-index', payload),
  listGroupMembers: (payload) => ipcRenderer.invoke('list-group-members', payload),
  loadConversationMessages: (payload) => ipcRenderer.invoke('load-conversation-messages', payload),
  resolveConversationImages: (payload) => ipcRenderer.invoke('resolve-conversation-images', payload),
  listNoteHydrationTasks: (payload) => ipcRenderer.invoke('list-note-hydration-tasks', payload),
  startNoteHydration: (payload) => ipcRenderer.invoke('start-note-hydration', payload),
  exportFilteredImages: (payload) => ipcRenderer.invoke('export-filtered-images', payload),
  getJewelryTaxonomy: () => ipcRenderer.invoke('get-jewelry-taxonomy'),
  syncJewelryDataset: (payload) => ipcRenderer.invoke('sync-jewelry-dataset', payload),
  listJewelryImages: (payload) => ipcRenderer.invoke('list-jewelry-images', payload),
  saveJewelryClassification: (payload) => ipcRenderer.invoke('save-jewelry-classification', payload),
  batchSaveJewelryProcesses: (payload) => ipcRenderer.invoke('batch-save-jewelry-processes', payload),
  prepareJewelryClassification: (payload) => ipcRenderer.invoke('prepare-jewelry-classification', payload),
  retryJewelryClassification: (payload) => ipcRenderer.invoke('retry-jewelry-classification', payload),
  cancelJewelryClassification: () => ipcRenderer.invoke('cancel-jewelry-classification'),
  searchJewelrySimilar: (payload) => ipcRenderer.invoke('search-jewelry-similar', payload),
  estimateExport: (params) => ipcRenderer.invoke('estimate-export', params),
  recordExportPerf: (sample) => ipcRenderer.invoke('record-export-perf', sample),
  detectWxPaths: () => ipcRenderer.invoke('detect-wx-paths'),
  pickDirectory: (options) => ipcRenderer.invoke('pick-directory', options),
  isDirectoryEmpty: (dirPath) => ipcRenderer.invoke('is-directory-empty', dirPath),
  pickFile: (options) => ipcRenderer.invoke('pick-file', options),
  validateWxDir: (payload) => ipcRenderer.invoke('validate-wx-dir', payload),
  enrichAccounts: (payload) => ipcRenderer.invoke('enrich-accounts', payload),
  checkWeChatStatus: (payload) => ipcRenderer.invoke('check-wechat-status', payload),
  getScanRequirements: (payload) => ipcRenderer.invoke('get-scan-requirements', payload),
  runPreflight: (payload) => ipcRenderer.invoke('run-preflight', payload),
  getLogDir: () => ipcRenderer.invoke('get-log-dir'),
  openLogDir: () => ipcRenderer.invoke('open-log-dir'),
  openUserDataDir: () => ipcRenderer.invoke('open-user-data-dir'),
  resetAccountDecryptData: (payload) => ipcRenderer.invoke('reset-account-decrypt-data', payload),
  resetAllToolTraces: (payload) => ipcRenderer.invoke('reset-all-tool-traces', payload),
  scanConversations: (options) => ipcRenderer.invoke('scan-conversations', options),
  countConversationRange: (options) => ipcRenderer.invoke('count-conversation-range', options),
  getConversationTimeBounds: (options) => ipcRenderer.invoke('get-conversation-time-bounds', options),
  cancelScan: () => ipcRenderer.invoke('cancel-scan'),
  loadConversationCache: (payload) => ipcRenderer.invoke('load-conversation-cache', payload),
  listConversationCaches: (payload) => ipcRenderer.invoke('list-conversation-caches', payload),
  clearConversationCache: (payload) => ipcRenderer.invoke('clear-conversation-cache', payload),
  patchConversationCacheLabel: (payload) => ipcRenderer.invoke('patch-conversation-cache-label', payload),
  loadSettings: () => ipcRenderer.invoke('load-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  startExport: (options) => ipcRenderer.invoke('start-export', options),
  cancelExport: () => ipcRenderer.invoke('cancel-export'),
  openPath: (targetPath) => ipcRenderer.invoke('open-path', targetPath),
  showErrorDialog: (options) => ipcRenderer.invoke('show-error-dialog', options),
  onProgress: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('export-progress', listener);
    return () => ipcRenderer.removeListener('export-progress', listener);
  },
  onJewelryProgress: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('jewelry-progress', listener);
    return () => ipcRenderer.removeListener('jewelry-progress', listener);
  },
});
