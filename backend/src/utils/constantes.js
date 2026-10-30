const ESTADOS_PEDIDO = Object.freeze({
  PENDIENTE: 'pendiente',
  EN_PREPARACION: 'en_preparacion',
  EN_EMPAQUE: 'en_empaque',
  COMPLETADO: 'completado',
  CANCELADO: 'cancelado'
});

const ESTADOS_ACTIVOS = Object.freeze(['pendiente', 'en_preparacion', 'en_empaque']);

const TIPOS_PEDIDO = Object.freeze(['mesa', 'take_away', 'delivery']);
const METODOS_PAGO = Object.freeze(['efectivo', 'debito', 'credito', 'mercadopago']);
const UNIDADES_MEDIDA = Object.freeze(['kg', 'lts', 'un']);
const ESTADOS_TURNO = Object.freeze(['presente', 'ausente', 'franco', 'licencia', 'tarde']);

module.exports = {
  ESTADOS_PEDIDO,
  ESTADOS_ACTIVOS,
  TIPOS_PEDIDO,
  METODOS_PAGO,
  UNIDADES_MEDIDA,
  ESTADOS_TURNO
};
