import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  XCircle,
  AlertTriangle,
  CheckCircle2,
  Bell,
  Footprints,
  Bike,
  RotateCw,
  AlertCircle,
  Eye,
  Check
} from 'lucide-react';
import { toast } from 'sonner';
import { inventarioService } from '@/services/inventarioService';
import { comandaService } from '@/services/comandaService';
import { pedidoService } from '@/services/pedidoService';
import { formatearPrecio, formatearIdPedido } from '@/utils/formatters';
import { ResumenPedidoModal } from './ResumenPedidoModal';
import { OrderPrintTicket } from '@/features/comandas/OrderPrintTicket';
import { formatCustomerName } from '@/features/clientes/CustomerViewerPage';

// Cálculo de días restantes hasta el vencimiento (idéntico a InventoryPage)
const getExpirationDiff = (expirationDateStr) => {
  if (!expirationDateStr) return Infinity;
  const expDate = new Date(expirationDateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
};

const isExpiringSoon = (expirationDateStr) => {
  const diff = getExpirationDiff(expirationDateStr);
  return diff >= 0 && diff <= 7;
};

const getBadgeEstado = (estado) => {
  const s = String(estado || '').toLowerCase().trim();
  switch (s) {
    case 'en_empaque':
    case 'en empaque':
      return 'bg-orange-100 text-orange-700';
    case 'en_preparacion':
    case 'en preparación':
    case 'en preparacion':
      return 'bg-yellow-100 text-yellow-700';
    case 'completado':
      return 'bg-emerald-100 text-emerald-700';
    case 'entregado':
      return 'bg-teal-100 text-teal-800';
    case 'cancelado':
      return 'bg-red-100 text-red-700';
    case 'pendiente':
    default:
      return 'bg-gray-100 text-gray-700';
  }
};

const formatEstadoNombre = (estado) => {
  const s = String(estado || '').toLowerCase().trim();
  if (s === 'en_empaque') return 'En empaque';
  if (s === 'en_preparacion' || s === 'en preparacion') return 'En preparación';
  if (s === 'completado') return 'Listo';
  if (s === 'entregado') return 'Entregado';
  if (s === 'cancelado') return 'Cancelado';
  if (s === 'pendiente') return 'Pendiente';
  return s.charAt(0).toUpperCase() + s.slice(1);
};

function TarjetaPedido({ pedido, onVerResumen, onMarcarEntregado, entregandoId }) {
  const isEntregando = entregandoId === pedido.id;
  const clienteFormateado = formatCustomerName(pedido.cliente || pedido.customer);

  return (
    <div className="bg-white border border-[#EAD5C8] rounded-xl p-3.5 space-y-2.5 hover:shadow-sm transition-shadow">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="font-extrabold text-[#4B2B1D] text-sm tracking-tight font-mono shrink-0">
            {formatearIdPedido(pedido)}
          </span>
          <span
            className="text-xs font-bold text-gray-800 truncate"
            title={pedido.cliente || pedido.customer || 'Consumidor Final'}
          >
            {clienteFormateado}
          </span>
          <span
            className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap shrink-0 ${getBadgeEstado(
              pedido.estado || pedido.status
            )}`}
          >
            {formatEstadoNombre(pedido.estado || pedido.status)}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="font-bold text-gray-900 text-sm whitespace-nowrap">
            {formatearPrecio(pedido.total)}
          </span>

          <button
            type="button"
            disabled={isEntregando}
            onClick={() => onMarcarEntregado && onMarcarEntregado(pedido)}
            title="Pedido Entregado"
            className="p-1 rounded-lg text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 transition-colors cursor-pointer disabled:opacity-50 shrink-0"
          >
            {isEntregando ? (
              <span className="w-5 h-5 block border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
            ) : (
              <Check className="w-5 h-5 stroke-[2.5]" />
            )}
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={() => onVerResumen && onVerResumen(pedido)}
        className="w-full py-1.5 px-3 border border-[#D1B8A5] hover:border-[#8C6D58] hover:bg-[#F3E5DC]/30 text-[#70422B] rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
      >
        <Eye className="w-3.5 h-3.5" />
        <span>Ver Resumen</span>
      </button>
    </div>
  );
}

export default function Home() {
  const [insumos, setInsumos] = useState([]);
  const [comandas, setComandas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const [entregandoId, setEntregandoId] = useState(null);

  const handleMarcarEntregado = async (pedido) => {
    if (!pedido || !pedido.id) return;
    setEntregandoId(pedido.id);
    try {
      await comandaService.entregar(pedido.id);
      setComandas((prev) => prev.filter((p) => p.id !== pedido.id));
      try {
        const saved = localStorage.getItem('nextbyte_orders');
        if (saved) {
          const parsed = JSON.parse(saved);
          const filtered = parsed.filter((p) => String(p.id) !== String(pedido.id));
          localStorage.setItem('nextbyte_orders', JSON.stringify(filtered));
        }
      } catch {}
      window.dispatchEvent(new CustomEvent('orders-updated'));
      toast.success(`Pedido ${formatearIdPedido(pedido)} marcado como entregado`);
    } catch (err) {
      console.error('Error al entregar pedido:', err);
      toast.error('No se pudo marcar el pedido como entregado');
      await cargarDatos();
    } finally {
      setEntregandoId(null);
    }
  };

  // Estados para el Modal de Resumen e Impresión de Comanda
  const [pedidoResumen, setPedidoResumen] = useState(null);
  const [modalResumenAbierto, setModalResumenAbierto] = useState(false);
  const [ticketAImprimir, setTicketAImprimir] = useState(null);

  const handleVerResumen = (pedido) => {
    setPedidoResumen(pedido);
    setModalResumenAbierto(true);
  };

  const handleCerrarResumen = () => {
    setModalResumenAbierto(false);
    setPedidoResumen(null);
  };

  const handleImprimirComanda = () => {
    if (!pedidoResumen) return;
    setTicketAImprimir(pedidoResumen);
    setTimeout(() => {
      window.print();
      setTimeout(() => {
        setTicketAImprimir(null);
      }, 500);
    }, 80);
  };

  // Cancelar pedido completo desde el modal
  const handleCancelarPedido = async (pedido) => {
    if (!pedido) return;

    // 1. Confirmar si desea eliminar el pedido
    const confirma = window.confirm('¿Confirma que desea eliminar el pedido?');
    if (!confirma) return;

    // 2. Preguntar si se registra como MERMA o vuelve al stock de productos
    const esMerma = window.confirm(
      '¿Desea registrar los productos de este pedido como MERMA (Aceptar) o RESTAURAR el stock de productos (Cancelar)?\n\nAceptar = Es Merma (no vuelve al stock de productos)\nCancelar = Vuelve al stock de productos'
    );

    try {
      // Cancelar pedido en backend pasando si los productos son MERMA
      await pedidoService.cancelar(pedido.id, { esMerma: Boolean(esMerma), motivo: 'MERMA' });

      toast.success(esMerma ? 'Pedido cancelado y registrado en Mermas' : 'Pedido cancelado y restaurado en stock de productos');
      handleCerrarResumen();
      await cargarDatos();
    } catch (err) {
      console.error('Error al cancelar el pedido:', err);
      toast.error('No se pudo cancelar el pedido');
    }
  };

  // Cancelar/eliminar un ítem individual del pedido
  const handleEliminarItem = async (pedido, item) => {
    if (!pedido || !item) return;

    // 1. Confirmar si desea eliminar el pedido (ítem del pedido)
    const confirma = window.confirm('¿Confirma que desea eliminar el pedido?');
    if (!confirma) return;

    // 2. Preguntar si va a merma o regresa al stock de productos
    const esMerma = window.confirm(
      '¿Desea registrar este producto como MERMA (Aceptar) o RESTAURAR el stock de productos (Cancelar)?\n\nAceptar = Es Merma (no vuelve al stock de productos)\nCancelar = Vuelve al stock de productos'
    );

    try {
      if (item.id) {
        await pedidoService.eliminarItem(pedido.id, item.id, { esMerma: Boolean(esMerma), motivo: 'MERMA' });
        toast.success(esMerma ? `Artículo "${item.nombre_producto || item.name || 'Producto'}" eliminado y registrado en Mermas` : `Artículo "${item.nombre_producto || item.name || 'Producto'}" eliminado`);
      }

      // Actualizar vista local
      const itemsActuales = pedido.detalles || pedido.items || [];
      if (itemsActuales.length <= 1) {
        handleCerrarResumen();
      } else {
        const restantes = itemsActuales.filter((it) => it.id !== item.id);
        const nuevoTotal = restantes.reduce((acc, it) => {
          const c = Number(it.cantidad || it.quantity || 1);
          const p = Number(it.precio_venta || it.price || 0);
          return acc + (c * p);
        }, 0);

        setPedidoResumen((prev) => (prev ? {
          ...prev,
          detalles: restantes,
          items: restantes,
          total: nuevoTotal
        } : null));
      }

      await cargarDatos();
    } catch (err) {
      console.error('Error al eliminar ítem del pedido:', err);
      toast.error('No se pudo eliminar el artículo');
    }
  };

  const orderParaTicket = useMemo(() => {
    if (!ticketAImprimir) return null;
    const items = (ticketAImprimir.detalles || ticketAImprimir.items || []).map((det, idx) => ({
      id: det.id || idx,
      quantity: Number(det.cantidad ?? det.quantity ?? 1),
      name: det.nombre_producto || det.name || 'Producto',
      price: Number(det.precio_venta ?? det.price ?? 0)
    }));

    return {
      ...ticketAImprimir,
      displayId: formatearIdPedido(ticketAImprimir),
      customer: ticketAImprimir.cliente || ticketAImprimir.customer || 'Consumidor Final',
      orderType: ticketAImprimir.tipo_pedido || ticketAImprimir.orderType || 'Mostrador',
      paymentMethod: ticketAImprimir.metodo_pago || ticketAImprimir.paymentMethod || 'Efectivo',
      date: ticketAImprimir.fecha,
      time: ticketAImprimir.hora,
      total: Number(ticketAImprimir.total || 0),
      items
    };
  }, [ticketAImprimir]);

  const cargarDatos = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const [resInsumos, resComandas] = await Promise.allSettled([
        inventarioService.obtenerInsumos(),
        comandaService.obtenerActivas({ incluir_completados: true })
      ]);

      if (resInsumos.status === 'fulfilled') {
        const rawInsumos = resInsumos.value;
        const listaInsumos = Array.isArray(rawInsumos)
          ? rawInsumos
          : rawInsumos?.data || [];
        setInsumos(listaInsumos);
      } else {
        console.error('Error al cargar insumos:', resInsumos.reason);
      }

      if (resComandas.status === 'fulfilled') {
        const rawComandas = resComandas.value;
        const listaComandas = Array.isArray(rawComandas)
          ? rawComandas
          : rawComandas?.data || [];
        setComandas(listaComandas);
      } else {
        console.error('Error al cargar comandas activas:', resComandas.reason);
      }
    } catch (err) {
      console.error('Error general al cargar panel:', err);
      setError(err.message || 'No se pudieron cargar los datos del panel.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarDatos();

    const handleSync = () => {
      cargarDatos();
    };

    window.addEventListener('orders-updated', handleSync);
    window.addEventListener('storage', handleSync);
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        cargarDatos();
      }
    }, 5000);

    return () => {
      window.removeEventListener('orders-updated', handleSync);
      window.removeEventListener('storage', handleSync);
      clearInterval(interval);
    };
  }, [cargarDatos]);

  // Cálculos de Stock / Insumos para las 4 Tarjetas (sincronizado con InventoryPage)
  const metricasStock = useMemo(() => {
    let agotadosCriticos = 0;
    let bajoMinimo = 0;
    let proximosVencimientos = 0;
    let saludables = 0;

    for (const i of insumos) {
      const qty = Number(i.cantidad_disponible) || 0;
      const min = Number(i.stock_minimo) || 0;

      if (qty === 0) {
        agotadosCriticos += 1;
      } else if (qty <= min) {
        bajoMinimo += 1;
      } else {
        saludables += 1;
      }

      if (isExpiringSoon(i.fecha_vencimiento)) {
        proximosVencimientos += 1;
      }
    }

    return {
      agotadosCriticos,
      bajoMinimo,
      proximosVencimientos,
      saludables
    };
  }, [insumos]);

  // Categorización de Comandas Activas en 3 Columnas
  const pedidosPorCanal = useMemo(() => {
    const mostrador = [];
    const takeAway = [];
    const delivery = [];

    for (const p of comandas) {
      const canal = String(p.tipo_pedido || p.orderType || '').toLowerCase().trim();

      if (canal === 'mostrador' || canal === 'salon' || canal === 'salón' || canal === 'mesa') {
        mostrador.push(p);
      } else if (canal === 'take_away' || canal === 'take away' || canal === 'takeaway' || canal.includes('llevar')) {
        takeAway.push(p);
      } else if (canal === 'delivery' || canal.includes('envio') || canal.includes('envío')) {
        delivery.push(p);
      } else {
        // Fallback por defecto a mostrador si no especifica
        mostrador.push(p);
      }
    }

    return {
      mostrador,
      takeAway,
      delivery
    };
  }, [comandas]);

  if (cargando) {
    return (
      <div className="py-24 flex flex-col items-center justify-center text-primary gap-3">
        <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-semibold">Cargando panel de control...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 max-w-lg mx-auto bg-white rounded-2xl border border-border/30 shadow-sm text-center space-y-4">
        <AlertCircle className="w-10 h-10 text-destructive mx-auto" />
        <div>
          <h3 className="font-semibold text-primary text-base">Error al cargar el panel</h3>
          <p className="text-xs text-muted-foreground mt-1">{error}</p>
        </div>
        <button
          onClick={cargarDatos}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-xs font-medium rounded-lg hover:opacity-90 transition-opacity"
        >
          <RotateCw className="w-3.5 h-3.5" />
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-6">

      {/* SECCIÓN SUPERIOR: 4 Tarjetas de Métricas de Insumos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">

        {/* 1. Stock Agotado / Crítico */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-border/20 border-l-4 border-l-red-500 flex flex-col justify-between min-h-[110px]">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold">
            <XCircle className="w-4 h-4 text-red-500 shrink-0" />
            <span className="text-gray-600">Stock Agotado / Crítico</span>
          </div>
          <div className="my-1.5">
            <span className="text-2xl font-extrabold text-red-600 tracking-tight">
              {metricasStock.agotadosCriticos} Insumos
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground font-medium">
            Requiere compra inmediata
          </p>
        </div>

        {/* 2. Stock Bajo Mínimo */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-border/20 border-l-4 border-l-amber-500 flex flex-col justify-between min-h-[110px]">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
            <span className="text-gray-600">Stock Bajo Mínimo</span>
          </div>
          <div className="my-1.5">
            <span className="text-2xl font-extrabold text-amber-500 tracking-tight">
              {metricasStock.bajoMinimo} Insumos
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground font-medium">
            Planificar próxima compra
          </p>
        </div>

        {/* 3. Próximos Vencimientos */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-border/20 border-l-4 border-l-orange-500 flex flex-col justify-between min-h-[110px]">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold">
            <AlertTriangle className="w-4 h-4 text-orange-500 shrink-0" />
            <span className="text-gray-600">Próximos Vencimientos</span>
          </div>
          <div className="my-1.5">
            <span className="text-2xl font-extrabold text-orange-600 tracking-tight">
              {metricasStock.proximosVencimientos} Insumos
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground font-medium">
            Verificar insumos
          </p>
        </div>

        {/* 4. Stock Saludable */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-border/20 border-l-4 border-l-emerald-500 flex flex-col justify-between min-h-[110px]">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <span className="text-gray-600">Stock Saludable</span>
          </div>
          <div className="my-1.5">
            <span className="text-2xl font-extrabold text-emerald-600 tracking-tight">
              {metricasStock.saludables} Insumos
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground font-medium">
            Niveles óptimos
          </p>
        </div>

      </div>

      {/* SECCIÓN INFERIOR: 3 Columnas de Pedidos Activos por Canal */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

        {/* COLUMNA 1: Mostrador */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-border/20 flex flex-col min-h-[480px]">
          <div className="flex items-center gap-2 pb-4 border-b border-border/10 mb-4">
            <span className="text-lg leading-none" role="img" aria-label="Campana Mostrador">
              🛎️
            </span>
            <h3 className="text-base font-bold text-primary tracking-tight">Mostrador</h3>
            {pedidosPorCanal.mostrador.length > 0 && (
              <span className="ml-auto text-xs font-bold text-primary bg-muted/30 px-2 py-0.5 rounded-full">
                {pedidosPorCanal.mostrador.length}
              </span>
            )}
          </div>

          {pedidosPorCanal.mostrador.length === 0 ? (
            <div className="flex-1 flex items-center justify-center py-20">
              <p className="text-sm text-muted-foreground/60 font-medium">No hay pedidos.</p>
            </div>
          ) : (
            <div className="space-y-3 overflow-y-auto max-h-[580px] pr-1">
              {pedidosPorCanal.mostrador.map((p) => (
                <TarjetaPedido key={p.id} pedido={p} onVerResumen={handleVerResumen} onMarcarEntregado={handleMarcarEntregado} entregandoId={entregandoId} />
              ))}
            </div>
          )}
        </div>

        {/* COLUMNA 2: Take away */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-border/20 flex flex-col min-h-[480px]">
          <div className="flex items-center gap-2 pb-4 border-b border-border/10 mb-4">
            <span className="text-lg leading-none" role="img" aria-label="Take away">
              🏃
            </span>
            <h3 className="text-base font-bold text-primary tracking-tight">Take away</h3>
            {pedidosPorCanal.takeAway.length > 0 && (
              <span className="ml-auto text-xs font-bold text-primary bg-muted/30 px-2 py-0.5 rounded-full">
                {pedidosPorCanal.takeAway.length}
              </span>
            )}
          </div>

          {pedidosPorCanal.takeAway.length === 0 ? (
            <div className="flex-1 flex items-center justify-center py-20">
              <p className="text-sm text-muted-foreground/60 font-medium">No hay pedidos.</p>
            </div>
          ) : (
            <div className="space-y-3 overflow-y-auto max-h-[580px] pr-1">
              {pedidosPorCanal.takeAway.map((p) => (
                <TarjetaPedido key={p.id} pedido={p} onVerResumen={handleVerResumen} onMarcarEntregado={handleMarcarEntregado} entregandoId={entregandoId} />
              ))}
            </div>
          )}
        </div>

        {/* COLUMNA 3: Delivery */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-border/20 flex flex-col min-h-[480px]">
          <div className="flex items-center gap-2 pb-4 border-b border-border/10 mb-4">
            <span className="text-lg leading-none" role="img" aria-label="Delivery">
              🛵
            </span>
            <h3 className="text-base font-bold text-primary tracking-tight">Delivery</h3>
            {pedidosPorCanal.delivery.length > 0 && (
              <span className="ml-auto text-xs font-bold text-primary bg-muted/30 px-2 py-0.5 rounded-full">
                {pedidosPorCanal.delivery.length}
              </span>
            )}
          </div>

          {pedidosPorCanal.delivery.length === 0 ? (
            <div className="flex-1 flex items-center justify-center py-20">
              <p className="text-sm text-muted-foreground/60 font-medium">No hay pedidos.</p>
            </div>
          ) : (
            <div className="space-y-3 overflow-y-auto max-h-[580px] pr-1">
              {pedidosPorCanal.delivery.map((p) => (
                <TarjetaPedido key={p.id} pedido={p} onVerResumen={handleVerResumen} onMarcarEntregado={handleMarcarEntregado} entregandoId={entregandoId} />
              ))}
            </div>
          )}
        </div>

      </div>

      {/* Modal Resumen del Pedido */}
      <ResumenPedidoModal
        abierto={modalResumenAbierto}
        pedido={pedidoResumen}
        alCerrar={handleCerrarResumen}
        alImprimir={handleImprimirComanda}
        alCancelar={handleCancelarPedido}
        alEliminarItem={handleEliminarItem}
      />

      {/* Ticket de Impresión para PrintPortal */}
      {ticketAImprimir && <OrderPrintTicket order={orderParaTicket} />}

    </div>
  );
}
