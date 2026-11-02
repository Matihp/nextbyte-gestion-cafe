const crypto = require('crypto');
const AppError = require('../utils/AppError');
const { ESTADOS_PEDIDO } = require('../utils/constantes');
const { hoy, ahora } = require('../utils/fechas');
const { validarPedido } = require('../dtos/pedido.dto');
const pedidoRepository = require('../repositories/pedidoRepository');
const detallePedidoRepository = require('../repositories/detallePedidoRepository');
const productoRepository = require('../repositories/productoRepository');
const recetaRepository = require('../repositories/recetaRepository');
const ingredienteRecetaRepository = require('../repositories/ingredienteRecetaRepository');
const insumoRepository = require('../repositories/insumoRepository');

const generarIdPedido = () => {
  const hex = crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
  return `PED-${hex}`;
};

const calcularTotal = (items = []) => {
  const total = items.reduce((acc, item) => {
    const cantidad = Number(item.cantidad || 0);
    const precio = Number(item.precio_venta || 0);
    return acc + cantidad * precio;
  }, 0);
  return Number(total.toFixed(2));
};

const calcularCostoUnitario = (ingredientes = []) => {
  if (!Array.isArray(ingredientes) || ingredientes.length === 0) return 0;
  const costo = ingredientes.reduce((acc, ing) => {
    const cantidad = Number(ing.cantidad || 0);
    const precioCosto = Number(ing.precio_costo ?? ing.insumo?.precio_costo ?? 0);
    return acc + cantidad * precioCosto;
  }, 0);
  return Number(costo.toFixed(2));
};

const crear = async (datos) => {
  const errores = validarPedido(datos);
  if (errores.length > 0) {
    throw new AppError(`Datos inválidos: ${errores.join(', ')}`, 400, 'VALIDACION');
  }

  const detalles = [];

  for (const item of datos.items) {
    const producto = await productoRepository.getById(item.producto_id);
    if (!producto) {
      throw new AppError(`El producto con id ${item.producto_id} no existe`, 404, 'NO_ENCONTRADO');
    }

    const receta = await recetaRepository.getByProductoId(producto.id);
    let precioCosto = 0;

    if (receta) {
      const ingredientes = await ingredienteRecetaRepository.getByRecetaId(receta.id);
      const ingredientesConCosto = await Promise.all(
        ingredientes.map(async (ing) => {
          const insumo = await insumoRepository.getById(ing.insumo_id);
          return {
            cantidad: ing.cantidad,
            precio_costo: insumo ? insumo.precio_costo : 0
          };
        })
      );
      precioCosto = calcularCostoUnitario(ingredientesConCosto);
    }

    detalles.push({
      producto_id: producto.id,
      nombre_producto: producto.nombre,
      cantidad: item.cantidad,
      precio_venta: Number(producto.precio_venta),
      precio_costo: precioCosto
    });
  }

  const total = calcularTotal(detalles);

  const cliente = (datos.cliente && typeof datos.cliente === 'string' && datos.cliente.trim() !== '')
    ? datos.cliente.trim()
    : 'Consumidor Final';

  const cabecera = {
    id: generarIdPedido(),
    cliente,
    total,
    estado: ESTADOS_PEDIDO.PENDIENTE,
    tipo_pedido: datos.tipo_pedido,
    metodo_pago: datos.metodo_pago,
    direccion: datos.direccion ? datos.direccion.trim() : null,
    telefono: datos.telefono ? datos.telefono.trim() : null,
    fecha: hoy(),
    hora: ahora()
  };

  return pedidoRepository.createWithDetails(cabecera, detalles);
};

const obtenerTodos = async (filtros = {}) => {
  return pedidoRepository.getAll(filtros);
};

const obtenerPorId = async (id) => {
  const pedido = await pedidoRepository.getWithDetails(id);
  if (!pedido) {
    throw new AppError('Pedido no encontrado', 404, 'NO_ENCONTRADO');
  }
  return pedido;
};

const cancelar = async (id) => {
  const pedido = await pedidoRepository.getById(id);
  if (!pedido) {
    throw new AppError('Pedido no encontrado', 404, 'NO_ENCONTRADO');
  }

  if (pedido.estado === ESTADOS_PEDIDO.COMPLETADO || pedido.estado === ESTADOS_PEDIDO.CANCELADO) {
    throw new AppError('No se puede cancelar un pedido completado o cancelado', 409, 'ESTADO_INVALIDO');
  }

  await pedidoRepository.updateStatus(id, ESTADOS_PEDIDO.CANCELADO);
  return pedidoRepository.getWithDetails(id);
};

const eliminarItem = async (pedidoId, detalleId) => {
  const pedido = await pedidoRepository.getWithDetails(pedidoId);
  if (!pedido) {
    throw new AppError('Pedido no encontrado', 404, 'NO_ENCONTRADO');
  }

  if (pedido.estado === ESTADOS_PEDIDO.COMPLETADO || pedido.estado === ESTADOS_PEDIDO.CANCELADO) {
    throw new AppError('No se puede modificar un pedido completado o cancelado', 409, 'ESTADO_INVALIDO');
  }

  const detalles = Array.isArray(pedido.detalles) ? pedido.detalles : [];
  const detalleExiste = detalles.find((d) => d.id === detalleId);
  if (!detalleExiste) {
    throw new AppError('El ítem no existe o no pertenece al pedido', 404, 'NO_ENCONTRADO');
  }

  await detallePedidoRepository.delete(detalleId);

  const restantes = detalles.filter((d) => d.id !== detalleId);

  if (restantes.length === 0) {
    await pedidoRepository.update(pedidoId, {
      total: 0,
      estado: ESTADOS_PEDIDO.CANCELADO
    });
  } else {
    const nuevoTotal = calcularTotal(restantes);
    await pedidoRepository.update(pedidoId, {
      total: nuevoTotal
    });
  }

  return pedidoRepository.getWithDetails(pedidoId);
};

module.exports = {
  generarIdPedido,
  calcularTotal,
  calcularCostoUnitario,
  crear,
  obtenerTodos,
  obtenerPorId,
  cancelar,
  eliminarItem
};

