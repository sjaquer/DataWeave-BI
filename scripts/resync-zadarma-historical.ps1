# ===================================================================
# SCRIPT DE RE-SINCRONIZACIÓN DE DATOS ZADARMA
# Versión: 2.1.0
# Fecha: 17 de Enero, 2025
# ===================================================================
# 
# PROPÓSITO:
# Re-sincronizar datos históricos de Zadarma después del fix de
# agrupación por fecha. Esto es necesario porque los datos antiguos
# se guardaron con docId sin fecha, causando sobrescrituras.
#
# USO:
# 1. Abrir PowerShell como Administrador
# 2. Navegar a la carpeta del proyecto
# 3. Ejecutar: .\scripts\resync-zadarma-historical.ps1
#
# ===================================================================

# Colores para output
$ESC = [char]27
$ColorReset = "$ESC[0m"
$ColorRed = "$ESC[31m"
$ColorGreen = "$ESC[32m"
$ColorYellow = "$ESC[33m"
$ColorCyan = "$ESC[36m"

# ===================================================================
# CONFIGURACIÓN
# ===================================================================

Write-Host "`n$ColorCyan========================================" -NoNewline
Write-Host "$ColorReset"
Write-Host "$ColorCyan  RE-SINCRONIZACIÓN ZADARMA" -NoNewline
Write-Host "$ColorReset"
Write-Host "$ColorCyan========================================$ColorReset`n"

# Solicitar dominio
$domain = Read-Host "Ingresa tu dominio de Vercel (ej: dataweave-bi.vercel.app)"

if ([string]::IsNullOrWhiteSpace($domain)) {
    Write-Host "${ColorRed}❌ Error: Dominio requerido$ColorReset" -ForegroundColor Red
    exit 1
}

Write-Host "`n${ColorGreen}✅ Dominio configurado: $domain$ColorReset`n"

# ===================================================================
# FUNCIONES AUXILIARES
# ===================================================================

function Write-Header {
    param([string]$text)
    Write-Host "`n$ColorCyan========================================$ColorReset"
    Write-Host "$ColorCyan  $text$ColorReset"
    Write-Host "$ColorCyan========================================$ColorReset`n"
}

