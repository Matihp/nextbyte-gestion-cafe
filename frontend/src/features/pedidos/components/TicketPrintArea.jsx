import React from 'react';
import { OrderPrintTicket } from '@/features/comandas/OrderPrintTicket';

export function TicketPrintArea({ order }) {
  return <OrderPrintTicket order={order} />;
}

export default TicketPrintArea;
