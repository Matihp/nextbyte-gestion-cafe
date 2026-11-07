const productoService = require('../services/productoService');
const { ok } = require('../utils/respuesta');

const getAll = async (req, res) => {
  const data = await productoService.getAll(req.query);
  return ok(res, data);
};

const getById = async (req, res) => {
  const data = await productoService.getById(req.params.id);
  return ok(res, data);
};

const create = async (req, res) => {
  const data = await productoService.create(req.body);
  return ok(res, data, 201);
};

const update = async (req, res) => {
  const data = await productoService.update(req.params.id, req.body);
  return ok(res, data);
};

const remove = async (req, res) => {
  const motivo = req.body?.motivo || req.query?.motivo || null;
  const data = await productoService.delete(req.params.id, motivo);
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

