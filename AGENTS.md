# AGENTS.md

## Comandos que NUNCA deben quedar esperando

Este proyecto ya sufrió corrupción de `server/adai.db` por abrir la misma base
en modo WAL desde varios procesos a la vez. Además de `utils/instancia.unica.js`,
hay que respetar estas reglas al usar la terminal:

1. **Nunca arrancar un servidor en primer plano.** Nada de `node index.js`,
   `npm run dev` ni `npm start` directamente: la llamada queda esperando a que
   el proceso termine y se cuelga hasta el timeout.

   ```powershell
   # Correcto: desligado, con log a archivo, y NO esperar
   Start-Process node -ArgumentList "index.js" -WorkingDirectory "<repo>\server" `
     -WindowStyle Hidden -RedirectStandardOutput "$env:TEMP\srv.log" `
     -RedirectStandardError "$env:TEMP\srv.err" -PassThru
   ```

2. **Nunca usar `-Wait`, `WaitForExit()` ni `Start-Sleep` largos después de
   arrancar algo.** Para comprobar que arrancó: una sola petición HTTP con
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
   verificar afterward con `PRAGMA integrity_check`.

## Cliente: dos puertos, no confundir
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

## Base de datos
- `server/adai.db` está en WAL y **nunca** se commitea.
- Los respaldos se crean solo con `db.backup()`, nunca con `fs.copyFile`.
- `server/backups/` está en `.gitignore`.
- Recuperación probada: dejar un solo proceso, mover `adai.db`, `adai.db-wal` y
  `adai.db-shm` a un lado, copiar un respaldo verificado con `integrity_check = ok`
  a `adai.db`, y arrancar.

## Convenciones
- Español en comentarios, textos de la interfaz y mensajes de error.
- Validar con `npm run build` (cliente) y probando la API.
