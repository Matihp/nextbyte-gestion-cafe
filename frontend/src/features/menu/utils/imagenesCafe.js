/**
 * Utilidad de imágenes de productos.
 * Resuelve la URL de la imagen del producto priorizando Cloudinary / URLs válidas.
 * Soporta tanto `producto.imagen` como `producto.image`.
 */

export function obtenerImagenProducto(producto) {
  if (!producto) return null;
  const url = producto.imagen || producto.image;
  if (url && typeof url === 'string') {
    const trimmed = url.trim();
    if (
      trimmed.startsWith('http://') ||
      trimmed.startsWith('https://') ||
      trimmed.startsWith('data:') ||
      trimmed.startsWith('/')
    ) {
      return trimmed;
    }
  }
  return null;
}

