const categoriaService = require('../services/categoriaService');
const { ok } = require('../utils/respuesta');

const getAll = async (req, res) => {
  const data = await categoriaService.getAll();
  return ok(res, data);
};

const getById = async (req, res) => {
  const data = await categoriaService.getById(req.params.id);
  return ok(res, data);
};

const create = async (req, res) => {
  const data = await categoriaService.create(req.body);
  return ok(res, data, 201);
};

const update = async (req, res) => {
  const data = await categoriaService.update(req.params.id, req.body);
  return ok(res, data);
};

const remove = async (req, res) => {
  const data = await categoriaService.delete(req.params.id);
  return ok(res, data);
};

module.exports = {
  getAll,
  getById,
  create,
  update,
  delete: remove,
  remove
};

