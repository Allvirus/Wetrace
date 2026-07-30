const STORAGE_KEY = 'wetrace.settings';

const JEWELRY_DATASET_KEY = 'wetrace.jewelryDatasetDirsByAccount';
const LEGACY_JEWELRY_DATASET_KEY = 'wetrace.jewelryDatasetDir';
const RECORDS_START_TIME_KEY = 'wetrace.recordsStartTimesByAccount';

const wxDirInput = document.getElementById('wxDir');
const accountField = document.getElementById('accountField');
const accountList = document.getElementById('accountList');
const accountHint = document.getElementById('accountHint');
const accountDatasetField = document.getElementById('accountDatasetField');
const accountDatasetPath = document.getElementById('accountDatasetPath');
const pickAccountDatasetBtn = document.getElementById('pickAccountDatasetBtn');
const multiAccountTip = document.getElementById('multiAccountTip');
const scanToast = document.getElementById('scanToast');
const scanToastTitle = document.getElementById('scanToastTitle');
const scanToastMessage = document.getElementById('scanToastMessage');
const cancelScanBtn = document.getElementById('cancelScanBtn');
const scanToastElapsed = document.getElementById('scanToastElapsed');
const scanToastNote = document.getElementById('scanToastNote');
const cacheSection = document.getElementById('cacheSection');
const cacheList = document.getElementById('cacheList');
const outputDirInput = document.getElementById('outputDir');
const wxDirHint = document.getElementById('wxDirHint');
const readinessPanel = document.getElementById('readinessPanel');
const readinessBadge = document.getElementById('readinessBadge');
const readinessHint = document.getElementById('readinessHint');
const readinessSuggestions = document.getElementById('readinessSuggestions');
const preflightModal = document.getElementById('preflightModal');
const preflightModalTitle = document.getElementById('preflightModalTitle');
const preflightModalLoading = document.getElementById('preflightModalLoading');
const preflightModalList = document.getElementById('preflightModalList');
const preflightModalPrimaryBtn = document.getElementById('preflightModalPrimaryBtn');
const preflightModalCancelBtn = document.getElementById('preflightModalCancelBtn');
const autoDetectBtn = document.getElementById('autoDetectBtn');
const refreshAccountsBtn = document.getElementById('refreshAccountsBtn');
const resetDecryptBtn = document.getElementById('resetDecryptBtn');
const resetAllToolTracesBtn = document.getElementById('resetAllToolTracesBtn');
const scanBtn = document.getElementById('scanBtn');
const step1Panel = document.getElementById('step1Panel');
const step2Panel = document.getElementById('step2Panel');
const step3Panel = document.getElementById('step3Panel');
const step4Panel = document.getElementById('step4Panel');
const step5Panel = document.getElementById('step5Panel');
const disclaimerAccepted = document.getElementById('disclaimerAccepted');
const welcomeNextBtn = document.getElementById('welcomeNextBtn');
const accountBackBtn = document.getElementById('accountBackBtn');
const exportBackBtn = document.getElementById('exportBackBtn');
const toExportBtn = document.getElementById('toExportBtn');
const outputGuide = document.getElementById('outputGuide');
const convList = document.getElementById('convList');
const convSummary = document.getElementById('convSummary');
const exportSummary = document.getElementById('exportSummary');
const exportEstimateLine = document.getElementById('exportEstimateLine');
const convSearch = document.getElementById('convSearch');
const recordsStartDateControl = document.getElementById('recordsStartDateControl');
const recordsStartYear = document.getElementById('recordsStartYear');
const recordsStartMonth = document.getElementById('recordsStartMonth');
const recordsStartDay = document.getElementById('recordsStartDay');
const clearRecordsStartTimeBtn = document.getElementById('clearRecordsStartTimeBtn');
const selectAllBtn = document.getElementById('selectAllBtn');
const selectNoneBtn = document.getElementById('selectNoneBtn');
const batchTimeBtn = document.getElementById('batchTimeBtn');
const convTypeFilterEl = document.querySelector('.conv-type-filter');
const convRangeModal = document.getElementById('convRangeModal');
const convRangeModalTitle = document.getElementById('convRangeModalTitle');
const convRangeModalSubtitle = document.getElementById('convRangeModalSubtitle');
const convRangeAllCount = document.getElementById('convRangeAllCount');
const convRangePicker = document.getElementById('convRangePicker');
const convRangeStart = document.getElementById('convRangeStart');
const convRangeEnd = document.getElementById('convRangeEnd');
const convRangeCountHint = document.getElementById('convRangeCountHint');
const convRangeCancelBtn = document.getElementById('convRangeCancelBtn');
const convRangeConfirmBtn = document.getElementById('convRangeConfirmBtn');
const backBtn = document.getElementById('backBtn');
const startBtn = document.getElementById('startBtn');
const cancelBtn = document.getElementById('cancelBtn');
const openOutputBtn = document.getElementById('openOutputBtn');
const restartBtn = document.getElementById('restartBtn');
const progressText = document.getElementById('progressText');
const progressFill = document.getElementById('progressFill');
const logEl = document.getElementById('log');
const successSummary = document.getElementById('successSummary');
const voiceTranscriptionBlock = document.getElementById('voiceTranscriptionBlock');
const voiceTranscriptionInput = document.getElementById('voiceTranscription');
const voiceTimeHint = document.getElementById('voiceTimeHint');
const browseRecordsBtn = document.getElementById('browseRecordsBtn');
const recordViewer = document.getElementById('recordViewer');
const closeViewerBtn = document.getElementById('closeViewerBtn');
const viewerAccountName = document.getElementById('viewerAccountName');
const viewerSyncStatus = document.getElementById('viewerSyncStatus');
const viewerAutoSync = document.getElementById('viewerAutoSync');
const viewerRefreshBtn = document.getElementById('viewerRefreshBtn');
const viewerGroupCount = document.getElementById('viewerGroupCount');
const viewerGroupSearch = document.getElementById('viewerGroupSearch');
const viewerSelectAllGroups = document.getElementById('viewerSelectAllGroups');
const viewerGroupList = document.getElementById('viewerGroupList');
const viewerConversationTitle = document.getElementById('viewerConversationTitle');
const viewerConversationMeta = document.getElementById('viewerConversationMeta');
const viewerTypeFilter = document.getElementById('viewerTypeFilter');
const viewerMessageScroller = document.getElementById('viewerMessageScroller');
const viewerLoadOlderBtn = document.getElementById('viewerLoadOlderBtn');
const viewerMessageList = document.getElementById('viewerMessageList');
const viewerMemberCount = document.getElementById('viewerMemberCount');
const viewerMemberSearch = document.getElementById('viewerMemberSearch');
const viewerSelectAllMembers = document.getElementById('viewerSelectAllMembers');
const viewerMemberList = document.getElementById('viewerMemberList');
const viewerStartDate = document.getElementById('viewerStartDate');
const viewerEndDate = document.getElementById('viewerEndDate');
const viewerSyncText = document.getElementById('viewerSyncText');
const viewerSyncImages = document.getElementById('viewerSyncImages');
const viewerNoteHydration = document.getElementById('viewerNoteHydration');
const viewerNoteHydrationSummary = document.getElementById('viewerNoteHydrationSummary');
const viewerNoteHydrationStages = document.getElementById('viewerNoteHydrationStages');
const viewerNoteHydrationList = document.getElementById('viewerNoteHydrationList');
const viewerNoteUpdateBtn = document.getElementById('viewerNoteUpdateBtn');
const viewerPickDatasetBtn = document.getElementById('viewerPickDatasetBtn');
const viewerDatasetPath = document.getElementById('viewerDatasetPath');
const viewerProgressLog = document.getElementById('viewerProgressLog');
const viewerOpenReviewBtn = document.getElementById('viewerOpenReviewBtn');
const viewerClassificationPanel = document.getElementById('viewerClassificationPanel');
const viewerCloseReviewBtn = document.getElementById('viewerCloseReviewBtn');
const viewerClassificationSummary = document.getElementById('viewerClassificationSummary');
const viewerClassificationState = document.getElementById('viewerClassificationState');
const viewerClassificationDay = document.getElementById('viewerClassificationDay');
const viewerClassificationDateFrom = document.getElementById('viewerClassificationDateFrom');
const viewerClassificationDateTo = document.getElementById('viewerClassificationDateTo');
const viewerClassificationApplyDatesBtn = document.getElementById('viewerClassificationApplyDatesBtn');
const viewerClassificationGroup = document.getElementById('viewerClassificationGroup');
const viewerClassificationCategory = document.getElementById('viewerClassificationCategory');
const viewerClassificationProcess = document.getElementById('viewerClassificationProcess');
const viewerClassificationRun = document.getElementById('viewerClassificationRun');
const viewerClassificationSender = document.getElementById('viewerClassificationSender');
const viewerBatchProcesses = document.getElementById('viewerBatchProcesses');
const viewerBatchNoProcess = document.getElementById('viewerBatchNoProcess');
const viewerApplyBatchProcessesBtn = document.getElementById('viewerApplyBatchProcessesBtn');
const viewerSelectCurrentClassificationBtn = document.getElementById('viewerSelectCurrentClassificationBtn');
const viewerClearClassificationSelectionBtn = document.getElementById('viewerClearClassificationSelectionBtn');
const viewerRetryClassificationBtn = document.getElementById('viewerRetryClassificationBtn');
const viewerRetrySelectedClassificationBtn = document.getElementById('viewerRetrySelectedClassificationBtn');
const viewerCancelClassificationBtn = document.getElementById('viewerCancelClassificationBtn');
const viewerClassificationList = document.getElementById('viewerClassificationList');
const viewerUploadSimilarityBtn = document.getElementById('viewerUploadSimilarityBtn');
const viewerSimilarityPanel = document.getElementById('viewerSimilarityPanel');
const viewerCloseSimilarityBtn = document.getElementById('viewerCloseSimilarityBtn');
const viewerSimilaritySummary = document.getElementById('viewerSimilaritySummary');
const viewerSimilarityAllHistory = document.getElementById('viewerSimilarityAllHistory');
const viewerRefreshSimilarityBtn = document.getElementById('viewerRefreshSimilarityBtn');
const viewerSimilarityList = document.getElementById('viewerSimilarityList');
const viewerLightbox = document.getElementById('viewerLightbox');
const viewerLightboxImage = document.getElementById('viewerLightboxImage');
const viewerLightboxClose = document.getElementById('viewerLightboxClose');

let whisperModelBundled = false;
const appVersion = document.getElementById('appVersion');
const stepEls = [...document.querySelectorAll('.step')];
const appNotice = document.getElementById('appNotice');
const appNoticeIcon = document.getElementById('appNoticeIcon');
const appNoticeTitle = document.getElementById('appNoticeTitle');
const appNoticeMessage = document.getElementById('appNoticeMessage');
const appNoticeDetail = document.getElementById('appNoticeDetail');
const appNoticeBtn = document.getElementById('appNoticeBtn');
const appNoticeCancelBtn = document.getElementById('appNoticeCancelBtn');

let currentStep = 1;
let noticeResolve = null;
let noticeMode = 'alert';
let lastOutputDir = '';
let scannedAccounts = [];
let conversationItems = [];
let convTypeFilter = 'all';
const convExportRanges = new Map();
let convRangeDialogContext = null;
let convRangeBounds = { first: 0, last: 0 };
let convRangeCountTimer = null;
const SECONDS_PER_DAY = 24 * 60 * 60;
const SECONDS_PER_YEAR = 365 * SECONDS_PER_DAY;
let resolvedAccountPath = null;
let selectedAccountPath = null;
let exportRunning = false;
let scanRunning = false;
let userCancelledScan = false;
let scanElapsedTimer = null;
let scanStartedAt = 0;
let currentConversationCache = null;
let outputDirNonEmptyAcknowledged = null;
let conversationCacheEntries = [];
const accountProfileCache = new Map();
let profileLoadToken = 0;
let estimateRequestId = 0;
let exportStartedAt = 0;
let exportTaskTotal = 0;
let exportTaskExported = 0;
let exportTaskVoiceEnabled = false;
let exportTaskVoiceTotal = 0;
let exportTaskVoiceDone = 0;
let exportTaskMessageTotal = 0;
let exportTaskMessageDone = 0;
let exportTaskMessagePartial = 0;
let exportPrepRatio = 0;
let exportDisplayPercent = 0;
let exportEtaSmoothSec = null;
let exportEtaDisplayed = null;
let exportEtaLastUpdate = 0;
let exportLastEtaPercent = 0;

const EXPORT_PREP_MAX = 10;
const EXPORT_WORK_SPAN = 88;
const EXPORT_ETA_MIN_ELAPSED_SEC = 15;
const EXPORT_ETA_UPDATE_MS = 5000;
const VIEWER_SYNC_INTERVAL_MS = 10 * 1000;
let viewerIsOpen = false;
let viewerSyncing = false;
let viewerStatusChecking = false;
let viewerSyncTimer = null;
let viewerFingerprint = null;
let viewerMediaFingerprint = null;
let viewerSelectedGroup = null;
let viewerMembers = [];
let viewerSelectedMembers = null;
let viewerMessages = [];
let viewerNextCursor = null;
let viewerHasMore = false;
let viewerLoading = false;
let viewerImagesOnly = false;
let viewerRequestToken = 0;
let viewerFilterTimer = null;
let viewerDatasetDir = '';
let viewerActiveAccountKey = '';
let viewerEntryStartTime = null;
let viewerDatasetSyncing = false;
let viewerDatasetSyncChain = Promise.resolve();
const viewerDatasetSyncSignatures = new Map();
let viewerNoteHydrationTasks = [];
let viewerNoteHydrationSummaryData = null;
let viewerNoteHydrationRunning = false;
let viewerNoteHydrationActiveStage = '';
let viewerNoteHydrationRequestToken = 0;
let viewerGroupLoadConfirmed = false;
let viewerConfirmedGroups = new Set();
let viewerSelectedGroups = new Set();
let viewerGroupSearchKeys = new Map();
let viewerGroupSearchIndexToken = 0;
const viewerGroupSyncOptions = new Map();
let jewelryProductCategories = [];
let jewelryProcesses = [];
let viewerClassificationRuns = [];
let viewerClassificationConversations = [];
let viewerSelectedClassificationImages = new Set();
let viewerSimilarityQuery = null;
let viewerSimilarityRequestToken = 0;
let viewerClassificationFilterTimer = null;
let viewerClassificationTotal = 0;
let viewerClassificationStateCounts = {};
let viewerClassificationLimit = 12;
let viewerClassificationRequestToken = 0;
let viewerClassificationLoadVersion = 0;
let viewerClassificationDayCounts = {};
let viewerClassificationObserver = null;
let viewerClassificationLoadedDatasetDir = '';
let viewerClassificationLoadedFilterSignature = '';
let viewerClassificationDateDatasetDir = '';
let viewerClassificationDateInitialized = false;
let viewerClassificationRangeMode = 'latest';
const viewerClassificationDayLoads = new Map();
const viewerExpandedClassificationDays = new Set();

function isRealDisplayName(displayName, wxid) {
  return Boolean(displayName && displayName !== wxid);
}

function mergeAccountProfile(account, cached) {
  if (!cached) return account;

  const wxid = account.wxid;
  const cachedName = isRealDisplayName(cached.displayName, wxid) ? cached.displayName : null;
  const accountName = isRealDisplayName(account.displayName, wxid) ? account.displayName : null;

  return {
    ...account,
    displayName: accountName || cachedName || account.displayName || cached.displayName || wxid,
    avatar: account.avatar || cached.avatar || null,
  };
}

function cacheAccountProfiles(accounts) {
  for (const account of accounts) {
    const prev = accountProfileCache.get(account.path);
    const wxid = account.wxid;
    const nextName = isRealDisplayName(account.displayName, wxid)
      ? account.displayName
      : isRealDisplayName(prev?.displayName, wxid)
        ? prev.displayName
        : account.displayName;
    const nextAvatar = account.avatar || prev?.avatar || null;

    if (!isRealDisplayName(nextName, wxid) && !nextAvatar && prev) {
      continue;
    }

    accountProfileCache.set(account.path, {
      displayName: nextName,
      avatar: nextAvatar,
    });
  }
}

function applyProfileCache(accounts) {
  return accounts.map((account) => mergeAccountProfile(account, accountProfileCache.get(account.path)));
}

function loadSettingsLocal() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

async function loadSettings() {
  const local = loadSettingsLocal();
  try {
    const saved = await window.exporter.loadSettings();
    if (saved && typeof saved === 'object' && Object.keys(saved).length > 0) {
      return { ...local, ...saved };
    }
  } catch {
    // fall back to localStorage
  }
  return local;
}

function saveSettings() {
  const settings = {
    wxDir: wxDirInput.value.trim(),
    outputDir: outputDirInput.value.trim(),
    formats: getSelectedFormats(),
    voiceTranscription: whisperModelBundled && Boolean(voiceTranscriptionInput?.checked),
    accountPath: selectedAccountPath,
    disclaimerAccepted: disclaimerAccepted.checked,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  window.exporter.saveSettings(settings).catch(() => {});
}

function applySettingsToForm(settings) {
  if (settings.wxDir) wxDirInput.value = settings.wxDir;
  if (settings.outputDir) outputDirInput.value = settings.outputDir;
  for (const input of document.querySelectorAll('input[name="format"]')) {
    input.checked = input.value === 'json';
  }
  if (voiceTranscriptionInput && whisperModelBundled) {
    voiceTranscriptionInput.checked = Boolean(settings.voiceTranscription);
  }
  if (settings.accountPath) {
    selectedAccountPath = settings.accountPath;
  }
  if (typeof settings.disclaimerAccepted === 'boolean') {
    disclaimerAccepted.checked = settings.disclaimerAccepted;
    welcomeNextBtn.disabled = !settings.disclaimerAccepted;
  }
}

function getSelectedFormats() {
  return ['json'];
}

function updateVoiceTranscriptionUI() {
  if (voiceTranscriptionBlock) {
    voiceTranscriptionBlock.classList.toggle('hidden', !whisperModelBundled);
  }
  const progressStepNum = document.getElementById('step4BlockProgressNum');
  if (progressStepNum) {
    progressStepNum.textContent = whisperModelBundled ? '5' : '4';
  }
  if (!whisperModelBundled && voiceTranscriptionInput) {
    voiceTranscriptionInput.checked = false;
  }
}

function isVoiceTranscriptionEnabled() {
  return whisperModelBundled && Boolean(voiceTranscriptionInput?.checked);
}

function getStepBlockedReason(step) {
  if (scanRunning) {
    return '正在扫描会话，请稍候完成后再切换步骤。';
  }
  if (exportRunning) {
    return '正在导出，请稍候完成或取消后再切换步骤。';
  }
  if (step === 2 && !disclaimerAccepted.checked) {
    return '请先勾选页面下方的免责声明，再点击「开始导出」按钮。';
  }
  if (step === 3 && !conversationItems.length) {
    return '请先选择不信账号并点击「扫描会话」，或加载历史扫描结果。';
  }
  if (step === 4 && !conversationItems.length) {
    return '请先完成会话扫描。';
  }
  if (step === 4 && !getSelectedUsernames().length) {
    return '请至少勾选一个要导出的会话，再点击「下一步」。';
  }
  if (step === 5 && !lastOutputDir) {
    return '请先完成导出，才能查看完成页。';
  }
  return null;
}

function canNavigateToStep(step) {
  if (step === currentStep || step < 1 || step > 5) {
    return false;
  }
  if (scanRunning || exportRunning) {
    return false;
  }
  if (step < currentStep) {
    return true;
  }
  return !getStepBlockedReason(step);
}

function updateStepNavUI() {
  if (refreshAccountsBtn) {
    refreshAccountsBtn.disabled = scanRunning;
  }
  stepEls.forEach((el) => {
    const n = Number(el.dataset.step);
    const clickable = canNavigateToStep(n);
    el.classList.toggle('clickable', clickable);
    el.classList.toggle('locked', !clickable && n !== currentStep);
    el.setAttribute('aria-current', n === currentStep ? 'step' : 'false');
    el.setAttribute('aria-disabled', clickable || n === currentStep ? 'false' : 'true');
    el.title = clickable
      ? `前往：${el.textContent.trim()}`
      : n === currentStep
        ? '当前步骤'
        : getStepBlockedReason(n) || '请先完成前面的步骤';
  });

  welcomeNextBtn.classList.toggle('cta-pulse', currentStep === 1 && disclaimerAccepted.checked);
}

function setStep(step) {
  const wasStep = currentStep;
  currentStep = step;
  step1Panel.classList.toggle('hidden', step !== 1);
  step2Panel.classList.toggle('hidden', step !== 2);
  step3Panel.classList.toggle('hidden', step !== 3);
  step4Panel.classList.toggle('hidden', step !== 4);
  step5Panel.classList.toggle('hidden', step !== 5);

  stepEls.forEach((el) => {
    const n = Number(el.dataset.step);
    el.classList.toggle('active', n === step);
    el.classList.toggle('done', n < step);
  });
  if (step === 2 && wasStep > 2) {
    void refreshWxAccountList({ silent: true });
  }
  if (step === 4) {
    void refreshSelectionSummary();
  }
  updateStepNavUI();
}

async function navigateToStep(step) {
  if (step === currentStep) {
    return;
  }
  if (!canNavigateToStep(step)) {
    const reason = getStepBlockedReason(step);
    if (reason) {
      await showFriendlyError('还差一步', reason, null, 'guide');
    }
    return;
  }
  if (step === 2) {
    void refreshConversationCacheHint();
  }
  setStep(step);
}

function appendLog(message) {
  const time = new Date().toLocaleTimeString();
  logEl.textContent += `[${time}] ${message}\n`;
  logEl.scrollTop = logEl.scrollHeight;
}

function setProgress(percent, text) {
  progressFill.style.width = `${Math.max(0, Math.min(100, percent))}%`;
  progressText.textContent = text;
  progressText.classList.remove('running', 'done');
  if (percent >= 100) {
    progressText.classList.add('done');
  } else if (percent > 0 || exportRunning) {
    progressText.classList.add('running');
  }
}

function formatRemaining(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return null;
  }
  if (seconds < 45) {
    return '即将完成';
  }
  const mins = Math.ceil(seconds / 60);
  if (mins <= 1) {
    return '约 1 分钟';
  }
  if (mins < 60) {
    return `约还需 ${mins} 分钟`;
  }
  const hours = Math.floor(mins / 60);
  const restMins = mins % 60;
  if (restMins === 0) {
    return `约还需 ${hours} 小时`;
  }
  return `约还需 ${hours} 小时 ${restMins} 分钟`;
}

function getConvExportRange(username) {
  return convExportRanges.get(username) || { mode: 'all' };
}

function getEffectiveMessageCount(conv) {
  const range = getConvExportRange(conv.username);
  if (range.mode === 'range' && range.rangeMessageCount != null) {
    return range.rangeMessageCount;
  }
  return conv.messageCount;
}

function getEffectiveVoiceCount(conv) {
  const range = getConvExportRange(conv.username);
  if (range.mode === 'range' && range.rangeVoiceCount != null) {
    return range.rangeVoiceCount;
  }
  return conv.voiceCount || 0;
}

function getSelectionStats() {
  const selected = new Set(getSelectedUsernames());
  const items = conversationItems.filter((item) => selected.has(item.username));
  let rangedConversationCount = 0;
  for (const item of items) {
    if (getConvExportRange(item.username).mode === 'range') {
      rangedConversationCount += 1;
    }
  }
  return {
    conversationCount: items.length,
    messageCount: items.reduce((sum, item) => sum + getEffectiveMessageCount(item), 0),
    voiceCount: items.reduce((sum, item) => sum + getEffectiveVoiceCount(item), 0),
    rangedConversationCount,
  };
}

function buildSelectionLine(stats) {
  if (!stats.conversationCount) {
    return '';
  }
  const voicePart = stats.voiceCount > 0 ? `，${formatCount(stats.voiceCount)} 条语音` : '';
  const rangePart =
    stats.rangedConversationCount > 0
      ? `（${stats.rangedConversationCount} 个会话限定了时间）`
      : '';
  return `已选 ${stats.conversationCount} / ${conversationItems.length} 个会话，约 ${formatCount(stats.messageCount)} 条消息${voicePart}${rangePart}`;
}

function buildConversationOverviewLine() {
  const groupCount = conversationItems.filter((item) => item.type === 'group').length;
  return `${conversationItems.length} 个会话 · ${groupCount} 个群聊`;
}

function formatConvCountLabel(conv, range = null) {
  const exportRange = range || getConvExportRange(conv.username);
  let messagePart;
  if (exportRange.mode === 'range' && exportRange.rangeMessageCount != null) {
    messagePart = `约 ${formatCount(exportRange.rangeMessageCount)} / ${formatCount(conv.messageCount)} 条`;
  } else {
    messagePart = `${formatCount(conv.messageCount)} 条`;
  }
  const voiceTotal = conv.voiceCount || 0;
  if (!voiceTotal) {
    return messagePart;
  }
  if (exportRange.mode === 'range' && exportRange.rangeVoiceCount != null) {
    return `${messagePart} · ${formatCount(exportRange.rangeVoiceCount)} / ${formatCount(voiceTotal)} 语音`;
  }
  return `${messagePart} · ${formatCount(voiceTotal)} 语音`;
}

function formatScanStatsSummary(result) {
  const voiceTotal =
    result.totalVoiceMessages ??
    (result.conversations || []).reduce((sum, item) => sum + (item.voiceCount || 0), 0);
  const voicePart = voiceTotal > 0 ? `，${formatCount(voiceTotal)} 条语音` : '';
  return `${result.conversationCount} 个会话，${formatCount(result.totalMessages)} 条消息${voicePart}`;
}

function formatEstimateSnippet(estimate, { withVoiceTag = false } = {}) {
  if (!estimate?.rangeText) {
    return '';
  }
  const level = estimate.perfLevel ? `（本机 Lv.${estimate.perfLevel}）` : '';
  const voiceTag = withVoiceTag ? ' · 含语音转写' : '';
  return `预计导出耗时 ${estimate.rangeText}${level}${voiceTag}`;
}

function pulseSummaryLine() {
  if (currentStep !== 4 || !exportEstimateLine) {
    return;
  }
  exportEstimateLine.classList.add('summary-highlight');
  window.setTimeout(() => exportEstimateLine.classList.remove('summary-highlight'), 700);
}

function renderVoiceTimeHint({ voiceOn, voiceEstimate, stats }) {
  if (!voiceTimeHint) {
    return;
  }
  voiceTimeHint.textContent = '';
  if (!whisperModelBundled || currentStep !== 4 || voiceOn || !stats.voiceCount || !voiceEstimate?.rangeText) {
    return;
  }
  voiceTimeHint.textContent = `→ ${voiceEstimate.rangeText}`;
}

