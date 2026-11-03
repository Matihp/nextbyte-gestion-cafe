import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, ChevronDown, SlidersHorizontal } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';

export default function ProductoFiltros({
  busqueda,
  setBusqueda,
  categoriaSeleccionada,
  setCategoriaSeleccionada,
  orden,
  setOrden,
  categorias = []
}) {
  const nombreCategoriaActiva = categorias.find((c) => c.id === categoriaSeleccionada)?.nombre;

  const etiquetasOrden = {
    'nombre-asc': 'Nombre (A-Z)',
    'nombre-desc': 'Nombre (Z-A)',
    'precio-asc': 'Menor Precio',
    'precio-desc': 'Mayor Precio'
  };

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
          className="pl-9 h-10 bg-background/50 border-primary/10 text-primary placeholder:text-primary/40 rounded-xl focus-visible:ring-primary/20 w-full"
        />
      </div>

      {/* Acciones de Filtro y Categorías */}
      <div className="flex items-center gap-2 w-full md:w-auto justify-end flex-wrap sm:flex-nowrap">
        {/* Dropdown Ordenamiento ("Filtro") */}
        <DropdownMenu>
          <DropdownMenuTrigger render={
            <Button
              variant="outline"
              size="sm"
              className="h-10 border-primary/15 bg-background/50 text-primary rounded-xl font-medium gap-1.5 px-3"
            />
          }>
            <SlidersHorizontal className="w-3.5 h-3.5 text-primary/70" />
            <span className="text-xs sm:text-sm">{etiquetasOrden[orden] || 'Filtro'}</span>
            <ChevronDown className="w-3.5 h-3.5 text-primary/50 ml-1" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44 bg-card border-primary/15 rounded-xl shadow-lg">
            <DropdownMenuLabel className="text-xs text-primary/60 font-semibold px-2 py-1.5">
              Ordenar por
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-primary/10" />
            <DropdownMenuItem
              onClick={() => setOrden('nombre-asc')}
              className={`text-xs cursor-pointer rounded-lg px-2 py-1.5 ${orden === 'nombre-asc' ? 'font-bold text-accent' : 'text-primary'}`}
            >
              Nombre (A-Z)
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setOrden('nombre-desc')}
              className={`text-xs cursor-pointer rounded-lg px-2 py-1.5 ${orden === 'nombre-desc' ? 'font-bold text-accent' : 'text-primary'}`}
            >
              Nombre (Z-A)
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setOrden('precio-asc')}
              className={`text-xs cursor-pointer rounded-lg px-2 py-1.5 ${orden === 'precio-asc' ? 'font-bold text-accent' : 'text-primary'}`}
            >
              Menor Precio
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setOrden('precio-desc')}
              className={`text-xs cursor-pointer rounded-lg px-2 py-1.5 ${orden === 'precio-desc' ? 'font-bold text-accent' : 'text-primary'}`}
            >
              Mayor Precio
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Píldora "Todos" */}
        <Button
          type="button"
          size="sm"
          onClick={() => setCategoriaSeleccionada(null)}
          className={`h-10 px-4 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
            categoriaSeleccionada === null
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'bg-background/50 border border-primary/15 text-primary hover:bg-muted/40'
          }`}
        >
          Todos
        </Button>

        {/* Dropdown de Categorías */}
        <DropdownMenu>
          <DropdownMenuTrigger render={
            <Button
              variant="outline"
              size="sm"
              className={`h-10 border-primary/15 bg-background/50 rounded-xl font-medium gap-1.5 px-3 min-w-32 justify-between ${
                categoriaSeleccionada !== null ? 'border-primary text-primary font-semibold' : 'text-primary/80'
              }`}
            />
          }>
            <span className="text-xs sm:text-sm truncate max-w-[120px]">
              {nombreCategoriaActiva || 'Categoría'}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-primary/50 shrink-0" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 bg-card border-primary/15 rounded-xl shadow-lg max-h-60 overflow-y-auto">
            <DropdownMenuLabel className="text-xs text-primary/60 font-semibold px-2 py-1.5">
              Filtrar por Categoría
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-primary/10" />
            <DropdownMenuItem
              onClick={() => setCategoriaSeleccionada(null)}
              className={`text-xs cursor-pointer rounded-lg px-2 py-1.5 ${categoriaSeleccionada === null ? 'font-bold text-accent' : 'text-primary'}`}
            >
              Todas las categorías
            </DropdownMenuItem>
            {categorias.map((cat) => (
              <DropdownMenuItem
                key={cat.id}
                onClick={() => setCategoriaSeleccionada(cat.id)}
                className={`text-xs cursor-pointer rounded-lg px-2 py-1.5 ${categoriaSeleccionada === cat.id ? 'font-bold text-accent' : 'text-primary'}`}
              >
                {cat.nombre}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

