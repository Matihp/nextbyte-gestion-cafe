import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Search, Eye, UtensilsCrossed, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { OrderSummaryModal } from './OrderSummaryModal';
import { RecipeDetailModal } from './RecipeDetailModal';
import { OrderPrintTicket } from './OrderPrintTicket';
import ModalConfirmarCancelarPedido from './ModalConfirmarCancelarPedido';
import { comandaService, createComandaPolling, getAllowedOrderStatuses, getComandaErrorMessage, notifyOrdersUpdated } from '@/services/comandaService';
import { pedidoService } from '@/services/pedidoService';
import { productoService } from '@/services/productoService';
import { formatearPrecio } from '@/utils/formatters';
import { useAuth } from '@/hooks/useAuth';
import {
  formatDateDDMMAAAA,
  assignDailyOrderNumbers
} from './orderSequence';

export const getStatusColor = (status) => {
  const s = String(status || '').toLowerCase().trim();
  switch (s) {
    case 'completado':
      return 'bg-emerald-100 text-emerald-700';
    case 'entregado':
      return 'bg-emerald-100 text-emerald-800 border border-emerald-200';
    case 'en empaque':
    case 'en_empaque':
      return 'bg-orange-100 text-orange-700';
    case 'en preparación':
    case 'en preparacion':
    case 'en_preparacion':
      return 'bg-yellow-100 text-yellow-700';
    case 'ingresado':
    case 'pendiente':
      return 'bg-gray-100 text-gray-700';
    case 'cancelado':
      return 'bg-red-100 text-red-700';
    default:
      return 'bg-gray-100 text-gray-700';
  }
};

export const normalizeStatusDisplay = (status) => {
  const s = String(status || '').toLowerCase().trim();
  if (s === 'en_preparacion') return 'En preparación';
  if (s === 'en_empaque') return 'En empaque';
  if (s === 'completado' || s === 'listo') return 'Listo';
  if (s === 'cancelado') return 'Cancelado';
  if (s === 'pendiente') return 'Pendiente';
  if (s === 'entregado') return 'Entregado';
  return status || 'Pendiente';
};

export const normalizeOrderTypeDisplay = (type) => {
  const t = String(type || '').toLowerCase().trim();
  if (t === 'take_away' || t === 'takeaway' || t === 'take away') return 'Take Away';
  if (t === 'delivery') return 'Delivery';
  if (t === 'mostrador' || t === 'salon' || t === 'salón') return 'Mostrador';
  return 'Mostrador';
};

export const toBackendStatus = (statusDisplay) => {
  const status = String(statusDisplay || '').trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '_');
  if (status === 'listo' || status === 'completado') return 'completado';
  return status === 'ingresado' ? 'pendiente' : status;
};

