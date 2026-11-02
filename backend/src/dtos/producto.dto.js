const validarProducto = (body = {}) => {
  const errores = [];

  if (!body || typeof body.nombre !== 'string' || body.nombre.trim() === '') {
    errores.push('El nombre es obligatorio');
  } else if (body.nombre.trim().length > 100) {
    errores.push('El nombre no puede tener más de 100 caracteres');
  }

  const categoriaId = Number(body && body.categoria_id);
  if (
    !body ||
    body.categoria_id === undefined ||
    body.categoria_id === null ||
    body.categoria_id === '' ||
    Number.isNaN(categoriaId) ||
    !Number.isInteger(categoriaId) ||
    categoriaId <= 0
  ) {
    errores.push('La categoría es obligatoria');
  }

  const precioVenta = Number(body && body.precio_venta);
  if (
    !body ||
    body.precio_venta === undefined ||
    body.precio_venta === null ||
    body.precio_venta === '' ||
    Number.isNaN(precioVenta) ||
    precioVenta <= 0
  ) {
    errores.push('El precio de venta debe ser un número mayor a 0');
  }

  if (body && body.stock_actual !== undefined && body.stock_actual !== null && body.stock_actual !== '') {
    const stockActual = Number(body.stock_actual);
    if (Number.isNaN(stockActual) || !Number.isInteger(stockActual) || stockActual < 0) {
      errores.push('El stock actual debe ser un número entero mayor o igual a 0');
    }
  }

  if (body && body.imagen !== undefined && body.imagen !== null && typeof body.imagen !== 'string') {
    errores.push('La imagen debe ser una cadena de texto');
  }

  return errores;
};

module.exports = {
  validarProducto
};

