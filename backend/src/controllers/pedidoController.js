const pedidoService = require('../services/pedidoService');
const { ok } = require('../utils/respuesta');

const getAll = async (req, res) => {
  const data = await pedidoService.obtenerTodos(req.query);
  return ok(res, data);
};

const getById = async (req, res) => {
  const data = await pedidoService.obtenerPorId(req.params.id);
  return ok(res, data);
};

const create = async (req, res) => {
  const data = await pedidoService.crear(req.body, {
    idempotencyKey: req.get('Idempotency-Key')
  });
  return ok(res, data, 201);
};

const cancelar = async (req, res) => {
  const data = await pedidoService.cancelar(req.params.id, req.body);
  return ok(res, data);
};

const eliminarItem = async (req, res) => {
  const data = await pedidoService.eliminarItem(req.params.id, req.params.detalleId, req.body);
  return ok(res, data);
};

module.exports = {
  getAll,
  getById,
  create,
  cancelar,
  eliminarItem
};

