const { db, init } = require('../db')
const bcrypt = require('bcryptjs')

const seedProduccion = () => {
  init()

  const insertar = db.transaction(() => {

    // ─── USUARIO ADMIN ───────────────────────────────────────────────
    const adminExiste = db.prepare('SELECT id FROM usuarios LIMIT 1').get()
    if (!adminExiste) {
      db.prepare(`
        INSERT INTO usuarios (nombre, email, password_hash, rol)
        VALUES (?, ?, ?, 'admin')
      `).run(
        'Administrador',
        'admin@adai.com',
        bcrypt.hashSync('admin123', 10)
      )
      console.log('✅ Usuario admin creado')
      console.log('   → Email:      admin@adai.com')
      console.log('   → Contraseña: admin123')
      console.log('   ⚠️  Cambiá la contraseña desde el sistema antes de usar')
    } else {
      console.log('⏭️  Usuario ya existe, omitiendo')
    }

    // ─── CONFIGURACIÓN VACÍA ─────────────────────────────────────────
    const configExiste = db.prepare('SELECT id FROM configuracion LIMIT 1').get()
    if (!configExiste) {
      db.prepare(`
        INSERT INTO configuracion (
          razon_social, ruc, direccion, telefono,
          timbrado, timbrado_inicio,
          factura_desde, punto_expedicion, establecimiento
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        'Mi Despensa',      // razon_social     — cambiar en Configuración
        '00000000-0',       // ruc              — cambiar en Configuración
        '',                 // direccion
        '',                 // telefono
        '00000000',         // timbrado         — cambiar en Configuración
        '2025-01-01',       // timbrado_inicio  — cambiar en Configuración
        1,                  // factura_desde
        '001',              // punto_expedicion
        '001'               // establecimiento
      )
      console.log('✅ Configuración inicial creada')
      console.log('   ⚠️  Completá los datos reales en Configuración antes de facturar')
    } else {
      console.log('⏭️  Configuración ya existe, omitiendo')
    }

    // ─── CLIENTE CONSUMIDOR FINAL ────────────────────────────────────
    const clienteExiste = db.prepare('SELECT id FROM clientes LIMIT 1').get()
    if (!clienteExiste) {
      db.prepare(`
        INSERT INTO clientes (nombre) VALUES ('Consumidor Final')
      `).run()
      console.log('✅ Cliente "Consumidor Final" creado')
    } else {
      console.log('⏭️  Clientes ya existen, omitiendo')
    }

  })

  insertar()

  console.log('')
  console.log('🚀 Sistema listo para producción')
  console.log('   1. Entrá con admin@adai.com / admin123')
  console.log('   2. Ir a Configuración y cargar RUC, timbrado y datos del negocio')
  console.log('   3. Crear los productos desde el menú Productos')
  console.log('   4. Cambiar la contraseña del admin')
  console.log('')
  process.exit(0)
}

seedProduccion()