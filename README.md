# Adai POS System

Sistema de Punto de Venta (POS) desarrollado para **Despensa Adai** (Lambaré, Paraguay). Gestiona ventas, compras, stock, caja y clientes con facturación electrónica adaptada a requisitos paraguayos (IVA 5%, 10%, exento).

## Tech Stack

| Capa      | Tecnología                                     |
| --------- | ---------------------------------------------- |
| Backend   | Node.js + Express + better-sqlite3 + JWT       |
| Frontend  | React 19 + Vite 8 + Tailwind CSS 4 + React Router 7 |
| BD        | SQLite (WAL mode, archivo único `server/adai.db`) |

## Inicio rápido

```bash
# 1. Instalar dependencias
cd server && npm install
cd ../client && npm install

# 2. Configurar variables de entorno
# server/.env (ya creado):
#   PORT=3001
#   TZ=America/Asuncion
#   JWT_SECRET=adai-pos-secret-key-change-in-production

# 3. Sembrar base de datos (crea tablas + datos iniciales)
cd server && npm run seed

# 4. Iniciar backend (puerto 3001)
npm run dev       # con nodemon
# o
npm start         # producción

# 5. En otra terminal, iniciar frontend (puerto 5173, con proxy a /api → :3001)
cd client && npm run dev
```

El frontend se abre en `http://localhost:5173` y proxy automático las llamadas `/api` al backend.

## Usuarios por defecto

| Email             | Password   | Rol    |
| ----------------- | ---------- | ------ |
| admin@adai.com    | admin123   | Admin  |
| cajero@adai.com   | cajero123  | Cajero |

## Scripts disponibles

### Server (`cd server`)

| Comando             | Descripción                          |
| ------------------- | ------------------------------------ |
| `npm run dev`       | Inicia servidor con nodemon          |
| `npm start`         | Inicia servidor en producción        |
| `npm run seed`      | Sembrar/restaurar base de datos      |

### Cliente (`cd client`)

| Comando          | Descripción                       |
| ---------------- | --------------------------------- |
| `npm run dev`    | Inicia dev server con Vite        |
| `npm run build`  | Build para producción             |
| `npm run preview`| Previsualiza build de producción  |

## Funcionalidades

- **Usuarios**: autenticación JWT, roles admin/cajero
- **Productos**: gestión con código de barras, precios, stock, IVA (5/10/exento)
- **Ventas**: facturación con desglose de IVA, cálculo automático de vuelto
- **Compras**: registro de compras a proveedores
- **Clientes/Proveedores**: gestión con RUC/CI y control de deudas
- **Caja**: apertura/cierre de caja por usuario
- **Configuración**: datos del negocio (RUC, timbrado, numeración de facturas)
- **Stock**: movimientos con trazabilidad (entrada/salida/ajuste)

## Licencia

MIT
