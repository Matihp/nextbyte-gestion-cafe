const IMAGENES_POR_DEFECTO = {
  espresso: 'https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?w=500&auto=format&fit=crop&q=80',
  macchiato: 'https://images.unsplash.com/photo-1534778101976-62847782c213?w=500&auto=format&fit=crop&q=80',
  cortado: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=500&auto=format&fit=crop&q=80',
  latte: 'https://images.unsplash.com/photo-1570968915860-54d5c301fa9f?w=500&auto=format&fit=crop&q=80',
  'flat white': 'https://images.unsplash.com/photo-1577968897966-3d4325b36b61?w=500&auto=format&fit=crop&q=80',
  capuccino: 'https://images.unsplash.com/photo-1534778101976-62847782c213?w=500&auto=format&fit=crop&q=80',
  cappuccino: 'https://images.unsplash.com/photo-1534778101976-62847782c213?w=500&auto=format&fit=crop&q=80',
  americano: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=500&auto=format&fit=crop&q=80',
  mocha: 'https://images.unsplash.com/photo-1578314675249-a6910f80cc4e?w=500&auto=format&fit=crop&q=80',
  default: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=500&auto=format&fit=crop&q=80'
};

export function obtenerImagenProducto(producto) {
  if (producto?.imagen && producto.imagen.trim().startsWith('http')) {
    return producto.imagen.trim();
  }

  const nombreNormalizado = (producto?.nombre || '').toLowerCase().trim();

  for (const [clave, url] of Object.entries(IMAGENES_POR_DEFECTO)) {
    if (nombreNormalizado.includes(clave)) {
      return url;
    }
  }

  return IMAGENES_POR_DEFECTO.default;
}

