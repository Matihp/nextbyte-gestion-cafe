import { Routes, Route } from 'react-router-dom';
import DashboardLayout from './layouts/DashboardLayout';
import Home from './features/dashboard/Home';
import Estadisticas from './features/reportes/Estadisticas';

// Vista vacía para los módulos que cada integrante del equipo desarrollará
function EmptyModule() {
  return null;
}

function App() {
  return (
    <Routes>
      {/* RUTAS PRIVADAS (Con Menú Lateral del Layout y Encabezado) */}
      <Route element={<DashboardLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/pedidos" element={<EmptyModule />} />
        <Route path="/comandas" element={<EmptyModule />} />
        <Route path="/productos" element={<EmptyModule />} />
        <Route path="/inventario" element={<EmptyModule />} />
        <Route path="/empleados" element={<EmptyModule />} />
        <Route path="/proveedores" element={<EmptyModule />} />
        <Route path="/caja" element={<EmptyModule />} />
        <Route path="/estadisticas" element={<Estadisticas />} />
        <Route path="/pantalla-cliente" element={<EmptyModule />} />
        <Route path="/clientes" element={<EmptyModule />} />
      </Route>
    </Routes>
  );
}

export default App;
