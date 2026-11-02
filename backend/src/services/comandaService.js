const { ESTADOS_PEDIDO, ESTADOS_ACTIVOS } = require('../utils/constantes');
const AppError = require('../utils/AppError');
const pedidoRepository = require('../repositories/pedidoRepository');
const detallePedidoRepository = require('../repositories/detallePedidoRepository');

const TRANSICIONES_PERMITIDAS = {
  [ESTADOS_PEDIDO.PENDIENTE]: [ESTADOS_PEDIDO.EN_PREPARACION],
  [ESTADOS_PEDIDO.EN_PREPARACION]: [ESTADOS_PEDIDO.EN_EMPAQUE]
};

const puedeTransicionar = (estadoActual, estadoNuevo) => {
  const permitidos = TRANSICIONES_PERMITIDAS[estadoActual];
  if (!permitidos) {
    return false;
  }
  return permitidos.includes(estadoNuevo);
};

const obtenerActivas = async () => {
  const pedidos = await pedidoRepository.getByEstados(ESTADOS_ACTIVOS);
  const pedidosConDetalles = await Promise.all(
    pedidos.map(async (pedido) => {
      const detalles = await detallePedidoRepository.getByPedidoId(pedido.id);
      return {
        ...pedido,
        detalles
      };
    })
  );
  return pedidosConDetalles;
};

const cambiarEstado = async (id, nuevoEstado) => {
  const todosLosEstados = Object.values(ESTADOS_PEDIDO);
  if (!nuevoEstado || typeof nuevoEstado !== 'string' || !todosLosEstados.includes(nuevoEstado)) {
    throw new AppError('El estado proporcionado no es válido', 400, 'VALIDACION');
  }

  const pedido = await pedidoRepository.getById(id);
  if (!pedido) {
    throw new AppError('Pedido inexistente', 404, 'NO_ENCONTRADO');
  }

  if (!puedeTransicionar(pedido.estado, nuevoEstado)) {
    throw new AppError(`No se puede pasar de ${pedido.estado} a ${nuevoEstado}`, 409, 'TRANSICION_INVALIDA');
  }

  await pedidoRepository.updateStatus(id, nuevoEstado);
  return await pedidoRepository.getWithDetails(id);
};

module.exports = {
  puedeTransicionar,
  obtenerActivas,
  cambiarEstado
};

