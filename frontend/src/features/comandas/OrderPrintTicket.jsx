import React from 'react';
import { PrintPortal } from '@/components/PrintPortal';
import { formatearPrecio, formatearFecha, formatearIdPedido } from '@/utils/formatters';
import { normalizeOrderTypeDisplay } from './OrdersPage';
import { formatDateDDMMAAAA } from './orderSequence';

export function OrderPrintTicket({ order }) {
  if (!order) return null;

  const items = order.items || order.detalles || [];
  const fechaStr = (order.date || order.fecha)
    ? `${formatDateDDMMAAAA(order.date || order.fecha)} ${order.time || order.hora || ''}`.trim()
    : formatearFecha(order.created_at || new Date());

  const cliente = order.customer || order.cliente || 'Consumidor Final';
  const tipoPedido = normalizeOrderTypeDisplay(order.orderType || order.tipo_pedido);
  const medioPago = order.paymentMethod || order.metodo_pago || 'Efectivo';
  const direccion = order.address || order.direccion || '';
  const telefono = order.phone || order.telefono || '';

  return (
    <PrintPortal id="print-area" pageType="ticket" className="ticket-termico">
      <div className="ticket-termico p-2 w-[76mm] max-w-[76mm] mx-auto text-left font-sans bg-white text-black text-xs sm:text-sm">
        <div className="text-center mb-4 border-b-2 border-black pb-3">
          <h1 className="text-2xl font-black uppercase tracking-widest mb-0.5 text-black">
            Andén
          </h1>
          <p className="text-xs font-bold uppercase tracking-wider">Orden de Pedido</p>
          <p className="text-[11px] text-gray-700 mt-1">{fechaStr}</p>
        </div>

        <div className="mb-4 space-y-1 text-xs">
          <div className="flex justify-between items-center text-sm font-black border-b border-dashed border-gray-400 pb-1 mb-1">
            <span>ID:</span>
            <span className="font-mono text-base">{formatearIdPedido(order)}</span>
          </div>
          <p>
            <span className="font-bold">Cliente:</span> {cliente}
          </p>
          <p>
            <span className="font-bold">Tipo:</span> {tipoPedido}
          </p>
          <p>
            <span className="font-bold">Medio de Pago:</span> {medioPago}
          </p>
          {direccion && (
            <p>
              <span className="font-bold">Dirección:</span> {direccion}
            </p>
          )}
          {telefono && (
            <p>
              <span className="font-bold">Teléfono:</span> {telefono}
            </p>
          )}
        </div>

        <table className="w-full text-left mb-4 text-xs">
          <thead>
            <tr className="border-b-2 border-black">
              <th className="py-1 w-8">Cant</th>
              <th className="py-1">Descripción</th>
              <th className="py-1 text-right">Monto</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => {
              const cantidad = Number(item.quantity ?? item.cantidad ?? 1);
              const nombre = item.name || item.nombre_producto || 'Producto';
              const precioUnit = Number(item.price ?? item.precio_venta ?? 0);
              const precioTotal = Number(item.total_venta ?? item.precio_total ?? (precioUnit * cantidad));

              return (
                <tr key={item.id || idx} className="border-b border-gray-200">
                  <td className="py-1 font-bold">{cantidad}</td>
                  <td className="py-1">{nombre}</td>
                  <td className="py-1 text-right font-medium">{formatearPrecio(precioTotal)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="border-t-2 border-black pt-2 mb-4">
          <div className="flex justify-between items-center font-black text-lg">
            <span>TOTAL</span>
            <span>{formatearPrecio(order.total)}</span>
          </div>
        </div>

        <div className="text-center pt-3 border-t border-dashed border-gray-400 text-[11px] text-gray-700">
          <p className="font-medium">¡Gracias por hacernos parte de tu viaje!</p>
        </div>
      </div>
    </PrintPortal>
  );
}

export default OrderPrintTicket;
