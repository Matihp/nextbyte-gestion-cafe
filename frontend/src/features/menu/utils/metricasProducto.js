const RATING_MOCKUP = {
  espresso: 2,
  macchiato: 4,
  cortado: 5,
  latte: 0,
  'flat white': 0,
  capuccino: 0,
  cappuccino: 0,
  medialuna: 4,
  muffins: 3
};

const VENTAS_MOCKUP = {
  cortado: 500,
  macchiato: 420,
  espresso: 350,
  'medialuna andén': 280,
  muffins: 240,
  capuccino: 180,
  'flat white': 120,
  latte: 60
};

export function obtenerRatingProducto(producto) {
  if (producto?.rating !== undefined && producto.rating !== null) {
    return Number(producto.rating);
  }
  const nombre = (producto?.nombre || '').toLowerCase().trim();
  for (const [clave, val] of Object.entries(RATING_MOCKUP)) {
    if (nombre.includes(clave)) return val;
  }
  return 0;
}

export function obtenerVentasProducto(producto) {
  if (producto?.ventas_reales !== undefined && producto.ventas_reales > 0) {
    return Number(producto.ventas_reales);
  }
  const nombre = (producto?.nombre || '').toLowerCase().trim();
  for (const [clave, val] of Object.entries(VENTAS_MOCKUP)) {
    if (nombre.includes(clave)) return val;
  }
  return (Number(producto?.id) || 1) * 10;
}

