# Adai POS System

Sistema de punto de venta (POS) para despensas y comercios pequeños, adaptado al sistema tributario de Paraguay (IVA 10%/5%/Exento, facturación con timbrado, RUC).

## Tecnologías

- **Frontend:** React 19, React Router 7, Tailwind CSS 4, Vite, Axios
- **Backend:** Node.js, Express 5, better-sqlite3 (SQLite)
- **Autenticación:** JWT con roles admin / cajero

## Requisitos

- Node.js 18+
- npm

## Instalación

```bash
# Clonar el repositorio
git clone <repo>
cd adai-pos-system

# Instalar dependencias del servidor
cd server
npm install

# Instalar dependencias del cliente
cd ../client
npm install
```

## Base de datos

```bash
cd server
npm run seed    # Pobla la base de datos con datos de prueba
```

Esto crea:
- **2 usuarios:** `admin@adai.com` / `admin123` (admin), `cajero@adai.com` / `cajero123` (cajero)
- Categorías, productos, clientes y proveedores de ejemplo
- Una configuración fiscal por defecto

## Ejecutar en desarrollo

Inicia ambos servidores simultáneamente:

```bash
# Terminal 1 — Backend (Express en puerto 3001)
cd server
npm run dev

# Terminal 2 — Frontend (Vite en puerto 5173)
cd client
npm run dev
```

El frontend redirige las llamadas `/api` al backend automáticamente.

## Estructura del proyecto

```
adai-pos-system/
├── client/                    # Frontend React
│   └── src/
│       ├── api/               # Cliente Axios con interceptor JWT
│       ├── components/        # Layout, PrivateRoute
│       ├── context/           # AuthContext (login/logout)
│       ├── pages/             # Vistas de la aplicación
│       │   ├── ventas/        # Nueva Venta y Detalle de Venta
│       │   ├── productos/     # CRUD productos
│       │   ├── clientes/      # CRUD clientes
│       │   └── proveedores/   # CRUD proveedores
│       └── utils/             # Validación de formularios
├── server/                    # Backend Express
│   ├── controllers/           # Lógica de negocio
│   ├── routes/                # Definición de rutas
│   ├── middlewares/           # Auth middleware
│   ├── utils/                 # Utilidades (fechas)
│   └── seeders/               # Seed de datos
└── README.md
```

## API

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/usuarios/login` | Inicio de sesión |
| GET/POST | `/api/productos` | Listar / Crear productos |
| PUT/DELETE | `/api/productos/:id` | Actualizar / Desactivar |
| GET/POST | `/api/clientes` | Listar / Crear clientes |
| GET/POST | `/api/proveedores` | Listar / Crear proveedores |
| POST | `/api/ventas` | Registrar venta (transaccional) |
| PATCH | `/api/ventas/:id/anular` | Anular venta (revierte stock) |
| POST | `/api/compras` | Registrar compra |
| POST | `/api/caja/abrir` | Abrir caja |
| PATCH | `/api/caja/:id/cerrar` | Cerrar caja |

## Funcionalidades

- **Punto de venta:** Búsqueda de productos, carrito, descuento, selección de pago (efectivo/transferencia/QR/débito/fiado/mixto), desglose de IVA, cálculo de vuelto
- **CRUD completo:** Productos, clientes, proveedores con búsqueda y validación
- **Control de stock:** Actualización automática al vender/comprar, alerta de stock mínimo
- **Movimientos de stock:** Auditoría completa de entradas, salidas y ajustes
- **Gestión de caja:** Apertura/cierre con resumen por tipo de pago
- **Roles:** Admin (gestión completa) y Cajero (solo ventas y clientes)
- **Facturación paraguaya:** IVA 10% y 5%, timbrado, RUC, numeración por establecimiento
