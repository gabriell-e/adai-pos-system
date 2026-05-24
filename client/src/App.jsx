import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import PrivateRoute from './components/PrivateRoute'
import Layout from './components/Layout'
import Login from './pages/Login'
import Productos from './pages/productos/Productos'
import Clientes from './pages/clientes/Clientes'
import Categorias from './pages/categorias/Categorias'
import Proveedores from './pages/proveedores/Proveedores'
import NuevaVenta   from './pages/ventas/NuevaVenta'
import DetalleVenta from './pages/ventas/DetalleVenta'
import Consumo      from './pages/consumo/Consumo'
import Usuarios     from './pages/usuarios/Usuarios'
import Ventas   from './pages/ventas/Ventas'
import Compras  from './pages/compras/Compras'
import Caja     from './pages/caja/Caja'
import Dashboard      from './pages/dashboard/Dashboard'
import Configuracion  from './pages/configuracion/Configuracion'

const App = () => (
  <BrowserRouter>
    <AuthProvider>
      <Routes>

        <Route path="/login" element={<Login />} />

        <Route path="/*" element={
          <PrivateRoute>
            <Layout>
              <Routes>
                <Route path="/"              element={<Dashboard />} />
                <Route path="/ventas"       element={<Ventas />} />
                <Route path="/ventas/nueva"  element={<NuevaVenta />} />
                <Route path="/ventas/:id"    element={<DetalleVenta />} />
                <Route path="/compras"      element={<Compras />} />
                <Route path="/productos" element={<Productos />} />
                <Route path="/clientes" element={<Clientes />} />
                <Route path="/categorias" element={<Categorias />} />
                <Route path="/proveedores" element={<Proveedores />} />
                <Route path="/consumo"     element={<Consumo />} />
                <Route path="/usuarios"    element={<Usuarios />} />
                <Route path="/caja"         element={<Caja />} />
                <Route path="/configuracion" element={<Configuracion />} />
              </Routes>
            </Layout>
          </PrivateRoute>
        } />

      </Routes>
    </AuthProvider>
  </BrowserRouter>
)

export default App