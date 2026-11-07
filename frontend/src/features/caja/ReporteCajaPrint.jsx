import React from 'react';
import { PrintPortal } from '@/components/PrintPortal';
import { formatearPrecio, formatearFecha } from '@/utils/formatters';

const formatearFechaDDMMAAAA = (fechaStr) => {
  if (!fechaStr) return '-';
  const soloFecha = String(fechaStr).split('T')[0];
  const partes = soloFecha.split('-');
  if (partes.length === 3) {
    return `${partes[2].padStart(2, '0')}/${partes[1].padStart(2, '0')}/${partes[0]}`;
  }
  return fechaStr;
};

const formatEstadoNombre = (estado) => {
  const s = String(estado || '').toLowerCase().trim();
  if (s === 'en_empaque') return 'En empaque';
  if (s === 'en_preparacion' || s === 'en preparacion') return 'En preparación';
  if (s === 'completado') return 'Completado';
  if (s === 'entregado') return 'Entregado';
  if (s === 'cancelado') return 'Cancelado';
  if (s === 'pendiente') return 'Pendiente';
  return s.charAt(0).toUpperCase() + s.slice(1);
};

export function ReporteCajaPrint({
  tipoReporte = 'cierre',
  titulo = 'Reporte de Cierre de Caja',
  periodo = '',
  pedidos = [],
  totales = { subtotalCosto: 0, totalVenta: 0 },
  ticketPedido = null,
  movimientos = [],
  mermas = []
}) {
  // CASO 1: Reimpresión de ticket individual de control interno (igual al PDF de muestra)
  if (ticketPedido) {
    const idStr = String(ticketPedido.id).startsWith('#') ? ticketPedido.id : `#${ticketPedido.id}`;
    const items = ticketPedido.items && ticketPedido.items.length > 0 ? ticketPedido.items : [];
    const fechaTexto = ticketPedido.fecha ? formatearFechaDDMMAAAA(ticketPedido.fecha) : '';
    const fechaHoraStr = `${fechaTexto} ${ticketPedido.hora || ''}`.trim() || '-';

    return (
      <PrintPortal id="print-area">
        <div className="p-8 max-w-sm mx-auto bg-white text-black font-sans leading-normal">
          {/* Encabezado */}
          <div className="text-center mb-4">
            <h1 className="text-2xl font-bold uppercase tracking-wider text-black">
              ANDÉN
            </h1>
            <p className="text-xs font-semibold tracking-wider text-gray-500 uppercase mt-1">
              CONTROL INTERNO
            </p>
            <p className="text-xs text-gray-700 mt-1 font-medium">
              {fechaHoraStr}
            </p>
          </div>

          <div className="border-b-2 border-black mb-4" />

          {/* Datos del pedido */}
          <div className="space-y-1.5 text-xs text-black mb-5">
            <p><span className="font-bold">ID Pedido:</span> {idStr}</p>
            <p><span className="font-bold">Cliente:</span> {ticketPedido.cliente || 'Consumidor Final'}</p>
            <p><span className="font-bold">Tipo:</span> {ticketPedido.tipo_pedido || 'Mostrador'}</p>
            <p><span className="font-bold">Medio de Pago:</span> {ticketPedido.metodo_pago || 'Efectivo'}</p>
            <p><span className="font-bold">Estado:</span> {formatEstadoNombre(ticketPedido.estado)}</p>
          </div>

          {/* Tabla de artículos */}
          <table className="w-full text-left text-xs mb-4">
            <thead>
              <tr className="border-b border-black text-black font-bold">
                <th className="py-2 text-left">Descripción</th>
                <th className="py-2 text-center">Cant</th>
                <th className="py-2 text-right">Costo</th>
                <th className="py-2 text-right">Venta</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, idx) => (
                <tr key={idx} className="border-b border-gray-200">
                  <td className="py-2 font-medium">{it.nombre_producto}</td>
                  <td className="py-2 text-center font-bold">{it.cantidad}</td>
                  <td className="py-2 text-right text-gray-700">{formatearPrecio(it.costo_total)}</td>
                  <td className="py-2 text-right font-bold">{formatearPrecio(it.venta_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="border-b-2 border-black mb-4" />

          {/* Totales del ticket */}
          <div className="space-y-1 text-xs">
            <div className="flex justify-between font-bold text-gray-800">
              <span>TOTAL COSTOS</span>
              <span>{formatearPrecio(ticketPedido.total_costo)}</span>
            </div>
            <div className="flex justify-between font-extrabold text-base text-black pt-1">
              <span>TOTAL VENTA</span>
              <span>{formatearPrecio(ticketPedido.total_venta)}</span>
            </div>
            <div className="flex justify-between text-xs text-gray-600 pt-0.5">
              <span>DIFERENCIA (Ganancia Bruta):</span>
              <span className="font-bold">
                {formatearPrecio((ticketPedido.total_venta || 0) - (ticketPedido.total_costo || 0))}
              </span>
            </div>
          </div>

          {/* Pie de ticket */}
          <div className="mt-6 pt-3 border-t border-dashed border-gray-400 text-center text-[10px] text-gray-500">
            <p>Comprobante no válido como factura.</p>
            <p>Sistema de Gestión Andén Café.</p>
          </div>
        </div>
      </PrintPortal>
    );
  }

  // Cálculos para movimientos de caja en el reporte impreso
  let printTotalIngresos = 0;
  let printTotalRetiros = 0;
  if (Array.isArray(movimientos)) {
    for (const m of movimientos) {
      const monto = Number(m.monto) || 0;
      if (m.tipo === 'INGRESO') printTotalIngresos += monto;
      if (m.tipo === 'RETIRO') printTotalRetiros += monto;
    }
  }
  const printSaldoNeto = printTotalIngresos - printTotalRetiros;
  const printSaldoFinal = (totales.totalVenta || 0) + printSaldoNeto;
  const printDiferenciaVentasCostos = (totales.totalVenta || 0) - (totales.subtotalCosto || 0);

  const esIngresosRetiros = tipoReporte === 'ingresos-retiros';
  const esEliminados = tipoReporte === 'eliminados';

  let printTotalCostoMermas = 0;
  if (Array.isArray(mermas)) {
    for (const m of mermas) {
      const cant = Number(m.cantidad) || 1;
      const pCosto = Number(m.precio_costo) || 0;
      printTotalCostoMermas += Number(m.costo_total) || (cant * pCosto);
    }
  }

  // CASO 2: Reporte General de Caja o Reporte de Ingresos/Retiros
  return (
    <PrintPortal id="print-area">
      <div className="p-8 max-w-4xl mx-auto bg-white text-black font-sans leading-normal">
        {/* Encabezado del Reporte */}
        <div className="flex justify-between items-start border-b-2 border-black pb-4 mb-4">
          <div>
            <h1 className="text-2xl font-black uppercase tracking-wider text-black">
              {titulo}
            </h1>
            <p className="text-xs text-gray-600 mt-1 font-medium">
              {periodo}
            </p>
          </div>
          <div className="text-right text-xs text-gray-500">
            <p className="font-bold text-black uppercase tracking-wider">Andén Café Bar</p>
            <p>Fecha de emisión: {formatearFecha(new Date().toISOString())}</p>
          </div>
        </div>

        {/* SI ES REPORTE DE PRODUCTOS ELIMINADOS (AUDITORÍA) */}
        {esEliminados ? (
          <div>
            <div className="mb-4 p-3 border border-black bg-gray-50 rounded-lg text-xs">
              <span className="font-bold">INFORME DE AUDITORÍA:</span> Registro inmutable de bajas de productos ({periodo}). Modo solo lectura.
            </div>

            <table className="w-full text-left text-xs mb-6 border-collapse">
              <thead>
                <tr className="border-b-2 border-black text-black font-bold uppercase text-[10px] tracking-wider">
                  <th className="py-2 px-2">Fecha y Hora</th>
                  <th className="py-2 px-2">Producto</th>
                  <th className="py-2 px-2 text-center">Cant.</th>
                  <th className="py-2 px-2 text-right">Precio Costo</th>
                  <th className="py-2 px-2 text-right">Costo Total</th>
                  <th className="py-2 px-2 text-center">Motivo</th>
                </tr>
              </thead>
              <tbody>
                {!mermas || mermas.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-gray-500 italic">
                      No se registraron productos eliminados en este período.
                    </td>
                  </tr>
                ) : (
                  mermas.map((m, idx) => {
                    const fechaStr = m.fecha ? formatearFechaDDMMAAAA(m.fecha) : (m.created_at ? formatearFechaDDMMAAAA(m.created_at) : '-');
                    const horaStr = m.created_at ? String(m.created_at).split(' ')[1]?.slice(0, 5) || '' : '';
                    const cant = Number(m.cantidad) || 1;
                    const pCosto = Number(m.precio_costo) || 0;
                    const cTotal = Number(m.costo_total) || (cant * pCosto);

                    return (
                      <tr key={idx} className="border-b border-gray-200">
                        <td className="py-2 px-2 whitespace-nowrap">
                          {fechaStr} {horaStr && `(${horaStr} hs)`}
                        </td>
                        <td className="py-2 px-2 font-medium">
                          {m.nombre_producto}
                          {m.nombre_categoria && (
                            <span className="text-[10px] text-gray-500 block">
                              {m.nombre_categoria}
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-2 text-center font-bold">{cant}</td>
                        <td className="py-2 px-2 text-right">{formatearPrecio(pCosto)}</td>
                        <td className="py-2 px-2 text-right font-bold">{formatearPrecio(cTotal)}</td>
                        <td className="py-2 px-2 text-center">
                          <span className="px-2 py-0.5 border border-black rounded text-[10px] font-bold uppercase">
                            {m.motivo}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              {mermas && mermas.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-black font-bold text-xs">
                    <td colSpan={4} className="py-2.5 px-2 uppercase font-black">
                      TOTAL VALOR DE COSTOS ELIMINADOS
                    </td>
                    <td className="py-2.5 px-2 text-right font-black text-red-700 text-sm">
                      {formatearPrecio(totales.totalCostoMermas || printTotalCostoMermas)}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        ) : esIngresosRetiros ? (
          <div className="mb-6 p-4 border-2 border-black bg-gray-50 rounded-xl break-inside-avoid">
            <h2 className="text-xs font-black uppercase tracking-wider text-black border-b border-gray-300 pb-2 mb-3">
              Transacciones del Mes (Totales Contables)
            </h2>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="border-r border-gray-300 pr-2">
                <span className="text-[11px] uppercase font-bold text-gray-600 block mb-1">
                  SUBTOTAL (Costos)
                </span>
                <span className="text-base font-bold text-red-700">
                  {formatearPrecio(totales.subtotalCosto)}
                </span>
              </div>

              <div className="border-r border-gray-300 pr-2">
                <span className="text-[11px] uppercase font-bold text-gray-600 block mb-1">
                  TOTAL VENTAS
                </span>
                <span className="text-base font-black text-black">
                  {formatearPrecio(totales.totalVenta)}
                </span>
              </div>

              <div>
                <span className="text-[11px] uppercase font-bold text-gray-600 block mb-1">
                  DIFERENCIA (Ventas - Costos)
                </span>
                <span className="text-base font-black text-emerald-700">
                  {formatearPrecio(printDiferenciaVentasCostos)}
                </span>
              </div>
            </div>
          </div>
        ) : (
          /* SI ES CIERRE DIARIO / MENSUAL GENERAL: Tabla de Pedidos y Ventas */
          <table className="w-full text-left text-xs mb-6 border-collapse">
            <thead>
              <tr className="border-b-2 border-black text-black font-bold uppercase text-[10px] tracking-wider">
                <th className="py-2 px-2">Fecha</th>
                <th className="py-2 px-2">Hora</th>
                <th className="py-2 px-2">Nº Pedido</th>
                <th className="py-2 px-2">Producto</th>
                <th className="py-2 px-2 text-center">Cant.</th>
                <th className="py-2 px-2 text-right">Costo U.</th>
                <th className="py-2 px-2 text-right">Venta U.</th>
                <th className="py-2 px-2 text-right">Costo Tot.</th>
                <th className="py-2 px-2 text-right">Venta Tot.</th>
                <th className="py-2 px-2 text-center">Estado</th>
              </tr>
            </thead>

            {pedidos.length === 0 ? (
              <tbody>
                <tr>
                  <td colSpan={10} className="py-8 text-center text-gray-500 italic">
                    No se registraron ventas en este período.
                  </td>
                </tr>
              </tbody>
            ) : (
              pedidos.map((pedido) => {
                const items = pedido.items && pedido.items.length > 0
                  ? pedido.items
                  : [{
                      nombre_producto: 'Venta Consolidada',
                      cantidad: 1,
                      precio_costo: pedido.total_costo,
                      precio_venta: pedido.total_venta,
                      costo_total: pedido.total_costo,
                      venta_total: pedido.total_venta
                    }];

                return (
                  <tbody key={`print-group-${pedido.id}`} className="border-b border-gray-200">
                    {items.map((item, idx) => {
                      const esPrimer = idx === 0;

                      return (
                        <tr key={`print-row-${pedido.id}-${idx}`}>
                          {esPrimer && (
                            <td rowSpan={items.length} className="py-2 px-2 font-medium text-black align-top whitespace-nowrap">
                              {pedido.fecha ? formatearFechaDDMMAAAA(pedido.fecha) : '-'}
                            </td>
                          )}
                          {esPrimer && (
                            <td rowSpan={items.length} className="py-2 px-2 text-gray-700 align-top whitespace-nowrap">
                              {pedido.hora || '-'}
                            </td>
                          )}
                          {esPrimer && (
                            <td rowSpan={items.length} className="py-2 px-2 font-bold text-black align-top">
                              {String(pedido.id).startsWith('#') ? pedido.id : `#${pedido.id}`}
                              <div className="text-[10px] font-normal text-gray-600">
                                {pedido.tipo_pedido} • {pedido.metodo_pago}
                              </div>
                            </td>
                          )}
                          <td className="py-1.5 px-2 text-black">
                            {item.nombre_producto}
                          </td>
                          <td className="py-1.5 px-2 text-center text-black font-semibold">
                            {item.cantidad}
                          </td>
                          <td className="py-1.5 px-2 text-right text-gray-700">
                            {formatearPrecio(item.precio_costo)}
                          </td>
                          <td className="py-1.5 px-2 text-right text-black">
                            {formatearPrecio(item.precio_venta)}
                          </td>
                          <td className="py-1.5 px-2 text-right text-gray-700">
                            {formatearPrecio(item.costo_total)}
                          </td>
                          <td className="py-1.5 px-2 text-right font-semibold text-black">
                            {formatearPrecio(item.venta_total)}
                          </td>
                          {esPrimer && (
                            <td rowSpan={items.length} className="py-2 px-2 text-center capitalize align-top text-gray-700">
                              {pedido.estado || '-'}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                );
              })
            )}
          </table>
        )}

        {/* Tabla de la Sección: Movimientos de Caja Chica (Ingresos y Retiros) */}
        {!esEliminados && (
          <div className="mt-4 border-t-2 border-black pt-4 break-inside-avoid">
            <h3 className="font-bold text-xs uppercase tracking-wider mb-2 text-black">
              Detalle de Ingresos y Retiros de Caja
            </h3>
            <table className="w-full text-left text-xs mb-3 border-collapse">
              <thead>
                <tr className="border-b-2 border-black text-black font-bold uppercase text-[10px]">
                  <th className="py-1 px-1">Fecha</th>
                  <th className="py-1 px-1">Hora</th>
                  <th className="py-1 px-1">Tipo</th>
                  <th className="py-1 px-1">Detalle</th>
                  <th className="py-1 px-1 text-right">Ingreso</th>
                  <th className="py-1 px-1 text-right">Retiro</th>
                </tr>
              </thead>
              <tbody>
                {!movimientos || movimientos.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-4 text-center text-gray-500 italic">
                      No se registraron movimientos en este período.
                    </td>
                  </tr>
                ) : (
                  movimientos.map((m, idx) => (
                    <tr key={idx} className="border-b border-gray-200">
                      <td className="py-1 px-1 text-[11px]">{m.fecha ? formatearFechaDDMMAAAA(m.fecha) : '-'}</td>
                      <td className="py-1 px-1 text-[11px]">{m.hora || '-'}</td>
                      <td className="py-1 px-1 text-[11px] font-semibold">{m.tipo}</td>
                      <td className="py-1 px-1 text-[11px] break-words whitespace-pre-wrap">{m.detalle}</td>
                      <td className="py-1 px-1 text-right text-[11px] font-semibold text-emerald-700">
                        {m.tipo === 'INGRESO' ? `+${formatearPrecio(m.monto)}` : '-'}
                      </td>
                      <td className="py-1 px-1 text-right text-[11px] font-semibold text-red-600">
                        {m.tipo === 'RETIRO' ? `-${formatearPrecio(m.monto)}` : '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {movimientos && movimientos.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-black font-bold text-[11px]">
                    <td colSpan={4} className="py-1.5 px-1 uppercase">
                      TOTALES DE MOVIMIENTOS
                    </td>
                    <td className="py-1.5 px-1 text-right text-emerald-700 font-bold">
                      +{formatearPrecio(printTotalIngresos)}
                    </td>
                    <td className="py-1.5 px-1 text-right text-red-600 font-bold">
                      -{formatearPrecio(printTotalRetiros)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}

        {/* Resumen Final al pie de tabla */}
        {esEliminados ? (
          <div className="flex justify-between items-start border-t-2 border-black pt-4 break-inside-avoid">
            <div className="text-[11px] text-gray-600 space-y-1">
              <p>Auditoría de bajas y cancelaciones (Inmutable).</p>
              <p>Andén Café - Sistema de Gestión NextByte.</p>
            </div>

            <div className="w-80 space-y-1.5 text-xs text-right">
              <div className="flex justify-between font-semibold text-gray-700">
                <span>Total Registros:</span>
                <span>{mermas.length} productos</span>
              </div>
              <div className="flex justify-between font-black text-sm text-black border-t-2 border-black pt-1">
                <span>TOTAL VALOR COSTOS ELIMINADOS:</span>
                <span className="text-red-700">{formatearPrecio(totales.totalCostoMermas || printTotalCostoMermas)}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex justify-between items-start border-t-2 border-black pt-4 break-inside-avoid">
            <div className="text-[11px] text-gray-600 space-y-1">
              <p>Documento de uso interno y control de caja.</p>
              <p>Andén Café - Sistema de Gestión NextByte.</p>
            </div>

            <div className="w-72 space-y-1.5 text-xs text-right">
              <div className="flex justify-between font-semibold text-gray-700">
                <span>Subtotal Costos:</span>
                <span>{formatearPrecio(totales.subtotalCosto)}</span>
              </div>
              <div className="flex justify-between font-bold text-sm text-black border-t border-gray-300 pt-1">
                <span>Total Ventas:</span>
                <span>{formatearPrecio(totales.totalVenta)}</span>
              </div>
              <div className="flex justify-between text-xs text-gray-600">
                <span>Diferencia (Ventas - Costos):</span>
                <span className="font-semibold">{formatearPrecio(printDiferenciaVentasCostos)}</span>
              </div>
              {movimientos && movimientos.length > 0 && (
                <>
                  <div className="flex justify-between text-xs text-emerald-800 font-semibold border-t border-gray-200 pt-1">
                    <span>(+) Total Ingresos:</span>
                    <span>+{formatearPrecio(printTotalIngresos)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-red-800 font-semibold">
                    <span>(-) Total Retiros:</span>
                    <span>-{formatearPrecio(printTotalRetiros)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-700 font-semibold">
                    <span>Saldo Neto Movimientos:</span>
                    <span>{formatearPrecio(printSaldoNeto)}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between font-black text-sm text-black border-t-2 border-black pt-1">
                <span>SALDO FINAL DE CAJA:</span>
                <span>{formatearPrecio(printSaldoFinal)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Línea para firma */}
        <div className="mt-14 pt-4 border-t border-dashed border-gray-400 flex justify-between text-xs text-gray-600 break-inside-avoid">
          <div>
            <p>Firma Responsable de Caja: _________________________</p>
          </div>
          <div>
            <p>Aclaración / Legajo: _________________________</p>
          </div>
        </div>
      </div>
    </PrintPortal>
  );
}

export default ReporteCajaPrint;
