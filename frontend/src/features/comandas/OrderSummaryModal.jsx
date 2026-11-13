import React, { useState } from 'react';
import { X, ScrollText, Printer, XCircle, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { formatearPrecio, formatearIdPedido, formatearMetodoPago } from '@/utils/formatters';
import { normalizeOrderTypeDisplay } from './OrdersPage';
import { formatDateDDMMAAAA } from './orderSequence';

export function OrderSummaryModal({
  open,
  onOpenChange,
  order,
  onClose,
  onViewRecipe,
  onPrint,
  onCancelOrder,
  onCancelItem
}) {
  const [cancellingItemId, setCancellingItemId] = useState(null);

  if (!order) return null;

  const handleClose = () => {
    if (onOpenChange) onOpenChange(false);
    if (onClose) onClose();
  };

  const items = order.items || [];
  const isCanceled = order.status === 'cancelado' || order.status === 'Cancelado';
  const isCompleted = order.status === 'completado' || order.status === 'Completado';
  const canModify = !isCanceled && !isCompleted;

  const handleItemCancelClick = async (itemId, itemName) => {
    if (!canModify || !onCancelItem) return;
    setCancellingItemId(itemId);
    try {
      await onCancelItem(order.id, itemId, itemName);
    } finally {
      setCancellingItemId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden p-0 gap-0 border-0 print:hidden">
        <DialogHeader className="px-6 py-5 border-b border-gray-100 flex flex-row justify-between items-center bg-gray-50 space-y-0">
          <DialogTitle className="text-2xl font-bold text-[#4B2B1D]">
            Resumen del Pedido {formatearIdPedido(order)}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 max-h-[65vh]">
          {/* Tarjeta de información del cliente */}
          <div className="bg-[#F3E5DC]/50 rounded-xl p-4 border border-[#EAD5C8]">
            <p className="text-sm text-gray-700">
              Cliente: <span className="font-bold text-gray-900">{order.customer || 'Consumidor Final'}</span>
            </p>
            <p className="text-sm text-gray-700 mt-1">
              Fecha y Hora:{' '}
              <span className="font-semibold text-gray-900">
                {formatDateDDMMAAAA(order.date)} {order.time}
              </span>
            </p>
            <p className="text-sm text-gray-700 mt-1">
              Estado actual:{' '}
              <span className="font-semibold text-[#4B2B1D] uppercase text-xs px-2 py-0.5 bg-[#EAD5C8] rounded-md">
                {order.status}
              </span>
            </p>
            {order.orderType && (
              <p className="text-sm text-gray-700 mt-1">
                Tipo: <span className="font-semibold text-gray-900">{normalizeOrderTypeDisplay(order.orderType)}</span>
              </p>
            )}
            {(order.paymentMethod || order.metodo_pago) && (
              <p className="text-sm text-gray-700 mt-1">
                Medio de pago: <span className="font-semibold text-gray-900">{formatearMetodoPago(order.paymentMethod || order.metodo_pago)}</span>
              </p>
            )}
            {(order.address || order.direccion) && (
              <p className="text-sm text-gray-700 mt-1">
                Dirección: <span className="font-semibold text-gray-900">{order.address || order.direccion}</span>
              </p>
            )}
            {(order.phone || order.telefono) && (
              <p className="text-sm text-gray-700 mt-1">
                Teléfono: <span className="font-semibold text-gray-900">{order.phone || order.telefono}</span>
              </p>
            )}
          </div>

          {/* Lista de Artículos */}
          <div className="space-y-4">
            <div className="flex justify-between text-sm font-semibold text-gray-500 border-b pb-2">
              <span>Cant x Producto</span>
              <span className="print:hidden">Receta / Acciones</span>
            </div>

            {items.length === 0 ? (
              <p className="text-center py-4 text-gray-500 text-sm">
                No hay ítems en este pedido.
              </p>
            ) : (
              items.map((item, idx) => (
                <div
                  key={item.id || idx}
                  className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0 group"
                >
                  <div className="flex flex-col">
                    <div className="text-sm">
                      <span className="font-bold text-gray-900">{item.quantity}x</span>{' '}
                      <span className="text-gray-700 font-medium">{item.name}</span>
                    </div>
                    {item.price > 0 && (
                      <span className="text-xs text-gray-500">
                        {formatearPrecio(item.price * item.quantity)}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 print:hidden">
                    {/* Botón Ver Receta */}
                    <button
                      type="button"
                      onClick={() => onViewRecipe && onViewRecipe(item)}
                      className="flex items-center gap-1.5 px-3 py-1 bg-[#A67C52]/10 text-[#A67C52] rounded-full hover:bg-[#A67C52]/20 font-medium transition-colors text-xs cursor-pointer"
                      title="Ver receta del producto"
                    >
                      <ScrollText className="w-3.5 h-3.5" />
                      <span>Ver receta</span>
                    </button>

                    {/* Botón Cancelar ítem específico (requiere permiso de cancelación) */}
                    {canModify && Boolean(onCancelItem) && items.length > 1 && (
                      <button
                        type="button"
                        disabled={cancellingItemId === item.id}
                        onClick={() => handleItemCancelClick(item.id, item.name)}
                        className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                        title="Cancelar este ítem del pedido"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Total del pedido */}
          <div className="flex justify-between items-center pt-2 border-t border-gray-200">
            <span className="font-bold text-gray-700 text-base">Total</span>
            <span className="font-bold text-xl text-[#4B2B1D]">
              {formatearPrecio(order.total)}
            </span>
          </div>
        </div>

        {/* Botones de acción en el Footer (ocultos al imprimir la comanda) */}
        <div className="p-6 bg-gray-50 border-t border-gray-100 flex flex-col gap-2.5 print:hidden">
          <Button
            type="button"
            onClick={onPrint}
            className="w-full py-3 bg-[#4B2B1D] text-white rounded-xl font-bold hover:bg-[#3a2216] transition-colors flex items-center justify-center gap-2 cursor-pointer h-12 text-base shadow-sm print:hidden"
          >
            <Printer className="w-5 h-5" /> Imprimir Comanda
          </Button>

          {canModify && Boolean(onCancelOrder) && (
            <Button
              type="button"
              variant="outline"
              onClick={() => onCancelOrder(order.id)}
              className="w-full py-3 bg-red-50 text-red-600 border border-red-200 rounded-xl font-bold hover:bg-red-100 transition-colors flex items-center justify-center gap-2 cursor-pointer h-12 text-base print:hidden"
            >
              <XCircle className="w-5 h-5" /> Cancelar Pedido
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default OrderSummaryModal;
