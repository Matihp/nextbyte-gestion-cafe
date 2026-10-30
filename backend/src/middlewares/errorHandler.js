const AppError = require('../utils/AppError');

const notFound = (req, res) => {
  res.status(404).json({ success: false, error: 'NO_ENCONTRADO', message: 'Ruta no encontrada' });
};

const errorHandler = (err, req, res, next) => {
  if (err instanceof AppError) {
    return res.status(err.status).json({ success: false, error: err.code, message: err.message });
  }

  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      success: false,
      error: 'JSON_INVALIDO',
      message: 'El cuerpo de la petición no es un JSON válido'
    });
  }

  if (err.code === 'SQLITE_CONSTRAINT') {
    const detalle = String(err.message || '');
    if (detalle.includes('UNIQUE')) {
      return res.status(409).json({
        success: false,
        error: 'DUPLICADO',
        message: 'Ya existe un registro con esos datos'
      });
    }
    if (detalle.includes('FOREIGN KEY')) {
      return res.status(409).json({
        success: false,
        error: 'RELACION',
        message: 'No se puede completar la operación: hay registros relacionados'
      });
    }
  }

  console.error('[Error no controlado]:', err);
  res.status(500).json({
    success: false,
    error: 'ERROR_INTERNO',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Ocurrió un error interno en el servidor'
  });
};

module.exports = { notFound, errorHandler };
