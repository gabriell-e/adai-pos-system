# AGENTS.md

Contexto del proyecto para cualquier agente (o persona) que trabaje acá.
Leelo antes de tocar nada: buena parte de los errores que ya se cometieron en
este repo son evitables con las reglas de esta primera sección.

---

## 1. Qué es esto

**Adai POS System**: punto de venta para despensas y comercios chicos en
Paraguay. Corre en un solo local, en un solo PC, y está **en producción real**
en un cliente. No es un maqueta: los datos de `server/adai.db` son reales
(clientes con nombre, deudas, ventas, timbrados) y no se pueden perder.

Cubre el ciclo completo del negocio: compra a proveedores, venta con factura
paraguaya, control de stock transaccional, caja diaria, fiado a clientes,
consumo propio, gastos personales, reportes con Excel y respaldos automáticos.

### Stack

| Capa        | Tecnología                    | Notas                                          |
|-------------|-------------------------------|------------------------------------------------|
| Frontend    | React 19 + Vite 8             | `client/`                                      |
| Routing     | React Router 7                | SPA con rutas protegidas por rol               |
| Estilos     | Tailwind CSS 4                | Utility-first, sin CSS extra                   |
| HTTP        | Axios                         | Interceptor JWT + manejo de 401/403            |
| Gráficas    | Recharts 3                    | Solo se cargan cuando se abren las graphingas   |
| Backend     | Node.js + Express 5            | `server/`, CommonJS (`"type": "commonjs"`)      |
| Base        | SQLite + better-sqlite3       | **Síncrona**, sin servidor, archivo único       |
| Auth        | JWT + bcryptjs                | Token de 12 h, passwords hasheados              |
| Excel       | xlsx 0.18                     | Exportación de reportes                        |
| Backups     | better-sqlite3 `db.backup()`  | Local + Google Drive con rclone                |

Zona horaria: `America/Asuncion`, seteada en `server/.env` (`TZ=America/Asuncion`).

### Estructura

```
adai-pos-system/
├── AGENTS.md              ← este archivo
├── README.md              documentación para usuarios finales
├── iniciar.bat            arranque en Windows (abre el servidor en otra ventana)
├── client/                frontend React
│   └── src/
│       ├── api/axios.js
│       ├── components/    Layout.jsx (sidebar por rol), PrivateRoute.jsx
│       ├── context/       AuthContext.jsx
│       ├── pages/         una carpeta por módulo
│       └── utils/         buscar.js, validar.js, useFormValidacion.js
├── server/
│   ├── index.js           Express, rutas, sirve client/dist
│   ├── db.js              conexión + schema + índices + ALTERs idempotentes
│   ├── controllers/       14 controladores (uno por módulo)
│   ├── routes/            14 archivos de rutas
│   ├── middlewares/       auth.middleware.js (verificarToken, soloAdmin)
│   ├── services/          backup.service.js
│   ├── utils/             fecha.js, texto.js, instancia.unica.js
│   ├── migrations/        001_mejoras.js
│   ├── seeders/           seed.js (demo), seed.produccion.js
│   └── adai.db            ← LA BASE. Nunca se commitea.
├── scripts/               migrar-produccion.js, migrar-presentaciones.js
└── respaldos/nube/        PowerShell + rclone para Google Drive
```

---

## 2. Comandos que NUNCA deben quedar esperando

Este proyecto ya sufrió **corrupción de `server/adai.db`** por abrir la misma
base en modo WAL desde varios procesos a la vez. Además de
`server/utils/instancia.unica.js`, hay que respetar estas reglas al usar la
terminal:

1. **Nunca arrancar un servidor en primer plano.** Nada de `node index.js`,
   `npm run dev` ni `npm start` directamente: la llamada queda esperando a que
   el proceso termine y se cuelga hasta el timeout.

   ```powershell
   & { Get-Process node -EA SilentlyContinue | Stop-Process -Force -EA SilentlyContinue; Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{ CommandLine = 'cmd.exe /c node index.js > %TEMP%\srv.log 2>&1'; CurrentDirectory = 'C:\Users\mosta\Desktop\Adai\adai-pos-system\server' } | Out-Null; Start-Sleep -Milliseconds 800; $tcp = New-Object System.Net.Sockets.TcpClient; $res = "no"; try { $tcp.Connect("127.0.0.1", 3001); $res = "3001 ok"; $tcp.Close() } catch {}; $tcp.Dispose(); $res } 2>&1 | Select-Object -Last 1
   ```

   Usar siempre `Win32_Process.Create` desacopla el proceso del runner, corta
   la herencia de handles y evita que la herramienta se quede colgada.
   **NO** usar `Start-Process` con redirección a archivos ni `Invoke-WebRequest`
   para verificar el arranque: usar el socket TCP directo con `$tcp.Dispose()`
   y liberar la conexión.

