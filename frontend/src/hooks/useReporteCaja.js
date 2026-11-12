import { useState, useEffect, useCallback, useMemo } from 'react';
import reporteService from '../services/reporteService';
import cajaService from '../services/cajaService';
import { formatearPrecio, formatearSoloFecha } from '../utils/formatters';

export const getHoyIso = () => {
  const d = new Date();
  const anio = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
};

export const getMesActualIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const formatEstado = (estado) => {
  const s = String(estado || '').toLowerCase().trim();
  if (s === 'en_empaque' || s === 'en empaque') return 'En empaque';
  if (s === 'en_preparacion' || s === 'en preparación' || s === 'en preparacion') return 'En preparación';
  if (s === 'completado') return 'Completado';
  if (s === 'entregado') return 'Entregado';
  if (s === 'cancelado') return 'Cancelado';
  if (s === 'pendiente') return 'Pendiente';
  return s.charAt(0).toUpperCase() + s.slice(1);
};

export function useReporteCaja() {
  const [modoFiltro, setModoFiltro] = useState('hoy'); // 'hoy' | 'mes' | 'fecha' | 'mes-seleccionado'
  const [fechaEspecifica, setFechaEspecifica] = useState(getHoyIso());
  const [mesSeleccionado, setMesSeleccionado] = useState(getMesActualIso());
  const [busqueda, setBusqueda] = useState('');

  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [reporte, setReporte] = useState({
    fecha: getHoyIso(),
    total_costo: 0,
    total_venta: 0,
    pedidos: []
  });

  const [movimientos, setMovimientos] = useState([]);
  const [cargandoMovimientos, setCargandoMovimientos] = useState(false);

  const getFiltroParams = useCallback(() => {
    if (modoFiltro === 'hoy') {
      return { fecha: getHoyIso() };
    }
    if (modoFiltro === 'fecha') {
      return { fecha: fechaEspecifica || getHoyIso() };
    }
    const mesIso = (modoFiltro === 'mes' || !mesSeleccionado || !mesSeleccionado.includes('-'))
      ? getMesActualIso()
      : mesSeleccionado;
    const [anioStr, mesStr] = mesIso.split('-');
    const anio = parseInt(anioStr, 10) || new Date().getFullYear();
    const mes = parseInt(mesStr, 10) || (new Date().getMonth() + 1);
    const ultimoDia = new Date(anio, mes, 0).getDate();
    return {
      desde: `${anio}-${String(mes).padStart(2, '0')}-01`,
      hasta: `${anio}-${String(mes).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`
    };
  }, [modoFiltro, fechaEspecifica, mesSeleccionado]);

  const cargarDatos = useCallback(async () => {
    setCargando(true);
    setCargandoMovimientos(true);
    setError(null);
    try {
      const params = getFiltroParams();

      const [dataReporte, resMovs] = await Promise.all([
        reporteService.obtenerReporteCaja(params),
        cajaService.obtenerMovimientos(params).catch((err) => {
          console.warn('No se pudieron obtener movimientos:', err);
          return { data: [] };
        })
      ]);

      setReporte(dataReporte || { fecha: '', total_costo: 0, total_venta: 0, pedidos: [] });
      const listaMovs = resMovs?.data || resMovs || [];
      setMovimientos(Array.isArray(listaMovs) ? listaMovs : []);
    } catch (err) {
      console.error('Error al cargar reporte de caja:', err);
      setError(err.message || 'No se pudieron cargar los datos de caja.');
    } finally {
      setCargando(false);
      setCargandoMovimientos(false);
    }
  }, [getFiltroParams]);

  useEffect(() => {
    let activo = true;

    setCargando(true);
    setCargandoMovimientos(true);
    setError(null);

    async function fetchInicial() {
      try {
        const params = getFiltroParams();

        const [dataReporte, resMovs] = await Promise.all([
          reporteService.obtenerReporteCaja(params),
          cajaService.obtenerMovimientos(params).catch((err) => {
            console.warn('No se pudieron obtener movimientos iniciales:', err);
            return { data: [] };
          })
        ]);

        if (activo) {
          setReporte(dataReporte || { fecha: '', total_costo: 0, total_venta: 0, pedidos: [] });
          const listaMovs = resMovs?.data || resMovs || [];
          setMovimientos(Array.isArray(listaMovs) ? listaMovs : []);
        }
      } catch (err) {
        if (activo) {
          console.error('Error al cargar reporte de caja inicial:', err);
          setError(err.message || 'No se pudieron cargar los datos de caja.');
        }
      } finally {
        if (activo) {
          setCargando(false);
          setCargandoMovimientos(false);
        }
      }
    }

    fetchInicial();

    return () => {
      activo = false;
    };
  }, [getFiltroParams]);

  // Filtrado en vivo por término de búsqueda (ID de pedido o nombre de producto)
  const pedidosFiltrados = useMemo(() => {
    const term = busqueda.trim().toLowerCase();
    if (!term) return reporte.pedidos || [];

    return (reporte.pedidos || []).filter((p) => {
      const matchId = String(p.id).toLowerCase().includes(term);
      const matchTipo = String(p.tipo_pedido || '').toLowerCase().includes(term);
      const matchPago = String(p.metodo_pago || '').toLowerCase().includes(term);
      const matchItems = (p.items || []).some((item) =>
        String(item.nombre_producto || '').toLowerCase().includes(term)
      );
      return matchId || matchTipo || matchPago || matchItems;
    });
  }, [reporte.pedidos, busqueda]);

  // Totales recalculados sobre los pedidos filtrados
  const totales = useMemo(() => {
    let subtotalCosto = 0;
    let totalVenta = 0;

    for (const p of pedidosFiltrados) {
      if (p.estado === 'cancelado') continue;
      subtotalCosto += Number(p.total_costo) || 0;
      totalVenta += Number(p.total_venta) || 0;
    }

    return {
      subtotalCosto: Math.round(subtotalCosto * 100) / 100,
      totalVenta: Math.round(totalVenta * 100) / 100
    };
  }, [pedidosFiltrados]);

  // Totales calculados sobre los movimientos de caja (Ingresos, Retiros, Saldo Neto y Saldo Final)
  const totalesMovimientos = useMemo(() => {
    let totalIngresos = 0;
    let totalRetiros = 0;

    for (const m of movimientos) {
      const monto = Number(m.monto) || 0;
      if (m.tipo === 'INGRESO') {
        totalIngresos += monto;
      } else if (m.tipo === 'RETIRO') {
        totalRetiros += monto;
      }
    }

    const saldoNeto = totalIngresos - totalRetiros;
    const saldoFinal = (totales.totalVenta || 0) + saldoNeto;

    return {
      totalIngresos: Math.round(totalIngresos * 100) / 100,
      totalRetiros: Math.round(totalRetiros * 100) / 100,
      saldoNeto: Math.round(saldoNeto * 100) / 100,
      saldoFinal: Math.round(saldoFinal * 100) / 100
    };
  }, [movimientos, totales.totalVenta]);

  // Agregar nuevo movimiento con validaciones de saldo para RETIRO
  const agregarMovimiento = useCallback(async ({ tipo, detalle, monto, fecha = null }) => {
    const numMonto = Number(monto);
    if (isNaN(numMonto) || numMonto <= 0) {
      throw new Error('El monto debe ser un número mayor a cero.');
    }
    if (!detalle || !detalle.trim()) {
      throw new Error('El detalle del movimiento es obligatorio.');
    }

    // Saldo disponible en Caja (Ventas del período + Ingresos - Retiros)
    const saldoDisponible = totalesMovimientos.saldoFinal;

    if (tipo === 'RETIRO' && numMonto > saldoDisponible) {
      throw new Error(
        `Fondos insuficientes en la Caja. Saldo actual disponible: ${formatearPrecio(saldoDisponible)}. No se puede realizar un retiro de ${formatearPrecio(numMonto)}.`
      );
    }

    const ahora = new Date();
    const hora = ahora.toTimeString().slice(0, 8);
    const fechaMov = fecha || (modoFiltro === 'fecha' && fechaEspecifica ? fechaEspecifica : getHoyIso());

    const res = await cajaService.crearMovimiento({
      fecha: fechaMov,
      hora,
      tipo,
      detalle: detalle.trim(),
      monto: numMonto
    });

    await cargarDatos();
    return res?.data || res;
  }, [totalesMovimientos.saldoFinal, modoFiltro, fechaEspecifica, cargarDatos]);

  // Eliminar movimiento con validación de saldo si es INGRESO
  const eliminarMovimiento = useCallback(async (movimiento) => {
    if (!movimiento || !movimiento.id) {
      throw new Error('Movimiento inválido para eliminar.');
    }

    if (movimiento.tipo === 'INGRESO') {
      const saldoDisponible = totalesMovimientos.saldoFinal;
      const montoIngreso = Number(movimiento.monto) || 0;
      if (saldoDisponible - montoIngreso < 0) {
        throw new Error(
          `No se puede eliminar este ingreso: dejaría el saldo de la caja en negativo. Saldo actual: ${formatearPrecio(saldoDisponible)}.`
        );
      }
    }

    const res = await cajaService.eliminarMovimiento(movimiento.id);
    await cargarDatos();
    return res;
  }, [totalesMovimientos.saldoFinal, cargarDatos]);

  // Exportar a CSV (Excel) incluyendo tabla de ventas y recuadro de movimientos de caja
  const exportarAExcel = useCallback((tipoCierre = 'cierre-diario') => {
    const filas = [];
    filas.push([
      'Fecha',
      'Hora',
      'N° Pedido',
      'Tipo',
      'Medio de Pago',
      'Producto',
      'Cantidad',
      'Costo Unit.',
      'Venta Unit.',
      'Total Costo',
      'Total Venta',
      'Estado'
    ]);

    for (const p of pedidosFiltrados) {
      const items = p.items && p.items.length > 0
        ? p.items
        : [{
            nombre_producto: 'Venta Consolidada',
            cantidad: 1,
            precio_costo: p.total_costo,
            precio_venta: p.total_venta,
            costo_total: p.total_costo,
            venta_total: p.total_venta
          }];

      const pedidoIdFormateado = String(p.id).startsWith('#') ? p.id : `#${p.id}`;
      const fechaPedido = formatearSoloFecha(p.fecha || (modoFiltro === 'fecha' ? fechaEspecifica : getHoyIso()));
      const horaPedido = p.hora ? p.hora.slice(0, 5) : '';

      for (const item of items) {
        filas.push([
          fechaPedido,
          horaPedido,
          pedidoIdFormateado,
          p.tipo_pedido || 'Mostrador',
          p.metodo_pago || 'Efectivo',
          `"${(item.nombre_producto || '').replace(/"/g, '""')}"`,
          item.cantidad,
          Math.round(Number(item.precio_costo) || 0),
          Math.round(Number(item.precio_venta) || 0),
          Math.round(Number(item.costo_total) || 0),
          Math.round(Number(item.venta_total) || 0),
          formatEstado(p.estado)
        ]);
      }
    }

    // Fila vacía
    filas.push(['', '', '', '', '', '', '', '', '', '', '', '']);

    // Fila SUBTOTAL (Costos)
    filas.push([
      'SUBTOTAL (Costos)',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      Math.round(Number(totales.subtotalCosto) || 0),
      '',
      ''
    ]);

    // Fila TOTAL VENTAS
    filas.push([
      'TOTAL VENTAS',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      Math.round(Number(totales.totalVenta) || 0),
      ''
    ]);

    // Recuadro de Movimientos de Caja Chica
    if (movimientos && movimientos.length > 0) {
      filas.push(['', '', '', '', '', '', '', '', '', '', '', '']);
      filas.push(['--- MOVIMIENTOS DE CAJA CHICA (INGRESOS / RETIROS) ---', '', '', '', '', '', '', '', '', '', '', '']);
      filas.push(['Fecha', 'Hora', 'Tipo', 'Detalle', '', '', '', '', '', 'Ingreso', 'Retiro', '']);
      for (const m of movimientos) {
        const monto = Number(m.monto) || 0;
        filas.push([
          m.fecha ? formatearSoloFecha(m.fecha) : '',
          m.hora ? m.hora.slice(0, 5) : '',
          m.tipo,
          `"${(m.detalle || '').replace(/"/g, '""')}"`,
          '', '', '', '', '',
          m.tipo === 'INGRESO' ? Math.round(monto) : '',
          m.tipo === 'RETIRO' ? Math.round(monto) : '',
          ''
        ]);
      }
      filas.push(['TOTAL INGRESOS (+)', '', '', '', '', '', '', '', '', Math.round(Number(totalesMovimientos.totalIngresos) || 0), '', '']);
      filas.push(['TOTAL RETIROS (-)', '', '', '', '', '', '', '', '', '', Math.round(Number(totalesMovimientos.totalRetiros) || 0), '']);
      filas.push(['SALDO FINAL DE CAJA (Ventas + Ingresos - Retiros)', '', '', '', '', '', '', '', '', '', Math.round(Number(totalesMovimientos.saldoFinal) || 0), '']);
    }

    const contenidoCsv = '\uFEFF' + filas.map((e) => e.join(',')).join('\n');
    const blob = new Blob([contenidoCsv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);

    const fechaArchivo = modoFiltro === 'fecha'
      ? fechaEspecifica
      : modoFiltro === 'mes'
      ? mesSeleccionado
      : getHoyIso();

    const nombreArchivo = tipoCierre === 'cierre-mes'
      ? `Cierre_Mes_${fechaArchivo}.csv`
      : `Cierre_Z_${fechaArchivo}.csv`;

    link.setAttribute('download', nombreArchivo);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [pedidosFiltrados, totales, movimientos, totalesMovimientos, modoFiltro, fechaEspecifica, mesSeleccionado]);

  // Imprimir reporte nativo
  const imprimirReporte = useCallback(() => {
    window.print();
  }, []);

  return {
    modoFiltro,
    setModoFiltro,
    fechaEspecifica,
    setFechaEspecifica,
    mesSeleccionado,
    setMesSeleccionado,
    busqueda,
    setBusqueda,
    cargando,
    error,
    recargar: cargarDatos,
    reporte,
    pedidosFiltrados,
    totales,
    movimientos,
    cargandoMovimientos,
    totalesMovimientos,
    agregarMovimiento,
    eliminarMovimiento,
    exportarAExcel,
    imprimirReporte,
    getHoyIso,
    getMesActualIso
  };
}

export default useReporteCaja;
