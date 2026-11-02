const empleadoService = require('../services/empleadoService');
const { ok } = require('../utils/respuesta');

const getAll = async (req, res) => {
  const data = await empleadoService.obtenerTodos(req.query);
  return ok(res, data);
};

const getById = async (req, res) => {
  const data = await empleadoService.obtenerPorId(req.params.id);
  return ok(res, data);
};

const create = async (req, res) => {
  const data = await empleadoService.crear(req.body);
  return ok(res, data, 201);
};

const update = async (req, res) => {
  const data = await empleadoService.actualizar(req.params.id, req.body, req.user);
  return ok(res, data);
};

const remove = async (req, res) => {
  const data = await empleadoService.eliminar(req.params.id, req.user);
  return ok(res, data);
};

module.exports = {
  getAll,
  getById,
  create,
  update,
  remove
};

