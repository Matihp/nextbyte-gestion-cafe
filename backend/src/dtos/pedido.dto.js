const { TIPOS_PEDIDO, METODOS_PAGO, ESTADOS_PEDIDO } = require('../utils/constantes');

const tiposValidos = [...new Set([...TIPOS_PEDIDO, 'salon'])];

const validarPedido = (body = {}) => {
  const errores = [];
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return ['El pedido debe ser un objeto'];
  }
  const { tipo_pedido, metodo_pago, direccion, telefono, items, estado } = body;

  if (estado !== undefined && ![ESTADOS_PEDIDO.PENDIENTE, ESTADOS_PEDIDO.EN_PREPARACION].includes(estado)) {
    errores.push('El estado inicial debe ser pendiente o en_preparacion');
  }
  if (direccion != null && typeof direccion !== 'string') {
    errores.push('La dirección debe ser una cadena de texto');
  }
  if (telefono != null && typeof telefono !== 'string') {
    errores.push('El teléfono debe ser una cadena de texto');
  }

  if (!tipo_pedido || !tiposValidos.includes(tipo_pedido)) {
    errores.push('El tipo de pedido es inválido');
  }

  const metodoNormalizado = typeof metodo_pago === 'string' ? metodo_pago.trim().toLowerCase() : '';
  const esMetodoValido = METODOS_PAGO.includes(metodoNormalizado) || metodoNormalizado.startsWith('otros');
  if (!metodo_pago || !esMetodoValido) {
    errores.push('El método de pago es inválido');
  }

  if (tipo_pedido === 'delivery') {
    if (!direccion || typeof direccion !== 'string' || direccion.trim() === '') {
      errores.push('La dirección es obligatoria para pedidos de delivery');
    }
    if (!telefono || typeof telefono !== 'string' || telefono.trim() === '') {
      errores.push('El teléfono es obligatorio para pedidos de delivery');
    }
  }

  if (!Array.isArray(items) || items.length === 0) {
    errores.push('El pedido debe contener al menos un ítem');
    return errores;
  }

  const productosVistos = new Set();
  let productoRepetido = false;

  for (const item of items) {
    if (!item || !['number', 'string'].includes(typeof item.producto_id) || !Number.isSafeInteger(Number(item.producto_id)) || Number(item.producto_id) <= 0) {
      errores.push('Cada ítem debe tener un producto_id válido');
    } else {
      if (productosVistos.has(Number(item.producto_id))) {
        productoRepetido = true;
      }
      productosVistos.add(Number(item.producto_id));
    }

    if (!item || !Number.isSafeInteger(item.cantidad) || item.cantidad <= 0) {
      errores.push('La cantidad de cada ítem debe ser un entero mayor a cero');
    }
  }

  if (productoRepetido) {
    errores.push('No se puede repetir el mismo producto en los ítems del pedido');
  }

  return errores;
};

module.exports = {
  validarPedido
};