2. **Nunca usar `-Wait`, `WaitForExit()` ni `Start-Sleep` largos** después de
   arrancar algo. Para comprobar que arrancó: una sola petición HTTP con
   timeout corto, o leer el log.

3. **Timeout corto por defecto en llamadas de terminal** (10-30 s). Si algo
   necesita más tiempo, es porque se está colgando.

4. **Un solo proceso de servidor a la vez.** Antes de arrancar, comprobar:
   ```powershell
   (Get-Process node -EA SilentlyContinue | Measure-Object).Count
   ```
   Si ya hay procesos node, no arrancar otro: usar el que está.

5. **Para pruebas de API, usar scripts de PowerShell en el temp**, no cadenas
   largas de `Invoke-RestMethod` con comillas anidadas (PowerShell rompe los
   acentos y las comillas). Escribir el script a archivo y ejecutarlo:
   ```powershell
   & powershell -NoProfile -File "$env:TEMP\prueba.ps1"
   ```

6. **Backticks y `\"` fallan en `node -e` bajo PowerShell.** Para consultas
   SQL complejas, escribir un `.js` temporal y ejecutarlo con `node`.

7. **Nunca editar la base mientras un proceso la tiene abierta.** Parar todo
   (`Get-Process node | Stop-Process -Force`) antes de tocar `adai.db`, y
   verificar después con `PRAGMA integrity_check`.

8. **Los scripts de prueba que se escriben en el repo se borran al terminar.**
   No dejar `verificar-*.js`, `probar-*.js` ni `copia-*.db` en el repo.

---

## 3. Cliente: dos puertos, no confundir

- `localhost:3001` (server) sirve **`client/dist`**, un build compilado. No lee
  el código fuente, así que los cambios del cliente **no** aparecen hasta
  recompilar.
- `localhost:5173` (Vite) sí lee el código fuente y recarga solo.
- Para trabajar: usar el 5173, o dejar `npm run build:watch` corriendo en
  `client`, o correr `npm run build` en `client` antes de probar en el 3001.
- Al tocar archivos de `client/`, terminar siempre con `npm run build`, o el
  3001 queda sirviendo la versión anterior.
- El `index.html` se manda con `no-store` y los bundles con hash con
  `immutable`, para que el navegador no siga mostrando una versión vieja.

---

## 4. Base de datos

- `server/adai.db` está en **WAL** y **nunca** se commitea (`.gitignore` tiene
  `*.db`, `*.db-wal`, `*.db-shm`).
- Los respaldos se crean solo con `db.backup()`, **nunca** con `fs.copyFile`:
  en WAL, copiar el archivo a mano puede dar una base incompleta.
- `server/backups/` y `respaldos/nube/respaldos.log` están en `.gitignore`.
- Recuperación probada: dejar un solo proceso, mover `adai.db`, `adai.db-wal` y
  `adai.db-shm` a un lado, copiar un respaldo verificado con `integrity_check = ok`
  a `adai.db`, y arrancar.
- Quedan copias forenses en el repo (`adai.db.CORRUPTA_*`, `*.REVERTIDA_*`):
  son el registro del incidente. **No borrarlas** sin hablarlo con el usuario.
- `server/adai.lock` (PID del servidor) lo maneja `utils/instancia.unica.js`:
  si hay otro proceso vivo con la base abierta, el nuevo se niega a arrancar.
  Es la segunda barrera, no la primera: la primera es no abrirla a la vez.

### Tablas

`configuracion` (timbrado, numeración), `usuarios`, `categorias`, `productos`,
`presentaciones_producto`, `clientes`, `proveedores`, `ventas`,
`detalle_venta`, `compras`, `detalle_compra`, `movimientos_stock`, `caja`,
`consumo_propio`, `gastos`, `configuracion_backup`, `respaldos`.

