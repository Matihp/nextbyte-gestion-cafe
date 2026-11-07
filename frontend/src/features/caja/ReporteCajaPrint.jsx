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
  titulo = 'Reporte de Cierre de Caja',
  periodo = '',
  pedidos = [],
  totales = { subtotalCosto: 0, totalVenta: 0 },
  ticketPedido = null,
  movimientos = []
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

  // CASO 2: Reporte General de Caja (Cierre Diario o Cierre Mensual)
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

        {/* Tabla General de Pedidos y Ventas */}
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

        {/* Recuadro de Movimientos de Caja Chica (Ingresos y Retiros) */}
        {movimientos && movimientos.length > 0 && (
          <div className="mt-6 border-t-2 border-black pt-4 break-inside-avoid">
            <h3 className="font-bold text-xs uppercase tracking-wider mb-2 text-black">
              Movimientos de Caja Chica (Ingresos y Retiros)
            </h3>
            <table className="w-full text-left text-xs mb-3 border-collapse">
              <thead>
                <tr className="border-b border-black text-black font-bold">
                  <th className="py-1 px-1">Fecha</th>
                  <th className="py-1 px-1">Hora</th>
                  <th className="py-1 px-1">Tipo</th>
                  <th className="py-1 px-1">Detalle</th>
                  <th className="py-1 px-1 text-right">Ingreso</th>
                  <th className="py-1 px-1 text-right">Retiro</th>
                </tr>
              </thead>
              <tbody>
                {movimientos.map((m, idx) => (
                  <tr key={idx} className="border-b border-gray-200">
                    <td className="py-1 px-1 text-[11px]">{m.fecha ? formatearFechaDDMMAAAA(m.fecha) : '-'}</td>
                    <td className="py-1 px-1 text-[11px]">{m.hora || '-'}</td>
                    <td className="py-1 px-1 text-[11px] font-semibold">{m.tipo}</td>
                    <td className="py-1 px-1 text-[11px]">{m.detalle}</td>
                    <td className="py-1 px-1 text-right text-[11px] font-semibold text-emerald-700">
                      {m.tipo === 'INGRESO' ? `+${formatearPrecio(m.monto)}` : '-'}
                    </td>
                    <td className="py-1 px-1 text-right text-[11px] font-semibold text-red-600">
                      {m.tipo === 'RETIRO' ? `-${formatearPrecio(m.monto)}` : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Resumen Final al pie de tabla */}
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
            {movimientos && movimientos.length > 0 && (
              <>
                <div className="flex justify-between text-xs text-emerald-800 font-semibold">
                  <span>(+) Total Ingresos:</span>
                  <span>+{formatearPrecio(printTotalIngresos)}</span>
                </div>
                <div className="flex justify-between text-xs text-red-800 font-semibold">
                  <span>(-) Total Retiros:</span>
                  <span>-{formatearPrecio(printTotalRetiros)}</span>
                </div>
                <div className="flex justify-between font-black text-sm text-black border-t-2 border-black pt-1">
                  <span>SALDO FINAL DE CAJA:</span>
                  <span>{formatearPrecio(printSaldoFinal)}</span>
                </div>
              </>
            )}
          </div>
        </div>

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
