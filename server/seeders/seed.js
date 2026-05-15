const { db, init } = require('../db')
const bcrypt = require('bcryptjs')
const { ahora } = require('../utils/fecha')

const seed = () => {
  // Inicializar tablas primero
  init()

  const insertarDatos = db.transaction(() => {

    // ─── CONFIGURACIÓN ────────────────────────────────────────────────
    const configExiste = db.prepare('SELECT id FROM configuracion LIMIT 1').get()
    if (!configExiste) {
      db.prepare(`
        INSERT INTO configuracion (
          razon_social, ruc, direccion, telefono,
          timbrado, timbrado_inicio, timbrado_vencimiento,
          factura_desde, punto_expedicion, establecimiento
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        'Despensa Adai',
        '1234567-8',
        'Lambaré, Central, Paraguay',
        '0981000000',
        '12345678',
        '2025-01-01',
        '2027-01-01',
        1,
        '001',
        '001'
      )
      console.log('✅ Configuración insertada')
    } else {
      console.log('⏭️  Configuración ya existe, omitiendo')
    }

    // ─── USUARIOS ─────────────────────────────────────────────────────
    const adminExiste = db.prepare("SELECT id FROM usuarios WHERE email = ?").get('admin@adai.com')
    if (!adminExiste) {
      const stmtUser = db.prepare(`
        INSERT INTO usuarios (nombre, email, password_hash, rol, creado_en)
        VALUES (?, ?, ?, ?, ?)
      `)

      stmtUser.run('Administrador', 'admin@adai.com', bcrypt.hashSync('admin123', 10), 'admin', ahora())
      stmtUser.run('Cajero Principal', 'cajero@adai.com', bcrypt.hashSync('cajero123', 10), 'cajero', ahora())

      console.log('✅ Usuarios insertados')
      console.log('   → admin@adai.com   / admin123')
      console.log('   → cajero@adai.com  / cajero123')
    } else {
      console.log('⏭️  Usuarios ya existen, omitiendo')
    }

    // ─── CATEGORÍAS ───────────────────────────────────────────────────
    const catExiste = db.prepare('SELECT id FROM categorias LIMIT 1').get()
    if (!catExiste) {
      const categorias = [
        'Bebidas',
        'Lácteos',
        'Panadería',
        'Limpieza',
        'Snacks',
        'Enlatados',
        'Condimentos',
        'Otros'
      ]
      const stmt = db.prepare('INSERT INTO categorias (nombre) VALUES (?)')
      categorias.forEach(nombre => stmt.run(nombre))
      console.log('✅ Categorías insertadas')
    } else {
      console.log('⏭️  Categorías ya existen, omitiendo')
    }

    // ─── PRODUCTOS ────────────────────────────────────────────────────
    const prodExiste = db.prepare('SELECT id FROM productos LIMIT 1').get()
    if (!prodExiste) {
      const getCat = nombre =>
        db.prepare('SELECT id FROM categorias WHERE nombre = ?').get(nombre)?.id

      const productos = [
        { nombre: 'Coca Cola 2L',         codigo: '7790895000153', p_compra: 5000,  p_venta: 8000,  stock: 24, stock_min: 6,  cat: 'Bebidas',    iva: 10 },
        { nombre: 'Agua Mineral 500ml',   codigo: '7790895000154', p_compra: 1500,  p_venta: 2500,  stock: 48, stock_min: 12, cat: 'Bebidas',    iva: 10 },
        { nombre: 'Leche Entera 1L',      codigo: '7790895000155', p_compra: 3500,  p_venta: 5000,  stock: 20, stock_min: 8,  cat: 'Lácteos',    iva: 5  },
        { nombre: 'Yogur Natural 200g',   codigo: '7790895000156', p_compra: 2000,  p_venta: 3500,  stock: 15, stock_min: 5,  cat: 'Lácteos',    iva: 5  },
        { nombre: 'Pan Lactal',           codigo: '7790895000157', p_compra: 4000,  p_venta: 6500,  stock: 10, stock_min: 4,  cat: 'Panadería',  iva: 5  },
        { nombre: 'Detergente 500ml',     codigo: '7790895000158', p_compra: 4500,  p_venta: 7000,  stock: 12, stock_min: 4,  cat: 'Limpieza',    iva: 10 },
        { nombre: 'Papas Fritas 100g',    codigo: '7790895000159', p_compra: 3000,  p_venta: 5000,  stock: 30, stock_min: 10, cat: 'Snacks',      iva: 10 },
        { nombre: 'Atún en Lata 170g',    codigo: '7790895000160', p_compra: 5500,  p_venta: 8500,  stock: 18, stock_min: 6,  cat: 'Enlatados',  iva: 10 },
        { nombre: 'Sal Fina 1kg',         codigo: '7790895000161', p_compra: 1000,  p_venta: 2000,  stock: 20, stock_min: 5,  cat: 'Condimentos', iva: 5  },
        { nombre: 'Azúcar 1kg',           codigo: '7790895000162', p_compra: 3500,  p_venta: 5500,  stock: 15, stock_min: 5,  cat: 'Condimentos', iva: 5  },
      ]

      const stmt = db.prepare(`
        INSERT INTO productos
          (nombre, codigo_barras, precio_compra, precio_venta, stock, stock_minimo, categoria_id, tasa_iva, creado_en)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)

      productos.forEach(p =>
        stmt.run(p.nombre, p.codigo, p.p_compra, p.p_venta, p.stock, p.stock_min, getCat(p.cat), p.iva, ahora())
      )
      console.log('✅ Productos insertados')
    } else {
      console.log('⏭️  Productos ya existen, omitiendo')
    }

    // ─── CLIENTES ─────────────────────────────────────────────────────
    const clienteExiste = db.prepare('SELECT id FROM clientes LIMIT 1').get()
    if (!clienteExiste) {
      const clientes = [
        { nombre: 'Consumidor Final', ruc_ci: null,         telefono: null         },
        { nombre: 'Juan Pérez',       ruc_ci: '1234567-8', telefono: '0981111111' },
        { nombre: 'María González',   ruc_ci: '9876543-2', telefono: '0982222222' },
      ]
      const stmt = db.prepare('INSERT INTO clientes (nombre, ruc_ci, telefono, creado_en) VALUES (?, ?, ?, ?)')
      clientes.forEach(c => stmt.run(c.nombre, c.ruc_ci, c.telefono, ahora()))
      console.log('✅ Clientes insertados')
    } else {
      console.log('⏭️  Clientes ya existen, omitiendo')
    }

    // ─── PROVEEDORES ──────────────────────────────────────────────────
    const provExiste = db.prepare('SELECT id FROM proveedores LIMIT 1').get()
    if (!provExiste) {
      const proveedores = [
        { nombre: 'Distribuidora Norte',  ruc: '80012345-6', telefono: '0211111111' },
        { nombre: 'Bebidas del Sur S.A.', ruc: '80098765-4', telefono: '0212222222' },
      ]
      const stmt = db.prepare('INSERT INTO proveedores (nombre, ruc, telefono, creado_en) VALUES (?, ?, ?, ?)')
      proveedores.forEach(p => stmt.run(p.nombre, p.ruc, p.telefono, ahora()))
      console.log('✅ Proveedores insertados')
    } else {
      console.log('⏭️  Proveedores ya existen, omitiendo')
    }

  })

  insertarDatos()
  console.log('\n🌱 Seed completado exitosamente')
  process.exit(0)
}

seed()