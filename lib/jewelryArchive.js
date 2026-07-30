const fs = require('fs');
const path = require('path');

function resolveInside(rootDir, relativePath) {
  const root = path.resolve(rootDir);
  const target = path.resolve(root, ...String(relativePath || '').replace(/\\/g, '/').split('/'));
  const normalize = (value) => process.platform === 'win32' ? value.toLowerCase() : value;
  if (!normalize(target).startsWith(normalize(`${root}${path.sep}`))) {
    throw new Error('分类图片路径超出数据集目录');
  }
  return target;
}

const SHANGHAI_DAY_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function sourceDay(record) {
  const datetime = String(record?.source?.message?.datetime || '');
  if (/^\d{4}-\d{2}-\d{2}/.test(datetime)) return datetime.slice(0, 10);
  const createTime = Number(record?.source?.message?.createTime) || 0;
  if (!createTime) return 'unknown-date';
  const parts = Object.fromEntries(
    SHANGHAI_DAY_FORMATTER.formatToParts(new Date(createTime * 1000))
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value])
  );
  return [parts.year, parts.month, parts.day].join('-');
}

function dayMatchesRange(day, { dateFrom = null, dateTo = null, includeUnknownDate = false } = {}) {
  if (!dateFrom && !dateTo) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(day || ''))) return Boolean(includeUnknownDate);
  if (dateFrom && day < dateFrom) return false;
  if (dateTo && day > dateTo) return false;
  return true;
}
function safeRemove(rootDir, relativePath) {
  if (!relativePath || !String(relativePath).replace(/\\/g, '/').startsWith('classified-images/')) return;
  const target = resolveInside(rootDir, relativePath);
  try { fs.rmSync(target, { force: true }); } catch { /* retry during later reconciliation */ }
}

function createArchiveFile(sourcePath, targetPath) {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  if (fs.existsSync(targetPath)) return;
  try {
    fs.linkSync(sourcePath, targetPath);
  } catch {
    fs.copyFileSync(sourcePath, targetPath, fs.constants.COPYFILE_EXCL);
  }
}

function projectClassificationRecord(datasetDir, record) {
  const previous = record.archive?.classifiedRelativePath || null;
  const current = record.current || {};
  const shouldArchive = current.state === 'classified' && current.jewelryDecision === 'jewelry' && current.category?.id;
  if (!shouldArchive) {
    safeRemove(datasetDir, previous);
    return {
      ...record,
      archive: {
        day: sourceDay(record),
        classifiedRelativePath: null,
        projectionStatus: 'not_applicable',
      },
    };
  }

  const originalRelativePath = record.source?.image?.originalRelativePath;
  const extension = path.extname(String(originalRelativePath || '')).toLowerCase() || '.img';
  const day = sourceDay(record);
  const relativePath = path.posix.join(
    'classified-images',
    day,
    current.category.id,
    `${record.imageId}${extension}`
  );
  try {
    const sourcePath = resolveInside(datasetDir, originalRelativePath);
    const targetPath = resolveInside(datasetDir, relativePath);
    if (!fs.existsSync(sourcePath)) throw new Error('源图片文件不存在');
    createArchiveFile(sourcePath, targetPath);
    if (previous && previous !== relativePath) safeRemove(datasetDir, previous);
    return {
      ...record,
      archive: { day, classifiedRelativePath: relativePath, projectionStatus: 'ready' },
    };
  } catch (err) {
    return {
      ...record,
      archive: {
        day,
        classifiedRelativePath: previous,
        projectionStatus: 'error',
        error: err.message,
      },
    };
  }
}

module.exports = { dayMatchesRange, projectClassificationRecord, sourceDay };
