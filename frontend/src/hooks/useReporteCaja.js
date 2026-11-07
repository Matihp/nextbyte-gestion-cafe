import { useState, useEffect, useCallback, useMemo } from 'react';
import reporteService from '../services/reporteService';

export const getHoyIso = () => {
  const d = new Date();
  const anio = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
};
const getMesActualIso = () => {
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

  const cargarDatos = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      let params = {};

      if (modoFiltro === 'hoy') {
        params = { fecha: getHoyIso() };
      } else if (modoFiltro === 'fecha') {
        params = { fecha: fechaEspecifica };
      } else if (modoFiltro === 'mes' || modoFiltro === 'mes-seleccionado') {
        const [anioStr, mesStr] = (modoFiltro === 'mes' ? getMesActualIso() : mesSeleccionado).split('-');
        const anio = parseInt(anioStr, 10);
        const mes = parseInt(mesStr, 10);
        const ultimoDia = new Date(anio, mes, 0).getDate();
        params = {
          desde: `${anioStr}-${String(mes).padStart(2, '0')}-01`,
          hasta: `${anioStr}-${String(mes).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`
        };
      }

      const data = await reporteService.obtenerReporteCaja(params);
      setReporte(data || { fecha: '', total_costo: 0, total_venta: 0, pedidos: [] });
    } catch (err) {
      console.error('Error al cargar reporte de caja:', err);
      setError(err.message || 'No se pudieron cargar los datos de caja.');
    } finally {
      setCargando(false);
    }
  }, [modoFiltro, fechaEspecifica, mesSeleccionado]);

  useEffect(() => {
    let activo = true;

    setCargando(true);
    setError(null);

    async function fetchInicial() {
      try {
        let params = {};
        if (modoFiltro === 'hoy') {
          params = { fecha: getHoyIso() };
        } else if (modoFiltro === 'fecha') {
          params = { fecha: fechaEspecifica };
        } else {
          const [anioStr, mesStr] = (modoFiltro === 'mes' ? getMesActualIso() : mesSeleccionado).split('-');
          const anio = parseInt(anioStr, 10);
          const mes = parseInt(mesStr, 10);
          const ultimoDia = new Date(anio, mes, 0).getDate();
          params = {
            desde: `${anioStr}-${String(mes).padStart(2, '0')}-01`,
            hasta: `${anioStr}-${String(mes).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`
          };
        }

        const data = await reporteService.obtenerReporteCaja(params);
        if (activo) {
          setReporte(data || { fecha: '', total_costo: 0, total_venta: 0, pedidos: [] });
        }
      } catch (err) {
        if (activo) {
          setError(err.message || 'No se pudieron cargar los datos de caja.');
        }
      } finally {
        if (activo) {
          setCargando(false);
        }
      }
    }

    fetchInicial();

    return () => {
      activo = false;
    };
  }, [modoFiltro, fechaEspecifica, mesSeleccionado]);

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
      subtotalCosto += Number(p.total_costo) || 0;
      totalVenta += Number(p.total_venta) || 0;
    }

    return {
      subtotalCosto: Math.round(subtotalCosto * 100) / 100,
      totalVenta: Math.round(totalVenta * 100) / 100
    };
  }, [pedidosFiltrados]);

  // Exportar a CSV (Excel)
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
      const fechaPedido = p.fecha || (modoFiltro === 'fecha' ? fechaEspecifica : getHoyIso());

      for (const item of items) {
        filas.push([
          fechaPedido,
          p.hora || '',
          pedidoIdFormateado,
          p.tipo_pedido || 'Mostrador',
          p.metodo_pago || 'Efectivo',
          `"${(item.nombre_producto || '').replace(/"/g, '""')}"`,
          item.cantidad,
          item.precio_costo,
          item.precio_venta,
          item.costo_total,
          item.venta_total,
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
      totales.subtotalCosto,
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
      totales.totalVenta,
      ''
    ]);

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
  }, [pedidosFiltrados, totales, modoFiltro, fechaEspecifica, mesSeleccionado]);

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
    exportarAExcel,
    imprimirReporte,
    getHoyIso
  };
}

export default useReporteCaja;

