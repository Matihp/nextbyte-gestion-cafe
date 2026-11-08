import { formatDate } from '../utils/categoryDetails';
import { formatearPrecio, formatearIdPedido } from '@/utils/formatters';

export function TicketPrintArea({ order }) {
  if (!order) return null;

  return (
    <div className="ticket-termico text-black bg-white w-[76mm] max-w-[76mm] mx-auto font-sans text-xs sm:text-sm p-2">
      <div className="text-center mb-4 border-b-2 border-black pb-3">
        <h1 className="text-2xl font-black uppercase tracking-widest mb-0.5">Andén</h1>
        <p className="text-xs font-bold uppercase tracking-wider">Orden de Pedido</p>
        <p className="text-[11px] text-gray-700 mt-1">
          {formatDate(order.date)} {order.time}
        </p>
      </div>

      <div className="mb-4 space-y-1 text-xs">
        <div className="flex justify-between items-center text-sm font-black border-b border-dashed border-gray-400 pb-1 mb-1">
          <span>ID:</span>
          <span className="font-mono text-base">{formatearIdPedido(order)}</span>
        </div>
        <p><span className="font-bold">Cliente:</span> {order.customer || order.cliente || 'Consumidor Final'}</p>
        <p><span className="font-bold">Tipo:</span> {order.orderType || order.tipo_pedido || 'Mostrador'}</p>
        <p><span className="font-bold">Medio de Pago:</span> {order.paymentMethod || order.metodo_pago || 'Efectivo'}</p>
        {order.address && <p><span className="font-bold">Dirección:</span> {order.address}</p>}
        {order.phone && <p><span className="font-bold">Teléfono:</span> {order.phone}</p>}
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
          {(order.items || []).map((item, idx) => (
            <tr key={item.id || idx} className="border-b border-gray-200">
              <td className="py-1 font-bold">{item.quantity || item.cantidad}</td>
              <td className="py-1">{item.name || item.nombre_producto}</td>
              <td className="py-1 text-right font-medium">
                {formatearPrecio((item.price || item.precio_venta || 0) * (item.quantity || item.cantidad || 1))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex justify-between items-center font-black text-lg mb-4 border-t-2 border-black pt-2">
        <span>TOTAL</span>
        <span>{formatearPrecio(order.total)}</span>
      </div>

      <div className="text-center text-[11px] border-t border-dashed border-gray-400 pt-3">
        <p className="font-medium">¡Gracias por hacernos parte de tu viaje!</p>
      </div>
    </div>
  );
}

export default TicketPrintArea;

