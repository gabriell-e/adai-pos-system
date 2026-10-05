const Database = require('better-sqlite3')
const path = require('path')
const { normalizarSql } = require('./utils/texto')

const db = new Database(path.join(__dirname, 'adai.db'))

// Rendimiento y consistencia
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

// norm(texto) quita acentos y baja a minúsculas dentro de SQL.
//
// SQLite no lo hace solo: su LIKE solo ignora mayúsculas y minúsculas de la
// ASCII, no los acentos, así que "jose" nunca encontraba "José". Con esta
// función los buscadores del servidor se comportan como los del cliente.
db.function('norm', { deterministic: true }, normalizarSql)

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
      creado_en DATETIME DEFAULT (datetime('now', 'localtime'))
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
      stock REAL NOT NULL DEFAULT 0,
      stock_minimo REAL DEFAULT 5,
      categoria_id INTEGER REFERENCES categorias(id),
      tasa_iva INTEGER CHECK(tasa_iva IN (0, 5, 10)) DEFAULT 10,
      unidad TEXT DEFAULT 'unidad',
      activo INTEGER DEFAULT 1,
      creado_en DATETIME DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS clientes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      ruc_ci TEXT,
      telefono TEXT,
      email TEXT,
      deuda_total REAL DEFAULT 0,
      creado_en DATETIME DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS proveedores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      ruc TEXT,
      telefono TEXT,
      email TEXT,
      activo INTEGER DEFAULT 1,
      creado_en DATETIME DEFAULT (datetime('now', 'localtime'))
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
      fiado_pagada INTEGER DEFAULT 0,
      cobrado_en DATETIME,
      creado_en DATETIME DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS detalle_venta (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      venta_id INTEGER NOT NULL REFERENCES ventas(id),
      producto_id INTEGER NOT NULL REFERENCES productos(id),
      presentacion_id INTEGER REFERENCES presentaciones_producto(id),
      cantidad REAL NOT NULL,
      precio_unitario REAL NOT NULL,
      tasa_iva INTEGER NOT NULL,
      monto_iva REAL NOT NULL,
      subtotal REAL NOT NULL,
      precio_compra_unitario REAL
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
      creado_en DATETIME DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS detalle_compra (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      compra_id INTEGER NOT NULL REFERENCES compras(id),
      producto_id INTEGER NOT NULL REFERENCES productos(id),
      presentacion_id INTEGER REFERENCES presentaciones_producto(id),
      cantidad REAL NOT NULL,
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
      cantidad REAL NOT NULL,
      referencia_tipo TEXT CHECK(referencia_tipo IN ('venta', 'compra', 'manual')),
      referencia_id INTEGER,
      motivo TEXT,
      creado_en DATETIME DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS presentaciones_producto (
      id                   INTEGER PRIMARY KEY AUTOINCREMENT,
      producto_id          INTEGER NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
      nombre               TEXT    NOT NULL,
      unidades_por_paquete REAL    NOT NULL DEFAULT 1,
      precio_venta         REAL    NOT NULL DEFAULT 0,
      precio_compra        REAL    NOT NULL DEFAULT 0,
      codigo_barras        TEXT,
      es_venta_defecto     INTEGER NOT NULL DEFAULT 0,
      es_compra_defecto    INTEGER NOT NULL DEFAULT 0,
      creado_en            DATETIME DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS caja (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER REFERENCES usuarios(id),
      monto_inicial REAL NOT NULL,
      monto_final REAL,
      abierta_en DATETIME DEFAULT (datetime('now', 'localtime')),
      cerrada_en DATETIME,
      estado TEXT CHECK(estado IN ('abierta', 'cerrada')) DEFAULT 'abierta'
    );

    CREATE TABLE IF NOT EXISTS consumo_propio (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      producto_id INTEGER NOT NULL REFERENCES productos(id),
      usuario_id INTEGER REFERENCES usuarios(id),
      cantidad REAL NOT NULL,
      motivo TEXT,
      creado_en DATETIME DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS gastos (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id       INTEGER REFERENCES usuarios(id),
      descripcion      TEXT    NOT NULL,
      monto            REAL    NOT NULL,
      categoria        TEXT,
      estado           TEXT    NOT NULL DEFAULT 'registrado'
                       CHECK(estado IN ('registrado', 'anulado')),
      anulado_por      INTEGER REFERENCES usuarios(id),
      anulado_en       DATETIME,
      motivo_anulacion TEXT,
      creado_en        DATETIME DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS configuracion_backup (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      email_remitente     TEXT,
      email_app_password  TEXT,
      email_destinatarios  TEXT,
      frecuencia_dias     INTEGER NOT NULL DEFAULT 7,
      aviso_email_activo  INTEGER NOT NULL DEFAULT 0,
      ultimo_respaldo_en  DATETIME,
      ultimo_aviso_en     DATETIME,
      creado_en           DATETIME DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS respaldos (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      archivo     TEXT    NOT NULL,
      tamano      INTEGER NOT NULL,
      automatico  INTEGER NOT NULL DEFAULT 1,
      creado_en   DATETIME DEFAULT (datetime('now', 'localtime'))
    );

  `)

  // Índices — la base creció a miles de filas y sin esto
  // cada consulta hace full table scan + sort.
  try { db.exec("CREATE INDEX IF NOT EXISTS idx_ventas_creado   ON ventas(creado_en DESC)") } catch (_) {}
  try { db.exec("CREATE INDEX IF NOT EXISTS idx_ventas_estado   ON ventas(estado)") } catch (_) {}
  try { db.exec("CREATE INDEX IF NOT EXISTS idx_ventas_tipo     ON ventas(tipo_pago)") } catch (_) {}
  try { db.exec("CREATE INDEX IF NOT EXISTS idx_ventas_cliente  ON ventas(cliente_id)") } catch (_) {}
  try { db.exec("CREATE INDEX IF NOT EXISTS idx_ventas_fiado    ON ventas(fiado_pagada)") } catch (_) {}
  try { db.exec("CREATE INDEX IF NOT EXISTS idx_det_venta_venta ON detalle_venta(venta_id)") } catch (_) {}
  try { db.exec("CREATE INDEX IF NOT EXISTS idx_det_venta_prod  ON detalle_venta(producto_id)") } catch (_) {}
  try { db.exec("CREATE INDEX IF NOT EXISTS idx_det_compra_compra ON detalle_compra(compra_id)") } catch (_) {}
  try { db.exec("CREATE INDEX IF NOT EXISTS idx_det_compra_prod   ON detalle_compra(producto_id)") } catch (_) {}
  try { db.exec("CREATE INDEX IF NOT EXISTS idx_mov_prod   ON movimientos_stock(producto_id)") } catch (_) {}
  try { db.exec("CREATE INDEX IF NOT EXISTS idx_mov_fecha  ON movimientos_stock(creado_en DESC)") } catch (_) {}
  try { db.exec("CREATE INDEX IF NOT EXISTS idx_pres_prod  ON presentaciones_producto(producto_id)") } catch (_) {}
  try { db.exec("CREATE INDEX IF NOT EXISTS idx_consumo_fecha ON consumo_propio(creado_en DESC)") } catch (_) {}
  try { db.exec("CREATE INDEX IF NOT EXISTS idx_gastos_fecha  ON gastos(creado_en DESC)") } catch (_) {}
  try { db.exec("CREATE INDEX IF NOT EXISTS idx_gastos_estado ON gastos(estado)") } catch (_) {}
  try { db.exec("CREATE INDEX IF NOT EXISTS idx_productos_activo ON productos(activo)") } catch (_) {}

  // Migraciones para bases de datos existentes
  try { db.exec("ALTER TABLE productos ADD COLUMN unidad TEXT DEFAULT 'unidad'") } catch (_) {}
  try { db.exec("ALTER TABLE productos ADD COLUMN unidad_base TEXT DEFAULT 'unidad'") } catch (_) {}
  try { db.exec("ALTER TABLE detalle_venta ADD COLUMN precio_compra_unitario REAL") } catch (_) {}
  try { db.exec("ALTER TABLE detalle_venta ADD COLUMN presentacion_id INTEGER REFERENCES presentaciones_producto(id)") } catch (_) {}
  try { db.exec("ALTER TABLE detalle_compra ADD COLUMN presentacion_id INTEGER REFERENCES presentaciones_producto(id)") } catch (_) {}
  try { db.exec("ALTER TABLE ventas ADD COLUMN fiado_pagada INTEGER DEFAULT 0") } catch (_) {}
  try { db.exec("ALTER TABLE ventas ADD COLUMN cobrado_en DATETIME") } catch (_) {}
  try { db.exec("ALTER TABLE ventas ADD COLUMN pago_detalle TEXT") } catch (_) {}

  // Caja: cuánto se descontó por gastos personales en el cierre
  try { db.exec("ALTER TABLE caja ADD COLUMN total_gastos REAL DEFAULT 0") } catch (_) {}

  // Primera vez: dejar fila de configuración de respaldo
  const configBackup = db.prepare('SELECT id FROM configuracion_backup LIMIT 1').get()
  if (!configBackup) {
    db.prepare(`
      INSERT INTO configuracion_backup (email_remitente, frecuencia_dias, aviso_email_activo)
      VALUES ('', 7, 0)
    `).run()
  }

  console.log('✅ Base de datos inicializada')
}

module.exports = { db, init }