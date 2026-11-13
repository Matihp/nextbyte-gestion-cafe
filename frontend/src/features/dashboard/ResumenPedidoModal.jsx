import React from 'react';
import { X, Printer, XCircle } from 'lucide-react';
import { formatearPrecio, formatearIdPedido } from '@/utils/formatters';

export function ResumenPedidoModal({
  abierto,
  pedido,
  alCerrar,
  alImprimir,
  alCancelar,
  alEliminarItem
}) {
  if (!abierto || !pedido) return null;

  const items = pedido.detalles || pedido.items || [];
  const idStr = formatearIdPedido(pedido);

  const tipoDisplay = () => {
    const t = String(pedido.tipo_pedido || pedido.orderType || '').toLowerCase();
    if (t === 'take_away' || t === 'takeaway' || t === 'take away') return 'Take away';
    if (t === 'delivery') return 'Delivery';
    return 'Mostrador';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm sm:max-w-md overflow-hidden border border-border/20 flex flex-col">
        {/* Cabecera marrón oscuro con título y botón de cierre */}
        <div className="bg-[#4B2B1D] text-white px-6 py-4 flex items-center justify-between">
          <h3 className="font-bold text-lg text-white tracking-tight">
            Resumen del Pedido
          </h3>
          <button
            type="button"
            onClick={alCerrar}
            className="text-white/80 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10 cursor-pointer"
            title="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cuerpo del modal */}
        <div className="p-6 space-y-4">
          {/* Metadatos del pedido */}
          <div className="space-y-1.5 text-sm text-gray-800">
            <p>
              <strong className="font-bold text-gray-900">ID:</strong>{' '}
              <span className="font-medium text-gray-700">{idStr}</span>
            </p>
            <p>
              <strong className="font-bold text-gray-900">Cliente:</strong>{' '}
              <span className="font-medium text-gray-700">
                {pedido.cliente || pedido.customer || 'Consumidor Final'}
              </span>
            </p>
            <p>
              <strong className="font-bold text-gray-900">Tipo:</strong>{' '}
              <span className="font-medium text-gray-700">{tipoDisplay()}</span>
            </p>
            {(pedido.direccion || pedido.address) && (
              <p>
                <strong className="font-bold text-gray-900">Dirección:</strong>{' '}
                <span className="font-medium text-gray-700">
                  {pedido.direccion || pedido.address}
                </span>
              </p>
            )}
            {(pedido.telefono || pedido.phone) && (
              <p>
                <strong className="font-bold text-gray-900">Teléfono:</strong>{' '}
                <span className="font-medium text-gray-700">
                  {pedido.telefono || pedido.phone}
                </span>
              </p>
            )}
          </div>

          <hr className="border-t border-gray-100" />

          {/* Sección de Artículos */}
          <div className="space-y-2.5">
            <h4 className="font-bold text-sm text-gray-900">Artículos:</h4>

            <div className="space-y-2">
              {items.map((item, idx) => {
                const cantidad = Number(item.cantidad ?? item.quantity ?? 1);
                const precioUnit = Number(item.precio_venta ?? item.price ?? 0);
                const totalItem = Number(
                  item.total_venta ?? item.precio_total ?? (precioUnit * cantidad)
                );

                return (
                  <div key={item.id || idx} className="flex items-center justify-between text-sm">
                    <span className="text-gray-800">
                      <strong className="font-bold text-gray-900">{cantidad}x</strong>{' '}
                      {item.nombre_producto || item.name || 'Producto'}
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-gray-800">
                        {formatearPrecio(totalItem)}
                      </span>
                      <button
                        type="button"
                        onClick={() => alEliminarItem && alEliminarItem(pedido, item)}
                        className="text-red-500 hover:text-red-700 transition-colors p-0.5 cursor-pointer"
                        title="Eliminar este ítem"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <hr className="border-t border-gray-100" />

          {/* Total pagado */}
          <div className="flex items-center justify-between pt-1">
            <span className="text-base sm:text-lg font-bold text-gray-900">
              Total Págado
            </span>
            <span className="text-2xl font-bold text-[#A67C52]">
              {formatearPrecio(pedido.total)}
            </span>
          </div>

          {/* Botones de acción */}
          <div className="space-y-2.5 pt-3">
            <button
              type="button"
              onClick={alImprimir}
              className="w-full py-3 px-4 bg-[#4B2B1D] hover:bg-[#3D2314] text-white font-bold rounded-xl text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir Orden de Pedido</span>
            </button>

            <button
              type="button"
              onClick={() => alCancelar && alCancelar(pedido)}
              className="w-full py-3 px-4 bg-[#FFF5F5] hover:bg-red-50 text-red-600 font-bold border border-red-200 rounded-xl text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <XCircle className="w-4 h-4 text-red-600" />
              <span>Cancelar Pedido</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ResumenPedidoModal;
