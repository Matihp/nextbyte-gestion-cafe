const validarPermisos = (permisos) => {
  const errores = [];

  if (!Array.isArray(permisos)) {
    errores.push('Los permisos deben ser una lista');
    return errores;
  }

  const hayInvalidos = permisos.some((p) => typeof p !== 'string' || p.trim() === '');
  if (hayInvalidos) {
    errores.push('Cada permiso debe ser un texto no vacío');
  }

  return errores;
};

const validarRol = (body = {}) => {
  const errores = [];
  const { nombre, es_admin, permisos } = body;

  if (!nombre || typeof nombre !== 'string' || nombre.trim() === '') {
    errores.push('El nombre es obligatorio');
  }

  if (es_admin !== undefined && typeof es_admin !== 'boolean') {
    errores.push('El campo es_admin debe ser un booleano');
  }

  if (permisos !== undefined) {
    const erroresPermisos = validarPermisos(permisos);
    errores.push(...erroresPermisos);
  }

  return errores;
};

const validarCambioRol = (body = {}) => {
  const errores = [];
  const { rol_id } = body;

  if (!rol_id || typeof rol_id !== 'string' || rol_id.trim() === '') {
    errores.push('El rol_id es obligatorio');
  }

  return errores;
};

const validarCambioPermisos = (body = {}) => {
  const errores = [];
  const { permisos } = body;

  if (permisos === undefined) {
    errores.push('Los permisos son obligatorios');
    return errores;
  }

  const erroresPermisos = validarPermisos(permisos);
  errores.push(...erroresPermisos);

  return errores;
};

module.exports = {
  validarPermisos,
  validarRol,
  validarCambioRol,
  validarCambioPermisos
};

