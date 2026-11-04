const usuarioService = require('../services/usuarioService');
const { ok } = require('../utils/respuesta');

const getAll = async (req, res) => {
  const data = await usuarioService.obtenerTodos();
  return ok(res, data);
};

const getById = async (req, res) => {
  const data = await usuarioService.obtenerPorId(req.params.id);
  return ok(res, data);
};

const create = async (req, res) => {
  const data = await usuarioService.crear(req.body);
  return ok(res, data, 201);
};

const update = async (req, res) => {
  const data = await usuarioService.actualizar(req.params.id, req.body, req.user);
  return ok(res, data);
};

const remove = async (req, res) => {
  const data = await usuarioService.eliminar(req.params.id, req.user);
  return ok(res, data);
};

const cambiarRol = async (req, res) => {
  const data = await usuarioService.cambiarRol(req.params.id, req.body.rol_id);
  return ok(res, data);
};

const cambiarPermisos = async (req, res) => {
  const data = await usuarioService.cambiarPermisos(req.params.id, req.body.permisos);
  return ok(res, data);
};

module.exports = {
  getAll,
  getById,
  create,
  update,
  remove,
  cambiarRol,
  cambiarPermisos
};
