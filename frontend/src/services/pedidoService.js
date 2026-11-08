import api from './api.js';

const ATTEMPTS_STORAGE_KEY = 'nextbyte_order_attempts:v1';
const ATTEMPT_TTL = 24 * 60 * 60 * 1000;
const MAX_ATTEMPTS = 32;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const readAttempts = () => {
  try {
    const records = JSON.parse(sessionStorage.getItem(ATTEMPTS_STORAGE_KEY) || '[]');
    if (!Array.isArray(records) || records.some((record) =>
      !record || Object.keys(record).length !== 3 ||
      !/^[0-9a-f]{64}$/.test(record.fingerprint) ||
      !UUID_PATTERN.test(record.idempotencyKey) ||
      !Number.isFinite(record.timestamp) || record.timestamp < 0 || record.timestamp > Date.now()) ||
      new Set(records.map((record) => record.fingerprint)).size !== records.length) {
      throw new Error('Registro inválido');
    }
    return records.filter((record) => Date.now() - record.timestamp < ATTEMPT_TTL);
  } catch {
    throw new Error('No se pudo leer el registro de envíos de esta pestaña. No se enviará otro pedido sin recuperar su clave; verificá sessionStorage y los datos del navegador.');
  }
};

const writeAttempts = (records) => {
  try {
    sessionStorage.setItem(ATTEMPTS_STORAGE_KEY, JSON.stringify(records));
  } catch {
    throw new Error('No se pudo guardar el registro de envíos. Habilitá sessionStorage antes de continuar para evitar pedidos duplicados.');
  }
};

const createUUID = () => {
  if (globalThis.crypto.randomUUID) return globalThis.crypto.randomUUID();
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

export const preparePedidoSubmission = async (datos, previousAttempt, { namespace } = {}) => {
  if (!globalThis.crypto?.subtle?.digest ||
      (!globalThis.crypto.randomUUID && !globalThis.crypto.getRandomValues)) {
    throw new Error('No se puede proteger el envío en este navegador. Configurá HTTPS para acceder desde la LAN, o usá localhost: se requiere WebCrypto (SHA-256). No se envió el pedido.');
  }
  if (typeof namespace !== 'string' || !namespace.trim()) {
    throw new Error('No se pudo identificar al usuario del pedido. Iniciá sesión antes de enviarlo.');
  }
  const signature = JSON.stringify(datos);
  const payload = JSON.parse(signature);
  let hash;
  try {
    hash = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify([namespace, signature])));
  } catch {
    throw new Error('No se pudo calcular SHA-256 para proteger el envío. Verificá WebCrypto y la conexión HTTPS; no se envió el pedido.');
  }
  const fingerprint = Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('');
  const records = readAttempts();
  const saved = records.find((record) => record.fingerprint === fingerprint);
  const previous = previousAttempt?.fingerprint === fingerprint &&
    (Date.now() - previousAttempt.timestamp < ATTEMPT_TTL || previousAttempt.confirmedResponse)
    ? previousAttempt : null;
  if (previousAttempt?.confirmedResponse && !previous) {
    throw new Error('El pedido anterior ya fue confirmado. Finalizá ese envío sin modificar el carrito antes de crear otro.');
  }
  if (previous && saved && previous.idempotencyKey !== saved.idempotencyKey) {
    throw new Error('La clave del envío cambió en esta pestaña. No se enviará el pedido hasta revisar el intento anterior.');
  }
  const record = {
    fingerprint,
    idempotencyKey: previous?.idempotencyKey || saved?.idempotencyKey || createUUID(),
    timestamp: previous?.timestamp ?? saved?.timestamp ?? Date.now()
  };
  // Leer después del await y escribir sin otro await evita carreras entre preparaciones en esta pestaña.
  writeAttempts([
    ...records.filter((entry) => entry.fingerprint !== fingerprint)
      .sort((a, b) => a.timestamp - b.timestamp).slice(-(MAX_ATTEMPTS - 1)),
    record
  ]);
  return previous || { signature, payload, ...record, restored: Boolean(saved) };
};

export const clearPedidoSubmission = (attempt) => {
  const records = readAttempts();
  writeAttempts(records.filter((record) =>
    record.fingerprint !== attempt.fingerprint || record.idempotencyKey !== attempt.idempotencyKey));
};

export const pedidoService = {
  obtenerTodos: (params = {}) => api.get('/pedidos', { params }),
  obtenerPorId: (id) => api.get(`/pedidos/${id}`),
  crear: (datos, { idempotencyKey } = {}) => api.post('/pedidos', datos,
    idempotencyKey === undefined ? undefined : { headers: { 'Idempotency-Key': idempotencyKey } }),
  cancelar: (id, datos = {}) => api.patch(`/pedidos/${id}/cancelar`, datos),
  eliminarItem: (id, detalleId, datos = {}) => api.delete(`/pedidos/${id}/items/${detalleId}`, { data: datos }),

  getAll: (params = {}) => api.get('/pedidos', { params }),
  getById: (id) => api.get(`/pedidos/${id}`),
  create: (datos, options) => pedidoService.crear(datos, options)
};

export default pedidoService;
