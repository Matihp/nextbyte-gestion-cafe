import React from 'react';
import { PrintPortal } from '@/components/PrintPortal';
import { formatearPrecio, formatearFecha } from '@/utils/formatters';
import { normalizeOrderTypeDisplay } from './OrdersPage';
import { formatDateDDMMAAAA } from './orderSequence';

export function OrderPrintTicket({ order }) {
  if (!order) return null;

  const items = order.items || [];
  const fechaStr = order.date
    ? `${formatDateDDMMAAAA(order.date)} ${order.time || ''}`.trim()
    : formatearFecha(order.created_at || new Date());

  return (
    <PrintPortal id="print-area">
      <div className="p-4 max-w-sm text-left font-sans bg-white text-black">
        <div className="text-center mb-6 border-b-2 border-black pb-4">
          <h1 className="text-3xl font-bold uppercase tracking-widest mb-1 text-black">
            Andén
          </h1>
          <p className="text-sm font-semibold">Ticket de Pedido</p>
          <p className="text-xs text-gray-700 mt-1">{fechaStr}</p>
        </div>

        <div className="mb-6 space-y-1 text-sm">
          <p>
            <span className="font-bold">ID Pedido:</span> {order.displayId || `#${order.id}`}
          </p>
          <p>
            <span className="font-bold">Cliente:</span> {order.customer || 'Consumidor Final'}
          </p>
          <p>
            <span className="font-bold">Tipo:</span> {normalizeOrderTypeDisplay(order.orderType)}
          </p>
          <p>
            <span className="font-bold">Medio de Pago:</span> {order.paymentMethod || 'Efectivo'}
          </p>
          {order.address && (
            <p>
              <span className="font-bold">Dirección:</span> {order.address}
            </p>
          )}
          {order.phone && (
            <p>
              <span className="font-bold">Teléfono:</span> {order.phone}
            </p>
          )}
        </div>

        <table className="w-full text-left mb-6 text-sm">
          <thead>
            <tr className="border-b-2 border-black">
              <th className="py-2 w-12">Cant</th>
              <th className="py-2">Descripción</th>
              <th className="py-2 text-right">Monto</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => {
              const precioTotal = (Number(item.price) || 0) * (Number(item.quantity) || 1);
              return (
                <tr key={item.id || idx} className="border-b border-gray-300">
                  <td className="py-2 font-bold">{item.quantity}</td>
                  <td className="py-2">{item.name}</td>
                  <td className="py-2 text-right font-medium">{formatearPrecio(precioTotal)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="border-t-2 border-black pt-4 mb-6">
          <div className="flex justify-between items-center font-bold text-xl">
            <span>TOTAL</span>
            <span>{formatearPrecio(order.total)}</span>
          </div>
        </div>

        <div className="text-center pt-4 border-t border-dashed border-gray-400 text-xs text-gray-700">
          <p className="font-medium">¡Gracias por hacernos parte de tu viaje!</p>
        </div>
      </div>
    </PrintPortal>
  );
}

export default OrderPrintTicket;