function applySelectionSummary({ baseEstimate, voiceEstimate, voiceOn, stats }) {
  const selectionLine = buildSelectionLine(stats);
  const step4Estimate = voiceOn && voiceEstimate ? voiceEstimate : baseEstimate;
  const estimateSnippet = formatEstimateSnippet(step4Estimate, {
    withVoiceTag: voiceOn && stats.voiceCount > 0,
  });

  if (convSummary && currentStep === 3) {
    convSummary.textContent = buildConversationOverviewLine();
  }
  if (exportSummary && currentStep === 4) {
    exportSummary.textContent = selectionLine || '确认保存位置与格式，然后开始导出。';
  }
  if (exportEstimateLine && currentStep === 4) {
    exportEstimateLine.textContent = estimateSnippet;
    exportEstimateLine.classList.toggle('hidden', !estimateSnippet);
  }
  renderVoiceTimeHint({ voiceOn, voiceEstimate, stats });
}

async function refreshSelectionSummary({ voiceTranscription = null, highlight = false } = {}) {
  const stats = getSelectionStats();
  const requestId = ++estimateRequestId;

  if (!stats.conversationCount || !stats.messageCount) {
    if (convSummary) convSummary.textContent = '—';
    if (exportSummary) exportSummary.textContent = '确认保存位置与格式，然后开始导出。';
    if (exportEstimateLine) {
      exportEstimateLine.textContent = '';
      exportEstimateLine.classList.add('hidden');
    }
    if (voiceTimeHint) voiceTimeHint.textContent = '';
    return null;
  }

  if (currentStep === 3) {
    if (convSummary) convSummary.textContent = buildSelectionLine(stats);
    if (exportEstimateLine) {
      exportEstimateLine.textContent = '';
      exportEstimateLine.classList.add('hidden');
    }
    if (voiceTimeHint) voiceTimeHint.textContent = '';
    return null;
  }

  const formatCount = Math.max(1, getSelectedFormats().length);
  const voiceOn =
    voiceTranscription === null ? isVoiceTranscriptionEnabled() : Boolean(voiceTranscription);
  const showVoiceOn = currentStep === 4 && voiceOn;

  try {
    const estimateParams = { ...stats, formatCount };
    const [baseEstimate, voiceEstimate] = await Promise.all([
      window.exporter.estimateExport({ ...estimateParams, voiceTranscription: false }),
      whisperModelBundled && stats.voiceCount > 0
        ? window.exporter.estimateExport({ ...estimateParams, voiceTranscription: true })
        : Promise.resolve(null),
    ]);

    if (requestId !== estimateRequestId) {
      return null;
    }

    applySelectionSummary({
      baseEstimate,
      voiceEstimate,
      voiceOn: showVoiceOn,
      stats,
    });

    if (highlight) {
      pulseSummaryLine();
    }

    return showVoiceOn && voiceEstimate ? voiceEstimate : baseEstimate;
  } catch {
    const fallback = buildSelectionLine(stats);
    if (convSummary && currentStep === 3) convSummary.textContent = fallback || '—';
    if (exportSummary && currentStep === 4) {
      exportSummary.textContent = fallback || '确认保存位置与格式，然后开始导出。';
    }
    if (exportEstimateLine) {
      exportEstimateLine.textContent = '';
      exportEstimateLine.classList.add('hidden');
    }
    if (voiceTimeHint) voiceTimeHint.textContent = '';
    return null;
  }
}

function resetExportTaskProgress() {
  exportTaskTotal = 0;
  exportTaskExported = 0;
  exportTaskVoiceEnabled = false;
  exportTaskVoiceTotal = 0;
  exportTaskVoiceDone = 0;
  exportTaskMessageTotal = 0;
  exportTaskMessageDone = 0;
  exportTaskMessagePartial = 0;
  exportPrepRatio = 0;
  exportDisplayPercent = 0;
  exportEtaSmoothSec = null;
  exportEtaDisplayed = null;
  exportEtaLastUpdate = 0;
  exportLastEtaPercent = 0;
}

function initExportTaskProgress(options, stats) {
  exportTaskTotal = Math.max(1, options.selectedConversations?.length || options.selectedUsernames?.length || 0);
  exportTaskExported = 0;
  exportTaskVoiceEnabled = Boolean(options.voiceTranscription);
  exportTaskVoiceTotal = exportTaskVoiceEnabled ? Math.max(0, stats.voiceCount || 0) : 0;
  exportTaskVoiceDone = 0;
  exportTaskMessageTotal = Math.max(1, stats.messageCount || 0);
  exportTaskMessageDone = 0;
  exportTaskMessagePartial = 0;
  exportPrepRatio = 0;
  exportDisplayPercent = 0;
  exportEtaSmoothSec = null;
  exportEtaDisplayed = null;
  exportEtaLastUpdate = 0;
  exportLastEtaPercent = 0;
}

function updateExportTaskFromEvent(event) {
  const phase = event?.phase || '';

  if (phase === 'init') {
    exportPrepRatio = Math.max(exportPrepRatio, 0.03);
    return;
  }
  if (phase === 'keys') {
    exportPrepRatio = Math.max(exportPrepRatio, 0.06);
    return;
  }
  if (phase === 'decrypt') {
    if (event.current && event.total) {
      exportPrepRatio = event.current / event.total;
    } else {
      exportPrepRatio = Math.max(exportPrepRatio, 0.08);
    }
    return;
  }
  if (phase === 'voice-transcription' || phase === 'exporting' || phase === 'done') {
    exportPrepRatio = 1;
  }
  if (phase === 'exporting') {
    exportTaskTotal = event.totalCandidates || exportTaskTotal;
    if (event.subphase === 'reading' && event.chatMessagesTotal) {
      exportTaskMessagePartial = event.chatMessagesDone || 0;
    } else if (event.subphase === 'start') {
      exportTaskMessagePartial = 0;
    } else if (!event.subphase || event.subphase === 'writing') {
      exportTaskExported = event.current || exportTaskExported;
      exportTaskMessageDone = event.totalMessages ?? exportTaskMessageDone;
      exportTaskMessagePartial = 0;
    }
    return;
  }
  if (phase === 'voice-transcription') {
    if (event.subphase === 'transcribing' && event.total) {
      exportTaskVoiceDone = event.current || 0;
      exportTaskVoiceTotal = Math.max(exportTaskVoiceTotal, event.total);
    } else if (event.subphase === 'done') {
      exportTaskVoiceDone = exportTaskVoiceTotal;
    }
    return;
  }
  if (phase === 'done') {
    exportTaskExported = event.conversationCount || exportTaskExported;
  }
}

function getMessageWorkRatio() {
  if (exportTaskMessageTotal <= 0) {
    return exportTaskTotal > 0 ? exportTaskExported / exportTaskTotal : 0;
  }
  const done = exportTaskMessageDone + exportTaskMessagePartial;
  return Math.min(1, done / exportTaskMessageTotal);
}

function computeExportWorkRatio() {
  const messageRatio = getMessageWorkRatio();
  const convRatio = exportTaskTotal > 0 ? exportTaskExported / exportTaskTotal : 0;
  if (exportTaskVoiceEnabled && exportTaskVoiceTotal > 0) {
    const voiceRatio = exportTaskVoiceDone / exportTaskVoiceTotal;
    return messageRatio * 0.08 + voiceRatio * 0.88 + convRatio * 0.04;
  }
  return messageRatio;
}

function computeRawExportPercent() {
  const workRatio = computeExportWorkRatio();
  const prepPart =
    workRatio > 0 || exportPrepRatio >= 1
      ? EXPORT_PREP_MAX
      : exportPrepRatio * EXPORT_PREP_MAX;
  const workPart = workRatio * EXPORT_WORK_SPAN;
  return Math.min(98, prepPart + workPart);
}

function bumpExportDisplayPercent(rawPercent) {
  exportDisplayPercent = Math.max(exportDisplayPercent, rawPercent);
  return exportDisplayPercent;
}

function buildExportProgressText(event) {
  const phase = event?.phase || '';
  const pct = Math.round(exportDisplayPercent);

  if (phase === 'init' || phase === 'keys') {
    return `总进度 ${pct}% · ${event.message || '准备中…'}`;
  }
  if (phase === 'decrypt') {
    if (event.current && event.total) {
      return `总进度 ${pct}% · 解密数据（${event.current}/${event.total}）`;
    }
    return `总进度 ${pct}% · ${event.message || '正在解密…'}`;
  }
  if (phase === 'voice-transcription') {
    if (event.subphase === 'model-load') {
      return `总进度 ${pct}% · 正在加载语音识别模型…`;
    }
    if (event.subphase === 'transcribing' && event.total) {
      const detail =
        exportTaskTotal > 0
          ? `会话 ${exportTaskExported}/${exportTaskTotal} · 语音 ${event.current}/${event.total}`
          : `语音 ${event.current}/${event.total}`;
      return `总进度 ${pct}% · ${detail}`;
    }
    return `总进度 ${pct}% · ${event.message || '语音转写…'}`;
  }
  if (phase === 'exporting') {
    if (event.subphase === 'reading' && event.chatMessagesTotal) {
      return `总进度 ${pct}% · 正在读取 ${event.displayName}（${formatCount(event.chatMessagesDone)}/${formatCount(event.chatMessagesTotal)} 条）`;
    }
    if (event.subphase === 'start') {
      return `总进度 ${pct}% · 正在处理 ${event.displayName}（${event.scanned}/${event.totalCandidates}）`;
    }
    return `总进度 ${pct}% · 已处理 ${formatCount(exportTaskMessageDone)} 条 · ${event.displayName || ''}`;
  }
  if (phase === 'done') {
    return `总进度 100% · 完成 ${event.conversationCount} 个会话，${formatCount(event.totalMessages)} 条消息`;
  }
  return `总进度 ${pct}%`;
}

function computeExportTotalProgress(event) {
  updateExportTaskFromEvent(event);
  const phase = event?.phase || '';

  if (phase === 'done') {
    exportDisplayPercent = 100;
    return {
      percent: 100,
      text: buildExportProgressText(event),
    };
  }

  const percent = bumpExportDisplayPercent(computeRawExportPercent());
  return {
    percent,
    text: buildExportProgressText(event),
  };
}

function getDynamicEtaSuffix() {
  if (!exportRunning || !exportStartedAt) {
    return null;
  }

  const elapsedSec = (Date.now() - exportStartedAt) / 1000;
  if (elapsedSec < EXPORT_ETA_MIN_ELAPSED_SEC || exportDisplayPercent < 5) {
    return null;
  }

  const ratio = exportDisplayPercent / 100;
  if (ratio < 0.05 || ratio >= 0.99) {
    return null;
  }

  if (exportDisplayPercent <= exportLastEtaPercent) {
    return exportEtaDisplayed;
  }

  const rawRemaining = (elapsedSec / ratio) * (1 - ratio);
  if (!Number.isFinite(rawRemaining) || rawRemaining <= 0) {
    return exportEtaDisplayed;
  }

  exportLastEtaPercent = exportDisplayPercent;

  if (exportEtaSmoothSec === null) {
    exportEtaSmoothSec = rawRemaining;
  } else {
    const blended = exportEtaSmoothSec * 0.75 + rawRemaining * 0.25;
    exportEtaSmoothSec = Math.max(exportEtaSmoothSec * 0.92, blended);
  }

  const now = Date.now();
  if (exportEtaDisplayed && now - exportEtaLastUpdate < EXPORT_ETA_UPDATE_MS) {
    return exportEtaDisplayed;
  }

  exportEtaLastUpdate = now;
  exportEtaDisplayed = formatRemaining(exportEtaSmoothSec);
  return exportEtaDisplayed;
}

function setProgressWithEta(percent, text) {
  const eta = getDynamicEtaSuffix();
  setProgress(percent, eta ? `${text} · ${eta}` : text);
}

function getSelectedAccountPath() {
  return selectedAccountPath;
}

function updateAccountCardSelection() {
  for (const card of accountList.querySelectorAll('.account-card')) {
    card.classList.toggle('selected', card.dataset.path === selectedAccountPath);
  }
}

function formatRelativeActivityTime(ms) {
  if (!ms) {
    return '暂无数据活动记录';
  }
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) {
    return '暂无数据活动记录';
  }

  const diffSec = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (diffSec < 60) {
    return '刚刚有数据活动';
  }
  if (diffSec < 3600) {
    return `${Math.floor(diffSec / 60)} 分钟前有数据活动`;
  }
  if (diffSec < 86400) {
    return `${Math.floor(diffSec / 3600)} 小时前有数据活动`;
  }
  if (diffSec < 86400 * 30) {
    return `${Math.floor(diffSec / 86400)} 天前有数据活动`;
  }

  const label = date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  });
  return `${label} 有数据活动`;
}

function updateMultiAccountTip(accounts) {
  if (!multiAccountTip) return;
  const show = accounts.length > 1;
  multiAccountTip.classList.toggle('hidden', !show);
}

function getAccountStatusClass(account) {
  if (account.mode === 'decrypted') return 'decrypted';
  if (account.mode === 'encrypted') return 'encrypted';
  return '';
}

function renderAccountOptions(accounts, selectedPath = null) {
  scannedAccounts = applyProfileCache(accounts);
  accountList.innerHTML = '';

  if (!accounts.length) {
    accountField.classList.add('hidden');
    selectedAccountPath = null;
    accountHint.textContent = '';
    updateAccountDatasetField();
    updateMultiAccountTip([]);
    return;
  }

  accountField.classList.remove('hidden');

  for (const account of scannedAccounts) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'account-card';
    card.dataset.path = account.path;

    if (account.avatar) {
      const img = document.createElement('img');
      img.className = 'account-avatar';
      img.src = account.avatar;
      img.alt = '';
      card.appendChild(img);
    } else {
      const placeholder = document.createElement('div');
      placeholder.className = 'account-avatar placeholder';
      placeholder.textContent = (account.displayName || account.wxid || '?').slice(0, 1).toUpperCase();
      card.appendChild(placeholder);
    }

    const info = document.createElement('div');
    info.className = 'account-info';

    const header = document.createElement('div');
    header.className = 'account-header';

    const nameEl = document.createElement('div');
    nameEl.className = 'account-name';
    nameEl.textContent = account.displayName || account.wxid;
    nameEl.title = nameEl.textContent;

    const statusEl = document.createElement('span');
    statusEl.className = `account-status ${getAccountStatusClass(account)}`;
    statusEl.textContent = account.description || '未知状态';

    header.appendChild(nameEl);
    header.appendChild(statusEl);

    const meta = document.createElement('div');
    meta.className = 'account-meta';

    if (isRealDisplayName(account.displayName, account.wxid)) {
      const wxidEl = document.createElement('div');
      wxidEl.className = 'account-wxid';
      wxidEl.textContent = account.wxid;
      wxidEl.title = account.wxid;
      meta.appendChild(wxidEl);
    }

    const activityEl = document.createElement('div');
    activityEl.className = 'account-activity';
    activityEl.textContent = formatRelativeActivityTime(account.lastActivityAt);
    activityEl.title = account.lastActivityAtIso || activityEl.textContent;
    meta.appendChild(activityEl);

    info.appendChild(header);
    info.appendChild(meta);
    card.appendChild(info);

    card.addEventListener('click', () => void selectAccount(account.path));
    accountList.appendChild(card);
  }

  const defaultPath =
    selectedPath || (scannedAccounts.length === 1 ? scannedAccounts[0].path : selectedAccountPath);
  if (defaultPath) {
    selectedAccountPath = defaultPath;
  } else if (!scannedAccounts.some((item) => item.path === selectedAccountPath)) {
    selectedAccountPath = null;
  }

  updateAccountCardSelection();
  updateAccountDatasetField();
  updateMultiAccountTip(scannedAccounts);
  accountHint.textContent =
    scannedAccounts.length > 1 && !selectedAccountPath ? '请选择要查看的账号' : '';
}

async function loadAccountProfiles(accounts) {
  if (!accounts.length) return;

  const token = ++profileLoadToken;
  const pathsKey = accounts.map((a) => a.path).join('|');

  for (const card of accountList.querySelectorAll('.account-card')) {
    card.classList.add('loading');
  }

  let result;
  try {
    result = await window.exporter.enrichAccounts({ accounts });
  } finally {
    if (token === profileLoadToken) {
      for (const card of accountList.querySelectorAll('.account-card')) {
        card.classList.remove('loading');
      }
    }
  }

  if (token !== profileLoadToken) return;
  if (pathsKey !== accounts.map((a) => a.path).join('|')) return;

  if (result.ok && result.accounts?.length) {
    cacheAccountProfiles(result.accounts);
    renderAccountOptions(result.accounts, selectedAccountPath);
    updateAccountProfileHint(result.accounts);
    for (const account of result.accounts) {
      if (isRealDisplayName(account.displayName, account.wxid)) {
        window.exporter.patchConversationCacheLabel({
          accountPath: account.path,
          displayName: account.displayName,
          datasetDir: getViewerDatasetDirForAccountPath(account.path),
        }).catch(() => {});
      }
    }
    void refreshConversationCacheHint();
  }
}

function updateAccountProfileHint(accounts) {
  if (accounts.length > 1 && !selectedAccountPath) {
    accountHint.textContent = '请选择要查看的账号';
    accountHint.className = 'hint';
  } else {
    accountHint.textContent = '';
    accountHint.className = 'hint';
  }
}

async function selectAccount(accountPath) {
  selectedAccountPath = accountPath;
  resolvedAccountPath = accountPath;
  updateAccountCardSelection();
  updateAccountDatasetField(accountPath);
  saveSettings();
  accountHint.textContent = '';
  accountHint.className = 'hint';
  renderReadiness(null);
  void refreshConversationCacheHint();
  const accountKey = getViewerAccountKey(accountPath);
  const datasetDir = await ensureViewerDatasetDirForAccount(accountKey, { prompt: true });
  if (selectedAccountPath !== accountPath) return;
  if (!datasetDir) {
    accountHint.textContent = '请先为此账号选择数据集存放位置，再进入群聊记录。';
    accountHint.className = 'hint error';
    return;
  }
  await openSelectedAccountRecords(accountPath);
}

function renderReadiness(readiness) {
  if (!readiness || readiness.level === 'ready') {
    readinessPanel.classList.add('hidden');
    return;
  }

  readinessPanel.classList.remove('hidden');
  const levelMap = {
    ready: { text: '不信已登录', className: 'ready' },
    fallback: { text: '未登录此账号', className: 'fallback' },
    offline: { text: '可离线扫描', className: 'fallback' },
    maybe: { text: '建议预热', className: 'maybe' },
    not_ready: { text: '不信未运行', className: 'not-ready' },
  };
  const badge = levelMap[readiness.level] || levelMap.not_ready;
  readinessBadge.textContent = badge.text;
  readinessBadge.className = `readiness-badge ${badge.className}`;
  readinessHint.textContent = readiness.hint || '';

  readinessSuggestions.innerHTML = '';
  for (const tip of readiness.suggestions || []) {
    const li = document.createElement('li');
    li.textContent = tip;
    readinessSuggestions.appendChild(li);
  }
  readinessSuggestions.style.display = readinessSuggestions.children.length ? '' : 'none';
}

async function validateWxDir(dir, accountPath = null) {
  if (!dir) {
    wxDirHint.textContent = '通常位于 Documents 或 D:\\WeChat\\xwechat_files';
    wxDirHint.className = 'hint';
    renderAccountOptions([]);
    renderReadiness(null);
    resolvedAccountPath = null;
    void refreshConversationCacheHint();
    return null;
  }

  const result = await window.exporter.validateWxDir({
    wxDir: dir,
    accountPath: accountPath || undefined,
  });

  if (!result.ok) {
    wxDirHint.textContent = result.error;
    wxDirHint.className = 'hint error';
    renderAccountOptions([]);
    renderReadiness(null);
    resolvedAccountPath = null;
    void refreshConversationCacheHint();
    return null;
  }

  renderAccountOptions(result.accounts || [], result.resolved || accountPath || selectedAccountPath);
  void loadAccountProfiles(result.accounts || []);

  if (result.needsAccountSelection) {
    wxDirHint.textContent = '';
    wxDirHint.className = 'hint';
    renderReadiness(null);
    resolvedAccountPath = null;
    void refreshConversationCacheHint();
    return result;
  }

  resolvedAccountPath = result.resolved;
  selectedAccountPath = result.resolved;
  updateAccountCardSelection();
  wxDirHint.textContent = '';
  wxDirHint.className = 'hint';
  renderReadiness(null);
  void refreshConversationCacheHint();
  return result;
}

async function refreshWxAccountList({ silent = false } = {}) {
  const rootDir = wxDirInput.value.trim();
  if (!rootDir) {
    if (!silent) {
      wxDirHint.textContent = '请先选择不信数据目录';
      wxDirHint.className = 'hint error';
    }
    return;
  }
  if (scanRunning) {
    return;
  }

  const accountPath = getSelectedAccountPath();

  if (!silent) {
    refreshAccountsBtn.disabled = true;
    refreshAccountsBtn.textContent = '刷新中…';
  }

  try {
    await validateWxDir(rootDir, accountPath);
  } finally {
    if (!silent) {
      refreshAccountsBtn.disabled = scanRunning;
      refreshAccountsBtn.textContent = '刷新';
    }
  }
}

function resetOutputDirNonEmptyAck() {
  outputDirNonEmptyAcknowledged = null;
}

const OUTPUT_DIR_NON_EMPTY_NOTICE = {
  title: '文件夹不为空',
  message: '所选导出目录已有文件，导出时可能会覆盖同名文件。',
  detail: '建议选择空文件夹，以免意外覆盖已有内容。',
};

async function confirmOutputDirIfNotEmpty(dirPath) {
  if (!dirPath) return true;
  if (outputDirNonEmptyAcknowledged === dirPath) return true;

  const check = await window.exporter.isDirectoryEmpty(dirPath);
  if (!check.ok || check.empty) return true;

  const proceed = await showConfirmDialog({
    ...OUTPUT_DIR_NON_EMPTY_NOTICE,
    tone: 'warn',
    confirmLabel: '继续导出',
    cancelLabel: '取消',
    preferCancel: true,
  });
  if (proceed) {
    outputDirNonEmptyAcknowledged = dirPath;
  }
  return proceed;
}

async function pickDirectory(title, targetInput) {
  const selected = await window.exporter.pickDirectory({
    title,
    defaultPath: targetInput.value || undefined,
  });
  if (selected) {
    targetInput.value = selected;
    saveSettings();
    if (targetInput === wxDirInput) {
      void validateWxDir(selected);
    } else if (targetInput === outputDirInput) {
      resetOutputDirNonEmptyAck();
    }
  }
}

function formatCount(n) {
  return n.toLocaleString('zh-CN');
}

function unixToDateInputValue(unixSec) {
  if (!unixSec) return '';
  const date = new Date(unixSec * 1000);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function dateInputToUnixStart(dateStr) {
  if (!dateStr) return null;
  const date = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return Math.floor(date.getTime() / 1000);
}

function dateInputToUnixEnd(dateStr) {
  if (!dateStr) return null;
  const date = new Date(`${dateStr}T23:59:59`);
  if (Number.isNaN(date.getTime())) return null;
  return Math.floor(date.getTime() / 1000);
}

function formatDateRangeLabel(startTime, endTime) {
  const fmt = (unixSec) =>
    new Date(unixSec * 1000).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    });
  return `${fmt(startTime)} ~ ${fmt(endTime)}`;
}

function normalizeUnixTimestamp(value) {
  const ts = Number(value) || 0;
  if (ts <= 0) return 0;
  // WeChat message create_time is seconds; values above ~2286 CE in seconds are almost certainly ms.
  return ts > 10000000000 ? Math.floor(ts / 1000) : Math.floor(ts);
}

function getConvTimeBounds(conv) {
  const rawFirst = normalizeUnixTimestamp(conv?.firstTimestamp);
  const rawLast = normalizeUnixTimestamp(conv?.lastTimestamp);
  const now = Math.floor(Date.now() / 1000);

  let first = rawFirst;
  let last = rawLast > 0 ? rawLast : rawFirst > 0 ? rawFirst : now;

  if (first <= 0) {
    first = last;
  }
  if (last <= 0) {
    last = first;
  }

  return {
    first: Math.min(first, last),
    last: Math.max(first, last),
  };
}

function convHasReliableTimeBounds(conv) {
  if (!conv) return false;
  const bounds = getConvTimeBounds(conv);
  if (!bounds.first || !bounds.last || bounds.last < bounds.first) return false;
  if (!unixToDateInputValue(bounds.first) || !unixToDateInputValue(bounds.last)) return false;
  if (bounds.last - bounds.first < SECONDS_PER_DAY && (conv.messageCount || 0) > 1) {
    return false;
  }
  return normalizeUnixTimestamp(conv.firstTimestamp) > 0 && normalizeUnixTimestamp(conv.lastTimestamp) > 0;
}

function isUsableBatchTimeBounds(bounds, usernames) {
  if (!bounds?.first || !bounds?.last || bounds.last < bounds.first) return false;
  if (!unixToDateInputValue(bounds.first) || !unixToDateInputValue(bounds.last)) return false;
  if (bounds.last - bounds.first >= SECONDS_PER_DAY) return true;
  const totalMessages = usernames.reduce((sum, username) => {
    const conv = conversationItems.find((item) => item.username === username);
    return sum + (conv?.messageCount || 0);
  }, 0);
  return totalMessages <= 1;
}

function getBatchTimeBounds(usernames) {
  let first = 0;
  let last = 0;
  for (const username of usernames) {
    const conv = conversationItems.find((item) => item.username === username);
    if (!conv) continue;
    const bounds = getConvTimeBounds(conv);
    if (!bounds.last) continue;
    if (!first || bounds.first < first) first = bounds.first;
    if (bounds.last > last) last = bounds.last;
  }
  if (!last) {
    last = Math.floor(Date.now() / 1000);
  }
  if (!first) {
    first = last;
  }
  return { first, last };
}

async function fetchConvTimeBounds(username, { force = false } = {}) {
  const conv = conversationItems.find((item) => item.username === username);
  if (!force && convHasReliableTimeBounds(conv)) {
    return getConvTimeBounds(conv);
  }

  const accountPath = resolvedAccountPath || getSelectedAccountPath();
  if (!accountPath || !conv) {
    return conv ? getConvTimeBounds(conv) : { first: 0, last: Math.floor(Date.now() / 1000) };
  }

  const result = await window.exporter.getConversationTimeBounds({
    wxDir: accountPath,
    username,
    datasetDir: getViewerDatasetDirForAccountPath(accountPath),
  });
  if (result.ok && result.firstTimestamp > 0 && result.lastTimestamp > 0) {
    conv.firstTimestamp = normalizeUnixTimestamp(result.firstTimestamp);
    conv.lastTimestamp = normalizeUnixTimestamp(result.lastTimestamp);
    return getConvTimeBounds(conv);
  }

  return getConvTimeBounds(conv);
}

function getConvUsernamesNeedingTimeBounds(usernames, { batch = false } = {}) {
  const needsFetch = usernames.filter((username) => {
    const item = conversationItems.find((entry) => entry.username === username);
    return !convHasReliableTimeBounds(item);
  });
  if (needsFetch.length) {
    return needsFetch;
  }
  if (batch && !isUsableBatchTimeBounds(getBatchTimeBounds(usernames), usernames)) {
    return [...usernames];
  }
  return [];
}

