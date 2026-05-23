import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import PrivateRoute from './components/PrivateRoute'
import Layout from './components/Layout'
import Login from './pages/Login'
import Productos from './pages/productos/Productos'
import Clientes from './pages/clientes/Clientes'
import Proveedores from './pages/proveedores/Proveedores'
import NuevaVenta   from './pages/ventas/NuevaVenta'
import DetalleVenta from './pages/ventas/DetalleVenta'
import Consumo      from './pages/consumo/Consumo'

// Placeholder para páginas que vamos a construir
const Pronto = ({ nombre }) => (
  <div className="bg-white rounded-xl p-8 text-center text-gray-400">
    <p className="text-4xl mb-3">🚧</p>
    <p className="text-lg font-medium">{nombre}</p>
    <p className="text-sm">En construcción</p>
  </div>
)

const App = () => (
  <BrowserRouter>
    <AuthProvider>
      <Routes>

        <Route path="/login" element={<Login />} />

        <Route path="/*" element={
          <PrivateRoute>
            <Layout>
              <Routes>
                <Route path="/"              element={<Pronto nombre="Dashboard" />} />
                <Route path="/ventas"        element={<Pronto nombre="Ventas" />} />
                <Route path="/ventas/nueva"  element={<NuevaVenta />} />
                <Route path="/ventas/:id"    element={<DetalleVenta />} />
                <Route path="/compras"       element={<Pronto nombre="Compras" />} />
                <Route path="/productos" element={<Productos />} />
                <Route path="/clientes" element={<Clientes />} />
                <Route path="/proveedores" element={<Proveedores />} />
                <Route path="/consumo"     element={<Consumo />} />
                <Route path="/caja"         element={<Pronto nombre="Caja" />} />
                <Route path="/configuracion" element={<Pronto nombre="Configuración" />} />
                
              </Routes>
            </Layout>
          </PrivateRoute>
        } />

      </Routes>
    </AuthProvider>
  </BrowserRouter>
)

export default App