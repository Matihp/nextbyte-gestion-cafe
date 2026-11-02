const validarCategoria = (body = {}) => {
  const errores = [];

  if (!body || typeof body.nombre !== 'string' || body.nombre.trim() === '') {
    errores.push('El nombre es obligatorio');
  } else if (body.nombre.trim().length > 100) {
    errores.push('El nombre no puede tener más de 100 caracteres');
  }

  if (body && body.icono !== undefined && body.icono !== null && typeof body.icono !== 'string') {
    errores.push('El icono debe ser una cadena de texto');
  }

  return errores;
};

module.exports = {
  validarCategoria
};