### Cambios de esquema

- `server/db.js` tiene los `CREATE TABLE IF NOT EXISTS` y **ALTERs idempotentes
  envueltos en `try/catch`**: son la vía normal para agregar columnas. Al
  agregar una columna nueva, hacer las dos cosas: el `ALTER` en `db.js` **y**
  agregarla al `CREATE TABLE`, para que las bases nuevas la tengan de una.
- `server/migrations/001_mejoras.js` (`npm run migrate`) es para lo que no
  entra en `db.js`. **El usuario tiene que confirmar si producción ya corrió
  la migración** antes de darla por aplicada.
- `scripts/migrar-produccion.js` migra una base externa (recibe la ruta como
  argumento) y deja un `.bak` al lado.

### Índices

`db.js` crea índices en `ventas`, `detalle_venta`, `detalle_compra`,
`movimientos_stock`, `presentaciones_producto`, `consumo_propio`, `gastos` y
`productos`. La base tiene miles de filas: **agregar un índice** si aparece
una consulta que no lo usa.

### Texto con acentos

`norm(texto)` es una función SQL registrada en `db.js` que quita acentos y baja
a minúsculas. El `LIKE` de SQLite solo ignora mayúsculas ASCII, no acentos:
sin esto, "jose" nunca encuentra "José".

```sql
WHERE norm(c.nombre) LIKE ?
```

La lógica vive en **dos lugares** y si se cambia una hay que cambiar la otra:
- servidor: `server/utils/texto.js` → `normalizarSql` (registrada como `norm`)
- cliente: `client/src/utils/buscar.js` → `normalizar`

El usuario escribe una vez y espera el mismo resultado en las dos pantallas.

---

## 5. Reglas de negocio

### Facturación paraguaya
- IVA **10%, 5% y exento**, con el **precio que incluye IVA**. Se extrae:
  gravado 10% → `iva = subtotal / 11`; gravado 5% → `iva = subtotal / 21`;
  exento → sin IVA. Ver `calcularIVA` en `server/controllers/ventas.controller.js`.
- Numeración: `establecimiento-punto_expedicion-correlativo(7 dígitos)`, por
  ejemplo `001-001-0001745`. Sale de la tabla `configuracion`
  (`factura_desde`, `punto_expedicion`, `establecimiento`).
- El timbrado y su vencimiento se configuran en la pantalla Configuración.

### Ventas y medios de pago
- `tipo_pago` ∈ `efectivo`, `transferencia`, `qr`, `debito`, `fiado`, `mixto`.
- `condicion_venta` ∈ `contado`, `credito`.
- **Pago mixto**: `pago_detalle` es un **texto JSON** con el reparto:
  `[{ tipo: 'efectivo', monto: 5000 }, { tipo: 'fiado', monto: 3000 }]`.
- El fiado de una mixta es **por monto total de la venta**, no por producto: el
  cliente paga una parte y deja el resto como fiado.
- En `mixto`, `monto_pagado` guarda **solo lo cobrado** (la parte no fiada).
  El total de la venta es `monto_pagado + fiado`.
- Una venta con fiado **siempre** necesita `cliente_id`.

### Deuda de los clientes
- `clientes.deuda_total` es la columna que se mantiene al crear, cobrar y
  anular una venta.
- La deuda pendiente real = ventas **totalmente fiadas** (`tipo_pago='fiado'`,
  `fiado_pagada=0`, `estado='completada'`) **+ el fiado de las mixtas**
  (`tipo_pago='mixto'`, `fiado_pagada=0`, `estado='completada'`, sumando solo
  las entradas de `pago_detalle` con `tipo='fiado'`).
- **Las ventas anuladas no son deuda.** Filtrar siempre por
  `estado='completada'`.
- Para leer el fiado de `pago_detalle`:
  ```sql
  SUM(json_extract(j.value, '$.monto')) FROM ventas v, json_each(v.pago_detalle) j
  WHERE json_extract(j.value, '$.tipo') = 'fiado'
  ```
  **OJO**: `CAST(j.value AS REAL)` devuelve `0`, porque `j.value` es el objeto
  JSON entero serializado, no el número. Hay que usar `json_extract`.
  `json_each` es de la extensión JSON1, disponible en la versión de SQLite que
  usa better-sqlite3 (3.53).
