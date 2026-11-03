import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatearPrecio } from '@/utils/formatters';
import { Search, Pencil, Trash2 } from 'lucide-react';

export default function ProductosModalEditarEliminar({
  open,
  onOpenChange,
  productos = [],
  onEditarProducto,
  onEliminarProducto
}) {
  const [filtro, setFiltro] = useState('');

  const productosFiltrados = productos.filter((p) =>
    (p.nombre || '').toLowerCase().includes(filtro.toLowerCase().trim()) ||
    (p.categoria_nombre || '').toLowerCase().includes(filtro.toLowerCase().trim())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card border-primary/20 text-card-foreground rounded-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-1">
          <DialogTitle className="text-xl font-bold text-primary tracking-tight">
            Editar / Eliminar Producto
          </DialogTitle>
        </DialogHeader>

        {/* Buscador de productos */}
        <div className="relative pt-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/40 pointer-events-none mt-0.5" />
          <Input
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            placeholder="Buscar producto a modificar o eliminar..."
            className="pl-9 h-10 bg-background/50 border-primary/20 text-primary text-xs placeholder:text-primary/40 rounded-xl"
          />
        </div>

        {/* Lista de productos */}
        <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1 py-1">
          {productosFiltrados.length === 0 ? (
            <p className="text-xs text-primary/50 text-center py-6">
              No se encontraron productos coincidentes.
            </p>
          ) : (
            productosFiltrados.map((producto) => (
              <div
                key={producto.id}
                className="flex items-center justify-between px-4 py-3 rounded-2xl border border-primary/10 bg-background/50 hover:bg-background/80 transition-colors shadow-2xs"
              >
                <div className="flex flex-col">
                  <span className="font-semibold text-sm text-primary">{producto.nombre}</span>
                  <div className="flex items-center gap-2 text-xs text-primary/60">
                    <span>{producto.categoria_nombre || 'Sin categoría'}</span>
                    <span>•</span>
                    <span className="font-bold text-primary">{formatearPrecio(producto.precio_venta)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      onOpenChange(false);
                      onEditarProducto(producto);
                    }}
                    title="Editar producto"
                    className="p-1 rounded-md text-primary/60 hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onOpenChange(false);
                      onEliminarProducto(producto);
                    }}
                    title="Eliminar producto"
                    className="p-1 rounded-md text-primary/60 hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <DialogFooter className="pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="w-full h-11 bg-muted/60 border-transparent text-primary hover:bg-muted font-medium rounded-xl"
          >
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

