const cajaService = require('../services/cajaService');
const { ok } = require('../utils/respuesta');

const listarMovimientos = async (req, res) => {
  const movimientos = await cajaService.listarMovimientos(req.query);
  return ok(res, movimientos);
};

const crearMovimiento = async (req, res) => {
  const rawId = req.user?.id;
  const usuarioId = rawId && rawId !== 'dev' ? rawId : null;
  const movimiento = await cajaService.crearMovimiento(req.body, usuarioId);
  return ok(res, movimiento, 201);
};

const eliminarMovimiento = async (req, res) => {
  const resultado = await cajaService.eliminarMovimiento(req.params.id);
  return ok(res, resultado);
};

const getSaldoAnterior = async (req, res) => {
  const resultado = await cajaService.getSaldoAnterior(req.query.mes);
  return ok(res, resultado);
};

const getMermasMes = async (req, res) => {
  const mermas = await cajaService.getMermasMes(req.query.mes);
  return ok(res, mermas);
};

module.exports = {
  listarMovimientos,
  crearMovimiento,
  eliminarMovimiento,
  getSaldoAnterior,
  getMermasMes,
};
