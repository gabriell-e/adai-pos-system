const Database = require('../server/node_modules/better-sqlite3')
const path = require('path')
const fs = require('fs')

const srcPath = process.argv[2] || path.join(__dirname, '..', 'adai.db')
const bakPath = srcPath + '.bak'

// Backup antes de tocar nada
fs.copyFileSync(srcPath, bakPath)
console.log('Backup creado:', bakPath)

const db = new Database(srcPath)
db.pragma('foreign_keys = ON')

const existe = (nombre) => {
  const r = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(nombre)
  return !!r
}

const columnaExiste = (tabla, columna) => {
  const cols = db.prepare('PRAGMA table_info(' + tabla + ')').all()
  return cols.some(c => c.name === columna)
}

const migrar = db.transaction(() => {

  // 1. Crear tabla presentaciones_producto si no existe
  if (!existe('presentaciones_producto')) {
    console.log('Creando tabla presentaciones_producto...')
    db.exec(`
      CREATE TABLE presentaciones_producto (
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
      )
    `)
    console.log('  OK')
  } else {
    console.log('presentaciones_producto ya existe, saltando')
  }

  // 2. Agregar columna unidad_base a productos
  if (!columnaExiste('productos', 'unidad_base')) {
    console.log('Agregando columna unidad_base a productos...')
    db.exec("ALTER TABLE productos ADD COLUMN unidad_base TEXT DEFAULT 'unidad'")
    console.log('  OK')
  } else {
    console.log('unidad_base ya existe en productos, saltando')
  }

  // 3. Agregar columna presentacion_id a detalle_venta
  if (!columnaExiste('detalle_venta', 'presentacion_id')) {
    console.log('Agregando columna presentacion_id a detalle_venta...')
    db.exec("ALTER TABLE detalle_venta ADD COLUMN presentacion_id INTEGER REFERENCES presentaciones_producto(id)")
    console.log('  OK')
  } else {
    console.log('presentacion_id ya existe en detalle_venta, saltando')
  }

  // 4. Agregar columna presentacion_id a detalle_compra
  if (!columnaExiste('detalle_compra', 'presentacion_id')) {
    console.log('Agregando columna presentacion_id a detalle_compra...')
    db.exec("ALTER TABLE detalle_compra ADD COLUMN presentacion_id INTEGER REFERENCES presentaciones_producto(id)")
    console.log('  OK')
  } else {
    console.log('presentacion_id ya existe en detalle_compra, saltando')
  }

  // 5. Crear presentaciones "Unidad" para productos que no tengan ninguna
  const productosSinPres = db.prepare(`
    SELECT p.id, p.nombre, p.precio_venta, p.precio_compra, p.codigo_barras
    FROM productos p
    WHERE p.activo = 1
    AND NOT EXISTS (
      SELECT 1 FROM presentaciones_producto pp WHERE pp.producto_id = p.id
    )
  `).all()

  if (productosSinPres.length > 0) {
    console.log(`\nCreando presentaciones "Unidad" para ${productosSinPres.length} productos...`)
    const insertar = db.prepare(`
      INSERT INTO presentaciones_producto
        (producto_id, nombre, unidades_por_paquete, precio_venta, precio_compra,
         codigo_barras, es_venta_defecto, es_compra_defecto)
      VALUES (?, 'Unidad', 1, ?, ?, ?, 1, 1)
    `)
    let count = 0
    for (const p of productosSinPres) {
      insertar.run(p.id, p.precio_venta, p.precio_compra, p.codigo_barras)
      count++
    }
    console.log(`  ${count} presentaciones creadas`)
  } else {
    console.log('Todos los productos activos ya tienen presentaciones')
  }

  // 6. Actualizar unidad_base donde esté NULL
  const result = db.prepare("UPDATE productos SET unidad_base = 'unidad' WHERE activo = 1 AND unidad_base IS NULL").run()
  if (result.changes > 0) {
    console.log(`unidad_base corregida en ${result.changes} productos`)
  }

  // 7. Verificar integridad
  const totalPres = db.prepare('SELECT COUNT(*) as n FROM presentaciones_producto').get()
  const totalProds = db.prepare('SELECT COUNT(*) as n FROM productos WHERE activo = 1').get()
  const prodsConPres = db.prepare(`
    SELECT COUNT(DISTINCT p.id) as n FROM productos p
    INNER JOIN presentaciones_producto pp ON pp.producto_id = p.id
    WHERE p.activo = 1
  `).get()

  console.log('\n=== VERIFICACION ===')
  console.log('Productos activos:', totalProds.n)
  console.log('Con presentaciones:', prodsConPres.n)
  console.log('Total presentaciones:', totalPres.n)
  console.log('Detalle_venta filas:', db.prepare('SELECT COUNT(*) as n FROM detalle_venta').get().n)
  console.log('Detalle_compra filas:', db.prepare('SELECT COUNT(*) as n FROM detalle_compra').get().n)
  console.log('Ventas filas:', db.prepare('SELECT COUNT(*) as n FROM ventas').get().n)
  console.log('Compras filas:', db.prepare('SELECT COUNT(*) as n FROM compras').get().n)
  console.log('Consumo_propio filas:', db.prepare('SELECT COUNT(*) as n FROM consumo_propio').get().n)
  console.log('\nMigracion completada sin perdida de datos')
})

try {
  migrar()
} catch (err) {
  console.error('\nERROR durante la migracion:', err.message)
  console.error('Restaurando backup...')
  db.close()
  fs.copyFileSync(bakPath, srcPath)
  console.error('Backup restaurado. BD sin cambios.')
  process.exit(1)
} finally {
  db.close()
}
