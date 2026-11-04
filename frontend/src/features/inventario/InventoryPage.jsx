import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileText,
  List,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

import { inventarioService } from '@/services/inventarioService';
import { formatearPrecio, formatearSoloFecha } from '@/utils/formatters';

const UNIT_OPTIONS = [
  { value: 'un', label: 'Unidades' },
  { value: 'kg', label: 'kg' },
  { value: 'lts', label: 'lts' },
];

export default function InventoryPage() {
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filtros y Búsqueda
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('Todos');
  const [sortOption, setSortOption] = useState('none'); // 'none' | '+En Falta' | '+Próximos a Vencer'

  // Categorías dinámicas
  const [customCategories, setCustomCategories] = useState(['Ingredientes', 'Bebidas', 'Suministros', 'Panadería']);

  // Modales
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [savingItem, setSavingItem] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    category: 'Ingredientes',
    quantity: 0,
    unit: 'un',
    minStock: 0,
    costPrice: 0,
    expirationDate: '',
  });

  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  const [itemToDelete, setItemToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Cargar insumos desde el backend
  const loadInventory = async () => {
    try {
      setLoading(true);
      const data = await inventarioService.obtenerInsumos();
      const items = Array.isArray(data) ? data : [];
      setInventory(items);

      // Extraer categorías existentes
      const cats = new Set(customCategories);
      items.forEach((item) => {
        if (item.rubro && item.rubro.trim()) {
          cats.add(item.rubro.trim());
        }
      });
      setCustomCategories(Array.from(cats));
    } catch (error) {
      toast.error(error.message || 'Error al cargar el inventario');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInventory();
  }, []);

  // Cálculo de días restantes hasta el vencimiento
  const getExpirationDiff = (expirationDateStr) => {
    if (!expirationDateStr) return Infinity;
    const expDate = new Date(expirationDateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };

  const isExpiringSoon = (expirationDateStr) => {
    const diff = getExpirationDiff(expirationDateStr);
    return diff >= 0 && diff <= 7;
  };

  // Métricas (idénticas a Cafeteria_1)
  const emptyStockCount = useMemo(
    () => inventory.filter((i) => Number(i.cantidad_disponible) === 0).length,
    [inventory]
  );

  const lowStockCount = useMemo(
    () =>
      inventory.filter((i) => {
        const qty = Number(i.cantidad_disponible);
        const min = Number(i.stock_minimo);
        return qty > 0 && qty <= min;
      }).length,
    [inventory]
  );

  const healthyStockCount = useMemo(
    () =>
      inventory.filter((i) => {
        const qty = Number(i.cantidad_disponible);
        const min = Number(i.stock_minimo);
        return qty > min;
      }).length,
    [inventory]
  );

  const expiringSoonCount = useMemo(
    () => inventory.filter((i) => isExpiringSoon(i.fecha_vencimiento)).length,
    [inventory]
  );

  // Lista de categorías para el selector
  const categoriesList = useMemo(() => ['Todos', ...customCategories], [customCategories]);

  // Filtrado y ordenamiento
  const filteredInventory = useMemo(() => {
    let result = inventory.filter((item) => {
      const q = searchTerm.toLowerCase().trim();
      const matchesSearch =
        !q ||
        item.nombre?.toLowerCase().includes(q) ||
        item.rubro?.toLowerCase().includes(q);

      const itemCategory = item.rubro || 'General';
      const matchesCategory = categoryFilter === 'Todos' || itemCategory === categoryFilter;

      return matchesSearch && matchesCategory;
    });

    if (sortOption === '+En Falta') {
      result = result.filter(
        (item) => Number(item.cantidad_disponible) <= Number(item.stock_minimo)
      );
      result.sort((a, b) => {
        const faltaA = Math.max(0, Number(a.stock_minimo) - Number(a.cantidad_disponible));
        const faltaB = Math.max(0, Number(b.stock_minimo) - Number(b.cantidad_disponible));
        return faltaB - faltaA;
      });
    } else if (sortOption === '+Próximos a Vencer') {
      result = result.filter((item) => isExpiringSoon(item.fecha_vencimiento));
      result.sort((a, b) => {
        const diffA = getExpirationDiff(a.fecha_vencimiento);
        const diffB = getExpirationDiff(b.fecha_vencimiento);
        return diffA - diffB;
      });
    }

    return result;
  }, [inventory, searchTerm, categoryFilter, sortOption]);

  // Abrir modal de crear o editar
  const openModal = (item) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        name: item.nombre || '',
        category: item.rubro || (customCategories[0] || 'Ingredientes'),
        quantity: Number(item.cantidad_disponible) || 0,
        unit: item.unidad_medida || 'un',
        minStock: Number(item.stock_minimo) || 0,
        costPrice: Number(item.precio_costo) || 0,
        expirationDate: item.fecha_vencimiento ? item.fecha_vencimiento.split('T')[0] : '',
      });
    } else {
      setEditingItem(null);
      setFormData({
        name: '',
        category: customCategories.length > 0 ? customCategories[0] : 'Ingredientes',
        quantity: 0,
        unit: 'un',
        minStock: 0,
        costPrice: 0,
        expirationDate: '',
      });
    }
    setIsModalOpen(true);
  };

  // Guardar insumo (crear o editar en backend)
  const handleSaveItem = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('El nombre del artículo es obligatorio');
      return;
    }

    try {
      setSavingItem(true);
      const payload = {
        nombre: formData.name.trim(),
        rubro: formData.category ? formData.category.trim() : null,
        cantidad_disponible: Number(formData.quantity) || 0,
        unidad_medida: formData.unit,
        stock_minimo: Number(formData.minStock) || 0,
        precio_costo: Number(formData.costPrice) || 0,
        fecha_ingreso: new Date().toISOString().split('T')[0],
        fecha_vencimiento: formData.expirationDate || null,
      };

      if (editingItem) {
        await inventarioService.actualizarInsumo(editingItem.id, payload);
        toast.success('Insumo actualizado exitosamente');
      } else {
        await inventarioService.crearInsumo(payload);
        toast.success('Insumo agregado a stock');
      }

      setIsModalOpen(false);
      loadInventory();
    } catch (error) {
      toast.error(error.message || 'Error al guardar el insumo');
    } finally {
      setSavingItem(false);
    }
  };

  // Eliminar insumo
  const handleDelete = async () => {
    if (!itemToDelete) return;
    try {
      setDeleting(true);
      await inventarioService.eliminarInsumo(itemToDelete.id);
      toast.success('Insumo eliminado del inventario');
      setItemToDelete(null);
      loadInventory();
    } catch (error) {
      toast.error(error.message || 'Error al eliminar el insumo');
    } finally {
      setDeleting(false);
    }
  };

  // Generar lista de compras en CSV
  const handleGenerateShoppingList = () => {
    const itemsToBuy = inventory.filter(
      (item) => Number(item.cantidad_disponible) <= Number(item.stock_minimo)
    );

    if (itemsToBuy.length === 0) {
      toast.info('No hay insumos por debajo del stock mínimo.');
      return;
    }

    const headers = ['Insumo', 'Categoría', 'Stock Actual', 'Stock Mínimo', 'Faltante Sugerido'];
    const csvContent = [
      headers.join(','),
      ...itemsToBuy.map((item) => {
        const qty = Number(item.cantidad_disponible) || 0;
        const min = Number(item.stock_minimo) || 0;
        const faltante = Math.max(0, min - qty);
        return `"${item.nombre}","${item.rubro || 'General'}",${qty},${min},${faltante}`;
      }),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Lista_Compras_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Lista de compras descargada en CSV');
  };

  return (
    <div className="p-8">
      {/* Cards de Métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {/* Card Rojo */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col justify-center relative overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-red-500"></div>
          <div className="flex items-center gap-2 text-gray-500 mb-2">
            <XCircle className="w-5 h-5 text-red-500" />
            <span className="font-medium text-sm">Stock Agotado / Crítico</span>
          </div>
          <div className="text-3xl font-bold text-red-500 mb-1">{emptyStockCount} Insumos</div>
          <div className="text-sm text-gray-400">Requiere compra inmediata</div>
        </div>

        {/* Card Amarillo */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col justify-center relative overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-yellow-400"></div>
          <div className="flex items-center gap-2 text-gray-500 mb-2">
            <AlertTriangle className="w-5 h-5 text-yellow-500" />
            <span className="font-medium text-sm">Stock Bajo Mínimo</span>
          </div>
          <div className="text-3xl font-bold text-yellow-500 mb-1">{lowStockCount} Insumos</div>
          <div className="text-sm text-gray-400">Planificar próxima compra</div>
        </div>

        {/* Card Naranja (Vencimientos) */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col justify-center relative overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-orange-500"></div>
          <div className="flex items-center gap-2 text-gray-500 mb-2">
            <AlertTriangle className="w-5 h-5 text-orange-500" />
            <span className="font-medium text-sm">Próximos Vencimientos</span>
          </div>
          <div className="text-3xl font-bold text-orange-500 mb-1">{expiringSoonCount} Insumos</div>
          <div className="text-sm text-gray-400">Verificar insumos</div>
        </div>

        {/* Card Verde */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col justify-center relative overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-emerald-500"></div>
          <div className="flex items-center gap-2 text-gray-500 mb-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            <span className="font-medium text-sm">Stock Saludable</span>
          </div>
          <div className="text-3xl font-bold text-emerald-500 mb-1">{healthyStockCount} Insumos</div>
          <div className="text-sm text-gray-400">Niveles óptimos</div>
        </div>
      </div>

      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row justify-end items-start md:items-center mb-8 gap-4">
        <div className="flex items-center gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={handleGenerateShoppingList}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors shadow-sm h-10"
          >
            <FileText className="w-4 h-4" />
            <span>Generar Lista de Compras</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={() => setIsCategoryModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors shadow-sm h-10"
          >
            <List className="w-4 h-4" />
            <span>Categorías</span>
          </Button>

          <Button
            type="button"
            onClick={() => openModal()}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#4B2B1D] rounded-lg hover:bg-[#3d2317] transition-colors shadow-sm h-10"
          >
            <Plus className="w-4 h-4" />
            <span>Insumos</span>
          </Button>
        </div>
      </div>

      {/* Buscador y Filtros */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 pointer-events-none" />
            <Input
              type="text"
              placeholder="Buscar inventario..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#A67C52] h-10 text-sm"
            />
          </div>
          <div className="flex gap-2 items-center">
            <select
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#A67C52] cursor-pointer h-10 text-sm"
            >
              <option value="none">Filtro</option>
              <option value="+En Falta">+En Falta</option>
              <option value="+Próximos a Vencer">+Próximos a Vencer</option>
            </select>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-4 py-2 border border-transparent rounded-lg bg-[#4B2B1D] text-white focus:outline-none cursor-pointer h-10 text-sm"
            >
              {categoriesList.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Tabla de Inventario */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600">Artículo</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600">Categoría</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600">Stock Actual</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600">Costo Unit.</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600">Stock Mín.</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600">Faltante</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600">F. Ingreso</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600">F. Venc.</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600">Estado Stock</th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-gray-600">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-3 py-10 text-center text-gray-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw className="w-5 h-5 animate-spin text-[#4B2B1D]" />
                      <span className="text-sm">Cargando inventario...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredInventory.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-3 py-8 text-center text-gray-500 font-medium">
                    {sortOption === '+En Falta'
                      ? 'No hay insumos en falta'
                      : sortOption === '+Próximos a Vencer'
                      ? 'No hay insumos por vencer'
                      : 'No se encontraron resultados'}
                  </td>
                </tr>
              ) : (
                filteredInventory.map((item) => {
                  const qty = Number(item.cantidad_disponible) || 0;
                  const min = Number(item.stock_minimo) || 0;
                  const isEmpty = qty === 0;
                  const isLowStock = !isEmpty && qty <= min;
                  const expiringSoon = isExpiringSoon(item.fecha_vencimiento);
                  const faltante = Math.max(0, min - qty);

                  return (
                    <tr key={item.id} className="transition-colors hover:bg-gray-50">
                      <td className="px-3 py-3 text-sm font-medium text-gray-900">{item.nombre}</td>
                      <td className="px-3 py-3 text-sm text-gray-600">
                        <span className="inline-block px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded-full whitespace-nowrap">
                          {item.rubro || 'General'}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">
                        {qty} {item.unidad_medida}
                      </td>
                      <td className="px-3 py-3 text-sm text-gray-600">
                        {formatearPrecio(item.precio_costo)}
                      </td>
                      <td className="px-3 py-3 text-sm text-gray-600 whitespace-nowrap">
                        {min} {item.unidad_medida}
                      </td>
                      <td className="px-3 py-3 text-sm font-medium whitespace-nowrap">
                        {faltante > 0 ? (
                          <span className="text-red-600 font-bold">
                            {faltante} {item.unidad_medida}
                          </span>
                        ) : (
                          <span className="text-gray-400">0 {item.unidad_medida}</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-sm text-gray-600 whitespace-nowrap">
                        {formatearSoloFecha(item.fecha_ingreso)}
                      </td>
                      <td className="px-3 py-3 text-sm whitespace-nowrap">
                        {item.fecha_vencimiento ? (
                          expiringSoon ? (
                            <span className="bg-yellow-200 text-yellow-800 font-bold px-2 py-1 rounded text-xs">
                              {formatearSoloFecha(item.fecha_vencimiento)}
                            </span>
                          ) : (
                            <span className="text-gray-600 text-xs">
                              {formatearSoloFecha(item.fecha_vencimiento)}
                            </span>
                          )
                        ) : (
                          <span className="text-gray-400 text-xs">-</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${
                            isEmpty
                              ? 'bg-red-100 text-red-700'
                              : isLowStock
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-emerald-100 text-emerald-700'
                          }`}
                        >
                          {isEmpty ? 'Agotado' : isLowStock ? 'Bajo Mín.' : 'Ok'}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => openModal(item)}
                            className="p-1 hover:bg-blue-100 rounded-md transition-colors text-blue-600"
                            title="Editar"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setItemToDelete(item)}
                            className="p-1 hover:bg-red-100 rounded-md transition-colors text-red-600"
                            title="Eliminar"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Shadcn: Agregar/Editar Insumo */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-lg bg-white rounded-2xl p-0 overflow-hidden shadow-xl border-0">
          <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
            <DialogTitle className="text-xl font-bold text-gray-800">
              {editingItem ? 'Editar Insumo' : 'Ingresar Insumo a Stock'}
            </DialogTitle>
          </div>

          <form onSubmit={handleSaveItem} className="p-6 space-y-4">
            <div>
              <Label className="block text-sm font-semibold text-gray-700 mb-1">
                Nombre del Artículo *
              </Label>
              <Input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full h-10 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#A67C52]"
                placeholder="Ej: Granos de Café"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="block text-sm font-semibold text-gray-700 mb-1">Categoría</Label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full h-10 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#A67C52] focus:outline-none bg-white text-sm"
                >
                  {customCategories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="block text-sm font-semibold text-gray-700 mb-1">Unidad</Label>
                <select
                  value={formData.unit}
                  onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                  className="w-full h-10 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#A67C52] focus:outline-none bg-white text-sm"
                >
                  {UNIT_OPTIONS.map((u) => (
                    <option key={u.value} value={u.value}>
                      {u.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label className="block text-sm font-semibold text-gray-700 mb-1">Cantidad</Label>
                <Input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={formData.quantity}
                  onChange={(e) =>
                    setFormData({ ...formData, quantity: parseFloat(e.target.value) || 0 })
                  }
                  className="w-full h-10 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#A67C52]"
                />
              </div>
              <div>
                <Label className="block text-sm font-semibold text-gray-700 mb-1">Stock Mínimo</Label>
                <Input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={formData.minStock}
                  onChange={(e) =>
                    setFormData({ ...formData, minStock: parseFloat(e.target.value) || 0 })
                  }
                  className="w-full h-10 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#A67C52]"
                />
              </div>
              <div>
                <Label className="block text-sm font-semibold text-gray-700 mb-1">Costo Unit.</Label>
                <Input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={formData.costPrice}
                  onChange={(e) =>
                    setFormData({ ...formData, costPrice: parseFloat(e.target.value) || 0 })
                  }
                  className="w-full h-10 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#A67C52]"
                />
              </div>
            </div>

            <div>
              <Label className="block text-sm font-semibold text-gray-700 mb-1">
                Fecha de Vencimiento
              </Label>
              <Input
                type="date"
                value={formData.expirationDate}
                onChange={(e) => setFormData({ ...formData, expirationDate: e.target.value })}
                className="w-full h-10 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#A67C52] text-gray-700"
              />
            </div>

            <div className="mt-6 pt-4 border-t border-gray-100 flex justify-end gap-3">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsModalOpen(false)}
                disabled={savingItem}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg font-medium"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={savingItem}
                className="px-4 py-2 bg-[#A67C52] text-white hover:bg-[#8c6540] rounded-lg font-medium shadow-sm"
              >
                {savingItem && <RefreshCw className="w-4 h-4 animate-spin mr-2" />}
                {editingItem ? 'Guardar Cambios' : 'Agregar Insumo'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Shadcn: Agregar Categoría */}
      <Dialog open={isCategoryModalOpen} onOpenChange={setIsCategoryModalOpen}>
        <DialogContent className="max-w-sm bg-white rounded-2xl p-0 overflow-hidden shadow-xl border-0">
          <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
            <DialogTitle className="text-xl font-bold text-gray-800">Nueva Categoría</DialogTitle>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (newCategoryName.trim()) {
                const nombre = newCategoryName.trim();
                if (!customCategories.includes(nombre)) {
                  setCustomCategories([...customCategories, nombre]);
                  toast.success(`Categoría "${nombre}" agregada`);
                }
                setNewCategoryName('');
                setIsCategoryModalOpen(false);
              }
            }}
            className="p-6 space-y-4"
          >
            <div>
              <Label className="block text-sm font-semibold text-gray-700 mb-1">
                Nombre de la Categoría
              </Label>
              <Input
                type="text"
                required
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                className="w-full h-10 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#A67C52]"
                placeholder="Ej: Embalaje"
              />
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsCategoryModalOpen(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg font-medium"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="px-4 py-2 bg-[#A67C52] text-white hover:bg-[#8c6540] rounded-lg font-medium shadow-sm"
              >
                Agregar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Shadcn: Confirmar Eliminación */}
      <Dialog open={Boolean(itemToDelete)} onOpenChange={(open) => !open && setItemToDelete(null)}>
        <DialogContent className="max-w-md bg-white rounded-2xl p-6 shadow-xl border-0">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-red-600 flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-red-600" />
              <span>Eliminar Insumo</span>
            </DialogTitle>
          </DialogHeader>

          <p className="text-sm text-gray-600 pt-2">
            ¿Estás seguro de que deseas eliminar el insumo{' '}
            <strong className="text-gray-900">{itemToDelete?.nombre}</strong> del inventario?
            <br />
            Esta acción no se puede deshacer.
          </p>

          <DialogFooter className="pt-4 gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setItemToDelete(null)}
              disabled={deleting}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleting && <RefreshCw className="w-4 h-4 animate-spin mr-2" />}
              Eliminar Definitivamente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

