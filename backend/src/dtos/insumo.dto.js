const { UNIDADES_MEDIDA } = require('../utils/constantes');
const { esFechaValida, hoy } = require('../utils/fechas');

const calcularEstadoStock = (insumo) => {
  if (!insumo) return 'ok';
  const cantidad = Number(insumo.cantidad_disponible);
  const stockMinimo = Number(insumo.stock_minimo);

  if (cantidad <= stockMinimo) {
    return 'critico';
  }

  if (cantidad <= stockMinimo * 1.5) {
    return 'bajo';
  }

  return 'ok';
};

const estaPorVencer = (insumo, fechaReferencia = hoy(), dias = 7) => {
  if (!insumo || !insumo.fecha_vencimiento) {
    return false;
  }

  const parseFecha = (valor) => {
    if (valor instanceof Date) {
      return Date.UTC(valor.getFullYear(), valor.getMonth(), valor.getDate());
    }
    const partes = String(valor).split('T')[0].split('-').map(Number);
    return Date.UTC(partes[0], partes[1] - 1, partes[2]);
  };

  const refMs = parseFecha(fechaReferencia);
  const vencMs = parseFecha(insumo.fecha_vencimiento);
  const diffDias = Math.round((vencMs - refMs) / (1000 * 60 * 60 * 24));

  return diffDias >= 0 && diffDias <= dias;
};

const validarInsumo = (body = {}) => {
  const errores = [];

  if (!body.nombre || typeof body.nombre !== 'string' || body.nombre.trim() === '') {
    errores.push('El nombre es obligatorio');
  }

  const cantidad = Number(body.cantidad_disponible);
  if (
    body.cantidad_disponible === undefined ||
    body.cantidad_disponible === null ||
    body.cantidad_disponible === '' ||
    Number.isNaN(cantidad) ||
    cantidad < 0
  ) {
    errores.push('cantidad_disponible debe ser un número mayor o igual a 0');
  }

  const stockMinimo = Number(body.stock_minimo);
  if (
    body.stock_minimo === undefined ||
    body.stock_minimo === null ||
    body.stock_minimo === '' ||
    Number.isNaN(stockMinimo) ||
    stockMinimo < 0
  ) {
    errores.push('stock_minimo debe ser un número mayor o igual a 0');
  }

  const precioCosto = Number(body.precio_costo);
  if (
    body.precio_costo === undefined ||
    body.precio_costo === null ||
    body.precio_costo === '' ||
    Number.isNaN(precioCosto) ||
    precioCosto <= 0
  ) {
    errores.push('precio_costo debe ser un número mayor a 0');
  }

  if (!body.unidad_medida || !UNIDADES_MEDIDA.includes(body.unidad_medida)) {
    errores.push(`unidad_medida debe ser una de las siguientes: ${UNIDADES_MEDIDA.join(', ')}`);
  }

  if (body.fecha_ingreso && !esFechaValida(body.fecha_ingreso)) {
    errores.push('fecha_ingreso debe tener formato YYYY-MM-DD');
  }

  if (body.fecha_vencimiento && !esFechaValida(body.fecha_vencimiento)) {
    errores.push('fecha_vencimiento debe tener formato YYYY-MM-DD');
  }

  if (
    body.fecha_ingreso &&
    body.fecha_vencimiento &&
    esFechaValida(body.fecha_ingreso) &&
    esFechaValida(body.fecha_vencimiento) &&
    body.fecha_vencimiento < body.fecha_ingreso
  ) {
    errores.push('La fecha de vencimiento no puede ser anterior a la fecha de ingreso');
  }

  return errores;
};

const validarIngreso = (body = {}) => {
  const errores = [];
  const cantidad = Number(body.cantidad);

  if (
    body.cantidad === undefined ||
    body.cantidad === null ||
    body.cantidad === '' ||
    Number.isNaN(cantidad) ||
    cantidad <= 0
  ) {
    errores.push('La cantidad debe ser un número mayor a 0');
  }

  return errores;
};

module.exports = {
  calcularEstadoStock,
  estaPorVencer,
  validarInsumo,
  validarIngreso,
};

