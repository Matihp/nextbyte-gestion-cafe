import { useState, useEffect, useMemo } from 'react';
import productoService from '@/services/productoService';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import {
  LayoutGrid,
  ChevronDown,
  ChevronUp,
  Layers,
  FileText,
  Plus,
  List,
  PackageX,
  AlertTriangle,
  Loader2
} from 'lucide-react';

import ProductoCard from './components/ProductoCard';
import ProductoFiltros from './components/ProductoFiltros';
import ProductoModal from './components/ProductoModal';
import CategoriasModal from './components/CategoriasModal';
import RecetasModal from './components/RecetasModal';
import RecetaEditorModal from './components/RecetaEditorModal';
import ProductosModalEditarEliminar from './components/ProductosModalEditarEliminar';

export default function Productos() {
  const [productos, setProductos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [recetas, setRecetas] = useState([]);
  const [cargando, setCargando] = useState(true);

  // Control del dropdown superior de Productos (chevron arriba / abajo)
  const [dropdownProductosAbierto, setDropdownProductosAbierto] = useState(false);

  // Estados de filtros y búsqueda
  const [busqueda, setBusqueda] = useState('');
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState(null);
  const [orden, setOrden] = useState('nombre-asc');

  // Modales
  const [modalProductoOpen, setModalProductoOpen] = useState(false);
  const [productoAEditar, setProductoAEditar] = useState(null);

  const [modalEditarEliminarOpen, setModalEditarEliminarOpen] = useState(false);

  const [modalCategoriasOpen, setModalCategoriasOpen] = useState(false);

  const [modalRecetasOpen, setModalRecetasOpen] = useState(false);
  const [modalRecetaEditorOpen, setModalRecetaEditorOpen] = useState(false);
  const [productoParaReceta, setProductoParaReceta] = useState(null);

  // Eliminación con confirmación modal
  const [productoAEliminar, setProductoAEliminar] = useState(null);
  const [eliminando, setEliminando] = useState(false);

  const cargarDatos = async () => {
    try {
      setCargando(true);
      const [prodsRes, catsRes] = await Promise.all([
        productoService.obtenerProductos(),
        productoService.obtenerCategorias()
      ]);

      const prodsList = Array.isArray(prodsRes) ? prodsRes : [];
      setProductos(prodsList);
      setCategorias(Array.isArray(catsRes) ? catsRes : []);

      // Cargar recetas asociadas para el modal de Recetas
      if (prodsList.length > 0) {
        const recetasCheck = await Promise.all(
          prodsList.map((p) =>
            productoService
              .obtenerReceta(p.id)
              .then((r) => (r && r.ingredientes && r.ingredientes.length > 0 ? r : null))
              .catch(() => null)
          )
        );
        setRecetas(recetasCheck.filter(Boolean));
      } else {
        setRecetas([]);
      }
    } catch (error) {
      toast.error(error.message || 'Error al cargar productos y categorías');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  // Filtrado y Ordenamiento
  const productosFiltrados = useMemo(() => {
    let resultado = [...productos];

    if (categoriaSeleccionada !== null) {
      resultado = resultado.filter((p) => p.categoria_id === categoriaSeleccionada);
    }

    if (busqueda.trim() !== '') {
      const termino = busqueda.toLowerCase().trim();
      resultado = resultado.filter(
        (p) =>
          (p.nombre || '').toLowerCase().includes(termino) ||
          (p.categoria_nombre || '').toLowerCase().includes(termino)
      );
    }

    resultado.sort((a, b) => {
      switch (orden) {
        case 'nombre-desc':
          return (b.nombre || '').localeCompare(a.nombre || '');
        case 'precio-asc':
          return Number(a.precio_venta) - Number(b.precio_venta);
        case 'precio-desc':
          return Number(b.precio_venta) - Number(a.precio_venta);
        case 'nombre-asc':
        default:
          return (a.nombre || '').localeCompare(b.nombre || '');
      }
    });

    return resultado;
  }, [productos, categoriaSeleccionada, busqueda, orden]);

  // Handlers
  const handleNuevoProducto = () => {
    setProductoAEditar(null);
    setModalProductoOpen(true);
  };

  const handleEditarProducto = (producto) => {
    setProductoAEditar(producto);
    setModalProductoOpen(true);
  };

  const handleEditarRecetaDesdeModal = (receta) => {
    const prod = productos.find((p) => p.id === receta.producto_id);
    setProductoParaReceta(prod || { id: receta.producto_id, nombre: receta.nombre });
    setModalRecetaEditorOpen(true);
  };

  const handleCrearNuevaReceta = () => {
    setProductoParaReceta(null);
    setModalRecetaEditorOpen(true);
  };

  const handleGestionarRecetaDesdeCard = (producto) => {
    setProductoParaReceta(producto);
    setModalRecetaEditorOpen(true);
  };

  const handleConfirmarEliminar = async () => {
    if (!productoAEliminar) return;

    try {
      setEliminando(true);
      await productoService.eliminarProducto(productoAEliminar.id);
      toast.success(`Producto "${productoAEliminar.nombre}" eliminado`);
      setProductoAEliminar(null);
      cargarDatos();
    } catch (error) {
      toast.error(error.message || 'Error al eliminar el producto');
    } finally {
      setEliminando(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Barra de Acciones Superiores (Alineada a la derecha, sin duplicar título) */}
      <div className="flex justify-end items-center gap-3 flex-wrap">
        {/* Dropdown Productos (Imagen 1) */}
        <DropdownMenu onOpenChange={setDropdownProductosAbierto}>
          <DropdownMenuTrigger render={
            <Button
              variant="default"
              className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold h-11 px-5 rounded-2xl gap-2 shadow-xs cursor-pointer"
            />
          }>
            <LayoutGrid className="w-4 h-4" />
            <span>Productos</span>
            {dropdownProductosAbierto ? (
              <ChevronUp className="w-4 h-4 ml-0.5" />
            ) : (
              <ChevronDown className="w-4 h-4 ml-0.5" />
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 bg-card border border-primary/20 rounded-2xl shadow-xl p-1.5 mt-1">
            <DropdownMenuItem
              onClick={handleNuevoProducto}
              className="text-xs cursor-pointer font-medium text-primary hover:text-accent gap-2.5 py-2.5 px-3 rounded-xl"
            >
              <Plus className="w-4 h-4 text-primary/80" />
              <span>Agregar</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setModalEditarEliminarOpen(true)}
              className="text-xs cursor-pointer font-medium text-primary hover:text-accent gap-2.5 py-2.5 px-3 rounded-xl"
            >
              <List className="w-4 h-4 text-primary/80" />
              <span>Editar / Eliminar</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Botón Categorías (Imagen 1 y 4) */}
        <Button
          variant="outline"
          onClick={() => setModalCategoriasOpen(true)}
          className="border-primary/20 bg-card hover:bg-muted text-primary font-semibold h-11 px-5 rounded-2xl gap-2 shadow-2xs cursor-pointer"
        >
          <Layers className="w-4 h-4 text-primary/80" />
          <span>Categorías</span>
        </Button>

        {/* Botón Recetas (Imagen 1 y 5) */}
        <Button
          variant="outline"
          onClick={() => setModalRecetasOpen(true)}
          className="border-primary/20 bg-card hover:bg-muted text-primary font-semibold h-11 px-5 rounded-2xl gap-2 shadow-2xs cursor-pointer"
        >
          <FileText className="w-4 h-4 text-primary/80" />
          <span>Recetas</span>
        </Button>
      </div>

      {/* Barra de Filtros y Búsqueda */}
      <ProductoFiltros
        busqueda={busqueda}
        setBusqueda={setBusqueda}
        categoriaSeleccionada={categoriaSeleccionada}
        setCategoriaSeleccionada={setCategoriaSeleccionada}
        orden={orden}
        setOrden={setOrden}
        categorias={categorias}
      />

      {/* Grilla de Tarjetas de Productos */}
      {cargando ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="h-64 rounded-2xl border border-primary/10 bg-card/60 p-3 flex flex-col justify-between animate-pulse"
            >
              <div className="w-full aspect-[4/3] rounded-xl bg-primary/10" />
              <div className="space-y-2 mt-3">
                <div className="h-4 w-3/4 rounded bg-primary/10" />
                <div className="h-3 w-1/2 rounded bg-primary/10" />
                <div className="h-3 w-1/3 rounded bg-primary/10" />
              </div>
            </div>
          ))}
        </div>
      ) : productosFiltrados.length === 0 ? (
        <div className="text-center py-16 px-4 rounded-2xl border border-dashed border-primary/20 bg-card/40 flex flex-col items-center justify-center gap-3">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary/60">
            <PackageX className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-primary">No se encontraron productos</h3>
          <p className="text-sm text-primary/60 max-w-sm">
            {busqueda || categoriaSeleccionada !== null
              ? 'Intentá cambiar los filtros o el término de búsqueda.'
              : 'Todavía no hay productos registrados en el menú.'}
          </p>
          <Button
            onClick={handleNuevoProducto}
            className="mt-2 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold rounded-xl"
          >
            <Plus className="w-4 h-4 mr-2" />
            Agregar Producto
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          {productosFiltrados.map((producto) => (
            <ProductoCard
              key={producto.id}
              producto={producto}
              onEditar={handleEditarProducto}
              onReceta={handleGestionarRecetaDesdeCard}
              onEliminar={(prod) => setProductoAEliminar(prod)}
            />
          ))}
        </div>
      )}

      {/* Modal Agregar / Editar Producto (Imágenes 2 y 3) */}
      <ProductoModal
        open={modalProductoOpen}
        onOpenChange={setModalProductoOpen}
        producto={productoAEditar}
        categorias={categorias}
        recetasDisponibles={recetas}
        onGuardado={cargarDatos}
      />

      {/* Modal Editar / Eliminar Producto (Imagen 1) */}
      <ProductosModalEditarEliminar
        open={modalEditarEliminarOpen}
        onOpenChange={setModalEditarEliminarOpen}
        productos={productos}
        onEditarProducto={handleEditarProducto}
        onEliminarProducto={(prod) => setProductoAEliminar(prod)}
      />

      {/* Modal Gestión de Categorías (Imagen 4) */}
      <CategoriasModal
        open={modalCategoriasOpen}
        onOpenChange={setModalCategoriasOpen}
        categorias={categorias}
        productos={productos}
        onActualizarCategorias={cargarDatos}
      />

      {/* Modal Recetas (Imagen 5) */}
      <RecetasModal
        open={modalRecetasOpen}
        onOpenChange={setModalRecetasOpen}
        recetas={recetas}
        onEditarReceta={handleEditarRecetaDesdeModal}
        onCrearNuevaReceta={handleCrearNuevaReceta}
        onRecetaEliminada={cargarDatos}
      />

      {/* Modal Editor de Ingredientes de la Receta */}
      <RecetaEditorModal
        open={modalRecetaEditorOpen}
        onOpenChange={setModalRecetaEditorOpen}
        producto={productoParaReceta}
        productos={productos}
        onRecetaGuardada={cargarDatos}
      />

      {/* Modal de Confirmación para Eliminar Producto */}
      <Dialog open={Boolean(productoAEliminar)} onOpenChange={(val) => !val && setProductoAEliminar(null)}>
        <DialogContent className="sm:max-w-md bg-card border-primary/20 text-card-foreground rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-destructive flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Confirmar Eliminación
            </DialogTitle>
            <DialogDescription className="text-sm text-primary/70 pt-2">
              ¿Estás seguro de que deseás eliminar el producto{' '}
              <strong className="text-primary font-bold">"{productoAEliminar?.nombre}"</strong>? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-3 gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setProductoAEliminar(null)}
              disabled={eliminando}
              className="border-primary/20 text-primary hover:bg-muted/40 rounded-xl"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirmarEliminar}
              disabled={eliminando}
              className="bg-destructive text-white hover:bg-destructive/90 rounded-xl"
            >
              {eliminando && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
