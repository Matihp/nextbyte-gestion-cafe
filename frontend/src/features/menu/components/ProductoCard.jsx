import { Card } from '@/components/ui/card';
import ImageWithFallback from './ImageWithFallback';

export default function ProductoCard({ producto, tieneReceta = false, estrellas = 0, onEditar }) {
  const stock = Number(producto.stock_actual || 0);

  return (
    <Card
      onClick={() => onEditar && onEditar(producto)}
      className="bg-white rounded-xl shadow-xs overflow-hidden border border-gray-100 cursor-pointer hover:shadow-md transition-shadow flex flex-col p-0 gap-0"
    >
      <div className="relative w-full h-28">
        <ImageWithFallback
          src={producto.imagen}
          alt={producto.nombre}
          className={`w-full h-28 object-cover ${stock <= 0 ? 'opacity-60 grayscale-[50%]' : ''}`}
        />
        {stock <= 0 && (
          <div className="absolute inset-0 bg-white/60 flex items-center justify-center backdrop-blur-[1px]">
            <span className="bg-red-600 text-white px-3 py-1 rounded-full text-xs font-bold shadow-sm">
              AGOTADO
            </span>
          </div>
        )}
      </div>

      <div className="p-3 flex-1 flex flex-col">
        <div className="flex items-start justify-between mb-2 gap-2">
          <div className="min-w-0">
            <h3 className="text-base mb-1 font-bold leading-tight text-gray-900 truncate" title={producto.nombre}>
              {producto.nombre}
            </h3>
            <span className="inline-block px-2 py-0.5 bg-[#F3E5DC] text-[#4B2B1D] text-[10px] font-semibold rounded-full">
              {producto.categoria_nombre || 'Sin Categoría'}
            </span>
          </div>
          <p className="text-lg font-bold text-[#4B2B1D] shrink-0">
            ${Number(producto.precio_venta || 0).toFixed(2)}
          </p>
        </div>

        <div className="flex text-yellow-400 mt-auto border-t border-gray-100 pt-2">
          {[...Array(5)].map((_, i) => (
            <svg
              key={i}
              className={`w-3.5 h-3.5 ${
                i < estrellas ? 'fill-current' : 'text-gray-200 fill-current'
              }`}
              viewBox="0 0 20 20"
            >
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          ))}
        </div>

        {tieneReceta && (
          <p className="text-xs text-[#9F4F2F] mt-2 bg-[#F3E5DC] px-2 py-1 rounded inline-block font-medium self-start">
            Tiene receta asociada
          </p>
        )}
      </div>
    </Card>
  );
}
