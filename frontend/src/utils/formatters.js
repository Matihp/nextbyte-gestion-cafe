export function formatearPrecio(monto) {
  const numero = Number(monto) || 0;
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(numero);
}

export function formatearFecha(fecha) {
  if (!fecha) return '-';
  const d = new Date(fecha);
  if (isNaN(d.getTime())) return '-';
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(d);
}

export function formatearSoloFecha(fecha) {
  if (!fecha) return '-';
  const d = new Date(fecha);
  if (isNaN(d.getTime())) return '-';
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
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


