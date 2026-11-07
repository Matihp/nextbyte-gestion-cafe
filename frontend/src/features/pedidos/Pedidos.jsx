import { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { PackageOpen } from 'lucide-react';
import productoService from '@/services/productoService';
import pedidoService from '@/services/pedidoService';
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
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [cargandoDatos, setCargandoDatos] = useState(true);

  const [selectedCategoryId, setSelectedCategoryId] = useState('Todos');
  const [searchTerm, setSearchTerm] = useState('');

  const [cart, setCart] = useState([]);

  const [step, setStep] = useState('building');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [cargandoEnvio, setCargandoEnvio] = useState(false);

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
    } catch (error) {
      toast.error(error.message || 'Error al cargar productos y categorías desde el servidor');
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
    const max = getMaxStock(product);
    const existing = cart.find((item) => item.productId === product.id);
    const currentQty = existing ? existing.quantity : 0;

    if (currentQty + 1 > max) {
      toast.error(`No hay stock suficiente. Máximo disponible: ${max}`);
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
    const product = products.find((p) => p.id === productId);
    if (!product) return;
    const max = getMaxStock(product);

    setCart((prev) => {
      const existing = prev.find((item) => item.productId === productId);
      if (!existing) return prev;

      const newQty = existing.quantity + delta;
      if (newQty > max) {
        toast.error(`No hay stock suficiente. Máximo disponible: ${max}`);
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
    setCart((prev) => prev.filter((item) => item.productId !== productId));
    setStep('building');
  };

  const handleContinue = () => {
    if (cart.length === 0) return;
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

    try {
      setCargandoEnvio(true);
      setIsModalOpen(false);

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
      };

      const respuesta = await pedidoService.crear(payload);
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
        }),
      };

      setPrintPromptOrder(ordenParaTicket);

      cargarDatos();
    } catch (error) {
      toast.error(error.message || 'Error al enviar la comanda');
    } finally {
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
    <div className="flex flex-col lg:flex-row h-full min-h-0 w-full gap-6 overflow-hidden print:hidden">
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
                  <Skeleton className="w-full aspect-[4/3] rounded-xl" />
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
        onClose={() => setIsModalOpen(false)}
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
        <PrintPortal>
          <TicketPrintArea order={orderToPrint} />
        </PrintPortal>
      )}
    </div>
  );
}
