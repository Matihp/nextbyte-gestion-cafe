const comandaService = require('../services/comandaService');
const { ok } = require('../utils/respuesta');

const obtenerActivas = async (req, res) => {
  const data = await comandaService.obtenerActivas();
  return ok(res, data);
};

const cambiarEstado = async (req, res) => {
  const data = await comandaService.cambiarEstado(req.params.id, req.body?.estado);
  return ok(res, data);
};

module.exports = {
  obtenerActivas,
  cambiarEstado
};

