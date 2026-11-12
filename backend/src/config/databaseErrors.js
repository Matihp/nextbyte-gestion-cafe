const NETWORK_CODES = new Set([
  'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN',
  'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_SOCKET', 'FETCH_ERROR', 'HRANA_WEBSOCKET_ERROR',
  'HTTP_TIMEOUT', 'STREAM_CLOSED', 'CLIENT_CLOSED', 'TIMEOUT_ERR', 'ABORT_ERR'
]);

function isNetworkError(error) {
  const seen = new Set();
  for (let current = error; current && !seen.has(current); current = current.cause) {
    seen.add(current);
    const code = String(current.code || current.errno || '').toUpperCase();
    if (code === 'BLOCKED' || code.startsWith('SQLITE_')) return false;
    if (NETWORK_CODES.has(code)) return true;
    if (['FetchError', 'ClosedError', 'AbortError', 'TimeoutError'].includes(current.name)) return true;
    if (/fetch failed|socket|hang up|stream is closed|connection (?:closed|reset|refused)|network error|timed?\s*out/i.test(current.message || '')) return true;
  }
  return false;
}

function isQuotaError(error) {
  const seen = new Set();
  for (let current = error; current && !seen.has(current); current = current.cause) {
    seen.add(current);
    const code = String(current.code || '').toUpperCase();
    const status = Number(current.status || current.statusCode);
    if (code === 'BLOCKED' || status === 429) return true;
    if (/usage limit|quota exceeded|too many requests/i.test(current.message || '')) return true;
  }
  return false;
}

function isAuthError(error) {
  const seen = new Set();
  for (let current = error; current && !seen.has(current); current = current.cause) {
    seen.add(current);
    const code = String(current.code || '').toUpperCase();
    const status = Number(current.status || current.statusCode);
    if (status === 401 || status === 403 || code === 'UNAUTHORIZED' || code === 'FORBIDDEN') return true;
    if (/unauthorized|forbidden|invalid auth token|authentication failed/i.test(current.message || '')) return true;
  }
  return false;
}

function isCloudUnavailable(error) {
  const seen = new Set();
  for (let current = error; current && !seen.has(current); current = current.cause) {
    seen.add(current);
    const code = String(current.code || '').toUpperCase();
    if (code === 'BLOCKED' || code.startsWith('SQLITE_')) return false;
  }
  if (isNetworkError(error)) return true;
  const status = Number(error?.status || error?.statusCode || error?.cause?.status);
  return status === 429 || status >= 500 || error?.code === 'SERVER_ERROR';
}

module.exports = {
  isNetworkError,
  isCloudUnavailable,
  isQuotaError,
  isAuthError
};
