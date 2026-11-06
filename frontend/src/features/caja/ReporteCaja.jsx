import React, { useState } from 'react';
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
  ReceiptText
} from 'lucide-react';
import { toast } from 'sonner';
import { useReporteCaja } from '@/hooks/useReporteCaja';
import { formatearPrecio } from '@/utils/formatters';
import { ReporteCajaPrint } from './ReporteCajaPrint';
import { DetallePedidoModal } from './DetallePedidoModal';

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
  const [pedidoSeleccionado, setPedidoSeleccionado] = useState(null);
  const [modalDetalleAbierto, setModalDetalleAbierto] = useState(false);
  const [ticketPedidoImprimir, setTicketPedidoImprimir] = useState(null);

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

  const handleImprimir = (tipo) => {
    if (tipo === 'cierre-diario') {
      setTituloImpresion('Reporte de CAJA DIARIA');
    } else if (tipo === 'cierre-mes') {
      setTituloImpresion('Reporte de CAJA MES');
    } else {
      setTituloImpresion(getTituloTabla());
    }

    setTimeout(() => {
      imprimirReporte();
    }, 50);
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

        {/* Tarjeta 1: Filtros por Fecha de Transacción */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-border/30 space-y-5">
          <div className="flex items-center gap-2 text-primary font-semibold text-base">
            <CalendarIcon className="w-5 h-5 text-primary" />
            <span>Filtros por Fecha de Transacción</span>
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
                onClick={() => exportarAExcel('cierre-diario')}
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
                onClick={() => exportarAExcel('cierre-mes')}
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
              </div>

              {cargando ? (
                <div className="flex-1 py-28 flex flex-col items-center justify-center text-primary gap-3">
                  <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  <p className="text-xs font-medium">Cargando transacciones de caja...</p>
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
                                  {/* Hora (centrado verticalmente con rowSpan) */}
                                  {esPrimerItem && (
                                    <td
                                      rowSpan={items.length}
                                      className="py-3.5 pr-4 text-muted-foreground font-medium align-middle"
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
                                        className="text-primary hover:text-accent font-bold hover:underline cursor-pointer"
                                        title="Ver detalle del pedido"
                                      >
                                        #{pedido.id}
                                      </button>
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

                  {/* Totales al pie de la tabla con Diferencia (Costos vs Ventas) */}
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
                </div>
              )}
            </>
          )}

          {/* PESTAÑA 2: INGRESOS / RETIROS DE CAJA */}
          {pestanaActiva === 'ingresos-retiros' && (
            <div className="flex-1 flex flex-col justify-between py-2">
              <div className="space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-border/20">
                  <div>
                    <h3 className="text-base font-bold text-primary">
                      Registro de Ingresos y Retiros de Caja - {mesesInfo.seleccionado}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Control de entradas y salidas de caja chica
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
                    <TrendingUp className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-bold text-primary">
                    Pestaña "Ingresos/Retiros Caja" ({mesesInfo.seleccionado})
                  </p>
                  <p className="text-xs text-muted-foreground max-w-md">
                    Listo para la siguiente fase: tabla de movimientos con botón Guardar, validación de fondos y sumatoria/resta en CAJA DIARIA y CAJA MES.
                  </p>
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
        titulo={tituloImpresion}
        periodo={getTituloTabla()}
        pedidos={pedidosFiltrados}
        totales={totales}
        ticketPedido={ticketPedidoImprimir}
      />

      {/* Modal de Detalle Interno del Pedido */}
      <DetallePedidoModal
        pedido={pedidoSeleccionado}
        abierto={modalDetalleAbierto}
        alCerrar={() => setModalDetalleAbierto(false)}
        alImprimir={handleImprimirTicket}
      />

    </div>
  );
}
