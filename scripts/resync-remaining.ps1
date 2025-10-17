# Script para completar sincronizacion (dias restantes)

$domain = "dataweave-bi.vercel.app"

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

Write-Host "`nEsperando 30 segundos para evitar rate limiting..." -ForegroundColor Yellow
Start-Sleep -Seconds 30

Write-Host "`nCompletando sincronizacion de dias restantes...`n" -ForegroundColor Cyan

$fechasRestantes = @(
    "2025-10-09",
    "2025-10-10",
    "2025-10-11",
    "2025-10-12"
)

$totalCalls = 0

foreach ($fecha in $fechasRestantes) {
    $calls = Sync-Date -fecha $fecha
    $totalCalls += $calls
    Start-Sleep -Seconds 5  # Mas tiempo entre requests
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "SINCRONIZACION COMPLETADA" -ForegroundColor Green
Write-Host "Dias restantes sincronizados: $totalCalls llamadas" -ForegroundColor Green
Write-Host "========================================`n" -ForegroundColor Cyan

Write-Host "Presiona Enter para salir..."
Read-Host
