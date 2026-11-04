import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatearPrecio } from '@/utils/formatters';
import { obtenerImagenProducto } from '../utils/imagenesCafe';
import { obtenerRatingProducto } from '../utils/metricasProducto';
import { Star, Pencil, FileText, Trash2, Coffee } from 'lucide-react';

export default function ProductoCard({ producto, onEditar, onReceta, onEliminar }) {
  const [imagenError, setImagenError] = useState(false);
  const imagenUrl = obtenerImagenProducto(producto);
  const ratingCalculado = obtenerRatingProducto(producto);

  return (
    <Card className="overflow-hidden border border-primary/10 shadow-sm hover:shadow-md transition-all duration-200 bg-card rounded-2xl flex flex-col justify-between p-3 gap-3 group">
      {/* Contenedor de la Imagen */}
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-muted/40">
        {!imagenError ? (
          <img
            src={imagenUrl}
            alt={producto.nombre}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            onError={() => setImagenError(true)}
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-primary/40">
            <Coffee className="w-10 h-10 mb-1" />
            <span className="text-xs font-medium">Sin imagen</span>
          </div>
        )}

        {/* Acciones flotantes al hacer hover */}
        <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-background/80 backdrop-blur-xs p-1 rounded-lg shadow-xs">
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => onReceta(producto)}
            title="Ver / Editar Receta"
            className="text-primary hover:text-accent"
          >
            <FileText className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => onEditar(producto)}
            title="Editar Producto"
            className="text-primary hover:text-accent"
          >
            <Pencil className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => onEliminar(producto)}
            title="Eliminar Producto"
            className="text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Información del Producto */}
      <div className="flex flex-col gap-1.5 flex-1 justify-between">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-bold text-primary text-base leading-snug line-clamp-1" title={producto.nombre}>
            {producto.nombre}
          </h3>
          <span className="font-bold text-primary text-base whitespace-nowrap">
            {formatearPrecio(producto.precio_venta)}
          </span>
        </div>

        {/* Tag de Categoría */}
        <div>
          <Badge
            variant="secondary"
            className="bg-muted text-primary text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-md"
          >
            {producto.categoria_nombre || 'Sin Categoría'}
          </Badge>
        </div>

        {/* Estrellas de Calificación (Fiel al Mockup: doradas para activas, gris claro para inactivas) */}
        <div className="flex items-center gap-0.5 pt-0.5">
          {[1, 2, 3, 4, 5].map((estrella) => (
            <Star
              key={estrella}
              className={`w-3.5 h-3.5 ${
                estrella <= ratingCalculado
                  ? 'fill-amber-400 text-amber-400'
                  : 'text-muted-foreground/30'
              }`}
            />
          ))}
        </div>
      </div>
    </Card>
  );
}
