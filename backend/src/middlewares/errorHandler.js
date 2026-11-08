const AppError = require('../utils/AppError');
const { databaseMode } = require('../config/db');
const { isCloudUnavailable } = require('../config/databaseErrors');

const notFound = (req, res) => {
  res.status(404).json({ success: false, error: 'NO_ENCONTRADO', message: 'Ruta no encontrada' });
};

const errorHandler = (err, req, res, next) => {
  if (err instanceof AppError) {
    return res.status(err.status).json({ success: false, error: err.code, message: err.message });
  }

  if (databaseMode === 'cloud' && (isCloudUnavailable(err) || err.name === 'KnexTimeoutError' || err.code === 'BLOCKED')) {
    const quota = err.code === 'BLOCKED';
    const write = !['GET', 'HEAD', 'OPTIONS'].includes(req.method);
    console.error('[Base de datos no disponible]', { code: err.code || err.name, method: req.method, path: req.path });
    res.set('Retry-After', '5');
    return res.status(503).json({
      success: false,
      error: quota ? 'CUOTA_TURSO' : 'BASE_NO_DISPONIBLE',
      message: quota ? 'Turso bloqueó consultas por un límite del servicio. Revisá el consumo de la cuenta.' : write
        ? 'No se pudo confirmar la operación con Turso. Actualizá los datos antes de reintentar; no se guardó en otra base.'
        : 'Turso no está disponible temporalmente. Reintentá la consulta en unos segundos.',
      resultadoIncierto: write && !quota
    });
  }

  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      success: false,
      error: 'JSON_INVALIDO',
      message: 'El cuerpo de la petición no es un JSON válido'
    });
  }

  if (String(err.code || '').startsWith('SQLITE_CONSTRAINT')) {
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
