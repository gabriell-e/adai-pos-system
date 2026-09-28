<#
.SYNOPSIS
  Respaldo automático de ADAI POS a Google Drive.

  No necesita que ADAI POS esté abierto. Corre por Windows al iniciar o a
  una hora fija, hace una copia verificada de la base, la sube a Drive y
  borra las copias viejas. Si algo falla queda escrito en el log.

  Uso manual (para probar):
    powershell -NoProfile -ExecutionPolicy Bypass -File respaldar-nube.ps1
#>
[CmdletBinding()]
param(
  # Carpeta de Drive destino. Cambiar 'gdrive' si el remoto se llama distinto.
  [string] $Destino  = 'gdrive:adai-pos/respaldos',

  # Cuántos días de respaldos se conservan en Drive.
  [int] $DiasEnNube = 30,

  # Cuántas copias quedan en el disco local (para probar sin internet).
  [int] $CopiasLocales = 7,

  # No borra nada de Drive, solo sube. Útil para la primera prueba.
  [switch] $SoloSubir,

  # Sube aunque el respaldo salga sin ventas.
  [switch] $Forzar
)

$ErrorActionPreference = 'Stop'

$RUTA_SCRIPT  = $PSScriptRoot
$RAIZ         = (Resolve-Path (Join-Path $RUTA_SCRIPT '..\..')).Path
$SERVER       = Join-Path $RAIZ 'server'
$DB_PATH      = Join-Path $SERVER 'adai.db'
$LOG          = Join-Path $RUTA_SCRIPT 'respaldos.log'
$LOCAL_DIR    = Join-Path $SERVER 'backups\nube'

function Escribir-Log {
  param([string] $Mensaje, [string] $Nivel = 'INFO')
  $linea = "{0} [{1}] {2}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Nivel, $Mensaje
  Write-Host $linea
  # -Append para no perder el historial si el log ya existe
  Add-Content -LiteralPath $LOG -Value $linea -Encoding UTF8
}

function Terminar {
  param([int] $Codigo)
  # Si el log creció mucho (meses de uso), se rota y se empieza de nuevo.
  if (Test-Path -LiteralPath $LOG) {
    $tam = (Get-Item -LiteralPath $LOG).Length
    if ($tam -gt 2MB) { Move-Item -LiteralPath $LOG "$LOG.antiguo" -Force }
  }
  exit $Codigo
}

# ─── 1. Comprobaciones previas ────────────────────────────────────────────────
Escribir-Log "=== Respaldo a la nube iniciado ==="

if (-not (Test-Path -LiteralPath $DB_PATH)) {
  Escribir-Log "No existe la base en $DB_PATH. Nada que respaldar." 'ERROR'
  Terminar 1
}

$nodeCmd = Get-Command node -EA SilentlyContinue
if (-not $nodeCmd) {
  Escribir-Log 'Node no está en el PATH. Instalá Node.js en esta máquina.' 'ERROR'
  Terminar 1
}

$rclone = Get-Command rclone -EA SilentlyContinue
if (-not $rclone) {
  Escribir-Log 'rclone no está instalado. Ver LEEME.md (paso 1).' 'ERROR'
  Terminar 1
}

# Que el remoto esté configurado. --dry-run no sube nada pero falla si
# el remoto no existe o al token le venció.
& rclone lsd $Destino --max-depth 1 *> $null
if ($LASTEXITCODE -ne 0) {
  Escribir-Log "El remoto '$Destino' no responde. Corré 'rclone config' o reconectá con 'rclone config reconnect gdrive:'." 'ERROR'
  Terminar 1
}

# Nunca dos copias a la vez: se bloquea por si la tarea se solapa con un
# arranque manual, que es la causa clásica de base corrupta.
$LOCK = Join-Path $RUTA_SCRIPT 'nube.lock'
$hayOtroCorriendo = $false

if (Test-Path -LiteralPath $LOCK) {
  $previo = 0
  $crudo = Get-Content -LiteralPath $LOCK -Raw -EA SilentlyContinue
  if ($crudo) { [int]::TryParse($crudo.Trim(), [ref]$previo) | Out-Null }

  if ($previo -gt 0) {
    $proceso = Get-Process -Id $previo -EA SilentlyContinue
    if ($proceso) { $hayOtroCorriendo = $true }
  }
}

if ($hayOtroCorriendo) {
  Escribir-Log "Ya hay un respaldo corriendo (PID $previo). Este se saltea." 'AVISO'
  Terminar 0
}

