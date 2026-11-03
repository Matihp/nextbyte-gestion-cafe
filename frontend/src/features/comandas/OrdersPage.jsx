import React, { useState, useEffect, useMemo } from 'react';
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
import { formatearPrecio, formatearFecha } from '@/utils/formatters';

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

export const toBackendStatus = (statusDisplay) => {
  switch (statusDisplay) {
    case 'En preparación':
      return 'en_preparacion';
    case 'En empaque':
      return 'en_empaque';
    case 'Completado':
      return 'completado';
    case 'Cancelado':
      return 'cancelado';
    case 'Pendiente':
    case 'Ingresado':
    default:
      return 'pendiente';
  }
};

export function OrdersPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('Todos');
  const [orders, setOrders] = useState(() => {
    try {
      const saved = localStorage.getItem('nextbyte_orders');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [loading, setLoading] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [viewingRecipe, setViewingRecipe] = useState(null);
  const [printingOrder, setPrintingOrder] = useState(null);

  const statuses = [
    'Todos',
    'Pendiente',
    'En preparación',
    'En empaque',
    'Completado',
    'Cancelado'
  ];

  // Carga de comandas y pedidos desde el backend
  const fetchOrders = async () => {
    setLoading(true);
    try {
      // Intentamos traer activas y pedidos generales
      const [activasRes, todosRes] = await Promise.allSettled([
        comandaService.obtenerActivas(),
        pedidoService.obtenerTodos()
      ]);

      let backendOrders = [];

      if (todosRes.status === 'fulfilled' && todosRes.value?.data?.data) {
        backendOrders = todosRes.value.data.data;
      } else if (activasRes.status === 'fulfilled' && activasRes.value?.data?.data) {
        backendOrders = activasRes.value.data.data;
      }

      if (Array.isArray(backendOrders) && backendOrders.length > 0) {
        const mapped = backendOrders.map((o) => {
          const items = (o.detalles || o.items || []).map((det) => ({
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
            orderType: o.tipo_pedido || o.orderType || 'Salón',
            paymentMethod: o.metodo_pago || o.paymentMethod || 'Efectivo',
            address: o.direccion || o.address || '',
            phone: o.telefono || o.phone || '',
            date: dateStr,
            time: timeStr,
            items
          };
        });

        setOrders(mapped);
        localStorage.setItem('nextbyte_orders', JSON.stringify(mapped));
      }
    } catch {
      // Si el backend no tiene pedidos o está offline, se conservan los datos de localStorage
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  // Guardar en localStorage cuando cambian las comandas
  useEffect(() => {
    localStorage.setItem('nextbyte_orders', JSON.stringify(orders));
  }, [orders]);

  const selectedOrder = useMemo(
    () => (selectedOrderId ? orders.find((o) => o.id === selectedOrderId) : null),
    [orders, selectedOrderId]
  );

  // Filtrado dinámico
  const filteredOrders = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    return orders.filter((order) => {
      const idMatch = String(order.id).toLowerCase().includes(term);
      const customerMatch = String(order.customer || '').toLowerCase().includes(term);
      const matchesSearch = !term || idMatch || customerMatch;

      let matchesStatus = true;
      if (statusFilter !== 'Todos') {
        matchesStatus = order.status === statusFilter;
      } else {
        // En "Todos" se muestran todos excepto los cancelados para mantener la vista limpia
        matchesStatus = order.status !== 'Cancelado';
      }

      return matchesSearch && matchesStatus;
    });
  }, [orders, searchTerm, statusFilter]);

  // Cambio de estado
  const handleStatusChange = async (orderId, newStatusDisplay) => {
    const prevOrder = orders.find((o) => o.id === orderId);
    if (!prevOrder) return;

    // Actualización optimista
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: newStatusDisplay } : o))
    );

    const backendStatus = toBackendStatus(newStatusDisplay);

    try {
      if (backendStatus === 'completado') {
        await comandaService.completar(orderId);
      } else {
        await comandaService.cambiarEstado(orderId, backendStatus);
      }
      toast.success(`Pedido #${orderId} actualizado a "${newStatusDisplay}"`);
    } catch (err) {
      // Si la API falla o está desconectada, mantenemos el cambio local y avisamos
      const msg = err.response?.data?.message || err.message;
      toast.info(`Estado actualizado localmente: "${newStatusDisplay}"`);
    }
  };

  // Cancelar pedido completo
  const handleCancelOrder = async (orderId) => {
    try {
      await pedidoService.cancelar(orderId);
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: 'Cancelado' } : o))
      );
      toast.success(`Pedido #${orderId} cancelado`);
      setSelectedOrderId(null);
    } catch {
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: 'Cancelado' } : o))
      );
      toast.success(`Pedido #${orderId} cancelado`);
      setSelectedOrderId(null);
    }
  };

  // Cancelar ítem específico de un pedido
  const handleCancelOrderItem = async (orderId, itemId, itemName) => {
    try {
      await pedidoService.eliminarItem(orderId, itemId);
    } catch {
      // Se descuenta localmente si falla
    }

    setOrders((prev) =>
      prev.map((o) => {
        if (o.id !== orderId) return o;
        const newItems = o.items.filter((it) => it.id !== itemId);
        const newTotal = newItems.reduce((acc, it) => acc + it.price * it.quantity, 0);
        return {
          ...o,
          items: newItems,
          total: newTotal
        };
      })
    );

    toast.success(`Ítem "${itemName}" eliminado del pedido #${orderId}`);
  };

  // Abrir modal de receta
  const handleViewRecipe = async (item) => {
    try {
      if (item.productId) {
        const res = await productoService.obtenerReceta(item.productId);
        const recipeData = res?.data?.data || res?.data || res;
        if (recipeData && (recipeData.ingredientes?.length > 0 || recipeData.nombre)) {
          setViewingRecipe({
            name: recipeData.nombre || item.name,
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

  // Imprimir ticket de comanda
  const handlePrint = (order) => {
    setPrintingOrder(order);
    setTimeout(() => {
      window.print();
    }, 150);
  };

  return (
    <div className="p-8 w-full max-w-full min-w-0 overflow-x-hidden">
      {/* Barra de Filtros y Búsqueda */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 mb-6 w-full max-w-full min-w-0">
        <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <Input
              type="text"
              placeholder="Buscar por ID de pedido o cliente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border-gray-300 rounded-lg focus-visible:ring-[#A67C52] bg-white text-sm"
            />
          </div>

          <div className="flex gap-2 overflow-x-auto items-center pb-1 md:pb-0">
            {statuses.map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer ${
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
              className="ml-1 text-gray-600 hover:text-[#4B2B1D] hover:bg-gray-100 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#9F4F2F]' : ''}`} />
            </Button>
          </div>
        </div>
      </div>

      {/* Tabla Dinámica de Comandas */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden w-full max-w-full">
        <div className="overflow-x-auto w-full max-w-full">
          <table className="w-full border-collapse">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">
                  ID del Pedido
                </th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">
                  Cliente
                </th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">
                  Artículos
                </th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">
                  Fecha y Hora
                </th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">
                  Total
                </th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">
                  Estado
                </th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">
                  Tipo Pedido
                </th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">
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
                  <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-sm font-bold text-gray-900 whitespace-nowrap">
                      #{order.id}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 font-medium max-w-[180px] truncate" title={order.customer}>
                      {order.customer}
                    </td>
                    <td
                      className="px-6 py-4 text-sm text-gray-600 max-w-[220px] truncate"
                      title={itemsDesc}
                    >
                      {itemsDesc}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">
                      <div>{order.date || '-'}</div>
                      <div className="text-xs text-gray-400">{order.time || ''}</div>
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-[#4B2B1D] whitespace-nowrap">
                      {formatearPrecio(order.total)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <select
                        value={order.status}
                        onChange={(e) => handleStatusChange(order.id, e.target.value)}
                        className={`px-3 py-1 rounded-full text-xs font-semibold cursor-pointer border-0 outline-none transition-colors ${getStatusColor(
                          order.status
                        )}`}
                      >
                        <option value="Pendiente">Pendiente</option>
                        <option value="En preparación">En preparación</option>
                        <option value="En empaque">En empaque</option>
                        <option value="Completado">Completado</option>
                        <option value="Cancelado">Cancelado</option>
                      </select>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">
                      <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-gray-100 text-gray-700">
                        {order.orderType || 'Salón'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setSelectedOrderId(order.id)}
                        className="p-2 hover:bg-[#F3E5DC]/60 text-gray-600 hover:text-[#4B2B1D] rounded-lg transition-colors cursor-pointer"
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
                  <td colSpan={8} className="px-6 py-16 text-center text-gray-500">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-[#F3E5DC] flex items-center justify-center text-[#70422B]">
                        <UtensilsCrossed className="w-6 h-6 opacity-60" />
                      </div>
                      <h3 className="font-semibold text-[#4B2B1D] text-base">
                        {orders.length === 0
                          ? 'No hay comandas registradas'
                          : 'No se encontraron pedidos con el filtro actual'}
                      </h3>
                      <p className="text-sm text-gray-400 max-w-sm">
                        {orders.length === 0
                          ? 'Los pedidos ingresados aparecerán aquí automáticamente para su preparación y seguimiento en vivo.'
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
          onCancelOrder={handleCancelOrder}
          onCancelItem={handleCancelOrderItem}
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

