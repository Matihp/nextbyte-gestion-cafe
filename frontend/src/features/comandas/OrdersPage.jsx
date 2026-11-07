import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Search, Eye, UtensilsCrossed, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { OrderSummaryModal } from './OrderSummaryModal';
import { RecipeDetailModal } from './RecipeDetailModal';
import { OrderPrintTicket } from './OrderPrintTicket';
import { comandaService } from '@/services/comandaService';
import { pedidoService } from '@/services/pedidoService';
import { productoService } from '@/services/productoService';
import { formatearPrecio } from '@/utils/formatters';
import { useAuth } from '@/hooks/useAuth';
import {
  formatDateDDMMAAAA,
  isOrderFromToday,
  isCompletedOrderExpired,
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
  if (s === 'completado') return 'Completado';
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
  switch (statusDisplay) {
    case 'En preparación':
      return 'en_preparacion';
    case 'En empaque':
      return 'en_empaque';
    case 'Completado':
      return 'completado';
    case 'Entregado':
      return 'entregado';
    case 'Cancelado':
      return 'cancelado';
    case 'Pendiente':
    case 'Ingresado':
    default:
      return 'pendiente';
  }
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
  const [completedTimes, setCompletedTimes] = useState(() => {
    try {
      const s = localStorage.getItem('nextbyte_completed_order_times');
      return s ? JSON.parse(s) : {};
    } catch {
      return {};
    }
  });

  const ordersRef = useRef(orders);
  useEffect(() => {
    ordersRef.current = orders;
  }, [orders]);

  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [viewingRecipe, setViewingRecipe] = useState(null);
  const [printingOrder, setPrintingOrder] = useState(null);

  const statuses = [
    'Todos',
    'Pendiente',
    'En preparación',
    'En empaque',
    'Completado',
    'Entregado'
  ];

  // Carga de comandas y pedidos desde el backend
  const fetchOrders = async () => {
    setLoading(true);
    try {
      const [activasRes, todosRes] = await Promise.allSettled([
        comandaService.obtenerActivas(),
        pedidoService.obtenerTodos()
      ]);

      const extractData = (res) => {
        if (!res || res.status !== 'fulfilled') return null;
        const val = res.value;
        if (Array.isArray(val)) return val;
        if (Array.isArray(val?.data)) return val.data;
        if (Array.isArray(val?.data?.data)) return val.data.data;
        return null;
      };

      const activas = extractData(activasRes);
      const todos = extractData(todosRes);

      let backendOrders = null;
      if (todos !== null && activas !== null) {
        const activasMap = new Map(activas.map((a) => [String(a.id), a]));
        backendOrders = todos.map((t) => {
          const act = activasMap.get(String(t.id));
          return act ? { ...t, ...act } : t;
        });
      } else if (todos !== null) {
        backendOrders = todos;
      } else if (activas !== null) {
        backendOrders = activas;
      }

      if (backendOrders !== null) {
        const mapped = backendOrders.map((o) => {
          const prevOrder = ordersRef.current.find((p) => String(p.id) === String(o.id));
          const itemsRaw = (o.detalles && o.detalles.length > 0)
            ? o.detalles
            : (o.items && o.items.length > 0)
            ? o.items
            : (prevOrder?.items || []);

          const items = itemsRaw.map((det) => ({
            id: det.id,
            productId: det.producto_id ?? det.productId,
            name: det.nombre_producto || det.name || 'Producto',
            quantity: Number(det.cantidad ?? det.quantity ?? 1),
            price: Number(det.precio_venta ?? det.price ?? 0),
            costPrice: Number(det.precio_costo ?? det.costPrice ?? 0)
          }));

          const dateStr = o.fecha || (o.created_at ? o.created_at.split('T')[0] : '');
          const timeStr = o.hora || (o.created_at ? new Date(o.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : '');

          return {
            id: String(o.id),
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
        setOrders(sequenced);
        localStorage.setItem('nextbyte_orders', JSON.stringify(sequenced));
      }
    } catch {
      // Si el backend no tiene pedidos o está offline, se conservan los datos de localStorage
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchOrders();
      }
    }, 5000);
    const onFocus = () => fetchOrders();
    window.addEventListener('focus', onFocus);
    window.addEventListener('orders-updated', fetchOrders);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('orders-updated', fetchOrders);
    };
  }, []);

  // Si se abre un pedido sin ítems cargados, cargar sus detalles
  useEffect(() => {
    if (!selectedOrderId) return;
    const curr = orders.find((o) => o.id === selectedOrderId);
    if (curr && (!curr.items || curr.items.length === 0)) {
      pedidoService
        .obtenerPorId(selectedOrderId)
        .then((res) => {
          const full = res?.data?.data || res?.data || res;
          if (full && (full.detalles || full.items)) {
            const items = (full.detalles || full.items || []).map((det) => ({
              id: det.id,
              productId: det.producto_id ?? det.productId,
              name: det.nombre_producto || det.name || 'Producto',
              quantity: Number(det.cantidad ?? det.quantity ?? 1),
              price: Number(det.precio_venta ?? det.price ?? 0),
              costPrice: Number(det.precio_costo ?? det.costPrice ?? 0)
            }));
            setOrders((prev) =>
              prev.map((o) => (o.id === selectedOrderId ? { ...o, items } : o))
            );
          }
        })
        .catch(() => {});
    }
  }, [selectedOrderId, orders]);

  // Guardar en localStorage cuando cambian las comandas
  useEffect(() => {
    localStorage.setItem('nextbyte_orders', JSON.stringify(orders));
  }, [orders]);

  const selectedOrder = useMemo(
    () => (selectedOrderId ? orders.find((o) => o.id === selectedOrderId) : null),
    [orders, selectedOrderId]
  );

  // Filtrado dinámico con reglas de negocio:
  // 1. Desaparecen pedidos de días anteriores (reinicio a las 00:00 hs)
  // 2. Pedidos en estado "Completado" desaparecen luego de 1 hora
  const filteredOrders = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    return orders.filter((order) => {
      // REGLA 1: Solo pedidos del día actual
      if (!isOrderFromToday(order)) return false;

      // REGLA 2: Completados desaparecen tras 1 hora
      if (isCompletedOrderExpired(order, completedTimes)) return false;

      // Búsqueda por número (#0001), ID backend (PED-...) o nombre de cliente
      const idMatch = String(order.id).toLowerCase().includes(term);
      const numberMatch = String(order.orderNumber || order.displayId || '').toLowerCase().includes(term);
      const customerMatch = String(order.customer || '').toLowerCase().includes(term);
      const matchesSearch = !term || idMatch || numberMatch || customerMatch;

      let matchesStatus = true;
      if (statusFilter !== 'Todos') {
        matchesStatus = order.status === statusFilter;
      } else {
        matchesStatus = order.status !== 'Cancelado';
      }

      return matchesSearch && matchesStatus;
    });
  }, [orders, searchTerm, statusFilter, completedTimes]);

  // Cambio de estado
  const handleStatusChange = async (orderId, newStatusDisplay) => {
    const prevOrder = orders.find((o) => o.id === orderId);
    if (!prevOrder) return;
    if (prevOrder.status === newStatusDisplay) return;

    // Actualización optimista
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: newStatusDisplay } : o))
    );

    // Si se pasa a Completado, registrar la hora para la expiración de 1 hora
    if (newStatusDisplay === 'Completado') {
      const now = Date.now();
      setCompletedTimes((prev) => {
        const next = { ...prev, [String(orderId)]: now };
        try {
          localStorage.setItem('nextbyte_completed_order_times', JSON.stringify(next));
        } catch {
          // ignore
        }
        return next;
      });
    }

    const backendTarget = toBackendStatus(newStatusDisplay);
    const backendCurrent = toBackendStatus(prevOrder.status);

    try {
      if (backendTarget === 'entregado') {
        await comandaService.entregar(orderId);
      } else if (backendTarget === 'cancelado') {
        await pedidoService.cancelar(orderId);
      } else if (backendTarget === 'completado') {
        if (backendCurrent === 'pendiente') {
          await comandaService.cambiarEstado(orderId, 'en_preparacion');
          await comandaService.cambiarEstado(orderId, 'en_empaque');
        } else if (backendCurrent === 'en_preparacion') {
          await comandaService.cambiarEstado(orderId, 'en_empaque');
        }
        await comandaService.completar(orderId);
      } else {
        await comandaService.cambiarEstado(orderId, backendTarget);
      }
      window.dispatchEvent(new CustomEvent('orders-updated'));
      const orderNumLabel = prevOrder.displayId || prevOrder.orderNumber || `#${prevOrder.id}`;
      toast.success(`Pedido ${orderNumLabel.startsWith('#') ? orderNumLabel : `#${orderNumLabel}`} actualizado a "${newStatusDisplay}"`);
    } catch {
      // Revertir en error
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: prevOrder.status } : o))
      );
      toast.error('No se pudo actualizar el estado del pedido en el servidor');
    }
  };

  // Cancelar pedido completo desde el modal
  const handleCancelOrder = async (orderId) => {
    try {
      const esMerma = window.confirm(
        '¿Desea registrar los productos de este pedido como MERMA (Aceptar) o RESTAURAR el stock (Cancelar)?\n\nAceptar = Es Merma (no vuelve al stock)\nCancelar = Vuelve al stock'
      );
      await pedidoService.cancelar(orderId, { esMerma: Boolean(esMerma), motivo: 'MERMA' });
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: 'Cancelado' } : o))
      );
      setSelectedOrderId(null);
      window.dispatchEvent(new CustomEvent('orders-updated'));
      toast.success(esMerma ? 'Pedido cancelado y registrado como MERMA' : 'Pedido cancelado exitosamente');
    } catch {
      toast.error('Error al cancelar el pedido');
    }
  };

  // Cancelar ítem específico de un pedido
  const handleCancelOrderItem = async (orderId, itemId, itemName) => {
    try {
      const order = orders.find((o) => o.id === orderId);
      if (!order) return;

      const updatedItems = order.items.filter((item) => item.id !== itemId);
      const newTotal = updatedItems.reduce(
        (acc, item) => acc + (Number(item.price) || 0) * (Number(item.quantity) || 1),
        0
      );

      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, items: updatedItems, total: newTotal } : o))
      );

      toast.success(`Artículo "${itemName}" cancelado del pedido`);
    } catch {
      toast.error('No se pudo cancelar el artículo del pedido');
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
  const handlePrint = () => {
    window.print();
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
                        value={order.status}
                        onChange={(e) => handleStatusChange(order.id, e.target.value)}
                        className={`px-2.5 py-1 rounded-full text-xs font-semibold cursor-pointer border-0 outline-none transition-colors ${getStatusColor(
                          order.status
                        )}`}
                      >
                        <option value="Pendiente">Pendiente</option>
                        <option value="En preparación">En preparación</option>
                        <option value="En empaque">En empaque</option>
                        <option value="Completado">Completado</option>
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
          onCancelOrder={canCancelOrder ? handleCancelOrder : undefined}
          onCancelItem={canCancelOrder ? handleCancelOrderItem : undefined}
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

      {/* Ticket de Impresión para PrintPortal */}
      {printingOrder && <OrderPrintTicket order={printingOrder} />}
    </div>
  );
}

export default OrdersPage;
