<#
.SYNOPSIS
  Registra la tarea de Windows que sube el respaldo a Google Drive todos los días.

  La tarea corre aunque ADAI POS esté cerrado, y si el equipo estaba apagado a
  la hora programada, se ejecuta apenas se enciende (StartWhenAvailable).
  Eso es justamente lo que un respaldo dentro de la app no puede garantizar.

  Uso:
    powershell -NoProfile -ExecutionPolicy Bypass -File instalar-tarea.ps1
    powershell -NoProfile -ExecutionPolicy Bypass -File instalar-tarea.ps1 -Hora "03:30" -Desinstalar
#>
[CmdletBinding()]
param(
  # Hora de la corrida diaria, formato HH:mm
  [string] $Hora = '02:00',

  [string] $NombreTarea = 'AdaiPOS - Respaldo en la nube',

  # Borra la tarea en vez de crearla
  [switch] $Desinstalar
)

$ErrorActionPreference = 'Stop'
$script = Join-Path $PSScriptRoot 'respaldar-nube.ps1'

if ($Desinstalar) {
  if (Get-ScheduledTask -TaskName $NombreTarea -EA SilentlyContinue) {
    Unregister-ScheduledTask -TaskName $NombreTarea -Confirm:$false
    Write-Host "Tarea '$NombreTarea' borrada."
  } else {
    Write-Host "No había ninguna tarea con ese nombre."
  }
  return
}

if (-not (Test-Path -LiteralPath $script)) {
  throw "No se encuentra respaldar-nube.ps1 en $PSScriptRoot"
}

try { [datetime]::ParseExact($Hora, 'HH:mm', $null) | Out-Null }
catch { throw "La hora '$Hora' no tiene el formato HH:mm (por ejemplo 02:30)" }

$accion = New-ScheduledTaskAction `
  -Execute 'powershell.exe' `
  -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$script`""

$trigger = New-ScheduledTaskTrigger -Daily -At $Hora

# -StartWhenAvailable es lo importante: si la máquina estaba apagada a las 2,
# el respaldo sale igual en cuanto se enciende, en vez de perderse ese día.
$ajustes = New-ScheduledTaskSettingsSet `
  -StartWhenAvailable `
  -DontStopIfGoingOnBatteries `
  -ExecutionTimeLimit (New-TimeSpan -Minutes 30) `
  -MultipleInstances IgnoreNew

Register-ScheduledTask `
  -TaskName $NombreTarea `
  -Action $accion `
  -Trigger $trigger `
  -Settings $ajustes `
  -Description 'Copia verificada de adai.db a Google Drive. No requiere ADAI POS abierto.' `
  -Force | Out-Null

Write-Host ''
Write-Host "Tarea creada: $NombreTarea"
Write-Host "  Corre todos los días a las $Hora"
Write-Host "  Si el equipo estaba apagado, corre apenas se enciende"
Write-Host "  Log: $(Join-Path $PSScriptRoot 'respaldos.log')"
Write-Host ''
Write-Host 'Para probarla ahora mismo:'
Write-Host "  Start-ScheduledTask -TaskName '$NombreTarea'"
Write-Host 'Para verla o quitarla:'
Write-Host "  Get-ScheduledTask -TaskName '$NombreTarea'"
Write-Host "  powershell -NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`" -Desinstalar"
