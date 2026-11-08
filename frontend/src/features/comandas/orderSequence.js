/**
 * orderSequence.js
 * Funciones de negocio para la sección de Comandas:
 * 1. Formato de fecha estricto DD/MM/AAAA.
 * 2. Asignación secuencial de números de pedidos diarios (#0001 a #1000).
 * 3. Filtrado de comandas por fecha actual (reinicio a las 00:00 hs) y expiración de completados (1 hora).
 */

// Formatear cualquier fecha a DD/MM/AA
export const formatDateDDMMAAAA = (dateVal) => {
  if (!dateVal) return '';
  const str = String(dateVal).trim();
  // Si ya tiene formato DD/MM/AAAA o DD/MM/AA
  const dma = str.match(/^(\d{2})\/(\d{2})\/(\d{2,4})$/);
  if (dma) {
    return `${dma[1]}/${dma[2]}/${dma[3].slice(-2)}`;
  }
  // Si tiene formato YYYY-MM-DD
  const ymd = str.match(/^(\d{2,4})-(\d{2})-(\d{2})/);
  if (ymd) {
    return `${ymd[3]}/${ymd[2]}/${ymd[1].slice(-2)}`;
  }
  // Si es un objeto Date o timestamp ISO
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    return new Intl.DateTimeFormat('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      timeZone: 'America/Argentina/Buenos_Aires'
    }).format(d);
  }
  return str;
};

// Obtener fecha de hoy en formato local YYYY-MM-DD
export const getTodayISODate = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Normalizar fecha a YYYY-MM-DD
export const toISODate = (dateStr) => {
  if (!dateStr) return '';
  const str = String(dateStr).trim();
  const dmMatch = str.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (dmMatch) {
    return `${dmMatch[3]}-${dmMatch[2]}-${dmMatch[1]}`;
  }
  const dmShortMatch = str.match(/^(\d{2})\/(\d{2})\/(\d{2})/);
  if (dmShortMatch) {
    return `20${dmShortMatch[3]}-${dmShortMatch[2]}-${dmShortMatch[1]}`;
  }
  const ymdMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymdMatch) {
    return `${ymdMatch[1]}-${ymdMatch[2]}-${ymdMatch[3]}`;
  }
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  return str;
};

// Comprueba si un pedido es del día de hoy (desde las 00:00 hs)
export const isOrderFromToday = (order) => {
  if (!order) return false;
  const today = getTodayISODate();
  const orderDate = toISODate(order.date || order.fecha || order.created_at);
  if (!orderDate) return true;
  return orderDate === today;
};

// Comprueba si un pedido en estado "Completado" superó 1 hora de antigüedad
export const isCompletedOrderExpired = (order, completedTimesMap = {}) => {
  if (!order) return false;
  const st = String(order.status || order.estado || '').toLowerCase().trim();
  if (st !== 'completado') return false;

  const now = Date.now();
  const ONE_HOUR_MS = 60 * 60 * 1000;

  // 1. Revisar si hay registro en memoria/localStorage del momento de completado
  const recorded = completedTimesMap[String(order.id)];
  if (recorded && !isNaN(Number(recorded))) {
    return (now - Number(recorded)) > ONE_HOUR_MS;
  }

  // 2. Revisar completed_at o updated_at
  const ts = order.completed_at || order.updated_at;
  if (ts) {
    const d = new Date(ts).getTime();
    if (!isNaN(d)) {
      return (now - d) > ONE_HOUR_MS;
    }
  }

  // 3. Si no hay marca de actualización, usar fecha y hora de creación
  const creationStr = order.created_at || (order.date && order.time ? `${order.date}T${order.time}` : null);
  if (creationStr) {
    const d = new Date(creationStr).getTime();
    if (!isNaN(d)) {
      return (now - d) > ONE_HOUR_MS;
    }
  }

  return false;
};

// Asignar y persistir números secuenciales (#0001 a #9999) por día (reinicio a las 00:00 hs)
export const assignDailyOrderNumbers = (orders = []) => {
  if (!Array.isArray(orders)) return [];

  const today = getTodayISODate();
  const STORAGE_KEY = 'nextbyte_daily_order_seq';
  let seqStore = {};
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      seqStore = JSON.parse(stored);
    }
  } catch {
    seqStore = {};
  }

  if (!seqStore[today] || typeof seqStore[today] !== 'object') {
    seqStore[today] = { __last: 0 };
  }
  const dayMap = seqStore[today];

  // Ordenar cronológicamente para asignación ordenada inicial
  const sorted = [...orders].sort((a, b) => {
    const timeA = a.created_at || (a.date && a.time ? `${a.date} ${a.time}` : '') || '';
    const timeB = b.created_at || (b.date && b.time ? `${b.date} ${b.time}` : '') || '';
    return timeA.localeCompare(timeB);
  });

  let changed = false;

  sorted.forEach((order) => {
    const idKey = String(order.id);
    if (order.numero_pedido) {
      const num = Number(order.numero_pedido);
      const str = String(num).padStart(4, '0');
      if (dayMap[idKey] !== str) {
        dayMap[idKey] = str;
        if (num > (dayMap.__last || 0) && num <= 9999) {
          dayMap.__last = num;
        }
        changed = true;
      }
    } else if (!dayMap[idKey]) {
      let nextNum = Number(dayMap.__last || 0) + 1;
      if (nextNum > 9999) {
        nextNum = 1; // Reinicio en #0001 al llegar al #9999
      }
      dayMap.__last = nextNum;
      dayMap[idKey] = String(nextNum).padStart(4, '0');
      changed = true;
    }
  });

  if (changed) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seqStore));
    } catch {
      // Ignorar errores de almacenamiento local
    }
  }

  return orders.map((order) => {
    const orderDate = toISODate(order.date || order.fecha || order.created_at) || today;
    const orderMap = seqStore[orderDate] || dayMap;
    const numStr = order.numero_pedido
      ? String(order.numero_pedido).padStart(4, '0')
      : (orderMap[String(order.id)] || '0001');
    const displayId = `#${numStr}`;
    return {
      ...order,
      orderNumber: displayId,
      displayId
    };
  });
};

// Obtener o formatear el displayId (#0001 a #9999) de un pedido
export const getOrAssignOrderDisplayId = (order) => {
  if (!order) return '#0001';
  if (order.displayId) return order.displayId;
  if (order.display_id) return order.display_id;
  if (order.orderNumber) return order.orderNumber;
  if (order.numero_pedido) {
    return `#${String(order.numero_pedido).padStart(4, '0')}`;
  }

  const [assigned] = assignDailyOrderNumbers([order]);
  return assigned?.displayId || `#0001`;
};

