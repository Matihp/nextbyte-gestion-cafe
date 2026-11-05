import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search } from 'lucide-react';

export default function ProductoFiltros({
  busqueda,
  setBusqueda,
  filtroVentas,
  setFiltroVentas,
  categoriaSeleccionada,
  setCategoriaSeleccionada,
  categorias = []
}) {
  return (
    <div className="bg-card/90 backdrop-blur-xs border border-primary/10 rounded-2xl p-2.5 shadow-xs flex flex-col md:flex-row items-center gap-3 w-full">
      {/* Buscador de Productos */}
      <div className="relative flex-1 w-full">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/40 pointer-events-none" />
        <Input
          type="text"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar productos..."
          className="pl-9 h-10 bg-background/50 border-primary/15 text-primary placeholder:text-primary/40 rounded-xl focus-visible:ring-primary/20 w-full"
        />
      </div>

      {/* Controles de Filtros y Categorías (Fieles a Imágenes 1, 2 y 3) */}
      <div className="flex items-center gap-2.5 w-full md:w-auto justify-end flex-wrap sm:flex-nowrap">
        {/* Menú Desplegable "Filtro" (Imagen 2: Filtro, +Vendidos, -Vendidos) */}
        <select
          value={filtroVentas}
          onChange={(e) => setFiltroVentas(e.target.value)}
          className="h-10 rounded-xl border border-primary/20 bg-background/50 px-3.5 pr-7 text-xs sm:text-sm font-medium text-primary outline-none transition-colors focus:border-primary/40 cursor-pointer min-w-28 shadow-2xs"
        >
          <option value="filtro">Filtro</option>
          <option value="+vendidos">+Vendidos</option>
          <option value="-vendidos">-Vendidos</option>
        </select>

        {/* Píldora "Todos" (Fondo chocolate oscuro cuando está activa) */}
        <Button
          type="button"
          onClick={() => setCategoriaSeleccionada('')}
          className={`h-10 px-5 rounded-xl text-xs sm:text-sm font-semibold transition-all shrink-0 cursor-pointer ${
            !categoriaSeleccionada
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'bg-background/50 border border-primary/15 text-primary hover:bg-muted/40'
          }`}
        >
          Todos
        </Button>

        {/* Menú Desplegable "Categoría" (Imagen 1: Lista de Categorías en mayúsculas) */}
        <select
          value={categoriaSeleccionada}
          onChange={(e) => setCategoriaSeleccionada(e.target.value)}
          className={`h-10 rounded-xl border bg-background/50 px-3.5 pr-7 text-xs sm:text-sm font-medium transition-colors outline-none cursor-pointer min-w-32 shadow-2xs ${
            categoriaSeleccionada
              ? 'border-primary text-primary font-semibold'
              : 'border-primary/20 text-primary/80'
          }`}
        >
          <option value="">Categoría</option>
          {categorias.map((cat) => (
            <option key={cat.id} value={cat.nombre}>
              {cat.nombre.toUpperCase()}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
