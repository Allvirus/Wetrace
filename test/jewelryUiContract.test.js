const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

test('renderer exposes SQLite dataset output with jewelry review controls', () => {
  const html = fs.readFileSync(path.join(root, 'electron', 'renderer', 'index.html'), 'utf8');
  const app = fs.readFileSync(path.join(root, 'electron', 'renderer', 'app.js'), 'utf8');
  const viewerCss = fs.readFileSync(path.join(root, 'electron', 'renderer', 'viewer.css'), 'utf8');
  const worker = fs.readFileSync(path.join(root, 'electron', 'viewerWorker.js'), 'utf8');
  const main = fs.readFileSync(path.join(root, 'electron', 'main.js'), 'utf8');
  const exportCore = fs.readFileSync(path.join(root, 'lib', 'exportCore.js'), 'utf8');
  const groupRecordService = fs.readFileSync(path.join(root, 'lib', 'groupRecordService.js'), 'utf8');
  const jewelryDataset = fs.readFileSync(path.join(root, 'lib', 'jewelryDataset.js'), 'utf8');
  const dataReset = fs.readFileSync(path.join(root, 'lib', 'dataReset.js'), 'utf8');

  assert.match(html, /name="format" value="json" checked disabled/);
  assert.doesNotMatch(html, /viewerSyncDatasetBtn|同步 SQLite 数据集/);
  const datasetPreviewStart = html.indexOf('<h3>确认读取后自动保存</h3>');
  const datasetPreview = html.slice(
    datasetPreviewStart,
    html.indexOf('<details class="disclaimer-details">', datasetPreviewStart)
  );
  assert.match(datasetPreview, /dataset\.db/);
  assert.match(datasetPreview, /runtime\//);
  assert.match(datasetPreview, /每群独立 SQLite/);
  assert.doesNotMatch(datasetPreview, /dataset\.json|annotations\/|classification\/runs/);
  assert.doesNotMatch(html, /name="format" value="(?:html|txt|csv)"/i);
  assert.doesNotMatch(html, /打开 index\.html|messages\.csv/i);
  assert.match(exportCore, /const normalizedFormats = \['json'\];/);
  assert.doesNotMatch(exportCore.slice(exportCore.indexOf('async function exportWeChatChats')), /createCsvWriter|writeHtmlIndex/);
  assert.match(app, /input\.type = type/);
  assert.match(app, /'radio',\s*`category-/);
  assert.match(app, /'checkbox',\s*`process-/);
  assert.match(html, /确认无匹配工艺/);
  assert.match(html, /viewerClassificationPrevBtn/);
  assert.match(html, /viewerClassificationNextBtn/);
  assert.match(app, /limit: viewerClassificationLimit/);
  assert.match(worker, /action === 'list-jewelry-images'/);
  assert.match(main, /getAccountDataPaths\(payload\?\.datasetDir\)/);
  assert.match(main, /function ensureAccountRuntime\(payload\)/);
  assert.match(worker, /action === 'ensure-account-runtime'/);
  const runtimePreparation = main.slice(
    main.indexOf('function ensureAccountRuntime'),
    main.indexOf('function queueJewelryClassification')
  );
  assert.match(runtimePreparation, /runViewerWorker\('ensure-account-runtime'/);
  assert.match(runtimePreparation, /accountRuntimeJobs/);
  assert.doesNotMatch(runtimePreparation, /ensureDecrypted|openOrCreateDataset/);
  const workerRuntime = worker.slice(
    worker.indexOf("if (action === 'ensure-account-runtime')"),
    worker.indexOf("if (action === 'sync-jewelry-dataset')")
  );
  assert.match(workerRuntime, /hasDecryptedStorage/);
  assert.match(workerRuntime, /hasDecryptedStorage[\s\S]*return accountPaths;[\s\S]*await ensureDecrypted/);
  const statusHandler = main.slice(
    main.indexOf("ipcMain.handle('get-data-status'"),
    main.indexOf("ipcMain.handle('build-pinyin-search-index'")
  );
  assert.match(statusHandler, /runViewerWorkerOnce\('get-data-status'/);
  assert.doesNotMatch(statusHandler, /getEncryptedStorageFingerprint|needsDecrypt/);
  const autoStatusCheck = app.slice(
    app.indexOf('async function checkViewerDataStatus'),
    app.indexOf('function startViewerAutoSync')
  );
  assert.doesNotMatch(autoStatusCheck, /syncViewerLatest|scanConversations/);
  assert.match(autoStatusCheck, /检测到新记录，可手动刷新/);
  assert.match(worker, /getGroupImageCacheFingerprint/);
  assert.match(autoStatusCheck, /mediaFingerprint/);
  assert.match(autoStatusCheck, /queueViewerDatasetSync\(\{ selections: \[selection\], force: true/);
  assert.match(main, /isCacheCurrent\(latestCache, resolvedAccountPath\) && targetReady/);
  assert.doesNotMatch(main, /function getGroupRecordDir|function getGroupRecordDbPath/);
  assert.doesNotMatch(main, /recordDbPath:/);
  assert.match(groupRecordService, /getAccountDataPaths\(payload\.datasetDir\)\.groupRecordDbPath/);
  assert.doesNotMatch(groupRecordService, /openGroupRecordStore\(payload\.recordDbPath\)/);
  assert.match(jewelryDataset, /getAccountDataPaths\(payload\.datasetDir\)\.groupRecordDbPath/);
  assert.doesNotMatch(dataReset, /path\.join\(resolvedUserData, 'group-records'\)/);
  assert.doesNotMatch(app, /autoClassify/);
  const syncHandler = main.slice(
    main.indexOf("ipcMain.handle('sync-jewelry-dataset'"),
    main.indexOf("ipcMain.handle('list-jewelry-images'")
  );
  assert.doesNotMatch(syncHandler, /queueJewelryClassification/);
  assert.match(html, /viewerRetryClassificationBtn[^>]*>\u8bc6\u522b\u6240\u9009</);
  assert.match(app.slice(app.indexOf('async function retrySelectedClassifications')), /ensureJewelryCodexConsent/);
  assert.match(html, /class="step legacy-export-flow" data-step="4"/);
  assert.match(html, /id="step4Panel" class="panel hidden legacy-export-flow"/);
  assert.match(html, /id="step5Panel" class="panel hidden legacy-export-flow"/);
  assert.match(html, /id="toExportBtn" class="btn primary legacy-export-flow"/);
  assert.match(app, /wetrace\.jewelryDatasetDirsByAccount/);
  assert.match(app, /function loadViewerDatasetDirForAccount\(accountKey\)/);
  assert.match(app, /saveViewerDatasetDirForAccount\(viewerActiveAccountKey/);
  assert.match(html, /id="accountDatasetField"/);
  assert.match(html, /id="viewerProgressLog"/);
  assert.match(html, /option value="missing">\u56fe\u7247\u7f3a\u5931</);
  assert.match(html, /id="pickAccountDatasetBtn"/);
  assert.match(app, /async function ensureViewerDatasetDirForAccount\(accountKey/);
  assert.match(app, /function appendViewerProgressLog\(message, state = 'idle'\)/);
  assert.match(app, /pathStatus: selectedState === 'missing' \? 'missing' : 'available'/);
  assert.match(app, /showImagePlaceholder\('\u56fe\u7247\u52a0\u8f7d\u5931\u8d25'\)/);
  assert.match(main, /resolve-conversation-images[\s\S]*useLegacyExportParser: true/);
  assert.match(worker, /resolveConversationImages\(\{[\s\S]*onProgress:/);
  assert.match(app, /existingOnly: true/);
  assert.match(app, /forceImageResolve: force/);
  assert.match(exportCore, /existingOnly = false/);
  assert.match(exportCore, /pending\.length > 0 && !existingOnly/);
  assert.match(jewelryDataset, /lastResolveSourceVersion === imageSourceVersion/);
  assert.match(jewelryDataset, /resolvedImage\.lastResolveSourceVersion = imageSourceVersion/);
  assert.match(main, /ipcMain\.handle\('build-pinyin-search-index'/);
  assert.match(app, /function matchesViewerGroupSearch\(group, rawQuery\)/);
  const accountSelection = app.slice(app.indexOf('async function selectAccount'), app.indexOf('function renderReadiness'));
  assert.match(accountSelection, /ensureViewerDatasetDirForAccount\(accountKey, \{ prompt: true \}\)/);
  const conversationScan = app.slice(app.indexOf('async function scanConversations'), app.indexOf('async function startExport'));
  assert.match(conversationScan, /ensureViewerDatasetDirForAccount\(accountKey, \{ prompt: true \}\)/);
  assert.match(conversationScan, /getExportOptions\(\{ clientPreflightOk, datasetDir \}\)/);
  assert.match(viewerCss, /\.viewer-groups\s*\{[^}]*grid-template-rows: auto auto auto minmax\(0, 1fr\)/s);
  assert.match(viewerCss, /\.viewer-group-list\s*\{[^}]*overscroll-behavior: contain/s);
  assert.match(app, /confirmLabel: '\u786e\u8ba4\u5e76\u8bfb\u53d6'/);
  const viewerGroupSelection = app.slice(
    app.indexOf('async function selectViewerGroup'),
    app.indexOf('async function syncViewerLatest')
  );
  assert.match(viewerGroupSelection, /loadViewerMessages\(\{ resolveImages: false \}\)/);
  assert.match(viewerGroupSelection, /queueViewerDatasetSync\(\{ selections: \[selection\], token, resolvePreviews: true \}\)/);
  assert.match(app, /viewerDatasetSyncSignatures/);
  assert.match(app, /confirmedUsernames: new Set\(viewerConfirmedGroups\)/);
  assert.match(worker, /datasetDir: payload\.datasetDir/);
  assert.match(app, /event\.datasetDir !== viewerDatasetDir/);
  assert.match(app, /datasetDir: datasetDir \|\| null/);
  const imageResolver = main.slice(
    main.indexOf("ipcMain.handle('resolve-conversation-images'"),
    main.indexOf("ipcMain.handle('export-filtered-images'")
  );
  assert.match(imageResolver, /openOrCreateDataset/);
  assert.match(imageResolver, /imageLayout = 'dataset'/);
  assert.match(app, /if \(!viewerSelectedGroup \|\| !viewerGroupLoadConfirmed \|\| viewerLoading\) return;/);
  assert.match(app, /if \(!viewerSelectedGroup \|\| !viewerGroupLoadConfirmed\) return;/);
  assert.match(app, /const unconfirmed = selections\.filter/);
  assert.match(html, /\u786e\u8ba4\u540e\u624d\u8bfb\u53d6\u672c\u5730\u89e3\u5bc6\u6d88\u606f\u548c\u56fe\u7247/);
  assert.match(html, /\u66f4\u6539\u6b64\u8d26\u53f7\u7684\u6570\u636e\u76ee\u5f55/);
  const viewerOpen = app.slice(app.indexOf('async function openRecordViewer'), app.indexOf('function closeRecordViewer'));
  assert.match(viewerOpen, /ensureViewerDatasetDirForAccount\(accountKey, \{ prompt: true \}\)/);
  assert.doesNotMatch(viewerOpen, /checkViewerDataStatus|selectViewerGroup/);
  const messageLoader = app.slice(app.indexOf('async function loadViewerMessages'), app.indexOf('function scheduleViewerReload'));
  assert.doesNotMatch(messageLoader, /imagesOnly:/);
  const viewerTypeHandler = app.slice(
    app.indexOf("for (const button of viewerTypeFilter?.querySelectorAll('[data-viewer-type]')"),
    app.indexOf("viewerStartDate?.addEventListener")
  );
  assert.match(viewerTypeHandler, /renderViewerMessages/);
  assert.doesNotMatch(viewerTypeHandler, /scheduleViewerReload|loadViewerMessages/);
  const viewerMessageContentSource = app.slice(
    app.indexOf('function getViewerMessageContent'),
    app.indexOf('function renderViewerMessages')
  );
  const getViewerMessageContent = new Function(`${viewerMessageContentSource}; return getViewerMessageContent;`)();
  assert.equal(
    getViewerMessageContent({
      content: 'summary',
      extra: {
        kind: 'note',
        recordItems: [
          { kind: 'text', dataDesc: 'first paragraph' },
          { kind: 'image', dataDesc: 'ignored image' },
          { kind: 'text', dataDesc: 'second paragraph' },
        ],
      },
    }),
    'first paragraph\nsecond paragraph'
  );
  const getViewerExpectedImageCount = new Function(
    viewerMessageContentSource + '; return getViewerExpectedImageCount;'
  )();
  assert.equal(
    getViewerExpectedImageCount({
      type: 49,
      extra: {
        kind: 'note',
        recordItems: [
          { kind: 'text' },
          { kind: 'image' },
          { kind: 'image' },
        ],
      },
    }),
    2
  );
  assert.match(app, /已加载.*本地仍缺/);
});
