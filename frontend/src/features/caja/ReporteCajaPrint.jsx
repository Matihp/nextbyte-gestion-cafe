import React from 'react';
import { PrintPortal } from '@/components/PrintPortal';
import { formatearPrecio, formatearFecha } from '@/utils/formatters';

export function ReporteCajaPrint({
  titulo = 'Reporte de Cierre de Caja',
  periodo = '',
  pedidos = [],
  totales = { subtotalCosto: 0, totalVenta: 0 }
}) {
  const gananciaBruta = (totales.totalVenta || 0) - (totales.subtotalCosto || 0);
  const ticketPromedio = pedidos.length > 0 ? (totales.totalVenta || 0) / pedidos.length : 0;
  const fechaEmision = formatearFecha(new Date());

  return (
    <PrintPortal id="print-area">
      <div className="p-8 max-w-4xl mx-auto bg-white text-black font-sans leading-normal">
        {/* Encabezado del Comercio */}
        <div className="flex justify-between items-start border-b-2 border-black pb-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold uppercase tracking-wider text-black">
              ANDÉN
            </h1>
            <p className="text-xs font-semibold tracking-wide text-gray-700 uppercase">
              Café de Especialidad al Paso
            </p>
            <p className="text-sm font-bold mt-2 text-black">
              {titulo}
            </p>
          </div>

          <div className="text-right text-xs text-gray-600 space-y-1">
            <p><span className="font-semibold text-black">Período:</span> {periodo || 'Al día'}</p>
            <p><span className="font-semibold text-black">Fecha emisión:</span> {fechaEmision}</p>
            <p><span className="font-semibold text-black">Cant. Pedidos:</span> {pedidos.length}</p>
          </div>
        </div>

        {/* Resumen Financiero Compacto */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          <div className="border border-gray-300 p-2.5 rounded text-left">
            <span className="text-[10px] uppercase font-bold text-gray-500 block">Subtotal Costos</span>
            <span className="text-sm font-bold text-gray-800">{formatearPrecio(totales.subtotalCosto)}</span>
          </div>
          <div className="border border-gray-300 p-2.5 rounded text-left">
            <span className="text-[10px] uppercase font-bold text-gray-500 block">Total Ventas</span>
            <span className="text-sm font-bold text-black">{formatearPrecio(totales.totalVenta)}</span>
          </div>
          <div className="border border-gray-300 p-2.5 rounded text-left">
            <span className="text-[10px] uppercase font-bold text-gray-500 block">Ganancia Bruta</span>
            <span className="text-sm font-bold text-emerald-800">{formatearPrecio(gananciaBruta)}</span>
          </div>
          <div className="border border-gray-300 p-2.5 rounded text-left">
            <span className="text-[10px] uppercase font-bold text-gray-500 block">Ticket Promedio</span>
            <span className="text-sm font-bold text-gray-800">{formatearPrecio(ticketPromedio)}</span>
          </div>
        </div>

        {/* Tabla de Detalle de Transacciones */}
        <table className="w-full text-left text-xs border-collapse mb-6">
          <thead>
            <tr className="border-b-2 border-black text-[11px] font-bold text-black uppercase bg-gray-100">
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
                <td colSpan={9} className="py-8 text-center text-gray-500 italic">
                  No se registraron transacciones para este período.
                </td>
              </tr>
            </tbody>
          ) : (
            pedidos.map((pedido) => {
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
                <tbody key={`print-${pedido.id}`} className="border-b border-gray-300">
                  {items.map((item, idx) => {
                    const esPrimer = idx === 0;
                    return (
                      <tr key={`print-row-${pedido.id}-${idx}`}>
                        {esPrimer && (
                          <td rowSpan={items.length} className="py-2 px-2 font-medium text-gray-700 align-top">
                            {pedido.hora || '-'}
                          </td>
                        )}
                        {esPrimer && (
                          <td rowSpan={items.length} className="py-2 px-2 font-bold text-black align-top">
                            #{pedido.id}
                            <div className="text-[10px] font-normal text-gray-600">
                              {pedido.tipo_pedido} • {pedido.metodo_pago}
                            </div>
                          </td>
                        )}
                        <td className="py-1.5 px-2 font-medium text-black">
                          {item.nombre_producto}
                        </td>
                        <td className="py-1.5 px-2 text-center font-semibold text-black">
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

        {/* Resumen Final al pie de tabla */}
        <div className="flex justify-between items-start border-t-2 border-black pt-4">
          <div className="text-[11px] text-gray-600 space-y-1">
            <p>Documento de uso interno y control de caja.</p>
            <p>Andén Café - Sistema de Gestión NextByte.</p>
          </div>

          <div className="w-64 space-y-1.5 text-xs text-right">
            <div className="flex justify-between font-semibold text-gray-700">
              <span>Subtotal Costos:</span>
              <span>{formatearPrecio(totales.subtotalCosto)}</span>
            </div>
            <div className="flex justify-between font-bold text-sm text-black border-t border-gray-300 pt-1">
              <span>Total Ventas:</span>
              <span>{formatearPrecio(totales.totalVenta)}</span>
            </div>
          </div>
        </div>

        {/* Línea para firma */}
        <div className="mt-14 pt-4 border-t border-dashed border-gray-400 flex justify-between text-xs text-gray-600">
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

