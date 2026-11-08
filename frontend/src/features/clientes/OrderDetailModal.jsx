import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { getStatusColor, normalizeOrderTypeDisplay } from '@/features/comandas/OrdersPage';
import { formatearPrecio, formatearIdPedido, formatearSoloFecha } from '@/utils/formatters';

export function OrderDetailModal({ order, open, onClose }) {
  if (!order) return null;

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose && onClose()}>
      <DialogContent className="sm:max-w-lg bg-white rounded-xl shadow-2xl p-6">
        <DialogHeader>
          <div className="flex items-center justify-between gap-4 mb-1">
            <DialogTitle className="text-xl font-bold text-[#4B2B1D]">
              Pedido {formatearIdPedido(order)}
            </DialogTitle>
            <span
              className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(
                order.status
              )}`}
            >
              {order.status}
            </span>
          </div>
          <DialogDescription className="text-sm text-gray-500">
            Detalle del pedido para atención en salón.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 my-2 text-sm text-gray-700">
          <div className="grid grid-cols-2 gap-3 p-3 bg-gray-50 rounded-lg">
            <div>
              <p className="text-xs text-gray-400 font-medium">Cliente</p>
              <p className="font-semibold text-gray-900">{order.customer || 'Consumidor Final'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 font-medium">Tipo de Pedido</p>
              <p className="font-bold text-[#8B0000] tracking-wider text-xs">
                {normalizeOrderTypeDisplay(order.orderType)}
              </p>
            </div>
            {order.time && (
              <div>
                <p className="text-xs text-gray-400 font-medium">Hora de Ingreso</p>
                <p className="font-medium text-gray-700">{order.time}</p>
              </div>
            )}
            {order.date && (
              <div>
                <p className="text-xs text-gray-400 font-medium">Fecha</p>
                <p className="font-medium text-gray-700">{formatearSoloFecha(order.date)}</p>
              </div>
            )}
          </div>

          <div>
            <h4 className="font-bold text-xs uppercase tracking-wider text-[#4B2B1D] mb-2">
              Artículos del Pedido
            </h4>
            <div className="border border-gray-100 rounded-lg divide-y divide-gray-100 max-h-48 overflow-y-auto">
              {order.items && order.items.length > 0 ? (
                order.items.map((item, idx) => (
                  <div key={item.id || idx} className="flex justify-between items-center p-2.5 text-xs">
                    <span className="font-medium text-gray-800">
                      <strong className="text-[#9F4F2F] mr-1.5">{item.quantity}x</strong>
                      {item.name}
                    </span>
                    {item.price > 0 && (
                      <span className="text-gray-500 font-mono">
                        {formatearPrecio(item.price * item.quantity)}
                      </span>
                    )}
                  </div>
                ))
              ) : (
                <p className="p-3 text-center text-xs text-gray-400">Sin artículos detallados</p>
              )}
            </div>
          </div>

          {order.total > 0 && (
            <div className="flex justify-between items-center pt-2">
              <span className="font-semibold text-gray-700">Total:</span>
              <span className="text-base font-bold text-[#4B2B1D]">
                {formatearPrecio(order.total)}
              </span>
            </div>
          )}
        </div>

        <DialogFooter className="mt-4">
          <Button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto bg-[#4B2B1D] text-white hover:bg-[#3a2216] cursor-pointer font-semibold"
          >
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default OrderDetailModal;

