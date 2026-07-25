const Database = require('better-sqlite3')
const path = require('path')

const dbPath = process.argv[2] || path.join(__dirname, '..', 'server', 'adai.db')
const db = new Database(dbPath)

db.pragma('foreign_keys = ON')

const migrar = db.transaction(() => {
  const productosSinPres = db.prepare(`
    SELECT p.* FROM productos p
    WHERE p.activo = 1
    AND NOT EXISTS (
      SELECT 1 FROM presentaciones_producto pp WHERE pp.producto_id = p.id
    )
  `).all()

  if (productosSinPres.length === 0) {
    console.log('Todos los productos activos ya tienen presentaciones. Nada que migrar.')
    return
  }

  const insertar = db.prepare(`
    INSERT INTO presentaciones_producto
      (producto_id, nombre, unidades_por_paquete, precio_venta, precio_compra,
       codigo_barras, es_venta_defecto, es_compra_defecto)
    VALUES (?, 'Unidad', 1, ?, ?, ?, 1, 1)
  `)

  let migrados = 0
  for (const p of productosSinPres) {
    insertar.run(p.id, p.precio_venta, p.precio_compra, p.codigo_barras)
    migrados++
    console.log(`  [OK] ${p.nombre} (id:${p.id}) - precio_venta:${p.precio_venta} precio_compra:${p.precio_compra}`)
  }

  const actualizarUnidad = db.prepare(`
    UPDATE productos SET unidad_base = 'unidad' WHERE activo = 1 AND unidad_base IS NULL
  `)
  const unidadResult = actualizarUnidad.run()

  console.log(`\nMigracion completada:`)
  console.log(`  - Presentaciones creadas: ${migrados}`)
  console.log(`  - Productos con unidad_base corregida: ${unidadResult.changes}`)
})

try {
  migrar()
} catch (err) {
  console.error('Error durante la migracion:', err.message)
  process.exit(1)
} finally {
  db.close()
}
