import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Maximize2, X, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { RecentOrders } from './RecentOrders';
import { CompletedOrders } from './CompletedOrders';
import { createComandaPolling, getComandaErrorMessage } from '@/services/comandaService';
import { normalizeStatusDisplay, normalizeOrderTypeDisplay } from '@/features/comandas/OrdersPage';
import { assignDailyOrderNumbers } from '@/features/comandas/orderSequence';

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
  const [orders, setOrders] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('nextbyte_orders') || '[]');
      return assignDailyOrderNumbers(Array.isArray(saved) ? saved.filter((order) =>
        !['entregado', 'cancelado'].includes(String(order.status || order.estado || '').toLowerCase().trim())) : []);
    } catch {
      return [];
    }
  });
  const ordersRef = useRef(orders);
  const pollingRef = useRef(null);
  const [readError, setReadError] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const receiveOrders = useCallback((backendOrders) => {
    // Filtrar pedidos entregados o cancelados (no deben aparecer en pantalla cliente)
    const ordenesVisibles = backendOrders.filter((o) => {
      const st = String(o.estado || o.status || '').toLowerCase().trim();
      return st !== 'entregado' && st !== 'cancelado';
    });

    const mapped = ordenesVisibles.map((o) => {
      const prevOrder = ordersRef.current.find((p) => String(p.id) === String(o.id));
      const itemsRaw = Array.isArray(o.detalles)
        ? o.detalles
        : Array.isArray(o.items) ? o.items : (prevOrder?.items || []);

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
        created_at: o.created_at,
        items
      };
    });

    const sequenced = assignDailyOrderNumbers(mapped);
    ordersRef.current = sequenced;
    setOrders(sequenced);
    setReadError('');
    try {
      localStorage.setItem('nextbyte_orders', JSON.stringify(sequenced));
    } catch { /* La lectura sigue disponible aunque la caché no pueda persistirse. */ }
  }, []);

  // Actualización manual instantánea de comandas y estados
  const handleManualRefresh = async () => {
    const refreshed = await pollingRef.current?.refresh({ force: true });
    if (!pollingRef.current) return;
    if (refreshed) toast.success('Comandas y estados actualizados');
  };

  useEffect(() => {
    const polling = createComandaPolling({
      onData: receiveOrders,
      onError: (error) => setReadError(getComandaErrorMessage(error)),
      onLoading: setIsRefreshing,
      interval: 8000
    });
    pollingRef.current = polling;
    polling.start();
    return () => {
      polling.stop();
      pollingRef.current = null;
    };
  }, [receiveOrders]);

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
          : 'relative flex-1 w-full h-full min-h-0 bg-[#F3E5DC] rounded-2xl p-2.5 md:p-3 lg:p-3.5 pt-1.5 md:pt-2 flex flex-col select-none overflow-hidden'
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

      {/* Cabecera: en modo normal usa 2 filas (título + controles), en fullscreen solo el título centrado */}
      {isFullscreen ? (
        <div className="flex items-center justify-center mb-2.5 lg:mb-3.5 shrink-0 w-full">
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-black text-center text-[#4B2B1D] tracking-tight px-2">
            Estado de Pedidos
          </h1>
        </div>
      ) : (
        <div className="flex flex-col mb-2 md:mb-2.5 shrink-0 w-full gap-1.5">
          {/* Fila 1: Título alineado a la izquierda (igual que las demás páginas) */}
          <h1 className="text-2xl md:text-3xl font-black text-[#4B2B1D] tracking-tight leading-tight">
            Estado de Pedidos
          </h1>

          {/* Fila 2: Cartel de atención + botones, alineados a la derecha */}
          <div className="flex items-center justify-end gap-2">
            {/* Cartel de atención, clicable para abrir pantalla completa */}
            <div
              onClick={toggleFullscreen}
              className="group bg-[#FFF8F3] hover:bg-[#FDF1E8] border border-[#D7BBA6] text-[#4B2B1D] px-2.5 py-1 rounded-xl text-xs flex items-center gap-2 cursor-pointer transition-colors"
              title="Clic para activar pantalla completa"
            >
              <span className="px-1.5 py-0.5 rounded bg-red-100 text-[#8B0000] font-black text-[10px] tracking-wider uppercase shrink-0">
                ATENCIÓN
              </span>
              <span className="font-medium text-[#4B2B1D] whitespace-nowrap hidden sm:inline">
                Para ver datos actualizados activar{' '}
                <span className="font-bold text-[#70422B] group-hover:underline">"PANTALLA COMPLETA"</span>
              </span>
              <span className="font-medium text-[#4B2B1D] sm:hidden whitespace-nowrap">
                Activar <span className="font-bold text-[#70422B]">"PANTALLA COMPLETA"</span>
              </span>
            </div>

            {/* Botón Actualizar */}
            <button
              type="button"
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              className="p-1.5 bg-white text-gray-700 rounded-xl hover:text-[#4B2B1D] hover:bg-[#FFF8F3] border border-[#D7BBA6]/60 shadow-sm transition-all cursor-pointer shrink-0 disabled:opacity-60"
              title="Actualizar pantalla"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-[#4B2B1D]' : ''}`} />
            </button>

            {/* Botón Pantalla Completa */}
            <button
              type="button"
              onClick={toggleFullscreen}
              className="p-1.5 bg-[#9F4F2F] text-white rounded-xl hover:bg-[#8A4326] shadow-sm transition-all cursor-pointer shrink-0"
              title="Pantalla completa"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {readError && (
        <p role="alert" className="mb-2 shrink-0 rounded-lg bg-amber-50 p-2 text-sm text-amber-900">
          {readError}. Mostrando los últimos datos disponibles; pueden estar desactualizados.
        </p>
      )}

      {/* Contenedor de las dos Cards (Pedidos Recientes y Pedidos Listos) con máximo espacio vertical */}
      <div className="w-full grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4 flex-1 min-h-0 overflow-hidden">
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
