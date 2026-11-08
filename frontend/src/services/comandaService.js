import api from './api.js';

export const comandaService = {
  obtenerActivas: (params, config = {}) => api.get('/comandas/activas', { ...config, params }),
  cambiarEstado: (id, estado) => api.patch(`/comandas/${id}/estado`, { estado }),
  completar: (id) => api.patch(`/comandas/${id}/completar`),
  entregar: (id) => api.patch(`/comandas/${id}/entregar`),

  getActivas: (params, config = {}) => comandaService.obtenerActivas(params, config)
};

const ORDER_STATES = ['pendiente', 'en_preparacion', 'en_empaque', 'completado', 'entregado'];

export const getAllowedOrderStatuses = (status) => {
  if (['cancelado', 'entregado'].includes(status)) return [status];
  return ORDER_STATES;
};

export const getComandaErrorMessage = (error) =>
  error?.response?.data?.message || error?.message || 'No se pudieron actualizar las comandas';

const ORDERS_REVISION_KEY = 'nextbyte_orders_revision';
const broadcastedEvents = new WeakMap();
let revisionSequence = 0;

const broadcastOrdersRevision = (event) => {
  if (broadcastedEvents.has(event)) return broadcastedEvents.get(event);
  const revision = globalThis.crypto?.randomUUID?.() ||
    `${Date.now()}:${++revisionSequence}:${Math.random().toString(36).slice(2)}`;
  // Varias instancias pueden recibir el mismo evento local: emitir una sola revisión.
  broadcastedEvents.set(event, revision);
  try {
    localStorage.setItem(ORDERS_REVISION_KEY, revision);
  } catch { /* La notificación entre pestañas es opcional; el polling sigue disponible. */ }
  return revision;
};

export const notifyOrdersUpdated = () => {
  const event = new CustomEvent('orders-updated');
  const revision = broadcastOrdersRevision(event);
  window.dispatchEvent(event);
  return revision;
};

export const createComandaPolling = ({ onData, onError, onLoading = () => {}, canFetch = () => true, interval = 5000 }) => {
  let active = false;
  let generation = 0;
  let inFlight = null;
  let controller = null;
  let timer = null;
  let queued = false;
  let failures = 0;
  let retryAt = 0;
  let lastRevision = null;

  const isVisible = () => document.visibilityState === 'visible';
  const clearTimer = () => {
    clearTimeout(timer);
    timer = null;
  };
  const schedule = (delay) => {
    clearTimer();
    if (active && isVisible() && canFetch()) {
      timer = setTimeout(() => refresh(), Math.max(delay, retryAt - Date.now()));
    }
  };
  const invalidate = () => {
    generation += 1;
    queued = true;
    controller?.abort();
    clearTimer();
  };
  const refresh = ({ force = false } = {}) => {
    if (!active || !isVisible() || !canFetch()) return Promise.resolve(false);
    if (inFlight) {
      return inFlight.then((result) => queued ? refresh({ force }) : result);
    }
    if (!force && Date.now() < retryAt) {
      schedule(0);
      return Promise.resolve(false);
    }
    clearTimer();
    queued = false;
    const requestGeneration = generation;
    controller = new AbortController();
    const { signal } = controller;
    onLoading(true);
    inFlight = Promise.resolve()
      .then(() => {
        if (!active || signal.aborted || requestGeneration !== generation) return;
        return comandaService.obtenerActivas({ incluir_completados: true }, { signal });
      })
      .then((response) => {
        if (!active || signal.aborted || requestGeneration !== generation) return false;
        const data = Array.isArray(response) ? response : response?.data?.data || response?.data;
        if (!Array.isArray(data)) throw new Error('Respuesta de comandas inválida');
        onData(data);
        failures = 0;
        retryAt = 0;
        return true;
      })
      .catch((error) => {
        if (!active || signal.aborted || requestGeneration !== generation) return false;
        failures += 1;
        retryAt = Date.now() + Math.min(interval * 2 ** failures, 60000);
        onError(error);
        return false;
      })
      .finally(() => {
        inFlight = null;
        controller = null;
        if (!active) return;
        onLoading(false);
        schedule(queued ? 0 : interval);
      });
    return inFlight;
  };
  const handleVisible = () => {
    if (isVisible()) refresh();
    else invalidate();
  };
  const handleUpdate = (event) => {
    let revision;
    if (event.type === 'storage') {
      // La caché es solo lectura UI: nunca debe generar HTTP ni un nuevo broadcast.
      if (event.key !== ORDERS_REVISION_KEY || !event.newValue) return;
      revision = event.newValue;
    } else {
      revision = broadcastOrdersRevision(event);
    }
    if (revision === lastRevision) return;
    lastRevision = revision;
    invalidate();
    refresh();
  };

  return {
    refresh,
    invalidate,
    start() {
      active = true;
      document.addEventListener('visibilitychange', handleVisible);
      window.addEventListener('focus', handleVisible);
      window.addEventListener('orders-updated', handleUpdate);
      window.addEventListener('storage', handleUpdate);
      refresh();
    },
    stop() {
      active = false;
      invalidate();
      document.removeEventListener('visibilitychange', handleVisible);
      window.removeEventListener('focus', handleVisible);
      window.removeEventListener('orders-updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    }
  };
};

export default comandaService;
