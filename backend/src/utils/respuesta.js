/**
 * Formato único de respuesta exitosa de toda la API: { success: true, data }.
 * Las respuestas de error las arma middlewares/errorHandler.js.
 */
const ok = (res, data, status = 200) => res.status(status).json({ success: true, data });

module.exports = { ok };
