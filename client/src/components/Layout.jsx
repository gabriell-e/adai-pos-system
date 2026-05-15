import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const navItems = [
  { path: '/',                 label: 'Dashboard',    icon: '📊', rol: 'ambos' },
  { path: '/ventas/nueva',     label: 'Nueva Venta',  icon: '🛒', rol: 'ambos' },
  { path: '/ventas',           label: 'Ventas',       icon: '📋', rol: 'ambos' },
  { path: '/compras',          label: 'Compras',      icon: '📦', rol: 'admin' },
  { path: '/productos',        label: 'Productos',    icon: '🏷️',  rol: 'admin' },
  { path: '/clientes',         label: 'Clientes',     icon: '👥', rol: 'ambos' },
  { path: '/proveedores',      label: 'Proveedores',  icon: '🏭', rol: 'admin' },
  { path: '/caja',             label: 'Caja',         icon: '💰', rol: 'ambos' },
  { path: '/configuracion',    label: 'Configuración',icon: '⚙️',  rol: 'admin' },
]

const Layout = ({ children }) => {
  const { usuario, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [sidebarAbierto, setSidebarAbierto] = useState(true)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const itemsFiltrados = navItems.filter(item =>
    item.rol === 'ambos' || usuario?.rol === 'admin'
  )

  return (
    <div className="flex h-screen bg-gray-100 font-sans">

      {/* Sidebar */}
      <aside className={`
        ${sidebarAbierto ? 'w-56' : 'w-16'}
        bg-gray-900 text-white flex flex-col transition-all duration-200
      `}>
        {/* Logo */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-700">
          {sidebarAbierto && (
            <span className="text-xl font-bold text-emerald-400">Adai POS</span>
          )}
          <button
            onClick={() => setSidebarAbierto(!sidebarAbierto)}
            className="text-gray-400 hover:text-white text-lg"
          >
            {sidebarAbierto ? '◀' : '▶'}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 overflow-y-auto">
          {itemsFiltrados.map(item => (
            <Link
              key={item.path}
              to={item.path}
              className={`
                flex items-center gap-3 px-4 py-2.5 text-sm transition-colors
                ${location.pathname === item.path
                  ? 'bg-emerald-600 text-white'
                  : 'text-gray-300 hover:bg-gray-700 hover:text-white'}
              `}
            >
              <span className="text-base">{item.icon}</span>
              {sidebarAbierto && <span>{item.label}</span>}
            </Link>
          ))}
        </nav>

        {/* Usuario */}
        <div className="border-t border-gray-700 px-4 py-3">
          {sidebarAbierto && (
            <div className="mb-2">
              <p className="text-sm text-white font-medium truncate">{usuario?.nombre}</p>
              <p className="text-xs text-gray-400 capitalize">{usuario?.rol}</p>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-gray-400 hover:text-red-400 text-sm transition-colors"
          >
            <span>🚪</span>
            {sidebarAbierto && <span>Salir</span>}
          </button>
        </div>
      </aside>

      {/* Contenido */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-6">
          {children}
        </div>
      </main>

    </div>
  )
}

export default Layout