export function OrdersPage() {
  const { user, isAdmin } = useAuth();
  const canCancelOrder = useMemo(() => {
    if (isAdmin) return true;
    if (!user) return true;
    let perms = [];
    if (Array.isArray(user.permisos)) {
      perms = user.permisos;
    } else if (typeof user.permisos === 'string') {
      try {
        perms = JSON.parse(user.permisos);
      } catch {
        perms = [];
      }
    }
    return perms.includes('all') || perms.includes('cancelOrder');
  }, [user, isAdmin]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('Todos');
  const [orders, setOrders] = useState(() => {
    try {
      const saved = localStorage.getItem('nextbyte_orders');
      const parsed = saved ? JSON.parse(saved) : [];
      return assignDailyOrderNumbers(parsed);
    } catch {
      return [];
    }
  });

  const [loading, setLoading] = useState(false);
  const [, setCompletedTimes] = useState(() => {
    try {
      const s = localStorage.getItem('nextbyte_completed_order_times');
      return s ? JSON.parse(s) : {};
    } catch {
      return {};
    }
  });

  const ordersRef = useRef(orders);
  const pollingRef = useRef(null);
  const pendingOrdersRef = useRef(new Set());
  const activeMutationsRef = useRef(new Set());
  const mountedRef = useRef(false);
  const [pendingOrders, setPendingOrders] = useState(new Set());
  const [readError, setReadError] = useState('');

  const updateOrders = useCallback((update) => {
    const next = typeof update === 'function' ? update(ordersRef.current) : update;
    ordersRef.current = next;
    setOrders(next);
    try {
      localStorage.setItem('nextbyte_orders', JSON.stringify(next));
    } catch { /* La caché es opcional; nunca reemplaza una escritura al backend. */ }
  }, []);

  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [viewingRecipe, setViewingRecipe] = useState(null);
  const [printingOrder, setPrintingOrder] = useState(null);
  const [modalCancelarOpen, setModalCancelarOpen] = useState(false);
  const [accionCancelar, setAccionCancelar] = useState(null);
  const [cancelando, setCancelando] = useState(false);

  const statuses = [
    'Todos',
    'Pendiente',
    'En preparación',
    'En empaque',
    'Completado'
  ];

  const receiveOrders = useCallback((backendOrders) => {
    const ordenesComanda = backendOrders.filter((o) => {
      const st = String(o.estado || o.status || '').toLowerCase().trim();
      return st !== 'entregado' && st !== 'cancelado';
    });
    const mapped = ordenesComanda.map((o) => {
      const prevOrder = ordersRef.current.find((p) => String(p.id) === String(o.id));
      const itemsRaw = Array.isArray(o.detalles)
        ? o.detalles
        : Array.isArray(o.items) ? o.items : (prevOrder?.items || []);

      const items = itemsRaw.map((det) => ({
        id: det.id,
        productId: det.producto_id ?? det.productId,
        name: det.nombre_producto || det.name || 'Producto',
        quantity: Number(det.cantidad ?? det.quantity ?? 1),
        price: Number(det.precio_venta ?? det.price ?? 0),
        costPrice: Number(det.precio_costo ?? det.costPrice ?? 0)
      }));

      const dateStr = o.fecha || (o.created_at ? o.created_at.split('T')[0] : '');
      const timeStr =
        o.hora ||
        (o.created_at
          ? new Date(o.created_at).toLocaleTimeString('es-AR', {
              hour: '2-digit',
              minute: '2-digit',
              hour12: false,
              timeZone: 'America/Argentina/Buenos_Aires'
            })
          : '');

      return {
        id: String(o.id),
        numero_pedido: o.numero_pedido,
        customer: o.cliente || o.customer || 'Consumidor Final',
        total: Number(o.total || 0),
        status: normalizeStatusDisplay(o.estado || o.status),
        orderType: normalizeOrderTypeDisplay(o.tipo_pedido || o.orderType),
        paymentMethod: o.metodo_pago || o.paymentMethod || 'Efectivo',
        address: o.direccion || o.address || '',
        phone: o.telefono || o.phone || '',
        date: dateStr,
        time: timeStr,
        created_at: o.created_at,
        updated_at: o.updated_at,
        items
      };
    });

    // Asignación de números secuenciales diarios (#0001 a #1000)
    const sequenced = assignDailyOrderNumbers(mapped);
    updateOrders(sequenced);
    setSelectedOrderId((id) => sequenced.some((order) => order.id === id) ? id : null);
    setReadError('');
  }, [updateOrders]);

  const fetchOrders = () => pollingRef.current?.refresh({ force: true });

  useEffect(() => {
    mountedRef.current = true;
    const polling = createComandaPolling({
      onData: receiveOrders,
      onError: (error) => setReadError(getComandaErrorMessage(error)),
      onLoading: setLoading,
      canFetch: () => activeMutationsRef.current.size === 0
    });
    pollingRef.current = polling;
    polling.start();
    return () => {
      mountedRef.current = false;
      polling.stop();
      pollingRef.current = null;
    };
  }, [receiveOrders]);


  const selectedOrder = useMemo(
    () => (selectedOrderId ? orders.find((o) => o.id === selectedOrderId) : null),
    [orders, selectedOrderId]
  );

  // Filtrado dinámico:
  // REGLA: Los pedidos NO se van de la pantalla Comandas hasta que se les dé el estado de Entregado (o Cancelado).
  // No se van ni aunque pasen las horas ni aunque sea otro día. Solo desaparecen al pasar a "Entregado".
  const filteredOrders = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    return orders.filter((order) => {
      // REGLA: Los pedidos entregados o cancelados no deben verse en la sección Comandas
      const st = String(order.status || '').toLowerCase().trim();
      if (st === 'entregado' || st === 'cancelado') return false;

      // Búsqueda por número (#0001), ID backend (PED-...) o nombre de cliente
      const idMatch = String(order.id).toLowerCase().includes(term);
      const numberMatch = String(order.orderNumber || order.displayId || '').toLowerCase().includes(term);
      const customerMatch = String(order.customer || '').toLowerCase().includes(term);
      const matchesSearch = !term || idMatch || numberMatch || customerMatch;

      let matchesStatus = true;
      if (statusFilter !== 'Todos') {
        matchesStatus = order.status === statusFilter;
      }

      return matchesSearch && matchesStatus;
    });
  }, [orders, searchTerm, statusFilter]);

  const runOrderMutation = async (orderId, mutation, onConfirmed) => {
    const key = String(orderId);
    if (pendingOrdersRef.current.has(key)) return;
    pendingOrdersRef.current.add(key);
    activeMutationsRef.current.add(key);
    setPendingOrders(new Set(pendingOrdersRef.current));
    pollingRef.current?.invalidate();
    try {
      await mutation();
      if (mountedRef.current) onConfirmed();
    } catch (error) {
      if (mountedRef.current) toast.error(getComandaErrorMessage(error));
    } finally {
      if (mountedRef.current) {
        // También reconciliar 409, timeout y 503, sin repetir jamás la escritura.
        pollingRef.current?.invalidate();
        notifyOrdersUpdated();
      }
      activeMutationsRef.current.delete(key);
      if (mountedRef.current) await pollingRef.current?.refresh({ force: true });
      pendingOrdersRef.current.delete(key);
      if (mountedRef.current) setPendingOrders(new Set(pendingOrdersRef.current));
    }
  };

  // Una acción del usuario equivale a una única transición confirmada por el backend.
  const handleStatusChange = async (orderId, newStatusDisplay) => {
    const prevOrder = ordersRef.current.find((order) => order.id === orderId);
    if (!prevOrder) return;
    const backendCurrent = toBackendStatus(prevOrder.status);
    const backendTarget = toBackendStatus(newStatusDisplay);
    if (backendCurrent === backendTarget) return;

    await runOrderMutation(orderId, async () => {
      if (backendTarget === 'entregado') {
        return comandaService.entregar(orderId);
      }
      if (backendTarget === 'completado') {
        if (backendCurrent === 'pendiente') {
          await comandaService.cambiarEstado(orderId, 'en_preparacion');
          await comandaService.cambiarEstado(orderId, 'en_empaque');
        } else if (backendCurrent === 'en_preparacion') {
          await comandaService.cambiarEstado(orderId, 'en_empaque');
        }
        return comandaService.completar(orderId);
      }
      if (backendTarget === 'en_empaque') {
        if (backendCurrent === 'pendiente') {
          await comandaService.cambiarEstado(orderId, 'en_preparacion');
        }
        return comandaService.cambiarEstado(orderId, 'en_empaque');
      }
      return comandaService.cambiarEstado(orderId, backendTarget);
    }, () => {
      updateOrders((prev) => backendTarget === 'entregado'
        ? prev.filter((order) => order.id !== orderId)
        : prev.map((order) => order.id === orderId ? { ...order, status: newStatusDisplay } : order));
      if (backendTarget === 'entregado') setSelectedOrderId((id) => id === orderId ? null : id);
      if (backendTarget === 'completado') {
        setCompletedTimes((prev) => {
          const next = { ...prev, [String(orderId)]: Date.now() };
          try {
            localStorage.setItem('nextbyte_completed_order_times', JSON.stringify(next));
          } catch { /* Caché opcional. */ }
          return next;
        });
      }
      const label = prevOrder.displayId || prevOrder.orderNumber || `#${prevOrder.id}`;
      toast.success(`Pedido ${label} actualizado a "${newStatusDisplay}"`);
    });
  };

  // Abrir modal de motivo de cancelación para pedido completo
  const handleCancelOrder = (orderId) => {
    if (pendingOrdersRef.current.has(String(orderId))) return;
    setAccionCancelar({ tipo: 'pedido', orderId });
    setModalCancelarOpen(true);
  };

  // Abrir modal de motivo de cancelación para ítem específico de un pedido
  const handleCancelOrderItem = (orderId, itemId, itemName) => {
    if (pendingOrdersRef.current.has(String(orderId))) return;
    setAccionCancelar({ tipo: 'item', orderId, itemId, itemName });
    setModalCancelarOpen(true);
  };

  // Confirmación desde el modal unificado de cancelación (ES MERMA / OTROS MOTIVOS)
  const handleConfirmarCancelacion = async ({ esMerma, motivo }) => {
    if (!accionCancelar || pendingOrdersRef.current.has(String(accionCancelar.orderId))) return;
    const current = ordersRef.current.find((order) => String(order.id) === String(accionCancelar.orderId));
    if (!current || ['completado', 'entregado', 'cancelado'].includes(toBackendStatus(current.status)) ||
        (accionCancelar.tipo === 'item' && !current.items.some((item) => String(item.id) === String(accionCancelar.itemId)))) {
      toast.error('El pedido cambió; revisá su estado antes de cancelar');
      setAccionCancelar(null);
      setModalCancelarOpen(false);
      return;
    }
    setCancelando(true);
    try {
      await runOrderMutation(accionCancelar.orderId, async () => {
        if (accionCancelar.tipo === 'pedido') {
          await pedidoService.cancelar(accionCancelar.orderId, { esMerma, motivo });
        } else {
          await pedidoService.eliminarItem(accionCancelar.orderId, accionCancelar.itemId, { esMerma, motivo });
        }
      }, () => {
        if (accionCancelar.tipo === 'pedido') {
          updateOrders((prev) => prev.filter((order) => String(order.id) !== String(accionCancelar.orderId)));
          setSelectedOrderId(null);
          toast.success(esMerma
            ? 'Pedido cancelado y registrado en Mermas'
            : 'Pedido cancelado y restaurado en stock de productos');
        } else {
          // Ítems y total se reconcilian con la lectura posterior, no se recalculan localmente.
          toast.success(esMerma
            ? `Artículo "${accionCancelar.itemName}" cancelado y registrado en Mermas`
            : `Artículo "${accionCancelar.itemName}" cancelado del pedido`);
        }
      });
    } finally {
      if (mountedRef.current) {
        setCancelando(false);
        setAccionCancelar(null);
        setModalCancelarOpen(false);
      }
    }
  };

  // Ver receta de un producto
  const handleViewRecipe = async (item) => {
    try {
      let productId = item.productId;
      if (!productId) {
        const prodRes = await productoService.obtenerTodos();
        const prods = prodRes?.data?.data || prodRes?.data || prodRes || [];
        const match = prods.find((p) => p.nombre.toLowerCase() === item.name.toLowerCase());
        if (match) productId = match.id;
      }

      if (productId) {
        const res = await productoService.obtenerReceta(productId);
        const recipeData = res?.data?.data || res?.data || res;
        if (recipeData && recipeData.nombre) {
          setViewingRecipe({
            name: recipeData.nombre,
            steps: recipeData.pasos || '',
            ingredients: recipeData.ingredientes || []
          });
          return;
        }
      }
      toast.info(`El producto "${item.name}" no posee una receta configurada.`);
    } catch {
      toast.info(`El producto "${item.name}" no tiene receta asociada.`);
    }
  };

  // Imprimir comanda (modal de resumen de pedido)
  const handlePrint = (order) => {
    const ordenAImprimir = order || selectedOrder;
    if (!ordenAImprimir) return;
    setPrintingOrder(ordenAImprimir);
    setTimeout(() => {
      window.print();
      setTimeout(() => {
        setPrintingOrder(null);
      }, 500);
    }, 100);
  };

  return (
    <div className="p-4 md:p-6 w-full max-w-full min-w-0">
      {/* Barra de Filtros y Búsqueda */}
      <div className="bg-white rounded-xl shadow-sm p-4 md:p-5 border border-gray-100 mb-5 w-full max-w-full min-w-0">
        <div className="flex flex-col md:flex-row gap-3 md:gap-4 items-stretch md:items-center justify-between">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              type="text"
              placeholder="Buscar por #pedido o cliente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border-gray-300 rounded-lg focus-visible:ring-[#A67C52] bg-white text-sm"
            />
          </div>

          <div className="flex gap-1.5 md:gap-2 overflow-x-auto items-center pb-1 md:pb-0">
            {statuses.map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1.5 md:px-3.5 md:py-2 rounded-lg text-xs md:text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                  statusFilter === status
                    ? 'bg-[#4B2B1D] text-white shadow-xs'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {status}
              </button>
            ))}

            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={fetchOrders}
              disabled={loading}
              title="Actualizar pedidos"
              className="ml-1 text-gray-600 hover:text-[#4B2B1D] hover:bg-gray-100 cursor-pointer h-9 w-9"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#9F4F2F]' : ''}`} />
            </Button>
          </div>
        </div>
      </div>

      {readError && (
        <p role="alert" className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          {readError}. Se conservan los últimos datos disponibles; pueden estar desactualizados.
        </p>
      )}

      {/* Tabla Dinámica de Comandas: Sin espacios excesivos ni scroll lateral */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden w-full max-w-full">
        <div className="overflow-x-auto w-full max-w-full">
          <table className="w-full text-left border-collapse table-auto text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-3.5 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap w-20">
                  ID Pedido
                </th>
                <th className="px-3.5 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap">
                  Cliente
                </th>
                <th className="px-3.5 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                  Artículos
                </th>
                <th className="px-3.5 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap w-28">
                  Fecha y Hora
                </th>
                <th className="px-3.5 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap w-24">
                  Total
                </th>
                <th className="px-3.5 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap w-36">
                  Estado
                </th>
                <th className="px-3.5 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap w-28">
                  Tipo Pedido
                </th>
                <th className="px-2.5 py-3 text-center text-xs font-bold text-gray-600 uppercase tracking-wider whitespace-nowrap w-14">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredOrders.map((order) => {
                const itemsDesc =
                  order.items.length > 0
                    ? order.items.map((i) => `${i.quantity}x ${i.name}`).join(', ')
                    : 'Sin artículos';

                return (
                  <tr key={order.id} className="hover:bg-gray-50/80 transition-colors">
                    {/* 1. ID Pedido (#0001 a #1000) */}
                    <td className="px-3.5 py-2.5 font-black text-gray-900 whitespace-nowrap">
                      {order.displayId || order.orderNumber || `#${order.id}`}
                    </td>

                    {/* 2. Cliente */}
                    <td
                      className="px-3.5 py-2.5 text-gray-900 font-semibold max-w-[130px] md:max-w-[160px] truncate"
                      title={order.customer}
                    >
                      {order.customer}
                    </td>

                    {/* 3. Artículos */}
                    <td
                      className="px-3.5 py-2.5 text-gray-600 max-w-[160px] md:max-w-[220px] truncate"
                      title={itemsDesc}
                    >
                      {itemsDesc}
                    </td>

                    {/* 4. Fecha y Hora en formato DD/MM/AAAA */}
                    <td className="px-3.5 py-2.5 text-gray-600 whitespace-nowrap">
                      <div className="font-medium text-gray-800">{formatDateDDMMAAAA(order.date)}</div>
                      <div className="text-xs text-gray-400">{order.time || ''}</div>
                    </td>

                    {/* 5. Total */}
                    <td className="px-3.5 py-2.5 font-bold text-[#4B2B1D] whitespace-nowrap">
                      {formatearPrecio(order.total)}
                    </td>

                    {/* 6. Estado */}
                    <td className="px-3.5 py-2.5 whitespace-nowrap">
                      <select
                        value={normalizeStatusDisplay(order.status)}
                        disabled={pendingOrders.has(String(order.id)) || (modalCancelarOpen && String(accionCancelar?.orderId) === String(order.id))}
                        aria-label={`Estado del pedido ${order.displayId || order.id}`}
                        onChange={(e) => handleStatusChange(order.id, e.target.value)}
                        className={`px-2.5 py-1 rounded-full text-xs font-semibold cursor-pointer border-0 outline-none transition-colors ${getStatusColor(
                          normalizeStatusDisplay(order.status)
                        )}`}
                      >
                        <option value="Pendiente">Pendiente</option>
                        <option value="En preparación">En preparación</option>
                        <option value="En empaque">En empaque</option>
                        <option value="Listo">Listo</option>
                        <option value="Entregado">Entregado</option>
                      </select>
                    </td>

                    {/* 7. Tipo Pedido */}
                    <td className="px-3.5 py-2.5 text-gray-600 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded-md text-xs font-semibold bg-gray-100 text-gray-700">
                        {normalizeOrderTypeDisplay(order.orderType)}
                      </span>
                    </td>

                    {/* 8. Acciones */}
                    <td className="px-2.5 py-2.5 text-center whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setSelectedOrderId(order.id)}
                        className="p-1.5 hover:bg-[#F3E5DC]/60 text-gray-600 hover:text-[#4B2B1D] rounded-lg transition-colors cursor-pointer"
                        title="Ver detalles del pedido"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}

              {filteredOrders.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-14 text-center text-gray-500">
                    <div className="flex flex-col items-center justify-center gap-2.5">
                      <div className="w-11 h-11 rounded-full bg-[#F3E5DC] flex items-center justify-center text-[#70422B]">
                        <UtensilsCrossed className="w-5 h-5 opacity-60" />
                      </div>
                      <h3 className="font-semibold text-[#4B2B1D] text-base">
                        {orders.length === 0
                          ? 'No hay comandas registradas'
                          : 'No se encontraron pedidos con el filtro actual'}
                      </h3>
                      <p className="text-xs text-gray-400 max-w-sm">
                        {orders.length === 0
                          ? 'Los pedidos ingresados hoy aparecerán aquí automáticamente para su preparación y seguimiento en vivo.'
                          : 'Probá seleccionando "Todos" o cambiando los términos de búsqueda.'}
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Resumen de Pedido */}
      {selectedOrder && (
        <OrderSummaryModal
          open={!!selectedOrder}
          onOpenChange={(open) => {
            if (!open) setSelectedOrderId(null);
          }}
          order={selectedOrder}
          onClose={() => setSelectedOrderId(null)}
          onViewRecipe={handleViewRecipe}
          onPrint={() => handlePrint(selectedOrder)}
          onCancelOrder={canCancelOrder && !pendingOrders.has(String(selectedOrder.id)) && !modalCancelarOpen ? handleCancelOrder : undefined}
          onCancelItem={canCancelOrder && !pendingOrders.has(String(selectedOrder.id)) && !modalCancelarOpen ? handleCancelOrderItem : undefined}
        />
      )}

      {/* Modal Ver Receta */}
      {viewingRecipe && (
        <RecipeDetailModal
          open={!!viewingRecipe}
          onOpenChange={(open) => {
            if (!open) setViewingRecipe(null);
          }}
          recipe={viewingRecipe}
          onClose={() => setViewingRecipe(null)}
        />
      )}

      {/* Modal Unificado de Motivo de Cancelación */}
      <ModalConfirmarCancelarPedido
        open={modalCancelarOpen}
        onOpenChange={(open) => {
          if (cancelando || (accionCancelar && pendingOrdersRef.current.has(String(accionCancelar.orderId)))) return;
          setModalCancelarOpen(open);
          if (!open) setAccionCancelar(null);
        }}
        onConfirmar={handleConfirmarCancelacion}
        cargando={cancelando}
      />

      {/* Ticket de Impresión para PrintPortal */}
      {printingOrder && <OrderPrintTicket order={printingOrder} />}
    </div>
  );
}

export default OrdersPage;
