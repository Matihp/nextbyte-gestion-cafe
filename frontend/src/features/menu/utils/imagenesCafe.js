/**
 * Utilidad de imágenes de productos.
 * Solo devuelve la URL real si el producto tiene una imagen válida asignada.
 * No utiliza imágenes mock ni hardcodeadas.
 */

export function obtenerImagenProducto(producto) {
  if (producto?.imagen && typeof producto.imagen === 'string' && producto.imagen.trim().startsWith('http')) {
    return producto.imagen.trim();
  }
  return null;
}
