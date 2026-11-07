import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  Search,
  Printer,
  FileSpreadsheet,
  FileText,
  RotateCw,
  AlertCircle,
  Inbox,
  ChevronLeft,
  TrendingUp,
  ReceiptText,
  PlusCircle,
  Trash2,
  Wallet
} from 'lucide-react';
import { toast } from 'sonner';
import { useReporteCaja } from '@/hooks/useReporteCaja';
import reporteService from '@/services/reporteService';
import cajaService from '@/services/cajaService';
import { formatearPrecio } from '@/utils/formatters';
import { ReporteCajaPrint } from './ReporteCajaPrint';
import { DetallePedidoModal } from './DetallePedidoModal';
import { ModalConfirmarEliminar } from './ModalConfirmarEliminar';

const getBadgeEstado = (estado) => {
  const s = String(estado || '').toLowerCase().trim();
  switch (s) {
    case 'en_empaque':
    case 'en empaque':
      return 'bg-orange-50 text-orange-700 border border-orange-200';
    case 'en_preparacion':
    case 'en preparación':
    case 'en preparacion':
      return 'bg-amber-50 text-amber-700 border border-amber-200';
    case 'completado':
      return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
    case 'entregado':
      return 'bg-teal-50 text-teal-800 border border-teal-200';
    case 'cancelado':
      return 'bg-red-50 text-red-700 border border-red-200';
    case 'pendiente':
    default:
      return 'bg-gray-100 text-gray-700 border border-gray-200';
  }
};

const formatEstadoNombre = (estado) => {
  const s = String(estado || '').toLowerCase().trim();
  if (s === 'en_empaque') return 'En empaque';
  if (s === 'en_preparacion') return 'En preparación';
  if (s === 'completado') return 'Completado';
  if (s === 'entregado') return 'Entregado';
  if (s === 'cancelado') return 'Cancelado';
  if (s === 'pendiente') return 'Pendiente';
  return estado || 'Pendiente';
};

const formatearFechaDDMMAAAA = (fechaStr) => {
  if (!fechaStr) return '-';
  const soloFecha = String(fechaStr).split('T')[0];
  const partes = soloFecha.split('-');
  if (partes.length === 3) {
    return `${partes[2].padStart(2, '0')}/${partes[1].padStart(2, '0')}/${partes[0]}`;
  }
  return fechaStr;
};

