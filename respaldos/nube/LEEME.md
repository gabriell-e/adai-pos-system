# Respaldo automático en Google Drive

Copia la base de datos de ADAI POS a Google Drive todos los días, sola, aunque
el programa esté cerrado. Si se rompe la computadora, se incendia o te roban,
los respaldos siguen en tu cuenta de Google.

No tenés que hacer nada ni acordarte. Eso es el objetivo.

---

## Qué hace exactamente

1. Crea una copia verificada de `adai.db` usando la API de respaldo de SQLite
   (nunca copiando el archivo a mano, que en modo WAL da una base incompleta).
2. Comprueba que la copia esté íntegra (`integrity_check`) y que tenga ventas.
3. La sube a Drive.
4. Vuelve a bajar la copia de Drive y la compara byte a byte con la local.
5. Borra de Drive las copias de más de 30 días (y deja 7 en el disco).
6. Te manda un correo de aviso.

Todo queda anotado en `respaldos.log`, en esta misma carpeta.

---

## Instalación en la máquina del local (una sola vez)

### Paso 1 — Instalar rclone

Abrí PowerShell como administrador y corré:

```powershell
winget install Rclone.Rclone
```

Si `winget` no existe, descargalo de <https://rclone.org/download/> y elegí
**Windows 64-bit**. Después agregá la carpeta a las variables de entorno, o
simplemente copiá `rclone.exe` en `C:\rclone\` y usá la ruta completa.

Comprobá que quedó:

```powershell
rclone version
```

### Paso 2 — Conectar tu Google (una sola vez, abre el navegador)

```powershell
rclone config
```

Respondé así:

| Pregunta | Respuesta |
|---|---|
| `n/s/q` (crear remoto nuevo) | `n` |
| `name>` | `gdrive` |
| `Storage>` | `drive` |
| `client_id>` | Enter (se queda en blanco) |
| `client_secret>` | Enter (se queda en blanco) |
| `scope>` | `1` (acceso completo) |
| `root_folder_id>` | Enter |
| `service_account_file>` | Enter |
| `Edit advanced config?>` | `n` |
| `Use auto config?>` | `y` |

Se abre el navegador: iniciá sesión con tu Gmail, aceptá el acceso, y copiá el
código que aparece. Volvé a la terminal y pegalo.

> **Sobre el permiso:** con `1` rclone ve toda tu Drive. Si preferís que solo
> toque lo que él mismo crea, elegí `2` (drive.file). Funciona igual para esto.

Comprobá que quedó bien:

```powershell
rclone lsd gdrive:
```

Debería responder sin error.

### Paso 3 — Probar una vez a mano

```powershell
cd C:\ruta\de\adai-pos-system\respaldos\nube
powershell -NoProfile -ExecutionPolicy Bypass -File respaldar-nube.ps1
```

Tiene que decir `=== Respaldo terminado correctamente ===`. Fijate que en
<https://drive.google.com> aparezca la carpeta `adai-pos/respaldos` con un `.db`.

La primera vez no va a llegar correo: todavía no hay remitente configurado.
Configuralo en ADAI POS → Respaldos → Aviso por correo (usá una **contraseña
de aplicación** de Google, no tu contraseña normal).

### Paso 4 — Programar todos los días

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File instalar-tarea.ps1
```

Corre a las 02:00. Si esa noche el equipo estaba apagado, sale apenas lo
encendés, porque la tarea queda configurada con "iniciar lo antes posible si
se pasó la hora".

Para cambiar la hora:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File instalar-tarea.ps1 -Hora "04:30"
```

---

## Cómo saber si está funcionando

Mirar el log:

```powershell
Get-Content .\respaldos.log -Tail 20
```

Forzar una corrida ahora:

```powershell
Start-ScheduledTask -TaskName 'AdaiPOS - Respaldo en la nube'
```

Ver la próxima corrida:

```powershell
Get-ScheduledTask -TaskName 'AdaiPOS - Respaldo en la nube' |
  Get-ScheduledTaskInfo
```

Quitar la automatización (los respaldos ya subidos se quedan):

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File instalar-tarea.ps1 -Desinstalar
```

---

## Si se rompe la base, cómo recuperar de Drive

1. Entrá a <https://drive.google.com>, carpeta `adai-pos/respaldos`.
2. Bajá el `.db` más reciente.
3. En la máquina del local: cerrá ADAI POS, poné el archivo como `server\adai.db`,
   **borrá** `adai.db-wal` y `adai.db-shm` si quedaron.
4. Abrí el programa.

Verificá antes de arrancar, en PowerShell:

```powershell
cd server
node -e "const D=require('better-sqlite3');const d=new D('adai.db',{readonly:true});console.log(d.pragma('integrity_check',{simple:true}));console.log('ventas:',d.prepare('SELECT COUNT(*) c FROM ventas').get().c);d.close()"
```

Tiene que decir `ok` y un número de ventas mayor a cero.

---

## Problemas frecuentes

**"rclone no está instalado"** → repetí el paso 1. Si lo instalaste a mano,
agregá la carpeta al PATH o usá la ruta completa en el script.

**"El remoto 'gdrive:...' no responde"** → el token venció o nunca se
configuró. Se arregla sin volver a instalar nada:

```powershell
rclone config reconnect gdrive:
```

**"No hay internet"** → el respaldo igual se guarda en
`server\backups\nube\`. Cuando vuelva internet, la próxima corrida sube el
nuevo; los anteriores se van borrando de a uno. Si querés subir uno puntual:

```powershell
rclone copy .\carpeta\ada.db gdrive:adai-pos/respaldos/
```

**"Falta configurar la contraseña de aplicación"** → andá a
ADAI POS → Respaldos → Aviso por correo. En Google activá la verificación en
dos pasos y generá una contraseña de aplicación de 16 caracteres.

**El correo no llega** → revisá la carpeta de spam, y que el remitente sea el
mismo Gmail que tiene la contraseña de aplicación.

**Dice "No se encontró better-sqlite3"** → en la carpeta `server` corré
`npm install`.

---

## Por qué no se sube la base directamente

Jamás se sube `adai.db` mientras el programa la está usando. La base trabaja en
modo WAL, o sea que lo más reciente todavía está en un archivo aparte; si se
copia en ese momento, se sube una base incompleta. Por eso primero se genera
una copia cerrada y verificada, y solo después se sube esa.
