const rolService = require('../services/rolService');
const { ok } = require('../utils/respuesta');

const getAll = async (req, res) => {
  const data = await rolService.getAll();
  return ok(res, data);
};

const getById = async (req, res) => {
  const data = await rolService.getById(req.params.id);
  return ok(res, data);
};

const create = async (req, res) => {
  const data = await rolService.create(req.body);
  return ok(res, data, 201);
};

const update = async (req, res) => {
  const data = await rolService.update(req.params.id, req.body);
  return ok(res, data);
};

const remove = async (req, res) => {
  const data = await rolService.delete(req.params.id);
  return ok(res, data);
};

module.exports = {
  getAll,
  getById,
  create,
  update,
  remove
};

