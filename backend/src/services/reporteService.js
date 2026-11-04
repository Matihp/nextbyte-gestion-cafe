const registroVentaRepository = require('../repositories/registroVentaRepository');
const AppError = require('../utils/AppError');
const { hoy } = require('../utils/fechas');
const { validarFecha, validarRangoFechas, validarLimit } = require('../dtos/reporte.dto');

const dosDigitos = (n) => String(n).padStart(2, '0');

const calcularGanancia = (totalVenta, totalCosto) => {
  const venta = Math.round((Number(totalVenta) || 0) * 100) / 100;
  const costo = Math.round((Number(totalCosto) || 0) * 100) / 100;
  const ganancia = Math.round((venta - costo) * 100) / 100;

  const margenPorcentaje = venta > 0
    ? Math.round(((ganancia / venta) * 100) * 100) / 100
    : 0;

  return {
    ganancia,
    margen_porcentaje: margenPorcentaje
  };
};

const rangoMesActual = (fechaReferencia) => {
  const ref = typeof fechaReferencia === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fechaReferencia)
    ? fechaReferencia
    : hoy();
  const [anioStr, mesStr] = ref.split('-');
  const anio = Number(anioStr);
  const mes = Number(mesStr);
  const ultimoDia = new Date(anio, mes, 0).getDate();

  return {
    desde: `${anioStr}-${dosDigitos(mesStr)}-01`,
    hasta: `${anioStr}-${dosDigitos(mesStr)}-${dosDigitos(ultimoDia)}`
  };
};

const resolverRangoFechas = (desde, hasta) => {
  let fechaDesde = desde;
  let fechaHasta = hasta;

  if (!fechaDesde || !fechaHasta) {
    const mes = rangoMesActual(hoy());
    if (!fechaDesde) fechaDesde = mes.desde;
    if (!fechaHasta) fechaHasta = mes.hasta;
  }

  const errores = validarRangoFechas(fechaDesde, fechaHasta);
  if (errores.length > 0) {
    throw new AppError(errores[0], 400, 'VALIDACION');
  }

  return { desde: fechaDesde, hasta: fechaHasta };
};

async function obtenerVentasDia(fecha) {
  const fechaConsulta = fecha || hoy();
  const errores = validarFecha(fechaConsulta);
  if (errores.length > 0) {
    throw new AppError(errores[0], 400, 'VALIDACION');
  }

  const data = await registroVentaRepository.obtenerVentasDia(fechaConsulta);
  const { ganancia } = calcularGanancia(data.total_venta, data.total_costo);

  return {
    fecha: data.fecha,
    cantidad_pedidos: data.cantidad_pedidos,
    total_venta: data.total_venta,
    total_costo: data.total_costo,
    ganancia
  };
}

async function obtenerVentasRango(desde, hasta) {
  const rango = resolverRangoFechas(desde, hasta);
  const filas = await registroVentaRepository.obtenerVentasRango(rango.desde, rango.hasta);

  return filas.map((fila) => {
    const { ganancia } = calcularGanancia(fila.total_venta, fila.total_costo);
    return {
      fecha: fila.fecha,
      cantidad_pedidos: fila.cantidad_pedidos,
      total_venta: fila.total_venta,
      total_costo: fila.total_costo,
      ganancia
    };
  });
}

async function obtenerTopProductos(desde, hasta, limit = 5) {
  const rango = resolverRangoFechas(desde, hasta);
  const erroresLimit = validarLimit(limit);
  if (erroresLimit.length > 0) {
    throw new AppError(erroresLimit[0], 400, 'VALIDACION');
  }

  const limiteNumerico = limit !== undefined && limit !== null && limit !== '' ? Number(limit) : 5;
  return await registroVentaRepository.obtenerTopProductos(rango.desde, rango.hasta, limiteNumerico);
}

async function obtenerGanancias(desde, hasta) {
  const rango = resolverRangoFechas(desde, hasta);
  const totales = await registroVentaRepository.obtenerTotalesGanancias(rango.desde, rango.hasta);
  const { ganancia, margen_porcentaje } = calcularGanancia(totales.total_venta, totales.total_costo);

  return {
    total_venta: totales.total_venta,
    total_costo: totales.total_costo,
    ganancia,
    margen_porcentaje
  };
}

async function obtenerMermas(desde, hasta) {
  const rango = resolverRangoFechas(desde, hasta);
  return await registroVentaRepository.obtenerMermasPorRango(rango.desde, rango.hasta);
}

