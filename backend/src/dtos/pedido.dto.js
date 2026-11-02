const { TIPOS_PEDIDO, METODOS_PAGO } = require('../utils/constantes');

const tiposValidos = [...new Set([...TIPOS_PEDIDO, 'salon'])];

const validarPedido = (body = {}) => {
  const errores = [];
  const { tipo_pedido, metodo_pago, direccion, telefono, items } = body;

  if (!tipo_pedido || !tiposValidos.includes(tipo_pedido)) {
    errores.push('El tipo de pedido es inválido');
  }

  if (!metodo_pago || !METODOS_PAGO.includes(metodo_pago)) {
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
    if (!item || item.producto_id === undefined || item.producto_id === null || item.producto_id === '') {
      errores.push('Cada ítem debe tener un producto_id válido');
    } else {
      if (productosVistos.has(item.producto_id)) {
        productoRepetido = true;
      }
      productosVistos.add(item.producto_id);
    }

    if (!item || !Number.isInteger(item.cantidad) || item.cantidad <= 0) {
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

