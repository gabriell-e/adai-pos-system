# Adai POS System

Sistema de punto de venta (POS) diseñado para despensas y comercios pequeños en Paraguay. Desarrollado como proyecto real en producción y como proyecto de portfolio, cubre el ciclo completo de un negocio minorista: desde la compra a proveedores hasta la facturación al cliente, con control de stock, caja diaria y soporte nativo para el sistema tributario paraguayo.

![Stack](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![Stack](https://img.shields.io/badge/Node.js-Express-339933?logo=node.js)
![Stack](https://img.shields.io/badge/SQLite-better--sqlite3-003B57?logo=sqlite)
![Stack](https://img.shields.io/badge/Auth-JWT-000000?logo=jsonwebtokens)

---

## Características principales

- **Punto de venta completo** — Carrito con búsqueda en tiempo real por nombre o código de barras, soporte para productos por unidad y por peso (kg/litro/gramo), descuentos, múltiples tipos de pago y cálculo de vuelto automático
- **Facturación paraguaya** — IVA 10%, 5% y exento con extracción correcta (precio incluye IVA), timbrado SET, RUC, numeración por establecimiento y punto de expedición
- **Control de stock transaccional** — Cada venta, compra, consumo propio o anulación actualiza el stock dentro de una transacción atómica. Si algo falla, nada se guarda
- **Gestión de caja** — Apertura con monto inicial, cierre con resumen del día: total vendido, efectivo esperado vs contado, costo de lo vendido y ganancia bruta real
- **Consumo propio** — Registro de productos retirados para uso personal con reversión de stock y auditoría
- **Valor de inventario** — Vista del stock valorizado a precio de compra y precio de venta, con margen por categoría
- **Auditoría de movimientos** — Cada entrada y salida de stock queda registrada con referencia al origen (venta, compra, consumo, ajuste manual)
- **Roles y acceso** — Admin con acceso completo, Cajero restringido a ventas y clientes
- **Alertas de stock mínimo** — Dashboard muestra productos por debajo del mínimo configurado

---

## Stack tecnológico

| Capa | Tecnología | Decisión |
|------|-----------|----------|
| Frontend | React 19 + Vite | Componentes modernos, build rápido |
| Routing | React Router 7 | SPA con rutas protegidas por rol |
| Estilos | Tailwind CSS 4 | Utility-first, sin dependencias extra |
| HTTP client | Axios | Interceptores para JWT automático |
| Backend | Node.js + Express 5 | Liviano, suficiente para escala single-location |
| Base de datos | SQLite + better-sqlite3 | Síncrono, sin servidor, ideal para un local |
| Auth | JWT + bcryptjs | Tokens con expiración de 12h, passwords hasheados |
| Zona horaria | `America/Asuncion` vía Node.js | Timestamps correctos sin depender del SO |

---

## Estructura del proyecto

```
adai-pos-system/
├── client/                        # Frontend React + Vite
│   └── src/
│       ├── api/
│       │   └── axios.js           # Cliente con interceptor JWT y manejo 401/403
│       ├── components/
│       │   ├── Layout.jsx         # Sidebar colapsable, navegación por rol
│       │   └── PrivateRoute.jsx   # Protección de rutas (rol + autenticación)
│       ├── context/
│       │   └── AuthContext.jsx    # Login, logout, estado de sesión
│       ├── pages/
│       │   ├── dashboard/         # Stats del día, stock bajo, inventario por categoría
│       │   ├── ventas/            # Nueva venta (carrito), detalle, listado
│       │   ├── compras/           # Registro de compras a proveedores
│       │   ├── productos/         # CRUD con unidades de venta y control de estado
│       │   ├── clientes/          # CRUD con historial de compras y deuda fiada
│       │   ├── proveedores/       # CRUD con historial de compras
│       │   ├── consumo/           # Registro de consumo propio con reversión
│       │   ├── caja/              # Apertura, cierre y resumen diario
│       │   └── configuracion/     # Datos del negocio y timbrado SET
│       └── utils/
│           ├── validar.js         # Validadores por tipo de campo (texto, RUC, teléfono, email)
│           └── useFormValidacion.js # Hook reutilizable de validación con errores inline
│
├── server/                        # Backend Express
│   ├── controllers/               # Lógica de negocio separada por módulo
│   ├── routes/                    # Definición de endpoints REST
│   ├── middlewares/
│   │   └── auth.middleware.js     # verificarToken + soloAdmin
│   ├── migrations/                # ALTER TABLE para BD existentes
│   ├── seeders/
│   │   └── seed.js                # Seed idempotente con datos de ejemplo
│   ├── utils/
│   │   └── fecha.js               # ahora() — timestamp en hora de Asunción
│   ├── db.js                      # Inicialización de SQLite y schema completo
│   └── index.js                   # Entry point, registro de rutas
└── README.md
```

---

## Modelo de base de datos

```
configuracion
      │
      ▼
  ventas ──────────── detalle_venta ──── productos ──── categorias
      │                    │                 │
  clientes            precio_compra    movimientos_stock
  usuarios            (histórico)
  caja

  compras ─────────── detalle_compra ─── productos
      │
  proveedores

  consumo_propio ───── productos
```

Tablas principales: `configuracion`, `usuarios`, `categorias`, `productos`, `clientes`, `proveedores`, `ventas`, `detalle_venta`, `compras`, `detalle_compra`, `movimientos_stock`, `caja`, `consumo_propio`.

---

## API Reference

### Autenticación
| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| POST | `/api/usuarios/login` | — | Login, devuelve JWT |
| POST | `/api/usuarios` | Admin* | Crear usuario (*público si BD vacía) |
| GET | `/api/usuarios` | Admin | Listar usuarios |
| PATCH | `/api/usuarios/:id/password` | Token | Cambiar contraseña |

### Productos
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/productos` | Listar todos |
| GET | `/api/productos/low-stock` | Productos bajo mínimo |
| GET | `/api/productos/inventario/valor` | Valor de stock (compra/venta/margen) |
| GET | `/api/productos/barcode/:codigo` | Buscar por código de barras |
| POST | `/api/productos` | Crear producto |
| PUT | `/api/productos/:id` | Actualizar (incluye stock) |
| DELETE | `/api/productos/:id` | Soft delete (desactivar) |
| PATCH | `/api/productos/:id/activar` | Reactivar |

### Ventas
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/ventas` | Listar ventas |
| GET | `/api/ventas/:id` | Detalle con items y datos fiscales |
| POST | `/api/ventas` | Registrar venta (transaccional) |
| PATCH | `/api/ventas/:id/anular` | Anular y revertir stock |

### Compras
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/compras` | Listar compras |
| GET | `/api/compras/:id` | Detalle con items |
| POST | `/api/compras` | Registrar compra (actualiza stock y precio_compra) |
| PATCH | `/api/compras/:id/anular` | Anular y revertir stock |

### Caja
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/caja` | Historial de cajas |
| GET | `/api/caja/activa` | Caja actualmente abierta |
| GET | `/api/caja/:id` | Detalle con ventas y resumen por tipo de pago |
| POST | `/api/caja/abrir` | Abrir caja con monto inicial |
| PATCH | `/api/caja/:id/cerrar` | Cerrar con resumen: ventas, ganancia bruta, diferencia |

### Otros
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET/POST | `/api/clientes` | Listar / Crear |
| GET | `/api/clientes/:id/historial` | Historial de compras del cliente |
| GET/POST | `/api/proveedores` | Listar / Crear |
| GET | `/api/proveedores/:id/historial` | Historial de compras al proveedor |
| GET/POST | `/api/consumo` | Historial / Registrar consumo propio |
| DELETE | `/api/consumo/:id/anular` | Anular consumo y revertir stock |
| GET/POST | `/api/configuracion` | Ver / Guardar datos del negocio y timbrado |

---

## Instalación en PC del cliente

### Requisitos
- Windows 10/11
- Node.js 18+ — https://nodejs.org
- Git — https://git-scm.com

### Paso a paso

1. **Instalar Node.js**  
   Descargar e instalar desde https://nodejs.org (versión LTS).  
   Marcar la opción "Add to PATH" durante la instalación.

2. **Instalar Git**  
   Descargar e instalar desde https://git-scm.com.  
   Usar las opciones por defecto.

3. **Abrir terminal**  
   Presionar `Win + R`, escribir `cmd` y presionar Enter.

4. **Clonar el sistema**
   ```bash
   cd %USERPROFILE%\Desktop
   git clone https://github.com/gabriell-e/adai-pos-system.git
   cd adai-pos-system
   ```

5. **Ejecutar instalador**
   ```bash
   instalar.bat
   ```
   - Instala dependencias del servidor y del cliente
   - Pregunta si cargar datos de ejemplo
   - Compila el frontend automáticamente

6. **Iniciar el sistema**
   ```bash
   iniciar.bat
   ```
   Se abre el navegador en `http://localhost:3001`

7. **Ingresar**  
   - **Admin:** `admin@adai.com` / `admin123`  
   - **Cajero:** `cajero@adai.com` / `cajero123`  
   - Ir a *Configuración* para cargar RUC, timbrado y datos del negocio.

### Actualizar el sistema

```bash
cd %USERPROFILE%\Desktop\adai-pos-system
git pull
instalar.bat
```

### Notas
- El sistema corre únicamente en `http://localhost:3001` (un solo puerto)
- Para cerrar, solo cerrar la ventana del terminal
- Base de datos local en `server/adai.db` — hacer copias de seguridad periódicas

---

## Decisiones técnicas destacadas

**SQLite sobre PostgreSQL** — Para un comercio de un solo local con baja concurrencia, SQLite es más que suficiente. Elimina la necesidad de configurar un servidor de base de datos y simplifica el deploy. Migrar a PostgreSQL en el futuro es directo con el mismo ORM.

**Transacciones atómicas en ventas y compras** — Toda operación que toca stock, caja y registros contables ocurre dentro de una transacción de `better-sqlite3`. Si falla cualquier paso, nada se persiste. Esto garantiza consistencia sin lógica de rollback manual.

**IVA incluido en precio** — En Paraguay el precio de venta ya incluye IVA. La extracción es `IVA = total / 11` para tasa 10% y `total / 21` para tasa 5%, aplicada con `Math.round()` para trabajar en guaraníes enteros.

**Timestamps desde Node.js** — `CURRENT_TIMESTAMP` de SQLite usa UTC sin importar el timezone del sistema operativo. La función `ahora()` genera el timestamp directamente en Node.js con `America/Asuncion`, garantizando horario correcto independientemente del entorno.

**Soft delete en productos** — Los productos nunca se eliminan físicamente porque están referenciados en el historial de ventas. Se desactivan con `activo = 0` y se pueden reactivar en cualquier momento.

**precio_compra_unitario en detalle_venta** — El precio de compra se copia al momento de registrar la venta. Esto permite calcular la ganancia bruta real al cerrar caja, incluso si el precio de compra del producto cambia después.

---

## Roadmap

- [ ] Impresión de tickets y facturas en PDF
- [ ] Escáner de código de barras por cámara
- [ ] Reportes de ventas por período (diario, semanal, mensual)
- [ ] Bot de WhatsApp para consulta de stock y notificación de deuda (Baileys)
- [ ] Dashboard con gráficos de tendencia
- [ ] Módulo de gestión de deuda fiada con pagos parciales
- [ ] Multi-usuario simultáneo con sincronización
- [ ] Export a Excel de ventas y movimientos de stock

---

## Autor

Desarrollado por **Gabriel** — Estudiante de Informática (4° año), Paraguay.

Proyecto construido como sistema real en producción para una despensa familiar y como primer proyecto de portfolio en GitHub, aplicando arquitectura REST, transacciones de base de datos, autenticación con JWT y buenas prácticas de desarrollo fullstack.
