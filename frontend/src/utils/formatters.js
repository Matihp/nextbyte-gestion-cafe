export function formatearPrecio(monto) {
  const numero = Math.round(Number(monto) || 0);
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(numero);
}

export function formatearFecha(fecha) {
  if (!fecha) return '-';
  const d = new Date(fecha);
  if (isNaN(d.getTime())) return '-';
  const fechaPart = new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    timeZone: 'America/Argentina/Buenos_Aires'
  }).format(d);
  const horaPart = new Intl.DateTimeFormat('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'America/Argentina/Buenos_Aires'
  }).format(d);
  return `${fechaPart} ${horaPart}`;
}

export function formatearSoloFecha(fecha) {
  if (!fecha) return '-';
  const str = String(fecha).trim();
  if (str.includes(' a ')) {
    const [desde, hasta] = str.split(' a ');
    return `${formatearSoloFecha(desde)} al ${formatearSoloFecha(hasta)}`;
  }
  // Si viene en formato YYYY-MM-DD
  const matchYmd = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (matchYmd) {
    const [, y, m, d] = matchYmd;
    return `${d}/${m}/${y.slice(-2)}`;
  }
  // Si ya es DD/MM/AAAA o DD/MM/AA
  const matchDma = str.match(/^(\d{2})\/(\d{2})\/(\d{2,4})$/);
  if (matchDma) {
    const [, d, m, y] = matchDma;
    return `${d}/${m}/${y.slice(-2)}`;
  }
  const d = new Date(fecha);
  if (isNaN(d.getTime())) return str;
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    timeZone: 'America/Argentina/Buenos_Aires'
  }).format(d);
}

export function formatearHora(fecha) {
  if (!fecha) return '';
  const str = String(fecha).trim();
  if (/^\d{2}:\d{2}(:\d{2})?$/.test(str)) {
    return str.slice(0, 5);
  }
  const d = new Date(fecha);
  if (isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'America/Argentina/Buenos_Aires'
  }).format(d);
}

export function formatearIdPedido(pedidoOrId) {
  if (!pedidoOrId) return '#0001';
  if (typeof pedidoOrId === 'object') {
    if (pedidoOrId.display_id) return pedidoOrId.display_id;
    if (pedidoOrId.displayId) return pedidoOrId.displayId;
    if (pedidoOrId.orderNumber) return pedidoOrId.orderNumber;
    if (pedidoOrId.numero_pedido) {
      return `#${String(pedidoOrId.numero_pedido).padStart(4, '0')}`;
    }
    return formatearIdPedido(pedidoOrId.id);
  }
  const str = String(pedidoOrId).trim();
  if (/^#?\d{1,4}$/.test(str)) {
    const digits = str.replace('#', '');
    return `#${digits.padStart(4, '0')}`;
  }
  return str.startsWith('#') ? str : `#${str}`;
}

export function formatearMetodoPago(metodo) {
  if (!metodo) return 'Efectivo';
  const m = String(metodo).trim();
  const mLower = m.toLowerCase();
  if (mLower === 'efectivo') return 'Efectivo';
  if (mLower === 'debito' || mLower === 'tarjeta de debito' || mLower === 'tarjeta de débito') return 'Tarjeta de Débito';
  if (mLower === 'credito' || mLower === 'tarjeta de credito' || mLower === 'tarjeta de crédito') return 'Tarjeta de Crédito';
  if (mLower === 'mercadopago' || mLower === 'mercado pago') return 'Mercado Pago';
  if (mLower === 'transferencia') return 'Transferencia';
  if (mLower === 'otros') return 'Otros';
  if (mLower.startsWith('otros:')) {
    const custom = m.slice(6).trim();
    return custom ? `Otros: ${custom}` : 'Otros';
  }
  return m.charAt(0).toUpperCase() + m.slice(1);
}


