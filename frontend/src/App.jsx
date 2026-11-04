import { Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import DashboardLayout from './layouts/DashboardLayout';
import Home from './features/dashboard/Home';
import Pedidos from './features/pedidos/Pedidos';
import Productos from './features/menu/Productos';
import Estadisticas from './features/reportes/Estadisticas';
import EmployeesPage from './features/empleados/EmployeesPage';
import OrdersPage from './features/comandas/OrdersPage';
import InventoryPage from './features/inventario/InventoryPage';
import SuppliersPage from './features/inventario/SuppliersPage';
import CustomerViewerPage from './features/clientes/CustomerViewerPage';
import { Toaster } from './components/ui/sonner';

function EmptyModule() {
  return null;
}

function App() {
  return (
    <AuthProvider>
      <Toaster position="top-right" richColors />
      <Routes>
        <Route path="/pantalla-cliente" element={<CustomerViewerPage />} />
        <Route element={<DashboardLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/pedidos" element={<Pedidos />} />
          <Route path="/comandas" element={<OrdersPage />} />
          <Route path="/productos" element={<Productos />} />
          <Route path="/inventario" element={<InventoryPage />} />
          <Route path="/empleados" element={<EmployeesPage />} />
          <Route path="/proveedores" element={<SuppliersPage />} />
          <Route path="/caja" element={<EmptyModule />} />
          <Route path="/estadisticas" element={<Estadisticas />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}

export default App;