function syncConvRangeFormAfterBoundsRefresh(conv) {
  const mode = convRangeModal.querySelector('input[name="convRangeMode"]:checked')?.value || 'all';
  if (mode === 'range') {
    if (!convRangeStart?.value || !convRangeEnd?.value) {
      setConvRangeDateValues(convRangeBounds.first, convRangeBounds.last);
    } else {
      setConvRangeDateLimits();
      scheduleConvRangeCountHint();
    }
    return;
  }
  if (conv) {
    setConvRangeFormValues(getConvExportRange(conv.username), conv);
  } else {
    setConvRangeFormValues({ mode: 'all' }, null);
  }
}

function setConvRangeDialogLoading(loading) {
  if (!convRangeModal) return;
  convRangeConfirmBtn.disabled = loading;
  for (const btn of convRangeModal.querySelectorAll('.conv-range-preset')) {
    btn.disabled = loading;
  }
  if (convRangeStart) convRangeStart.disabled = loading;
  if (convRangeEnd) convRangeEnd.disabled = loading;
  if (loading && convRangeCountHint) {
    convRangeCountHint.textContent = '正在读取会话时间范围…';
  }
}

function buildConvMetaText(conv) {
  const range = getConvExportRange(conv.username);
  if (range.mode === 'range' && range.startTime && range.endTime) {
    let text = formatDateRangeLabel(range.startTime, range.endTime);
    if (range.rangeMessageCount != null) {
      text += ` · 约 ${formatCount(range.rangeMessageCount)} 条`;
    }
    return text;
  }
  return conv.summary || conv.username;
}

function captureConvSelectionState() {
  const state = new Map();
  for (const checkbox of convList.querySelectorAll('input[type="checkbox"][data-username]')) {
    state.set(checkbox.dataset.username, checkbox.checked);
  }
  return state;
}

function updateConvTypeFilterUI() {
  if (!convTypeFilterEl) return;
  for (const btn of convTypeFilterEl.querySelectorAll('.conv-type-btn')) {
    btn.classList.toggle('active', btn.dataset.type === convTypeFilter);
  }
}

function isConvVisible(conv, searchQ, typeFilter) {
  const nameMatch = !searchQ || conv.displayName.toLowerCase().includes(searchQ);
  const typeMatch = typeFilter === 'all' || conv.type === typeFilter;
  return nameMatch && typeMatch;
}

function applyConvFilters() {
  const searchQ = convSearch.value.trim().toLowerCase();
  for (const item of convList.querySelectorAll('.conv-item[data-username]')) {
    const conv = conversationItems.find((entry) => entry.username === item.dataset.username);
    const visible = conv ? isConvVisible(conv, searchQ, convTypeFilter) : false;
    item.classList.toggle('hidden-by-filter', !visible);
  }
}

function refreshConvItem(username) {
  const item = convList.querySelector(`.conv-item[data-username="${CSS.escape(username)}"]`);
  const conv = conversationItems.find((entry) => entry.username === username);
  if (!item || !conv) return;
  const meta = item.querySelector('.conv-meta');
  const count = item.querySelector('.conv-count');
  if (meta) meta.textContent = buildConvMetaText(conv);
  if (count) count.textContent = formatConvCountLabel(conv);
}

function renderConversationList(conversations, { resetFilters = true } = {}) {
  const prevSelection = captureConvSelectionState();
  const sorted = [...conversations]
    .map((conv) => ({
      ...conv,
      firstTimestamp: normalizeUnixTimestamp(conv.firstTimestamp),
      lastTimestamp: normalizeUnixTimestamp(conv.lastTimestamp),
    }))
    .sort((a, b) => b.messageCount - a.messageCount);
  conversationItems = sorted;
  convList.innerHTML = '';

  if (resetFilters) {
    convExportRanges.clear();
    convTypeFilter = 'all';
    convSearch.value = '';
    updateConvTypeFilterUI();
  }

  if (!sorted.length) {
    convList.innerHTML = '<div class="conv-item"><div class="conv-name">未找到可查看的会话</div></div>';
    updateConvSummary();
    return;
  }

  for (const conv of sorted) {
    const item = document.createElement('div');
    item.className = 'conv-item';
    item.dataset.username = conv.username;
    item.dataset.name = conv.displayName.toLowerCase();
    item.dataset.type = conv.type;

    const checkLabel = document.createElement('label');
    checkLabel.className = 'conv-check';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = prevSelection.has(conv.username) ? prevSelection.get(conv.username) : true;
    checkbox.dataset.username = conv.username;
    checkbox.addEventListener('change', updateConvSummary);
    checkLabel.appendChild(checkbox);

    const main = document.createElement('div');
    const name = document.createElement('div');
    name.className = 'conv-name';
    name.textContent = conv.displayName;

    const tag = document.createElement('span');
    tag.className = `type-tag ${conv.type === 'group' ? 'group' : ''}`;
    tag.textContent = conv.type === 'group' ? '群聊' : '私聊';
    name.appendChild(tag);

    const meta = document.createElement('div');
    meta.className = 'conv-meta';
    meta.textContent = buildConvMetaText(conv);

    main.appendChild(name);
    main.appendChild(meta);

    const actions = document.createElement('div');
    actions.className = 'conv-actions';

    const count = document.createElement('div');
    count.className = 'conv-count';
    count.textContent = formatConvCountLabel(conv);

    const settingsBtn = document.createElement('button');
    settingsBtn.type = 'button';
    settingsBtn.className = 'conv-settings-btn';
    settingsBtn.textContent = '设置';
    settingsBtn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      void openConvRangeDialog({ mode: 'single', usernames: [conv.username], conv });
    });

    actions.appendChild(count);
    actions.appendChild(settingsBtn);

    item.appendChild(checkLabel);
    item.appendChild(main);
    item.appendChild(actions);
    convList.appendChild(item);
  }

  applyConvFilters();
  updateConvSummary();
}

function getVisibleConvCheckboxes() {
  return [...convList.querySelectorAll('.conv-item:not(.hidden-by-filter) input[type="checkbox"]')];
}

function getSelectedUsernames() {
  return [...convList.querySelectorAll('input[type="checkbox"]:checked')].map((el) => el.dataset.username);
}

function getSelectedConversations() {
  const selected = new Set(getSelectedUsernames());
  return conversationItems
    .filter((item) => selected.has(item.username))
    .map((item) => {
      const range = getConvExportRange(item.username);
      if (range.mode === 'range' && range.startTime != null && range.endTime != null) {
        return {
          username: item.username,
          timeRange: {
            mode: 'range',
            startTime: range.startTime,
            endTime: range.endTime,
          },
        };
      }
      return {
        username: item.username,
        timeRange: { mode: 'all' },
      };
    });
}

function updateConvSummary() {
  const stats = getSelectionStats();
  const summaryText = buildSelectionLine(stats);
  convSummary.textContent = buildConversationOverviewLine();
  if (exportSummary) {
    exportSummary.textContent = summaryText || '确认保存位置与格式，然后开始导出。';
  }
  void refreshSelectionSummary();
  toExportBtn.disabled = stats.conversationCount === 0;
  startBtn.disabled = exportRunning;
  updateStepNavUI();
}

function setConvSelection(checked) {
  for (const checkbox of getVisibleConvCheckboxes()) {
    checkbox.checked = checked;
  }
  updateConvSummary();
}

function filterConversations() {
  applyConvFilters();
}

function clampUnixToBounds(unixSec) {
  const boundFirst = convRangeBounds.first || convRangeBounds.last || unixSec;
  const boundLast = convRangeBounds.last || convRangeBounds.first || unixSec;
  const first = Math.min(boundFirst, boundLast);
  const last = Math.max(boundFirst, boundLast);
  return Math.min(Math.max(unixSec, first), last);
}

function setConvRangeDateLimits() {
  const boundFirst = convRangeBounds.first || convRangeBounds.last;
  const boundLast = convRangeBounds.last || convRangeBounds.first;
  const minDate = unixToDateInputValue(Math.min(boundFirst, boundLast));
  const maxDate = unixToDateInputValue(Math.max(boundFirst, boundLast));
  if (!minDate || !maxDate) {
    return;
  }

  convRangeStart.min = minDate;
  convRangeEnd.max = maxDate;
  convRangeStart.max = convRangeEnd.value || maxDate;
  convRangeEnd.min = convRangeStart.value || minDate;
}

function setConvRangeDateValues(startUnix, endUnix) {
  if (!convRangeStart || !convRangeEnd) return;

  const start = clampUnixToBounds(Math.min(startUnix, endUnix));
  const end = clampUnixToBounds(Math.max(startUnix, endUnix));
  const startValue = unixToDateInputValue(start);
  const endValue = unixToDateInputValue(end);
  if (!startValue || !endValue) return;

  convRangeStart.removeAttribute('min');
  convRangeStart.removeAttribute('max');
  convRangeEnd.removeAttribute('min');
  convRangeEnd.removeAttribute('max');
  convRangeStart.value = startValue;
  convRangeEnd.value = endValue;
  convRangeStart.dispatchEvent(new Event('change', { bubbles: true }));
  convRangeEnd.dispatchEvent(new Event('change', { bubbles: true }));
  setConvRangeDateLimits();
  scheduleConvRangeCountHint();
}

function selectConvRangeMode(mode) {
  for (const input of convRangeModal.querySelectorAll('input[name="convRangeMode"]')) {
    input.checked = input.value === mode;
  }
  updateConvRangePickerVisibility();
}

function setConvRangeFormValues(range, conv) {
  const mode = range?.mode === 'range' ? 'range' : 'all';
  for (const input of convRangeModal.querySelectorAll('input[name="convRangeMode"]')) {
    input.checked = input.value === mode;
  }
  updateConvRangePickerVisibility();

  if (conv) {
    convRangeAllCount.textContent = `共 ${formatCount(conv.messageCount)} 条`;
    convRangeAllCount.classList.remove('hidden');
  } else {
    convRangeAllCount.textContent = '';
    convRangeAllCount.classList.add('hidden');
  }

  if (mode === 'range' && range.startTime && range.endTime) {
    setConvRangeDateValues(range.startTime, range.endTime);
  } else {
    setConvRangeDateValues(convRangeBounds.first, convRangeBounds.last);
  }
}

function updateConvRangePickerVisibility() {
  const mode = convRangeModal.querySelector('input[name="convRangeMode"]:checked')?.value || 'all';
  convRangePicker.classList.toggle('hidden', mode !== 'range');
  if (mode === 'range') {
    if (
      convRangeBounds?.first &&
      convRangeBounds?.last &&
      (!convRangeStart?.value || !convRangeEnd?.value)
    ) {
      setConvRangeDateValues(convRangeBounds.first, convRangeBounds.last);
    }
    void updateConvRangeCountHint();
  } else {
    convRangeCountHint.textContent = '';
  }
}

async function updateConvRangeCountHint() {
  const mode = convRangeModal.querySelector('input[name="convRangeMode"]:checked')?.value || 'all';
  if (mode !== 'range') {
    convRangeCountHint.textContent = '';
    return;
  }

  const startTime = dateInputToUnixStart(convRangeStart.value);
  const endTime = dateInputToUnixEnd(convRangeEnd.value);
  if (!startTime || !endTime || startTime > endTime) {
    convRangeCountHint.textContent = '请选择有效的起止日期';
    return;
  }

  const { mode: dialogMode, usernames } = convRangeDialogContext || {};
  const accountPath = resolvedAccountPath || getSelectedAccountPath();
  if (!accountPath) {
    convRangeCountHint.textContent = '';
    return;
  }

  if (dialogMode === 'batch') {
    convRangeCountHint.textContent = `将统计 ${usernames.length} 个会话在该时间段内的消息`;
    return;
  }

  const username = usernames?.[0];
  if (!username) {
    convRangeCountHint.textContent = '';
    return;
  }

  convRangeCountHint.textContent = '正在统计…';
  const result = await window.exporter.countConversationRange({
    wxDir: accountPath,
    username,
    datasetDir: getViewerDatasetDirForAccountPath(accountPath),
    startTime,
    endTime,
  });
  if (!result.ok) {
    convRangeCountHint.textContent = result.error || '统计失败';
    return;
  }
  convRangeCountHint.textContent = `该时间段约 ${formatCount(result.messageCount)} 条消息`;
}

function scheduleConvRangeCountHint() {
  if (convRangeCountTimer) {
    window.clearTimeout(convRangeCountTimer);
  }
  convRangeCountTimer = window.setTimeout(() => {
    convRangeCountTimer = null;
    void updateConvRangeCountHint();
  }, 300);
}

function hideConvRangeModal() {
  convRangeModal.classList.add('hidden');
  convRangeDialogContext = null;
  convRangeConfirmBtn.disabled = false;
  convRangeCountHint.textContent = '';
}

async function openConvRangeDialog({ mode, usernames, conv = null }) {
  if (!usernames.length) {
    await showFriendlyError('未选择会话', '请先勾选要设置时间的会话。');
    return;
  }

  convRangeDialogContext = { mode, usernames, conv };

  if (mode === 'single' && conv) {
    convRangeModalTitle.textContent = `设置「${conv.displayName}」的导出时间`;
  } else {
    convRangeModalTitle.textContent = '批量设置时间范围';
  }
  convRangeModalSubtitle.textContent = '';

  convRangeModal.classList.remove('hidden');

  if (mode === 'single' && conv) {
    convRangeBounds = getConvTimeBounds(conv);
    setConvRangeFormValues(getConvExportRange(conv.username), conv);
  } else {
    convRangeBounds = getBatchTimeBounds(usernames);
    setConvRangeFormValues({ mode: 'range' }, null);
  }

  const isBatch = mode === 'batch';
  const needsFetch = getConvUsernamesNeedingTimeBounds(usernames, { batch: isBatch });
  const boundsReady =
    mode === 'single' && conv
      ? convHasReliableTimeBounds(conv)
      : isUsableBatchTimeBounds(convRangeBounds, usernames);

  if (!needsFetch.length && boundsReady) {
    void updateConvRangeCountHint();
    return;
  }

  if (!needsFetch.length && !boundsReady) {
    convRangeCountHint.textContent = '无法读取会话时间范围，请重新扫描后再试。';
    return;
  }

  setConvRangeDialogLoading(true);
  try {
    await Promise.all(needsFetch.map((username) => fetchConvTimeBounds(username)));
    convRangeBounds =
      mode === 'single' && conv ? getConvTimeBounds(conv) : getBatchTimeBounds(usernames);
    syncConvRangeFormAfterBoundsRefresh(mode === 'single' ? conv : null);
  } catch (err) {
    convRangeCountHint.textContent = err.message || '读取时间范围失败';
  } finally {
    setConvRangeDialogLoading(false);
    void updateConvRangeCountHint();
  }
}

function applyConvRangePreset(preset) {
  const last = convRangeBounds?.last;
  if (!last) {
    convRangeCountHint.textContent = '正在读取会话时间范围，请稍候…';
    return;
  }

  const first = convRangeBounds.first || last;
  if (last < first) {
    convRangeCountHint.textContent = '正在读取会话时间范围，请稍候…';
    return;
  }

  const now = Math.floor(Date.now() / 1000);

  if (preset === 'reset') {
    setConvRangeDateValues(first, last);
    selectConvRangeMode('range');
    return;
  }

  if (preset === 'this-year') {
    const year = new Date().getFullYear();
    const yearStart = dateInputToUnixStart(`${year}-01-01`) || first;
    const yearEnd = dateInputToUnixEnd(`${year}-12-31`) || last;
    setConvRangeDateValues(yearStart, Math.min(yearEnd, now, last));
    selectConvRangeMode('range');
    return;
  }

  if (preset === 'year' || preset === 'three-years') {
    const seconds = preset === 'three-years' ? 3 * SECONDS_PER_YEAR : SECONDS_PER_YEAR;
    const end = Math.min(now, last);
    const start = Math.max(first, end - seconds);
    setConvRangeDateValues(start, end);
    selectConvRangeMode('range');
  }
}

async function confirmConvRangeDialog() {
  const context = convRangeDialogContext;
  if (!context?.usernames?.length) {
    hideConvRangeModal();
    return;
  }

  const rangeMode = convRangeModal.querySelector('input[name="convRangeMode"]:checked')?.value || 'all';
  if (rangeMode === 'all') {
    for (const username of context.usernames) {
      convExportRanges.delete(username);
      refreshConvItem(username);
    }
    hideConvRangeModal();
    updateConvSummary();
    return;
  }

  const startTime = dateInputToUnixStart(convRangeStart.value);
  const endTime = dateInputToUnixEnd(convRangeEnd.value);
  if (!startTime || !endTime || startTime > endTime) {
    await showFriendlyError('时间范围无效', '请选择有效的起止日期。');
    return;
  }

  const accountPath = resolvedAccountPath || getSelectedAccountPath();
  if (!accountPath) {
    await showFriendlyError('未选择账号', '请先选择要导出的不信账号。');
    return;
  }

  convRangeConfirmBtn.disabled = true;
  convRangeCountHint.textContent = '正在统计并应用…';

  for (let i = 0; i < context.usernames.length; i += 1) {
    const username = context.usernames[i];
    if (context.mode === 'batch' && context.usernames.length > 1) {
      convRangeCountHint.textContent = `正在处理 ${i + 1} / ${context.usernames.length} 个会话…`;
    }
    const result = await window.exporter.countConversationRange({
      wxDir: accountPath,
      username,
      datasetDir: getViewerDatasetDirForAccountPath(accountPath),
      startTime,
      endTime,
    });
    if (!result.ok) {
      convRangeConfirmBtn.disabled = false;
      await showFriendlyError('统计失败', result.error || '无法统计该时间段的消息数量');
      return;
    }
    convExportRanges.set(username, {
      mode: 'range',
      startTime,
      endTime,
      rangeMessageCount: result.messageCount,
      rangeVoiceCount: result.voiceCount,
    });
    refreshConvItem(username);
  }

  hideConvRangeModal();
  updateConvSummary();
}

function inferNoticeTone(title, message) {
  const text = `${title} ${message || ''}`;
  if (/失败|错误|无法删除|无法扫描|导出失败|扫描失败|检测失败|删除失败/.test(text)) {
    return 'error';
  }
  if (/请先|请选择|未选择|未找到|还差|暂时|建议|确认/.test(text)) {
    return 'guide';
  }
  return 'warn';
}

const NOTICE_ICON = {
  guide: 'i',
  warn: '!',
  error: '!',
};

function finishAppNotice(result) {
  appNotice.classList.add('hidden');
  appNoticeCancelBtn.classList.add('hidden');
  appNoticeCancelBtn.classList.remove('primary');
  appNoticeCancelBtn.classList.add('secondary');
  appNoticeActions.classList.remove('confirm-mode');
  appNoticeBtn.classList.remove('danger', 'secondary');
  appNoticeBtn.classList.add('primary');
  appNoticeBtn.textContent = '知道了';
  noticeMode = 'alert';
  if (noticeResolve) {
    noticeResolve(result);
    noticeResolve = null;
  }
}

const appNoticeActions = appNotice.querySelector('.app-notice-actions');

function dismissAppNotice() {
  finishAppNotice(noticeMode === 'confirm' ? false : undefined);
}

function confirmAppNotice() {
  finishAppNotice(noticeMode === 'confirm' ? true : undefined);
}

function showAppNotice({
  title,
  message,
  detail,
  tone = 'guide',
  confirm = false,
  confirmLabel = '确定',
  cancelLabel = '取消',
  dangerConfirm = false,
  preferCancel = false,
}) {
  return new Promise((resolve) => {
    noticeResolve = resolve;
    noticeMode = confirm ? 'confirm' : 'alert';
    appNoticeTitle.textContent = title || '提示';
    appNoticeMessage.textContent = message || '';
    if (detail) {
      appNoticeDetail.textContent = detail;
      appNoticeDetail.classList.remove('hidden');
    } else {
      appNoticeDetail.textContent = '';
      appNoticeDetail.classList.add('hidden');
    }
    appNoticeIcon.textContent = NOTICE_ICON[tone] || NOTICE_ICON.guide;
    appNoticeIcon.className = `app-notice-icon ${tone}`;

    if (confirm) {
      appNoticeCancelBtn.textContent = cancelLabel;
      appNoticeCancelBtn.classList.remove('hidden');
      appNoticeActions.classList.add('confirm-mode');
      appNoticeBtn.textContent = confirmLabel;
      if (preferCancel) {
        appNoticeCancelBtn.classList.remove('secondary');
        appNoticeCancelBtn.classList.add('primary');
        appNoticeBtn.classList.remove('primary', 'danger');
        appNoticeBtn.classList.add('secondary');
      } else {
        appNoticeCancelBtn.classList.remove('primary');
        appNoticeCancelBtn.classList.add('secondary');
        appNoticeBtn.classList.remove('secondary');
        appNoticeBtn.classList.toggle('primary', !dangerConfirm);
        appNoticeBtn.classList.toggle('danger', dangerConfirm);
      }
    }

    appNotice.classList.remove('hidden');
    const focusTarget = confirm ? (preferCancel ? appNoticeCancelBtn : appNoticeBtn) : appNoticeBtn;
    focusTarget.focus();
  });
}

async function showConfirmDialog({
  title,
  message,
  detail,
  tone = 'warn',
  confirmLabel = '确定',
  cancelLabel = '取消',
  dangerConfirm = false,
  preferCancel = false,
}) {
  return showAppNotice({
    title,
    message,
    detail,
    tone,
    confirm: true,
    confirmLabel,
    cancelLabel,
    dangerConfirm,
    preferCancel,
  });
}

async function showFriendlyError(title, message, detail, tone) {
  const resolvedTone = tone || inferNoticeTone(title, message);
  await showAppNotice({
    title,
    message,
    detail,
    tone: resolvedTone,
  });
}

function buildScanFailureDetail(result) {
  const parts = [];
  if (result.feedbackSummary) {
    parts.push(result.feedbackSummary);
  } else if (result.logFileName) {
    parts.push(`日志文件：${result.logFileName}`);
  }
  return parts.join('\n\n') || null;
}

async function showScanFailure(result) {
  const errorInfo = result.errorInfo || {
    code: 'WTR-E099',
    title: '扫描失败',
    userMessage: result.error || '扫描失败',
  };
  const action = await showAppNotice({
    title: `${errorInfo.title}（${errorInfo.code}）`,
    message: errorInfo.userMessage,
    detail: buildScanFailureDetail(result),
    tone: 'error',
    confirm: true,
    confirmLabel: '知道了',
    cancelLabel: '打开日志文件夹',
  });

  if (action === false) {
    await window.exporter.openLogDir();
  }
}

let preflightModalResolve = null;
let preflightModalSession = 0;

function renderPreflightModalList(checks) {
  preflightModalList.innerHTML = '';
  const markMap = { pass: '✓', warn: '!', fail: '✕' };
  for (const check of checks || []) {
    const li = document.createElement('li');
    li.className = `preflight-item ${check.level}`;
    const mark = document.createElement('span');
    mark.className = 'preflight-mark';
    mark.textContent = markMap[check.level] || '•';
    const body = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = check.label;
    body.appendChild(title);
    if (check.detail && check.level !== 'pass') {
      const detail = document.createElement('span');
      detail.textContent = check.detail;
      body.appendChild(detail);
    }
    li.appendChild(mark);
    li.appendChild(body);
    preflightModalList.appendChild(li);
  }
}

function closePreflightModal() {
  preflightModal.classList.add('hidden');
  preflightModalLoading.classList.add('hidden');
  preflightModalList.classList.add('hidden');
  preflightModalResolve = null;
}

function setPreflightModalButtons({ showStart = true, startEnabled = true } = {}) {
  preflightModalPrimaryBtn.textContent = '开始扫描';
  preflightModalCancelBtn.textContent = '取消';
  preflightModalPrimaryBtn.classList.toggle('hidden', !showStart);
  preflightModalPrimaryBtn.disabled = !startEnabled;
  preflightModalCancelBtn.classList.remove('hidden');
}

function openPreflightModalLoading() {
  const session = ++preflightModalSession;
  preflightModalTitle.textContent = '环境检查';
  preflightModalLoading.classList.remove('hidden');
  preflightModalList.classList.add('hidden');
  setPreflightModalButtons({ showStart: false });
  preflightModal.classList.remove('hidden');
  preflightModalCancelBtn.classList.remove('hidden');
  return session;
}

function showPreflightModalChecks(preflight) {
  preflightModalLoading.classList.add('hidden');
  preflightModalList.classList.remove('hidden');
  renderPreflightModalList(preflight.checks);
  setPreflightModalButtons({
    showStart: Boolean(preflight.ok),
    startEnabled: Boolean(preflight.ok),
  });
}

function showPreflightModalError(message) {
  preflightModalLoading.classList.add('hidden');
  preflightModalList.classList.remove('hidden');
  preflightModalList.innerHTML = '';
  const li = document.createElement('li');
  li.className = 'preflight-item fail';
  const mark = document.createElement('span');
  mark.className = 'preflight-mark';
  mark.textContent = '✕';
  const body = document.createElement('div');
  const title = document.createElement('strong');
  title.textContent = '检查失败';
  const detail = document.createElement('span');
  detail.textContent = message;
  body.appendChild(title);
  body.appendChild(detail);
  li.appendChild(mark);
  li.appendChild(body);
  preflightModalList.appendChild(li);
  setPreflightModalButtons({ showStart: false });
}

function waitForPreflightModal(session) {
  return new Promise((resolve) => {
    if (session !== preflightModalSession) {
      resolve(false);
      return;
    }
    preflightModalResolve = resolve;
  });
}

function finishPreflightModal(proceed) {
  const resolve = preflightModalResolve;
  preflightModalSession += 1;
  closePreflightModal();
  resolve?.(proceed);
}

function onPreflightModalPrimary() {
  finishPreflightModal(true);
}

function onPreflightModalCancel() {
  finishPreflightModal(false);
}

function onPreflightModalBackdrop(event) {
  if (event.target?.matches?.('[data-preflight-dismiss]')) {
    onPreflightModalCancel();
  }
}

preflightModalPrimaryBtn.addEventListener('click', onPreflightModalPrimary);
preflightModalCancelBtn.addEventListener('click', onPreflightModalCancel);
preflightModal.addEventListener('click', onPreflightModalBackdrop);

async function runDecryptPreflightGate(rootDir, accountPath) {
  const session = openPreflightModalLoading();

  let readiness = null;
  try {
    const status = await window.exporter.checkWeChatStatus({
      wxDir: rootDir,
      accountPath,
    });
    readiness = status.ok ? status.readiness : null;
  } catch {
    readiness = null;
  }

  if (session !== preflightModalSession) {
    return false;
  }

  const result = await window.exporter.runPreflight({
    wxDir: rootDir,
    accountPath,
    readiness,
  });

  if (session !== preflightModalSession) {
    return false;
  }

  if (!result.checks?.length) {
    showPreflightModalError(result.error || '无法完成环境检查');
  } else {
    showPreflightModalChecks(result);
  }

  const proceed = await waitForPreflightModal(session);
  return proceed && result.ok;
}

