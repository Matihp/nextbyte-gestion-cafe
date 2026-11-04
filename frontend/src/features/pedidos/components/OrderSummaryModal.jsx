import { X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatearPrecio } from '@/utils/formatters';

export function OrderSummaryModal({
  open,
  onClose,
  cart,
  totalCart,
  orderType,
  setOrderType,
  paymentMethod,
  setPaymentMethod,
  customPaymentMethod,
  setCustomPaymentMethod,
  customerName,
  setCustomerName,
  address,
  setAddress,
  phone,
  setPhone,
  onConfirmOrder,
  cargando = false,
}) {
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!customerName.trim() || cargando) return;
    onConfirmOrder();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen && !cargando) onClose(); }}>
      <DialogContent
        showCloseButton={false}
        className="w-full max-w-md p-0 rounded-2xl bg-white overflow-hidden shadow-2xl border-none max-h-[90vh] flex flex-col"
      >
        <div className="px-6 py-5 bg-primary text-primary-foreground flex justify-between items-center shrink-0">
          <DialogTitle className="text-2xl font-bold text-white tracking-tight">
            Resumen del Pedido
          </DialogTitle>
          <button
            type="button"
            onClick={onClose}
            disabled={cargando}
            className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors cursor-pointer disabled:opacity-50"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
          <div className="space-y-3">
            <div className="flex justify-between text-sm font-semibold text-gray-500 border-b border-gray-200 pb-2">
              <span>Cant x Producto</span>
              <span>Subtotal</span>
            </div>
            {cart.map((item) => (
              <div key={item.id} className="flex justify-between items-center text-sm">
                <div>
                  <span className="font-bold text-gray-800">{item.quantity}x</span>{' '}
                  <span className="text-gray-600">{item.name}</span>
                </div>
                <span className="font-medium text-gray-800">
                  {formatearPrecio(item.price * item.quantity)}
                </span>
              </div>
            ))}
          </div>

          <div className="flex justify-between items-center border-t border-dashed border-gray-300 pt-4">
            <span className="text-xl font-bold text-gray-800">Total a Pagar</span>
            <span className="text-3xl font-bold text-secondary">
              {formatearPrecio(totalCart)}
            </span>
          </div>

          <div className="pt-4 border-t border-gray-100 space-y-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Tipo de Pedido *
              </label>
              <select
                value={orderType}
                onChange={(e) => setOrderType(e.target.value)}
                disabled={cargando}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-secondary focus:border-secondary focus:outline-none transition-all text-base font-medium cursor-pointer"
              >
                <option value="Mostrador">Mostrador</option>
                <option value="Take away">Take away</option>
                <option value="Delivery">Delivery</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Medio de Pago *
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                disabled={cargando}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-secondary focus:border-secondary focus:outline-none transition-all text-base font-medium cursor-pointer"
              >
                <option value="Efectivo">Efectivo</option>
                <option value="Tarjeta de Débito">Tarjeta de Débito</option>
                <option value="Tarjeta de Crédito">Tarjeta de Crédito</option>
                <option value="Transferencia">Transferencia</option>
                <option value="Mercado Pago">Mercado Pago</option>
                <option value="Otros">Otros</option>
              </select>

              {paymentMethod === 'Otros' && (
                <div className="mt-3">
                  <Input
                    type="text"
                    placeholder="Especificar medio de pago..."
                    value={customPaymentMethod}
                    onChange={(e) => setCustomPaymentMethod(e.target.value)}
                    disabled={cargando}
                    className="w-full h-12 px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl focus-visible:ring-2 focus-visible:ring-secondary text-base"
                    required
                  />
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Nombre del Cliente *
              </label>
              <Input
                type="text"
                required
                autoFocus
                disabled={cargando}
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full h-12 px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl focus-visible:ring-2 focus-visible:ring-secondary text-base"
                placeholder="Ingrese el nombre para llamar al cliente"
              />
            </div>

            {orderType !== 'Mostrador' && (
              <>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    Dirección {orderType === 'Delivery' ? '*' : '(Opcional)'}
                  </label>
                  <Input
                    type="text"
                    required={orderType === 'Delivery'}
                    disabled={cargando}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full h-12 px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl focus-visible:ring-2 focus-visible:ring-secondary text-base"
                    placeholder="Ej. Calle Falsa 123"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    Teléfono {orderType === 'Delivery' ? '*' : '(Opcional)'}
                  </label>
                  <Input
                    type="text"
                    required={orderType === 'Delivery'}
                    disabled={cargando}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full h-12 px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl focus-visible:ring-2 focus-visible:ring-secondary text-base"
                    placeholder="Ej. 11-1234-5678"
                  />
                </div>
              </>
            )}
          </div>

          <div className="mt-4 flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              disabled={cargando}
              onClick={onClose}
              className="flex-1 py-4 h-auto text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl font-bold border-none transition-colors"
            >
              Volver
            </Button>
            <Button
              type="submit"
              disabled={cargando}
              className="flex-[2] py-4 h-auto bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl font-bold shadow-lg transition-colors text-lg disabled:opacity-50 cursor-pointer"
            >
              {cargando ? 'Guardando...' : 'Ordenar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default OrderSummaryModal;