Set-Content -LiteralPath $LOCK -Value $PID -Encoding ASCII

try {
  # ─── 2. Respaldo verificado en una carpeta local ─────────────────────────
  New-Item -ItemType Directory -Path $LOCAL_DIR -Force | Out-Null

  $sello   = Get-Date -Format 'yyyy-MM-dd_HHmmss'
  $archivo = "adai-nube-$sello.db"
  $local   = Join-Path $LOCAL_DIR $archivo

  Escribir-Log "Creando respaldo verificado: $archivo"
  $salida = & $nodeCmd (Join-Path $RUTA_SCRIPT 'crear-respaldo.js') $local 2>&1
  $codigo = $LASTEXITCODE

  $texto = ($salida | Out-String).Trim()
  if ($codigo -ne 0) {
    Escribir-Log "Falló la creación del respaldo: $texto" 'ERROR'
    Terminar 2
  }

  try { $info = $texto | ConvertFrom-Json } catch { $info = $null }
  if (-not $info -or -not $info.ok) {
    Escribir-Log "No se pudo leer el resumen del respaldo: $texto" 'ERROR'
    Terminar 2
  }

  $mb = [math]::Round($info.bytes / 1MB, 2)
  Escribir-Log ("Respaldo OK: {0} MB | ventas {1} | productos {2} | tablas {3} | integridad {4}" -f $mb, $info.ventas, $info.productos, $info.tablas, $info.integridad)
  if ($info.advertencia) { Escribir-Log $info.advertencia 'AVISO' }

  if ($info.ventas -eq 0 -and -not $Forzar) {
    Escribir-Log 'El respaldo no tiene ventas, no se sube. Si es correcto, usá -Forzar.' 'AVISO'
    Terminar 0
  }

  # ─── 3. Subir a Drive ────────────────────────────────────────────────────
  Escribir-Log "Subiendo a $Destino ..."
  $rcloneArgs = @('copyto', $local, "$Destino/$archivo")
  & rclone @rcloneArgs 2>&1 | ForEach-Object { Escribir-Log "  rclone: $_" }
  if ($LASTEXITCODE -ne 0) {
    Escribir-Log 'Falló la subida a Drive. El respaldo local quedó igual.' 'ERROR'
    Terminar 3
  }

  # ─── 4. Confirmar que lo que quedó arriba es lo mismo ───────────────────
  & rclone check "$Destino/$archivo" $local --download 2>&1 | ForEach-Object { Escribir-Log "  check: $_" }
  $verificado = ($LASTEXITCODE -eq 0)
  if ($verificado) {
    Escribir-Log "Subida verificada: $archivo está en Drive y coincide byte a byte."
  } else {
    Escribir-Log 'La copia en Drive NO coincide con el archivo local. Revisá la conexión.' 'ERROR'
  }

  # ─── 5. Limpieza: la nube y el disco ────────────────────────────────────
  if (-not $SoloSubir) {
    & rclone delete $Destino --min-age "${DiasEnNube}d" --include "adai-nube-*.db" 2>&1 |
      ForEach-Object { Escribir-Log "  limpieza nube: $_" }
    Escribir-Log "Limpieza en la nube: se borran los de más de $DiasEnNube días."

    $locales = Get-ChildItem -LiteralPath $LOCAL_DIR -Filter 'adai-nube-*.db' -EA SilentlyContinue |
      Sort-Object LastWriteTime -Descending
    if ($locales.Count -gt $CopiasLocales) {
      $sobran = $locales[$CopiasLocales..($locales.Count - 1)]
      foreach ($f in $sobran) { Remove-Item -LiteralPath $f.FullName -Force }
      Escribir-Log "Limpieza local: $($sobran.Count) copia(s) viejas borradas."
    }
  }

  # ─── 6. Aviso por correo (si está configurado) ─────────────────────────
  # Best effort: que falle el mail NO da por fallado el respaldo.
  $correo = & $nodeCmd (Join-Path $RUTA_SCRIPT 'avisar.js') $archivo $info.ventas $verificado 2>&1
  if ($LASTEXITCODE -eq 0) {
    Escribir-Log "Correo de aviso enviado: $correo"
  } else {
    Escribir-Log "Sin correo: $correo" 'AVISO'
  }

  Escribir-Log "=== Respaldo terminado correctamente ==="
  Terminar 0

} catch {
  Escribir-Log "Error inesperado: $($_.Exception.Message)" 'ERROR'
  Terminar 9
} finally {
  Remove-Item -LiteralPath $LOCK -Force -EA SilentlyContinue
}
