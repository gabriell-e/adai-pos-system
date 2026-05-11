const Database = require('better-sqlite3')
const path = require('path')

const db = new Database(path.join(__dirname, 'adai.db'))

// Rendimiento y consistencia
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

const init = () => {
  db.exec(`

    CREATE TABLE IF NOT EXISTS configuracion (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      razon_social TEXT NOT NULL,
      ruc TEXT NOT NULL,
      direccion TEXT,
      telefono TEXT,
      timbrado TEXT NOT NULL,
      timbrado_inicio DATE NOT NULL,
      timbrado_vencimiento DATE,
      factura_desde INTEGER DEFAULT 1,
      punto_expedicion TEXT DEFAULT '001',
      establecimiento TEXT DEFAULT '001'
    );

    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      rol TEXT CHECK(rol IN ('admin', 'cajero')) DEFAULT 'cajero',
      activo INTEGER DEFAULT 1,
      creado_en DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS categorias (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT UNIQUE NOT NULL
    );

    CREATE TABLE IF NOT EXISTS productos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      codigo_barras TEXT UNIQUE,
      precio_compra REAL NOT NULL DEFAULT 0,
      precio_venta REAL NOT NULL,
      stock INTEGER NOT NULL DEFAULT 0,
      stock_minimo INTEGER DEFAULT 5,
      categoria_id INTEGER REFERENCES categorias(id),
      tasa_iva INTEGER CHECK(tasa_iva IN (0, 5, 10)) DEFAULT 10,
      activo INTEGER DEFAULT 1,
      creado_en DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS clientes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      ruc_ci TEXT,
      telefono TEXT,
      email TEXT,
      deuda_total REAL DEFAULT 0,
      creado_en DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS proveedores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      ruc TEXT,
      telefono TEXT,
      email TEXT,
      activo INTEGER DEFAULT 1,
      creado_en DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS ventas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      numero_factura TEXT UNIQUE,
      timbrado_id INTEGER REFERENCES configuracion(id),
      cliente_id INTEGER REFERENCES clientes(id),
      usuario_id INTEGER REFERENCES usuarios(id),
      condicion_venta TEXT CHECK(condicion_venta IN ('contado', 'credito')) DEFAULT 'contado',
      tipo_pago TEXT CHECK(tipo_pago IN ('efectivo', 'transferencia', 'qr', 'debito', 'fiado', 'mixto')),
      subtotal_gravado_10 REAL DEFAULT 0,
      subtotal_gravado_5 REAL DEFAULT 0,
      subtotal_exento REAL DEFAULT 0,
      iva_10 REAL DEFAULT 0,
      iva_5 REAL DEFAULT 0,
      descuento REAL DEFAULT 0,
      total REAL NOT NULL,
      monto_pagado REAL DEFAULT 0,
      vuelto REAL DEFAULT 0,
      orden_nro TEXT,
      estado TEXT CHECK(estado IN ('completada', 'anulada')) DEFAULT 'completada',
      creado_en DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS detalle_venta (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      venta_id INTEGER NOT NULL REFERENCES ventas(id),
      producto_id INTEGER NOT NULL REFERENCES productos(id),
      cantidad INTEGER NOT NULL,
      precio_unitario REAL NOT NULL,
      tasa_iva INTEGER NOT NULL,
      monto_iva REAL NOT NULL,
      subtotal REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS compras (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      numero_factura_proveedor TEXT,
      proveedor_id INTEGER REFERENCES proveedores(id),
      usuario_id INTEGER REFERENCES usuarios(id),
      subtotal_gravado_10 REAL DEFAULT 0,
      subtotal_gravado_5 REAL DEFAULT 0,
      subtotal_exento REAL DEFAULT 0,
      iva_10 REAL DEFAULT 0,
      iva_5 REAL DEFAULT 0,
      total REAL NOT NULL,
      estado TEXT CHECK(estado IN ('recibida', 'anulada')) DEFAULT 'recibida',
      creado_en DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS detalle_compra (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      compra_id INTEGER NOT NULL REFERENCES compras(id),
      producto_id INTEGER NOT NULL REFERENCES productos(id),
      cantidad INTEGER NOT NULL,
      precio_unitario REAL NOT NULL,
      tasa_iva INTEGER NOT NULL,
      monto_iva REAL NOT NULL,
      subtotal REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS movimientos_stock (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      producto_id INTEGER NOT NULL REFERENCES productos(id),
      usuario_id INTEGER REFERENCES usuarios(id),
      tipo TEXT CHECK(tipo IN ('entrada', 'salida', 'ajuste')) NOT NULL,
      cantidad INTEGER NOT NULL,
      referencia_tipo TEXT CHECK(referencia_tipo IN ('venta', 'compra', 'manual')),
      referencia_id INTEGER,
      motivo TEXT,
      creado_en DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS caja (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER REFERENCES usuarios(id),
      monto_inicial REAL NOT NULL,
      monto_final REAL,
      abierta_en DATETIME DEFAULT CURRENT_TIMESTAMP,
      cerrada_en DATETIME,
      estado TEXT CHECK(estado IN ('abierta', 'cerrada')) DEFAULT 'abierta'
    );

  `)

  console.log('✅ Base de datos inicializada')
}

module.exports = { db, init }