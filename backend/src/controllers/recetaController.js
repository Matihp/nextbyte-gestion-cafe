const recetaService = require('../services/recetaService');
const { ok } = require('../utils/respuesta');

const getAll = async (req, res) => {
  const data = await recetaService.getAll();
  return ok(res, data);
};

const getById = async (req, res) => {
  const data = await recetaService.getById(req.params.id);
  return ok(res, data);
};

const getByProductoId = async (req, res) => {
  const data = await recetaService.getByProductoId(req.params.id);
  return ok(res, data);
};

const create = async (req, res) => {
  const data = await recetaService.crearReceta(req.body);
  return ok(res, data, 201);
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
  getAll,
  getById,
  getByProductoId,
  create,
  update,
  delete: remove,
  remove
};
