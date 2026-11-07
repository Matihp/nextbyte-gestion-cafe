/**
 * Calcula las estrellas y métricas de un producto basado en datos reales de ventas.
 * No utiliza datos hardcodeados ni mockups.
 */

export function obtenerVentasProducto(producto) {
  if (producto?.ventas_reales !== undefined && producto?.ventas_reales !== null) {
    return Number(producto.ventas_reales) || 0;
  }
  return 0;
}

export function obtenerRatingProducto(producto, maxVentas = 1) {
  if (producto?.rating !== undefined && producto?.rating !== null) {
    return Number(producto.rating);
  }
  const ventas = obtenerVentasProducto(producto);
  if (ventas <= 0 || maxVentas <= 0) return 0;
  return Math.min(5, Math.max(1, Math.ceil((ventas / maxVentas) * 5)));
}
