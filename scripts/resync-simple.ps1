# Script simplificado de re-sincronizacion Zadarma
# Ejecutar despues del fix de rangos de fechas

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "RE-SINCRONIZACION ZADARMA" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Configuracion
$domain = Read-Host "Ingresa tu dominio de Vercel (ej: dataweave-bi.vercel.app)"

if ([string]::IsNullOrWhiteSpace($domain)) {
    Write-Host "ERROR: Dominio requerido" -ForegroundColor Red
    exit 1
}

Write-Host "`nDominio configurado: $domain`n" -ForegroundColor Green

# Funcion para sincronizar una fecha
function Sync-Date {
    param([string]$fecha)
    
    Write-Host "Sincronizando $fecha..." -ForegroundColor Yellow -NoNewline
    
    $body = @{
        startDate = "${fecha}T00:00:00Z"
        endDate   = "${fecha}T23:59:59Z"
        forceSync = $true
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
            Write-Host " OK - $calls llamadas" -ForegroundColor Green
            return $calls
        } else {
            Write-Host " ERROR: $($response.message)" -ForegroundColor Red
            return 0
        }
    }
    catch {
        Write-Host " ERROR: $($_.Exception.Message)" -ForegroundColor Red
        return 0
    }
}

# Fechas a sincronizar (semana oct 06-12)
$fechas = @(
    "2025-10-06",
    "2025-10-07",
    "2025-10-08",
    "2025-10-09",
    "2025-10-10",
    "2025-10-11",
    "2025-10-12"
)

Write-Host "Iniciando re-sincronizacion de $($fechas.Count) dias...`n" -ForegroundColor Cyan

$totalCalls = 0

foreach ($fecha in $fechas) {
    $calls = Sync-Date -fecha $fecha
    $totalCalls += $calls
    Start-Sleep -Seconds 2
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "COMPLETADO" -ForegroundColor Green
Write-Host "Total de llamadas sincronizadas: $totalCalls" -ForegroundColor Green
Write-Host "========================================`n" -ForegroundColor Cyan

Write-Host "Ahora verifica en la aplicacion:" -ForegroundColor Yellow
Write-Host "1. Abre: https://$domain" -ForegroundColor White
Write-Host "2. Ve a: Dashboard > Rendimiento de Asesor" -ForegroundColor White
Write-Host "3. Selecciona: oct 06-12, 2025" -ForegroundColor White
Write-Host "4. Deberas ver ~700-900 llamadas por asesora`n" -ForegroundColor White

Write-Host "Presiona Enter para salir..."
Read-Host
