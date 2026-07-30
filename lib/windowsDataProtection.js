const koffi = require('koffi');

const MAX_PLAINTEXT_BYTES = 4 * 1024 * 1024;
const MAX_PROTECTED_BYTES = 8 * 1024 * 1024;
const PAYLOAD_PREFIX = 'wetrace-dpapi-v1:';
const CRYPTPROTECT_UI_FORBIDDEN = 0x1;
const OPTIONAL_ENTROPY = Buffer.from('Wetrace:v1', 'utf8');

const DATA_BLOB = koffi.struct('WETRACE_DATA_BLOB', {
  cbData: 'uint32',
  pbData: 'uint8 *',
});
const crypt32 = koffi.load('crypt32.dll');
const kernel32 = koffi.load('kernel32.dll');
const cryptProtectData = crypt32.func(
  'bool __stdcall CryptProtectData(const WETRACE_DATA_BLOB *input, const char16_t *description, const WETRACE_DATA_BLOB *entropy, void *reserved, void *prompt, uint32 flags, _Out_ WETRACE_DATA_BLOB *output)'
);
const cryptUnprotectData = crypt32.func(
  'bool __stdcall CryptUnprotectData(const WETRACE_DATA_BLOB *input, void *description, const WETRACE_DATA_BLOB *entropy, void *reserved, void *prompt, uint32 flags, _Out_ WETRACE_DATA_BLOB *output)'
);
const localFree = kernel32.func('void * __stdcall LocalFree(void *memory)');
const getLastError = kernel32.func('uint32 __stdcall GetLastError()');

function asBlob(buffer) {
  return { cbData: buffer.length, pbData: buffer };
}

function runDpapi(fn, input, description) {
  if (process.platform !== 
'win32'
) {
    throw new Error('Windows DPAPI is required for local secret storage');
  }
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input);
  if (buffer.length === 0 || buffer.length > MAX_PROTECTED_BYTES) {
    throw new Error('Secret payload size is invalid');
  }
  const output = {};
  const ok = fn(
    asBlob(buffer),
    description,
    asBlob(OPTIONAL_ENTROPY),
    null,
    null,
    CRYPTPROTECT_UI_FORBIDDEN,
    output
  );
  if (!ok || !output.pbData || !output.cbData) {
    throw new Error('Windows DPAPI failed with error ' + getLastError());
  }
  if (output.cbData > MAX_PROTECTED_BYTES) {
    localFree(output.pbData);
    throw new Error('Protected secret payload is too large');
  }
  try {
    return Buffer.from(koffi.decode(output.pbData, 'uint8', output.cbData));
  } finally {
    localFree(output.pbData);
  }
}

function protectText(value) {
  const input = Buffer.from(String(value), 'utf8');
  if (input.length === 0 || input.length > MAX_PLAINTEXT_BYTES) {
    throw new Error('Secret plaintext size is invalid');
  }
  return PAYLOAD_PREFIX + runDpapi(cryptProtectData, input, 'Wetrace local secret').toString('base64');
}

function unprotectText(value) {
  const text = String(value || '').trim();
  if (!text.startsWith(PAYLOAD_PREFIX)) {
    throw new Error('Secret payload is not DPAPI protected');
  }
  const encoded = text.slice(PAYLOAD_PREFIX.length);
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) throw new Error('Secret payload is malformed');
  const protectedData = Buffer.from(encoded, 'base64');
  if (protectedData.length === 0 || protectedData.length > MAX_PROTECTED_BYTES) {
    throw new Error('Protected secret payload size is invalid');
  }
  return runDpapi(cryptUnprotectData, protectedData, null).toString('utf8');
}

module.exports = {
  PAYLOAD_PREFIX,
  protectText,
  unprotectText,
};
