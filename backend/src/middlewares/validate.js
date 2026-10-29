const AppError = require('../utils/AppError');

const validate = (fn) => (req, res, next) => {
  const errores = fn(req.body || {});
  if (errores.length > 0) {
    throw new AppError(`Datos inválidos: ${errores.join(', ')}`, 400, 'VALIDACION');
  }
  next();
};

module.exports = validate;
