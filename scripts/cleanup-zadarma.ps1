# SCRIPT DE LIMPIEZA RÁPIDA DE ZADARMA
# Elimina todos los datos de Zadarma de Firestore

param(
    [switch]$DryRun,
    [switch]$Confirm
)

Write-Host "🧹 LIMPIEZA DE BASE DE DATOS ZADARMA" -ForegroundColor Cyan
Write-Host "=" * 50 -ForegroundColor Gray

if (-not $DryRun -and -not $Confirm) {
    Write-Host "❌ Debes especificar un modo:" -ForegroundColor Red
    Write-Host "   Simulación: .\scripts\cleanup-zadarma.ps1 -DryRun" -ForegroundColor Yellow
    Write-Host "   Limpieza real: .\scripts\cleanup-zadarma.ps1 -Confirm" -ForegroundColor Yellow
    exit 1
}

# Cambiar al directorio del proyecto
$projectRoot = Split-Path $PSScriptRoot -Parent
Set-Location $projectRoot

Write-Host "📁 Directorio del proyecto: $projectRoot" -ForegroundColor Gray

# Verificar que existe el archivo TypeScript
$scriptPath = "scripts\cleanup-zadarma-database.ts"
if (-not (Test-Path $scriptPath)) {
    Write-Host "❌ No se encuentra el script: $scriptPath" -ForegroundColor Red
    exit 1
}

# Construir comando
if ($DryRun) {
    Write-Host "🔍 Ejecutando en modo DRY RUN (simulación)..." -ForegroundColor Yellow
    $command = "npx ts-node $scriptPath --dry-run"
} else {
    Write-Host "⚠️  Ejecutando LIMPIEZA REAL..." -ForegroundColor Red
    $command = "npx ts-node $scriptPath --confirm"
}

Write-Host "🚀 Comando: $command" -ForegroundColor Gray
Write-Host ""

# Ejecutar el script
try {
    Invoke-Expression $command
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "✅ Script ejecutado exitosamente" -ForegroundColor Green
    } else {
        Write-Host ""
        Write-Host "❌ El script falló con código: $LASTEXITCODE" -ForegroundColor Red
        exit $LASTEXITCODE
    }
} catch {
    Write-Host ""
    Write-Host "❌ Error ejecutando el script: $_" -ForegroundColor Red
    exit 1
}