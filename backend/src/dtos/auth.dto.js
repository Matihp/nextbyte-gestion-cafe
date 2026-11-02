const validarLogin = (body = {}) => {
  const errores = [];
  const { email, contrasena } = body;

  if (!email || typeof email !== 'string' || email.trim() === '') {
    errores.push('El email es obligatorio');
  }

  if (!contrasena || typeof contrasena !== 'string' || contrasena.trim() === '') {
    errores.push('La contraseña es obligatoria');
  }

  return errores;
};

module.exports = {
  validarLogin
};

