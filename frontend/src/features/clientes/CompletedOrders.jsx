import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, UtensilsCrossed } from 'lucide-react';
import { getStatusColor, normalizeOrderTypeDisplay } from '@/features/comandas/OrdersPage';
import { formatCustomerName, getOrderTypeColor } from './CustomerViewerPage';

export function CompletedOrders({ orders = [] }) {
  const filteredOrders = orders.filter(
    (order) => order.status === 'Completado' || order.status === 'Listo para Retirar'
  );

  const isMultiColumn = filteredOrders.length > 10;
  const col1Orders = filteredOrders.slice(0, 10);
  const col2Orders = isMultiColumn ? filteredOrders.slice(10) : [];

  const renderOrderItem = (order) => (
    <div
      key={order.id}
      className={`flex items-center justify-between gap-2.5 bg-emerald-50/50 rounded-xl border border-emerald-100 transition-all ${
        isMultiColumn
          ? 'px-3 py-1.5'
          : 'px-3.5 py-1.5 md:px-4 md:py-2'
      }`}
    >
      {/* 1. Nombre y primera inicial del apellido */}
      <span
        className={`font-black text-emerald-950 truncate flex-1 min-w-0 tracking-wide flex items-center gap-1.5 ${
          isMultiColumn
            ? 'text-sm md:text-base'
            : 'text-lg md:text-xl lg:text-2xl'
        }`}
      >
        {order.displayId && (
          <span className="text-xs md:text-sm font-bold opacity-75 font-mono text-emerald-800">
            {order.displayId}
          </span>
        )}
        <span>{formatCustomerName(order.customer)}</span>
      </span>

      {/* 2. Estado + 3. Tipo de pedido */}
      <div className="flex items-center gap-2 shrink-0">
        <span
          className={`rounded-full font-bold whitespace-nowrap shadow-2xs ${getStatusColor(
            order.status
          )} ${
            isMultiColumn
              ? 'text-[11px] md:text-xs px-2 py-0.5'
              : 'text-xs md:text-sm px-3 py-0.5 md:py-1'
          }`}
        >
          {order.status === 'Completado' ? 'Listo' : order.status}
        </span>
        <span
          className={`font-black tracking-wider rounded-lg border whitespace-nowrap shadow-2xs ${getOrderTypeColor(
            order.orderType
          )} ${
            isMultiColumn
              ? 'text-[11px] md:text-xs px-2 py-0.5'
              : 'text-xs md:text-sm px-3 py-0.5 md:py-1'
          }`}
        >
          {normalizeOrderTypeDisplay(order.orderType)}
        </span>
      </div>
    </div>
  );

  return (
    <Card className="bg-white rounded-2xl shadow-sm p-3.5 md:p-4 lg:p-5 border border-emerald-100 h-full flex flex-col min-h-0 overflow-hidden">
      {/* Cabecera de la card con menor separación hacia la lista */}
      <div className="flex items-center justify-between mb-2 md:mb-2.5 border-b border-gray-100 pb-2 shrink-0">
        <h2 className="text-xl md:text-2xl lg:text-3xl font-extrabold text-emerald-800 flex items-center gap-2 tracking-tight">
          <CheckCircle2 className="w-6 h-6 md:w-7 md:h-7 text-emerald-600" />
          <span>Pedidos Listos</span>
        </h2>
        <Badge
          variant="outline"
          className="text-xs md:text-sm font-bold text-emerald-800 bg-emerald-50 border-emerald-300 px-3 py-0.5 rounded-full"
        >
          {filteredOrders.length} listos para retirar
        </Badge>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        {filteredOrders.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-2 text-center py-8">
            <UtensilsCrossed className="w-12 h-12 text-gray-300 stroke-[1.5]" />
            <p className="text-gray-500 font-semibold text-base md:text-lg">No hay pedidos listos.</p>
          </div>
        ) : isMultiColumn ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 md:gap-2 items-start">
            <div className="flex flex-col gap-1.5 md:gap-2">
              {col1Orders.map(renderOrderItem)}
            </div>
            <div className="flex flex-col gap-1.5 md:gap-2">
              {col2Orders.map(renderOrderItem)}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5 md:gap-2">
            {col1Orders.map(renderOrderItem)}
          </div>
        )}
      </div>
    </Card>
  );
}

export default CompletedOrders;
