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
import { FileText, Search, Utensils } from 'lucide-react';

export default function RecetasGlobalModal({
  open,
  onOpenChange,
  productos = [],
  onSeleccionarProducto
}) {
  const [filtro, setFiltro] = useState('');

  const productosFiltrados = productos.filter((p) =>
    (p.nombre || '').toLowerCase().includes(filtro.toLowerCase().trim()) ||
    (p.categoria_nombre || '').toLowerCase().includes(filtro.toLowerCase().trim())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg bg-card border-primary/20 text-card-foreground">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-primary flex items-center gap-2">
            <FileText className="w-5 h-5 text-accent" />
            Recetario de Productos
          </DialogTitle>
        </DialogHeader>

        {/* Buscador de Producto para ver su Receta */}
        <div className="relative pt-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/40 pointer-events-none mt-0.5" />
          <Input
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            placeholder="Buscar producto para ver o editar receta..."
            className="pl-9 bg-background/50 border-primary/20 text-primary text-xs placeholder:text-primary/40 focus-visible:ring-primary/20"
          />
        </div>

        {/* Lista de Productos con Acceso a Receta */}
        <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1 mt-2">
          {productosFiltrados.length === 0 ? (
            <p className="text-sm text-primary/50 text-center py-6">
              No se encontraron productos coincidentes.
            </p>
          ) : (
            productosFiltrados.map((producto) => (
              <div
                key={producto.id}
                className="flex items-center justify-between p-2.5 rounded-xl border border-primary/10 bg-background/40 hover:bg-background/80 transition-colors"
              >
                <div className="flex flex-col">
                  <span className="font-semibold text-sm text-primary">{producto.nombre}</span>
                  <span className="text-[11px] text-primary/60">{producto.categoria_nombre || 'Sin categoría'}</span>
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    onOpenChange(false);
                    onSeleccionarProducto(producto);
                  }}
                  className="h-8 border-primary/20 text-primary hover:bg-primary hover:text-primary-foreground font-medium text-xs gap-1"
                >
                  <Utensils className="w-3.5 h-3.5" />
                  Gestionar Receta
                </Button>
              </div>
            ))
          )}
        </div>

        <DialogFooter className="pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-primary/20 text-primary hover:bg-muted/40 w-full sm:w-auto"
          >
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
