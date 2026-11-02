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

module.exports = {
  calcularGanancia,
  rangoMesActual,
  obtenerVentasDia,
  obtenerVentasRango,
  obtenerTopProductos,
  obtenerGanancias,
  obtenerMermas,
  obtenerResumen
};