function getExportOptions(extra = {}) {
  const accountPath = resolvedAccountPath || getSelectedAccountPath();
  const account = scannedAccounts.find((item) => item.path === accountPath);
  const cachedProfile = accountPath ? accountProfileCache.get(accountPath) : null;
  const rawName = cachedProfile?.displayName || account?.displayName || null;
  const wxid = account?.wxid || null;
  const datasetDir = accountPath ? getViewerDatasetDirForAccountPath(accountPath) : '';
  return {
    wxDir: wxDirInput.value.trim(),
    accountPath,
    accountWxid: wxid,
    datasetDir,
    displayName: isRealDisplayName(rawName, wxid) ? rawName : null,
    outputDir: outputDirInput.value.trim(),
    selfWxid: null,
    forceDecrypt: false,
    loginCapture: true,
    keysPath: null,
    formats: getSelectedFormats(),
    selectedConversations: getSelectedConversations(),
    selectedUsernames: getSelectedUsernames(),
    voiceTranscription: isVoiceTranscriptionEnabled(),
    ...extra,
  };
}

function formatElapsed(ms) {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return min > 0 ? `${min} 分 ${sec.toString().padStart(2, '0')} 秒` : `${sec} 秒`;
}

function formatCacheTime(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function sanitizeScanMessage(msg) {
  return msg
    .replace(/db_storage[^\s]*/g, '数据')
    .replace(/\.wexin_passphrase/g, '密钥')
    .replace(/Weixin\.dll/g, '不信组件')
    .replace(/Weixin\.exe/g, '不信');
}

function friendlyScanMessage(event) {
  const msg = event?.message || '';
  const phase = event?.phase || '';

  if (phase === 'scan' && event.subphase === 'counting' && event.total) {
    const current = event.current || 0;
    if (event.countingScope === 'message_dbs') {
      if (msg.includes('增量更新')) {
        return msg;
      }
      return `正在统计消息库 ${current} / ${event.total}`;
    }
    if (event.countingScope === 'sessions' && current >= event.total) {
      return event.message || `已统计 ${formatCount(current)} 个会话候选`;
    }
    return `已统计 ${formatCount(current)} / ${formatCount(event.total)} 个会话`;
  }

  if (phase === 'decrypt' && event.current && event.total) {
    return `正在解密数据（${event.current}/${event.total}）…`;
  }

  if (phase === 'keys' && msg) {
    if (msg.includes('Hook 已就绪') || msg.includes('请点击「登录」') || msg.includes('点击「登录」')) {
      return 'Hook 已就绪，请在不信窗口点击「登录」（通常无需扫码）';
    }
    if (msg.includes('正在准备 Hook 环境') || msg.includes('Hook 环境准备完成')) {
      return sanitizeScanMessage(msg);
    }
    if (msg.includes('请先不要点击') || msg.includes('不要点击登录') || msg.includes('等待提示后再点击')) {
      return '正在安装 Hook，请先不要点击「登录」…';
    }
    if (msg.includes('等待密钥') || msg.includes('仍在捕获') || msg.includes('等待捕获密钥')) {
      return sanitizeScanMessage(msg);
    }
    if (msg.includes('正在安装 Hook') || msg.includes('Hook 尚未就绪') || msg.includes('等待不信组件')) {
      return '正在安装 Hook，请先不要点击「登录」…';
    }
    if (msg.includes('已启动不信') || msg.includes('等待不信启动') || msg.includes('未检测到 Weixin')) {
      return sanitizeScanMessage(msg);
    }
    if (msg.includes('已结束进程') || msg.includes('重新启动') || msg.includes('关闭不信')) {
      return '正在重启不信以捕获密钥…';
    }
    if (msg.includes('提取') || msg.includes('密钥') || msg.includes('Hook') || msg.includes('捕获')) {
      return sanitizeScanMessage(msg);
    }
  }

  if (msg.includes('正在从不信进程内存提取数据库密钥')) {
    return '正在准备获取解密密钥…';
  }
  if (msg.includes('解密数据库文件') || msg.startsWith('解密中')) {
    return '正在解密聊天记录…';
  }
  if (msg.includes('解密完成')) {
    return '解密完成，正在整理会话…';
  }
  if (msg.includes('跳过解密')) {
    return '正在读取已有数据…';
  }
  if (msg.includes('会话列表') || msg.includes('统计会话')) {
    return '正在整理会话列表…';
  }
  if (msg.includes('未找到已解密') || msg.includes('首次扫描需要解密')) {
    return '首次扫描需要解密，可能需要几分钟…';
  }
  return sanitizeScanMessage(msg) || '处理中…';
}

function friendlyScanTitle(event) {
  const phase = event?.phase || '';
  const msg = event?.message || '';
  if (phase === 'scan' && event.subphase === 'counting') return '正在统计会话';
  if (phase === 'keys') return '正在获取密钥';
  if (phase === 'decrypt') {
    if (msg.includes('解密中') || msg.includes('解密数据库')) return '正在解密';
    if (msg.includes('提取') || msg.includes('密钥')) return '正在获取密钥';
    return '正在解密';
  }
  return '正在扫描';
}

function friendlyScanNote(event) {
  const msg = event?.message || '';
  const phase = event?.phase || '';

  if (phase === 'keys') {
    if (msg.includes('Hook 已就绪') || msg.includes('等待密钥') || msg.includes('仍在捕获') || msg.includes('点击「登录」')) {
      return '请在弹出的不信窗口点击「登录」。若长时间无响应，请确认 Hook 已就绪后再试。';
    }
    if (msg.includes('正在准备 Hook 环境') || msg.includes('Hook 环境准备完成')) {
      return '正在加载解密模块并定位不信路径，此阶段不会关闭不信。准备完成后才会重启不信。';
    }
    if (
      msg.includes('请先不要点击') ||
      msg.includes('不要点击登录') ||
      msg.includes('正在安装 Hook') ||
      msg.includes('Hook 尚未就绪') ||
      msg.includes('后台启动')
    ) {
      return '不信已重启，正在安装 Hook。看到「Hook 已就绪」后再点击「登录」，否则无法捕获密钥。';
    }
    return '工具会暂时关闭并重启不信，Hook 就绪后再点击「登录」。整个过程通常 1～3 分钟。';
  }

  if (phase === 'decrypt' && (msg.includes('提取') || msg.includes('密钥'))) {
    return '首次扫描需要获取解密密钥。若弹出不信，请点击「登录」。';
  }

  if (phase === 'scan' && event.subphase === 'counting') {
    return '正在逐个统计消息数量，数据量较大时可能需要较长时间，请耐心等待。';
  }

  if (phase === 'scan' && msg.includes('有更新')) {
    return '正在重新解密不信数据库以同步最新聊天记录，请保持不信处于登录状态。';
  }

  return '首次扫描可能需要几分钟。若弹出不信，请点击「登录」';
}

function startScanElapsedTimer() {
  stopScanElapsedTimer();
  scanStartedAt = Date.now();
  scanToastElapsed.textContent = '已等待 0 秒';
  scanElapsedTimer = setInterval(() => {
    scanToastElapsed.textContent = `已等待 ${formatElapsed(Date.now() - scanStartedAt)}`;
  }, 1000);
}

function stopScanElapsedTimer() {
  if (scanElapsedTimer) {
    clearInterval(scanElapsedTimer);
    scanElapsedTimer = null;
  }
  scanToastElapsed.textContent = '';
}

function getParentDir(filePath) {
  const normalized = filePath.replace(/[/\\]+$/, '');
  const idx = Math.max(normalized.lastIndexOf('\\'), normalized.lastIndexOf('/'));
  return idx >= 0 ? normalized.slice(0, idx) : normalized;
}

function getWxidFromPath(accountPath, selfWxid = null) {
  if (selfWxid) return selfWxid;
  const folderName = accountPath.split(/[/\\]/).pop() || accountPath;
  const match = folderName.match(/^(.+?)_c[a-f0-9]+$/i);
  return match ? match[1] : folderName;
}

function getAccountLabel(accountPath, hints = null) {
  let selfWxid = null;
  let displayName = null;

  if (typeof hints === 'string') {
    selfWxid = hints;
  } else if (hints && typeof hints === 'object') {
    selfWxid = hints.selfWxid || null;
    displayName = hints.displayName || null;
  }

  const wxid = getWxidFromPath(accountPath, selfWxid);

  if (isRealDisplayName(displayName, wxid)) {
    return displayName;
  }

  const profile = accountProfileCache.get(accountPath);
  if (isRealDisplayName(profile?.displayName, wxid)) {
    return profile.displayName;
  }

  const account = scannedAccounts.find((item) => item.path === accountPath);
  if (isRealDisplayName(account?.displayName, wxid)) {
    return account.displayName;
  }

  const folderName = accountPath.split(/[/\\]/).pop() || accountPath;
  const match = folderName.match(/^(.+?)_c[a-f0-9]+$/i);
  const fromFolder = match ? match[1] : folderName;
  if (fromFolder && !/^wxid_/i.test(fromFolder)) {
    return fromFolder;
  }

  return wxid;
}

async function enrichCacheAccountProfiles(caches) {
  const missing = [];

  for (const cache of caches) {
    const wxid = getWxidFromPath(cache.accountPath, cache.selfWxid);
    if (isRealDisplayName(cache.displayName, wxid)) {
      continue;
    }
    const profile = accountProfileCache.get(cache.accountPath);
    if (isRealDisplayName(profile?.displayName, wxid)) {
      cache.displayName = profile.displayName;
      window.exporter.patchConversationCacheLabel({
        accountPath: cache.accountPath,
        displayName: profile.displayName,
        datasetDir: getViewerDatasetDirForAccountPath(cache.accountPath),
      }).catch(() => {});
      continue;
    }
    missing.push({ path: cache.accountPath, wxid });
  }

  if (!missing.length) {
    return;
  }

  try {
    const result = await window.exporter.enrichAccounts({ accounts: missing });
    if (!result.ok || !result.accounts?.length) {
      return;
    }

    cacheAccountProfiles(result.accounts);
    for (const account of result.accounts) {
      const cache = caches.find((item) => item.accountPath === account.path);
      if (!cache || !isRealDisplayName(account.displayName, account.wxid)) {
        continue;
      }
      cache.displayName = account.displayName;
      window.exporter.patchConversationCacheLabel({
        accountPath: account.path,
        displayName: account.displayName,
        datasetDir: getViewerDatasetDirForAccountPath(account.path),
      }).catch(() => {});
    }
  } catch {
    // ignore profile enrichment failures
  }
}

async function refreshConversationCacheHint() {
  const selectedPath = getSelectedAccountPath();
  const result = await window.exporter.listConversationCaches({
    datasetDirs: getConfiguredViewerDatasetDirs(),
  });
  const allCaches = result.ok && result.caches?.length ? result.caches : [];
  conversationCacheEntries = allCaches;

  if (!selectedPath || !allCaches.length) {
    currentConversationCache = null;
    cacheSection.classList.add('hidden');
    cacheList.innerHTML = '';
    scanBtn.textContent = '扫描会话';
    return;
  }

  const accountCaches = allCaches.filter((item) => item.accountPath === selectedPath);
  if (!accountCaches.length) {
    currentConversationCache = null;
    cacheSection.classList.add('hidden');
    cacheList.innerHTML = '';
    scanBtn.textContent = '扫描会话';
    return;
  }

  currentConversationCache = accountCaches[0] || null;

  await enrichCacheAccountProfiles(accountCaches);
  renderConversationCacheList(accountCaches);
  cacheSection.classList.remove('hidden');
  scanBtn.textContent = '重新扫描';
}

async function openSelectedAccountRecords(accountPath) {
  if (!accountPath || selectedAccountPath !== accountPath) return false;
  await refreshConversationCacheHint();
  if (selectedAccountPath !== accountPath) return false;
  if (currentConversationCache?.accountPath === accountPath) {
    return useCachedConversations(accountPath, currentConversationCache.id);
  }
  await scanConversations();
  return viewerIsOpen;
}

function renderConversationCacheList(caches) {
  cacheList.innerHTML = '';

  for (const cache of caches) {
    const item = document.createElement('div');
    item.className = 'cache-item';

    const label = getAccountLabel(cache.accountPath, cache);
    const profile = accountProfileCache.get(cache.accountPath);
    const scannedAt = formatCacheTime(cache.scannedAt);

    if (profile?.avatar) {
      const img = document.createElement('img');
      img.className = 'account-avatar cache-item-avatar';
      img.src = profile.avatar;
      img.alt = '';
      item.appendChild(img);
    } else {
      const placeholder = document.createElement('div');
      placeholder.className = 'account-avatar placeholder cache-item-avatar';
      placeholder.textContent = label.slice(0, 1).toUpperCase();
      item.appendChild(placeholder);
    }

    const info = document.createElement('div');
    info.className = 'cache-item-info';

    const title = document.createElement('div');
    title.className = 'cache-item-title';
    title.textContent = scannedAt || label;

    const meta = document.createElement('div');
    meta.className = 'cache-item-meta';
    meta.textContent = formatScanStatsSummary(cache);

    info.appendChild(title);
    info.appendChild(meta);
    item.appendChild(info);

    const actions = document.createElement('div');
    actions.className = 'cache-item-actions';

    const useBtn = document.createElement('button');
    useBtn.className = 'btn secondary';
    useBtn.type = 'button';
    useBtn.textContent = '使用';
    useBtn.addEventListener('click', () => useCachedConversations(cache.accountPath, cache.id));

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn ghost danger-text';
    deleteBtn.type = 'button';
    deleteBtn.textContent = '删除';
    deleteBtn.addEventListener('click', () => deleteConversationCache(cache.accountPath, cache.id));

    actions.appendChild(useBtn);
    actions.appendChild(deleteBtn);
    item.appendChild(actions);
    cacheList.appendChild(item);
  }
}

async function handleResetAccountDecryptData() {
  if (scanRunning || exportRunning) {
    await showFriendlyError('请稍候', '请等待当前任务结束。');
    return;
  }

  const accountPath = getSelectedAccountPath();
  if (!accountPath) {
    await showFriendlyError('请选择账号', '请先选择不信账号。');
    return;
  }

  const label = getAccountLabel(accountPath, {});
  const confirmed = await showConfirmDialog({
    title: '重置解密数据',
    message: `清除「${label}」的密钥与解密缓存？此操作用于故障排查，完成后需重新解密。`,
    tone: 'warn',
    confirmLabel: '重置',
    dangerConfirm: true,
  });
  if (!confirmed) {
    return;
  }

  const result = await window.exporter.resetAccountDecryptData({
    accountPath,
    datasetDir: getViewerDatasetDirForAccountPath(accountPath),
  });
  if (!result.ok) {
    await showFriendlyError('重置失败', result.error || '操作失败');
    return;
  }

  if (getSelectedAccountPath() === accountPath) {
    currentConversationCache = null;
  }

  const rootDir = wxDirInput.value.trim();
  if (rootDir) {
    await validateWxDir(rootDir, accountPath);
  }
  void refreshConversationCacheHint();

  await showAppNotice({
    title: '已重置',
    message: '解密缓存已清除。请重新点击「扫描会话」完成解密。',
    tone: 'guide',
  });
}

async function handleResetAllToolTraces() {
  if (scanRunning || exportRunning) {
    await showFriendlyError('请稍候', '请等待当前任务结束。');
    return;
  }

  const selectedAccountPath = getSelectedAccountPath();

  const confirmed = await showConfirmDialog({
    title: '清除全部工具痕迹',
    message:
      '将清除所有曾扫描账号目录中的密钥、解密库与语音转写缓存，并清除 App 设置、扫描记录与诊断日志。不会删除已导出的聊天记录。此操作不可恢复。',
    tone: 'warn',
    confirmLabel: '清除',
    dangerConfirm: true,
  });
  if (!confirmed) {
    return;
  }

  const additionalAccountPaths = [...new Set([
    ...scannedAccounts.map((account) => account.path),
    selectedAccountPath,
  ].filter(Boolean))];
  const result = await window.exporter.resetAllToolTraces({
    additionalAccountPaths,
    datasetDirs: getConfiguredViewerDatasetDirs(),
  });
  if (!result.ok) {
    await showFriendlyError('清除失败', result.error || '操作失败');
    return;
  }

  applyLocalAppReset({ persistSettingsFile: false });

  const action = await showAppNotice({
    title: '已清除',
    message:
      '若需彻底卸载，请先关闭应用，再手动删除 App 数据目录中的所有文件。',
    tone: 'guide',
    confirm: true,
    confirmLabel: '知道了',
    cancelLabel: '打开 App 数据目录',
  });

  if (action === false) {
    await window.exporter.openUserDataDir();
  }
}

function applyLocalAppReset({ persistSettingsFile = true } = {}) {
  wxDirInput.value = '';
  outputDirInput.value = '';
  selectedAccountPath = null;
  resolvedAccountPath = null;
  currentConversationCache = null;
  conversationCacheEntries = [];
  accountProfileCache.clear();
  accountField.classList.add('hidden');
  cacheSection.classList.add('hidden');
  cacheList.innerHTML = '';
  accountList.innerHTML = '';
  accountHint.textContent = '';
  readinessPanel.classList.add('hidden');

  for (const input of document.querySelectorAll('input[name="format"]')) {
    input.checked = input.value === 'json';
  }
  if (voiceTranscriptionInput) {
    voiceTranscriptionInput.checked = false;
  }

  const minimalSettings = { disclaimerAccepted: disclaimerAccepted.checked };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(minimalSettings));
  if (persistSettingsFile) {
    window.exporter.saveSettings(minimalSettings).catch(() => {});
  }
}

async function deleteConversationCache(accountPath, scanId) {
  let cache =
    conversationCacheEntries.find((item) => item.accountPath === accountPath && item.id === scanId) ||
    conversationCacheEntries.find((item) => item.accountPath === accountPath);
  const wxid = getWxidFromPath(accountPath, cache?.selfWxid);
  if (
    cache &&
    !isRealDisplayName(cache.displayName, wxid) &&
    !isRealDisplayName(accountProfileCache.get(accountPath)?.displayName, wxid)
  ) {
    await enrichCacheAccountProfiles([cache]);
    cache =
      conversationCacheEntries.find((item) => item.accountPath === accountPath && item.id === scanId) ||
      cache;
  }
  const label = getAccountLabel(accountPath, cache || {});
  const scannedAt = formatCacheTime(cache?.scannedAt);
  const confirmed = await showConfirmDialog({
    title: '确认删除',
    message: scannedAt
      ? `确定删除「${label}」在 ${scannedAt} 的扫描记录吗？`
      : `确定删除「${label}」的这条扫描记录吗？`,
    tone: 'warn',
    confirmLabel: '删除',
    dangerConfirm: true,
  });
  if (!confirmed) {
    return;
  }

  const result = await window.exporter.clearConversationCache({
    accountPath,
    scanId,
    datasetDir: getViewerDatasetDirForAccountPath(accountPath),
  });
  if (!result.ok) {
    await showFriendlyError('删除失败', result.error || '无法删除扫描缓存');
    return;
  }

  if (currentConversationCache?.id === scanId) {
    currentConversationCache = null;
  }
  void refreshConversationCacheHint();
}

function applyConversationScanResult(result, { fromCache = false, unchanged = false, incremental = null } = {}) {
  renderConversationList(result.conversations || []);
  restoreRecordsStartTimeForAccount();
  setStep(3);

  let logMessage;
  if (unchanged) {
    logMessage = `数据未变化，已复用上次的会话列表：${formatScanStatsSummary(result)}`;
  } else if (fromCache) {
    logMessage = `已加载缓存：${formatScanStatsSummary(result)}`;
  } else if (incremental?.reusedDbCount > 0) {
    logMessage = `增量扫描完成（复用 ${incremental.reusedDbCount} 个消息库）：${formatScanStatsSummary(result)}`;
  } else {
    logMessage = `扫描完成：${formatScanStatsSummary(result)}`;
  }

  appendLog(logMessage);
  void refreshSelectionSummary();
}

function renderOutputGuide() {
  const items = [
    '<strong>conversations.json</strong> — 会话索引',
    '<strong>contacts.json</strong> — 联系人昵称',
    '<strong>chats/*.json</strong> — 每个会话的完整数据与图片本地路径',
  ];
  outputGuide.innerHTML = `<strong>文件说明</strong><ul>${items.map((item) => `<li>${item}</li>`).join('')}</ul>`;
}

async function useCachedConversations(accountPath = null, scanId = null) {
  const targetPath = accountPath || getSelectedAccountPath();
  if (!targetPath) {
    await showFriendlyError('请选择账号', '请先选择要导出的不信账号。');
    return false;
  }

  const rootDir = wxDirInput.value.trim();
  if (!rootDir) {
    const parentDir = getParentDir(targetPath);
    wxDirInput.value = parentDir;
    saveSettings();
    await validateWxDir(parentDir, targetPath);
  } else if (targetPath !== getSelectedAccountPath()) {
    await selectAccount(targetPath);
  }

  const cacheResult = await window.exporter.loadConversationCache({
    accountPath: targetPath,
    scanId: scanId || null,
    datasetDir: getViewerDatasetDirForAccountPath(targetPath),
  });
  if (!cacheResult.ok || !cacheResult.cache?.conversations?.length) {
    await showFriendlyError('缓存不可用', '未找到该扫描记录，请重新扫描。');
    void refreshConversationCacheHint();
    return false;
  }

  currentConversationCache = cacheResult.cache;
  applyConversationScanResult(
    {
      conversations: cacheResult.cache.conversations,
      conversationCount: cacheResult.cache.conversationCount,
      totalMessages: cacheResult.cache.totalMessages,
    },
    { fromCache: true }
  );
  await openRecordViewer();
  return true;
}

function showScanToast(title, message, note = null) {
  scanToast.classList.remove('hidden');
  scanToastTitle.textContent = title;
  scanToastMessage.textContent = message;
  scanToastNote.textContent = note || scanToastNote.textContent;
  scanToastNote.classList.remove('hidden');
}

function hideScanToast() {
  scanToast.classList.add('hidden');
  stopScanElapsedTimer();
}

async function scanConversations() {
  const rootDir = wxDirInput.value.trim();

  if (!rootDir) {
    await showFriendlyError('请选择目录', '请选择不信数据目录。');
    return;
  }

  const accountPath = getSelectedAccountPath();
  const validation = await validateWxDir(rootDir, accountPath);
  if (!validation || validation.needsAccountSelection || !accountPath) {
    await showFriendlyError('请选择账号', '请点击头像卡片，选择要查看的不信账号。');
    return;
  }

  const accountKey = getViewerAccountKey(accountPath);
  const datasetDir = await ensureViewerDatasetDirForAccount(accountKey, { prompt: true });
  if (!datasetDir) {
    await showFriendlyError('尚未选择账号数据目录', '请先为当前账号选择数据存放位置，再扫描会话。');
    return;
  }

  resolvedAccountPath = accountPath;
  saveSettings();

  const requirements = await window.exporter.getScanRequirements({
    accountPath,
    datasetDir,
    forceDecrypt: false,
  });
  if (!requirements.ok) {
    await showFriendlyError('无法扫描', requirements.error || '请重新选择账号');
    return;
  }

  let clientPreflightOk = false;
  if (requirements.needsDecrypt) {
    const passed = await runDecryptPreflightGate(rootDir, accountPath);
    if (!passed) {
      return;
    }
    clientPreflightOk = true;
  }

  userCancelledScan = false;
  scanRunning = true;
  updateStepNavUI();
  scanBtn.disabled = true;
  scanBtn.textContent = '扫描中…';
  showScanToast('正在扫描', '正在准备，请稍候…');
  startScanElapsedTimer();

  const result = await window.exporter.scanConversations(
    getExportOptions({ clientPreflightOk, datasetDir })
  );

  scanRunning = false;
  updateStepNavUI();
  scanBtn.disabled = false;
  hideScanToast();
  void refreshConversationCacheHint();

  if (result.cancelled || userCancelledScan) {
    scanBtn.textContent = currentConversationCache ? '重新扫描' : '扫描会话';
    return;
  }

  if (!result.ok) {
    scanBtn.textContent = currentConversationCache ? '重新扫描' : '扫描会话';
    await showScanFailure(result);
    return;
  }

  applyConversationScanResult(result, {
    fromCache: Boolean(result.fromCache),
    unchanged: Boolean(result.unchanged),
    incremental: result.incremental || null,
  });
  await openRecordViewer();
  scanBtn.textContent = '重新扫描';

  if (rootDir && resolvedAccountPath) {
    const status = await window.exporter.validateWxDir({
      wxDir: rootDir,
      accountPath: resolvedAccountPath,
    });
    if (status.ok && status.accounts?.length) {
      await loadAccountProfiles(status.accounts);
    } else {
      void refreshConversationCacheHint();
    }
  }
}

async function startExport() {
  const options = getExportOptions();

  if (!options.outputDir) {
    await showFriendlyError('请选择保存位置', '请选择导出文件的保存目录。');
    return;
  }

  if (!options.selectedConversations.length) {
    await showFriendlyError('未选择会话', '请至少选择一个要导出的会话。');
    return;
  }

  const canProceed = await confirmOutputDirIfNotEmpty(options.outputDir);
  if (!canProceed) {
    return;
  }

  exportRunning = true;
  exportStartedAt = Date.now();
  const exportStats = getSelectionStats();
  resetExportTaskProgress();
  initExportTaskProgress(options, exportStats);
  updateStepNavUI();
  startBtn.disabled = true;
  cancelBtn.classList.remove('hidden');
  openOutputBtn.disabled = true;
  logEl.textContent = '';
  setProgress(0, '总进度 0% · 准备中…');
  appendLog('开始导出…');
  saveSettings();
  const preEstimate = await window.exporter.estimateExport({
    ...exportStats,
    formatCount: Math.max(1, options.formats.length),
    voiceTranscription: options.voiceTranscription,
  }).catch(() => null);
  if (preEstimate?.rangeText) {
    appendLog(`预计耗时 ${preEstimate.rangeText}`);
  }

  const exportStartedAtMs = exportStartedAt;
  const result = await window.exporter.startExport({
    wxDir: resolvedAccountPath,
    outputDir: options.outputDir,
    selfWxid: options.selfWxid,
    forceDecrypt: options.forceDecrypt,
    loginCapture: options.loginCapture,
    keysPath: options.keysPath,
    formats: options.formats,
    selectedConversations: options.selectedConversations,
    voiceTranscription: options.voiceTranscription,
  });

  const exportDurationSec = Math.max(1, (Date.now() - exportStartedAtMs) / 1000);
  exportRunning = false;
  exportStartedAt = 0;
  updateStepNavUI();
  cancelBtn.classList.add('hidden');
  startBtn.disabled = false;

  if (result.ok) {
    void window.exporter.recordExportPerf({
      durationSec: exportDurationSec,
      messageCount: result.result.totalMessages || exportStats.messageCount,
      voiceCount: exportStats.voiceCount,
      voiceTranscription: options.voiceTranscription,
    }).catch(() => {});
    resetOutputDirNonEmptyAck();
    lastOutputDir = result.result.outputDir;
    openOutputBtn.disabled = false;
    setProgress(100, '总进度 100% · 导出完成');
    successSummary.textContent = `共导出 ${result.result.conversationCount} 个会话，${formatCount(result.result.totalMessages)} 条消息${result.result.voiceTranscription ? '（含语音转文字）' : ''}。\n文件已保存到：${result.result.outputDir}`;
    renderOutputGuide();
    setStep(5);
    resetExportTaskProgress();
  } else if (result.cancelled) {
    const partial = exportTaskExported;
    const outputDir = options.outputDir;
    if (partial > 0) {
      setProgress(exportDisplayPercent, `已取消 · 已导出 ${partial}/${exportTaskTotal} 个会话`);
      appendLog(`导出已取消。已完成的 ${partial} 个会话文件仍保留在：${outputDir}`);
      appendLog('未生成完整的 conversations.json，重新导出可补全。');
      const open = await showConfirmDialog({
        title: '导出已取消',
        message: `已成功导出 ${partial} 个会话，文件保留在所选目录。`,
        detail:
          '未生成完整的 conversations.json。如需完整备份，可重新导出（建议选空文件夹，或确认不会覆盖需要的文件）。',
        tone: 'guide',
        confirmLabel: '打开文件夹',
        cancelLabel: '知道了',
        preferCancel: true,
      });
      if (open) {
        window.exporter.openPath(outputDir);
      }
    } else {
      setProgress(0, '已取消');
      appendLog('导出已取消');
    }
    resetExportTaskProgress();
  } else {
    setProgress(0, '导出失败');
    appendLog(`错误: ${result.error}`);
    resetExportTaskProgress();
    await showFriendlyError(
      '导出失败',
      result.error,
      '常见原因：不信未登录、密钥未加载、目录无写入权限。\n建议先打开几个聊天窗口后重试。'
    );
  }
}

