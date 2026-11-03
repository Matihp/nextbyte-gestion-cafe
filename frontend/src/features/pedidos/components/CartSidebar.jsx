import { ShoppingCart, Plus, Minus, Trash2, CheckCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatearPrecio } from '@/utils/formatters';

export function CartSidebar({
  cart,
  totalCart,
  step,
  customerName,
  onUpdateQuantity,
  onRemoveProduct,
  onContinue,
  onSendOrder,
  cargando,
}) {
  return (
    <div className="w-full lg:w-[320px] shrink-0 bg-white rounded-2xl flex flex-col shadow-md border border-gray-100 overflow-hidden h-full min-h-0">
      <div className="p-5 bg-primary text-primary-foreground shrink-0">
        <div className="flex items-center gap-3">
          <ShoppingCart className="w-6 h-6" />
          <h2 className="text-xl font-bold tracking-tight">Pedido Actual</h2>
        </div>
        {customerName && step === 'ready' && (
          <div className="mt-2.5 flex items-center gap-2 bg-white/20 px-3 py-1.5 rounded-lg">
            <span className="text-xs font-medium">Cliente:</span>
            <span className="text-sm font-semibold truncate">{customerName}</span>
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3 custom-scrollbar">
        {cart.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-3 py-8">
            <ShoppingCart className="w-14 h-14 opacity-20" />
            <p className="text-sm font-medium">El pedido está vacío</p>
          </div>
        ) : (
          cart.map((item) => (
            <div
              key={item.id}
              className="flex flex-col p-3 border border-gray-100 bg-gray-50 rounded-xl gap-2.5 shadow-2xs"
            >
              <div className="flex justify-between items-start gap-2">
                <span className="font-bold text-gray-800 text-sm leading-snug">
                  {item.name}
                </span>
                <span className="font-semibold text-secondary text-sm shrink-0">
                  {formatearPrecio(item.price * item.quantity)}
                </span>
              </div>

              <div className="flex items-center justify-between">
                {/* Control de cantidad */}
                <div className="flex items-center bg-white rounded-lg border border-gray-200 shadow-xs overflow-hidden">
                  <button
                    type="button"
                    onClick={() => onUpdateQuantity(item.productId, -1)}
                    className="p-1.5 hover:bg-gray-100 text-gray-600 transition-colors cursor-pointer"
                    title="Disminuir cantidad"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="w-8 text-center font-medium text-sm">
                    {item.quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => onUpdateQuantity(item.productId, 1)}
                    className="p-1.5 hover:bg-gray-100 text-gray-600 transition-colors cursor-pointer"
                    title="Aumentar cantidad"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => onRemoveProduct(item.productId)}
                  className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                  title="Eliminar producto del pedido"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="p-5 bg-white border-t border-gray-200 shrink-0">
        <div className="flex justify-between items-center mb-4">
          <span className="text-base text-gray-600 font-medium">Total</span>
          <span className="text-2xl font-bold text-primary">
            {formatearPrecio(totalCart)}
          </span>
        </div>

        {step === 'building' ? (
          <Button
            type="button"
            onClick={onContinue}
            disabled={cart.length === 0}
            className="w-full py-3.5 h-auto bg-secondary text-secondary-foreground rounded-xl font-bold text-base hover:bg-secondary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md flex items-center justify-center gap-2 cursor-pointer"
          >
            Continuar
          </Button>
        ) : (
          <Button
            type="button"
            onClick={onSendOrder}
            disabled={cargando}
            className="w-full py-3.5 h-auto bg-emerald-600 text-white rounded-xl font-bold text-base hover:bg-emerald-700 transition-colors shadow-md flex items-center justify-center gap-2 animate-pulse disabled:opacity-50 cursor-pointer"
          >
            {cargando ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Despachando...</span>
              </>
            ) : (
              <>
                <CheckCircle className="w-5 h-5" />
                <span>Enviar Comanda</span>
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

export default CartSidebar;
