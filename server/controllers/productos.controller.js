const { db } = require('../db')
const { ahora } = require('../utils/fecha')

const getAll = (req, res) => {
  try {
    const productos = db.prepare(`
      SELECT p.*, c.nombre AS categoria_nombre
      FROM productos p
      LEFT JOIN categorias c ON p.categoria_id = c.id
      ORDER BY p.nombre
    `).all()

    const productosConPres = productos.map(p => {
      const presentaciones = db.prepare(`
        SELECT * FROM presentaciones_producto WHERE producto_id = ?
      `).all(p.id)
      return { ...p, presentaciones }
    })

    res.json(productosConPres)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

const getById = (req, res) => {
  try {
    const producto = db.prepare(`
      SELECT p.*, c.nombre AS categoria_nombre
      FROM productos p
      LEFT JOIN categorias c ON p.categoria_id = c.id
      WHERE p.id = ?
    `).get(req.params.id)
    if (!producto) return res.status(404).json({ error: 'Producto no encontrado' })

    const presentaciones = db.prepare(`
      SELECT * FROM presentaciones_producto WHERE producto_id = ?
    `).all(req.params.id)

    res.json({ ...producto, presentaciones })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

const getByCodigoBarras = (req, res) => {
  try {
    // Buscar primero en presentaciones (incluye código de paquetes)
    const presentacion = db.prepare(`
      SELECT pp.*, p.id AS producto_id, p.nombre AS producto_nombre,
             p.stock, p.stock_minimo, p.unidad_base, p.tasa_iva,
             p.categoria_id, p.activo, p.precio_compra, p.precio_venta,
             c.nombre AS categoria_nombre, p.unidad_base
      FROM presentaciones_producto pp
      JOIN productos p ON p.id = pp.producto_id
      LEFT JOIN categorias c ON p.categoria_id = c.id
      WHERE pp.codigo_barras = ? AND p.activo = 1
    `).get(req.params.codigo)

    if (presentacion) {
      const presentaciones = db.prepare(`
        SELECT * FROM presentaciones_producto WHERE producto_id = ?
      `).all(presentacion.producto_id)
      return res.json({ ...presentacion, presentaciones, es_presentacion: true })
    }

    // Si no, buscar en productos (código de la unidad base)
    const producto = db.prepare(`
      SELECT p.*, c.nombre AS categoria_nombre
      FROM productos p
      LEFT JOIN categorias c ON p.categoria_id = c.id
      WHERE p.codigo_barras = ? AND p.activo = 1
    `).get(req.params.codigo)

    if (!producto) return res.status(404).json({ error: 'Producto no encontrado' })

    const presentaciones = db.prepare(`
      SELECT * FROM presentaciones_producto WHERE producto_id = ?
    `).all(producto.id)

    res.json({ ...producto, presentaciones, es_presentacion: false })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

const getLowStock = (req, res) => {
  try {
    const productos = db.prepare(`
      SELECT p.*, c.nombre AS categoria_nombre
      FROM productos p
      LEFT JOIN categorias c ON p.categoria_id = c.id
      WHERE p.stock <= p.stock_minimo AND p.activo = 1
      ORDER BY p.stock ASC
    `).all()

    const productosConPres = productos.map(p => {
      const presentaciones = db.prepare(`
        SELECT * FROM presentaciones_producto WHERE producto_id = ?
      `).all(p.id)
      return { ...p, presentaciones }
    })

    res.json(productosConPres)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

const create = (req, res) => {
  const {
    nombre, codigo_barras, precio_compra, precio_venta,
    stock, stock_minimo, categoria_id, tasa_iva, unidad
  } = req.body

  if (!nombre)       return res.status(400).json({ error: 'El nombre es obligatorio' })
  if (!precio_venta) return res.status(400).json({ error: 'El precio de venta es obligatorio' })

  try {
    const crearProducto = db.transaction(() => {
      const result = db.prepare(`
        INSERT INTO productos
          (nombre, codigo_barras, precio_compra, precio_venta,
           stock, stock_minimo, categoria_id, tasa_iva, unidad, unidad_base)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        nombre.trim(),
        codigo_barras  || null,
        precio_compra  || 0,
        precio_venta,
        stock          || 0,
        stock_minimo   || 5,
        categoria_id   || null,
        tasa_iva       ?? 10,
        unidad         || 'unidad',
        unidad         || 'unidad'
      )

      const productoId = result.lastInsertRowid

      // Auto-crear presentación por defecto
      db.prepare(`
        INSERT INTO presentaciones_producto
          (producto_id, nombre, unidades_por_paquete, precio_venta, precio_compra,
           codigo_barras, es_venta_defecto, es_compra_defecto)
        VALUES (?, ?, 1, ?, ?, ?, 1, 1)
      `).run(productoId, 'Unidad', precio_venta, precio_compra || 0, codigo_barras || null)

      return productoId
    })

    const id = crearProducto()
    res.status(201).json({ id, ...req.body })
  } catch (err) {
    if (err.message.includes('UNIQUE'))
      return res.status(409).json({ error: 'Ya existe un producto con ese código de barras' })
    res.status(500).json({ error: err.message })
  }
}

const update = (req, res) => {
  const {
    nombre, codigo_barras, precio_compra, precio_venta,
    stock, stock_minimo, categoria_id, tasa_iva, unidad
  } = req.body

  if (!nombre)       return res.status(400).json({ error: 'El nombre es obligatorio' })
  if (!precio_venta) return res.status(400).json({ error: 'El precio de venta es obligatorio' })

  try {
    const result = db.prepare(`
      UPDATE productos SET
        nombre = ?, codigo_barras = ?, precio_compra = ?,
        precio_venta = ?, stock = ?, stock_minimo = ?,
        categoria_id = ?, tasa_iva = ?, unidad = ?, unidad_base = ?
      WHERE id = ?
    `).run(
      nombre.trim(),
      codigo_barras || null,
      precio_compra || 0,
      precio_venta,
      stock         ?? 0,
      stock_minimo  || 5,
      categoria_id  || null,
      tasa_iva      ?? 10,
      unidad        || 'unidad',
      unidad        || 'unidad',
      req.params.id
    )
    if (result.changes === 0) return res.status(404).json({ error: 'Producto no encontrado' })

    // Actualizar la presentación por defecto de venta si existe
    const presDefecto = db.prepare(`
      SELECT id FROM presentaciones_producto
      WHERE producto_id = ? AND es_venta_defecto = 1
      LIMIT 1
    `).get(req.params.id)

    if (presDefecto) {
      db.prepare(`
        UPDATE presentaciones_producto SET
          precio_venta = ?, precio_compra = ?, codigo_barras = ?
        WHERE id = ?
      `).run(precio_venta, precio_compra || 0, codigo_barras || null, presDefecto.id)
    }

    res.json({ id: Number(req.params.id), ...req.body })
  } catch (err) {
    if (err.message.includes('UNIQUE'))
      return res.status(409).json({ error: 'Ya existe un producto con ese código de barras' })
    res.status(500).json({ error: err.message })
  }
}

const getValorInventario = (req, res) => {
  try {
    const resumen = db.prepare(`
      SELECT
        COUNT(*)                               AS total_productos,
        SUM(stock)                             AS total_unidades,
        ROUND(SUM(stock * precio_compra), 0)   AS valor_compra,
        ROUND(SUM(stock * precio_venta),  0)   AS valor_venta,
        ROUND(SUM(stock * precio_venta)
            - SUM(stock * precio_compra), 0)   AS ganancia_potencial
      FROM productos
      WHERE activo = 1
    `).get()

    const porCategoria = db.prepare(`
      SELECT
        COALESCE(c.nombre, 'Sin categoría') AS categoria,
        COUNT(p.id)                          AS productos,
        ROUND(SUM(p.stock * p.precio_compra), 0) AS valor_compra,
        ROUND(SUM(p.stock * p.precio_venta),  0) AS valor_venta
      FROM productos p
      LEFT JOIN categorias c ON p.categoria_id = c.id
      WHERE p.activo = 1
      GROUP BY c.id
      ORDER BY valor_venta DESC
    `).all()

    res.json({ resumen, por_categoria: porCategoria })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// Soft delete — nunca borramos productos reales, afectan historial
const remove = (req, res) => {
  try {
    const result = db.prepare('UPDATE productos SET activo = 0 WHERE id = ?').run(req.params.id)
    if (result.changes === 0) return res.status(404).json({ error: 'Producto no encontrado' })
    res.json({ mensaje: 'Producto desactivado' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

const activar = (req, res) => {
  try {
    const result = db.prepare('UPDATE productos SET activo = 1 WHERE id = ?').run(req.params.id)
    if (result.changes === 0) return res.status(404).json({ error: 'Producto no encontrado' })
    res.json({ mensaje: 'Producto activado' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

module.exports = { getAll, getById, getByCodigoBarras, getLowStock, getValorInventario, create, update, remove, activar }