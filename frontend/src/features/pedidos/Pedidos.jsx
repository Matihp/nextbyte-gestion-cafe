import { useState, useEffect, useMemo, useRef } from 'react';
import { toast } from 'sonner';
import { PackageOpen } from 'lucide-react';
import productoService from '@/services/productoService';
import pedidoService, { preparePedidoSubmission, clearPedidoSubmission } from '@/services/pedidoService';
import { notifyOrdersUpdated } from '@/services/comandaService';
import { useAuth } from '@/hooks/useAuth';
import { normalizeText } from './utils/categoryDetails';
import CategoryFilterBar from './components/CategoryFilterBar';
import ProductCard from './components/ProductCard';
import CartSidebar from './components/CartSidebar';
import OrderSummaryModal from './components/OrderSummaryModal';
import PrintTicketModal from './components/PrintTicketModal';
import TicketPrintArea from './components/TicketPrintArea';
import PrintPortal from './components/PrintPortal';
import { Skeleton } from '@/components/ui/skeleton';

export default function Pedidos() {
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [cargandoDatos, setCargandoDatos] = useState(true);

  const [selectedCategoryId, setSelectedCategoryId] = useState('Todos');
  const [searchTerm, setSearchTerm] = useState('');

  const [cart, setCart] = useState([]);

  const [step, setStep] = useState('building');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [cargandoEnvio, setCargandoEnvio] = useState(false);
  const submittingRef = useRef(false);
  // El payload queda en memoria; solo digest, UUID y timestamp sobreviven al reload en esta pestaña.
  const submitAttemptRef = useRef(null);

  const [orderType, setOrderType] = useState('Mostrador');
  const [paymentMethod, setPaymentMethod] = useState('Efectivo');
  const [customPaymentMethod, setCustomPaymentMethod] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');

  const [printPromptOrder, setPrintPromptOrder] = useState(null);
  const [orderToPrint, setOrderToPrint] = useState(null);

  const cargarDatos = async () => {
    try {
      setCargandoDatos(true);
      const [prodsRes, catsRes] = await Promise.all([
        productoService.obtenerProductos(),
        productoService.obtenerCategorias(),
      ]);

      const prodsList = Array.isArray(prodsRes) ? prodsRes : [];
      const catsList = Array.isArray(catsRes) ? catsRes : [];

      setProducts(prodsList);
      setCategories(catsList);

      if (prodsList.length > 0) {
        try {
          localStorage.setItem('cached_productos', JSON.stringify(prodsList));
        } catch {}
      }
      if (catsList.length > 0) {
        try {
          localStorage.setItem('cached_categorias', JSON.stringify(catsList));
        } catch {}
      }
    } catch (error) {
      const cachedProds = localStorage.getItem('cached_productos');
      const cachedCats = localStorage.getItem('cached_categorias');
      if (cachedProds && cachedCats) {
        try {
          setProducts(JSON.parse(cachedProds));
          setCategories(JSON.parse(cachedCats));
        } catch {
          toast.error(error.message || 'Error al cargar productos y categorías desde el servidor');
        }
      } else {
        toast.error(error.message || 'Error al cargar productos y categorías desde el servidor');
      }
    } finally {
      setCargandoDatos(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const pCatId = String(p.categoria_id ?? p.categoryId ?? '');
      const matchCat =
        selectedCategoryId === 'Todos' || pCatId === String(selectedCategoryId);

      const pName = p.nombre || p.name || '';
      const matchSearch = normalizeText(pName).includes(normalizeText(searchTerm));

      return matchCat && matchSearch;
    });
  }, [products, selectedCategoryId, searchTerm]);

  const totalCart = useMemo(() => {
    return cart.reduce((acc, item) => acc + item.price * item.quantity, 0);
  }, [cart]);

  const getMaxStock = (product) => {
    return Number(product.stock_actual ?? product.stock ?? 0);
  };

  const addToCart = (product) => {
    if (submittingRef.current) return;
    const max = getMaxStock(product);
    if (max <= 0) {
      toast.error(`El producto "${product.nombre || product.name}" está agotado`);
      return;
    }
    const existing = cart.find((item) => item.productId === product.id);
    const currentQty = existing ? existing.quantity : 0;

    if (currentQty + 1 > max) {
      toast.error(`No hay productos suficientes de "${product.nombre || product.name}". Solo hay ${max} disponibles.`);
      return;
    }

    setCart((prev) => {
      if (existing) {
        return prev.map((item) =>
          item.productId === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }

      const prodPrice = Number(product.precio_venta ?? product.price ?? 0);
      const prodCost = Number(product.precio_costo ?? product.costPrice ?? prodPrice);

      return [
        ...prev,
        {
          id: `item-${Date.now()}-${product.id}`,
          productId: product.id,
          name: product.nombre || product.name,
          price: prodPrice,
          costPrice: prodCost,
          quantity: 1,
        },
      ];
    });

    setStep('building');
  };

  const updateQuantity = (productId, delta) => {
    if (submittingRef.current) return;
    const product = products.find((p) => p.id === productId);
    if (!product) return;
    const max = getMaxStock(product);

    setCart((prev) => {
      const existing = prev.find((item) => item.productId === productId);
      if (!existing) return prev;

      const newQty = existing.quantity + delta;
      if (newQty > max) {
        toast.error(`No hay productos suficientes de "${product.nombre || product.name}". Solo hay ${max} disponibles.`);
        return prev;
      }

      if (newQty <= 0) {
        return prev.filter((item) => item.productId !== productId);
      }

      return prev.map((item) =>
        item.productId === productId ? { ...item, quantity: newQty } : item
      );
    });

    setStep('building');
  };

  const removeProduct = (productId) => {
    if (submittingRef.current) return;
    setCart((prev) => prev.filter((item) => item.productId !== productId));
    setStep('building');
  };

  const handleContinue = () => {
    if (submittingRef.current || cart.length === 0) return;
    setIsModalOpen(true);
  };

  const mapearTipoPedidoBackend = (tipo) => {
    if (tipo === 'Take away') return 'take_away';
    if (tipo === 'Delivery') return 'delivery';
    return 'salon';
  };

  const mapearMetodoPagoBackend = (metodo) => {
    switch (metodo) {
      case 'Tarjeta de Débito':
        return 'debito';
      case 'Tarjeta de Crédito':
        return 'credito';
      case 'Mercado Pago':
      case 'Transferencia':
        return 'mercadopago';
      case 'Efectivo':
      case 'Otros':
      default:
        return 'efectivo';
    }
  };

  const handleSendOrder = async () => {
    if (submittingRef.current) return;
    if (cart.length === 0) {
      toast.error('El carrito de compras está vacío');
      return;
    }

    if (!customerName.trim()) {
      toast.error('Debe ingresar el nombre del cliente');
      setIsModalOpen(true);
      return;
    }

    if (orderType === 'Delivery') {
      if (!address.trim()) {
        toast.error('La dirección es obligatoria para pedidos de delivery');
        setIsModalOpen(true);
        return;
      }
      if (!phone.trim()) {
        toast.error('El teléfono es obligatorio para pedidos de delivery');
        setIsModalOpen(true);
        return;
      }
    }

    const payload = {
      cliente: customerName.trim() || 'Consumidor Final',
      tipo_pedido: mapearTipoPedidoBackend(orderType),
      metodo_pago: mapearMetodoPagoBackend(paymentMethod),
      direccion: orderType !== 'Mostrador' && address.trim() ? address.trim() : null,
      telefono: orderType !== 'Mostrador' && phone.trim() ? phone.trim() : null,
      items: cart.map((item) => ({
        producto_id: Number(item.productId),
        cantidad: Number(item.quantity),
      })),
      estado: 'en_preparacion'
    };

    submittingRef.current = true;
    try {
      setCargandoEnvio(true);
      setIsModalOpen(false);
      const previousAttempt = submitAttemptRef.current;
      const attempt = await preparePedidoSubmission(payload, previousAttempt, {
        namespace: user?.id != null ? `user:${user.id}` : undefined
      });
      submitAttemptRef.current = attempt;
      const isRetry = attempt === previousAttempt || attempt.restored;
      if (attempt.restored) {
        const confirmed = window.confirm('Existe un envío anterior con estos mismos datos en esta pestaña. Puede haber sido creado aunque no recibieras respuesta. ¿Querés reintentar usando la misma clave para recuperar ese pedido sin duplicarlo?');
        if (!confirmed) return;
        attempt.restored = false;
      }
      // Un replay puede tener stock ya descontado: debe decidirlo el backend, no la caché.
      if (!isRetry) {
        for (const item of cart) {
          const prod = products.find((p) => p.id === item.productId);
          const max = prod ? getMaxStock(prod) : 0;
          if (item.quantity > max) {
            clearPedidoSubmission(attempt);
            submitAttemptRef.current = null;
            toast.error(`No hay productos suficientes de "${item.name}". Solo hay ${max} disponibles.`);
            return;
          }
        }
      }
      const respuesta = attempt.confirmedResponse || await pedidoService.crear(attempt.payload, { idempotencyKey: attempt.idempotencyKey });
      if (!respuesta?.id) {
        throw new Error('El servidor no confirmó el pedido. Reintentá sin modificar el carrito para consultar el mismo envío.');
      }
      // Si storage falla al limpiar, un nuevo clic solo finaliza la confirmación, nunca repite el POST.
      attempt.confirmedResponse = respuesta;
      clearPedidoSubmission(attempt);
      notifyOrdersUpdated();
      const pedidoDisplayId = respuesta?.display_id || respuesta?.displayId || (respuesta?.numero_pedido ? `#${String(respuesta.numero_pedido).padStart(4, '0')}` : '#0001');

      toast.success(`Comanda enviada con éxito (${pedidoDisplayId})`);

      const ordenParaTicket = {
        id: respuesta?.id || pedidoDisplayId,
        displayId: pedidoDisplayId,
        display_id: pedidoDisplayId,
        numero_pedido: respuesta?.numero_pedido,
        customer: respuesta?.cliente || customerName.trim(),
        orderType,
        paymentMethod:
          paymentMethod === 'Otros'
            ? customPaymentMethod.trim() || 'Otros'
            : paymentMethod,
        items: respuesta?.detalles?.length
          ? respuesta.detalles.map((d) => ({
              id: d.id,
              name: d.nombre_producto,
              price: Number(d.precio_venta),
              quantity: Number(d.cantidad),
            }))
          : [...cart],
        total: Number(respuesta?.total ?? totalCart),
        address: respuesta?.direccion || (orderType !== 'Mostrador' ? address.trim() : ''),
        phone: respuesta?.telefono || (orderType !== 'Mostrador' ? phone.trim() : ''),
        date: respuesta?.fecha || new Date().toISOString().split('T')[0],
        time: respuesta?.hora || new Date().toLocaleTimeString('es-AR', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
          timeZone: 'America/Argentina/Buenos_Aires',
        }),
      };

      submitAttemptRef.current = null;
      setCart([]);
      setCustomerName('');
      setAddress('');
      setPhone('');
      setOrderType('Mostrador');
      setPaymentMethod('Efectivo');
      setCustomPaymentMethod('');
      setStep('building');
      setPrintPromptOrder(ordenParaTicket);

      await cargarDatos();
    } catch (error) {
      const message = error.response?.data?.message || error.message || 'Error al enviar la comanda';
      toast.error(submitAttemptRef.current?.confirmedResponse
        ? `El pedido ya está confirmado. No lo envíes como un pedido nuevo. ${message}`
        : message);
    } finally {
      submittingRef.current = false;
      setCargandoEnvio(false);
    }
  };

  const handleConfirmPrint = () => {
    if (!printPromptOrder) return;

    setOrderToPrint(printPromptOrder);
    setPrintPromptOrder(null);

    setTimeout(() => {
      window.print();
      setOrderToPrint(null);
      resetForm();
    }, 500);
  };

  const handleCancelPrint = () => {
    setPrintPromptOrder(null);
    resetForm();
  };

  const resetForm = () => {
    setCart([]);
    setCustomerName('');
    setOrderType('Mostrador');
    setPaymentMethod('Efectivo');
    setCustomPaymentMethod('');
    setAddress('');
    setPhone('');
    setStep('building');
  };

  return (
    <div aria-busy={cargandoEnvio} className="flex flex-col lg:flex-row h-full min-h-0 w-full gap-6 overflow-hidden print:hidden">
      <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden">
        <div className="shrink-0">
          <CategoryFilterBar
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            categories={categories}
            selectedCategoryId={selectedCategoryId}
            setSelectedCategoryId={setSelectedCategoryId}
          />
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto pr-2 pb-2 custom-scrollbar">
          {cargandoDatos ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="flex flex-col gap-2 p-3 bg-white rounded-2xl border border-gray-100">
                  <Skeleton className="w-full aspect-4/3 rounded-xl" />
                  <Skeleton className="h-4 w-3/4 mt-2" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ))}
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center bg-white rounded-2xl border border-gray-100 p-12 text-center shadow-xs">
              <PackageOpen className="w-16 h-16 text-muted-foreground/40 mb-4" />
              <h3 className="text-lg font-bold text-gray-800 mb-1">
                {products.length === 0
                  ? 'No hay productos registrados en el sistema'
                  : 'No se encontraron productos para esta búsqueda'}
              </h3>
              <p className="text-sm text-gray-500 max-w-sm">
                {products.length === 0
                  ? 'Cargue productos en la sección Productos para comenzar a tomar pedidos.'
                  : 'Intente buscar con otro nombre o seleccione otra categoría.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2">
              {filteredProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onAddToCart={addToCart}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <CartSidebar
        cart={cart}
        totalCart={totalCart}
        step={step}
        customerName={customerName}
        onUpdateQuantity={updateQuantity}
        onRemoveProduct={removeProduct}
        onContinue={handleContinue}
        onSendOrder={handleSendOrder}
        cargando={cargandoEnvio}
      />

      <OrderSummaryModal
        open={isModalOpen}
        onClose={() => {
          if (!submittingRef.current) setIsModalOpen(false);
        }}
        cart={cart}
        totalCart={totalCart}
        orderType={orderType}
        setOrderType={setOrderType}
        paymentMethod={paymentMethod}
        setPaymentMethod={setPaymentMethod}
        customPaymentMethod={customPaymentMethod}
        setCustomPaymentMethod={setCustomPaymentMethod}
        customerName={customerName}
        setCustomerName={setCustomerName}
        address={address}
        setAddress={setAddress}
        phone={phone}
        setPhone={setPhone}
        onConfirmOrder={handleSendOrder}
        cargando={cargandoEnvio}
      />

      <PrintTicketModal
        order={printPromptOrder}
        open={Boolean(printPromptOrder)}
        onConfirmPrint={handleConfirmPrint}
        onCancel={handleCancelPrint}
      />

      {orderToPrint && (
        <PrintPortal pageType="ticket" className="ticket-termico">
          <TicketPrintArea order={orderToPrint} />
        </PrintPortal>
      )}
    </div>
  );
}
