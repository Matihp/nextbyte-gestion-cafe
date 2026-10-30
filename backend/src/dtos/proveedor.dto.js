const AppError = require('../utils/AppError');

const patronEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalizarIdsInsumos = (ids = []) => {
  if (!Array.isArray(ids)) {
    throw new AppError('insumos_asignados_ids debe ser un array', 400, 'VALIDACION');
  }

  const vistos = new Set();
  const resultado = [];

  for (const elemento of ids) {
    const numero = Number(elemento);
    if (
      elemento === null ||
      elemento === '' ||
      typeof elemento === 'boolean' ||
      Number.isNaN(numero) ||
      !Number.isInteger(numero)
    ) {
      throw new AppError('Los IDs de insumos deben ser números enteros', 400, 'VALIDACION');
    }

    if (!vistos.has(numero)) {
      vistos.add(numero);
      resultado.push(numero);
    }
  }

  return resultado;
};

const validarProveedor = (body = {}) => {
  const errores = [];

  if (!body.codigo || typeof body.codigo !== 'string' || body.codigo.trim() === '') {
    errores.push('El código es obligatorio');
  }

  if (!body.empresa || typeof body.empresa !== 'string' || body.empresa.trim() === '') {
    errores.push('La empresa es obligatoria');
  }

  if (body.email !== undefined && body.email !== null && String(body.email).trim() !== '') {
    if (typeof body.email !== 'string' || !patronEmail.test(body.email.trim())) {
      errores.push('El email debe tener un formato válido');
    }
  }

  if (body.insumos_asignados_ids !== undefined && body.insumos_asignados_ids !== null) {
    if (!Array.isArray(body.insumos_asignados_ids)) {
      errores.push('insumos_asignados_ids debe ser un array');
    } else {
      try {
        normalizarIdsInsumos(body.insumos_asignados_ids);
      } catch (error) {
        errores.push(error.message);
      }
    }
  }

  return errores;
};

module.exports = {
  validarProveedor,
  normalizarIdsInsumos,
};

