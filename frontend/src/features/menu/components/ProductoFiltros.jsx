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
    <div className="bg-white rounded-xl shadow-xs p-6 border border-gray-100 mb-6">
      <div className="flex flex-col md:flex-row gap-4">
        {/* Search */}
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 pointer-events-none" />
          <Input
            type="text"
            placeholder="Buscar productos..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus-visible:ring-2 focus-visible:ring-[#A67C52] text-sm bg-white"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <select
            value={filtroVentas}
            onChange={(e) => setFiltroVentas(e.target.value)}
            className="px-4 py-2 pr-8 rounded-lg border border-gray-300 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#A67C52] bg-white text-gray-700 hover:bg-gray-50 text-sm h-10"
          >
            <option value="none">Filtro</option>
            <option value="+Vendidos">+Vendidos</option>
            <option value="-Vendidos">-Vendidos</option>
          </select>

          <Button
            type="button"
            variant="ghost"
            onClick={() => setCategoriaSeleccionada('Todos')}
            className={`px-4 py-2 rounded-lg transition-colors text-sm font-medium h-10 ${
              categoriaSeleccionada === 'Todos'
                ? 'bg-[#4B2B1D] text-white hover:bg-[#4B2B1D]/90 hover:text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Todos
          </Button>

          <select
            value={categoriaSeleccionada === 'Todos' ? '' : categoriaSeleccionada}
            onChange={(e) => setCategoriaSeleccionada(e.target.value || 'Todos')}
            className={`px-4 py-2 pr-8 rounded-lg transition-colors cursor-pointer focus:outline-none text-sm h-10 ${
              categoriaSeleccionada !== 'Todos'
                ? 'bg-[#4B2B1D] text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <option value="" disabled hidden>
              Categoría
            </option>
            {categorias.map((cat) => (
              <option key={cat.id} value={cat.nombre} className="bg-white text-gray-900">
                {cat.nombre}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
