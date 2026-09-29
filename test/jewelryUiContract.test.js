const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

test('renderer exposes SQLite dataset output with jewelry review controls', () => {
  const html = fs.readFileSync(path.join(root, 'electron', 'renderer', 'index.html'), 'utf8');
  const app = fs.readFileSync(path.join(root, 'electron', 'renderer', 'app.js'), 'utf8');
  const viewerCss = fs.readFileSync(path.join(root, 'electron', 'renderer', 'viewer.css'), 'utf8');
  const preload = fs.readFileSync(path.join(root, 'electron', 'preload.js'), 'utf8');
  const worker = fs.readFileSync(path.join(root, 'electron', 'viewerWorker.js'), 'utf8');
  const main = fs.readFileSync(path.join(root, 'electron', 'main.js'), 'utf8');
  const exportCore = fs.readFileSync(path.join(root, 'lib', 'exportCore.js'), 'utf8');
  const groupRecordService = fs.readFileSync(path.join(root, 'lib', 'groupRecordService.js'), 'utf8');
  const codexClassifier = fs.readFileSync(path.join(root, 'lib', 'codexJewelryClassifier.js'), 'utf8');
  const jewelryDataset = fs.readFileSync(path.join(root, 'lib', 'jewelryDataset.js'), 'utf8');
  const dataReset = fs.readFileSync(path.join(root, 'lib', 'dataReset.js'), 'utf8');
  const noteResourceDownloader = fs.readFileSync(path.join(root, 'lib', 'noteResourceDownloader.js'), 'utf8');
  const realCodexScript = fs.readFileSync(path.join(root, 'scripts', 'test-codex-jewelry-real.js'), 'utf8');
  const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8').replace(/^\uFEFF/, ''));

  assert.equal(
    packageJson.scripts['codex:real-results'],
    'node scripts/test-codex-jewelry-real.js --persist-results'
  );
  assert.match(realCodexScript, /PERSIST_RESULTS/);
  assert.match(realCodexScript, /ensureSourceAccountProvenance\(\);/);
  assert.match(realCodexScript, /eligibleStates: \['pending', 'failed'\]/);
  assert.match(html, /name="format" value="json" checked disabled/);
  assert.doesNotMatch(html, /viewerSyncDatasetBtn|同步 SQLite 数据集/);
  const startPanel = html.slice(html.indexOf('id="step1Panel"'), html.indexOf('id="step2Panel"'));
  assert.match(startPanel, /<h3>工作原理<\/h3>/);
  assert.match(startPanel, /<h3>生成内容与目录结构<\/h3>/);
  assert.match(startPanel, /<h3>使用方法<\/h3>/);
  assert.doesNotMatch(startPanel, /隐私说明|免责声明|不同不信版本如何获取密钥|诊断日志/);
  const datasetPreviewStart = html.indexOf('<h3>生成内容与目录结构</h3>');
  const datasetPreview = html.slice(
    datasetPreviewStart,
    html.indexOf('<h3>使用方法</h3>', datasetPreviewStart)
  );
  assert.match(datasetPreview, /dataset\.db/);
  assert.match(datasetPreview, /runtime\//);
  assert.match(datasetPreview, /group-records\.db/);
  assert.match(datasetPreview, /每群独立 SQLite/);
  assert.match(datasetPreview, /classification\/runs\//);
  assert.match(datasetPreview, /classified-images\//);
  assert.doesNotMatch(html, /name="format" value="(?:html|txt|csv)"/i);
  assert.doesNotMatch(html, /打开 index\.html|messages\.csv/i);
  assert.match(exportCore, /const normalizedFormats = \['json'\];/);
  assert.doesNotMatch(exportCore.slice(exportCore.indexOf('async function exportWeChatChats')), /createCsvWriter|writeHtmlIndex/);
  assert.match(app, /input\.type = type/);
  assert.match(app, /'radio',\s*`category-/);
  assert.match(app, /'checkbox',\s*`process-/);
  assert.match(html, /确认无匹配工艺/);
  assert.doesNotMatch(html, /viewerClassificationPrevBtn|viewerClassificationNextBtn|classification-pagination/);
  assert.match(app, /limit: viewerClassificationLimit/);
  assert.match(worker, /action === 'list-jewelry-images'/);
  assert.match(main, /getAccountDataPaths\(payload\?\.datasetDir\)/);
  assert.match(main, /const hasSingleInstanceLock = app\.requestSingleInstanceLock\(\)/);
  assert.match(main, /if \(!hasSingleInstanceLock\) \{\s*app\.quit\(\);\s*\} else \{/);
  assert.match(main, /app\.on\('second-instance',[\s\S]*mainWindow\.restore\(\)[\s\S]*mainWindow\.show\(\)[\s\S]*mainWindow\.focus\(\)/);
  assert.match(html, /Content-Security-Policy/);
  assert.match(html, /default-src 'self'/);
  assert.match(html, /connect-src 'none'/);
  assert.match(html, /object-src 'none'/);
  assert.match(main, /sandbox: true/);
  assert.match(main, /setWindowOpenHandler/);
  assert.match(main, /action: 'deny'/);
  assert.match(main, /setPermissionRequestHandler/);
  assert.match(main, /isTrustedIpcEvent/);
  assert.match(main, /senderFrame !== event.sender.mainFrame/);
  assert.match(main, /BLOCKED_OPEN_EXTENSIONS/);
  assert.match(main, /'.csv'/);
  assert.match(main, /'.exe'/);
  assert.match(main, /'.html'/);
  assert.equal((main.match(/ipcMain.handle/g) || []).length, 1);
  assert.match(main, /function ensureAccountRuntime\(payload\)/);
  assert.match(worker, /action === 'ensure-account-runtime'/);
  assert.match(preload, /refreshCurrentGroup: \(payload\) => ipcRenderer\.invoke\('refresh-current-group'/);
  assert.match(main, /handleTrusted\('refresh-current-group'/);
  assert.match(worker, /action === 'refresh-current-group'/);
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
    main.indexOf("handleTrusted('get-data-status'"),
    main.indexOf("handleTrusted('build-pinyin-search-index'")
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
  const currentGroupRefresh = app.slice(
    app.indexOf('async function syncViewerLatest'),
    app.indexOf('async function checkViewerDataStatus')
  );
  assert.match(currentGroupRefresh, /refreshCurrentGroup/);
  assert.match(currentGroupRefresh, /appendViewerProgressLog/);
  assert.match(currentGroupRefresh, /finally \{/);
  assert.doesNotMatch(currentGroupRefresh, /scanConversations|getDataStatus/);
  assert.match(main, /isCacheCurrent\(latestCache, resolvedAccountPath\) && targetReady/);
  assert.doesNotMatch(main, /function getGroupRecordDir|function getGroupRecordDbPath/);
  assert.doesNotMatch(main, /recordDbPath:/);
  assert.match(groupRecordService, /getAccountDataPaths\(payload\.datasetDir\)\.groupRecordDbPath/);
  assert.doesNotMatch(groupRecordService, /openGroupRecordStore\(payload\.recordDbPath\)/);
  assert.match(jewelryDataset, /getAccountDataPaths\(payload\.datasetDir\)\.groupRecordDbPath/);
  assert.doesNotMatch(dataReset, /path\.join\(resolvedUserData, 'group-records'\)/);
  assert.doesNotMatch(app, /autoClassify/);
  const syncHandler = main.slice(
    main.indexOf("handleTrusted('sync-jewelry-dataset'"),
    main.indexOf("handleTrusted('list-jewelry-images'")
  );
  assert.doesNotMatch(syncHandler, /queueJewelryClassification/);
  assert.doesNotMatch(html, /viewerRetryClassificationBtn/);
  assert.doesNotMatch(app, /classifyPendingImages/);
  assert.match(html, /<aside id="viewerClassificationTasks"/);
  assert.match(html, /id="viewerClassificationTaskList"/);
  assert.match(html, /id="viewerClassificationTaskCount"/);
  assert.match(html, /id="viewerClassificationTaskLog"/);
  assert.match(html, /id="viewerClassificationLayout"/);
  assert.match(html, /data-classification-columns="3"/);
  assert.match(html, /data-classification-columns="4"/);
  assert.match(viewerCss, /\.viewer-classification-panel\s*\{[^}]*grid-template-columns: minmax\(400px, 1fr\) clamp\(280px, 26vw, 320px\)/s);
  assert.match(viewerCss, /\.classification-task-progress\s*\{[^}]*grid-column: 2;[^}]*grid-row: 2 \/ -1/s);
  assert.match(viewerCss, /\.classification-task-summary\s*\{[^}]*grid-template-columns: minmax\(0, 1fr\)/s);
  assert.match(viewerCss, /\.classification-task-row\s*\{/);
  assert.match(viewerCss, /\.classification-task-meter progress\s*\{/);
  assert.match(viewerCss, /\.classification-task-details\s*\{/);
  assert.match(viewerCss, /\.classification-task-actions\s*\{/);
  assert.match(viewerCss, /\.classification-task-result-line\s*\{/);
  assert.match(viewerCss, /\.classification-task-log-section\s*\{/);
  assert.match(viewerCss, /\.classification-task-log-entry\s*\{/);
  assert.match(viewerCss, /\.classification-grid\[data-columns="3"\][^{]*\{[^}]*column-count: 3/s);
  assert.match(viewerCss, /\.classification-grid\[data-columns="4"\][^{]*\{[^}]*column-count: 4/s);
  assert.match(viewerCss, /\.classification-scope-popover\s*\{/);
  assert.match(app, /function renderClassificationTaskProgress\(\)/);
  assert.match(app, /function updateClassificationRunProgress\(event\)/);
  assert.match(app, /viewerExpandedClassificationRuns/);
  assert.match(app, /function showClassificationRunImages\(run\)/);
  assert.match(app, /function retryClassificationRun\(run, failedOnly\)/);
  assert.match(app, /function classificationRunRetryConfig\(run\)/);
  assert.match(app, /run\.status === 'cancelled' \? \['pending', 'failed'\] : null/);
  assert.match(app, /function setClassificationColumns\(value/);
  assert.match(app, /localStorage\.setItem\(CLASSIFICATION_COLUMNS_KEY/);
  assert.match(preload, /retryJewelryClassification/);
  assert.match(preload, /cancelJewelryClassification: \(payload\)/);
  assert.match(main, /handleTrusted\('retry-jewelry-classification'/);
  assert.match(main, /cancelJewelryClassification\(payload\)/);
  const retryConfigSource = app.slice(
    app.indexOf('function classificationRunRetryConfig'),
    app.indexOf('function classificationRunTimestamp')
  );
  const classificationRunRetryConfig = new Function(
    retryConfigSource + '; return classificationRunRetryConfig;'
  )();
  assert.equal(classificationRunRetryConfig({ status: 'completed_with_errors' }).failedOnly, true);
  assert.equal(classificationRunRetryConfig({ status: 'cancelled' }).failedOnly, false);
  assert.equal(classificationRunRetryConfig({ status: 'completed' }).label, '\u518d\u6b21\u8bc6\u522b');
  assert.equal(classificationRunRetryConfig({ status: 'running' }), null);
  assert.match(app, /function requestClassificationCancellation\(run = null\)/);
  assert.match(app, /datasetDir: viewerDatasetDir,[\s\S]*runId: targetRun\.runId/);
  assert.match(app, /updateClassificationRunProgress\(\{ \.\.\.updatedRun, phase: 'classification-done' \}\)/);
  assert.match(app, /function appendClassificationTaskLog\(message/);
  assert.match(app, /logClassificationRunState\(event\)/);
  assert.match(codexClassifier, /function buildClassificationScope\(candidates, filters = \{\}\)/);
  assert.match(codexClassifier, /targetBatchSize,[\s\S]*batchCount,/);
  assert.match(html, /id="viewerClassificationGroupPicker"/);
  assert.match(html, /id="viewerClassificationSenderPicker"/);
  assert.match(html, /id="viewerClassificationAutoCollect"/);
  assert.match(html, /viewerSelectCurrentClassificationBtn[^>]*>3 \u6dfb\u52a0\u7b5b\u9009\u56fe\u7247</);
  assert.match(html, /viewerCreateClassificationTaskBtn[^>]*>4 \u786e\u8ba4\u5e76\u5f00\u59cb\u8bc6\u522b/);
  assert.doesNotMatch(html, /\u8bc6\u522b\u5f53\u524d\u65e5\u671f\u8303\u56f4|\u8bc6\u522b\u5f53\u5929/);
  assert.match(html, /viewerClearClassificationSelectionBtn/);
  assert.match(html, /option value="not_jewelry">\u975e\u73e0\u5b9d</);
  assert.match(html, /option value="" selected>\u5168\u90e8\u72b6\u6001/);
  assert.match(html, /option value="unrecognized">\u672a\u8bc6\u522b</);
  assert.match(html, /viewer\.css\?v=20260806-2/);
  assert.match(html, /app\.js\?v=20260806-2/);
  assert.match(html, /id="viewerClassificationDay"/);
  assert.match(html, /id="viewerClassificationDateFrom"/);
  assert.match(html, /id="viewerClassificationDateTo"/);
  assert.match(html, /data-classification-range="latest"/);
  assert.match(html, /id="viewerSimilarityPanel"/);
  assert.match(preload, /searchJewelrySimilar/);
  assert.match(main, /handleTrusted\('search-jewelry-similar'/);
  assert.match(viewerCss, /\.viewer-similarity-panel\.hidden/);
  assert.match(app, /conversationUsernames: viewerSelectedClassificationGroups === null/);
  assert.match(app, /senderWxids: viewerSelectedClassificationSenders === null/);
  assert.match(app, /function refreshAutomaticClassificationDraft\(\)/);
  assert.match(app, /viewerClassificationAutoCollect\?\.checked[\s\S]*loadClassificationReview\(\{ resetExpanded: true \}\)/);
  assert.match(jewelryDataset, /senders: \[\.\.\.items\.reduce/);
  assert.match(app, /states: codexResultStates \|\| unrecognizedStates/);
  assert.match(app, /\['pending', 'failed'\]/);
  assert.match(app, /viewerClassificationStateCounts/);
  assert.match(app, /annotation\.state === 'needs_review'/);
  assert.match(app, /viewerClassificationState\.value = 'codex_results'/);
  assert.match(app, /viewerClassificationState\.value = ''/);
  assert.match(app, /resultTitle\.textContent = '\u5f53\u524d\u8bc6\u522b\u7ed3\u679c'/);
  assert.match(app, /processNames\.join\('\u3001'\)/);
  assert.match(viewerCss, /\.classification-card-media\s*\{[^}]*height: clamp\(300px, 38vh, 420px\)/s);
  assert.match(viewerCss, /\.classification-card\s*\{[^}]*height: max-content[^}]*min-height: 310px/s);
  assert.match(viewerCss, /\.classification-card-media img\s*\{[^}]*object-fit: contain/s);
  assert.match(viewerCss, /\.classification-result-grid\s*\{/);
  assert.match(app, /day.*viewerClassificationDay\.value \|\| null/);
  assert.match(app, /viewerExpandedClassificationDays/);
  assert.match(app, /viewerClassificationDayCounts/);
  assert.match(app, /new IntersectionObserver/);
  assert.match(app, /root: viewerClassificationList/);
  assert.match(app, /filters: \{ \.\.\.getClassificationFilters\(\), day \}/);
  assert.match(app, /offset: state\.items\.length/);
  assert.match(app, /selectDay\.textContent = '\u5168\u9009\u5f53\u5929'/);
  assert.match(app, /idsOnly: true/);
  assert.match(app, /limit: 5000/);
  const classificationListHandler = main.slice(
    main.indexOf("handleTrusted('list-jewelry-images'"),
    main.indexOf("handleTrusted('save-jewelry-classification'")
  );
  assert.match(classificationListHandler, /response\.ok && !payload\?\.idsOnly/);
  assert.match(classificationListHandler, /validateDatasetImageAccess/);
  assert.match(app, /group\.className = 'classification-day-group'/);
  assert.match(viewerCss, /\.classification-day-group\[open\]/);
  assert.match(viewerCss, /\.classification-day-items\s*\{[^}]*column-width: 560px/s);
  assert.match(viewerCss, /\.classification-card\s*\{[^}]*break-inside: avoid/s);
  assert.doesNotMatch(viewerCss, /\.classification-pagination/);
  assert.match(app, /let viewerClassificationLimit = 12/);
  const codexConsent = app.slice(
    app.indexOf('async function ensureJewelryCodexConsent'),
    app.indexOf('function getViewerDatasetSyncSignature')
  );
  assert.match(codexConsent, /preparation\?\.targetCount/);
  assert.match(codexConsent, /preparation\?\.exampleCount/);
  assert.doesNotMatch(codexConsent, /localStorage/);
  assert.match(preload, /prepareJewelryClassification/);
  assert.match(main, /handleTrusted\('prepare-jewelry-classification'/);
  assert.match(app, /prepareClassificationRequest\(imageIds, null, \{\}\)/);
  assert.match(app, /jewelryDecision,/);
  assert.match(app, /Object\.entries\(viewerClassificationDayCounts\)/);
  assert.match(app, /sourceMessage\.senderWxid/);
  assert.match(app, /context\.before/);
  assert.match(app, /context\.after/);
  assert.doesNotMatch(app, /if \(context\.before\?\.length \|\| context\.after\?\.length\)/);
  assert.match(main, /validateTargetJewelryImageIds/);
  assert.match(main, /getDefaultLearningDbPath/);
  assert.doesNotMatch(app, /wetrace\.jewelryCodexConsent/);
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
  const noteHydrationHandler = main.slice(
    main.indexOf("handleTrusted('start-note-hydration')"),
    main.indexOf("handleTrusted('export-filtered-images')")
  );
  assert.doesNotMatch(noteHydrationHandler, /noteHydrationRunner|runNoteHydrationAutomation/);
  assert.doesNotMatch(noteHydrationHandler, /pause-note-hydration|pauseNoteResourceDownloads|noteHydrationRunSequence/);
  assert.doesNotMatch(preload, /pauseNoteHydration|pause-note-hydration/);
  assert.doesNotMatch(app, /viewerNoteScanBtn|viewerNotePauseBtn|scanViewerNoteHydrationCache|pauseViewerNoteHydration/);
  assert.doesNotMatch(html, /viewerNoteScanBtn|viewerNotePauseBtn/);
  assert.match(html, /id="viewerNoteUpdateBtn"[^>]*>\u66f4\u65b0\u7b14\u8bb0\u56fe\u7247</);
  const noteHydrationUi = app.slice(
    app.indexOf('async function startViewerNoteHydration'),
    app.indexOf('function updateViewerExportState')
  );
  assert.match(noteHydrationUi, /if \(viewerSyncImages\.checked\) \{\s*await resolveViewerMessageImages\(viewerMessages, token, \{ force: true \}\);/);
  assert.doesNotMatch(noteHydrationUi, /hydratedTaskIds/);
  assert.doesNotMatch(noteResourceDownloader, /pauseNoteResourceDownloads|resource-paused/);
  assert.doesNotMatch(app, /viewerNoteHydrationActiveStage = 'uia'|\u754c\u9762\u515c\u5e95/);
  assert.doesNotMatch(html, /data-note-stage="uia"/);
  assert.match(viewerCss, /\.viewer-note-stages\s*\{[^}]*repeat\(2,/s);
  assert.equal(fs.existsSync(path.join(root, 'lib', 'noteHydrationRunner.js')), false);
  assert.equal(fs.existsSync(path.join(root, 'scripts', 'note-hydration-uia.ps1')), false);
  assert.match(main, /handleTrusted\('build-pinyin-search-index'/);
  assert.match(app, /function matchesViewerGroupSearch\(group, rawQuery\)/);
  const accountSelection = app.slice(app.indexOf('async function selectAccount'), app.indexOf('function renderReadiness'));
  assert.match(accountSelection, /ensureViewerDatasetDirForAccount\(accountKey, \{ prompt: true \}\)/);
  assert.match(accountSelection, /await openSelectedAccountRecords\(accountPath\)/);
  const cachedAccountOpen = app.slice(
    app.indexOf('async function openSelectedAccountRecords'),
    app.indexOf('function renderConversationCacheList')
  );
  assert.match(cachedAccountOpen, /await refreshConversationCacheHint\(\)/);
  assert.match(cachedAccountOpen, /return useCachedConversations\(accountPath, currentConversationCache\.id\)/);
  assert.match(cachedAccountOpen, /await scanConversations\(\)/);
  const accountDatasetPicker = app.slice(
    app.indexOf('async function pickAccountDatasetDirectory'),
    app.indexOf('function getViewerGroups')
  );
  assert.match(accountDatasetPicker, /await openSelectedAccountRecords\(accountPath\)/);
  const cachedConversationUse = app.slice(
    app.indexOf('async function useCachedConversations'),
    app.indexOf('function showScanToast')
  );
  assert.match(cachedConversationUse, /await openRecordViewer\(\)/);
  const conversationScan = app.slice(app.indexOf('async function scanConversations'), app.indexOf('async function startExport'));
  assert.match(conversationScan, /ensureViewerDatasetDirForAccount\(accountKey, \{ prompt: true \}\)/);
  assert.match(conversationScan, /getExportOptions\(\{ clientPreflightOk, datasetDir \}\)/);
  assert.match(conversationScan, /applyConversationScanResult[\s\S]*await openRecordViewer\(\)/);
  assert.match(viewerCss, /\.viewer-groups\s*\{[^}]*grid-template-rows: auto auto auto minmax\(0, 1fr\)/s);
  assert.match(viewerCss, /\.viewer-group-list\s*\{[^}]*overscroll-behavior: contain/s);
  assert.match(app, /confirmLabel: '\u786e\u8ba4\u5e76\u8bfb\u53d6'/);
  const viewerGroupSelection = app.slice(
    app.indexOf('async function selectViewerGroup'),
    app.indexOf('async function syncViewerLatest')
  );
  assert.match(viewerGroupSelection, /restoreViewerMessageCache\(group\)/);
  assert.match(viewerGroupSelection, /restoredMessageCache \? Promise\.resolve\(\)/);
  assert.match(viewerGroupSelection, /loadViewerMessages\(\{ resolveImages: false \}\)/);
  assert.match(viewerGroupSelection, /queueViewerDatasetSync\(\{ selections: \[selection\], token, resolvePreviews: true \}\)/);
  const autoSyncStart = app.slice(
    app.indexOf('function startViewerAutoSync'),
    app.indexOf('async function openRecordViewer')
  );
  assert.doesNotMatch(autoSyncStart, /viewerAutoSync\.checked\) void checkViewerDataStatus\(\);\s*viewerSyncTimer/);
  assert.match(autoSyncStart, /setInterval/);
  assert.match(app, /viewerClassificationLoadedDatasetDir === viewerDatasetDir/);
  assert.doesNotMatch(
    app.slice(app.indexOf('function closeClassificationReview'), app.indexOf('function scheduleClassificationReload')),
    /disconnect/
  );
  assert.match(app, /viewerDatasetSyncSignatures/);
  assert.match(app, /confirmedUsernames: new Set\(viewerConfirmedGroups\)/);
  assert.match(worker, /datasetDir: payload\.datasetDir/);
  assert.match(app, /event\.datasetDir !== viewerDatasetDir/);
  assert.match(app, /datasetDir: datasetDir \|\| null/);
  const imageResolver = main.slice(
    main.indexOf("handleTrusted('resolve-conversation-images'"),
    main.indexOf("handleTrusted('export-filtered-images'")
  );
  assert.match(imageResolver, /openOrCreateDataset/);
  assert.match(imageResolver, /imageLayout = 'dataset'/);
  assert.match(app, /if \(!viewerSelectedGroup \|\| !viewerGroupLoadConfirmed \|\| viewerLoading\) return;/);
  assert.match(app, /if \(!viewerSelectedGroup \|\| !viewerGroupLoadConfirmed\) return;/);
  assert.match(app, /const unconfirmed = selections\.filter/);
  assert.match(html, /id="recordsStartYear" type="text" inputmode="numeric" maxlength="4"/);
  assert.match(html, /id="recordsStartMonth" type="text" inputmode="numeric" maxlength="2"/);
  assert.match(html, /id="recordsStartDay" type="text" inputmode="numeric" maxlength="2"/);
  assert.doesNotMatch(html, /id="recordsStartTime" type="(?:date|datetime-local)"/);
  assert.match(app, /new Date\(year, month - 1, day, 0, 0, 0, 0\)/);
  assert.match(app, /startTime: selection\?\.startTime \?\? viewerEntryStartTime/);
  assert.match(app, /startTime: start/);
  assert.match(html, /\u786e\u8ba4\u540e\u624d\u8bfb\u53d6\u672c\u5730\u89e3\u5bc6\u6d88\u606f\u548c\u56fe\u7247/);
  assert.match(html, /\u66f4\u6539\u6b64\u8d26\u53f7\u7684\u6570\u636e\u76ee\u5f55/);
  const viewerOpen = app.slice(app.indexOf('async function openRecordViewer'), app.indexOf('function closeRecordViewer'));
  assert.match(viewerOpen, /ensureViewerDatasetDirForAccount\(accountKey, \{ prompt: true \}\)/);
  assert.doesNotMatch(viewerOpen, /checkViewerDataStatus|selectViewerGroup/);
  assert.doesNotMatch(viewerOpen, /viewerMessages = \[\]/);
  const memberRenderer = app.slice(app.indexOf('function renderViewerMembers'), app.indexOf('function openViewerLightbox'));
  assert.match(memberRenderer, /scheduleViewerReload\(\{ syncDataset: false \}\)/);
  assert.doesNotMatch(memberRenderer, /queueViewerDatasetSync/);
  const memberReload = app.slice(app.indexOf('function scheduleViewerReload'), app.indexOf('async function selectViewerGroup'));
  assert.match(memberReload, /function scheduleViewerReload\(\{ syncDataset = true \} = \{\}\)/);
  assert.match(memberReload, /loadViewerMessages\(\{ resolveImages: !syncDataset \}\)/);
  assert.match(memberReload, /if \(token !== viewerRequestToken \|\| !syncDataset\) return;/);
  const allMembersHandler = app.slice(
    app.indexOf("viewerSelectAllMembers?.addEventListener"),
    app.indexOf("viewerSelectAllGroups?.addEventListener")
  );
  assert.match(allMembersHandler, /scheduleViewerReload\(\{ syncDataset: false \}\)/);
  assert.doesNotMatch(app, /\u672a\u9009\u62e9\u7fa4\u6210\u5458/);
  const messageLoader = app.slice(app.indexOf('async function loadViewerMessages'), app.indexOf('function scheduleViewerReload'));
  assert.doesNotMatch(messageLoader, /imagesOnly:/);
  assert.match(messageLoader, /reuseViewerMessageImageState\(message, cachedByKey\)/);
  assert.match(messageLoader, /!imageStateReused/);
  assert.match(app, /nodes: \[\.\.\.viewerMessageList\.childNodes\]/);
  assert.match(app, /viewerMessageList\.replaceChildren\(\.\.\.nodes\)/);
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
  const viewerImageCacheSource = app.slice(
    app.indexOf('function getViewerMessageKey'),
    app.indexOf('async function resolveViewerMessageImages')
  );
  const viewerImageCache = new Function(
    viewerImageCacheSource + '; return { reuseViewerMessageImageState, viewerMessageNeedsImageResolve };'
  )();
  const cachedImageMessage = {
    id: 7,
    serverId: '700',
    createTime: 100,
    type: 3,
    previewImages: [{ url: 'file:///cached.png' }],
    imageLoadState: 'ready',
  };
  const incomingImageMessage = {
    id: 7,
    serverId: '700',
    createTime: 100,
    type: 3,
  };
  assert.equal(
    viewerImageCache.reuseViewerMessageImageState(
      incomingImageMessage,
      new Map([['100:7:700', cachedImageMessage]])
    ),
    true
  );
  assert.deepEqual(incomingImageMessage.previewImages, cachedImageMessage.previewImages);
  assert.equal(viewerImageCache.viewerMessageNeedsImageResolve(incomingImageMessage), false);
  assert.equal(viewerImageCache.viewerMessageNeedsImageResolve(incomingImageMessage, true), true);
  assert.match(app, /已加载.*本地仍缺/);
});
