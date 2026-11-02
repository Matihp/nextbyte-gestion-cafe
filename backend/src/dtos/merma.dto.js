const { esFechaValida } = require('../utils/fechas');

const puedeDescontar = (stockActual, cantidad) => {
  const stock = Number(stockActual);
  const cant = Number(cantidad);

  if (Number.isNaN(stock) || Number.isNaN(cant)) {
    return false;
  }

  return stock >= cant && cant > 0;
};

const validarMerma = (body = {}) => {
  const errores = [];

  const productoId = Number(body.producto_id);
  if (
    body.producto_id === undefined ||
    body.producto_id === null ||
    body.producto_id === '' ||
    Number.isNaN(productoId) ||
    !Number.isInteger(productoId) ||
    productoId <= 0
  ) {
    errores.push('producto_id debe ser un número entero mayor a 0');
  }

  const cantidad = Number(body.cantidad);
  if (
    body.cantidad === undefined ||
    body.cantidad === null ||
    body.cantidad === '' ||
    Number.isNaN(cantidad) ||
    !Number.isInteger(cantidad) ||
    cantidad <= 0
  ) {
    errores.push('cantidad debe ser un número entero mayor a 0');
  }

  if (!body.motivo || typeof body.motivo !== 'string' || body.motivo.trim() === '') {
    errores.push('El motivo es obligatorio');
  }

  if (body.fecha !== undefined && body.fecha !== null && String(body.fecha).trim() !== '') {
    if (!esFechaValida(body.fecha)) {
      errores.push('fecha debe tener formato YYYY-MM-DD');
    }
  }

  return errores;
};

module.exports = {
  puedeDescontar,
  validarMerma,
};

