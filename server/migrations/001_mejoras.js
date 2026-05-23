const { db, init } = require('../db')

const migrar = () => {
  init()

  db.exec(`
    -- Unidad de medida en productos
    ALTER TABLE productos ADD COLUMN unidad TEXT
      CHECK(unidad IN ('unidad','kg','litro','gramo')) DEFAULT 'unidad';

    -- Precio de compra en detalle_venta (para calcular ganancia real)
    ALTER TABLE detalle_venta ADD COLUMN precio_compra_unitario REAL DEFAULT 0;

    -- Tabla consumo propio
    CREATE TABLE IF NOT EXISTS consumo_propio (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      producto_id INTEGER NOT NULL REFERENCES productos(id),
      usuario_id  INTEGER REFERENCES usuarios(id),
      cantidad    REAL NOT NULL,
      motivo      TEXT,
      creado_en   DATETIME DEFAULT (datetime('now','localtime'))
    );
  `)

  console.log('✅ Migración 001 aplicada')
  process.exit(0)
}

migrar()