export default function ReporteCaja() {
  const {
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
    recargar,
    reporte,
    pedidosFiltrados,
    totales,
    movimientos,
    cargandoMovimientos,
    totalesMovimientos,
    exportarAExcel,
    imprimirReporte,
    getHoyIso
  } = useReporteCaja();

  // Estado de la Pestaña Activa estilo Google Chrome
  // 'transacciones' | 'ingresos-retiros' | 'eliminados'
  const [pestanaActiva, setPestanaActiva] = useState('transacciones');

  // Período para las pestañas 2 y 3: 'actual' | 'anterior'
  const [periodoOtrasPestanas, setPeriodoOtrasPestanas] = useState('actual');

  const [tituloImpresion, setTituloImpresion] = useState('Reporte de CAJA DIARIA');
  const [datosImpresion, setDatosImpresion] = useState(null);
  const [pedidoSeleccionado, setPedidoSeleccionado] = useState(null);
  const [modalDetalleAbierto, setModalDetalleAbierto] = useState(false);
  const [ticketPedidoImprimir, setTicketPedidoImprimir] = useState(null);

  // Estados propios de Pestaña 2: Ingresos / Retiros de Caja
  const [movimientosP2, setMovimientosP2] = useState([]);
  const [cargandoP2, setCargandoP2] = useState(false);
  const [ventasMesP2, setVentasMesP2] = useState(0);

  // Fila editable para nueva transacción (Punto 3.2)
  const [nuevoDetalle, setNuevoDetalle] = useState('');
  const [nuevoIngreso, setNuevoIngreso] = useState('');
  const [nuevoRetiro, setNuevoRetiro] = useState('');
  const [guardandoMovimiento, setGuardandoMovimiento] = useState(false);

  // Diálogo de confirmación para eliminar (Punto 3.5)
  const [movimientoAEliminar, setMovimientoAEliminar] = useState(null);
  const [modalEliminarAbierto, setModalEliminarAbierto] = useState(false);
  const [eliminandoMovimiento, setEliminandoMovimiento] = useState(false);

  const handleAbrirDetalle = (pedido) => {
    setPedidoSeleccionado(pedido);
    setModalDetalleAbierto(true);
  };

  const handleImprimirTicket = (pedido) => {
    setTicketPedidoImprimir(pedido);
    setTimeout(() => {
      imprimirReporte();
      setTimeout(() => {
        setTicketPedidoImprimir(null);
      }, 500);
    }, 60);
  };

  // Cálculo de rango de fechas para Pestaña 2 (Mes actual vs Ver mes anterior)
  const getRangoPestana2 = useCallback(() => {
    const ahora = new Date();
    const anio = ahora.getFullYear();
    const mesNum = ahora.getMonth();
    const dRef = periodoOtrasPestanas === 'anterior' ? new Date(anio, mesNum - 1, 1) : new Date(anio, mesNum, 1);
    const a = dRef.getFullYear();
    const m = dRef.getMonth() + 1;
    const uDia = new Date(a, m, 0).getDate();
    return {
      desde: `${a}-${String(m).padStart(2, '0')}-01`,
      hasta: `${a}-${String(m).padStart(2, '0')}-${String(uDia).padStart(2, '0')}`,
      mesIso: `${a}-${String(m).padStart(2, '0')}`,
      nombreMes: dRef.toLocaleString('es-ES', { month: 'long' }),
      anio: a
    };
  }, [periodoOtrasPestanas]);

  const cargarDatosPestana2 = useCallback(async () => {
    setCargandoP2(true);
    try {
      const { desde, hasta } = getRangoPestana2();
      const [resMovs, resVentas] = await Promise.all([
        cajaService.obtenerMovimientos({ desde, hasta }).catch(() => ({ data: [] })),
        reporteService.obtenerReporteCaja({ desde, hasta }).catch(() => ({ total_venta: 0 }))
      ]);
      const lista = resMovs?.data || resMovs || [];
      setMovimientosP2(Array.isArray(lista) ? lista : []);
      setVentasMesP2(Number(resVentas?.total_venta) || 0);
    } catch (err) {
      console.error('Error al cargar datos de Pestaña 2:', err);
    } finally {
      setCargandoP2(false);
    }
  }, [getRangoPestana2]);

  useEffect(() => {
    cargarDatosPestana2();
  }, [cargarDatosPestana2]);

  // Totales calculados de Pestaña 2 (Punto 3.6)
  const totalesP2 = useMemo(() => {
    let totalIngresos = 0;
    let totalRetiros = 0;

    for (const m of movimientosP2) {
      const monto = Number(m.monto) || 0;
      if (m.tipo === 'INGRESO') totalIngresos += monto;
      if (m.tipo === 'RETIRO') totalRetiros += monto;
    }

    const saldoNeto = totalIngresos - totalRetiros;
    const saldoFinal = ventasMesP2 + saldoNeto;

    return {
      totalIngresos: Math.round(totalIngresos * 100) / 100,
      totalRetiros: Math.round(totalRetiros * 100) / 100,
      saldoNeto: Math.round(saldoNeto * 100) / 100,
      saldoFinal: Math.round(saldoFinal * 100) / 100
    };
  }, [movimientosP2, ventasMesP2]);

  // Manejo de inputs mutuamente excluyentes en la fila editable
  const handleCambioIngreso = (e) => {
    const val = e.target.value;
    setNuevoIngreso(val);
    if (val && Number(val) > 0) {
      setNuevoRetiro('');
    }
  };

  const handleCambioRetiro = (e) => {
    const val = e.target.value;
    setNuevoRetiro(val);
    if (val && Number(val) > 0) {
      setNuevoIngreso('');
    }
  };

  // Guardar nueva transacción en Pestaña 2 con validaciones (Puntos 3.3 y 3.4)
  const handleGuardarP2 = async () => {
    if (!nuevoDetalle.trim()) {
      toast.error('Debes ingresar una descripción o detalle para el movimiento.');
      return;
    }

    const mIngreso = Number(nuevoIngreso) || 0;
    const mRetiro = Number(nuevoRetiro) || 0;

    if (mIngreso <= 0 && mRetiro <= 0) {
      toast.error('Indica un monto válido mayor a 0 en Ingreso o Retiro.');
      return;
    }

    const tipo = mIngreso > 0 ? 'INGRESO' : 'RETIRO';
    const monto = mIngreso > 0 ? mIngreso : mRetiro;

    // Punto 3.3: Validación para RETIRO (Verificar si hay dinero suficiente en Caja)
    if (tipo === 'RETIRO') {
      const saldoDisponible = totalesP2.saldoFinal;
      if (monto > saldoDisponible) {
        toast.error(
          `Fondos insuficientes en la Caja. Saldo actual disponible: ${formatearPrecio(
            saldoDisponible
          )}. No se puede realizar un retiro por ${formatearPrecio(monto)}.`,
          { duration: 5500 }
        );
        return;
      }
    }

    setGuardandoMovimiento(true);
    try {
      const ahora = new Date();
      const hora = ahora.toTimeString().slice(0, 8);
      const fecha = getHoyIso();

      await cajaService.crearMovimiento({
        fecha,
        hora,
        tipo,
        detalle: nuevoDetalle.trim(),
        monto
      });

      toast.success(
        `${tipo === 'INGRESO' ? 'Ingreso' : 'Retiro'} de ${formatearPrecio(monto)} guardado con éxito`
      );

      setNuevoDetalle('');
      setNuevoIngreso('');
      setNuevoRetiro('');

      await Promise.all([cargarDatosPestana2(), recargar()]);
    } catch (err) {
      console.error('Error al guardar movimiento:', err);
      toast.error(err.response?.data?.message || err.message || 'No se pudo guardar el movimiento.');
    } finally {
      setGuardandoMovimiento(false);
    }
  };

  // Punto 3.5: Lógica del botón eliminar (cruz roja) con diálogo de confirmación
  const handleSolicitarEliminar = (movimiento) => {
    setMovimientoAEliminar(movimiento);
    setModalEliminarAbierto(true);
  };

  const handleConfirmarEliminar = async () => {
    if (!movimientoAEliminar) return;

    // Validación 3.5: Si se elimina un INGRESO, verificar si hay fondos disponibles para cubrir la salida
    if (movimientoAEliminar.tipo === 'INGRESO') {
      const saldoDisponible = totalesP2.saldoFinal;
      const montoIngreso = Number(movimientoAEliminar.monto) || 0;
      if (saldoDisponible - montoIngreso < 0) {
        toast.error(
          `No se puede eliminar este ingreso: dejaría el saldo de la caja en negativo. Saldo actual disponible: ${formatearPrecio(
            saldoDisponible
          )}.`
        );
        setModalEliminarAbierto(false);
        setMovimientoAEliminar(null);
        return;
      }
    }

    setEliminandoMovimiento(true);
    try {
      await cajaService.eliminarMovimiento(movimientoAEliminar.id);
      toast.success(
        `Movimiento "${movimientoAEliminar.detalle}" eliminado con éxito`
      );
      setModalEliminarAbierto(false);
      setMovimientoAEliminar(null);
      await Promise.all([cargarDatosPestana2(), recargar()]);
    } catch (err) {
      console.error('Error al eliminar movimiento:', err);
      toast.error(err.response?.data?.message || err.message || 'No se pudo eliminar el movimiento.');
    } finally {
      setEliminandoMovimiento(false);
    }
  };

  const handleImprimir = async (tipo) => {
    try {
      if (tipo === 'cierre-diario') {
        const fechaTarget = modoFiltro === 'fecha' && fechaEspecifica ? fechaEspecifica : getHoyIso();
        const [data, resMovs] = await Promise.all([
          reporteService.obtenerReporteCaja({ fecha: fechaTarget }),
          cajaService.obtenerMovimientos({ fecha: fechaTarget }).catch(() => ({ data: [] }))
        ]);
        const pedidosCierre = data?.pedidos || [];
        const listaMovs = resMovs?.data || resMovs || [];
        setDatosImpresion({
          titulo: 'Reporte de CAJA DIARIA',
          periodo: `Cierre Diario - ${formatearFechaDDMMAAAA(fechaTarget)}`,
          pedidos: pedidosCierre,
          totales: {
            subtotalCosto: data?.total_costo || 0,
            totalVenta: data?.total_venta || 0
          },
          movimientos: listaMovs
        });
      } else if (tipo === 'cierre-mes') {
        let desdeTarget = '';
        let hastaTarget = '';
        let mesTexto = '';

        if (modoFiltro === 'mes-seleccionado' && mesSeleccionado) {
          const [anioStr, mesStr] = mesSeleccionado.split('-');
          const anio = parseInt(anioStr, 10);
          const mes = parseInt(mesStr, 10);
          const ultimoDia = new Date(anio, mes, 0).getDate();
          desdeTarget = `${anioStr}-${String(mes).padStart(2, '0')}-01`;
          hastaTarget = `${anioStr}-${String(mes).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`;
          const dRef = new Date(anio, mes - 1, 1);
          const mNom = dRef.toLocaleString('es-ES', { month: 'long' });
          mesTexto = `${mNom.charAt(0).toUpperCase() + mNom.slice(1)} ${anio}`;
        } else {
          const ahora = new Date();
          const anio = ahora.getFullYear();
          const mes = ahora.getMonth() + 1;
          const ultimoDia = new Date(anio, mes, 0).getDate();
          desdeTarget = `${anio}-${String(mes).padStart(2, '0')}-01`;
          hastaTarget = `${anio}-${String(mes).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`;
          const mNom = ahora.toLocaleString('es-ES', { month: 'long' });
          mesTexto = `${mNom.charAt(0).toUpperCase() + mNom.slice(1)} ${anio}`;
        }

        const [data, resMovs] = await Promise.all([
          reporteService.obtenerReporteCaja({ desde: desdeTarget, hasta: hastaTarget }),
          cajaService.obtenerMovimientos({ desde: desdeTarget, hasta: hastaTarget }).catch(() => ({ data: [] }))
        ]);
        const pedidosCierre = data?.pedidos || [];
        const listaMovs = resMovs?.data || resMovs || [];
        setDatosImpresion({
          titulo: 'Reporte de CAJA MES',
          periodo: `Cierre Mensual - ${mesTexto} (${desdeTarget} a ${hastaTarget})`,
          pedidos: pedidosCierre,
          totales: {
            subtotalCosto: data?.total_costo || 0,
            totalVenta: data?.total_venta || 0
          },
          movimientos: listaMovs
        });
      } else if (tipo === 'pestana-2') {
        const { desde, hasta, nombreMes, anio } = getRangoPestana2();
        const dataVentas = await reporteService.obtenerReporteCaja({ desde, hasta }).catch(() => ({ total_costo: 0, total_venta: 0 }));
        const subtotalCosto = Number(dataVentas?.total_costo) || 0;
        const totalVenta = Number(dataVentas?.total_venta) || ventasMesP2 || 0;
        setDatosImpresion({
          tipoReporte: 'ingresos-retiros',
          titulo: `Reporte de Ingresos y Retiros de Caja - ${nombreMes.toUpperCase()} ${anio}`,
          periodo: `Período: ${desde} al ${hasta}`,
          pedidos: [],
          totales: {
            subtotalCosto,
            totalVenta
          },
          movimientos: movimientosP2
        });
      } else {
        setDatosImpresion({
          titulo: getTituloTabla(),
          periodo: getTituloTabla(),
          pedidos: pedidosFiltrados,
          totales: totales,
          movimientos: movimientos
        });
      }

      setTimeout(() => {
        imprimirReporte();
      }, 150);
    } catch (err) {
      console.error('Error al preparar impresión:', err);
      toast.error('No se pudieron obtener las transacciones para imprimir.');
    }
  };

  const descargarCsv = (pedidosAExportar, totalesAExportar, nombreArchivo, movimientosAExportar = [], soloTotalesVentas = false) => {
    const filas = [];
    if (!soloTotalesVentas) {
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

      for (const p of pedidosAExportar) {
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
        const fechaPedido = p.fecha || '-';

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
            formatEstadoNombre(p.estado)
          ]);
        }
      }

      filas.push(['', '', '', '', '', '', '', '', '', '', '', '']);
    }

    filas.push(['SUBTOTAL (Costos)', '', '', '', '', '', '', '', '', totalesAExportar.subtotalCosto, '', '']);
    filas.push(['TOTAL VENTAS', '', '', '', '', '', '', '', '', '', totalesAExportar.totalVenta, '']);
    filas.push(['DIFERENCIA (Ventas - Costos)', '', '', '', '', '', '', '', '', '', (totalesAExportar.totalVenta || 0) - (totalesAExportar.subtotalCosto || 0), '']);

    // Recuadro de Movimientos de Caja Chica en CSV
    if (movimientosAExportar && movimientosAExportar.length > 0) {
      let tIng = 0;
      let tRet = 0;
      filas.push(['', '', '', '', '', '', '', '', '', '', '', '']);
      filas.push(['--- MOVIMIENTOS DE CAJA CHICA (INGRESOS / RETIROS) ---', '', '', '', '', '', '', '', '', '', '', '']);
      filas.push(['Fecha', 'Hora', 'Tipo', 'Detalle', '', '', '', '', '', 'Ingreso', 'Retiro', '']);
      for (const m of movimientosAExportar) {
        const monto = Number(m.monto) || 0;
        if (m.tipo === 'INGRESO') tIng += monto;
        if (m.tipo === 'RETIRO') tRet += monto;
        filas.push([
          m.fecha || '',
          m.hora || '',
          m.tipo,
          `"${(m.detalle || '').replace(/"/g, '""')}"`,
          '', '', '', '', '',
          m.tipo === 'INGRESO' ? m.monto : '',
          m.tipo === 'RETIRO' ? m.monto : '',
          ''
        ]);
      }
      filas.push(['TOTAL INGRESOS (+)', '', '', '', '', '', '', '', '', tIng, '', '']);
      filas.push(['TOTAL RETIROS (-)', '', '', '', '', '', '', '', '', '', tRet, '']);
      filas.push(['SALDO FINAL DE CAJA (Ventas + Ingresos - Retiros)', '', '', '', '', '', '', '', '', '', (totalesAExportar.totalVenta || 0) + tIng - tRet, '']);
    }

    const contenidoCsv = '\uFEFF' + filas.map((e) => e.join(',')).join('\n');
    const blob = new Blob([contenidoCsv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', nombreArchivo);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportar = async (tipo) => {
    try {
      if (tipo === 'cierre-diario') {
        const fechaTarget = modoFiltro === 'fecha' && fechaEspecifica ? fechaEspecifica : getHoyIso();
        const [data, resMovs] = await Promise.all([
          reporteService.obtenerReporteCaja({ fecha: fechaTarget }),
          cajaService.obtenerMovimientos({ fecha: fechaTarget }).catch(() => ({ data: [] }))
        ]);
        const pedidosExp = data?.pedidos || [];
        const totExp = {
          subtotalCosto: data?.total_costo || 0,
          totalVenta: data?.total_venta || 0
        };
        const listaMovs = resMovs?.data || resMovs || [];
        descargarCsv(pedidosExp, totExp, `Cierre_Diario_${fechaTarget}.csv`, listaMovs);
        toast.success(`Exportado Cierre Diario (${pedidosExp.length} ventas, ${listaMovs.length} movimientos)`);
      } else if (tipo === 'cierre-mes') {
        let desdeTarget = '';
        let hastaTarget = '';
        let mesTag = '';
        if (modoFiltro === 'mes-seleccionado' && mesSeleccionado) {
          const [anioStr, mesStr] = mesSeleccionado.split('-');
          const anio = parseInt(anioStr, 10);
          const mes = parseInt(mesStr, 10);
          const ultimoDia = new Date(anio, mes, 0).getDate();
          desdeTarget = `${anioStr}-${String(mes).padStart(2, '0')}-01`;
          hastaTarget = `${anioStr}-${String(mes).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`;
          mesTag = mesSeleccionado;
        } else {
          const ahora = new Date();
          const anio = ahora.getFullYear();
          const mes = ahora.getMonth() + 1;
          const ultimoDia = new Date(anio, mes, 0).getDate();
          desdeTarget = `${anio}-${String(mes).padStart(2, '0')}-01`;
          hastaTarget = `${anio}-${String(mes).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`;
          mesTag = `${anio}-${String(mes).padStart(2, '0')}`;
        }
        const [data, resMovs] = await Promise.all([
          reporteService.obtenerReporteCaja({ desde: desdeTarget, hasta: hastaTarget }),
          cajaService.obtenerMovimientos({ desde: desdeTarget, hasta: hastaTarget }).catch(() => ({ data: [] }))
        ]);
        const pedidosExp = data?.pedidos || [];
        const totExp = {
          subtotalCosto: data?.total_costo || 0,
          totalVenta: data?.total_venta || 0
        };
        const listaMovs = resMovs?.data || resMovs || [];
        descargarCsv(pedidosExp, totExp, `Cierre_Mes_${mesTag}.csv`, listaMovs);
        toast.success(`Exportado Cierre Mensual (${pedidosExp.length} ventas, ${listaMovs.length} movimientos)`);
      } else if (tipo === 'pestana-2') {
        const { desde, hasta, mesIso } = getRangoPestana2();
        const dataVentas = await reporteService.obtenerReporteCaja({ desde, hasta }).catch(() => ({ total_costo: 0, total_venta: 0 }));
        const subtotalCosto = Number(dataVentas?.total_costo) || 0;
        const totalVenta = Number(dataVentas?.total_venta) || ventasMesP2 || 0;
        descargarCsv([], { subtotalCosto, totalVenta }, `Movimientos_Caja_${mesIso}.csv`, movimientosP2, true);
        toast.success(`Exportados movimientos de ${mesesInfo.seleccionado} (${movimientosP2.length} movimientos)`);
      } else {
        exportarAExcel(tipo);
      }
    } catch (err) {
      console.error('Error al exportar a Excel:', err);
      toast.error('No se pudo generar la exportación a Excel.');
    }
  };

  const handleGenerarFactura = (pedidoId) => {
    toast.info(`Generando comprobante para Pedido #${pedidoId}...`, {
      description: 'Conexión con ARCA simulada con éxito.'
    });
  };

  // Título detallado que se mostrará DENTRO de la sección de Transacciones
  const getTituloTabla = () => {
    if (modoFiltro === 'hoy') {
      const hoy = new Date();
      return `Transacciones del ${String(hoy.getDate()).padStart(2, '0')}/${String(hoy.getMonth() + 1).padStart(2, '0')}/${hoy.getFullYear()}`;
    }
    if (modoFiltro === 'fecha') {
      const [y, m, d] = (fechaEspecifica || '').split('-');
      return `Transacciones del ${d}/${m}/${y}`;
    }
    return `Transacciones del período (${reporte.fecha || 'Mes'})`;
  };

  // Nombres de mes para las pestañas de Ingresos/Retiros y Motivos de Eliminación
  const getMesNombres = () => {
    const ahora = new Date();
    const anioActual = ahora.getFullYear();
    const mesActualNum = ahora.getMonth();

    const fActual = new Date(anioActual, mesActualNum, 1);
    const nomActual = fActual.toLocaleString('es-ES', { month: 'long' });
    const txtActual = `${nomActual.charAt(0).toUpperCase() + nomActual.slice(1)} ${anioActual}`;

    const fAnterior = new Date(anioActual, mesActualNum - 1, 1);
    const anioAnt = fAnterior.getFullYear();
    const nomAnt = fAnterior.toLocaleString('es-ES', { month: 'long' });
    const txtAnterior = `${nomAnt.charAt(0).toUpperCase() + nomAnt.slice(1)} ${anioAnt}`;

    return {
      actual: txtActual,
      anterior: txtAnterior,
      seleccionado: periodoOtrasPestanas === 'actual' ? txtActual : txtAnterior
    };
  };

  const mesesInfo = getMesNombres();

  // Redirección cruzada: al aplicar filtros de fecha desde cualquier pestaña, ir a Transacciones
  const aplicarFiltroHoy = () => {
    setPestanaActiva('transacciones');
    setModoFiltro('hoy');
    setFechaEspecifica(getHoyIso());
  };

  const aplicarFiltroMesActual = () => {
    setPestanaActiva('transacciones');
    setModoFiltro('mes');
  };

  const aplicarFiltroMesSeleccionado = (nuevoMes) => {
    setPestanaActiva('transacciones');
    setMesSeleccionado(nuevoMes);
    setModoFiltro('mes-seleccionado');
  };

  const aplicarFiltroFechaEspecifica = (nuevaFecha) => {
    setPestanaActiva('transacciones');
    setFechaEspecifica(nuevaFecha);
    setModoFiltro('fecha');
  };

  // Cálculo de la diferencia entre importes totales (Ventas - Costos)
  const diferenciaVentasCostos = (totales.totalVenta || 0) - (totales.subtotalCosto || 0);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 items-start">

      {/* COLUMNA IZQUIERDA: Filtros y Cierres */}
      <div className="xl:col-span-1 space-y-6">

        {/* Tarjeta 1: Filtrar Transacciones */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-border/30 space-y-5">
          <div className="flex items-center gap-2 text-primary font-semibold text-base">
            <CalendarIcon className="w-5 h-5 text-primary" />
            <span>Filtrar Transacciones</span>
          </div>

          {/* Botones Rápidos: Hoy y Mes Actual */}
          <div className="space-y-2.5">
            <button
              onClick={aplicarFiltroHoy}
              className={`w-full py-2.5 px-4 rounded-xl text-sm font-semibold transition-colors cursor-pointer ${
                modoFiltro === 'hoy' && pestanaActiva === 'transacciones'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-white text-primary border border-border/40 hover:bg-muted/40'
              }`}
            >
              Hoy
            </button>

            <button
              onClick={aplicarFiltroMesActual}
              className={`w-full py-2.5 px-4 rounded-xl text-sm font-semibold transition-colors cursor-pointer ${
                modoFiltro === 'mes' && pestanaActiva === 'transacciones'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-white text-primary border border-border/40 hover:bg-muted/40'
              }`}
            >
              Mes Actual
            </button>
          </div>

          {/* Selector de Mes */}
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground font-medium block">
              O seleccionar mes anterior:
            </label>
            <input
              type="month"
              value={mesSeleccionado}
              onChange={(e) => aplicarFiltroMesSeleccionado(e.target.value)}
              className="w-full bg-white border border-border/40 rounded-xl px-3 py-2 text-xs text-primary font-medium focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
            />
          </div>

          {/* Buscar fecha específica */}
          <div className="space-y-1.5 pt-1">
            <label className="text-xs text-primary font-semibold block">
              Buscar fecha específica:
            </label>
            <input
              type="date"
              value={fechaEspecifica}
              onChange={(e) => aplicarFiltroFechaEspecifica(e.target.value)}
              className="w-full bg-white border border-border/40 rounded-xl px-3 py-2 text-xs text-primary font-medium focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
            />
          </div>
        </div>

        {/* Tarjeta 2: CAJA DIARIA y CAJA MES */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-border/30 space-y-5">
          {/* CAJA DIARIA */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-2 text-primary font-semibold text-sm">
              <FileText className="w-4 h-4 text-primary" />
              <span>CAJA DIARIA</span>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={() => handleImprimir('cierre-diario')}
                className="flex items-center justify-center gap-1.5 py-2 px-3 bg-[#8C6D58] hover:bg-[#785C48] text-white rounded-xl text-xs font-medium transition-colors cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Imprimir</span>
              </button>
              <button
                onClick={() => handleExportar('cierre-diario')}
                className="flex items-center justify-center gap-1.5 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-medium transition-colors cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Excel</span>
              </button>
            </div>
          </div>

          {/* CAJA MES */}
          <div className="space-y-2.5 pt-2 border-t border-border/20">
            <div className="flex items-center gap-2 text-primary font-semibold text-sm">
              <FileText className="w-4 h-4 text-primary" />
              <span>CAJA MES</span>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={() => handleImprimir('cierre-mes')}
                className="flex items-center justify-center gap-1.5 py-2 px-3 bg-[#8C6D58] hover:bg-[#785C48] text-white rounded-xl text-xs font-medium transition-colors cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Imprimir</span>
              </button>
              <button
                onClick={() => handleExportar('cierre-mes')}
                className="flex items-center justify-center gap-1.5 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-medium transition-colors cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Excel</span>
              </button>
            </div>
          </div>
        </div>

        {/* Nota al pie */}
        <p className="text-[11px] text-muted-foreground italic leading-relaxed px-2">
          Nota: Esta sección funciona como caja interna. La facturación oficial de ARCA podrá implementarse en el botón "Generar Factura" en cada transacción.
        </p>

      </div>

      {/* COLUMNA DERECHA: Pestañas Estilo Google Chrome y Contenido */}
      <div className="xl:col-span-3 flex flex-col min-h-[620px]">

        {/* ── Barra de Pestañas estilo Google Chrome (Sin scroll, nombres limpios) ── */}
        <div className="flex items-end justify-between flex-wrap gap-2 px-3 pt-3 bg-[#FAF7F5] border-t border-l border-r border-border/30 rounded-t-2xl">
          <div className="flex items-end gap-1 shrink-0">
            {/* Pestaña 1: Transacciones */}
            <button
              type="button"
              onClick={() => setPestanaActiva('transacciones')}
              className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all cursor-pointer border-t border-l border-r whitespace-nowrap ${
                pestanaActiva === 'transacciones'
                  ? 'bg-white text-primary border-border/30 border-t-2 border-t-primary shadow-xs z-10 -mb-[1px]'
                  : 'bg-[#EDE7E2] text-muted-foreground border-transparent hover:bg-[#E4DCD6] hover:text-primary mb-0'
              }`}
            >
              Transacciones
            </button>

            {/* Pestaña 2: Ingresos/Retiros Caja */}
            <button
              type="button"
              onClick={() => setPestanaActiva('ingresos-retiros')}
              className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all cursor-pointer border-t border-l border-r whitespace-nowrap ${
                pestanaActiva === 'ingresos-retiros'
                  ? 'bg-white text-primary border-border/30 border-t-2 border-t-primary shadow-xs z-10 -mb-[1px]'
                  : 'bg-[#EDE7E2] text-muted-foreground border-transparent hover:bg-[#E4DCD6] hover:text-primary mb-0'
              }`}
            >
              Ingresos/Retiros Caja
            </button>

            {/* Pestaña 3: Motivos de Eliminacion */}
            <button
              type="button"
              onClick={() => setPestanaActiva('eliminados')}
              className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all cursor-pointer border-t border-l border-r whitespace-nowrap ${
                pestanaActiva === 'eliminados'
                  ? 'bg-white text-primary border-border/30 border-t-2 border-t-primary shadow-xs z-10 -mb-[1px]'
                  : 'bg-[#EDE7E2] text-muted-foreground border-transparent hover:bg-[#E4DCD6] hover:text-primary mb-0'
              }`}
            >
              Motivos de Eliminacion
            </button>
          </div>

          {/* Buscador de tickets (visible cuando está en Transacciones) */}
          {pestanaActiva === 'transacciones' && (
            <div className="relative w-full sm:w-64 mb-1.5">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar ticket..."
                className="w-full bg-white border border-border/40 rounded-xl pl-9 pr-3 py-1.5 text-xs text-primary placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs"
              />
            </div>
          )}
        </div>

        {/* ── Contenido de la Tarjeta según Pestaña Activa ── */}
        <div className="bg-white p-6 rounded-b-2xl shadow-sm border border-border/30 border-t-0 flex-1 flex flex-col">

          {/* PESTAÑA 1: TRANSACCIONES */}
          {pestanaActiva === 'transacciones' && (
            <>
              {/* Título detallado dentro de la sección */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-border/20 mb-4">
                <h2 className="text-lg font-bold text-primary tracking-tight">
                  {getTituloTabla()}
                </h2>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={recargar}
                    disabled={cargando}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#FAF7F5] hover:bg-[#F3E5DC]/50 text-primary border border-border/40 rounded-xl text-xs font-semibold transition-all cursor-pointer disabled:opacity-50 shadow-2xs"
                    title="Actualizar transacciones"
                  >
                    <RotateCw className={`w-3.5 h-3.5 ${cargando ? 'animate-spin' : ''}`} />
                    <span>Actualizar</span>
                  </button>
                </div>
              </div>

              {cargando ? (
                <div className="flex-1 py-28 flex flex-col items-center justify-center text-primary gap-3">
                  <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  <p className="text-xs font-medium text-muted-foreground animate-pulse">
                    Cargando transacciones de caja...
                  </p>
                </div>
              ) : error ? (
                <div className="flex-1 py-20 flex flex-col items-center justify-center text-center gap-3">
                  <AlertCircle className="w-9 h-9 text-destructive" />
                  <p className="text-sm font-semibold text-primary">{error}</p>
                  <button
                    onClick={recargar}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground text-xs font-medium rounded-lg hover:opacity-90 cursor-pointer"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                    Reintentar
                  </button>
                </div>
              ) : pedidosFiltrados.length === 0 ? (
                <div className="flex-1 py-28 flex flex-col items-center justify-center text-muted-foreground gap-2">
                  <Inbox className="w-10 h-10 opacity-30 text-secondary" />
                  <p className="text-sm font-medium text-primary">No hay transacciones registradas</p>
                  <p className="text-xs text-muted-foreground">
                    No se encontraron ventas para la fecha o término buscado.
                  </p>
                </div>
              ) : (
                <div className="flex-1 flex flex-col justify-between">
                  {/* Tabla con scroll horizontal responsivo */}
                  <div className="overflow-x-auto pt-1">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-border/20 text-muted-foreground font-semibold text-[11px]">
                          <th className="pb-3 pr-4 font-semibold">Fecha</th>
                          <th className="pb-3 pr-4 font-semibold">Hora</th>
                          <th className="pb-3 pr-4 font-semibold">Nº Pedido</th>
                          <th className="pb-3 pr-4 font-semibold">Producto</th>
                          <th className="pb-3 pr-4 font-semibold text-center">Cant.</th>
                          <th className="pb-3 pr-4 font-semibold text-right">Costo U.</th>
                          <th className="pb-3 pr-4 font-semibold text-right">Venta U.</th>
                          <th className="pb-3 pr-4 font-semibold text-right">Costo Tot.</th>
                          <th className="pb-3 pr-4 font-semibold text-right">Venta Tot.</th>
                          <th className="pb-3 pr-4 font-semibold text-center">Estado</th>
                          <th className="pb-3 text-center font-semibold">Acciones</th>
                        </tr>
                      </thead>
                      {pedidosFiltrados.map((pedido) => {
                        const items = pedido.items && pedido.items.length > 0
                          ? pedido.items
                          : [{
                              detalle_id: `sin-item-${pedido.id}`,
                              nombre_producto: 'Venta Consolidada',
                              cantidad: 1,
                              precio_costo: pedido.total_costo,
                              precio_venta: pedido.total_venta,
                              costo_total: pedido.total_costo,
                              venta_total: pedido.total_venta
                            }];

                        return (
                          <tbody
                            key={pedido.id}
                            className="border-b border-border/20 last:border-b-0 hover:bg-muted/10 transition-colors"
                          >
                            {items.map((item, index) => {
                              const esPrimerItem = index === 0;

                              return (
                                <tr key={`${pedido.id}-${item.detalle_id || index}`}>
                                  {/* Fecha (centrado verticalmente con rowSpan) */}
                                  {esPrimerItem && (
                                    <td
                                      rowSpan={items.length}
                                      className="py-3.5 pr-4 text-primary font-medium align-middle whitespace-nowrap"
                                    >
                                      {formatearFechaDDMMAAAA(pedido.fecha || reporte.fecha || getHoyIso())}
                                    </td>
                                  )}

                                  {/* Hora (centrado verticalmente con rowSpan) */}
                                  {esPrimerItem && (
                                    <td
                                      rowSpan={items.length}
                                      className="py-3.5 pr-4 text-muted-foreground font-medium align-middle whitespace-nowrap"
                                    >
                                      {pedido.hora || '-'}
                                    </td>
                                  )}

                                  {/* Nº Pedido con botón para ver ticket (centrado verticalmente) */}
                                  {esPrimerItem && (
                                    <td
                                      rowSpan={items.length}
                                      className="py-3.5 pr-4 align-middle"
                                    >
                                      <button
                                        onClick={() => handleAbrirDetalle(pedido)}
                                        className="text-primary hover:text-accent font-bold hover:underline cursor-pointer block"
                                        title="Ver detalle del pedido"
                                      >
                                        {String(pedido.id).startsWith('#') ? pedido.id : `#${pedido.id}`}
                                      </button>
                                      <span className="text-[10px] text-muted-foreground whitespace-nowrap block">
                                        {pedido.tipo_pedido || 'Mostrador'} • {pedido.metodo_pago || 'Efectivo'}
                                      </span>
                                    </td>
                                  )}

                                  {/* Producto */}
                                  <td className="py-2.5 pr-4 text-primary font-medium">
                                    {item.nombre_producto}
                                  </td>

                                  {/* Cantidad */}
                                  <td className="py-2.5 pr-4 text-center text-primary font-semibold">
                                    {item.cantidad}
                                  </td>

                                  {/* Costo Unitario */}
                                  <td className="py-2.5 pr-4 text-right text-muted-foreground font-medium">
                                    {formatearPrecio(item.precio_costo)}
                                  </td>

                                  {/* Venta Unitaria */}
                                  <td className="py-2.5 pr-4 text-right text-primary font-medium">
                                    {formatearPrecio(item.precio_venta)}
                                  </td>

                                  {/* Costo Total */}
                                  <td className="py-2.5 pr-4 text-right text-red-600 font-semibold align-middle">
                                    {formatearPrecio(item.costo_total)}
                                  </td>

                                  {/* Venta Total */}
                                  <td className="py-2.5 pr-4 text-right text-emerald-600 font-bold align-middle">
                                    {formatearPrecio(item.venta_total)}
                                  </td>

                                  {/* Estado (centrado verticalmente con rowSpan) */}
                                  {esPrimerItem && (
                                    <td
                                      rowSpan={items.length}
                                      className="py-3.5 pr-4 text-center align-middle"
                                    >
                                      <span
                                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap ${getBadgeEstado(
                                          pedido.estado
                                        )}`}
                                      >
                                        {formatEstadoNombre(pedido.estado)}
                                      </span>
                                    </td>
                                  )}

                                  {/* Acciones: Generar Factura (centrado verticalmente con rowSpan) */}
                                  {esPrimerItem && (
                                    <td
                                      rowSpan={items.length}
                                      className="py-3.5 text-center align-middle"
                                    >
                                      <button
                                        onClick={() => handleGenerarFactura(pedido.id)}
                                        className="px-3 py-1 border border-blue-300 text-blue-600 hover:bg-blue-50 hover:border-blue-400 rounded-lg text-[11px] font-semibold transition-colors whitespace-nowrap cursor-pointer"
                                      >
                                        Generar Factura
                                      </button>
                                    </td>
                                  )}
                                </tr>
                              );
                            })}
                          </tbody>
                        );
                      })}
                    </table>
                  </div>

                  {/* Totales al pie de la tabla de ventas */}
                  <div className="pt-6 border-t border-border/20 flex flex-wrap justify-end items-center gap-6 sm:gap-8 text-right">
                    <div>
                      <p className="text-xs text-muted-foreground font-medium">Subtotal (Costos)</p>
                      <p className="text-base font-bold text-red-600">
                        {formatearPrecio(totales.subtotalCosto)}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-muted-foreground font-medium">Total Ventas</p>
                      <p className="text-xl font-extrabold text-primary">
                        {formatearPrecio(totales.totalVenta)}
                      </p>
                    </div>

                    <div className="border-l border-border/40 pl-6">
                      <p className="text-xs text-muted-foreground font-medium">
                        Diferencia (Ventas - Costos)
                      </p>
                      <p className="text-xl font-black text-emerald-700">
                        {formatearPrecio(diferenciaVentasCostos)}
                      </p>
                    </div>
                  </div>

                  {/* Recuadro de Movimientos de Caja Chica (Punto 3.3, 3.4 y 3.5) */}
                  <div className="mt-8 p-5 bg-[#FAF7F5] rounded-2xl border border-border/30 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/20 pb-3">
                      <div className="flex items-center gap-2">
                        <Wallet className="w-4 h-4 text-primary" />
                        <h3 className="font-bold text-sm text-primary">
                          Movimientos de Caja Chica (Ingresos y Retiros) del Período
                        </h3>
                      </div>
                      <span className="text-xs text-muted-foreground font-medium">
                        {movimientos.length} movimiento{movimientos.length === 1 ? '' : 's'} registrado{movimientos.length === 1 ? '' : 's'}
                      </span>
                    </div>

                    {cargandoMovimientos ? (
                      <div className="py-6 flex items-center justify-center text-primary gap-2">
                        <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        <span className="text-xs">Actualizando movimientos...</span>
                      </div>
                    ) : movimientos.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic py-2">
                        No se registraron ingresos ni retiros manuales en este período.
                      </p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-border/20 text-muted-foreground font-semibold text-[11px]">
                              <th className="pb-2 pr-3 font-semibold">Fecha</th>
                              <th className="pb-2 pr-3 font-semibold">Hora</th>
                              <th className="pb-2 pr-3 font-semibold">Tipo</th>
                              <th className="pb-2 pr-3 font-semibold">Detalle</th>
                              <th className="pb-2 pr-3 text-right font-semibold">Ingreso</th>
                              <th className="pb-2 text-right font-semibold">Retiro</th>
                            </tr>
                          </thead>
                          <tbody>
                            {movimientos.map((m) => (
                              <tr
                                key={m.id}
                                className="border-b border-border/10 last:border-b-0 hover:bg-muted/10 transition-colors"
                              >
                                <td className="py-2 pr-3 text-primary font-medium whitespace-nowrap">
                                  {formatearFechaDDMMAAAA(m.fecha)}
                                </td>
                                <td className="py-2 pr-3 text-muted-foreground whitespace-nowrap">
                                  {m.hora || '-'}
                                </td>
                                <td className="py-2 pr-3 whitespace-nowrap">
                                  <span
                                    className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                      m.tipo === 'INGRESO'
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : 'bg-red-100 text-red-800'
                                    }`}
                                  >
                                    {m.tipo}
                                  </span>
                                </td>
                                <td className="py-2 pr-3 text-primary font-medium">
                                  {m.detalle}
                                </td>
                                <td className="py-2 pr-3 text-right font-bold text-emerald-700 whitespace-nowrap">
                                  {m.tipo === 'INGRESO' ? `+${formatearPrecio(m.monto)}` : '-'}
                                </td>
                                <td className="py-2 text-right font-bold text-red-600 whitespace-nowrap">
                                  {m.tipo === 'RETIRO' ? `-${formatearPrecio(m.monto)}` : '-'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Resumen del Saldo Final con Ingresos y Retiros */}
                    <div className="pt-3 border-t border-border/20 flex flex-wrap justify-end items-center gap-6 sm:gap-8 text-right">
                      <div>
                        <p className="text-xs text-muted-foreground font-medium">Total Ventas</p>
                        <p className="text-base font-bold text-primary">
                          {formatearPrecio(totales.totalVenta)}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-muted-foreground font-medium">(+) Total Ingresos</p>
                        <p className="text-base font-bold text-emerald-700">
                          +{formatearPrecio(totalesMovimientos.totalIngresos)}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-muted-foreground font-medium">(-) Total Retiros</p>
                        <p className="text-base font-bold text-red-600">
                          -{formatearPrecio(totalesMovimientos.totalRetiros)}
                        </p>
                      </div>

                      <div className="bg-white px-4 py-2 rounded-xl border border-border/40 shadow-xs">
                        <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">
                          Saldo Final de Caja
                        </p>
                        <p className="text-xl font-black text-primary">
                          {formatearPrecio(totalesMovimientos.saldoFinal)}
                        </p>
                      </div>
                    </div>
                  </div>

                </div>
              )}
            </>
          )}

          {/* PESTAÑA 2: INGRESOS / RETIROS DE CAJA (FASE 3) */}
          {pestanaActiva === 'ingresos-retiros' && (
            <div className="flex-1 flex flex-col justify-between py-2 space-y-6">
              <div className="space-y-5">
                {/* Cabecera de la sección */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-border/20">
                  <div>
                    <h3 className="text-base font-bold text-primary">
                      Registro de Ingresos y Retiros de Caja - {mesesInfo.seleccionado}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Control de entradas y salidas de caja chica con validación de saldo
                    </p>
                  </div>

                  {/* Arriba a la derecha: Botones de Mes Anterior / Mes Actual + Imprimir / Exportar */}
                  <div className="flex items-center gap-2 shrink-0 flex-nowrap">
                    {/* Selector de Mes */}
                    <div className="flex items-center gap-1 bg-[#FAF7F5] p-1 rounded-xl border border-border/40 shadow-2xs shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setPeriodoOtrasPestanas('anterior');
                          toast.info(`Viendo período: ${mesesInfo.anterior}`);
                        }}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                          periodoOtrasPestanas === 'anterior'
                            ? 'bg-primary text-primary-foreground shadow-xs'
                            : 'bg-transparent text-primary hover:bg-muted/50'
                        }`}
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                        <span>Ver mes anterior</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setPeriodoOtrasPestanas('actual');
                          toast.info(`Viendo período: ${mesesInfo.actual}`);
                        }}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                          periodoOtrasPestanas === 'actual'
                            ? 'bg-primary text-primary-foreground shadow-xs'
                            : 'bg-transparent text-primary hover:bg-muted/50'
                        }`}
                      >
                        <span>Mes actual</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleImprimir('pestana-2')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#8C6D58] hover:bg-[#785C48] text-white rounded-xl text-xs font-semibold cursor-pointer whitespace-nowrap shadow-2xs transition-colors"
                      title="Imprimir reporte de movimientos"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Imprimir</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleExportar('pestana-2')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold cursor-pointer whitespace-nowrap shadow-2xs transition-colors"
                      title="Exportar movimientos a Excel"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      <span>Exportar</span>
                    </button>
                  </div>
                </div>

                {/* Tarjetas resumen de fondos disponibles */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-[#FAF7F5] p-3.5 rounded-xl border border-border/30">
                    <p className="text-[11px] text-muted-foreground font-medium">Ventas del Mes</p>
                    <p className="text-base font-bold text-primary">
                      {formatearPrecio(ventasMesP2)}
                    </p>
                  </div>

                  <div className="bg-emerald-50/70 p-3.5 rounded-xl border border-emerald-200">
                    <p className="text-[11px] text-emerald-800 font-medium">(+) Total Ingresos</p>
                    <p className="text-base font-bold text-emerald-700">
                      +{formatearPrecio(totalesP2.totalIngresos)}
                    </p>
                  </div>

                  <div className="bg-red-50/70 p-3.5 rounded-xl border border-red-200">
                    <p className="text-[11px] text-red-800 font-medium">(-) Total Retiros</p>
                    <p className="text-base font-bold text-red-600">
                      -{formatearPrecio(totalesP2.totalRetiros)}
                    </p>
                  </div>

                  <div className="bg-white p-3.5 rounded-xl border-2 border-primary/30 shadow-xs">
                    <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">
                      Saldo Final de Caja
                    </p>
                    <p className="text-base font-black text-primary">
                      {formatearPrecio(totalesP2.saldoFinal)}
                    </p>
                  </div>
                </div>

                {/* 3.1 Maquetación de la tabla de Ingresos/Retiros */}
                <div className="overflow-x-auto border border-border/30 rounded-2xl">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-[#FAF7F5] border-b border-border/20 text-muted-foreground font-semibold text-[11px]">
                        <th className="py-3 px-4 font-semibold w-28">Fecha / Hora</th>
                        <th className="py-3 px-4 font-semibold">Detalle</th>
                        <th className="py-3 px-4 font-semibold text-right w-36">Ingreso $</th>
                        <th className="py-3 px-4 font-semibold text-right w-36">Retiro $</th>
                        <th className="py-3 px-4 text-center font-semibold w-28">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* 3.2 Fila editable de nueva transacción */}
                      <tr className="bg-[#FAF7F5]/80 border-b-2 border-primary/20">
                        <td className="py-2.5 px-4 text-primary font-medium whitespace-nowrap align-middle">
                          <span className="inline-block px-2 py-0.5 bg-primary/10 text-primary text-[10px] font-bold rounded-md">
                            Nueva Operación
                          </span>
                        </td>
                        <td className="py-2.5 px-4 align-middle">
                          <input
                            type="text"
                            value={nuevoDetalle}
                            onChange={(e) => setNuevoDetalle(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleGuardarP2();
                            }}
                            placeholder="Escribir detalle del movimiento (ej: Pago de flete, cambio...)"
                            className="w-full bg-white border border-border/40 rounded-xl px-3 py-1.5 text-xs text-primary font-medium focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs"
                          />
                        </td>
                        <td className="py-2.5 px-4 align-middle">
                          <div className="relative">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={nuevoIngreso}
                              onChange={handleCambioIngreso}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleGuardarP2();
                              }}
                              placeholder="$ 0.00"
                              className="w-full text-right bg-white border border-emerald-300 rounded-xl px-2.5 py-1.5 text-xs text-emerald-700 font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500 shadow-2xs placeholder:text-emerald-300"
                            />
                          </div>
                        </td>
                        <td className="py-2.5 px-4 align-middle">
                          <div className="relative">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={nuevoRetiro}
                              onChange={handleCambioRetiro}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleGuardarP2();
                              }}
                              placeholder="$ 0.00"
                              className="w-full text-right bg-white border border-red-300 rounded-xl px-2.5 py-1.5 text-xs text-red-600 font-semibold focus:outline-none focus:ring-1 focus:ring-red-500 shadow-2xs placeholder:text-red-300"
                            />
                          </div>
                        </td>
                        <td className="py-2.5 px-4 text-center align-middle whitespace-nowrap">
                          <button
                            type="button"
                            onClick={handleGuardarP2}
                            disabled={guardandoMovimiento}
                            className="inline-flex items-center justify-center gap-1 px-3 py-1.5 bg-primary text-primary-foreground hover:opacity-90 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
                          >
                            <PlusCircle className="w-3.5 h-3.5" />
                            <span>{guardandoMovimiento ? 'Guardando...' : 'Guardar'}</span>
                          </button>
                        </td>
                      </tr>

                      {/* Lista de movimientos registrados */}
                      {cargandoP2 ? (
                        <tr>
                          <td colSpan={5} className="py-12 text-center text-primary">
                            <div className="flex flex-col items-center justify-center gap-2">
                              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                              <span className="text-xs font-medium">Cargando movimientos...</span>
                            </div>
                          </td>
                        </tr>
                      ) : movimientosP2.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-12 text-center text-muted-foreground">
                            <div className="flex flex-col items-center justify-center gap-1.5">
                              <Inbox className="w-8 h-8 opacity-30 text-secondary" />
                              <p className="text-xs font-medium text-primary">
                                No hay ingresos ni retiros registrados en {mesesInfo.seleccionado}.
                              </p>
                              <p className="text-[11px] text-muted-foreground">
                                Utiliza la fila superior para agregar una nueva entrada o salida de caja chica.
                              </p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        movimientosP2.map((m) => (
                          <tr
                            key={m.id}
                            className="border-b border-border/10 last:border-b-0 hover:bg-muted/10 transition-colors"
                          >
                            <td className="py-3 px-4 text-primary font-medium whitespace-nowrap align-middle">
                              <div className="text-xs font-semibold">{formatearFechaDDMMAAAA(m.fecha)}</div>
                              <div className="text-[10px] text-muted-foreground">{m.hora || '-'}</div>
                            </td>

                            <td className="py-3 px-4 text-primary font-medium align-middle">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                                    m.tipo === 'INGRESO'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : 'bg-red-100 text-red-800'
                                  }`}
                                >
                                  {m.tipo}
                                </span>
                                <span className="font-semibold text-primary">{m.detalle}</span>
                              </div>
                            </td>

                            <td className="py-3 px-4 text-right font-bold text-emerald-700 whitespace-nowrap align-middle">
                              {m.tipo === 'INGRESO' ? `+${formatearPrecio(m.monto)}` : '-'}
                            </td>

                            <td className="py-3 px-4 text-right font-bold text-red-600 whitespace-nowrap align-middle">
                              {m.tipo === 'RETIRO' ? `-${formatearPrecio(m.monto)}` : '-'}
                            </td>

                            <td className="py-3 px-4 text-center align-middle whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => handleSolicitarEliminar(m)}
                                className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                title="Eliminar movimiento"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>

                    {/* 3.6 Fila inferior de totales calculados automáticamente */}
                    <tfoot>
                      <tr className="bg-[#FAF7F5] border-t-2 border-border/30 font-bold text-xs">
                        <td colSpan={2} className="py-3 px-4 text-primary font-bold">
                          TOTALES DEL PERÍODO ({mesesInfo.seleccionado})
                        </td>
                        <td className="py-3 px-4 text-right font-black text-emerald-700 whitespace-nowrap">
                          +{formatearPrecio(totalesP2.totalIngresos)}
                        </td>
                        <td className="py-3 px-4 text-right font-black text-red-600 whitespace-nowrap">
                          -{formatearPrecio(totalesP2.totalRetiros)}
                        </td>
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold ${
                              totalesP2.saldoNeto >= 0
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            Neto: {formatearPrecio(totalesP2.saldoNeto)}
                          </span>
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* PESTAÑA 3: MOTIVOS DE ELIMINACION */}
          {pestanaActiva === 'eliminados' && (
            <div className="flex-1 flex flex-col justify-between py-2">
              <div className="space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-border/20">
                  <div>
                    <h3 className="text-base font-bold text-primary">
                      Lista de Productos Eliminados de {mesesInfo.seleccionado}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Auditoría acumulativa mensual de mermas y cancelaciones (Solo Lectura)
                    </p>
                  </div>

                  {/* Arriba a la derecha: Botones de Mes Anterior / Mes Actual + Imprimir / Exportar */}
                  <div className="flex items-center gap-2 shrink-0 flex-nowrap">
                    {/* Selector de Mes */}
                    <div className="flex items-center gap-1 bg-[#FAF7F5] p-1 rounded-xl border border-border/40 shadow-2xs shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setPeriodoOtrasPestanas('anterior');
                          toast.info(`Viendo período: ${mesesInfo.anterior}`);
                        }}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                          periodoOtrasPestanas === 'anterior'
                            ? 'bg-primary text-primary-foreground shadow-xs'
                            : 'bg-transparent text-primary hover:bg-muted/50'
                        }`}
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                        <span>Ver mes anterior</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setPeriodoOtrasPestanas('actual');
                          toast.info(`Viendo período: ${mesesInfo.actual}`);
                        }}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                          periodoOtrasPestanas === 'actual'
                            ? 'bg-primary text-primary-foreground shadow-xs'
                            : 'bg-transparent text-primary hover:bg-muted/50'
                        }`}
                      >
                        <span>Mes actual</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      disabled
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#8C6D58]/60 text-white rounded-xl text-xs font-semibold cursor-not-allowed whitespace-nowrap shadow-2xs"
                      title="Imprimir"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Imprimir</span>
                    </button>
                    <button
                      type="button"
                      disabled
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600/60 text-white rounded-xl text-xs font-semibold cursor-not-allowed whitespace-nowrap shadow-2xs"
                      title="Exportar"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      <span>Exportar</span>
                    </button>
                  </div>
                </div>

                <div className="py-20 flex flex-col items-center justify-center text-center gap-3 border-2 border-dashed border-border/40 rounded-2xl p-8 bg-[#FAF7F5]/50">
                  <div className="w-12 h-12 rounded-full bg-[#F3E5DC] flex items-center justify-center text-[#9F4F2F]">
                    <ReceiptText className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-bold text-primary">
                    Pestaña "Motivos de Eliminacion" ({mesesInfo.seleccionado})
                  </p>
                  <p className="text-xs text-muted-foreground max-w-md">
                    En las siguientes fases se listarán los productos eliminados por VENCIDO, MERMA y EN FALTA con la sumatoria del costo total del mes.
                  </p>
                </div>
              </div>
            </div>
          )}

        </div>

      </div>

      {/* Plantilla de Impresión nativa mediante PrintPortal */}
      <ReporteCajaPrint
        tipoReporte={datosImpresion?.tipoReporte || 'cierre'}
        titulo={datosImpresion?.titulo || tituloImpresion}
        periodo={datosImpresion?.periodo || getTituloTabla()}
        pedidos={datosImpresion ? datosImpresion.pedidos : pedidosFiltrados}
        totales={datosImpresion ? datosImpresion.totales : totales}
        ticketPedido={ticketPedidoImprimir}
        movimientos={datosImpresion?.movimientos !== undefined ? datosImpresion.movimientos : movimientos}
      />

      {/* Modal de Detalle Interno del Pedido */}
      <DetallePedidoModal
        pedido={pedidoSeleccionado}
        abierto={modalDetalleAbierto}
        alCerrar={() => setModalDetalleAbierto(false)}
        alImprimir={handleImprimirTicket}
      />

      {/* Modal de Confirmación para Eliminar Movimiento de Caja (Punto 3.5) */}
      <ModalConfirmarEliminar
        movimiento={movimientoAEliminar}
        abierto={modalEliminarAbierto}
        alCerrar={() => {
          setModalEliminarAbierto(false);
          setMovimientoAEliminar(null);
        }}
        alConfirmar={handleConfirmarEliminar}
        cargando={eliminandoMovimiento}
      />

    </div>
  );
}
