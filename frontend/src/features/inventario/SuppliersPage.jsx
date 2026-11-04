import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  Box,
  PackageOpen,
  RefreshCw,
  Check,
  Search,
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

export default function SuppliersPage() {
  const [currentView, setCurrentView] = useState('list'); // 'list' | 'form'
  const [suppliers, setSuppliers] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);

  // Expansión de insumos en la tabla
  const [expandedSupplier, setExpandedSupplier] = useState(null);

  // Proveedor en edición
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [savingSupplier, setSavingSupplier] = useState(false);

  // Formulario
  const [formData, setFormData] = useState({
    code: '',
    company: '',
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    category: 'Ingredientes',
    suppliedItemIds: [],
  });

  // Modal Eliminar
  const [supplierToDelete, setSupplierToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Cargar datos
  const loadData = async () => {
    try {
      setLoading(true);
      const [dataSuppliers, dataInventory] = await Promise.all([
        inventarioService.obtenerProveedores(),
        inventarioService.obtenerInsumos(),
      ]);

      const formattedSuppliers = (Array.isArray(dataSuppliers) ? dataSuppliers : []).map((sup) => ({
        id: String(sup.id),
        code: sup.codigo || '',
        company: sup.empresa || '',
        firstName: sup.nombre_contacto || '',
        lastName: sup.apellido_contacto || '',
        phone: sup.telefono || '',
        email: sup.email || '',
        category: sup.rubro || 'General',
        suppliedItemIds: Array.isArray(sup.insumos_asignados_ids)
          ? sup.insumos_asignados_ids.map(Number)
          : [],
        insumos: sup.insumos || [],
      }));

      setSuppliers(formattedSuppliers);
      setInventory(Array.isArray(dataInventory) ? dataInventory : []);
    } catch (error) {
      toast.error(error.message || 'Error al cargar proveedores e insumos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Lista de rubros disponibles basados en insumos y proveedores
  const inventoryCategories = useMemo(() => {
    const cats = new Set(['Ingredientes', 'Bebidas', 'Suministros', 'Panadería']);
    inventory.forEach((i) => {
      if (i.rubro && i.rubro.trim()) cats.add(i.rubro.trim());
    });
    suppliers.forEach((s) => {
      if (s.category && s.category.trim()) cats.add(s.category.trim());
    });
    return Array.from(cats);
  }, [inventory, suppliers]);

  // Generar próximo código sugerido
  const generateNextCode = () => {
    const numbers = suppliers
      .map((s) => {
        const m = s.code?.match(/PRV-(\d+)/i);
        return m ? parseInt(m[1], 10) : 0;
      })
      .filter((n) => !isNaN(n));
    const max = numbers.length > 0 ? Math.max(...numbers) : 0;
    return `PRV-${String(max + 1).padStart(3, '0')}`;
  };

  // Abrir vista para crear
  const handleOpenCreate = () => {
    setEditingSupplier(null);
    setFormData({
      code: generateNextCode(),
      company: '',
      firstName: '',
      lastName: '',
      phone: '',
      email: '',
      category: inventoryCategories[0] || 'Ingredientes',
      suppliedItemIds: [],
    });
    setCurrentView('form');
  };

  // Abrir vista para editar
  const handleOpenEdit = (sup) => {
    setEditingSupplier(sup);
    setFormData({
      code: sup.code || '',
      company: sup.company || '',
      firstName: sup.firstName || '',
      lastName: sup.lastName || '',
      phone: sup.phone || '',
      email: sup.email || '',
      category: sup.category || (inventoryCategories[0] || 'Ingredientes'),
      suppliedItemIds: [...sup.suppliedItemIds],
    });
    setCurrentView('form');
  };

  const handleCancelForm = () => {
    setEditingSupplier(null);
    setCurrentView('list');
  };

  // Toggle fila expandida para ver insumos
  const toggleExpand = (id) => {
    setExpandedSupplier((prev) => (prev === id ? null : id));
  };

  // Toggle de insumo en selección
  const toggleSuppliedItem = (itemId) => {
    const id = Number(itemId);
    setFormData((prev) => {
      const exists = prev.suppliedItemIds.includes(id);
      return {
        ...prev,
        suppliedItemIds: exists
          ? prev.suppliedItemIds.filter((x) => x !== id)
          : [...prev.suppliedItemIds, id],
      };
    });
  };

  // Guardar Proveedor
  const handleSaveSupplier = async (e) => {
    e.preventDefault();

    if (!formData.code.trim()) {
      toast.error('El código es obligatorio');
      return;
    }
    if (!formData.company.trim()) {
      toast.error('El nombre de la empresa es obligatorio');
      return;
    }

    try {
      setSavingSupplier(true);
      const payload = {
        codigo: formData.code.trim(),
        empresa: formData.company.trim(),
        nombre_contacto: formData.firstName.trim() || null,
        apellido_contacto: formData.lastName.trim() || null,
        telefono: formData.phone.trim() || null,
        email: formData.email.trim() || null,
        rubro: formData.category.trim() || null,
        insumos_asignados_ids: formData.suppliedItemIds,
      };

      if (editingSupplier) {
        await inventarioService.actualizarProveedor(editingSupplier.id, payload);
        toast.success('Proveedor actualizado correctamente');
      } else {
        await inventarioService.crearProveedor(payload);
        toast.success('Proveedor registrado correctamente');
      }

      setEditingSupplier(null);
      setCurrentView('list');
      loadData();
    } catch (error) {
      toast.error(error.message || 'Error al guardar el proveedor');
    } finally {
      setSavingSupplier(false);
    }
  };

  // Eliminar Proveedor
  const handleDeleteSupplier = async () => {
    if (!supplierToDelete) return;
    try {
      setDeleting(true);
      await inventarioService.eliminarProveedor(supplierToDelete.id);
      toast.success('Proveedor eliminado correctamente');
      setSupplierToDelete(null);
      loadData();
    } catch (error) {
      toast.error(error.message || 'Error al eliminar el proveedor');
    } finally {
      setDeleting(false);
    }
  };

  // Insumos disponibles en el rubro seleccionado para el formulario
  const itemsInCategory = useMemo(() => {
    if (!formData.category || formData.category === 'Todos') return inventory;
    return inventory.filter(
      (item) => item.rubro?.toLowerCase() === formData.category.toLowerCase()
    );
  }, [inventory, formData.category]);

  return (
    <div className="flex flex-col h-full bg-[#F3E5DC] min-h-[calc(100vh-4rem)]">
      {/* Header superior idéntico a Cafeteria_1 */}
      <div className="flex items-center justify-between p-4 bg-[#EAD5C8] border-b border-[#D7BBA6]">
        <h2 className="text-xl font-bold text-[#4B2B1D]">Proveedores</h2>

        {currentView === 'list' ? (
          <Button
            type="button"
            onClick={handleOpenCreate}
            className="px-4 py-2 bg-[#9F4F2F] text-white rounded-md text-sm font-semibold hover:bg-[#8A4326] flex items-center gap-2 shadow-sm h-9"
          >
            <Plus className="w-4 h-4" />
            <span>Proveedor nuevo</span>
          </Button>
        ) : (
          <Button
            type="button"
            onClick={handleCancelForm}
            className="px-4 py-2 bg-[#70422B] text-white rounded-md text-sm font-semibold hover:bg-[#5C3522] flex items-center gap-2 shadow-sm h-9"
          >
            Volver a la Lista
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-auto p-4 flex">
        {/* VISTA 1: LISTA DE PROVEEDORES */}
        {currentView === 'list' && (
          <div className="flex-1 bg-white rounded-xl shadow-sm p-6 overflow-hidden flex flex-col h-full border border-gray-100">
            <h2 className="text-2xl font-bold text-[#4B2B1D] mb-6">Lista de Proveedores</h2>

            <div className="flex-1 overflow-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-[#F9F4F0] sticky top-0 z-10">
                  <tr>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-[#4B2B1D] uppercase tracking-wider"
                    >
                      Código
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-[#4B2B1D] uppercase tracking-wider"
                    >
                      Empresa / Contacto
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-[#4B2B1D] uppercase tracking-wider"
                    >
                      Rubro
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-[#4B2B1D] uppercase tracking-wider"
                    >
                      Email / Teléfono
                    </th>
                    <th scope="col" className="relative px-6 py-3 text-right text-xs font-medium text-[#4B2B1D] uppercase tracking-wider">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <RefreshCw className="w-5 h-5 animate-spin text-[#4B2B1D]" />
                          <span className="text-sm">Cargando distribuidores...</span>
                        </div>
                      </td>
                    </tr>
                  ) : suppliers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                        <p className="text-sm font-medium">No hay proveedores registrados todavía.</p>
                        <p className="text-xs text-gray-400 mt-1">
                          Hacé clic en "Proveedor nuevo" para agregar el primero.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    suppliers.map((sup) => (
                      <React.Fragment key={sup.id}>
                        <tr className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {sup.code}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-bold text-gray-900">{sup.company}</div>
                            <div className="text-sm text-gray-500">
                              {[sup.firstName, sup.lastName].filter(Boolean).join(' ') || '-'}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-md text-xs font-medium">
                              {sup.category}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <div>{sup.email || '-'}</div>
                            <div className="text-gray-400 text-xs mt-0.5">{sup.phone || '-'}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <button
                              type="button"
                              onClick={() => toggleExpand(sup.id)}
                              className="text-blue-600 hover:text-blue-900 mr-4 p-1 hover:bg-blue-50 rounded"
                              title="Ver Insumos Suministrados"
                            >
                              <PackageOpen className="w-5 h-5 inline" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(sup)}
                              className="text-[#9F4F2F] hover:text-[#70422B] mr-4 p-1 hover:bg-[#F3E5DC] rounded"
                              title="Editar"
                            >
                              <Edit2 className="w-5 h-5 inline" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setSupplierToDelete(sup)}
                              className="text-red-600 hover:text-red-900 p-1 hover:bg-red-50 rounded"
                              title="Eliminar"
                            >
                              <Trash2 className="w-5 h-5 inline" />
                            </button>
                          </td>
                        </tr>

                        {/* Fila expandida con los insumos suministrados */}
                        {expandedSupplier === sup.id && (
                          <tr className="bg-gray-50">
                            <td colSpan={5} className="px-6 py-4">
                              <div className="border border-gray-200 rounded-lg p-4 bg-white shadow-inner">
                                <h4 className="text-sm font-bold text-[#4B2B1D] mb-3 flex items-center gap-2">
                                  <Box className="w-4 h-4" /> Insumos suministrados
                                </h4>
                                {sup.suppliedItemIds.length > 0 ? (
                                  <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                    {sup.suppliedItemIds.map((itemId) => {
                                      const item = inventory.find((i) => i.id === itemId);
                                      return (
                                        <li key={itemId}>
                                          <div className="text-left w-full px-3 py-2 text-sm text-blue-700 bg-blue-50/50 rounded-md flex items-center gap-2 border border-blue-100">
                                            <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0"></div>
                                            <span className="font-medium truncate">
                                              {item ? item.nombre : `Insumo (#${itemId})`}
                                            </span>
                                            {item && (
                                              <span className="text-xs text-gray-400 ml-auto shrink-0">
                                                ({item.unidad_medida})
                                              </span>
                                            )}
                                          </div>
                                        </li>
                                      );
                                    })}
                                  </ul>
                                ) : (
                                  <p className="text-sm text-gray-500 italic">
                                    Este proveedor no tiene insumos asignados.
                                  </p>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* VISTA 2: FORMULARIO ALTA / EDICIÓN */}
        {currentView === 'form' && (
          <div className="flex-1 bg-white rounded-xl shadow-sm p-6 overflow-auto border border-gray-100">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-2xl font-bold text-[#4B2B1D] mb-6">
                {editingSupplier ? 'Editar Proveedor' : 'Agregar Nuevo Proveedor'}
              </h2>

              <form onSubmit={handleSaveSupplier} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Columna Izquierda: Datos de Empresa */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-[#70422B] border-b pb-2">
                      Datos de Empresa
                    </h3>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="block text-sm font-medium text-gray-700">Código *</Label>
                        <Input
                          type="text"
                          required
                          value={formData.code}
                          onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#9F4F2F] focus:ring-[#9F4F2F] sm:text-sm h-9"
                          placeholder="PRV-001"
                        />
                      </div>
                      <div>
                        <Label className="block text-sm font-medium text-gray-700">Empresa *</Label>
                        <Input
                          type="text"
                          required
                          value={formData.company}
                          onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#9F4F2F] focus:ring-[#9F4F2F] sm:text-sm h-9"
                          placeholder="Ej: Distribuidora Los Andes"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="block text-sm font-medium text-gray-700">
                          Nombre Contacto
                        </Label>
                        <Input
                          type="text"
                          value={formData.firstName}
                          onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#9F4F2F] focus:ring-[#9F4F2F] sm:text-sm h-9"
                          placeholder="Carlos"
                        />
                      </div>
                      <div>
                        <Label className="block text-sm font-medium text-gray-700">
                          Apellido Contacto
                        </Label>
                        <Input
                          type="text"
                          value={formData.lastName}
                          onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#9F4F2F] focus:ring-[#9F4F2F] sm:text-sm h-9"
                          placeholder="Gómez"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="block text-sm font-medium text-gray-700">Teléfono</Label>
                        <Input
                          type="text"
                          value={formData.phone}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#9F4F2F] focus:ring-[#9F4F2F] sm:text-sm h-9"
                          placeholder="11-4567-8910"
                        />
                      </div>
                      <div>
                        <Label className="block text-sm font-medium text-gray-700">Email</Label>
                        <Input
                          type="email"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#9F4F2F] focus:ring-[#9F4F2F] sm:text-sm h-9"
                          placeholder="ventas@losandes.com"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Columna Derecha: Rubro e Insumos */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-[#70422B] border-b pb-2">
                      Rubro e Insumos
                    </h3>

                    <div>
                      <Label className="block text-sm font-medium text-gray-700">
                        Rubro Principal
                      </Label>
                      <select
                        name="category"
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        className="mt-1 block w-full rounded-md border border-gray-300 bg-white shadow-sm focus:border-[#9F4F2F] focus:ring-[#9F4F2F] sm:text-sm h-9 px-3"
                      >
                        {inventoryCategories.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-gray-500 mt-1">
                        El rubro ayuda a organizar los insumos que provee.
                      </p>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <Label className="block text-sm font-medium text-gray-700">
                          Insumos Suministrados ({formData.suppliedItemIds.length})
                        </Label>
                        <button
                          type="button"
                          onClick={() => {
                            if (formData.suppliedItemIds.length === inventory.length) {
                              setFormData({ ...formData, suppliedItemIds: [] });
                            } else {
                              setFormData({
                                ...formData,
                                suppliedItemIds: inventory.map((i) => i.id),
                              });
                            }
                          }}
                          className="text-xs text-[#9F4F2F] hover:underline"
                        >
                          {formData.suppliedItemIds.length === inventory.length
                            ? 'Deseleccionar todos'
                            : 'Seleccionar todos'}
                        </button>
                      </div>

                      {/* Lista de selección interactiva de insumos */}
                      <div className="border border-gray-300 rounded-md p-2 h-48 overflow-y-auto bg-gray-50/50 space-y-1.5">
                        {inventory.length === 0 ? (
                          <p className="text-xs text-center text-gray-400 py-6">
                            No hay insumos registrados en el sistema todavía.
                          </p>
                        ) : (
                          inventory.map((item) => {
                            const selected = formData.suppliedItemIds.includes(item.id);
                            return (
                              <div
                                key={item.id}
                                onClick={() => toggleSuppliedItem(item.id)}
                                className={`flex items-center justify-between px-3 py-2 rounded-md text-xs cursor-pointer border transition-colors ${
                                  selected
                                    ? 'bg-[#9F4F2F] text-white border-[#9F4F2F]'
                                    : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-100'
                                }`}
                              >
                                <div className="flex items-center gap-2 truncate">
                                  <div
                                    className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                                      selected
                                        ? 'bg-white text-[#9F4F2F] border-white'
                                        : 'border-gray-300 bg-white'
                                    }`}
                                  >
                                    {selected && <Check className="w-3 h-3 stroke-[3]" />}
                                  </div>
                                  <span className="font-medium truncate">{item.nombre}</span>
                                </div>
                                <span
                                  className={`text-[11px] ml-2 shrink-0 ${
                                    selected ? 'text-white/80' : 'text-gray-400'
                                  }`}
                                >
                                  {item.unidad_medida}
                                </span>
                              </div>
                            );
                          })
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-1.5">
                        Hacé clic sobre los insumos para vincularlos o desvincularlos.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-5 border-t border-gray-200 flex justify-end gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCancelForm}
                    className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={savingSupplier}
                    className="py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-[#9F4F2F] hover:bg-[#8A4326]"
                  >
                    {savingSupplier && <RefreshCw className="w-4 h-4 animate-spin mr-2" />}
                    <span>{editingSupplier ? 'Guardar Cambios' : 'Guardar Proveedor'}</span>
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>

      {/* Modal Shadcn: Confirmar Eliminación */}
      <Dialog
        open={Boolean(supplierToDelete)}
        onOpenChange={(open) => !open && setSupplierToDelete(null)}
      >
        <DialogContent className="max-w-md bg-white rounded-2xl p-6 shadow-xl border-0">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-red-600 flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-red-600" />
              <span>Eliminar Proveedor</span>
            </DialogTitle>
          </DialogHeader>

          <p className="text-sm text-gray-600 pt-2">
            ¿Estás seguro de que deseas eliminar al distribuidor{' '}
            <strong className="text-gray-900">{supplierToDelete?.company}</strong> (
            {supplierToDelete?.code})?
            <br />
            Esta acción no se puede deshacer.
          </p>

          <DialogFooter className="pt-4 gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setSupplierToDelete(null)}
              disabled={deleting}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleDeleteSupplier}
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

