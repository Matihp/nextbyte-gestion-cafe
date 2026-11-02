const recetaService = require('../services/recetaService');
const { ok } = require('../utils/respuesta');

const getByProductoId = async (req, res) => {
  const data = await recetaService.getByProductoId(req.params.id);
  return ok(res, data);
};

const update = async (req, res) => {
  const data = await recetaService.guardar(req.params.id, req.body);
  return ok(res, data);
};

const remove = async (req, res) => {
  const data = await recetaService.eliminar(req.params.id);
  return ok(res, data);
};

module.exports = {
  getByProductoId,
  update,
  delete: remove,
  remove
};

