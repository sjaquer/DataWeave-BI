# ================================================================
# Script de Limpieza de Archivos Obsoletos
# DataWeave BI - Sistema Zadarma
# ================================================================
# 
# PROPÓSITO:
#   Eliminar scripts de testing/migración obsoletos que ya no se usan
#   y archivar documentación redundante
# 
# USO:
#   .\scripts\cleanup-obsolete-files.ps1
# 
# SEGURIDAD:
#   - Pregunta confirmación antes de eliminar
#   - Crea backup automático antes de proceder
#   - Lista todos los archivos antes de eliminar
# 
# ================================================================

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  LIMPIEZA DE ARCHIVOS OBSOLETOS" -ForegroundColor Cyan
Write-Host "  DataWeave BI - Sistema Zadarma" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# ================================================================
# CONFIGURACIÓN
# ================================================================

$projectRoot = "I:\Documentos\DESARROLLO\APLICACIONES EMPRESARIALES\DataWeave-BI"
$backupFolder = "$projectRoot\backup-cleanup-$(Get-Date -Format 'yyyy-MM-dd-HHmmss')"
$archiveFolder = "$projectRoot\docs\archive"

# Archivos a ELIMINAR (scripts obsoletos)
$filesToDelete = @(
    # Scripts de testing NO relacionados con Zadarma
    "$projectRoot\scripts\check-courier-data.ts",
    "$projectRoot\scripts\check-envios-temporales.ts",
    "$projectRoot\scripts\check-payment-methods.ts",
    "$projectRoot\scripts\fix-double-dash-orders.ts",
    "$projectRoot\scripts\fix-store-ids.ts",
    
    # Scripts de Zadarma de uso único (ya ejecutados)
    "$projectRoot\scripts\resync-zadarma-historical.ps1",
    "$projectRoot\scripts\resync-remaining.ps1"
)

# Archivos a ARCHIVAR (documentación redundante)
$filesToArchive = @(
    "$projectRoot\docs\ZADARMA-CACHE-SYSTEM.md",
    "$projectRoot\docs\INSTRUCCIONES-DEPLOY-CACHE-ZADARMA.md",
    "$projectRoot\docs\CHECKLIST-DEPLOYMENT-FIX-RANGOS.md",
    "$projectRoot\docs\RESUMEN-EJECUTIVO-FIX-RANGOS.md"
)

# ================================================================
# FUNCIÓN: Crear Backup
# ================================================================

function Create-Backup {
    Write-Host ""
    Write-Host "📦 Creando backup de seguridad..." -ForegroundColor Yellow
    
    New-Item -ItemType Directory -Path $backupFolder -Force | Out-Null
    
    $backupCount = 0
    
    # Backup de archivos a eliminar
    foreach ($file in $filesToDelete) {
        if (Test-Path $file) {
            $relativePath = $file.Replace($projectRoot, "")
            $backupPath = Join-Path $backupFolder $relativePath
            $backupDir = Split-Path $backupPath -Parent
            
            New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
            Copy-Item $file $backupPath -Force
            $backupCount++
        }
    }
    
    # Backup de archivos a archivar
    foreach ($file in $filesToArchive) {
        if (Test-Path $file) {
            $relativePath = $file.Replace($projectRoot, "")
            $backupPath = Join-Path $backupFolder $relativePath
            $backupDir = Split-Path $backupPath -Parent
            
            New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
            Copy-Item $file $backupPath -Force
            $backupCount++
        }
    }
    
    Write-Host "✅ Backup creado: $backupFolder" -ForegroundColor Green
    Write-Host "   Archivos respaldados: $backupCount" -ForegroundColor Gray
}

# ================================================================
# FUNCIÓN: Listar Archivos
# ================================================================

