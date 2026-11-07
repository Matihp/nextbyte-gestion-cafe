import { useState, useEffect, useMemo } from 'react';
import productoService from '@/services/productoService';
import reporteService from '@/services/reporteService';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem
} from '@/components/ui/dropdown-menu';
import {
  LayoutGrid,
  ChevronDown,
  List,
  ScrollText,
  Plus,
  PackageX
} from 'lucide-react';

import ProductoCard from './components/ProductoCard';
import ProductoFiltros from './components/ProductoFiltros';
import ProductoModal from './components/ProductoModal';
import ProductosModalEditarEliminar from './components/ProductosModalEditarEliminar';
import ModalConfirmarEliminarProducto from './components/ModalConfirmarEliminarProducto';
import CategoriasModal from './components/CategoriasModal';
import RecetasModal from './components/RecetasModal';
import { normalizeText } from './utils/categoriasHelper';

export default function Productos() {
  const [productos, setProductos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [recetas, setRecetas] = useState([]);
  const [cargando, setCargando] = useState(true);

  // Filtros y Búsqueda
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todos');
  const [sortOption, setSortOption] = useState('none'); // 'none' | '+Vendidos' | '-Vendidos'

  // Modales
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);

  const [isProductListOpen, setIsProductListOpen] = useState(false);
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);
  const [isRecipeManagerOpen, setIsRecipeManagerOpen] = useState(false);
  const [initialRecipeEditId, setInitialRecipeEditId] = useState(null);
  const [productoAEliminarDirecto, setProductoAEliminarDirecto] = useState(null);

  const [isProductsMenuOpen, setIsProductsMenuOpen] = useState(false);

  const cargarDatos = async () => {
    try {
      setCargando(true);
      const [prodsRes, catsRes, topProdsRes, recetasRes] = await Promise.all([
        productoService.obtenerProductos(),
        productoService.obtenerCategorias(),
        reporteService.obtenerTopProductos().catch(() => []),
        productoService.obtenerTodasLasRecetas().catch(() => [])
      ]);

      const topProdsMap = new Map(
        (Array.isArray(topProdsRes) ? topProdsRes : []).map((t) => [t.producto_id, t.unidades])
      );

      const prodsList = (Array.isArray(prodsRes) ? prodsRes : []).map((p) => ({
        ...p,
        ventas_reales: topProdsMap.get(p.id) || 0
      }));

      setProductos(prodsList);
      setCategorias(Array.isArray(catsRes) ? catsRes : []);
      const listaRecetas = Array.isArray(recetasRes?.data) ? recetasRes.data : (Array.isArray(recetasRes) ? recetasRes : []);
      setRecetas(listaRecetas);
    } catch (error) {
      toast.error(error.message || 'Error al cargar productos y categorías');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  // Cálculo dinámico de ventas y estrellas sin datos falsos / mock
  const productSalesCount = useMemo(() => {
    const map = {};
    productos.forEach((p) => {
      map[p.id] = Number(p.ventas_reales) || 0;
    });
    return map;
  }, [productos]);

  const maxSales = useMemo(() => {
    const vals = Object.values(productSalesCount);
    return vals.length > 0 ? Math.max(...vals, 1) : 1;
  }, [productSalesCount]);

  const getProductStars = (productId) => {
    const sales = productSalesCount[productId] || 0;
    if (sales === 0) return 0;
    return Math.min(5, Math.max(1, Math.ceil((sales / maxSales) * 5)));
  };

  // Filtrado y ordenamiento de productos
  const filteredProducts = useMemo(() => {
    let prods = productos.filter((product) => {
      const matchesSearch = normalizeText(product.nombre).includes(normalizeText(searchTerm));
      const matchesCategory =
        selectedCategory === 'Todos' ||
        normalizeText(product.categoria_nombre) === normalizeText(selectedCategory);
      return matchesSearch && matchesCategory;
    });

    if (sortOption === '+Vendidos') {
      prods.sort((a, b) => {
        const starsDiff = getProductStars(b.id) - getProductStars(a.id);
        if (starsDiff !== 0) return starsDiff;
        return (productSalesCount[b.id] || 0) - (productSalesCount[a.id] || 0);
      });
    } else if (sortOption === '-Vendidos') {
      prods.sort((a, b) => {
        const starsDiff = getProductStars(a.id) - getProductStars(b.id);
        if (starsDiff !== 0) return starsDiff;
        return (productSalesCount[a.id] || 0) - (productSalesCount[b.id] || 0);
      });
    }

    return prods;
  }, [productos, searchTerm, selectedCategory, sortOption, productSalesCount, maxSales]);

  // Handlers
  const handleAddProduct = () => {
    setEditingProduct(null);
    setIsProductModalOpen(true);
  };

  const handleEditProduct = (product) => {
    setEditingProduct(product);
    setIsProductModalOpen(true);
    setIsProductListOpen(false);
  };

  const handleViewRecipe = (recipeId) => {
    setIsProductModalOpen(false);
    setInitialRecipeEditId(recipeId);
    setIsRecipeManagerOpen(true);
  };

  const handleDeleteProduct = async (product, reason = 'Merma', cantidad = null, esTodos = false) => {
    try {
      const res = await productoService.eliminarProducto(product.id, reason, cantidad);
      if (res?.data?.parcial) {
        toast.success(`Se descontaron ${cantidad} u. de "${product.nombre}" por ${reason}`);
      } else {
        toast.success(`Producto "${product.nombre}" eliminado`);
      }
      setIsProductModalOpen(false);
      setEditingProduct(null);
      setProductoAEliminarDirecto(null);
      await cargarDatos();
    } catch (error) {
      toast.error(error.message || 'Error al eliminar el producto');
    }
  };

  return (
    <div className="w-full">
      {/* Top Header Actions (Alineados a la derecha, Fieles a Cafeteria_1) */}
      <div className="flex items-center justify-end mb-8 gap-3 flex-wrap">
        {/* Dropdown Productos */}
        <DropdownMenu open={isProductsMenuOpen} onOpenChange={setIsProductsMenuOpen}>
          <DropdownMenuTrigger render={
            <Button
              className="flex items-center gap-2 px-4 py-2 bg-[#4B2B1D] text-white rounded-lg hover:bg-[#9F4F2F] transition-colors font-medium h-10 shadow-2xs cursor-pointer"
            />
          }>
            <LayoutGrid className="w-5 h-5" />
            <span>Productos</span>
            <ChevronDown className={`w-4 h-4 transition-transform ${isProductsMenuOpen ? 'rotate-180' : ''}`} />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-48 bg-white border border-gray-100 rounded-xl shadow-lg overflow-hidden p-0 mt-2 z-50"
          >
            <DropdownMenuItem
              onClick={handleAddProduct}
              className="w-full flex items-center gap-2 px-4 py-3 text-sm text-gray-700 hover:bg-[#F3E5DC] hover:text-[#4B2B1D] text-left transition-colors cursor-pointer rounded-none"
            >
              <Plus className="w-4 h-4" />
              <span>Agregar</span>
            </DropdownMenuItem>
            <div className="border-t border-gray-100" />
            <DropdownMenuItem
              onClick={() => {
                setIsProductListOpen(true);
                setIsProductsMenuOpen(false);
              }}
              className="w-full flex items-center gap-2 px-4 py-3 text-sm text-gray-700 hover:bg-[#F3E5DC] hover:text-[#4B2B1D] text-left transition-colors cursor-pointer rounded-none"
            >
              <List className="w-4 h-4" />
              <span>Editar / Eliminar</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Categories Button */}
        <Button
          variant="outline"
          onClick={() => setIsCategoryManagerOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium h-10 shadow-2xs cursor-pointer"
        >
          <List className="w-5 h-5" />
          <span>Categorías</span>
        </Button>

        {/* Recipes Button */}
        <Button
          variant="outline"
          onClick={() => {
            setInitialRecipeEditId(null);
            setIsRecipeManagerOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium h-10 shadow-2xs cursor-pointer"
        >
          <ScrollText className="w-5 h-5" />
          <span>Recetas</span>
        </Button>
      </div>

      {/* Filters Bar (Fiel a Cafeteria_1) */}
      <ProductoFiltros
        busqueda={searchTerm}
        setBusqueda={setSearchTerm}
        filtroVentas={sortOption}
        setFiltroVentas={setSortOption}
        categoriaSeleccionada={selectedCategory}
        setCategoriaSeleccionada={setSelectedCategory}
        categorias={categorias}
      />

      {/* Grilla de Productos */}
      {cargando ? (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="bg-white rounded-xl shadow-xs border border-gray-100 p-3 h-52 flex flex-col justify-between animate-pulse"
            >
              <div className="w-full h-28 rounded-lg bg-gray-200" />
              <div className="space-y-2 mt-2">
                <div className="h-4 w-3/4 rounded bg-gray-200" />
                <div className="h-3 w-1/2 rounded bg-gray-200" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-200 py-16 px-4 text-center flex flex-col items-center justify-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-400">
            <PackageX className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-gray-900">No se encontraron productos</h3>
          <p className="text-sm text-gray-500 max-w-sm">
            {searchTerm || selectedCategory !== 'Todos'
              ? 'Intentá cambiar los filtros o el término de búsqueda.'
              : 'No hay productos registrados en el sistema.'}
          </p>
          <Button
            onClick={handleAddProduct}
            className="mt-2 bg-[#4B2B1D] text-white hover:bg-[#9F4F2F] rounded-lg h-10 px-4 font-medium"
          >
            <Plus className="w-4 h-4 mr-2" />
            Agregar Producto
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {filteredProducts.map((product) => {
            const hasRecipe = recetas.some(
              (r) => Number(r.producto_id) === Number(product.id) || Number(r.id) === Number(product.id)
            );
            return (
              <ProductoCard
                key={product.id}
                producto={product}
                tieneReceta={hasRecipe}
                estrellas={getProductStars(product.id)}
                onEditar={handleEditProduct}
              />
            );
          })}
        </div>
      )}

      {/* Modal Agregar / Editar Producto (Fiel a Cafeteria_1) */}
      <ProductoModal
        open={isProductModalOpen}
        onOpenChange={setIsProductModalOpen}
        producto={editingProduct}
        categories={categorias}
        recipes={recetas}
        onSave={cargarDatos}
        onViewRecipe={handleViewRecipe}
        onDelete={(prod) => {
          setIsProductModalOpen(false);
          setProductoAEliminarDirecto(prod);
        }}
      />

      {/* Modal de Confirmación y Motivo para eliminación directa desde ProductoModal */}
      <ModalConfirmarEliminarProducto
        open={Boolean(productoAEliminarDirecto)}
        onOpenChange={(val) => !val && setProductoAEliminarDirecto(null)}
        producto={productoAEliminarDirecto}
        onConfirmar={handleDeleteProduct}
      />

      {/* Modal Editar / Eliminar Productos (Lista con Motivo de Eliminación) */}
      <ProductosModalEditarEliminar
        open={isProductListOpen}
        onOpenChange={setIsProductListOpen}
        productos={productos}
        onEditProduct={handleEditProduct}
        onDeleteProduct={handleDeleteProduct}
      />

      {/* Modal Administrador de Categorías */}
      <CategoriasModal
        open={isCategoryManagerOpen}
        onOpenChange={setIsCategoryManagerOpen}
        categorias={categorias}
        productos={productos}
        onActualizarCategorias={cargarDatos}
      />

      {/* Modal Administrador de Recetas */}
      <RecetasModal
        open={isRecipeManagerOpen}
        onOpenChange={setIsRecipeManagerOpen}
        recetas={recetas}
        productos={productos}
        initialEditRecipeId={initialRecipeEditId}
        onRecetaGuardada={cargarDatos}
      />
    </div>
  );
}
