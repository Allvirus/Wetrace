const crypto = require('crypto');
const os = require('os');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');

const IMAGE_MAGICS = [
  Buffer.from([0xff, 0xd8, 0xff]),
  Buffer.from([0x89, 0x50, 0x4e, 0x47]),
  Buffer.from('GIF', 'ascii'),
  Buffer.from('RIFF', 'ascii'),
  Buffer.from('wxgf', 'ascii'),
];

function templateMatches(aesText, ciphertext) {
  try {
    const decipher = crypto.createDecipheriv('aes-128-ecb', Buffer.from(aesText, 'ascii'), null);
    decipher.setAutoPadding(false);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return IMAGE_MAGICS.some((magic) => decrypted.subarray(0, magic.length).equals(magic));
  } catch {
    return false;
  }
}

function runWorker() {
  const { start, end, xorKey, suffixHex, wxid, templatesHex } = workerData;
  const suffixBytes = Buffer.from(String(suffixHex || ''), 'hex');
  const templates = (templatesHex || []).map((item) => Buffer.from(item, 'hex'));
  const wxidBytes = Buffer.from(String(wxid || ''), 'ascii');

  for (let i = start; i < end; i += 1) {
    const uin = i * 256 + xorKey;
    const uinBytes = Buffer.from(String(uin), 'ascii');
    const digest = crypto.createHash('md5').update(uinBytes).digest();
    if (digest[0] !== suffixBytes[0] || digest[1] !== suffixBytes[1]) continue;

    const aesText = crypto
      .createHash('md5')
      .update(Buffer.concat([uinBytes, wxidBytes]))
      .digest('hex')
      .slice(0, 16);

    let matched = true;
    for (const ciphertext of templates) {
      if (!templateMatches(aesText, ciphertext)) {
        matched = false;
        break;
      }
    }

    if (matched) {
      parentPort.postMessage({ found: true, uin, aesText, wxid });
      return;
    }
  }

  parentPort.postMessage({ found: false });
}

function readStdin() {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      data += chunk;
    });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);
  });
}

function runMain() {
  return readStdin().then((raw) => {
    const payload = JSON.parse(raw || '{}');
    const xorKey = Number(payload.xorKey);
    const suffixHex = String(payload.suffixHex || '').toLowerCase();
    const templatesHex = Array.isArray(payload.templatesHex) ? payload.templatesHex : [];
    const wxids = Array.isArray(payload.wxids) ? payload.wxids : [];

    if (!Number.isInteger(xorKey) || xorKey < 0 || xorKey > 255 || !/^[0-9a-f]{4}$/.test(suffixHex) || templatesHex.length === 0 || wxids.length === 0) {
      process.stdout.write(JSON.stringify({ found: false }));
      return;
    }

    const total = 1 << 24;
    const workerCount = Math.max(1, Math.min(Number(payload.workers) || os.cpus().length || 1, 8));
    const chunk = Math.floor(total / workerCount);

    const searchWxid = (wxid) =>
      new Promise((resolve) => {
        const workers = [];
        let finished = 0;
        let settled = false;

        const finish = (result) => {
          if (settled) return;
          settled = true;
          for (const worker of workers) {
            worker.terminate().catch(() => {});
          }
          resolve(result);
        };

        for (let index = 0; index < workerCount; index += 1) {
          const start = index * chunk;
          const end = index === workerCount - 1 ? total : (index + 1) * chunk;
          const worker = new Worker(__filename, {
            workerData: { start, end, xorKey, suffixHex, wxid, templatesHex },
          });
          workers.push(worker);
          worker.on('message', (message) => {
            if (message?.found) {
              finish(message);
              return;
            }
            finished += 1;
            if (finished === workerCount) {
              finish(null);
            }
          });
          worker.on('error', () => {
            finished += 1;
            if (finished === workerCount) {
              finish(null);
            }
          });
        }
      });

    return wxids
      .reduce(
        (promise, wxid) =>
          promise.then((result) => {
            if (result) return result;
            return searchWxid(wxid);
          }),
        Promise.resolve(null)
      )
      .then((result) => {
        process.stdout.write(JSON.stringify(result || { found: false }));
      });
  });
}

if (isMainThread) {
  runMain().catch(() => {
    process.stdout.write(JSON.stringify({ found: false }));
    process.exit(1);
  });
} else {
  runWorker();
}
