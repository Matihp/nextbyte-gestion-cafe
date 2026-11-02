const crypto = require('crypto');
const { dbLocal } = require('../config/db');
const registroMermaRepository = require('../repositories/registroMermaRepository');
const productoRepository = require('../repositories/productoRepository');
const categoriaRepository = require('../repositories/categoriaRepository');
const AppError = require('../utils/AppError');
const { hoy } = require('../utils/fechas');
const { validarMerma, puedeDescontar } = require('../dtos/merma.dto');

const obtenerTodas = async (filtros = {}) => {
  return registroMermaRepository.getAll(filtros);
};

const obtenerPorId = async (id) => {
  const merma = await registroMermaRepository.getById(id);
  if (!merma) {
    throw new AppError('Merma no encontrada', 404, 'NO_ENCONTRADO');
  }
  return merma;
};

const crear = async (datos) => {
  const errores = validarMerma(datos);
  if (errores.length > 0) {
    throw new AppError(`Datos inválidos: ${errores.join(', ')}`, 400, 'VALIDACION');
  }

  const producto = await productoRepository.getById(datos.producto_id);
  if (!producto) {
    throw new AppError('Producto no encontrado', 404, 'NO_ENCONTRADO');
  }

  if (!puedeDescontar(producto.stock_actual, datos.cantidad)) {
    throw new AppError('No hay stock suficiente para registrar la merma', 409, 'STOCK_INSUFICIENTE');
  }

  const categoria = producto.categoria_id
    ? await categoriaRepository.getById(producto.categoria_id)
    : null;

  return dbLocal.transaction(async (trx) => {
    await productoRepository.updateStock(producto.id, -Number(datos.cantidad), trx);

    const nuevaMerma = await registroMermaRepository.create(
      {
        id: crypto.randomUUID(),
        producto_id: producto.id,
        nombre_producto: producto.nombre,
        nombre_categoria: categoria ? categoria.nombre : null,
        motivo: datos.motivo.trim(),
        fecha: datos.fecha || hoy(),
        cantidad: Number(datos.cantidad),
      },
      trx
    );

    return nuevaMerma;
  });
};

const eliminar = async (id) => {
  const merma = await registroMermaRepository.getById(id);
  if (!merma) {
    throw new AppError('Merma no encontrada', 404, 'NO_ENCONTRADO');
  }

  return dbLocal.transaction(async (trx) => {
    const producto = await productoRepository.getById(merma.producto_id, trx);
    if (producto) {
      await productoRepository.updateStock(producto.id, Number(merma.cantidad), trx);
    }

    await registroMermaRepository.delete(id, trx);
    return { id };
  });
};

module.exports = {
  obtenerTodas,
  obtenerPorId,
  crear,
  eliminar,
  validarMerma,
  puedeDescontar,
};

