import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Maximize2, X } from 'lucide-react';
import { RecentOrders } from './RecentOrders';
import { CompletedOrders } from './CompletedOrders';
import { comandaService } from '@/services/comandaService';
import { pedidoService } from '@/services/pedidoService';
import { normalizeStatusDisplay, normalizeOrderTypeDisplay } from '@/features/comandas/OrdersPage';

// Función para formatear el nombre mostrando el primer nombre y solo la inicial del apellido
export const formatCustomerName = (fullName) => {
  if (!fullName || typeof fullName !== 'string') return 'Consumidor Final';
  const cleaned = fullName.trim();
  if (!cleaned) return 'Consumidor Final';
  if (cleaned.toLowerCase() === 'consumidor final') return 'Consumidor Final';

  const parts = cleaned.split(/\s+/);
  const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

  if (parts.length === 1) return capitalize(parts[0]);
  const firstName = capitalize(parts[0]);
  const lastNameInitial = parts[1][0].toUpperCase();
  return `${firstName} ${lastNameInitial}.`;
};

// Colores diferenciados para los 3 tipos de pedido: Naranja (Take Away), Celeste (Mostrador) y Lila (Delivery)
export const getOrderTypeColor = (type) => {
  const t = String(type || '').toLowerCase().trim();
  if (t === 'take_away' || t === 'takeaway' || t === 'take away') {
    return 'bg-orange-100/90 text-orange-800 border-orange-300'; // Naranja
  }
  if (t === 'delivery') {
    return 'bg-purple-100/90 text-purple-800 border-purple-300'; // Lila
  }
  return 'bg-sky-100/90 text-sky-800 border-sky-300'; // Celeste (Mostrador)
};

export function CustomerViewerPage() {
  const containerRef = useRef(null);
  const ordersRef = useRef([]);
  const [orders, setOrders] = useState([]);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    ordersRef.current = orders;
  }, [orders]);

  // Carga de pedidos activos y actualizados desde el backend
  const fetchOrders = useCallback(async () => {
    try {
      const [activasRes, todosRes] = await Promise.allSettled([
        comandaService.obtenerActivas({ incluir_completados: true }),
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
            price: Number(det.precio_venta ?? det.price ?? 0)
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
            displayId: o.display_id || o.displayId || (o.numero_pedido ? `#${String(o.numero_pedido).padStart(4, '0')}` : null),
            numero_pedido: o.numero_pedido,
            customer: o.cliente || o.customer || 'Consumidor Final',
            total: Number(o.total || 0),
            status: normalizeStatusDisplay(o.estado || o.status),
            orderType: normalizeOrderTypeDisplay(o.tipo_pedido || o.orderType),
            time: timeStr,
            date: dateStr,
            items
          };
        });

        setOrders(mapped);
      } else {
        // Fallback a localStorage si el backend no respondió
        const saved = localStorage.getItem('nextbyte_orders');
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) setOrders(parsed);
          } catch {
            setOrders([]);
          }
        }
      }
    } catch {
      const saved = localStorage.getItem('nextbyte_orders');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) setOrders(parsed);
        } catch {
          setOrders([]);
        }
      }
    }
  }, []);

  // Carga inicial y sondeo periódico cada 8 segundos para actualización pasiva en salón
  useEffect(() => {
    fetchOrders();

    const interval = setInterval(() => {
      // Se considera activa si la pestaña está visible o si está en pantalla completa
      const isTabActive =
        document.visibilityState === 'visible' ||
        Boolean(document.fullscreenElement) ||
        isFullscreen;

      if (isTabActive) {
        fetchOrders();
      }
    }, 8000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchOrders();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('orders-updated', fetchOrders);
    window.addEventListener('storage', fetchOrders);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('orders-updated', fetchOrders);
      window.removeEventListener('storage', fetchOrders);
    };
  }, [fetchOrders, isFullscreen]);

  // Manejo de pantalla completa
  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        if (containerRef.current?.requestFullscreen) {
          await containerRef.current.requestFullscreen();
        } else if (document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
        }
        setIsFullscreen(true);
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        }
        setIsFullscreen(false);
      }
    } catch (err) {
      console.warn('Error al cambiar pantalla completa:', err);
      setIsFullscreen((prev) => !prev);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={
        isFullscreen
          ? 'fixed inset-0 z-[100] flex flex-col bg-[#F3E5DC] p-3.5 md:p-5 lg:p-6 select-none overflow-hidden h-screen w-screen'
          : 'relative flex-1 w-full h-full min-h-0 bg-[#F3E5DC] rounded-2xl p-3 md:p-4 lg:p-5 flex flex-col select-none overflow-hidden'
      }
    >
      {/* Botón superior central flotante (visible al pasar el mouse por arriba SOLO en pantalla completa) */}
      {isFullscreen && (
        <div className="absolute top-0 left-1/2 -translate-x-1/2 h-20 w-64 flex justify-center items-start pt-3 opacity-0 hover:opacity-100 transition-opacity z-50 pointer-events-none">
          <button
            type="button"
            onClick={toggleFullscreen}
            className="p-2.5 bg-black/75 text-white rounded-full hover:bg-black transition-colors shadow-2xl cursor-pointer pointer-events-auto"
            title="Salir de pantalla completa"
          >
            <X className="w-7 h-7" />
          </button>
        </div>
      )}

      {/* Cabecera con Título centrado y cartel de atención + botón de Ampliar */}
      <div className="relative flex items-center justify-between mb-2 lg:mb-3 shrink-0 w-full max-w-[98%] mx-auto min-h-[46px] gap-2">
        <div className="flex-1 hidden md:block"></div> {/* Espaciador balanceador izquierdo */}

        <h1 className="text-2xl md:text-3xl lg:text-4xl font-black text-center text-[#4B2B1D] tracking-tight shrink-0 px-2">
          Estado de Pedidos
        </h1>

        {/* Lado derecho: Cartel de advertencia con leve intermitencia y botón de pantalla completa */}
        <div className="flex-1 flex justify-end items-center gap-2.5 sm:gap-3">
          {!isFullscreen && (
            <>
              <div className="animate-pulse bg-[#FFF8F3] border border-[#D7BBA6] text-[#4B2B1D] px-3 py-1.5 rounded-xl shadow-xs text-xs md:text-sm flex items-center gap-1.5">
                <span className="font-black text-[#8B0000] tracking-wider uppercase shrink-0">ATENCIÓN:</span>
                <span className="font-semibold text-[#4B2B1D] text-left">
                  Para visualizar los datos actualizados seleccionar{' '}
                  <span className="font-extrabold text-[#70422B]">"PANTALLA COMPLETA"</span>
                </span>
              </div>

              <button
                type="button"
                onClick={toggleFullscreen}
                className="p-2.5 md:p-3 bg-white shadow-md text-gray-700 rounded-full hover:text-[#4B2B1D] hover:bg-gray-50 transition-all cursor-pointer shadow-sm hover:shadow shrink-0"
                title="Pantalla completa"
              >
                <Maximize2 className="w-5 h-5 md:w-6 md:h-6" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Contenedor de las dos Cards (Pedidos Recientes y Pedidos Listos) sin scroll */}
      <div className="w-full max-w-[98%] mx-auto grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-5 flex-1 min-h-0 overflow-hidden">
        <div className="h-full min-h-0 overflow-hidden">
          <RecentOrders orders={orders} />
        </div>

        <div className="h-full min-h-0 overflow-hidden">
          <CompletedOrders orders={orders} />
        </div>
      </div>
    </div>
  );
}

export default CustomerViewerPage;
