const insumoService = require('../services/insumoService');
const { ok } = require('../utils/respuesta');

const obtenerTodos = async (req, res) => {
  const insumos = await insumoService.obtenerTodos();
  return ok(res, insumos);
};

const obtenerAlertas = async (req, res) => {
  const alertas = await insumoService.obtenerAlertas();
  return ok(res, alertas);
};

const obtenerPorId = async (req, res) => {
  const insumo = await insumoService.obtenerPorId(req.params.id);
  return ok(res, insumo);
};

const crear = async (req, res) => {
  const insumo = await insumoService.crear(req.body);
  return ok(res, insumo, 201);
};

const actualizar = async (req, res) => {
  const insumo = await insumoService.actualizar(req.params.id, req.body);
  return ok(res, insumo);
};

const ingresarStock = async (req, res) => {
  const insumo = await insumoService.ingresarStock(req.params.id, req.body.cantidad);
  return ok(res, insumo);
};

const eliminar = async (req, res) => {
  const resultado = await insumoService.eliminar(req.params.id);
  return ok(res, resultado);
};

module.exports = {
  obtenerTodos,
  obtenerAlertas,
  obtenerPorId,
  crear,
  actualizar,
  ingresarStock,
  eliminar,
};

