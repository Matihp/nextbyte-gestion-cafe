import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, UtensilsCrossed } from 'lucide-react';
import { getStatusColor } from '@/features/comandas/OrdersPage';

export function CompletedOrders({ orders = [], onSelectOrder }) {
  const filteredOrders = orders.filter(
    (order) => order.status === 'Completado' || order.status === 'Listo para Retirar'
  );

  return (
    <Card className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4 border-b border-gray-100 pb-3">
        <h2 className="text-xl font-bold text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          <span>Pedidos Listos</span>
        </h2>
        <Badge
          variant="outline"
          className="text-xs font-semibold text-emerald-800 bg-emerald-50 border-emerald-200"
        >
          {filteredOrders.length} listos para retirar
        </Badge>
      </div>

      <div className="space-y-4 overflow-y-auto max-h-[62vh] pr-1">
        {filteredOrders.length === 0 ? (
          <div className="text-center py-12 flex flex-col items-center justify-center gap-2">
            <UtensilsCrossed className="w-10 h-10 text-gray-300 stroke-[1.5]" />
            <p className="text-gray-500 font-medium">No hay pedidos listos.</p>
          </div>
        ) : (
          filteredOrders.map((order) => {
            const itemsDesc =
              order.items && order.items.length > 0
                ? order.items.map((i) => `${i.quantity}x ${i.name}`).join(', ')
                : 'Sin artículos';

            return (
              <div
                key={order.id}
                onClick={() => onSelectOrder && onSelectOrder(order)}
                className="flex items-center justify-between p-4 bg-emerald-50/50 rounded-lg border border-emerald-100 hover:bg-emerald-100/70 transition-all cursor-pointer"
              >
                <div className="flex-1 min-w-0 pr-4">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-bold text-gray-900 text-base">#{order.id}</span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${getStatusColor(
                        order.status
                      )}`}
                    >
                      {order.status}
                    </span>
                    {order.orderType && (
                      <span className="font-black text-xs tracking-wider text-[#8B0000] ml-2 uppercase">
                        {order.orderType}
                      </span>
                    )}
                  </div>
                  <p className="mb-1 font-semibold text-gray-800 truncate text-base">
                    {order.customer}
                  </p>
                  <p className="text-sm text-gray-600 truncate max-w-[280px] lg:max-w-[340px]" title={itemsDesc}>
                    {itemsDesc}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
}

export default CompletedOrders;

