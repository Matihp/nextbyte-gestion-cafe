import { Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import DashboardLayout from './layouts/DashboardLayout';
import Home from './features/dashboard/Home';
import Productos from './features/menu/Productos';
import Estadisticas from './features/reportes/Estadisticas';
import ReporteCaja from './features/caja/ReporteCaja';
import EmployeesPage from './features/empleados/EmployeesPage';
import OrdersPage from './features/comandas/OrdersPage';
import { Toaster } from './components/ui/sonner';

function EmptyModule() {
  return null;
}

function App() {
  return (
    <AuthProvider>
      <Toaster position="top-right" richColors />
      <Routes>
        <Route element={<DashboardLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/pedidos" element={<EmptyModule />} />
          <Route path="/comandas" element={<OrdersPage />} />
          <Route path="/orders" element={<OrdersPage />} />
          <Route path="/productos" element={<Productos />} />
          <Route path="/inventario" element={<EmptyModule />} />
          <Route path="/empleados" element={<EmployeesPage />} />
          <Route path="/proveedores" element={<EmptyModule />} />
          <Route path="/caja" element={<ReporteCaja />} />
          <Route path="/salesReport" element={<ReporteCaja />} />
          <Route path="/estadisticas" element={<Estadisticas />} />
          <Route path="/pantalla-cliente" element={<EmptyModule />} />
          <Route path="/clientes" element={<EmptyModule />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}

export default App;
