import React from 'react';
import {
  Calendar as CalendarIcon,
  Search,
  Printer,
  FileSpreadsheet,
  FileText,
  RotateCw,
  AlertCircle,
  Inbox
} from 'lucide-react';
import { toast } from 'sonner';
import { useReporteCaja } from '@/hooks/useReporteCaja';
import { formatearPrecio } from '@/utils/formatters';
import { ReporteCajaPrint } from './ReporteCajaPrint';

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
    imprimirReporte
  } = useReporteCaja();

  const [tituloImpresion, setTituloImpresion] = React.useState('Reporte de Cierre de Caja');

  const handleImprimir = (tipo) => {
    if (tipo === 'cierre-diario') {
      setTituloImpresion('Reporte de Cierre Diario de Caja');
    } else if (tipo === 'cierre-mes') {
      setTituloImpresion('Reporte de Cierre Mensual de Caja');
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

  // Título dinámico para la tabla
  const getTituloTabla = () => {
    if (modoFiltro === 'hoy') {
      const hoy = new Date();
      return `Transacciones del ${String(hoy.getDate()).padStart(2, '0')}/${String(hoy.getMonth() + 1).padStart(2, '0')}/${hoy.getFullYear()}`;
    }
    if (modoFiltro === 'fecha') {
      const [y, m, d] = fechaEspecifica.split('-');
      return `Transacciones del ${d}/${m}/${y}`;
    }
    return `Transacciones del período (${reporte.fecha || 'Mes'})`;
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 items-start">

      {/* COLUMNA IZQUIERDA: Filtros y Cierres */}
      <div className="xl:col-span-1 space-y-6">

        {/* Tarjeta 1: Filtros de Fecha */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-border/30 space-y-5">
          <div className="flex items-center gap-2 text-primary font-semibold text-base">
            <CalendarIcon className="w-5 h-5 text-primary" />
            <span>Filtros de Fecha</span>
          </div>

          {/* Botones Rápidos: Hoy y Mes Actual */}
          <div className="space-y-2.5">
            <button
              onClick={() => setModoFiltro('hoy')}
              className={`w-full py-2.5 px-4 rounded-xl text-sm font-semibold transition-colors ${
                modoFiltro === 'hoy'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-white text-primary border border-border/40 hover:bg-muted/40'
              }`}
            >
              Hoy
            </button>

            <button
              onClick={() => setModoFiltro('mes')}
              className={`w-full py-2.5 px-4 rounded-xl text-sm font-semibold transition-colors ${
                modoFiltro === 'mes'
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
              onChange={(e) => {
                setMesSeleccionado(e.target.value);
                setModoFiltro('mes-seleccionado');
              }}
              className="w-full bg-white border border-border/40 rounded-xl px-3 py-2 text-xs text-primary font-medium focus:outline-none focus:ring-1 focus:ring-primary"
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
              onChange={(e) => {
                setFechaEspecifica(e.target.value);
                setModoFiltro('fecha');
              }}
              className="w-full bg-white border border-border/40 rounded-xl px-3 py-2 text-xs text-primary font-medium focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        {/* Tarjeta 2: Cierres y Exportaciones */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-border/30 space-y-5">
          {/* Cierre Diario */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-2 text-primary font-semibold text-sm">
              <FileText className="w-4 h-4 text-primary" />
              <span>Cierre Diario</span>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={() => handleImprimir('cierre-diario')}
                className="flex items-center justify-center gap-1.5 py-2 px-3 bg-[#8C6D58] hover:bg-[#785C48] text-white rounded-xl text-xs font-medium transition-colors"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Imprimir</span>
              </button>
              <button
                onClick={() => exportarAExcel('cierre-diario')}
                className="flex items-center justify-center gap-1.5 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-medium transition-colors"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Excel</span>
              </button>
            </div>
          </div>

          {/* Cierre Mes */}
          <div className="space-y-2.5 pt-2 border-t border-border/20">
            <div className="flex items-center gap-2 text-primary font-semibold text-sm">
              <FileText className="w-4 h-4 text-primary" />
              <span>Cierre Mes</span>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={() => handleImprimir('cierre-mes')}
                className="flex items-center justify-center gap-1.5 py-2 px-3 bg-[#8C6D58] hover:bg-[#785C48] text-white rounded-xl text-xs font-medium transition-colors"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Imprimir</span>
              </button>
              <button
                onClick={() => exportarAExcel('cierre-mes')}
                className="flex items-center justify-center gap-1.5 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-medium transition-colors"
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

      {/* COLUMNA DERECHA: Tabla de Transacciones */}
      <div className="xl:col-span-3 bg-white p-6 rounded-2xl shadow-sm border border-border/30 flex flex-col min-h-[620px]">

        {/* Barra superior: Título y Buscador */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-5 border-b border-border/20">
          <h2 className="text-lg font-bold text-primary tracking-tight">
            {getTituloTabla()}
          </h2>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar ticket..."
              className="w-full bg-[#FAF7F5] border border-border/30 rounded-xl pl-9 pr-3 py-1.5 text-xs text-primary placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        {/* Contenido: Loading, Error o Tabla */}
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
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground text-xs font-medium rounded-lg hover:opacity-90"
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
            <div className="overflow-x-auto pt-2">
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

                            {/* Nº Pedido y subtítulo (centrado verticalmente con rowSpan) */}
                            {esPrimerItem && (
                              <td
                                rowSpan={items.length}
                                className="py-3.5 pr-4 align-middle"
                              >
                                <div className="space-y-0.5">
                                  <span className="font-bold text-primary text-xs underline decoration-dotted">
                                    #{pedido.id}
                                  </span>
                                  <p className="text-[10px] text-muted-foreground whitespace-nowrap">
                                    {pedido.tipo_pedido} • {pedido.metodo_pago}
                                  </p>
                                </div>
                              </td>
                            )}

                            {/* Producto */}
                            <td className="py-2.5 pr-4 text-primary font-medium align-middle">
                              {item.nombre_producto}
                            </td>

                            {/* Cantidad */}
                            <td className="py-2.5 pr-4 text-center font-medium text-primary align-middle">
                              {item.cantidad}
                            </td>

                            {/* Costo Unitario */}
                            <td className="py-2.5 pr-4 text-right text-red-500 font-semibold align-middle">
                              {formatearPrecio(item.precio_costo)}
                            </td>

                            {/* Venta Unitaria */}
                            <td className="py-2.5 pr-4 text-right text-primary font-semibold align-middle">
                              {formatearPrecio(item.precio_venta)}
                            </td>

                            {/* Costo Total */}
                            <td className="py-2.5 pr-4 text-right text-red-500 font-bold align-middle">
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
                                  className="px-3 py-1 border border-blue-300 text-blue-600 hover:bg-blue-50 hover:border-blue-400 rounded-lg text-[11px] font-semibold transition-colors whitespace-nowrap"
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

            {/* Totales al pie de la tabla */}
            <div className="pt-6 border-t border-border/20 flex justify-end items-center gap-8 text-right">
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
            </div>
          </div>
        )}

      </div>

      {/* Plantilla de Impresión nativa mediante PrintPortal */}
      <ReporteCajaPrint
        titulo={tituloImpresion}
        periodo={getTituloTabla()}
        pedidos={pedidosFiltrados}
        totales={totales}
      />

    </div>
  );
}

