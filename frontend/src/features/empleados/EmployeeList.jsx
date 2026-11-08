import React, { useState } from 'react';
import { Search, Edit2, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { getRoleDisplayName } from '@/constants/roles';

export function EmployeeList({ employees = [], roles = [], onEdit, onDelete }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [employeeToDelete, setEmployeeToDelete] = useState(null);

  const filteredEmployees = employees.filter((emp) => {
    const firstName = emp.firstName || emp.nombre || '';
    const lastName = emp.lastName || emp.apellido || '';
    const legajo = emp.legajo || '';
    const term = searchTerm.toLowerCase();

    return (
      emp.id !== 'emp-admin' &&
      emp.id !== 'emp-customer' &&
      (firstName.toLowerCase().includes(term) ||
        lastName.toLowerCase().includes(term) ||
        legajo.toLowerCase().includes(term))
    );
  });

  const handleConfirmDelete = () => {
    if (employeeToDelete && onDelete) {
      onDelete(employeeToDelete.id);
      setEmployeeToDelete(null);
    }
  };

  return (
    <div className="flex-1 bg-white rounded-xl shadow-sm p-6 flex flex-col h-full min-w-0 max-w-full overflow-hidden">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h2 className="text-2xl font-bold text-[#4B2B1D]">Lista de Empleados</h2>
        <div className="relative w-full sm:w-72">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-gray-400" />
          </div>
          <Input
            type="text"
            className="pl-9 pr-3 py-2 bg-white text-sm"
            placeholder="Buscar por nombre, apellido, legajo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 overflow-auto border border-gray-200 rounded-lg max-w-full">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-[#F9F4F0] sticky top-0 z-10">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-[#4B2B1D] uppercase tracking-wider">
                Empleado
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-[#4B2B1D] uppercase tracking-wider">
                Legajo
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-[#4B2B1D] uppercase tracking-wider">
                Rol
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-[#4B2B1D] uppercase tracking-wider">
                Contacto
              </th>
              <th scope="col" className="relative px-6 py-3 text-right text-xs font-semibold text-[#4B2B1D] uppercase">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredEmployees.map((emp) => {
              const firstName = emp.firstName || emp.nombre || '';
              const lastName = emp.lastName || emp.apellido || '';

              return (
                <tr key={emp.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <Avatar className="h-10 w-10 shrink-0">
                        <AvatarImage src={emp.photo || emp.foto} alt={firstName} className="object-cover" />
                        <AvatarFallback className="bg-[#EAD5C8] text-[#70422B] font-bold">
                          {firstName.charAt(0)}
                          {lastName.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="ml-4 max-w-[200px] min-w-0">
                        <div className="text-sm font-semibold text-gray-900 truncate" title={`${firstName} ${lastName}`}>
                          {firstName} {lastName}
                        </div>
                        <div className="text-xs text-gray-500 truncate" title={emp.email}>{emp.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 font-mono max-w-[150px] truncate" title={emp.legajo || '-'}>
                    {emp.legajo || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-[#F3E5DC] text-[#70422B]">
                      {(() => {
                        const r = roles.find((item) => item.id === (emp.roleId || emp.rol_id));
                        if (r) return getRoleDisplayName(r);
                        if (emp.roleId === 'role-admin' || emp.es_admin) return 'Administrador';
                        return 'Empleado';
                      })()}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 max-w-[150px] truncate" title={emp.phone || emp.telefono || '-'}>
                    {emp.phone || emp.telefono || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      type="button"
                      onClick={() => onEdit && onEdit(emp)}
                      className="text-[#9F4F2F] hover:text-[#70422B] p-1.5 rounded-md hover:bg-[#F3E5DC] transition-colors mr-2 cursor-pointer"
                      title="Editar empleado"
                    >
                      <Edit2 className="w-4 h-4 inline" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setEmployeeToDelete(emp)}
                      className="text-red-600 hover:text-red-800 p-1.5 rounded-md hover:bg-red-50 transition-colors cursor-pointer"
                      title="Eliminar empleado"
                    >
                      <Trash2 className="w-4 h-4 inline" />
                    </button>
                  </td>
                </tr>
              );
            })}
            {filteredEmployees.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                  No se encontraron empleados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal de confirmación antes de eliminar */}
      <Dialog open={!!employeeToDelete} onOpenChange={(open) => !open && setEmployeeToDelete(null)}>
        <DialogContent className="sm:max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="text-[#4B2B1D]">Confirmar eliminación</DialogTitle>
            <DialogDescription className="text-gray-600">
              ¿Estás seguro de que deseás eliminar a{' '}
              <strong className="text-gray-900">
                {employeeToDelete?.firstName || employeeToDelete?.nombre}{' '}
                {employeeToDelete?.lastName || employeeToDelete?.apellido}
              </strong>
              ? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 sm:justify-end mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setEmployeeToDelete(null)}
              className="border-gray-300"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirmDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default EmployeeList;