async function initApp() {
  const info = await window.exporter.getAppInfo();
  appVersion.textContent = `v${info.version}`;
  whisperModelBundled = Boolean(info.voiceTranscriptionAvailable ?? info.whisperModelBundled);
  updateVoiceTranscriptionUI();

  const settings = await loadSettings();
  applySettingsToForm(settings);

  setStep(settings.disclaimerAccepted ? 2 : 1);
  setProgress(0, '等待开始');

  if (settings.wxDir) {
    void validateWxDir(settings.wxDir, settings.accountPath || null);
    if (settings.wxDir || settings.outputDir) {
      window.exporter.saveSettings(settings).catch(() => {});
    }
  } else {
    void refreshConversationCacheHint();
  }
}

function setViewerSyncStatus(text, state = 'idle') {
  viewerSyncStatus.className = `viewer-sync-status ${state}`;
  viewerSyncStatus.innerHTML = '<i></i>';
  viewerSyncStatus.append(document.createTextNode(text));
}

function clearViewerProgressLog() {
  if (!viewerProgressLog) return;
  viewerProgressLog.replaceChildren();
  viewerProgressLog.classList.add('hidden');
}

function appendViewerProgressLog(message, state = 'idle') {
  const text = String(message || '').trim();
  if (!viewerProgressLog || !text) return;
  const last = viewerProgressLog.lastElementChild;
  if (last?.dataset.message === text) return;
  const row = document.createElement('div');
  row.dataset.message = text;
  if (state === 'warning') row.className = 'warning';
  const time = document.createElement('time');
  time.textContent = new Date().toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  row.append(time, document.createTextNode(text));
  viewerProgressLog.appendChild(row);
  while (viewerProgressLog.childElementCount > 8) viewerProgressLog.firstElementChild.remove();
  viewerProgressLog.classList.remove('hidden');
  viewerProgressLog.scrollTop = viewerProgressLog.scrollHeight;
}

function getViewerAccountPath() {
  return resolvedAccountPath || getSelectedAccountPath();
}

function getViewerAccountKey(accountPath = getViewerAccountPath()) {
  const account = scannedAccounts.find((item) => item.path === accountPath);
  const cachedWxid =
    (currentConversationCache?.accountPath === accountPath ? currentConversationCache.selfWxid : '') ||
    conversationCacheEntries.find((item) => item.accountPath === accountPath)?.selfWxid ||
    '';
  const wxid = cachedWxid || account?.wxid || '';
  if (wxid) return `wxid:${wxid}`;
  return accountPath ? `path:${accountPath.replace(/\\/g, '/').toLowerCase()}` : '';
}

function recordsStartTimeToUnix(value) {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day, 0, 0, 0, 0);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) return null;
  return Math.floor(date.getTime() / 1000);
}

