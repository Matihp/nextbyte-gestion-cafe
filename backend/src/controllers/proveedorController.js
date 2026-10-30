const proveedorService = require('../services/proveedorService');
const { ok } = require('../utils/respuesta');

const obtenerTodos = async (req, res) => {
  const proveedores = await proveedorService.obtenerTodos();
  return ok(res, proveedores);
};

const obtenerPorId = async (req, res) => {
  const proveedor = await proveedorService.obtenerPorId(req.params.id);
  return ok(res, proveedor);
};

const crear = async (req, res) => {
  const proveedor = await proveedorService.crear(req.body);
  return ok(res, proveedor, 201);
};

const actualizar = async (req, res) => {
  const proveedor = await proveedorService.actualizar(req.params.id, req.body);
  return ok(res, proveedor);
};

const eliminar = async (req, res) => {
  const resultado = await proveedorService.eliminar(req.params.id);
  return ok(res, resultado);
};

module.exports = {
  obtenerTodos,
  obtenerPorId,
  crear,
  actualizar,
  eliminar,
};