function List-Files {
    Write-Host ""
    Write-Host "📋 ARCHIVOS A PROCESAR:" -ForegroundColor Cyan
    Write-Host ""
    
    Write-Host "🗑️  ELIMINAR (7 archivos):" -ForegroundColor Red
    foreach ($file in $filesToDelete) {
        $exists = Test-Path $file
        $status = if ($exists) { "✓" } else { "✗ NO EXISTE" }
        $fileName = Split-Path $file -Leaf
        Write-Host "   $status  $fileName" -ForegroundColor $(if ($exists) { "White" } else { "Gray" })
    }
    
    Write-Host ""
    Write-Host "📦 ARCHIVAR (4 archivos):" -ForegroundColor Yellow
    foreach ($file in $filesToArchive) {
        $exists = Test-Path $file
        $status = if ($exists) { "✓" } else { "✗ NO EXISTE" }
        $fileName = Split-Path $file -Leaf
        Write-Host "   $status  $fileName" -ForegroundColor $(if ($exists) { "White" } else { "Gray" })
    }
    
    Write-Host ""
}

# ================================================================
# FUNCIÓN: Eliminar Archivos
# ================================================================

function Remove-ObsoleteFiles {
    Write-Host ""
    Write-Host "🗑️  Eliminando archivos obsoletos..." -ForegroundColor Red
    
    $deletedCount = 0
    
    foreach ($file in $filesToDelete) {
        if (Test-Path $file) {
            $fileName = Split-Path $file -Leaf
            Remove-Item $file -Force
            Write-Host "   ✓ Eliminado: $fileName" -ForegroundColor Gray
            $deletedCount++
        }
    }
    
    Write-Host ""
    Write-Host "✅ Archivos eliminados: $deletedCount" -ForegroundColor Green
}

# ================================================================
# FUNCIÓN: Archivar Documentos
# ================================================================

function Archive-Documents {
    Write-Host ""
    Write-Host "📦 Archivando documentación redundante..." -ForegroundColor Yellow
    
    # Crear carpeta de archivo
    if (-not (Test-Path $archiveFolder)) {
        New-Item -ItemType Directory -Path $archiveFolder -Force | Out-Null
        Write-Host "   ✓ Creada carpeta: docs\archive\" -ForegroundColor Gray
    }
    
    $archivedCount = 0
    
    foreach ($file in $filesToArchive) {
        if (Test-Path $file) {
            $fileName = Split-Path $file -Leaf
            $destination = Join-Path $archiveFolder $fileName
            
            Move-Item $file $destination -Force
            Write-Host "   ✓ Archivado: $fileName" -ForegroundColor Gray
            $archivedCount++
        }
    }
    
    Write-Host ""
    Write-Host "✅ Documentos archivados: $archivedCount" -ForegroundColor Green
}

# ================================================================
# FUNCIÓN: Crear README en Archive
# ================================================================

function Create-ArchiveReadme {
    $readmePath = Join-Path $archiveFolder "README.md"
    
    $readmeContent = @"
# 📦 Archivo de Documentación

Esta carpeta contiene documentación **obsoleta o redundante** del sistema Zadarma.

## 📅 Fecha de Archivo

**$(Get-Date -Format 'dd de MMMM de yyyy, HH:mm')**

---

## 📄 Documentos Archivados

### ZADARMA-CACHE-SYSTEM.md
- **Razón:** Versión anterior del sistema de caché
- **Reemplazado por:** `ZADARMA-AUTO-CACHING.md`
- **Estado:** Obsoleto - usar doc actualizado

### INSTRUCCIONES-DEPLOY-CACHE-ZADARMA.md
- **Razón:** Instrucciones de deployment de versión anterior
- **Reemplazado por:** `ZADARMA-AUTO-CACHING.md` (sección de deployment)
- **Estado:** Obsoleto - usar doc actualizado

### CHECKLIST-DEPLOYMENT-FIX-RANGOS.md
- **Razón:** Checklist de deployment del fix de rangos de fechas
- **Estado:** ✅ Completado el 17/01/2025 - Histórico únicamente

### RESUMEN-EJECUTIVO-FIX-RANGOS.md
- **Razón:** Resumen ejecutivo del fix de rangos
- **Reemplazado por:** `FIX-SUMA-RANGOS-FECHAS-2025-01-17.md`
- **Estado:** Redundante - versión completa disponible

---

## 📖 Documentación Activa

Para documentación actualizada del sistema Zadarma, consulta:

- **`ZADARMA-AUTO-CACHING.md`** - Sistema completo de caché inteligente
- **`FIX-SUMA-RANGOS-FECHAS-2025-01-17.md`** - Fix crítico de agregación
- **`AUDITORIA-RENDIMIENTO-ZADARMA-2025-01-17.md`** - Auditoría completa del sistema
- **`VERIFICACION-FINAL-FIX-2025-01-17.md`** - Verificación post-deployment

---

## ⚠️ Nota

Los documentos en esta carpeta se mantienen **únicamente con propósito histórico**.

**NO deben usarse como referencia para desarrollo actual.**

---

*Archivado automáticamente por: cleanup-obsolete-files.ps1*
"@
    
    Set-Content -Path $readmePath -Value $readmeContent -Encoding UTF8
    Write-Host "   ✓ Creado: docs\archive\README.md" -ForegroundColor Gray
}