function loadRecordsStartTimeMap() {
  try {
    const value = JSON.parse(localStorage.getItem(RECORDS_START_TIME_KEY) || '{}');
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

function getRecordsStartDateValue() {
  const year = recordsStartYear?.value.trim() || '';
  const month = recordsStartMonth?.value.trim() || '';
  const day = recordsStartDay?.value.trim() || '';
  if (!year && !month && !day) return '';
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

function setRecordsStartDateValue(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(typeof value === 'string' ? value : '');
  recordsStartYear.value = match?.[1] || '';
  recordsStartMonth.value = match?.[2] || '';
  recordsStartDay.value = match?.[3] || '';
  recordsStartDateControl?.classList.remove('invalid');
}

function validateRecordsStartDate() {
  const value = getRecordsStartDateValue();
  const valid = !value || recordsStartTimeToUnix(value) != null;
  recordsStartDateControl?.classList.toggle('invalid', !valid);
  return valid;
}

function focusInvalidRecordsStartDatePart() {
  const year = recordsStartYear.value;
  const month = Number(recordsStartMonth.value);
  const day = Number(recordsStartDay.value);
  const input = !/^\d{4}$/.test(year)
    ? recordsStartYear
    : month < 1 || month > 12 ? recordsStartMonth : recordsStartDay;
  input.focus();
  input.select();
}

function saveRecordsStartTimeForAccount(accountKey = getViewerAccountKey()) {
  if (!accountKey || !recordsStartYear) return;
  if (!validateRecordsStartDate()) return;
  const values = loadRecordsStartTimeMap();
  const value = getRecordsStartDateValue();
  if (value) values[accountKey] = value;
  else delete values[accountKey];
  localStorage.setItem(RECORDS_START_TIME_KEY, JSON.stringify(values));
  if (clearRecordsStartTimeBtn) clearRecordsStartTimeBtn.disabled = !value;
}

function restoreRecordsStartTimeForAccount(accountKey = getViewerAccountKey()) {
  if (!recordsStartYear) return;
  const values = loadRecordsStartTimeMap();
  const storedValue = accountKey ? values[accountKey] || '' : '';
  setRecordsStartDateValue(storedValue);
  if (clearRecordsStartTimeBtn) clearRecordsStartTimeBtn.disabled = !getRecordsStartDateValue();
}
function loadViewerDatasetDirectoryMap() {
  try {
    const value = JSON.parse(localStorage.getItem(JEWELRY_DATASET_KEY) || '{}');
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

function loadViewerDatasetDirForAccount(accountKey) {
  if (!accountKey) return '';
  const directoryMap = loadViewerDatasetDirectoryMap();
  if (directoryMap[accountKey]) return directoryMap[accountKey];
  const legacyDir = localStorage.getItem(LEGACY_JEWELRY_DATASET_KEY) || '';
  if (!legacyDir) return '';
  directoryMap[accountKey] = legacyDir;
  localStorage.setItem(JEWELRY_DATASET_KEY, JSON.stringify(directoryMap));
  localStorage.removeItem(LEGACY_JEWELRY_DATASET_KEY);
  return legacyDir;
}

function getViewerDatasetDirForAccountPath(accountPath) {
  return loadViewerDatasetDirForAccount(getViewerAccountKey(accountPath));
}

function getConfiguredViewerDatasetDirs() {
  return [...new Set(Object.values(loadViewerDatasetDirectoryMap()).filter(Boolean))];
}

function saveViewerDatasetDirForAccount(accountKey, dirPath) {
  if (!accountKey) return;
  const directoryMap = loadViewerDatasetDirectoryMap();
  if (dirPath) directoryMap[accountKey] = dirPath;
  else delete directoryMap[accountKey];
  localStorage.setItem(JEWELRY_DATASET_KEY, JSON.stringify(directoryMap));
}

function updateAccountDatasetField(accountPath = selectedAccountPath) {
  if (!accountDatasetField || !accountDatasetPath || !pickAccountDatasetBtn) return;
  if (!accountPath) {
    accountDatasetField.classList.add('hidden');
    return;
  }
  const datasetDir = loadViewerDatasetDirForAccount(getViewerAccountKey(accountPath));
  accountDatasetField.classList.remove('hidden');
  accountDatasetField.classList.toggle('missing', !datasetDir);
  accountDatasetPath.textContent = datasetDir || '尚未选择目录';
  accountDatasetPath.title = datasetDir;
  pickAccountDatasetBtn.textContent = datasetDir ? '更改位置' : '选择位置';
}

async function promptViewerDatasetDirectory(accountKey, defaultPath = '') {
  if (!accountKey) return '';
  const dirPath = await window.exporter.pickDirectory({
    title: '选择当前账号的数据目录',
    defaultPath: defaultPath || outputDirInput.value.trim() || undefined,
  });
  if (!dirPath) return '';
  saveViewerDatasetDirForAccount(accountKey, dirPath);
  updateAccountDatasetField();
  return dirPath;
}

async function ensureViewerDatasetDirForAccount(accountKey, { prompt = false } = {}) {
  const datasetDir = loadViewerDatasetDirForAccount(accountKey);
  if (datasetDir || !prompt) {
    updateAccountDatasetField();
    return datasetDir;
  }
  return promptViewerDatasetDirectory(accountKey);
}

async function pickAccountDatasetDirectory() {
  const accountPath = selectedAccountPath;
  const accountKey = getViewerAccountKey(accountPath);
  if (!accountPath || !accountKey) return;
  const currentDir = loadViewerDatasetDirForAccount(accountKey);
  const datasetDir = await promptViewerDatasetDirectory(accountKey, currentDir);
  if (selectedAccountPath !== accountPath) return;
  if (datasetDir) {
    accountHint.textContent = '';
    accountHint.className = 'hint';
    await openSelectedAccountRecords(accountPath);
  } else if (!currentDir) {
    accountHint.textContent = '请先为此账号选择数据集存放位置，再进入群聊记录。';
    accountHint.className = 'hint error';
  }
}

function getViewerGroups() {
  return conversationItems.filter((item) => item.type === 'group');
}

function normalizeViewerGroupSearch(value) {
  return String(value || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

function isOrderedSearchMatch(query, target) {
  let queryIndex = 0;
  for (const char of target) {
    if (char === query[queryIndex]) queryIndex += 1;
    if (queryIndex === query.length) return true;
  }
  return false;
}

function matchesViewerGroupSearch(group, rawQuery) {
  const query = normalizeViewerGroupSearch(rawQuery);
  if (!query) return true;
  const fallback = normalizeViewerGroupSearch(group.displayName);
  const keys = viewerGroupSearchKeys.get(group.username) || [fallback];
  const fuzzyPinyin = /^[a-z0-9]+$/.test(query) && query.length >= 2;
  return keys.some((key) => key.includes(query) || fuzzyPinyin && isOrderedSearchMatch(query, key));
}

async function refreshViewerGroupSearchIndex() {
  const token = ++viewerGroupSearchIndexToken;
  const groups = getViewerGroups();
  viewerGroupSearchKeys = new Map();
  const result = await window.exporter.buildPinyinSearchIndex({
    items: groups.map((group) => ({ id: group.username, text: group.displayName })),
  });
  if (token !== viewerGroupSearchIndexToken || !result.ok) return;
  viewerGroupSearchKeys = new Map(
    (result.items || []).map((item) => [item.id, Array.isArray(item.keys) ? item.keys : []])
  );
}

function getViewerDateRange() {
  const selectedStart = viewerStartDate.value
    ? Math.floor(new Date(`${viewerStartDate.value}T00:00:00`).getTime() / 1000)
    : null;
  const start = viewerEntryStartTime == null
    ? selectedStart
    : selectedStart == null ? viewerEntryStartTime : Math.max(selectedStart, viewerEntryStartTime);
  const endExclusive = viewerEndDate.value
    ? Math.floor(new Date(`${viewerEndDate.value}T00:00:00`).getTime() / 1000) + SECONDS_PER_DAY
    : null;
  return { start, endExclusive };
}

function getViewerSenderFilter() {
  return viewerSelectedMembers == null ? null : [...viewerSelectedMembers];
}

function saveCurrentViewerSyncOption() {
  if (!viewerSelectedGroup) return;
  const { start, endExclusive } = getViewerDateRange();
  viewerGroupSyncOptions.set(viewerSelectedGroup.username, {
    username: viewerSelectedGroup.username,
    displayName: viewerSelectedGroup.displayName,
    senderWxids: getViewerSenderFilter(),
    startTime: start,
    endTime: endExclusive == null ? null : endExclusive - 1,
    startDate: viewerStartDate.value || '',
    endDate: viewerEndDate.value || '',
    includeText: viewerSyncText.checked,
    includeImages: viewerSyncImages.checked,
  });
}

function restoreViewerSyncOption(group) {
  const option = viewerGroupSyncOptions.get(group.username);
  viewerStartDate.value = option?.startDate || unixToDateInputValue(viewerEntryStartTime);
  viewerEndDate.value = option?.endDate || '';
  viewerSyncText.checked = option?.includeText !== false;
  viewerSyncImages.checked = option?.includeImages !== false;
  viewerSelectedMembers = Array.isArray(option?.senderWxids) ? new Set(option.senderWxids) : null;
}

function getViewerDatasetSelections() {
  saveCurrentViewerSyncOption();
  return getViewerGroups()
    .filter((group) => viewerSelectedGroups.has(group.username))
    .map((group) => viewerGroupSyncOptions.get(group.username) || {
      username: group.username,
      displayName: group.displayName,
      senderWxids: null,
      startTime: viewerEntryStartTime,
      endTime: null,
      includeText: true,
      includeImages: true,
    });
}

function getCurrentViewerDatasetSelection() {
  if (!viewerSelectedGroup) return null;
  saveCurrentViewerSyncOption();
  return viewerGroupSyncOptions.get(viewerSelectedGroup.username) || null;
}

function setViewerNoteHydrationStage(stage, state = '') {
  const item = viewerNoteHydrationStages?.querySelector(`[data-note-stage="${stage}"]`);
  if (!item) return;
  item.classList.toggle('active', state === 'active');
  item.classList.toggle('done', state === 'done');
}

function renderViewerNoteHydration() {
  const summary = viewerNoteHydrationSummaryData;
  const missingTasks = viewerNoteHydrationTasks.filter((task) => task.missingCount > 0);
  if (!viewerGroupLoadConfirmed || !viewerSelectedGroup) {
    viewerNoteHydrationSummary.textContent = '选择群聊后扫描';
  } else if (!summary) {
    viewerNoteHydrationSummary.textContent = '等待任务扫描';
  } else {
    viewerNoteHydrationSummary.textContent =
      `${summary.availableImages}/${summary.expectedImages} 张 · ${summary.pendingNotes} 条待补齐`;
  }

  setViewerNoteHydrationStage(
    'local',
    viewerNoteHydrationActiveStage === 'local'
      ? 'active'
      : summary || ['resource', 'done'].includes(viewerNoteHydrationActiveStage) ? 'done' : ''
  );
  setViewerNoteHydrationStage(
    'resource',
    viewerNoteHydrationActiveStage === 'resource'
      ? 'active'
      : viewerNoteHydrationActiveStage === 'done' ? 'done' : ''
  );

  viewerNoteHydrationList.replaceChildren();
  if (!viewerGroupLoadConfirmed) {
    const empty = document.createElement('p');
    empty.textContent = '尚未读取任务';
    viewerNoteHydrationList.appendChild(empty);
  } else if (!missingTasks.length) {
    const empty = document.createElement('p');
    empty.textContent = summary?.totalNotes ? '当前群笔记图片已完整' : '当前群没有待补齐笔记';
    viewerNoteHydrationList.appendChild(empty);
  } else {
    const statusLabels = {
      pending: '待补齐',
      running: '处理中',
      paused: '待补齐',
      needs_manual: '需人工',
      failed: '失败',
    };
    for (const task of missingTasks.slice(0, 6)) {
      const row = document.createElement('div');
      row.className = `viewer-note-task ${task.status || 'pending'}`;
      const title = document.createElement('strong');
      title.textContent = task.messageText || task.datetime || '无文字笔记';
      title.title = task.messageText || '';
      const state = document.createElement('small');
      state.textContent = `${task.availableCount}/${task.expectedCount} · ${statusLabels[task.status] || '待补齐'}`;
      if (task.lastError) {
        state.textContent += ` · ${task.lastError}`;
        state.title = task.lastError;
      }
      row.append(title, state);
      viewerNoteHydrationList.appendChild(row);
    }
    if (missingTasks.length > 6) {
      const more = document.createElement('p');
      more.textContent = `另有 ${missingTasks.length - 6} 条待处理`;
      viewerNoteHydrationList.appendChild(more);
    }
  }
  updateViewerExportState();
}

async function refreshViewerNoteHydrationTasks() {
  if (!viewerDatasetDir || !viewerSelectedGroup || !viewerGroupLoadConfirmed) {
    viewerNoteHydrationTasks = [];
    viewerNoteHydrationSummaryData = null;
    viewerNoteHydrationActiveStage = '';
    renderViewerNoteHydration();
    return false;
  }
  const requestToken = ++viewerNoteHydrationRequestToken;
  const username = viewerSelectedGroup.username;
  const selection = getCurrentViewerDatasetSelection();
  const result = await window.exporter.listNoteHydrationTasks({
    datasetDir: viewerDatasetDir,
    username,
    startTime: selection?.startTime ?? viewerEntryStartTime,
    endTime: selection?.endTime ?? null,
  });
  if (
    requestToken !== viewerNoteHydrationRequestToken ||
    username !== viewerSelectedGroup?.username ||
    !viewerGroupLoadConfirmed
  ) {
    return false;
  }
  if (!result.ok) {
    viewerNoteHydrationTasks = [];
    viewerNoteHydrationSummaryData = null;
    viewerNoteHydrationActiveStage = '';
    renderViewerNoteHydration();
    appendViewerProgressLog(result.error || '笔记补齐任务读取失败', 'warning');
    return false;
  }
  viewerNoteHydrationTasks = result.result.tasks || [];
  viewerNoteHydrationSummaryData = result.result.summary || null;
  renderViewerNoteHydration();
  return true;
}

async function startViewerNoteHydration() {
  if (!viewerSelectedGroup || viewerNoteHydrationRunning) return;
  const missingCount = viewerNoteHydrationTasks.filter((task) => task.missingCount > 0).length;
  if (!missingCount) return;
  const token = viewerRequestToken;
  const username = viewerSelectedGroup.username;
  viewerNoteHydrationRunning = true;
  viewerNoteHydrationActiveStage = 'local';
  renderViewerNoteHydration();
  setViewerSyncStatus('正在更新当前群笔记图片', 'syncing');
  const result = await window.exporter.startNoteHydration({
    accountPath: getViewerAccountPath(),
    wxDir: getViewerAccountPath(),
    datasetDir: viewerDatasetDir,
    selfWxid: currentConversationCache?.selfWxid || null,
    accountName: viewerAccountName.textContent,
    username,
    displayName: viewerSelectedGroup.displayName,
    selection: getCurrentViewerDatasetSelection(),
  });
  viewerNoteHydrationRunning = false;
  viewerNoteHydrationActiveStage = result.ok ? 'done' : '';
  if (token !== viewerRequestToken || username !== viewerSelectedGroup?.username) return;

  if (!result.ok) {
    setViewerSyncStatus(result.error || '笔记图片补齐失败', 'warning');
    appendViewerProgressLog(result.error || '笔记图片补齐失败', 'warning');
    await refreshViewerNoteHydrationTasks();
    return;
  }
  viewerNoteHydrationTasks = result.result.tasks || [];
  viewerNoteHydrationSummaryData = result.result.summary || null;
  renderViewerNoteHydration();
  const unresolvedCount = Number(result.result.summary?.pendingNotes) || 0;
  setViewerSyncStatus(
    unresolvedCount
      ? '本次更新后仍有 ' + unresolvedCount + ' 条未补齐，请查看日志'
      : '当前群笔记图片更新完成',
    unresolvedCount ? 'warning' : 'ready'
  );
  if (viewerSyncImages.checked) {
    await resolveViewerMessageImages(viewerMessages, token);
  }
}

function updateViewerExportState() {
  viewerOpenReviewBtn.disabled = !viewerDatasetDir || viewerDatasetSyncing;
  const noteReady = Boolean(
    viewerDatasetDir && viewerSelectedGroup && viewerGroupLoadConfirmed && viewerSyncImages.checked &&
    (viewerSelectedMembers == null || viewerSelectedMembers.size > 0)
  );
  viewerNoteUpdateBtn.disabled =
    !noteReady ||
    viewerDatasetSyncing ||
    viewerNoteHydrationRunning ||
    !viewerNoteHydrationTasks.some((task) => task.missingCount > 0);
}

function renderViewerGroups() {
  const query = viewerGroupSearch.value.trim();
  const groups = getViewerGroups().filter((group) =>
    matchesViewerGroupSearch(group, query)
  );
  viewerGroupCount.textContent = String(getViewerGroups().length);
  viewerSelectAllGroups.checked = viewerSelectedGroups.size === getViewerGroups().length && getViewerGroups().length > 0;
  viewerSelectAllGroups.indeterminate = viewerSelectedGroups.size > 0 && viewerSelectedGroups.size < getViewerGroups().length;
  viewerGroupList.replaceChildren();

  if (!groups.length) {
    const empty = document.createElement('div');
    empty.className = 'viewer-empty';
    empty.textContent = query ? '没有匹配的群聊' : '未找到群聊记录';
    viewerGroupList.appendChild(empty);
    return;
  }

  for (const group of groups) {
    const button = document.createElement('div');
    button.className = 'viewer-group-item';
    button.classList.toggle('active', group.username === viewerSelectedGroup?.username);
    button.dataset.username = group.username;
    button.tabIndex = 0;
    button.setAttribute('role', 'button');

    const selected = document.createElement('input');
    selected.type = 'checkbox';
    selected.checked = viewerSelectedGroups.has(group.username);
    selected.setAttribute('aria-label', `选择群聊 ${group.displayName}`);
    selected.addEventListener('click', (event) => event.stopPropagation());
    selected.addEventListener('change', () => {
      if (selected.checked) viewerSelectedGroups.add(group.username);
      else viewerSelectedGroups.delete(group.username);
      renderViewerGroups();
      updateViewerExportState();
    });

    const avatar = document.createElement('span');
    avatar.className = 'viewer-avatar';
    avatar.textContent = Array.from(group.displayName || '群')[0] || '群';
    const copy = document.createElement('span');
    copy.className = 'viewer-group-copy';
    const name = document.createElement('strong');
    name.textContent = group.displayName;
    const meta = document.createElement('span');
    meta.textContent = `${formatCount(group.messageCount)} 条消息${viewerConfirmedGroups.has(group.username) ? ' · 已确认' : ''}`;
    copy.append(name, meta);
    button.append(selected, avatar, copy);
    button.addEventListener('click', () => void selectViewerGroup(group));
    button.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        void selectViewerGroup(group);
      }
    });
    viewerGroupList.appendChild(button);
  }
}

function renderViewerMembers() {
  const query = viewerMemberSearch.value.trim().toLowerCase();
  viewerMemberCount.textContent = String(viewerMembers.length);
  viewerMemberList.replaceChildren();
  viewerSelectAllMembers.checked = viewerSelectedMembers == null;
  viewerSelectAllMembers.indeterminate =
    viewerSelectedMembers instanceof Set &&
    viewerSelectedMembers.size > 0 &&
    viewerSelectedMembers.size < viewerMembers.length;

  for (const member of viewerMembers) {
    if (query && !member.displayName.toLowerCase().includes(query) && !member.wxid.toLowerCase().includes(query)) {
      continue;
    }
    const label = document.createElement('label');
    label.className = 'viewer-member-item';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = viewerSelectedMembers == null || viewerSelectedMembers.has(member.wxid);
    input.dataset.wxid = member.wxid;
    const name = document.createElement('span');
    name.textContent = member.isSelf ? `${member.displayName}（我）` : member.displayName;
    const count = document.createElement('small');
    count.textContent = formatCount(member.messageCount);
    input.addEventListener('change', () => {
      if (viewerSelectedMembers == null) {
        viewerSelectedMembers = new Set(viewerMembers.map((item) => item.wxid));
      }
      if (input.checked) viewerSelectedMembers.add(member.wxid);
      else viewerSelectedMembers.delete(member.wxid);
      if (viewerSelectedMembers.size === viewerMembers.length) viewerSelectedMembers = null;
      saveCurrentViewerSyncOption();
      renderViewerMembers();
      scheduleViewerReload({ syncDataset: false });
    });
    label.append(input, name, count);
    viewerMemberList.appendChild(label);
  }
  updateViewerExportState();
}

function openViewerLightbox(url) {
  viewerLightboxImage.src = url;
  viewerLightbox.classList.remove('hidden');
  viewerLightboxClose.focus();
}

function closeViewerLightbox() {
  viewerLightbox.classList.add('hidden');
  viewerLightboxImage.removeAttribute('src');
}

function getViewerMessageContent(message) {
  const recordItems = message?.extra?.kind === 'note' && Array.isArray(message.extra.recordItems)
    ? message.extra.recordItems
    : [];
  const recordText = recordItems
    .filter((item) => item?.kind === 'text')
    .map((item) => String(item.dataDesc || '').trim())
    .filter(Boolean)
    .join('\n');
  return recordText || message?.content || '';
}

function getViewerExpectedImageCount(message) {
  let count = Number(message?.type) === 3 || message?.extra?.kind === 'image' ? 1 : 0;
  count += (message?.extra?.recordItems || []).filter((item) => item?.kind === 'image').length;
  return count;
}
function renderViewerMessages() {
  viewerMessageList.replaceChildren();
  viewerLoadOlderBtn.classList.toggle('hidden', !viewerHasMore || viewerLoading);
  if (!viewerSelectedGroup) {
    const empty = document.createElement('div');
    empty.className = 'viewer-empty';
    empty.textContent = '选择群聊并确认后，才会读取本地解密消息和图片';
    viewerMessageList.appendChild(empty);
    return;
  }
  const visibleMessages = viewerImagesOnly
    ? viewerMessages.filter(viewerMessageHasImage)
    : viewerMessages;
  if (!visibleMessages.length) {
    const empty = document.createElement('div');
    empty.className = 'viewer-empty';
    empty.textContent = viewerLoading ? '正在读取记录…' : '当前筛选条件下没有消息';
    viewerMessageList.appendChild(empty);
    return;
  }

  for (const message of visibleMessages) {
    const images = Array.isArray(message.previewImages) ? message.previewImages : [];
    const expectedImageCount = getViewerExpectedImageCount(message);
    const row = document.createElement('article');
    row.className = 'viewer-message';
    row.classList.toggle('has-image', images.length > 0 || message.type === 3);
    const time = document.createElement('time');
    time.className = 'viewer-message-time';
    time.dateTime = message.datetime || '';
    time.textContent = message.datetime?.slice(11, 16) || '';
    const marker = document.createElement('span');
    marker.className = 'viewer-message-marker';
    const body = document.createElement('div');
    body.className = 'viewer-message-body';
    const sender = document.createElement('p');
    sender.className = 'viewer-message-sender';
    sender.textContent = `${message.senderName || message.senderWxid || '未知发送人'} · ${message.datetime?.slice(0, 10) || ''}`;
    body.appendChild(sender);

    const messageContent = getViewerMessageContent(message);
    if (messageContent && !(images.length > 0 && messageContent === '[图片]')) {
      const content = document.createElement('div');
      content.className = 'viewer-message-content';
      content.textContent = messageContent;
      body.appendChild(content);
    }
    if (images.length > 0) {
      const grid = document.createElement('div');
      grid.className = 'viewer-image-grid';
      for (const preview of images) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'viewer-image-button';
        button.title = '查看原图';
        const image = document.createElement('img');
        image.src = preview.url;
        image.alt = (message.senderName || '群成员') + '发送的图片';
        image.loading = 'lazy';
        button.appendChild(image);
        button.addEventListener('click', () => openViewerLightbox(preview.url));
        grid.appendChild(button);
      }
      body.appendChild(grid);
    }
    if (expectedImageCount > images.length) {
      const state = document.createElement('div');
      state.className = 'viewer-image-state ' + (images.length > 0 ? 'partial' : 'unavailable');
      state.textContent = message.imageLoadState === 'loading'
        ? '图片加载中…'
        : '已加载 ' + images.length + '/' + expectedImageCount + ' 张，本地仍缺 ' +
          (expectedImageCount - images.length) + ' 张';
      state.setAttribute('aria-live', 'polite');
      body.appendChild(state);
    } else if (!images.length && message.imageLoadState) {
      const state = document.createElement('div');
      state.className = 'viewer-image-state ' + message.imageLoadState;
      state.textContent = message.imageLoadState === 'loading' ? '图片加载中…' : '图片暂时无法读取';
      state.setAttribute('aria-live', 'polite');
      body.appendChild(state);
    }    row.append(time, marker, body);
    viewerMessageList.appendChild(row);
  }
}

function getViewerMessageKey(message) {
  return `${message.createTime}:${message.id}:${message.serverId || ''}`;
}

function viewerMessageHasImage(message) {
  return (
    Number(message?.type) === 3 ||
    message?.extra?.kind === 'image' ||
    (Array.isArray(message?.extra?.recordItems) &&
      message.extra.recordItems.some((item) => item?.kind === 'image'))
  );
}

async function resolveViewerMessageImages(messages, token, { datasetDir = viewerDatasetDir } = {}) {
  if (!viewerGroupLoadConfirmed) return;
  const imageMessages = (messages || []).filter(viewerMessageHasImage);
  if (!imageMessages.length) return;
  const previousHeight = viewerMessageScroller.scrollHeight;
  const wasNearBottom =
    viewerMessageScroller.scrollHeight - viewerMessageScroller.scrollTop - viewerMessageScroller.clientHeight < 80;
  appendViewerProgressLog(`正在加载 ${imageMessages.length} 条消息的本地图片`);
  const result = await window.exporter.resolveConversationImages({
    wxDir: getViewerAccountPath(),
    username: viewerSelectedGroup?.username,
    messages: imageMessages,
    datasetDir: datasetDir || null,
    existingOnly: true,
    progressMeta: {
      scope: 'viewer',
      username: viewerSelectedGroup?.username,
      displayName: viewerSelectedGroup?.displayName,
    },
  });
  if (token !== viewerRequestToken) return;
  const requestedKeys = new Set(imageMessages.map(getViewerMessageKey));
  if (!result.ok) {
    for (const message of viewerMessages) {
      if (requestedKeys.has(getViewerMessageKey(message))) message.imageLoadState = 'unavailable';
    }
    renderViewerMessages();
    setViewerSyncStatus('消息已读取，部分图片无法读取', 'warning');
    appendViewerProgressLog(result.error || '部分图片无法读取', 'warning');
    return;
  }
  const previews = new Map(
    (result.result.previews || []).map((item) => [getViewerMessageKey(item), item.previewImages || []])
  );
  for (const message of viewerMessages) {
    const resolved = previews.get(getViewerMessageKey(message));
    if (!resolved) {
      if (requestedKeys.has(getViewerMessageKey(message))) message.imageLoadState = 'unavailable';
      continue;
    }
    message.previewImages = resolved;
    message.imageLoadState = resolved.length > 0 ? 'ready' : 'unavailable';
  }
  renderViewerMessages();
  if (wasNearBottom) {
    viewerMessageScroller.scrollTop = viewerMessageScroller.scrollHeight;
  } else {
    viewerMessageScroller.scrollTop += viewerMessageScroller.scrollHeight - previousHeight;
  }
  setViewerSyncStatus(`已读取 ${viewerSelectedGroup?.displayName || '群聊'} 的消息和图片`, 'ready');
}

async function loadViewerMembers(token) {
  if (!viewerSelectedGroup || !viewerGroupLoadConfirmed) return;
  const savedOption = viewerGroupSyncOptions.get(viewerSelectedGroup.username);
  viewerMembers = [];
  viewerSelectedMembers = Array.isArray(savedOption?.senderWxids) ? new Set(savedOption.senderWxids) : null;
  renderViewerMembers();
  const { start } = getViewerDateRange();
  const result = await window.exporter.listGroupMembers({
    wxDir: getViewerAccountPath(),
    datasetDir: viewerDatasetDir,
    username: viewerSelectedGroup.username,
    startTime: start,
  });
  if (token !== viewerRequestToken) return;
  if (!result.ok) {
    setViewerSyncStatus(result.error || '成员读取失败', 'warning');
    return;
  }
  viewerMembers = result.result.members || [];
  viewerSelectedMembers = Array.isArray(savedOption?.senderWxids) ? new Set(savedOption.senderWxids) : null;
  renderViewerMembers();
  if (viewerSelectedGroup) {
    viewerConversationMeta.textContent = `${formatCount(viewerMessages.length)} 条已加载 · ${viewerMembers.length} 位发言成员`;
  }
}

async function loadViewerMessages({ older = false, resolveImages = true } = {}) {
  if (!viewerSelectedGroup || !viewerGroupLoadConfirmed || viewerLoading) return;
  if (viewerSelectedMembers instanceof Set && viewerSelectedMembers.size === 0) {
    viewerMessages = [];
    viewerHasMore = false;
    renderViewerMessages();
    updateViewerExportState();
    return;
  }
  const { start, endExclusive } = getViewerDateRange();
  if (start != null && endExclusive != null && start >= endExclusive) {
    viewerMessages = [];
    viewerHasMore = false;
    renderViewerMessages();
    setViewerSyncStatus('日期范围无效', 'warning');
    return;
  }

  const token = viewerRequestToken;
  const oldHeight = viewerMessageScroller.scrollHeight;
  const cursor = older
    ? viewerNextCursor
    : endExclusive != null
      ? { beforeTime: endExclusive, beforeLocalId: Number.MAX_SAFE_INTEGER }
      : null;
  viewerLoading = true;
  viewerLoadOlderBtn.disabled = true;
  if (!older) {
    viewerMessages = [];
    renderViewerMessages();
  }
  updateViewerExportState();

  const result = await window.exporter.loadConversationMessages({
    wxDir: getViewerAccountPath(),
    datasetDir: viewerDatasetDir,
    username: viewerSelectedGroup.username,
    cursor,
    limit: 100,
    senderWxids: getViewerSenderFilter(),
    startTime: start,
  });
  if (token !== viewerRequestToken) return;
  viewerLoading = false;
  viewerLoadOlderBtn.disabled = false;
  updateViewerExportState();

  if (!result.ok) {
    viewerMessages = older ? viewerMessages : [];
    viewerHasMore = false;
    renderViewerMessages();
    setViewerSyncStatus(result.error || '消息读取失败', 'warning');
    return;
  }

  const page = result.result;
  const incoming = page.messages || [];
  for (const message of incoming) {
    if (viewerSyncImages.checked && viewerMessageHasImage(message)) message.imageLoadState = 'loading';
  }
  const combined = older ? [...incoming, ...viewerMessages] : incoming;
  const seen = new Set();
  viewerMessages = combined.filter((message) => {
    const key = `${message.createTime}:${message.id}:${message.serverId || ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  viewerNextCursor = page.nextCursor || null;
  viewerHasMore = Boolean(page.hasMore);
  viewerConversationMeta.textContent = `${formatCount(viewerMessages.length)} 条已加载 · ${viewerMembers.length || '—'} 位发言成员`;
  renderViewerMessages();
  const hasImages = viewerSyncImages.checked && incoming.some(viewerMessageHasImage);
  setViewerSyncStatus(
    hasImages ? '消息已读取，正在加载图片' : `已读取 ${viewerSelectedGroup.displayName} 的消息`,
    hasImages ? 'syncing' : 'ready'
  );
  if (older) {
    viewerMessageScroller.scrollTop += viewerMessageScroller.scrollHeight - oldHeight;
  } else {
    viewerMessageScroller.scrollTop = viewerMessageScroller.scrollHeight;
  }
  if (resolveImages && hasImages) void resolveViewerMessageImages(incoming, token);
}

function scheduleViewerReload({ syncDataset = true } = {}) {
  if (!viewerGroupLoadConfirmed) return;
  clearTimeout(viewerFilterTimer);
  viewerFilterTimer = setTimeout(async () => {
    viewerRequestToken += 1;
    const token = viewerRequestToken;
    viewerNextCursor = null;
    viewerLoading = false;
    await loadViewerMessages({ resolveImages: !syncDataset });
    if (token !== viewerRequestToken || !syncDataset) return;
    const selection = getCurrentViewerDatasetSelection();
    if (selection) {
      await queueViewerDatasetSync({ selections: [selection], token, resolvePreviews: true });
    }
  }, 180);
}

async function selectViewerGroup(group) {
  if (!group || group.username === viewerSelectedGroup?.username && viewerGroupLoadConfirmed) return;
  if (viewerNoteHydrationRunning) {
    setViewerSyncStatus('笔记图片正在更新，请等待完成后切换群聊', 'warning');
    return;
  }
  const confirmed = await showConfirmDialog({
    title: `读取「${group.displayName}」`,
    message: '确认后才会读取这个群聊的本地解密消息、成员信息和图片。',
    detail: '读取仅在本机进行；数据目录按当前不信账号独立保存。',
    tone: 'guide',
    confirmLabel: '确认并读取',
    cancelLabel: '暂不读取',
  });
  if (!confirmed) return;
  clearViewerProgressLog();
  appendViewerProgressLog(`开始读取「${group.displayName}」的消息和图片`);
  if (viewerEntryStartTime != null) {
    appendViewerProgressLog(`起始日期：${new Date(viewerEntryStartTime * 1000).toLocaleDateString('zh-CN')}`);
  }
  saveCurrentViewerSyncOption();
  viewerSelectedGroup = group;
  viewerMediaFingerprint = null;
  viewerGroupLoadConfirmed = true;
  viewerConfirmedGroups.add(group.username);
  viewerSelectedGroups.add(group.username);
  viewerRequestToken += 1;
  const token = viewerRequestToken;
  viewerMessages = [];
  viewerNextCursor = null;
  viewerHasMore = false;
  viewerMembers = [];
  viewerNoteHydrationRequestToken += 1;
  viewerNoteHydrationTasks = [];
  viewerNoteHydrationSummaryData = null;
  viewerNoteHydrationActiveStage = '';
  restoreViewerSyncOption(group);
  viewerLoading = false;
  viewerConversationTitle.textContent = group.displayName;
  viewerConversationMeta.textContent = `${formatCount(group.messageCount)} 条消息`;
  renderViewerGroups();
  renderViewerMembers();
  renderViewerMessages();
  renderViewerNoteHydration();
  updateViewerExportState();
  setViewerSyncStatus(`正在读取 ${group.displayName}`, 'syncing');
  startViewerAutoSync();
  await Promise.all([loadViewerMessages({ resolveImages: false }), loadViewerMembers(token)]);
  if (token !== viewerRequestToken) return;
  const selection = getCurrentViewerDatasetSelection();
  if (selection) {
    await queueViewerDatasetSync({ selections: [selection], token, resolvePreviews: true });
  }
}

async function syncViewerLatest() {
  if (!viewerIsOpen || !viewerGroupLoadConfirmed || !viewerSelectedGroup) return;
  if (viewerSyncing) {
    setViewerSyncStatus('当前群刷新正在进行', 'syncing');
    appendViewerProgressLog('当前群刷新正在进行，请等待完成');
    return;
  }
  const accountPath = getViewerAccountPath();
  if (!accountPath) {
    setViewerSyncStatus('未找到当前账号目录', 'warning');
    appendViewerProgressLog('未找到当前账号目录，无法检查新记录', 'warning');
    return;
  }
  const username = viewerSelectedGroup.username;
  const displayName = viewerSelectedGroup.displayName;
  const datasetDir = viewerDatasetDir;
  const previousMediaFingerprint = viewerMediaFingerprint;
  viewerSyncing = true;
  viewerRefreshBtn.disabled = true;
  setViewerSyncStatus(`正在检查 ${displayName} 的新记录`, 'syncing');
  appendViewerProgressLog(`开始增量刷新「${displayName}」`);
  try {
    const result = await window.exporter.refreshCurrentGroup({
      wxDir: wxDirInput.value.trim(),
      accountPath,
      datasetDir,
      username,
      displayName,
      selfWxid: currentConversationCache?.selfWxid || null,
    });
    if (
      !viewerIsOpen ||
      viewerSelectedGroup?.username !== username ||
      viewerDatasetDir !== datasetDir
    ) {
      return;
    }
    if (!result.ok) {
      const message = result.error || '当前群新记录读取失败';
      setViewerSyncStatus(message, 'warning');
      appendViewerProgressLog(message, 'warning');
      return;
    }

    const refreshed = result.result || {};
    const mediaChanged =
      previousMediaFingerprint != null &&
      refreshed.mediaFingerprint != null &&
      previousMediaFingerprint !== refreshed.mediaFingerprint;
    viewerFingerprint = refreshed.fingerprint || viewerFingerprint;
    viewerMediaFingerprint = refreshed.mediaFingerprint || viewerMediaFingerprint;
    if (refreshed.group?.messageCount != null) {
      const item = conversationItems.find((entry) => entry.username === username);
      if (item) item.messageCount = refreshed.group.messageCount;
      if (viewerSelectedGroup) viewerSelectedGroup.messageCount = refreshed.group.messageCount;
      renderViewerGroups();
    }
    if (refreshed.needsSync) {
      const message = refreshed.warning || '新记录暂未读取，继续使用已有群聊数据';
      setViewerSyncStatus(message, 'warning');
      appendViewerProgressLog(message, 'warning');
      return;
    }

    viewerRequestToken += 1;
    const token = viewerRequestToken;
    await Promise.all([loadViewerMessages({ resolveImages: false }), loadViewerMembers(token)]);
    if (token === viewerRequestToken) {
      const selection = getCurrentViewerDatasetSelection();
      if (selection) {
        await queueViewerDatasetSync({
          selections: [selection],
          force: mediaChanged,
          token,
          resolvePreviews: true,
        });
      }
    }
    if (token !== viewerRequestToken) return;
    const addedMessages = Number(refreshed.group?.addedMessages) || 0;
    const message = addedMessages > 0
      ? `当前群刷新完成，新增 ${addedMessages} 条消息`
      : mediaChanged
        ? '当前群消息无变化，已检查本地图片更新'
        : '当前群没有发现新记录';
    setViewerSyncStatus(message, 'ready');
    appendViewerProgressLog(message);
  } catch (err) {
    const message = err?.message || '当前群刷新失败';
    setViewerSyncStatus(message, 'warning');
    appendViewerProgressLog(message, 'warning');
  } finally {
    viewerSyncing = false;
    viewerRefreshBtn.disabled = false;
  }
}

async function checkViewerDataStatus() {
  if (
    !viewerIsOpen ||
    !viewerGroupLoadConfirmed ||
    viewerSyncing ||
    viewerDatasetSyncing ||
    viewerNoteHydrationRunning ||
    viewerStatusChecking
  ) {
    return;
  }
  const accountPath = getViewerAccountPath();
  const username = viewerSelectedGroup?.username || null;
  if (!accountPath || !username) return;
  viewerStatusChecking = true;
  let status;
  try {
    status = await window.exporter.getDataStatus({
      accountPath,
      datasetDir: viewerDatasetDir,
      username,
    });
  } catch (err) {
    status = { ok: false, error: err.message };
  } finally {
    viewerStatusChecking = false;
  }
  if (!status.ok) {
    setViewerSyncStatus(status.error || '无法检查数据', 'warning');
    return;
  }

  const recordsChanged = viewerFingerprint != null && viewerFingerprint !== status.fingerprint;
  const mediaChanged =
    viewerMediaFingerprint != null &&
    status.mediaFingerprint != null &&
    viewerMediaFingerprint !== status.mediaFingerprint;
  viewerFingerprint = status.fingerprint;

  if (recordsChanged || status.needsSync) {
    viewerMediaFingerprint = status.mediaFingerprint;
    setViewerSyncStatus('检测到新记录，可手动刷新', 'warning');
    return;
  }

  if (mediaChanged && viewerSyncImages.checked) {
    viewerMediaFingerprint = status.mediaFingerprint;
    const selection = getCurrentViewerDatasetSelection();
    if (selection) {
      const token = viewerRequestToken;
      setViewerSyncStatus('检测到本地图片更新，正在补充缺失图片', 'syncing');
      appendViewerProgressLog('检测到本地图片缓存更新，只重试当前群缺失图片');
      await queueViewerDatasetSync({ selections: [selection], force: true, token, resolvePreviews: true });
      return;
    }
  }

  if (viewerMediaFingerprint == null) {
    viewerMediaFingerprint = status.mediaFingerprint;
  }
  if (mediaChanged) {
    setViewerSyncStatus('检测到本地图片更新，启用图片后自动补充', 'warning');
    return;
  }
  setViewerSyncStatus('本机记录已是最新', 'ready');
}

function startViewerAutoSync() {
  clearInterval(viewerSyncTimer);
  viewerSyncTimer = setInterval(() => {
    if (viewerAutoSync.checked) void checkViewerDataStatus();
  }, VIEWER_SYNC_INTERVAL_MS);
}

async function openRecordViewer() {
  const groups = getViewerGroups();
  if (!groups.length) {
    await showFriendlyError('没有群聊记录', '请先完成会话扫描，确认当前账号存在群聊消息。');
    return;
  }
  const accountKey = getViewerAccountKey();
  const entryStartValue = getRecordsStartDateValue();
  const entryStartTime = recordsStartTimeToUnix(entryStartValue);
  if (entryStartValue && entryStartTime == null) {
    validateRecordsStartDate();
    await showFriendlyError('起始日期无效', '请重新选择消息与图片的起始日期。');
    focusInvalidRecordsStartDatePart();
    return;
  }
  saveRecordsStartTimeForAccount(accountKey);
  const datasetDir = await ensureViewerDatasetDirForAccount(accountKey, { prompt: true });
  if (!datasetDir) {
    await showFriendlyError('尚未选择账号数据目录', '请先为当前账号选择数据存放位置，再进入群聊记录。');
    return;
  }
  if (
    (viewerActiveAccountKey && viewerActiveAccountKey !== accountKey) ||
    viewerEntryStartTime !== entryStartTime
  ) {
    viewerGroupSyncOptions.clear();
  }
  viewerActiveAccountKey = accountKey;
  viewerEntryStartTime = entryStartTime;
  viewerRequestToken += 1;
  viewerSelectedGroup = null;
  viewerGroupLoadConfirmed = false;
  viewerConfirmedGroups = new Set();
  viewerSelectedGroups = new Set();
  viewerMembers = [];
  viewerSelectedMembers = null;
  viewerMessages = [];
  viewerNoteHydrationRequestToken += 1;
  viewerNoteHydrationTasks = [];
  viewerNoteHydrationSummaryData = null;
  viewerNoteHydrationActiveStage = '';
  viewerNoteHydrationRunning = false;
  viewerNextCursor = null;
  viewerHasMore = false;
  viewerLoading = false;
  await refreshViewerGroupSearchIndex();
  viewerIsOpen = true;
  recordViewer.classList.remove('hidden');
  setViewerDatasetDir(datasetDir, { persist: false });
  const accountPath = getViewerAccountPath();
  const account = scannedAccounts.find((item) => item.path === accountPath);
  viewerAccountName.textContent = account?.displayName || currentConversationCache?.displayName || '本地不信数据';
  viewerConversationTitle.textContent = '选择一个群聊';
  viewerConversationMeta.textContent = '确认后才读取本地解密消息和图片';
  setViewerSyncStatus('尚未读取群聊数据', 'idle');
  clearViewerProgressLog();
  renderViewerGroups();
  renderViewerMembers();
  renderViewerMessages();
  renderViewerNoteHydration();
  updateViewerExportState();
}

function closeRecordViewer() {
  if (viewerNoteHydrationRunning) {
    setViewerSyncStatus('笔记图片正在更新，请等待完成后关闭', 'warning');
    return;
  }
  saveCurrentViewerSyncOption();
  viewerNoteHydrationRunning = false;
  viewerNoteHydrationRequestToken += 1;
  viewerNoteHydrationTasks = [];
  viewerNoteHydrationSummaryData = null;
  viewerNoteHydrationActiveStage = '';
  viewerIsOpen = false;
  viewerRequestToken += 1;
  viewerSelectedGroup = null;
  viewerGroupLoadConfirmed = false;
  viewerConfirmedGroups = new Set();
  viewerLoading = false;
  clearInterval(viewerSyncTimer);
  viewerSyncTimer = null;
  recordViewer.classList.add('hidden');
  closeClassificationReview();
  closeViewerLightbox();
}

function setViewerDatasetDir(dirPath, { persist = true } = {}) {
  const nextDir = dirPath || '';
  if (viewerDatasetDir !== nextDir) {
    viewerDatasetSyncSignatures.clear();
    invalidateClassificationReviewCache();
  }
  viewerDatasetDir = nextDir;
  viewerDatasetPath.textContent = viewerDatasetDir || '此账号尚未选择目录';
  viewerDatasetPath.title = viewerDatasetDir;
  if (persist) saveViewerDatasetDirForAccount(viewerActiveAccountKey || getViewerAccountKey(), viewerDatasetDir);
  updateViewerExportState();
}

async function pickViewerDatasetDirectory() {
  const accountKey = viewerActiveAccountKey || getViewerAccountKey();
  const dirPath = await promptViewerDatasetDirectory(accountKey, viewerDatasetDir);
  if (dirPath) setViewerDatasetDir(dirPath, { persist: false });
}

async function ensureJewelryTaxonomy() {
  if (jewelryProductCategories.length && jewelryProcesses.length) return true;
  const result = await window.exporter.getJewelryTaxonomy();
  if (!result.ok) {
    await showFriendlyError('分类选项读取失败', result.error || '无法读取珠宝分类选项');
    return false;
  }
  jewelryProductCategories = result.productCategories || [];
  jewelryProcesses = result.processes || [];
  return true;
}

async function ensureJewelryCodexConsent(preparation) {
  const targetCount = Number(preparation?.targetCount) || 0;
  const exampleCount = Number(preparation?.exampleCount) || 0;
  const batchCount = Number(preparation?.batchCount) || 0;
  return showConfirmDialog({
    title: '提交 Codex 图片识别',
    message: '本次将分类 ' + targetCount + ' 张目标图，并使用 ' + exampleCount + ' 张学习示例。',
    detail: '共 ' + batchCount + ' 个批次；每批最多 ' + (preparation?.attachmentLimit || 10) + ' 张附件。本次授权不会被记住。',
    tone: 'warn',
    confirmLabel: '提交 ' + targetCount + ' 张图片',
    cancelLabel: '取消',
  });
}

function getViewerDatasetSyncSignature(selection, context = null) {
  return JSON.stringify({
    accountKey: context ? context.accountKey : viewerActiveAccountKey,
    datasetDir: context ? context.datasetDir : viewerDatasetDir,
    fingerprint: context ? context.fingerprint : viewerFingerprint,
    ...selection,
    senderWxids: Array.isArray(selection.senderWxids) ? [...selection.senderWxids].sort() : null,
  });
}

function queueViewerDatasetSync(options = {}) {
  const context = {
    accountKey: viewerActiveAccountKey,
    accountPath: getViewerAccountPath(),
    accountName: viewerAccountName.textContent,
    datasetDir: viewerDatasetDir,
    fingerprint: viewerFingerprint,
    selfWxid: currentConversationCache?.selfWxid || null,
    confirmedUsernames: new Set(viewerConfirmedGroups),
  };
  const job = viewerDatasetSyncChain.then(() => syncViewerDataset({ ...options, context }));
  viewerDatasetSyncChain = job.catch(() => {});
  return job;
}

async function syncViewerDataset({
  selections: requestedSelections = null,
  force = false,
  token = viewerRequestToken,
  resolvePreviews = false,
  context = null,
} = {}) {
  const syncContext = context || {
    accountKey: viewerActiveAccountKey,
    accountPath: getViewerAccountPath(),
    accountName: viewerAccountName.textContent,
    datasetDir: viewerDatasetDir,
    fingerprint: viewerFingerprint,
    selfWxid: currentConversationCache?.selfWxid || null,
    confirmedUsernames: new Set(viewerConfirmedGroups),
  };
  if (!syncContext.datasetDir) return false;
  const isActiveContext = () =>
    viewerIsOpen &&
    viewerActiveAccountKey === syncContext.accountKey &&
    viewerDatasetDir === syncContext.datasetDir;
  let selections = requestedSelections || getViewerDatasetSelections();
  if (!selections.length) {
    return false;
  }
  const unconfirmed = selections.filter((item) => !syncContext.confirmedUsernames.has(item.username));
  if (unconfirmed.length) {
    return false;
  }
  if (selections.some((item) => !item.includeText && !item.includeImages)) {
    await showFriendlyError('未选择保存内容', '每个群聊至少需要选择文本消息或图片内容。');
    return false;
  }
  selections = selections.filter((item) =>
    !Array.isArray(item.senderWxids) || item.senderWxids.length > 0
  );
  if (!selections.length) return false;
  if (selections.some((item) => item.startTime && item.endTime && item.startTime > item.endTime)) {
    await showFriendlyError('日期范围无效', '开始日期不能晚于结束日期。');
    return false;
  }
  selections = selections.filter((selection) =>
    force || viewerDatasetSyncSignatures.get(selection.username) !== getViewerDatasetSyncSignature(selection, syncContext)
  );
  if (!selections.length) {
    if (resolvePreviews && viewerSyncImages.checked && token === viewerRequestToken && isActiveContext()) {
      await resolveViewerMessageImages(viewerMessages, token);
    }
    if (isActiveContext()) await refreshViewerNoteHydrationTasks();
    return true;
  }
  viewerDatasetSyncing = true;
  updateViewerExportState();
  if (isActiveContext()) {
    setViewerSyncStatus('正在自动保存到 SQLite 数据集', 'syncing');
    appendViewerProgressLog(`开始自动保存 ${selections.length} 个群聊`);
  }
  let result;
  try {
    result = await window.exporter.syncJewelryDataset({
      wxDir: syncContext.accountPath,
      datasetDir: syncContext.datasetDir,
      selfWxid: syncContext.selfWxid,
      accountName: syncContext.accountName,
      forceImageResolve: force,
      selections,
    });
  } catch (err) {
    result = { ok: false, error: err.message };
  } finally {
    viewerDatasetSyncing = false;
    updateViewerExportState();
  }
  if (!result.ok) {
    if (isActiveContext()) {
      setViewerSyncStatus(result.error || 'SQLite 数据集自动保存失败', 'warning');
      appendViewerProgressLog(result.error || 'SQLite 数据集自动保存失败', 'warning');
    }
    return false;
  }
  const synced = result.result;
  if (viewerClassificationLoadedDatasetDir === synced.datasetDir) {
    invalidateClassificationReviewCache();
  }
  const activeAtCompletion = isActiveContext();
  if (activeAtCompletion) {
    syncContext.datasetDir = synced.datasetDir;
    setViewerDatasetDir(synced.datasetDir);
  }
  for (const selection of selections) {
    viewerDatasetSyncSignatures.set(selection.username, getViewerDatasetSyncSignature(selection, syncContext));
  }
  if (!activeAtCompletion) return true;
  setViewerSyncStatus(
    `已自动保存 ${synced.syncedMessages} 条消息${synced.syncedImages ? `，${synced.syncedImages} 张图片` : ""}`,
    'ready'
  );
  appendViewerProgressLog(
    `自动保存完成：新增 ${synced.syncedMessages} 条消息，解析 ${synced.syncedImages} 张图片`
  );
  if (resolvePreviews && viewerSyncImages.checked && token === viewerRequestToken && isActiveContext()) {
    await resolveViewerMessageImages(viewerMessages, token, { datasetDir: synced.datasetDir });
  }
  await refreshViewerNoteHydrationTasks();
  return true;
}

function replaceSelectOptions(select, entries, firstLabel, valueKey = 'id', labelKey = 'name') {
  const current = select.value;
  select.replaceChildren();
  const first = document.createElement('option');
  first.value = '';
  first.textContent = firstLabel;
  select.appendChild(first);
  for (const entry of entries) {
    const option = document.createElement('option');
    option.value = entry[valueKey];
    option.textContent = entry[labelKey];
    select.appendChild(option);
  }
  if ([...select.options].some((option) => option.value === current)) select.value = current;
}

function renderBatchProcessOptions() {
  viewerBatchProcesses.replaceChildren();
  for (const process of jewelryProcesses) {
    const label = document.createElement('label');
    label.className = 'classification-option';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.value = process.id;
    input.addEventListener('change', () => {
      if (input.checked) viewerBatchNoProcess.checked = false;
    });
    label.append(input, document.createTextNode(process.name));
    viewerBatchProcesses.appendChild(label);
  }
}

function getClassificationFilters() {
  const selectedState = viewerClassificationState.value;
  const codexResultStates = selectedState === 'codex_results'
    ? ['needs_review', 'classified', 'not_jewelry']
    : null;
  const unrecognizedStates = selectedState === 'unrecognized'
    ? ['pending', 'failed']
    : null;
  const day = viewerClassificationDay.value || null;
  return {
    classificationEligible: true,
    pathStatus: selectedState === 'missing' ? 'missing' : 'available',
    state: ['missing', 'codex_results', 'unrecognized'].includes(selectedState) ? null : selectedState || null,
    states: codexResultStates || unrecognizedStates,
    day,
    dateFrom: day ? null : viewerClassificationDateFrom.value || null,
    dateTo: day ? null : viewerClassificationDateTo.value || null,
    includeUnknownDate: false,
    categoryId: viewerClassificationCategory.value || null,
    processId: viewerClassificationProcess.value || null,
    conversationId: viewerClassificationGroup.value || null,
    senderQuery: viewerClassificationSender.value.trim() || null,
    runId: viewerClassificationRun.value || null,
  };
}

const CLASSIFICATION_DAY_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function classificationDateValue(date) {
  const parts = Object.fromEntries(
    CLASSIFICATION_DAY_FORMATTER.formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value])
  );
  return [parts.year, parts.month, parts.day].join('-');
}

function shiftClassificationDay(day, offset) {
  const date = new Date(day + 'T12:00:00+08:00');
  date.setUTCDate(date.getUTCDate() + offset);
  return classificationDateValue(date);
}

function latestClassificationDay() {
  return Object.keys(viewerClassificationDayCounts)
    .filter((day) => /^\d{4}-\d{2}-\d{2}$/.test(day))
    .sort()
    .at(-1) || '';
}

function updateClassificationRangeButtons() {
  for (const button of document.querySelectorAll('[data-classification-range]')) {
    button.classList.toggle('active', button.dataset.classificationRange === viewerClassificationRangeMode);
  }
}

function setClassificationDateRange(mode, { reload = true } = {}) {
  const today = classificationDateValue(new Date());
  viewerClassificationRangeMode = mode;
  viewerClassificationDay.value = '';
  if (mode === 'latest') {
    const latest = latestClassificationDay();
    viewerClassificationDay.value = latest;
    viewerClassificationDateFrom.value = '';
    viewerClassificationDateTo.value = '';
  } else if (mode === 'today') {
    viewerClassificationDateFrom.value = today;
    viewerClassificationDateTo.value = today;
  } else if (mode === 'last7') {
    viewerClassificationDateFrom.value = shiftClassificationDay(today, -6);
    viewerClassificationDateTo.value = today;
  } else if (mode === 'all') {
    viewerClassificationDateFrom.value = '';
    viewerClassificationDateTo.value = '';
  }
  updateClassificationRangeButtons();
  if (reload) scheduleClassificationReload();
}

function classificationDayInCurrentRange(day) {
  const filters = getClassificationFilters();
  if (filters.day) return day === filters.day;
  if (!filters.dateFrom && !filters.dateTo) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  return (!filters.dateFrom || day >= filters.dateFrom) && (!filters.dateTo || day <= filters.dateTo);
}
function populateClassificationFilters(result) {
  viewerClassificationConversations = result.manifest?.conversations || [];
  replaceSelectOptions(
    viewerClassificationDay,
    Object.entries(result.dayCounts || {})
      .sort(([left], [right]) => right.localeCompare(left))
      .map(([day, count]) => ({
        id: day,
        name: `${['unknown', 'unknown-date'].includes(day) ? '未知日期' : day} · ${count} 张`,
      })),
    '按日期范围'
  );
  if (!viewerClassificationDateInitialized) {
    viewerClassificationDateInitialized = true;
    setClassificationDateRange('latest', { reload: false });
  }
  replaceSelectOptions(
    viewerClassificationGroup,
    result.manifest?.conversations || [],
    '全部授权群聊',
    'conversationId',
    'displayName'
  );
  replaceSelectOptions(viewerClassificationCategory, jewelryProductCategories, '全部品类');
  replaceSelectOptions(viewerClassificationProcess, jewelryProcesses, '全部工艺');
  replaceSelectOptions(
    viewerClassificationRun,
    (result.runs || []).map((run) => ({
      id: run.runId,
      name: `${new Date(run.createdAt).toLocaleString('zh-CN')} · ${run.status}`,
    })),
    '全部任务'
  );
}

function classificationStateLabel(state) {
  return {
    pending: '等待识别',
    classified: '已分类',
    not_jewelry: '非珠宝',
    needs_review: '待人工复核',
    failed: '识别失败',
    skipped: '已跳过',
  }[state] || state;
}

function createClassificationChoices(items, type, name, selectedIds) {
  const grid = document.createElement('div');
  grid.className = 'classification-choice-grid';
  for (const item of items) {
    const label = document.createElement('label');
    label.className = 'classification-option';
    const input = document.createElement('input');
    input.type = type;
    input.name = name;
    input.value = item.id;
    input.checked = selectedIds.has(item.id);
    label.append(input, document.createTextNode(item.name));
    grid.appendChild(label);
  }
  return grid;
}

function closeSimilarityResults() {
  viewerSimilarityRequestToken += 1;
  viewerSimilarityPanel.classList.add('hidden');
}

function renderSimilarityResults(result) {
  viewerSimilarityList.replaceChildren();
  const items = result?.results || [];
  if (!items.length) {
    const empty = document.createElement('div');
    empty.className = 'viewer-empty';
    empty.textContent = '当前范围没有达到相似度条件的图片';
    viewerSimilarityList.appendChild(empty);
    return;
  }
  for (const item of items) {
    const card = document.createElement('article');
    card.className = 'similarity-item';
    if (item.previewUrl) {
      const image = document.createElement('img');
      image.src = item.previewUrl;
      image.alt = '相似图片 ' + item.imageId;
      image.loading = 'lazy';
      image.addEventListener('click', () => openViewerLightbox(item.previewUrl));
      card.appendChild(image);
    } else {
      const placeholder = document.createElement('div');
      placeholder.className = 'classification-image-placeholder';
      placeholder.textContent = '图片不可用';
      card.appendChild(placeholder);
    }
    const meta = document.createElement('div');
    meta.className = 'similarity-item-meta';
    const title = document.createElement('strong');
    title.textContent = '相似度 ' + Math.max(0, item.score * 100).toFixed(1) + '%';
    const category = item.current?.category?.name || '未分类';
    const processes = (item.current?.processes || []).map((entry) => entry.name || entry.id).join('、') || '未确定工艺';
    const group = item.conversation?.displayNameSnapshot || item.conversation?.username || '-';
    const details = [
      item.day || '未知日期',
      group,
      category + ' · ' + processes,
      'GUID ' + item.imageId,
    ];
    meta.appendChild(title);
    for (const value of details) {
      const line = document.createElement('span');
      line.textContent = value;
      meta.appendChild(line);
    }
    card.appendChild(meta);
    viewerSimilarityList.appendChild(card);
  }
}

async function runSimilaritySearch() {
  if (!viewerSimilarityQuery || !viewerDatasetDir) return;
  const requestToken = ++viewerSimilarityRequestToken;
  viewerSimilarityPanel.classList.remove('hidden');
  viewerSimilarityList.replaceChildren();
  const loading = document.createElement('div');
  loading.className = 'viewer-empty';
  loading.textContent = '正在建立本地向量并检索...';
  viewerSimilarityList.appendChild(loading);
  viewerSimilaritySummary.textContent = '正在使用本地 CLIP 检索';
  const currentFilters = getClassificationFilters();
  const selectedConversation = viewerClassificationConversations.find((entry) =>
    entry.conversationId === viewerClassificationGroup.value
  );
  const allHistory = viewerSimilarityAllHistory.checked;
  const result = await window.exporter.searchJewelrySimilar({
    sources: [{
      datasetDir: viewerDatasetDir,
      conversationUsernames: selectedConversation ? [selectedConversation.username] : null,
    }],
    imageId: viewerSimilarityQuery.imageId || null,
    imagePath: viewerSimilarityQuery.imagePath || null,
    day: allHistory ? null : currentFilters.day,
    dateFrom: allHistory ? null : currentFilters.dateFrom,
    dateTo: allHistory ? null : currentFilters.dateTo,
    topK: 30,
    minScore: 0,
  });
  if (requestToken !== viewerSimilarityRequestToken) return;
  if (!result.ok) {
    viewerSimilaritySummary.textContent = '检索失败';
    await showFriendlyError('相似图片检索失败', result.error || '无法完成本地图片检索');
    return;
  }
  viewerSimilaritySummary.textContent =
    '找到 ' + (result.result?.results?.length || 0) + ' 张 · ' + result.result.modelVersion;
  renderSimilarityResults(result.result);
}

async function chooseSimilarityQueryImage() {
  const imagePath = await window.exporter.pickFile({
    title: '选择珠宝查询图片',
    filters: [{ name: '图片', extensions: ['jpg', 'jpeg', 'png', 'webp', 'avif', 'tif', 'tiff'] }],
  });
  if (!imagePath) return;
  viewerSimilarityQuery = { imagePath };
  await runSimilaritySearch();
}
function renderClassificationCard(item) {
  const annotation = item.annotation || {};
  const card = document.createElement('article');
  card.className = 'classification-card';
  card.dataset.imageId = item.imageId;

  const media = document.createElement('div');
  media.className = 'classification-card-media';
  const showImagePlaceholder = (text) => {
    if (media.querySelector('.classification-image-placeholder')) return;
    const placeholder = document.createElement('div');
    placeholder.className = 'classification-image-placeholder';
    placeholder.textContent = text;
    media.appendChild(placeholder);
  };
  if (item.previewUrl) {
    const image = document.createElement('img');
    image.src = item.previewUrl;
    image.alt = `${item.conversationName}中的珠宝图片`;
    image.loading = 'lazy';
    image.addEventListener('error', () => {
      image.remove();
      showImagePlaceholder('图片加载失败');
    });
    image.addEventListener('click', () => openViewerLightbox(item.previewUrl));
    media.appendChild(image);
  } else {
    showImagePlaceholder(item.pathStatus === 'missing' ? '图片文件缺失' : '图片加载失败');
  }
  const selected = document.createElement('input');
  selected.type = 'checkbox';
  selected.className = 'classification-card-select';
  selected.checked = viewerSelectedClassificationImages.has(item.imageId);
  selected.disabled = !item.classificationEligible || item.pathStatus !== 'available';
  selected.setAttribute('aria-label', '选择图片');
  selected.addEventListener('change', () => {
    if (selected.checked) viewerSelectedClassificationImages.add(item.imageId);
    else viewerSelectedClassificationImages.delete(item.imageId);
    updateClassificationSummary();
  });
  const state = document.createElement('span');
  state.className = `classification-state ${annotation.state || 'pending'}`;
  state.textContent = item.pathStatus === 'missing'
    ? '图片缺失'
    : classificationStateLabel(annotation.state || 'pending');
  media.append(selected, state);

  const form = document.createElement('div');
  form.className = 'classification-card-form';
  const record = item.classificationRecord || {};
  const trace = record.source || {};
  const sourceMessage = trace.message || {};
  const meta = document.createElement('div');
  meta.className = 'classification-card-meta';
  const source = document.createElement('span');
  source.textContent = item.conversationName + ' - ' + (item.senderName || '未知发送人');
  const time = document.createElement('span');
  time.textContent = item.datetime || sourceMessage.datetime || '';
  meta.append(source, time);
  form.appendChild(meta);

  const resultSummary = document.createElement('section');
  resultSummary.className = 'classification-result-summary';
  resultSummary.setAttribute('aria-label', '当前识别结果');
  const resultHeading = document.createElement('div');
  resultHeading.className = 'classification-result-heading';
  const resultTitle = document.createElement('h3');
  resultTitle.textContent = '当前识别结果';
  const resultSource = document.createElement('span');
  resultSource.textContent = annotation.source === 'manual'
    ? '人工确认'
    : annotation.source === 'codex' ? 'Codex 识别' : '尚未识别';
  resultHeading.append(resultTitle, resultSource);
  const resultGrid = document.createElement('div');
  resultGrid.className = 'classification-result-grid';
  const categoryName = jewelryProductCategories.find((item) => item.id === annotation.productCategory?.id)?.name;
  const processNames = (annotation.processes?.ids || []).map((processId) =>
    jewelryProcesses.find((item) => item.id === processId)?.name || processId
  );
  const notJewelry = annotation.jewelryDecision === 'not_jewelry';
  const resultRows = [
    ['判断', annotation.jewelryDecision === 'jewelry' ? '珠宝' : notJewelry ? '非珠宝' : '待确认'],
    ['品类', notJewelry ? '不适用' : categoryName || '待确认'],
    ['工艺', notJewelry
      ? '不适用'
      : processNames.length ? processNames.join('、')
        : annotation.processes?.decision === 'none' ? '确认无匹配工艺' : '待确认'],
  ];
  for (const [label, value] of resultRows) {
    const resultItem = document.createElement('div');
    const resultLabel = document.createElement('span');
    const resultValue = document.createElement('strong');
    resultLabel.textContent = label;
    resultValue.textContent = value;
    resultItem.append(resultLabel, resultValue);
    resultGrid.appendChild(resultItem);
  }
  resultSummary.append(resultHeading, resultGrid);
  form.appendChild(resultSummary);

  const traceGrid = document.createElement('div');
  traceGrid.className = 'classification-trace';
  const accountText = [trace.account?.displayName, trace.account?.wxid].filter(Boolean).join(' / ') || '-';
  const conversationText = [trace.conversation?.displayNameSnapshot, trace.conversation?.username].filter(Boolean).join(' / ') || '-';
  const senderText = [sourceMessage.senderName, sourceMessage.senderWxid].filter(Boolean).join(' / ') +
    (sourceMessage.isSelf ? ' - 本人发送' : ' - 他人发送');
  const sourceIdText = [sourceMessage.sourceLocalId, sourceMessage.sourceServerId].filter((value) => value != null).join(' / ') || '-';
  const traceRows = [
    ['GUID', item.imageId],
    ['源图片 ID', item.sourceImageId || '-'],
    ['账号', accountText],
    ['群聊', conversationText],
    ['发送人', senderText],
    ['消息时间', sourceMessage.datetime || sourceMessage.createTime || '-'],
    ['消息 ID', sourceMessage.messageId || item.messageId || '-'],
    ['本地 / 服务器 ID', sourceIdText],
  ];
  for (const [label, value] of traceRows) {
    const row = document.createElement('p');
    const key = document.createElement('strong');
    const text = document.createElement('span');
    key.textContent = label;
    text.textContent = String(value);
    row.append(key, text);
    traceGrid.appendChild(row);
  }
  form.appendChild(traceGrid);

  const decisionField = document.createElement('div');
  decisionField.className = 'classification-field';
  const decisionLabel = document.createElement('strong');
  decisionLabel.textContent = '判断*';
  const decisionChoices = createClassificationChoices(
    [{ id: 'jewelry', name: '珠宝' }, { id: 'not_jewelry', name: '非珠宝' }],
    'radio',
    'jewelry-decision-' + item.imageId,
    new Set(['jewelry', 'not_jewelry'].includes(annotation.jewelryDecision) ? [annotation.jewelryDecision] : [])
  );
  decisionField.append(decisionLabel, decisionChoices);
  form.appendChild(decisionField);

  const textField = document.createElement('div');
  textField.className = 'classification-field';
  const textLabel = document.createElement('strong');
  textLabel.textContent = '图片文字';
  const recognizedText = document.createElement('textarea');
  recognizedText.value = annotation.recognizedText?.value || '';
  recognizedText.placeholder = '未识别到图片文字';
  textField.append(textLabel, recognizedText);
  form.appendChild(textField);

  const categoryField = document.createElement('div');
  categoryField.className = 'classification-field';
  const categoryLabel = document.createElement('strong');
  categoryLabel.textContent = '品类*';
  const categoryChoices = createClassificationChoices(
    jewelryProductCategories,
    'radio',
    `category-${item.imageId}`,
    new Set(annotation.productCategory?.id ? [annotation.productCategory.id] : [])
  );
  categoryField.append(categoryLabel, categoryChoices);
  form.appendChild(categoryField);

  const processField = document.createElement('div');
  processField.className = 'classification-field';
  const processLabel = document.createElement('strong');
  processLabel.textContent = '工艺';
  const processChoices = createClassificationChoices(
    jewelryProcesses,
    'checkbox',
    `process-${item.imageId}`,
    new Set(annotation.processes?.ids || [])
  );
  const noProcess = document.createElement('label');
  noProcess.className = 'classification-option';
  const noProcessInput = document.createElement('input');
  noProcessInput.type = 'checkbox';
  noProcessInput.checked = annotation.processes?.decision === 'none';
  noProcess.append(noProcessInput, document.createTextNode('确认无匹配工艺'));
  processChoices.appendChild(noProcess);
  for (const input of processChoices.querySelectorAll('input[type="checkbox"]')) {
    if (input === noProcessInput) continue;
    input.addEventListener('change', () => {
      if (input.checked) noProcessInput.checked = false;
    });
  }
  noProcessInput.addEventListener('change', () => {
    if (noProcessInput.checked) {
      for (const input of processChoices.querySelectorAll('input[type="checkbox"]')) {
        if (input !== noProcessInput) input.checked = false;
      }
    }
  });
  processField.append(processLabel, processChoices);
  form.appendChild(processField);
  const updateDetailVisibility = () => {
    const jewelryDecision = decisionChoices.querySelector('input:checked')?.value || null;
    const hidden = jewelryDecision !== 'jewelry';
    categoryField.classList.toggle('hidden', hidden);
    processField.classList.toggle('hidden', hidden);
  };
  for (const input of decisionChoices.querySelectorAll('input')) {
    input.addEventListener('change', updateDetailVisibility);
  }
  updateDetailVisibility();

  const context = record.context || {};
  {
    const contextDetails = document.createElement('details');
    const summary = document.createElement('summary');
    summary.textContent = '前后文 ' + (context.beforeCount || 0) + ' + ' + (context.afterCount || 0) +
      (context.complete ? '' : ' - 不完整');
    contextDetails.appendChild(summary);
    const appendContext = (label, messages) => {
      const heading = document.createElement('strong');
      heading.className = 'classification-context-heading';
      heading.textContent = label;
      contextDetails.appendChild(heading);
      for (const message of messages || []) {
        const line = document.createElement('p');
        line.className = 'classification-context-line';
        const sender = [message.senderName, message.senderWxid].filter(Boolean).join(' / ');
        line.textContent = '距图片 ' + message.distance + '条 - ' + sender + ' - ' +
          (message.datetime || message.createTime || '-') + ' - ' + (message.messageId || '-') + '\n' + message.text;
        contextDetails.appendChild(line);
      }
    };
    appendContext('前文（远到近）', context.before);
    appendContext('后文（近到远）', context.after);
    form.appendChild(contextDetails);
  }
  if (annotation.reason) {
    const reason = document.createElement('p');
    reason.className = 'classification-reason';
    reason.textContent = annotation.reason;
    form.appendChild(reason);
  }

  const similar = document.createElement('button');
  similar.type = 'button';
  similar.className = 'btn secondary classification-card-save';
  similar.textContent = '查找相似';
  similar.addEventListener('click', () => {
    viewerSimilarityQuery = {
      imageId: item.imageId,
      conversationUsername: item.conversationUsername,
    };
    void runSimilaritySearch();
  });
  form.appendChild(similar);

  const save = document.createElement('button');
  save.type = 'button';
  save.className = 'btn primary classification-card-save';
  save.textContent = annotation.state === 'needs_review'
    ? '完成人工复核'
    : annotation.manualLocked ? '保存人工修订' : '确认或修订结果';
  save.addEventListener('click', async () => {
    const jewelryDecision = decisionChoices.querySelector('input:checked')?.value || null;
    if (!jewelryDecision) {
      await showFriendlyError('请选择图片判断', '请确认这张图片是珠宝还是非珠宝。');
      return;
    }
    const categoryId = jewelryDecision === 'jewelry'
      ? categoryChoices.querySelector('input:checked')?.value || null
      : null;
    const processIds = jewelryDecision === 'jewelry'
      ? [...processChoices.querySelectorAll('input[type="checkbox"]:checked')]
        .filter((input) => input !== noProcessInput)
        .map((input) => input.value)
      : [];
    save.disabled = true;
    const result = await window.exporter.saveJewelryClassification({
      datasetDir: viewerDatasetDir,
      imageId: item.imageId,
      jewelryDecision,
      categoryId,
      processIds,
      processDecision: jewelryDecision === 'jewelry'
        ? (noProcessInput.checked ? 'none' : 'selected')
        : 'not_applicable',
      recognizedText: recognizedText.value,
    });
    save.disabled = false;
    if (!result.ok) {
      await showFriendlyError('分类保存失败', result.error || '无法保存人工分类');
      return;
    }
    viewerSelectedClassificationImages.delete(item.imageId);
    invalidateClassificationReviewCache();
    await loadClassificationReview();
  });
  form.appendChild(save);
  card.append(media, form);
  return card;
}

function renderClassificationItems() {
  viewerClassificationObserver?.disconnect();
  viewerClassificationList.replaceChildren();
  const selectedDay = viewerClassificationDay.value;
  const dayEntries = Object.entries(viewerClassificationDayCounts)
    .filter(([day]) => classificationDayInCurrentRange(day))
    .sort(([left], [right]) => right.localeCompare(left));
  if (!dayEntries.length) {
    const empty = document.createElement('div');
    empty.className = 'viewer-empty';
    empty.textContent = '当前筛选条件下没有图片';
    viewerClassificationList.appendChild(empty);
    return;
  }
  viewerClassificationObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) void loadClassificationDay(entry.target.dataset.day);
    }
  }, { root: viewerClassificationList, rootMargin: '600px 0px' });
  for (const [day, total] of dayEntries) {
    const state = {
      items: [],
      total: Number(total) || 0,
      hasMore: true,
      loading: false,
      error: null,
      renderedCount: 0,
    };
    viewerClassificationDayLoads.set(day, state);
    const group = document.createElement('details');
    group.className = 'classification-day-group';
    group.open = viewerExpandedClassificationDays.has(day);
    const heading = document.createElement('summary');
    heading.className = 'classification-day-heading';
    const dayLabel = document.createElement('time');
    const unknownDay = ['unknown', 'unknown-date'].includes(day);
    dayLabel.textContent = unknownDay ? '未知日期' : day;
    if (!unknownDay) dayLabel.dateTime = day;
    const count = document.createElement('span');
    count.textContent = `${state.total} 张`;
    const selectDay = document.createElement('button');
    selectDay.type = 'button';
    selectDay.className = 'classification-day-select';
    selectDay.textContent = '全选当天';
    selectDay.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      void selectClassificationImageIds({ ...getClassificationFilters(), day }, selectDay);
    });
    const classifyDay = document.createElement('button');
    classifyDay.type = 'button';
    classifyDay.className = 'classification-day-select';
    classifyDay.textContent = '识别当天';
    classifyDay.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      void classifyPendingImages({
        ...getClassificationFilters(),
        day,
        dateFrom: null,
        dateTo: null,
      });
    });
    heading.append(dayLabel, count, selectDay, classifyDay);
    group.appendChild(heading);
    const dayItems = document.createElement('div');
    dayItems.className = 'classification-day-items';
    group.appendChild(dayItems);
    const sentinel = document.createElement('div');
    sentinel.className = 'classification-load-sentinel';
    sentinel.dataset.day = day;
    sentinel.setAttribute('role', 'status');
    group.appendChild(sentinel);
    Object.assign(state, { group, count, dayItems, sentinel });
    group.addEventListener('toggle', () => {
      if (group.open) {
        viewerExpandedClassificationDays.add(day);
        void loadClassificationDay(day);
      } else {
        viewerExpandedClassificationDays.delete(day);
        viewerClassificationObserver?.unobserve(sentinel);
      }
    });
    viewerClassificationList.appendChild(group);
    if (group.open) void loadClassificationDay(day);
  }
}

function renderClassificationDayState(day) {
  const state = viewerClassificationDayLoads.get(day);
  if (!state) return;
  for (const item of state.items.slice(state.renderedCount)) {
    state.dayItems.appendChild(renderClassificationCard(item));
  }
  state.renderedCount = state.items.length;
  state.count.textContent = state.items.length && state.hasMore
    ? `${state.items.length} / ${state.total} 张`
    : `${state.total} 张`;
  state.sentinel.textContent = state.error || (state.loading ? '正在加载...' : '');
  viewerClassificationObserver?.unobserve(state.sentinel);
  if (state.group.open && state.hasMore && !state.loading && !state.error) {
    viewerClassificationObserver?.observe(state.sentinel);
  }
}

async function loadClassificationDay(day) {
  const state = viewerClassificationDayLoads.get(day);
  if (!state || state.loading || !state.hasMore) return;
  state.loading = true;
  state.error = null;
  renderClassificationDayState(day);
  const loadVersion = viewerClassificationLoadVersion;
  const result = await window.exporter.listJewelryImages({
    datasetDir: viewerDatasetDir,
    filters: { ...getClassificationFilters(), day },
    offset: state.items.length,
    limit: viewerClassificationLimit,
  });
  if (loadVersion !== viewerClassificationLoadVersion) return;
  state.loading = false;
  if (!result.ok) {
    state.error = result.error || '加载失败';
    renderClassificationDayState(day);
    return;
  }
  const knownImageIds = new Set(state.items.map((item) => item.imageId));
  for (const item of result.result.items || []) {
    if (!knownImageIds.has(item.imageId)) state.items.push(item);
  }
  state.total = Number(result.result.total) || 0;
  state.hasMore = Boolean(result.result.hasMore);
  renderClassificationDayState(day);
  updateClassificationSummary();
}

function syncClassificationSelectionControls() {
  for (const input of viewerClassificationList.querySelectorAll('.classification-card-select')) {
    input.checked = viewerSelectedClassificationImages.has(input.closest('.classification-card')?.dataset.imageId);
  }
  updateClassificationSummary();
}

async function selectClassificationImageIds(filters, button) {
  const originalLabel = button.textContent;
  const loadVersion = viewerClassificationLoadVersion;
  button.disabled = true;
  button.textContent = '选择中...';
  let offset = 0;
  let matched = 0;
  try {
    while (true) {
      const result = await window.exporter.listJewelryImages({
        datasetDir: viewerDatasetDir,
        filters,
        offset,
        limit: 5000,
        idsOnly: true,
      });
      if (loadVersion !== viewerClassificationLoadVersion) return;
      if (!result.ok) {
        await showFriendlyError('选择图片失败', result.error || '无法读取当前图片范围');
        return;
      }
      const items = result.result.items || [];
      for (const item of items) {
        viewerSelectedClassificationImages.add(item.imageId);
      }
      matched += items.length;
      if (!result.result.hasMore || !items.length) break;
      offset += items.length;
    }
    if (!matched) {
      await showFriendlyError('没有可选图片', '当前范围没有可用于识别的图片。');
      return;
    }
    syncClassificationSelectionControls();
  } finally {
    button.disabled = false;
    button.textContent = originalLabel;
  }
}

function updateClassificationSummary() {
  const loaded = [...viewerClassificationDayLoads.values()]
    .reduce((count, state) => count + state.items.length, 0);
  const needsReview = Number(viewerClassificationStateCounts.needs_review) || 0;
  const classified = Number(viewerClassificationStateCounts.classified) || 0;
  const notJewelry = Number(viewerClassificationStateCounts.not_jewelry) || 0;
  viewerClassificationSummary.textContent =
    `${viewerClassificationTotal} 张图片 · 已加载 ${loaded} · 待复核 ${needsReview} · 已分类 ${classified} · 非珠宝 ${notJewelry} · ${viewerSelectedClassificationImages.size} 张已选择`;
}

function invalidateClassificationReviewCache() {
  viewerClassificationLoadedDatasetDir = '';
  viewerClassificationLoadedFilterSignature = '';
}

async function loadClassificationReview({ resetExpanded = false } = {}) {
  if (!viewerDatasetDir || !(await ensureJewelryTaxonomy())) return;
  const requestToken = ++viewerClassificationRequestToken;
  const filters = getClassificationFilters();
  const result = await window.exporter.listJewelryImages({
    datasetDir: viewerDatasetDir,
    filters,
    offset: 0,
    limit: 1,
  });
  if (requestToken !== viewerClassificationRequestToken) return;
  if (!result.ok) {
    await showFriendlyError('数据集读取失败', result.error || '无法读取图片分类数据');
    return;
  }
  viewerClassificationRuns = result.result.runs || [];
  viewerClassificationTotal = Number(result.result.total) || 0;
  viewerClassificationStateCounts = result.result.stateCounts || {};
  viewerClassificationDayCounts = result.result.dayCounts || {};
  viewerClassificationLoadVersion += 1;
  viewerClassificationDayLoads.clear();
  if (resetExpanded) viewerExpandedClassificationDays.clear();
  populateClassificationFilters(result.result);
  if (JSON.stringify(filters) !== JSON.stringify(getClassificationFilters())) {
    await loadClassificationReview({ resetExpanded: true });
    return;
  }
  const selectedDay = viewerClassificationDay.value;
  if (selectedDay && viewerClassificationDayCounts[selectedDay]) {
    viewerExpandedClassificationDays.add(selectedDay);
  }
  for (const day of [...viewerExpandedClassificationDays]) {
    if (!viewerClassificationDayCounts[day]) viewerExpandedClassificationDays.delete(day);
  }
  updateClassificationSummary();
  renderClassificationItems();
  viewerClassificationLoadedDatasetDir = viewerDatasetDir;
  viewerClassificationLoadedFilterSignature = JSON.stringify(getClassificationFilters());
}

async function openClassificationReview() {
  if (!viewerDatasetDir) {
    await showFriendlyError('尚未选择数据集', '请先选择目录并确认读取一个群聊。');
    return;
  }
  if (!(await ensureJewelryTaxonomy())) return;
  renderBatchProcessOptions();
  viewerClassificationState.value = '';
  if (viewerClassificationDateDatasetDir !== viewerDatasetDir) {
    viewerClassificationDateDatasetDir = viewerDatasetDir;
    viewerClassificationDateInitialized = false;
    viewerClassificationRangeMode = 'latest';
    viewerClassificationDay.value = '';
    viewerClassificationDateFrom.value = '';
    viewerClassificationDateTo.value = '';
  }
  viewerClassificationPanel.classList.remove('hidden');
  if (
    viewerClassificationLoadedDatasetDir === viewerDatasetDir &&
    viewerClassificationLoadedFilterSignature === JSON.stringify(getClassificationFilters())
  ) {
    return;
  }
  await loadClassificationReview({ resetExpanded: true });
}

function closeClassificationReview() {
  viewerClassificationPanel.classList.add('hidden');
  closeSimilarityResults();
}

function scheduleClassificationReload() {
  clearTimeout(viewerClassificationFilterTimer);
  viewerClassificationFilterTimer = setTimeout(() => void loadClassificationReview({ resetExpanded: true }), 180);
}

async function applyBatchProcesses() {
  const imageIds = [...viewerSelectedClassificationImages];
  if (!imageIds.length) {
    await showFriendlyError('未选择图片', '请先勾选要批量设置工艺的图片。');
    return;
  }
  const processIds = [...viewerBatchProcesses.querySelectorAll('input:checked')].map((input) => input.value);
  const result = await window.exporter.batchSaveJewelryProcesses({
    datasetDir: viewerDatasetDir,
    imageIds,
    processIds,
    processDecision: viewerBatchNoProcess.checked ? 'none' : 'selected',
  });
  if (!result.ok) {
    await showFriendlyError('批量保存失败', result.error || '无法批量保存工艺');
    return;
  }
  viewerSelectedClassificationImages = new Set();
  invalidateClassificationReviewCache();
  await loadClassificationReview();
}

async function submitPreparedClassification(preparation) {
  if (!(await ensureJewelryCodexConsent(preparation))) return;
  const result = await window.exporter.retryJewelryClassification({
    datasetDir: viewerDatasetDir,
    imageIds: preparation.imageIds,
    eligibleStates: preparation.eligibleStates,
    filters: preparation.filters || {},
  });
  if (!result.ok) {
    await showFriendlyError('提交失败', result.error || '无法创建 Codex 分类任务');
    return;
  }
  setViewerSyncStatus('已提交 ' + preparation.targetCount + ' 张图片进行识别', 'syncing');
}

async function prepareClassificationRequest(imageIds, eligibleStates = null, filters = getClassificationFilters()) {
  const response = await window.exporter.prepareJewelryClassification({
    datasetDir: viewerDatasetDir,
    imageIds,
    eligibleStates,
    filters,
  });
  if (!response.ok) {
    await showFriendlyError('准备识别失败', response.error || '无法读取待分类图片');
    return null;
  }
  if (!response.result?.targetCount) {
    await showFriendlyError('没有待识别图片', '当前日期和群聊范围内没有可提交的真实图片。');
    return null;
  }
  return { ...response.result, filters };
}

async function classifyPendingImages(filters = getClassificationFilters()) {
  const preparation = await prepareClassificationRequest(null, ['pending', 'failed'], filters);
  if (preparation) await submitPreparedClassification(preparation);
}

async function retrySelectedClassifications() {
  const imageIds = [...viewerSelectedClassificationImages];
  if (!imageIds.length) {
    await showFriendlyError('未选择图片', '请先勾选要重试识别的图片。');
    return;
  }
  const preparation = await prepareClassificationRequest(imageIds, null, getClassificationFilters());
  if (preparation) await submitPreparedClassification(preparation);
}

document.getElementById('pickWxDir').addEventListener('click', () => {
  pickDirectory('选择 xwechat_files 目录', wxDirInput);
});

document.getElementById('pickOutputDir').addEventListener('click', () => {
  pickDirectory('选择导出目录', outputDirInput);
});

outputDirInput.addEventListener('change', () => {
  resetOutputDirNonEmptyAck();
  saveSettings();
});

wxDirInput.addEventListener('change', () => {
  saveSettings();
  void validateWxDir(wxDirInput.value.trim());
});

refreshAccountsBtn.addEventListener('click', () => {
  void refreshWxAccountList();
});

resetDecryptBtn?.addEventListener('click', () => {
  void handleResetAccountDecryptData();
});

resetAllToolTracesBtn?.addEventListener('click', () => {
  void handleResetAllToolTraces();
});

autoDetectBtn.addEventListener('click', async () => {
  autoDetectBtn.disabled = true;
  autoDetectBtn.textContent = '检测中…';
  const result = await window.exporter.detectWxPaths();
  autoDetectBtn.disabled = false;
  autoDetectBtn.textContent = '自动检测';

  if (!result.ok) {
    await showFriendlyError('检测失败', result.error || '无法扫描常见不信目录');
    return;
  }

  const paths = result.paths || [];
  if (!paths.length) {
    wxDirHint.textContent = '未在常见位置找到不信数据，请手动浏览选择';
    wxDirHint.className = 'hint';
    return;
  }

  const detected = paths[0];
  wxDirInput.value = detected.path;
  saveSettings();
  await validateWxDir(detected.path);
});

scanBtn.addEventListener('click', () => scanConversations());

disclaimerAccepted.addEventListener('change', () => {
  welcomeNextBtn.disabled = !disclaimerAccepted.checked;
  saveSettings();
  updateStepNavUI();
});

stepEls.forEach((el) => {
  el.addEventListener('click', () => {
    void navigateToStep(Number(el.dataset.step));
  });
});

appNoticeBtn.addEventListener('click', confirmAppNotice);
appNoticeCancelBtn.addEventListener('click', dismissAppNotice);
appNotice.querySelector('[data-notice-dismiss]').addEventListener('click', dismissAppNotice);
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !appNotice.classList.contains('hidden')) {
    dismissAppNotice();
    return;
  }
  if (event.key === 'Escape' && convRangeModal && !convRangeModal.classList.contains('hidden')) {
    hideConvRangeModal();
  }
});

welcomeNextBtn.addEventListener('click', () => {
  if (!disclaimerAccepted.checked) return;
  saveSettings();
  setStep(2);
  void refreshConversationCacheHint();
});

accountBackBtn.addEventListener('click', () => setStep(1));
exportBackBtn.addEventListener('click', () => setStep(3));

cancelScanBtn.addEventListener('click', async () => {
  userCancelledScan = true;
  await window.exporter.cancelScan();
  scanRunning = false;
  updateStepNavUI();
  scanBtn.disabled = false;
  scanBtn.textContent = currentConversationCache ? '重新扫描' : '扫描会话';
  hideScanToast();
});
backBtn.addEventListener('click', () => setStep(2));
toExportBtn.addEventListener('click', async () => {
  if (!getSelectedUsernames().length) {
    await showFriendlyError('未选择会话', '请至少选择一个要导出的会话。');
    return;
  }
  setStep(4);
  void refreshSelectionSummary({ highlight: true });
});
startBtn.addEventListener('click', startExport);
cancelBtn.addEventListener('click', async () => {
  await window.exporter.cancelExport();
});
selectAllBtn.addEventListener('click', () => setConvSelection(true));
selectNoneBtn.addEventListener('click', () => setConvSelection(false));
batchTimeBtn.addEventListener('click', () => {
  const selected = getSelectedUsernames();
  void openConvRangeDialog({ mode: 'batch', usernames: selected });
});
convSearch.addEventListener('input', () => filterConversations());

if (convTypeFilterEl) {
  convTypeFilterEl.addEventListener('click', (event) => {
    const btn = event.target.closest('.conv-type-btn');
    if (!btn) return;
    convTypeFilter = btn.dataset.type || 'all';
    updateConvTypeFilterUI();
    applyConvFilters();
  });
}

if (convRangeModal) {
  for (const input of convRangeModal.querySelectorAll('input[name="convRangeMode"]')) {
    input.addEventListener('change', () => updateConvRangePickerVisibility());
  }
  convRangeStart?.addEventListener('change', () => {
    setConvRangeDateLimits();
    scheduleConvRangeCountHint();
  });
  convRangeEnd?.addEventListener('change', () => {
    setConvRangeDateLimits();
    scheduleConvRangeCountHint();
  });
  for (const btn of convRangeModal.querySelectorAll('.conv-range-preset')) {
    btn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      applyConvRangePreset(btn.dataset.preset);
    });
  }
  convRangeCancelBtn?.addEventListener('click', hideConvRangeModal);
  convRangeConfirmBtn?.addEventListener('click', () => void confirmConvRangeDialog());
  convRangeModal.querySelector('[data-conv-range-dismiss]')?.addEventListener('click', hideConvRangeModal);
}

openOutputBtn.addEventListener('click', () => {
  if (lastOutputDir) {
    window.exporter.openPath(lastOutputDir);
  }
});

restartBtn.addEventListener('click', () => {
  setStep(2);
  setProgress(0, '等待开始');
  logEl.textContent = '';
  outputGuide.innerHTML = '';
});

document.querySelectorAll('input[name="format"]').forEach((input) => {
  input.addEventListener('change', () => {
    saveSettings();
    void refreshSelectionSummary();
  });
});

voiceTranscriptionInput?.addEventListener('change', () => {
  saveSettings();
  void refreshSelectionSummary({ highlight: true });
});

for (const input of [recordsStartYear, recordsStartMonth, recordsStartDay]) {
  input?.addEventListener('input', () => {
    input.value = input.value.replace(/\D/g, '').slice(0, input.maxLength);
    recordsStartDateControl?.classList.remove('invalid');
    if (clearRecordsStartTimeBtn) clearRecordsStartTimeBtn.disabled = !getRecordsStartDateValue();
  });
  input?.addEventListener('change', () => {
    if (input !== recordsStartYear && /^\d$/.test(input.value)) input.value = `0${input.value}`;
    const parts = [recordsStartYear.value, recordsStartMonth.value, recordsStartDay.value];
    if (parts.every(Boolean) || parts.every((part) => !part)) saveRecordsStartTimeForAccount();
  });
}
clearRecordsStartTimeBtn?.addEventListener('click', () => {
  setRecordsStartDateValue('');
  saveRecordsStartTimeForAccount();
  recordsStartYear.focus();
});
browseRecordsBtn?.addEventListener('click', () => void openRecordViewer());
pickAccountDatasetBtn?.addEventListener('click', () => void pickAccountDatasetDirectory());
closeViewerBtn?.addEventListener('click', closeRecordViewer);
viewerRefreshBtn?.addEventListener('click', async () => {
  if (!viewerGroupLoadConfirmed) {
    await showFriendlyError('尚未确认群聊', '请先点进一个群聊并确认读取，再刷新本机数据。');
    return;
  }
  await syncViewerLatest();
});
viewerGroupSearch?.addEventListener('input', renderViewerGroups);
viewerMemberSearch?.addEventListener('input', renderViewerMembers);
viewerLoadOlderBtn?.addEventListener('click', () => void loadViewerMessages({ older: true }));
viewerPickDatasetBtn?.addEventListener('click', () => void pickViewerDatasetDirectory());
viewerNoteUpdateBtn?.addEventListener('click', () => void startViewerNoteHydration());
viewerOpenReviewBtn?.addEventListener('click', () => void openClassificationReview());
viewerCloseReviewBtn?.addEventListener('click', closeClassificationReview);
viewerApplyBatchProcessesBtn?.addEventListener('click', () => void applyBatchProcesses());
viewerSelectCurrentClassificationBtn?.addEventListener('click', () => {
  void selectClassificationImageIds(getClassificationFilters(), viewerSelectCurrentClassificationBtn);
});
viewerClearClassificationSelectionBtn?.addEventListener('click', () => {
  viewerSelectedClassificationImages.clear();
  syncClassificationSelectionControls();
});
viewerRetryClassificationBtn?.addEventListener('click', () => void classifyPendingImages());
viewerRetrySelectedClassificationBtn?.addEventListener('click', () => void retrySelectedClassifications());
viewerUploadSimilarityBtn?.addEventListener('click', () => void chooseSimilarityQueryImage());
viewerCloseSimilarityBtn?.addEventListener('click', closeSimilarityResults);
viewerRefreshSimilarityBtn?.addEventListener('click', () => void runSimilaritySearch());
viewerSimilarityAllHistory?.addEventListener('change', () => void runSimilaritySearch());
viewerCancelClassificationBtn?.addEventListener('click', async () => {
  await window.exporter.cancelJewelryClassification();
  setViewerSyncStatus('已请求取消图片识别', 'idle');
});
viewerLightboxClose?.addEventListener('click', closeViewerLightbox);
viewerLightbox?.addEventListener('click', (event) => {
  if (event.target === viewerLightbox) closeViewerLightbox();
});
viewerAutoSync?.addEventListener('change', () => {
  if (viewerAutoSync.checked && viewerGroupLoadConfirmed) void checkViewerDataStatus();
  else if (viewerAutoSync.checked) setViewerSyncStatus('尚未读取群聊数据', 'idle');
  else setViewerSyncStatus('自动检查已暂停', 'idle');
  renderViewerNoteHydration();
});
viewerSelectAllMembers?.addEventListener('change', () => {
  viewerSelectedMembers = viewerSelectAllMembers.checked ? null : new Set();
  saveCurrentViewerSyncOption();
  renderViewerMembers();
  scheduleViewerReload({ syncDataset: false });
});
viewerSelectAllGroups?.addEventListener('change', () => {
  viewerSelectedGroups = viewerSelectAllGroups.checked
    ? new Set(getViewerGroups().map((group) => group.username))
    : new Set();
  renderViewerGroups();
  updateViewerExportState();
});
for (const button of viewerTypeFilter?.querySelectorAll('[data-viewer-type]') || []) {
  button.addEventListener('click', () => {
    const nextImagesOnly = button.dataset.viewerType === 'images';
    if (viewerImagesOnly === nextImagesOnly) return;
    viewerImagesOnly = nextImagesOnly;
    for (const item of viewerTypeFilter.querySelectorAll('[data-viewer-type]')) {
      item.classList.toggle('active', item === button);
    }
    renderViewerMessages();
  });
}
viewerStartDate?.addEventListener('change', () => {
  saveCurrentViewerSyncOption();
  scheduleViewerReload();
});
viewerEndDate?.addEventListener('change', () => {
  saveCurrentViewerSyncOption();
  scheduleViewerReload();
});
viewerSyncText?.addEventListener('change', () => {
  saveCurrentViewerSyncOption();
  scheduleViewerReload();
});
viewerSyncImages?.addEventListener('change', () => {
  saveCurrentViewerSyncOption();
  renderViewerNoteHydration();
  scheduleViewerReload();
});
viewerBatchNoProcess?.addEventListener('change', () => {
  if (viewerBatchNoProcess.checked) {
    for (const input of viewerBatchProcesses.querySelectorAll('input')) input.checked = false;
  }
});
for (const filter of [
  viewerClassificationState,
  viewerClassificationGroup,
  viewerClassificationCategory,
  viewerClassificationProcess,
  viewerClassificationRun,
]) {
  filter?.addEventListener('change', scheduleClassificationReload);
}
viewerClassificationDay?.addEventListener('change', () => {
  viewerClassificationRangeMode = viewerClassificationDay.value ? 'single' : 'custom';
  if (viewerClassificationDay.value) {
    viewerClassificationDateFrom.value = '';
    viewerClassificationDateTo.value = '';
  }
  updateClassificationRangeButtons();
  scheduleClassificationReload();
});
for (const button of document.querySelectorAll('[data-classification-range]')) {
  button.addEventListener('click', () => setClassificationDateRange(button.dataset.classificationRange));
}
viewerClassificationApplyDatesBtn?.addEventListener('click', async () => {
  if (
    viewerClassificationDateFrom.value &&
    viewerClassificationDateTo.value &&
    viewerClassificationDateFrom.value > viewerClassificationDateTo.value
  ) {
    await showFriendlyError('日期范围无效', '开始日期不能晚于结束日期。');
    return;
  }
  viewerClassificationRangeMode = 'custom';
  viewerClassificationDay.value = '';
  updateClassificationRangeButtons();
  scheduleClassificationReload();
});
viewerClassificationSender?.addEventListener('input', scheduleClassificationReload);
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  if (!viewerLightbox.classList.contains('hidden')) closeViewerLightbox();
  else if (!viewerSimilarityPanel.classList.contains('hidden')) closeSimilarityResults();
  else if (!viewerClassificationPanel.classList.contains('hidden')) closeClassificationReview();
  else if (viewerIsOpen) closeRecordViewer();
});

window.exporter.onJewelryProgress((event) => {
  if (event.phase === 'viewer-refresh') {
    if (event.datasetDir && event.datasetDir !== viewerDatasetDir) return;
    if (event.username && event.username !== viewerSelectedGroup?.username) return;
    if (!event.message) return;
    const state = event.state === 'warning'
      ? 'warning'
      : event.state === 'ready' ? 'ready' : 'syncing';
    setViewerSyncStatus(event.message, state);
    appendViewerProgressLog(event.message, state === 'warning' ? 'warning' : 'idle');
  } else if (event.phase === 'note-hydration') {
    if (event.datasetDir && event.datasetDir !== viewerDatasetDir) return;
    if (event.username && event.username !== viewerSelectedGroup?.username) return;
    if (event.subphase === 'local-start' || event.subphase === 'local-done') {
      viewerNoteHydrationRunning = true;
      viewerNoteHydrationActiveStage = event.subphase === 'local-start' ? 'local' : 'resource';
    }
    if (event.subphase?.startsWith('resource-')) {
      viewerNoteHydrationRunning = true;
      viewerNoteHydrationActiveStage = 'resource';
    }
    if (event.subphase === 'done') {
      viewerNoteHydrationRunning = false;
      viewerNoteHydrationActiveStage = 'done';
      if (event.summary) viewerNoteHydrationSummaryData = event.summary;
    }
    renderViewerNoteHydration();
    const eventMessage = event.message || '';
    if (eventMessage) {
      const isWarning =
        ['resource-error', 'resource-unavailable'].includes(event.subphase) ||
        event.subphase === 'done' && Number(event.unresolvedCount) > 0;
      setViewerSyncStatus(
        eventMessage,
        isWarning ? 'warning' : event.subphase === 'done' ? 'ready' : 'syncing'
      );
      appendViewerProgressLog(eventMessage, isWarning ? 'warning' : 'idle');
    }
  } else if (event.phase === 'dataset-sync' || event.phase === 'image-resolve') {
    if (event.datasetDir && event.datasetDir !== viewerDatasetDir) return;
    if (event.scope === 'viewer' && event.username !== viewerSelectedGroup?.username) return;
    const message = event.message || `保存群聊 ${event.current}/${event.total} · ${event.displayName || ''}`;
    setViewerSyncStatus(message, 'syncing');
    appendViewerProgressLog(message);
  } else if (event.phase === 'similarity-index') {
    viewerSimilaritySummary.textContent =
      '正在建立本地向量 · 新增 ' + event.indexed + ' · 复用 ' + event.reused + ' · 跳过 ' + event.skipped;
  } else if (event.phase === 'classification-start') {
    invalidateClassificationReviewCache();
    setViewerSyncStatus(`开始识别 ${event.total} 张图片`, 'syncing');
  } else if (event.phase === 'classification-batch') {
    setViewerSyncStatus(`图片识别 ${event.current}/${event.total}`, 'syncing');
  } else if (event.phase === 'classification-done') {
    invalidateClassificationReviewCache();
    setViewerSyncStatus(`图片识别完成 · ${event.completed} 成功，${event.failed} 失败`, event.failed ? 'warning' : 'ready');
    viewerClassificationState.value = 'codex_results';
    viewerClassificationRun.value = '';
    if (!viewerClassificationPanel.classList.contains('hidden')) void loadClassificationReview({ resetExpanded: true });
  } else if (event.phase === 'classification-failed') {
    invalidateClassificationReviewCache();
    setViewerSyncStatus(event.error || '图片识别失败', 'warning');
    if (!viewerClassificationPanel.classList.contains('hidden')) void loadClassificationReview();
  }
});

window.exporter.onProgress((event) => {
  const phase = event.phase;

  if (phase === 'scan' || phase === 'init' || phase === 'decrypt' || phase === 'keys') {
    if (viewerSyncing && event.message) {
      setViewerSyncStatus(friendlyScanMessage(event), 'syncing');
    }
    if (scanRunning) {
      showScanToast(
        friendlyScanTitle(event),
        friendlyScanMessage(event),
        friendlyScanNote(event)
      );
    }
    if (exportRunning) {
      const progress = computeExportTotalProgress(event);
      if (progress) {
        setProgressWithEta(progress.percent, progress.text);
      }
      if (event.message) {
        appendLog(event.message);
      }
    } else if (phase !== 'scan' && event.message) {
      appendLog(event.message);
    }
    return;
  }

  if (exportRunning && (phase === 'exporting' || phase === 'voice-transcription' || phase === 'done')) {
    if (phase === 'exporting' && event.subphase === 'image-debug' && event.message) {
      appendLog(event.message);
      if (event.imageDebug?.samples?.length) {
        for (const sample of event.imageDebug.samples) {
          appendLog(`  image sample: ${JSON.stringify(sample)}`);
        }
      }
      return;
    }
    const progress = computeExportTotalProgress(event);
    if (progress) {
      setProgressWithEta(progress.percent, progress.text);
    }
    if (phase === 'exporting' && event.current % 5 === 0) {
      appendLog(`已导出 ${event.current} 个会话，累计 ${formatCount(event.totalMessages)} 条消息`);
    } else if (phase === 'voice-transcription' && event.message) {
      appendLog(event.message);
    }
    return;
  }

  if (phase === 'error') {
    appendLog(`错误: ${event.message}`);
  }
});

initApp();
