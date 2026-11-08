import { Plus, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { formatearPrecio } from '@/utils/formatters';
import { obtenerImagenProducto } from '@/features/menu/utils/imagenesCafe';

const FALLBACK_PRODUCT_IMAGE =
  'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=500&auto=format&fit=crop&q=80';

export function ProductCard({ product, onAddToCart }) {
  const stock = Number(product.stock_actual ?? product.stock ?? 0);
  const price = Number(product.precio_venta ?? product.price ?? 0);
  const name = product.nombre || product.name || '';
  const imageUrl = obtenerImagenProducto(product) || product.imagen || product.image || FALLBACK_PRODUCT_IMAGE;

  const getProductStockStatus = () => {
    if (stock <= 0) return { status: 'agotado', msg: 'AGOTADO' };
    if (stock <= 5) return { status: 'critico', msg: 'Stock bajo' };
    return { status: 'ok', msg: '' };
  };

  const stockStatus = getProductStockStatus();
  const isAgotado = stockStatus.status === 'agotado';

  const handleClick = () => {
    if (isAgotado) {
      toast.error(`El producto "${name}" se encuentra agotado`);
      return;
    }
    onAddToCart(product);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`group bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-xs transition-all text-left flex flex-col h-full transform ${
        isAgotado
          ? 'opacity-60 cursor-not-allowed'
          : 'hover:-translate-y-1 hover:shadow-lg cursor-pointer'
      }`}
    >
      <div className="aspect-4/3 w-full overflow-hidden bg-gray-100 relative">
        <img
          src={imageUrl}
          alt={name}
          className={`w-full h-full object-cover transition-transform duration-500 ${
            !isAgotado ? 'group-hover:scale-105' : ''
          }`}
          onError={(e) => {
            if (e.currentTarget.src !== FALLBACK_PRODUCT_IMAGE) {
              e.currentTarget.src = FALLBACK_PRODUCT_IMAGE;
            }
          }}
        />

        {stockStatus.status === 'agotado' && (
          <div className="absolute inset-0 bg-white/60 flex items-center justify-center backdrop-blur-[1px]">
            <span className="bg-red-600 text-white px-3 py-1 rounded-full text-xs font-bold shadow-xs">
              {stockStatus.msg}
            </span>
          </div>
        )}

        {stockStatus.status === 'critico' && (
          <div className="absolute top-2 right-2 bg-orange-500 text-white px-2 py-0.5 rounded-full text-[10px] font-bold shadow-xs flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            {stockStatus.msg}
          </div>
        )}
      </div>

      <div className="p-3 flex flex-col flex-1">
        <h3 className="font-bold text-gray-800 mb-1 leading-tight text-sm">
          {name}
        </h3>
        <div className="mt-auto flex items-center justify-between">
          <span className="text-secondary font-semibold text-sm">
            {formatearPrecio(price)}
          </span>
          <div
            className={`w-6 h-6 rounded-full flex items-center justify-center transition-opacity ${
              isAgotado
                ? 'bg-gray-100 text-gray-400'
                : 'bg-background text-primary opacity-0 group-hover:opacity-100'
            }`}
          >
            <Plus className="w-4 h-4" />
          </div>
        </div>
      </div>
    </button>
  );
}

export default ProductCard;