- `fiado_pagada` es un flag de la venta completa, no un saldo parcial. Al
  cobrar una mixta, `fiado_pagada = 1` y se descuenta **todo** el fiado de la
  deuda del cliente.
- El listado de Clientes **recalcula** la deuda en SQL en vez de confiar en la
  columna: es más robusto si alguna vez se desincroniza. Las dos tienen que
  dar lo mismo; si no, revisar la lógica del controller.

### Stock
- Toda venta, compra, consumo propio o anulación **descuenta stock dentro de
  una transacción atómica** (`db.transaction`). Si algo falla, no se guarda
  nada.
- `movimientos_stock` es la auditoría: tipo (`entrada`, `salida`, `ajuste`),
  `referencia_tipo` (`venta`, `compra`, `manual`) e `referencia_id`.
- Los productos pueden tener **presentaciones** (paquetes) con
  `unidades_por_paquete`; el stock se lleva en la **unidad base**.
- `detalle_venta.precio_compra_unitario` guarda el costo del producto al
  momento de la venta: es lo que permite calcular la ganancia real después.

### Caja
- Apertura con monto inicial, cierre con el resumen del día: total vendido,
  efectivo esperado vs contado, costo de lo vendido, ganancia real.
- Los **gastos personales** se descuentan del efectivo al cerrar la caja
  (`caja.total_gastos`).
- No se puede vender sin caja abierta.

### Consumo propio
- Productos que el dueño se lleva para uso personal: revierten stock y quedan
  auditados.
- Se valoran a **precio de compra** (es lo que sale de la caja), no a precio de
  venta. El historial de consumo y el dashboard tienen que coincidir.

### Gastos
- Estados `registrado` / `anulado`. Los anulados no cuentan.
- Se restan de la ganancia del día, igual que el consumo propio: el "resultado"
  real del día es `Ventas - Costos - Gastos - Consumo propio`.

### Roles
- `admin` y `cajero`. `soloAdmin` (en `server/middlewares/auth.middleware.js`)
  protege usuarios, categorías, configuración, reportes y respaldos.
- El `Layout.jsx` arma el menú según el rol.

---

## 6. Convenciones de código

- **Español** en comentarios, textos de la interfaz y mensajes de error.
- **Comentarios que explican el porqué**, no el qué. Si el código ya se
  entiende solo, el comentario no hace falta. Cuando un fix sea raro o
  contraintuitivo, dejar escrito por qué se hizo así: es la mitad del valor.
- Sin emojis en el código (salvo los que ya están en los `console.log` del
  arranque).
- El cliente es **ESM** (`"type": "module"`), el servidor es **CommonJS**.
  No mezclar.
- Imports de un solo uso: en el cliente se usa `import X from '...'`; en el
  servidor `const X = require('...')`.

### Decimales
`client/src/utils/validar.js` → `numeroDecimal(valor)`.

Los campos de cantidad y precio **NO pueden ser `type="number"`**: el
navigator exige el punto como separador decimal, así que al escribir "1,5" (que
es como se escribe acá) el valor queda vacío y no se puede cargar media
tonelada ni medio kilo. Con `type="text"` + `inputMode="decimal"` el móvil
muestra teclado numérico y la coma entra bien.

`numeroDecimal` acepta `"1,5"`, `"1.5"` y `"1,50"`, y descarta letras.
Aplicado en Compras, Productos, NuevaVenta, Consumo, Gastos y Caja.

### Buscadores
- Cliente: `client/src/utils/buscar.js` → `buscarProductos()` y `buscarTexto()`.
  Ordenan por prioridad (exacto > empieza > empieza por término > palabra > pegado
  > código de barras), no por orden de llegada.
- Servidor: `norm()` en SQL, para los listados paginados.
- Al agregar un buscador nuevo, usar uno de los dos helpers, no un
  `includes()` a secas.

### Formato de números
`formatGs` en las páginas del cliente: `Gs. 1.234.567` con `toLocaleString('es-PY')`.
Para fechas, `toLocaleString('sv-SE')` en el servidor (`server/utils/fecha.js`)
da un `YYYY-MM-DD HH:MM:SS` ordenable lexicográficamente, que es lo que se
compara contra `datetime('now','localtime')`.

