const { esFechaValida } = require('../utils/fechas');

const validarFecha = (fecha) => {
  const errores = [];
  if (!fecha || typeof fecha !== 'string' || !esFechaValida(fecha)) {
    errores.push('La fecha no es válida (formato requerido: YYYY-MM-DD)');
  }
  return errores;
};

const validarRangoFechas = (desde, hasta) => {
  const errores = [];

  if (!desde || typeof desde !== 'string' || !esFechaValida(desde)) {
    errores.push('La fecha "desde" no es válida (formato requerido: YYYY-MM-DD)');
  }

  if (!hasta || typeof hasta !== 'string' || !esFechaValida(hasta)) {
    errores.push('La fecha "hasta" no es válida (formato requerido: YYYY-MM-DD)');
  }

  if (errores.length === 0 && desde > hasta) {
    errores.push('La fecha "desde" no puede ser posterior a "hasta"');
  }

  return errores;
};

const validarLimit = (limit) => {
  const errores = [];
  if (limit !== undefined && limit !== null && limit !== '') {
    const numero = Number(limit);
    if (!Number.isInteger(numero) || numero < 1 || numero > 50) {
      errores.push('El límite debe ser un número entero entre 1 y 50');
    }
  }
  return errores;
};

module.exports = {
  validarFecha,
  validarRangoFechas,
  validarLimit
};