# ================================================================
# EJECUCIÓN PRINCIPAL
# ================================================================

try {
    # Listar archivos
    List-Files
    
    # Confirmación del usuario
    Write-Host ""
    Write-Host "⚠️  ADVERTENCIA:" -ForegroundColor Yellow
    Write-Host "   Se eliminarán 7 archivos y se archivarán 4 documentos." -ForegroundColor Yellow
    Write-Host "   Se creará un backup automático antes de proceder." -ForegroundColor Yellow
    Write-Host ""
    
    $confirmation = Read-Host "¿Deseas continuar? (S/N)"
    
    if ($confirmation -ne 'S' -and $confirmation -ne 's') {
        Write-Host ""
        Write-Host "❌ Operación cancelada por el usuario." -ForegroundColor Red
        Write-Host ""
        exit 0
    }
    
    # Crear backup
    Create-Backup
    
    # Eliminar archivos obsoletos
    Remove-ObsoleteFiles
    
    # Archivar documentos
    Archive-Documents
    
    # Crear README en archive
    Create-ArchiveReadme
    
    # Resumen final
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  ✅ LIMPIEZA COMPLETADA EXITOSAMENTE" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "📊 RESUMEN:" -ForegroundColor Cyan
    Write-Host "   • Archivos eliminados: 7" -ForegroundColor White
    Write-Host "   • Documentos archivados: 4" -ForegroundColor White
    Write-Host "   • Backup creado: $backupFolder" -ForegroundColor White
    Write-Host ""
    Write-Host "📁 ARCHIVOS RESTANTES ACTIVOS:" -ForegroundColor Cyan
    Write-Host "   • src/app/(app)/dashboard/performance/page.tsx" -ForegroundColor Green
    Write-Host "   • src/app/api/zadarma/stats/route.ts" -ForegroundColor Green
    Write-Host "   • src/app/api/zadarma/sync/route.ts" -ForegroundColor Green
    Write-Host "   • src/app/api/cron/zadarma-daily-sync/route.ts" -ForegroundColor Green
    Write-Host "   • src/lib/zadarma-helpers.ts" -ForegroundColor Green
    Write-Host "   • src/types/zadarma.ts" -ForegroundColor Green
    Write-Host "   • scripts/resync-simple.ps1" -ForegroundColor Green
    Write-Host ""
    Write-Host "💡 Si necesitas restaurar algún archivo:" -ForegroundColor Yellow
    Write-Host "   Copia desde: $backupFolder" -ForegroundColor Yellow
    Write-Host ""
    
} catch {
    Write-Host ""
    Write-Host "❌ ERROR: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "💡 Si algo salió mal, restaura desde el backup:" -ForegroundColor Yellow
    Write-Host "   $backupFolder" -ForegroundColor Yellow
    Write-Host ""
    exit 1
}