function Sync-ZadarmaDate {
    param(
        [string]$date,
        [string]$domain,
        [bool]$forceSync = $true
    )
    
    $startDateTime = "${date}T00:00:00Z"
    $endDateTime = "${date}T23:59:59Z"
    
    Write-Host "${ColorYellow}🔄 Sincronizando $date...$ColorReset" -NoNewline
    
    $body = @{
        startDate = $startDateTime
        endDate   = $endDateTime
        forceSync = $forceSync
    } | ConvertTo-Json
    
    try {
        $response = Invoke-RestMethod `
            -Uri "https://$domain/api/zadarma/sync" `
            -Method Post `
            -Body $body `
            -ContentType "application/json" `
            -TimeoutSec 60
        
        if ($response.status -eq "success") {
            $calls = $response.totalCallsSynced
            Write-Host " ${ColorGreen}✅ $calls llamadas$ColorReset"
            return @{
                success = $true
                calls = $calls
                date = $date
            }
        } else {
            Write-Host " ${ColorRed}❌ Error: $($response.message)$ColorReset"
            return @{
                success = $false
                calls = 0
                date = $date
                error = $response.message
            }
        }
    }
    catch {
        $errorMsg = $_.Exception.Message
        Write-Host " ${ColorRed}❌ Error: $errorMsg$ColorReset"
        return @{
            success = $false
            calls = 0
            date = $date
            error = $errorMsg
        }
    }
}

function Show-Progress {
    param(
        [int]$current,
        [int]$total,
        [string]$activity
    )
    
    $percent = [math]::Round(($current / $total) * 100)
    Write-Progress `
        -Activity $activity `
        -Status "$current de $total ($percent%)" `
        -PercentComplete $percent
}

# ===================================================================
# MENÚ PRINCIPAL
# ===================================================================

Write-Host "Selecciona una opción:`n"
Write-Host "  [1] Re-sincronizar semana específica (oct 06-12, 2025)"
Write-Host "  [2] Re-sincronizar rango personalizado"
Write-Host "  [3] Re-sincronizar últimos 7 días"
Write-Host "  [4] Re-sincronizar últimos 30 días"
Write-Host "  [5] Salir`n"

$opcion = Read-Host "Opción"

# ===================================================================
# PROCESAMIENTO SEGÚN OPCIÓN
# ===================================================================

$fechasAResincronizar = @()
$nombreOperacion = ""

switch ($opcion) {
    "1" {
        $nombreOperacion = "Semana oct 06-12, 2025"
        $fechasAResincronizar = @(
            "2025-10-06",
            "2025-10-07",
            "2025-10-08",
            "2025-10-09",
            "2025-10-10",
            "2025-10-11",
            "2025-10-12"
        )
    }
    
    "2" {
        $nombreOperacion = "Rango personalizado"
        $fechaInicio = Read-Host "Fecha de inicio (YYYY-MM-DD)"
        $fechaFin = Read-Host "Fecha de fin (YYYY-MM-DD)"
        
        try {
            $inicio = [DateTime]::Parse($fechaInicio)
            $fin = [DateTime]::Parse($fechaFin)
            
            $fecha = $inicio
            while ($fecha -le $fin) {
                $fechasAResincronizar += $fecha.ToString("yyyy-MM-dd")
                $fecha = $fecha.AddDays(1)
            }
        }
        catch {
            Write-Host "${ColorRed}❌ Error: Fechas inválidas$ColorReset"
            exit 1
        }
    }
    
    "3" {
        $nombreOperacion = "Últimos 7 días"
        for ($i = 1; $i -le 7; $i++) {
            $fecha = (Get-Date).AddDays(-$i).ToString("yyyy-MM-dd")
            $fechasAResincronizar += $fecha
        }
    }
    
    "4" {
        $nombreOperacion = "Últimos 30 días"
        for ($i = 1; $i -le 30; $i++) {
            $fecha = (Get-Date).AddDays(-$i).ToString("yyyy-MM-dd")
            $fechasAResincronizar += $fecha
        }
    }
    
    "5" {
        Write-Host "${ColorCyan}👋 Saliendo...$ColorReset"
        exit 0
    }
    
    default {
        Write-Host "${ColorRed}❌ Opción inválida$ColorReset"
        exit 1
    }
}

# ===================================================================
# CONFIRMACIÓN
# ===================================================================

Write-Header "CONFIRMACIÓN"

Write-Host "Operación: $ColorYellow$nombreOperacion$ColorReset"
Write-Host "Dominio: $ColorYellow$domain$ColorReset"
Write-Host "Fechas a sincronizar: $ColorYellow$($fechasAResincronizar.Count)$ColorReset"
Write-Host "Rango: $ColorYellow$($fechasAResincronizar[0]) a $($fechasAResincronizar[-1])$ColorReset`n"

$confirmar = Read-Host "¿Continuar? (S/N)"

if ($confirmar -ne "S" -and $confirmar -ne "s") {
    Write-Host "${ColorCyan}👋 Operación cancelada$ColorReset"
    exit 0
}

# ===================================================================
# EJECUCIÓN DE RE-SINCRONIZACIÓN
# ===================================================================

Write-Header "INICIANDO RE-SINCRONIZACIÓN"

$resultados = @()
$totalCallsSynced = 0
$successCount = 0
$errorCount = 0

$index = 0
foreach ($fecha in $fechasAResincronizar) {
    $index++
    Show-Progress -current $index -total $fechasAResincronizar.Count -activity "Re-sincronizando datos históricos"
    
    $resultado = Sync-ZadarmaDate -date $fecha -domain $domain
    $resultados += $resultado
    
    if ($resultado.success) {
        $totalCallsSynced += $resultado.calls
        $successCount++
    } else {
        $errorCount++
    }
    
    # Evitar rate limiting
    Start-Sleep -Seconds 2
}

Write-Progress -Activity "Re-sincronización" -Completed

# ===================================================================
# RESUMEN DE RESULTADOS
# ===================================================================

Write-Header "RESUMEN DE RESULTADOS"

Write-Host "Operación: $nombreOperacion"
Write-Host "Fechas procesadas: $($fechasAResincronizar.Count)"
Write-Host "${ColorGreen}✅ Exitosas: $successCount$ColorReset"

if ($errorCount -gt 0) {
    Write-Host "${ColorRed}❌ Errores: $errorCount$ColorReset"
}

Write-Host "${ColorCyan}📞 Total de llamadas sincronizadas: $totalCallsSynced$ColorReset`n"

# Mostrar errores si los hay
if ($errorCount -gt 0) {
    Write-Host "${ColorRed}Fechas con errores:$ColorReset"
    foreach ($resultado in $resultados) {
        if (-not $resultado.success) {
            Write-Host "  - $($resultado.date): $($resultado.error)"
        }
    }
    Write-Host ""
}

# ===================================================================
# ESTADÍSTICAS DETALLADAS
# ===================================================================

$promedioLlamadasPorDia = [math]::Round($totalCallsSynced / $successCount, 2)

Write-Host "${ColorCyan}📊 Estadísticas:$ColorReset"
Write-Host "  - Promedio de llamadas por día: $promedioLlamadasPorDia"
Write-Host "  - Tasa de éxito: $([math]::Round(($successCount / $fechasAResincronizar.Count) * 100, 2))%`n"

# ===================================================================
# VERIFICACIÓN POST-SINCRONIZACIÓN
# ===================================================================

Write-Header "VERIFICACIÓN"

Write-Host "Los datos han sido re-sincronizados. Para verificar:`n"
Write-Host "  1. Abre tu aplicación: ${ColorYellow}https://$domain$ColorReset"
Write-Host "  2. Ve a: ${ColorYellow}Dashboard → Rendimiento de Asesor$ColorReset"
Write-Host "  3. Selecciona el rango: ${ColorYellow}$($fechasAResincronizar[0]) - $($fechasAResincronizar[-1])$ColorReset"
Write-Host "  4. Verifica que los números reflejen la realidad (700-900 llamadas/semana)`n"

Write-Host "${ColorGreen}✅ Sincronización calculada como completada$ColorReset"
Write-Host "${ColorCyan}🎉 ¡Proceso finalizado!$ColorReset`n"

# ===================================================================
# EXPORTAR REPORTE (OPCIONAL)
# ===================================================================

$exportar = Read-Host "¿Deseas exportar un reporte CSV? (S/N)"

if ($exportar -eq "S" -or $exportar -eq "s") {
    $reportPath = ".\zadarma-sync-report-$(Get-Date -Format 'yyyy-MM-dd-HHmmss').csv"
    
    $resultados | ForEach-Object {
        [PSCustomObject]@{
            Fecha = $_.date
            Exitoso = $_.success
            Llamadas = $_.calls
            Error = if ($_.error) { $_.error } else { "" }
        }
    } | Export-Csv -Path $reportPath -NoTypeInformation -Encoding UTF8
    
    Write-Host "${ColorGreen}✅ Reporte exportado: $reportPath$ColorReset`n"
}

Write-Host "${ColorCyan}Presiona Enter para salir...$ColorReset"
Read-Host