async function obtenerResumen() {
  const fechaHoy = hoy();
  const mes = rangoMesActual(fechaHoy);

  const [
    ventasHoy,
    pedidosActivos,
    insumosAlerta,
    topProductoMes
  ] = await Promise.all([
    registroVentaRepository.obtenerVentasDia(fechaHoy),
    registroVentaRepository.contarPedidosActivos(),
    registroVentaRepository.contarInsumosEnAlerta(),
    registroVentaRepository.obtenerTopProductos(mes.desde, mes.hasta, 1)
  ]);

  const productoEstrella = topProductoMes.length > 0
    ? {
        producto_id: topProductoMes[0].producto_id,
        nombre_producto: topProductoMes[0].nombre_producto,
        unidades: topProductoMes[0].unidades
      }
    : null;

  return {
    ventas_hoy: ventasHoy.total_venta,
    cantidad_pedidos_hoy: ventasHoy.cantidad_pedidos,
    pedidos_activos: pedidosActivos,
    insumos_en_alerta: insumosAlerta,
    producto_mas_vendido_mes: productoEstrella
  };
}

async function obtenerDatosDashboard(desde, hasta) {
  const rango = resolverRangoFechas(desde, hasta);

  const [
    ventasPorFranjaHoraria,
    ventasPorCategoria,
    mermas,
    pedidosDiarios
  ] = await Promise.all([
    registroVentaRepository.obtenerVentasPorFranjaHoraria(),
    registroVentaRepository.obtenerVentasPorCategoria(),
    registroVentaRepository.obtenerMermasPorRango(rango.desde, rango.hasta),
    registroVentaRepository.obtenerVentasRango(rango.desde, rango.hasta)
  ]);

  const mapaMermas = {};
  for (const item of mermas) {
    mapaMermas[item.motivo] = (mapaMermas[item.motivo] || 0) + (Number(item.cantidad_total) || 0);
  }
  const historialMermas = Object.entries(mapaMermas).map(([motivo, cantidad]) => ({
    motivo,
    cantidad
  }));

  return {
    ventasPorFranjaHoraria,
    ventasPorCategoria,
    historialMermas,
    ventasPorDia: pedidosDiarios
  };
}

async function obtenerReporteCaja(filtros = {}) {
  let fechaFiltro = filtros.fecha;
  let desdeFiltro = filtros.desde;
  let hastaFiltro = filtros.hasta;

  if (!fechaFiltro && !desdeFiltro && !hastaFiltro) {
    fechaFiltro = hoy();
  }

  const filas = await registroVentaRepository.obtenerTransaccionesCaja({
    fecha: fechaFiltro,
    desde: desdeFiltro,
    hasta: hastaFiltro
  });

  const pedidosMap = new Map();
  let totalCostoGeneral = 0;
  let totalVentaGeneral = 0;

  for (const fila of filas) {
    const pedidoId = fila.pedido_id;
    const costoItem = Number(fila.costo_total) || 0;
    const ventaItem = Number(fila.venta_total) || 0;

    totalCostoGeneral += costoItem;
    totalVentaGeneral += ventaItem;

    if (!pedidosMap.has(pedidoId)) {
      pedidosMap.set(pedidoId, {
        id: pedidoId,
        fecha: fila.fecha,
        hora: fila.hora ? fila.hora.slice(0, 5) : '',
        tipo_pedido: fila.tipo_pedido || 'Mostrador',
        metodo_pago: fila.metodo_pago || 'Efectivo',
        estado: fila.estado || 'completado',
        total_costo: 0,
        total_venta: 0,
        items: []
      });
    }

    const pedido = pedidosMap.get(pedidoId);
    pedido.total_costo = Math.round((pedido.total_costo + costoItem) * 100) / 100;
    pedido.total_venta = Math.round((pedido.total_venta + ventaItem) * 100) / 100;

    pedido.items.push({
      detalle_id: fila.detalle_id,
      producto_id: fila.producto_id,
      nombre_producto: fila.nombre_producto,
      cantidad: Number(fila.cantidad) || 0,
      precio_costo: Number(fila.precio_costo) || 0,
      precio_venta: Number(fila.precio_venta) || 0,
      costo_total: costoItem,
      venta_total: ventaItem
    });
  }

  return {
    fecha: fechaFiltro || `${desdeFiltro} a ${hastaFiltro}`,
    total_costo: Math.round(totalCostoGeneral * 100) / 100,
    total_venta: Math.round(totalVentaGeneral * 100) / 100,
    pedidos: Array.from(pedidosMap.values())
  };
}

module.exports = {
  calcularGanancia,
  rangoMesActual,
  obtenerVentasDia,
  obtenerVentasRango,
  obtenerTopProductos,
  obtenerGanancias,
  obtenerMermas,
  obtenerResumen,
  obtenerDatosDashboard,
  obtenerReporteCaja
};
