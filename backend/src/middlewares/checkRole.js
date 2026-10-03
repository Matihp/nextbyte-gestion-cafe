/**
 * Middleware para validar el Rol de la computadora en caso de corte de red.
 * Si no hay internet y la PC no es "Caja Principal", se debe bloquear la operación.
 */
const checkRoleOffline = (req, res, next) => {
  // Si hay internet, no hace falta validar rol para el modo emergencia
  if (req.isOnline) {
    return next();
  }

  // Si estamos offline, vemos el rol de la PC
  const appRole = process.env.APP_ROLE || 'SECUNDARIA';
  
  if (appRole !== 'CAJA_PRINCIPAL') {
    return res.status(403).json({
      success: false,
      error: 'SIN_CONEXION',
      message: 'Sin conexión a internet. Su rol no permite guardar datos de emergencia.'
    });
  }

  next();
};

module.exports = checkRoleOffline;
