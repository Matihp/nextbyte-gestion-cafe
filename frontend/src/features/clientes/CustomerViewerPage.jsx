import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Maximize2, Minimize2, X, ArrowLeft, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RecentOrders } from './RecentOrders';
import { CompletedOrders } from './CompletedOrders';
import { OrderDetailModal } from './OrderDetailModal';
import { comandaService } from '@/services/comandaService';
import { pedidoService } from '@/services/pedidoService';
import { normalizeStatusDisplay } from '@/features/comandas/OrdersPage';

export function CustomerViewerPage() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);

  // Carga de pedidos activos y actualizados desde el backend
  const fetchOrders = useCallback(async () => {
    try {
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
            price: Number(det.precio_venta ?? det.price ?? 0)
          }));

          const dateStr = o.fecha || (o.created_at ? o.created_at.split('T')[0] : '');
          const timeStr =
            o.hora ||
            (o.created_at
              ? new Date(o.created_at).toLocaleTimeString('es-AR', {
                  hour: '2-digit',
                  minute: '2-digit'
                })
              : '');

          return {
            id: String(o.id),
            customer: o.cliente || o.customer || 'Consumidor Final',
            total: Number(o.total || 0),
            status: normalizeStatusDisplay(o.estado || o.status),
            orderType: o.tipo_pedido || o.orderType || 'Salón',
            time: timeStr,
            date: dateStr,
            items
          };
        });

        setOrders(mapped);
      } else {
        // Fallback a localStorage si el backend no tiene pedidos o está desconectado
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

  // Carga inicial y sondeo periódico cada 6 segundos para actualización pasiva en salón
  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 6000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  // Manejo de pantalla completa
  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        setIsFullscreen(true);
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
          setIsFullscreen(false);
        }
      }
    } catch (err) {
      console.warn('Error al cambiar pantalla completa:', err);
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

  const handleClose = () => {
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
    navigate('/');
  };

  // Salir de pantalla completa con el botón superior central X
  const handleTopCenterClose = async () => {
    if (document.fullscreenElement) {
      if (document.exitFullscreen) {
        await document.exitFullscreen().catch(() => {});
      }
      setIsFullscreen(false);
    } else {
      handleClose();
    }
  };

  // Tecla Escape para salir del visor si no está en pantalla completa
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !document.fullscreenElement) {
        handleClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#F3E5DC] overflow-hidden select-none">
      {/* Botón superior central flotante (visible al pasar el mouse por arriba para salir de pantalla completa) */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 h-20 w-64 flex justify-center items-start pt-3 opacity-0 hover:opacity-100 transition-opacity z-50 pointer-events-none">
        <button
          type="button"
          onClick={handleTopCenterClose}
          className="p-2.5 bg-black/75 text-white rounded-full hover:bg-black transition-colors shadow-2xl cursor-pointer pointer-events-auto"
          title={isFullscreen ? 'Salir de pantalla completa' : 'Cerrar visor'}
        >
          <X className="w-7 h-7" />
        </button>
      </div>

      {/* Botones de esquinas: SOLO se muestran cuando NO está en pantalla completa */}
      {!isFullscreen && (
        <>
          {/* Botón flotante para volver al panel (superior izquierda) */}
          <div className="absolute top-5 left-5 z-40">
            <Button
              variant="outline"
              size="sm"
              onClick={handleClose}
              className="bg-white/95 hover:bg-white text-[#4B2B1D] border-[#D7BBA6] shadow-sm rounded-full px-4 py-2 text-xs font-semibold flex items-center gap-2 cursor-pointer transition-all hover:shadow"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Volver al Panel</span>
            </Button>
          </div>

          {/* Controles de la esquina superior derecha */}
          <div className="absolute top-5 right-5 z-40 flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setLoading(true);
                fetchOrders().finally(() => setTimeout(() => setLoading(false), 400));
              }}
              className="p-2.5 bg-white shadow-md text-gray-700 rounded-full hover:text-[#4B2B1D] transition-colors cursor-pointer hover:shadow-lg"
              title="Actualizar pedidos"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin text-[#9F4F2F]' : ''}`} />
            </button>

            <button
              type="button"
              onClick={toggleFullscreen}
              className="p-2.5 bg-white shadow-md text-gray-700 rounded-full hover:text-[#4B2B1D] transition-colors cursor-pointer hover:shadow-lg"
              title="Pantalla completa"
            >
              <Maximize2 className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={handleClose}
              className="p-2.5 bg-white shadow-md text-gray-700 rounded-full hover:text-red-700 transition-colors cursor-pointer hover:shadow-lg"
              title="Cerrar visor"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </>
      )}

      {/* Contenido principal: Título y las 2 columnas */}
      <div className="flex-1 p-6 md:p-8 lg:p-12 overflow-y-auto flex flex-col justify-start">
        <h1 className="text-3xl md:text-5xl font-bold text-center text-[#4B2B1D] mb-8 md:mb-12 tracking-tight">
          Estado de Pedidos
        </h1>

        <div className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 flex-1 pb-8">
          <div className="transform scale-100 lg:scale-[1.02] origin-top transition-transform h-full">
            <RecentOrders orders={orders} onSelectOrder={setSelectedOrder} />
          </div>

          <div className="transform scale-100 lg:scale-[1.02] origin-top transition-transform h-full">
            <CompletedOrders orders={orders} onSelectOrder={setSelectedOrder} />
          </div>
        </div>
      </div>

      {/* Modal emergente para ver detalles de pedido al hacer clic */}
      <OrderDetailModal
        order={selectedOrder}
        open={Boolean(selectedOrder)}
        onClose={() => setSelectedOrder(null)}
      />
    </div>
  );
}

export default CustomerViewerPage;

