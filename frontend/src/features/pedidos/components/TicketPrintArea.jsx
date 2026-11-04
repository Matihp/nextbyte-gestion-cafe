import { formatDate } from '../utils/categoryDetails';
import { formatearPrecio } from '@/utils/formatters';

export function TicketPrintArea({ order }) {
  if (!order) return null;

  return (
    <div className="text-black bg-white w-full max-w-sm mx-auto font-sans text-sm">
      <div className="text-center mb-6 border-b-2 border-black pb-4">
        <h1 className="text-3xl font-bold uppercase tracking-widest mb-1">Andén</h1>
        <p className="text-sm">Ticket de Pedido</p>
        <p className="text-sm mt-1">
          {formatDate(order.date)} {order.time}
        </p>
      </div>

      <div className="mb-6 space-y-1">
        <p><span className="font-bold">ID Pedido:</span> {order.id}</p>
        <p><span className="font-bold">Cliente:</span> {order.customer || order.cliente}</p>
        <p><span className="font-bold">Tipo:</span> {order.orderType || order.tipo_pedido}</p>
        <p><span className="font-bold">Medio de Pago:</span> {order.paymentMethod || order.metodo_pago}</p>
        {order.address && <p><span className="font-bold">Dirección:</span> {order.address}</p>}
        {order.phone && <p><span className="font-bold">Teléfono:</span> {order.phone}</p>}
      </div>

      <table className="w-full text-left mb-6">
        <thead>
          <tr className="border-b border-black">
            <th className="py-2">Cant</th>
            <th className="py-2">Descripción</th>
            <th className="py-2 text-right">Monto</th>
          </tr>
        </thead>
        <tbody>
          {(order.items || []).map((item, idx) => (
            <tr key={item.id || idx} className="border-b border-gray-200">
              <td className="py-2">{item.quantity || item.cantidad}</td>
              <td className="py-2">{item.name || item.nombre_producto}</td>
              <td className="py-2 text-right">
                {formatearPrecio((item.price || item.precio_venta || 0) * (item.quantity || item.cantidad || 1))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex justify-between items-center font-bold text-xl mb-8 border-t-2 border-black pt-4">
        <span>TOTAL</span>
        <span>{formatearPrecio(order.total)}</span>
      </div>

      <div className="text-center text-sm border-t border-dashed border-gray-400 pt-4">
        <p>¡Gracias por hacernos parte de tu viaje!</p>
      </div>
    </div>
  );
}

export default TicketPrintArea;