---

## 7. Cómo verificar un cambio

1. **Cliente**: `cd client && npm run build` (obligatorio si se tocó `client/`).
   Después, reiniciar el server y abrir `localhost:3001`.
2. **Backend**: probar la API. Para no depender de login, se puede invocar el
   controller con un `req`/`res` falso en un `.js` temporal (y borrarlo después).
3. **Base**: para tocar datos, trabajar sobre una **copia** de la base, nunca
   sobre `adai.db` con el servidor corriendo.
4. **SQL en PowerShell**: nada de `node -e` con SQL complejo. Escribir un `.js`
   temporal y ejecutarlo con `node`.
5. Al terminar, **borrar los scripts de prueba**.

---

## 8. Commits y despliegue

- Rama única: `main`. `origin` es `github.com/gabriell-e/adai-pos-system.git`.
- Mensajes de commit en **español**, en imperativo, describiendo el porqué:
  ```
  Clientes: la deuda ahora incluye el fiado de las ventas mixtas

  El listado recalculaba la deuda con condicion_venta = 'credito', asi que las
  ventas mixtas con resto fiado no contaban y esos clientes aparecian en 0.
  ```
- **No comitear ni pushear sin que el usuario lo pida.** Cuando lo pida, va
  todo junto: código + build si el cliente cambió.

### Actualizar producción (en el PC del cliente)

```powershell
# 1. parar el servidor (cerrar la ventana o Ctrl+C)
# 2. bajar los cambios
git pull origin main
# 3. si cambió el cliente, recompilar
cd client
npm install
npm run build
cd ..
# 4. reiniciar
iniciar.bat
```

`iniciar.bat` abre el servidor en otra ventana (con `chcp 65001` para que los
acentos no salgan rotos) y verifica el puerto 3001.

**Si cambió el backend, reiniciar es obligatorio.** Si cambió el cliente, el
`npm run build` es obligatorio: si no, el 3001 sigue sirviendo la versión
anterior sin avisar.

---

## 9. Deuda técnica conocida y cosas pendientes

- **`xlsx@0.18.5`** tiene una vulnerability alta sin parche publicado (SheetJS
  dejó de publicar en npm). No se puede corregir sin cambiar de librería o
  dejar de exportar a `.xlsx` y usar CSV. Decidirlo con el usuario.
- **Respaldo a Google Drive** (`respaldos/nube/`): los scripts están escritos
  pero la prueba end-to-end necesita `rclone` configurado y el OAuth de la
  cuenta de Drive. Falta esa validación en la máquina real.
- **`npm run migrate` en producción**: no está confirmado que se haya corrido
  la migración `001_mejoras.js` en el PC del cliente. Preguntar antes de
  darla por aplicada.
- **`iniciar.bat`** tiene los glifos `✓`/`✗` guardados en UTF-8: se ven bien con
  `chcp 65001`, pero desde algunos editores se ven rotos. No es un bug de
  runtime.
- No hay tests automatizados (`npm test` no existe en el servidor). La
  verificación es manual: build + API + base de copia.

---

## 10. Errores que ya se cometieron (no repetirlos)

- **Corruptionar `adai.db`** abriendo la base en WAL desde dos procesos.
  → Un solo servidor, y `instancia.unica.js` como segunda barrera.
- **Probar contra el 3001 sin compilar el cliente** y creer que el cambio no
  funciona. → `npm run build` siempre.
- **Cerrar la terminal del agente con el server en primer plano** y que la
  herramienta se cuelgue hasta el timeout. → Patrón WMI de la sección 2.
- **Dejar scripts y copias de base tirados en el repo.** → Borrarlos.
- **Contar las ventas anuladas como deuda del cliente.** → Filtrar por
  `estado='completada'`.
- **Usar `CAST(j.value AS REAL)` sobre `pago_detalle`** y obtener `0` en
  silencio. → `json_extract(j.value, '$.monto')`.
- **Escribir acentos rotos** en archivos `.js`/`.jsx` (el repo tiene
  algunos con la codificación mal). Si al escribir un archivo los acentos
  salen como `?` o como un rombo, es que se guardó en ANSI: hay que escribir en UTF-8.
