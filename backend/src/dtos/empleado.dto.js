const esEmailValido = (email) => {
  if (typeof email !== 'string') return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
};

const quitarContrasena = (empleado) => {
  if (!empleado) return empleado;
  if (Array.isArray(empleado)) {
    return empleado.map(quitarContrasena);
  }
  const { contrasena, ...resto } = empleado;
  return resto;
};

const validarEmpleado = (body = {}, { esEdicion = false } = {}) => {
  const errores = [];
  const {
    nombre,
    apellido,
    legajo,
    email,
    contrasena,
    dias_franco,
    permisos
  } = body;

  if (!nombre || typeof nombre !== 'string' || nombre.trim() === '') {
    errores.push('El nombre es obligatorio');
  }

  if (!apellido || typeof apellido !== 'string' || apellido.trim() === '') {
    errores.push('El apellido es obligatorio');
  }

  if (!legajo || typeof legajo !== 'string' || legajo.trim() === '') {
    errores.push('El legajo es obligatorio');
  }

  if (!email || typeof email !== 'string' || email.trim() === '') {
    errores.push('El email es obligatorio');
  } else if (!esEmailValido(email)) {
    errores.push('El formato del email es inválido');
  }

  if (!esEdicion) {
    if (!contrasena || typeof contrasena !== 'string' || contrasena.trim() === '') {
      errores.push('La contraseña es obligatoria');
    } else if (contrasena.length < 6) {
      errores.push('La contraseña debe tener al menos 6 caracteres');
    }
  } else if (contrasena !== undefined && contrasena !== null && contrasena !== '') {
    if (typeof contrasena !== 'string' || contrasena.length < 6) {
      errores.push('La contraseña debe tener al menos 6 caracteres');
    }
  }

  if (dias_franco !== undefined && !Array.isArray(dias_franco)) {
    errores.push('Los días franco deben ser una lista');
  }

  if (permisos !== undefined && !Array.isArray(permisos)) {
    errores.push('Los permisos deben ser una lista');
  }

  return errores;
};

module.exports = {
  esEmailValido,
  quitarContrasena,
  validarEmpleado
};

