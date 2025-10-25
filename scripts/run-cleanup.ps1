# Script rápido para limpiar duplicados en Zadarma
# Uso: .\scripts\run-cleanup.ps1 [--dry-run] [--date YYYY-MM-DD]

param(
    [switch]$DryRun,
    [string]$Date
)

Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  LIMPIEZA DE DUPLICADOS - ZADARMA                         ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Verificar configuración de Firebase
if (-not $env:GOOGLE_APPLICATION_CREDENTIALS) {
    Write-Host "❌ Error: Firebase no está configurado" -ForegroundColor Red
    Write-Host ""
    Write-Host "Ejecuta primero:" -ForegroundColor Yellow
    Write-Host "   .\scripts\setup-firebase.ps1" -ForegroundColor White
    Write-Host ""
    exit 1
}

# Verificar que el archivo existe
if (-not (Test-Path $env:GOOGLE_APPLICATION_CREDENTIALS)) {
    Write-Host "❌ Error: El archivo service-account.json no existe" -ForegroundColor Red
    Write-Host "   Path configurado: $env:GOOGLE_APPLICATION_CREDENTIALS" -ForegroundColor Gray
    Write-Host ""
    exit 1
}

Write-Host "✅ Firebase configurado correctamente" -ForegroundColor Green
Write-Host "   Service Account: $env:GOOGLE_APPLICATION_CREDENTIALS" -ForegroundColor Gray
Write-Host ""

# Construir comando
$command = "npx tsx scripts/clean-zadarma-duplicates.ts"

if ($DryRun) {
    $command += " --dry-run"
    Write-Host "⚠️  MODO DRY-RUN: No se realizarán cambios reales" -ForegroundColor Yellow
} else {
    Write-Host "⚠️  MODO REAL: Se realizarán cambios permanentes en Firestore" -ForegroundColor Red
    Write-Host ""
    $confirm = Read-Host "¿Estás seguro de continuar? (S/N)"
    if ($confirm -ne "S" -and $confirm -ne "s") {
        Write-Host ""
        Write-Host "❌ Operación cancelada" -ForegroundColor Yellow
        exit 0
    }
}

if ($Date) {
    $command += " --date $Date"
    Write-Host "📅 Limpiando solo la fecha: $Date" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "🚀 Ejecutando limpieza..." -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host ""

# Ejecutar comando
Invoke-Expression $command

$exitCode = $LASTEXITCODE

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray

if ($exitCode -eq 0) {
    Write-Host ""
    Write-Host "✅ Script completado exitosamente" -ForegroundColor Green
    
    if ($DryRun) {
        Write-Host ""
        Write-Host "💡 Para ejecutar la limpieza real, usa:" -ForegroundColor Cyan
        Write-Host "   .\scripts\run-cleanup.ps1" -ForegroundColor White
        if ($Date) {
            Write-Host "   .\scripts\run-cleanup.ps1 -Date $Date" -ForegroundColor White
        }
    } else {
        Write-Host ""
        Write-Host "🎉 Duplicados eliminados exitosamente" -ForegroundColor Green
        Write-Host ""
        Write-Host "📋 Próximos pasos:" -ForegroundColor Cyan
        Write-Host "   1. Verificar el conteo en el dashboard" -ForegroundColor White
        Write-Host "   2. Comparar con los datos de Zadarma" -ForegroundColor White
        Write-Host "   3. Hacer deploy de las correcciones del cron job" -ForegroundColor White
    }
} else {
    Write-Host ""
    Write-Host "❌ Error durante la ejecución" -ForegroundColor Red
    Write-Host "   Revisa los logs arriba para más detalles" -ForegroundColor Gray
}

Write-Host ""
exit $exitCode
