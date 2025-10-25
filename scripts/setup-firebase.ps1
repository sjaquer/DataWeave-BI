# Script de configuración de Firebase para scripts de limpieza
# Uso: .\scripts\setup-firebase.ps1

Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  CONFIGURACIÓN DE FIREBASE ADMIN SDK                      ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Verificar si ya existe la variable de entorno
if ($env:GOOGLE_APPLICATION_CREDENTIALS) {
    Write-Host "✅ GOOGLE_APPLICATION_CREDENTIALS ya está configurada:" -ForegroundColor Green
    Write-Host "   $env:GOOGLE_APPLICATION_CREDENTIALS" -ForegroundColor Gray
    Write-Host ""
    
    # Verificar si el archivo existe
    if (Test-Path $env:GOOGLE_APPLICATION_CREDENTIALS) {
        Write-Host "✅ El archivo existe y es accesible" -ForegroundColor Green
        Write-Host ""
        Write-Host "🚀 Listo para ejecutar scripts. Puedes proceder con:" -ForegroundColor Cyan
        Write-Host "   npx tsx scripts/clean-zadarma-duplicates.ts --dry-run" -ForegroundColor Yellow
        exit 0
    } else {
        Write-Host "❌ El archivo no existe en esa ruta" -ForegroundColor Red
        Write-Host "   Continuando con configuración manual..." -ForegroundColor Yellow
        Write-Host ""
    }
}

Write-Host "🔍 No se encontró configuración de Firebase Admin SDK" -ForegroundColor Yellow
Write-Host ""
Write-Host "Para ejecutar los scripts necesitas configurar el Service Account." -ForegroundColor White
Write-Host ""
Write-Host "Opciones:" -ForegroundColor Cyan
Write-Host ""
Write-Host "1️⃣  Ya tengo el archivo service-account.json descargado" -ForegroundColor White
Write-Host "2️⃣  Necesito descargarlo de Firebase Console" -ForegroundColor White
Write-Host "3️⃣  Usar Firebase CLI para autenticar" -ForegroundColor White
Write-Host "4️⃣  Cancelar" -ForegroundColor White
Write-Host ""

$choice = Read-Host "Elige una opción (1-4)"

switch ($choice) {
    "1" {
        Write-Host ""
        Write-Host "📁 Buscando archivo service-account.json..." -ForegroundColor Cyan
        
        # Buscar en ubicaciones comunes
        $commonPaths = @(
            "$PSScriptRoot\..\service-account.json",
            "$PSScriptRoot\service-account.json",
            "$env:USERPROFILE\Downloads\service-account.json",
            "$env:USERPROFILE\Documents\service-account.json"
        )
        
        $foundPath = $null
        foreach ($path in $commonPaths) {
            $resolvedPath = Resolve-Path $path -ErrorAction SilentlyContinue
            if ($resolvedPath -and (Test-Path $resolvedPath)) {
                Write-Host "   ✅ Encontrado en: $resolvedPath" -ForegroundColor Green
                $foundPath = $resolvedPath
                break
            }
        }
        
        if ($foundPath) {
            $usePath = Read-Host "¿Usar este archivo? (S/N)"
            if ($usePath -eq "S" -or $usePath -eq "s") {
                $serviceAccountPath = $foundPath
            } else {
                $serviceAccountPath = Read-Host "Ingresa el path completo al archivo service-account.json"
            }
        } else {
            Write-Host "   ⚠️  No se encontró automáticamente" -ForegroundColor Yellow
            $serviceAccountPath = Read-Host "Ingresa el path completo al archivo service-account.json"
        }
        
        # Verificar que el archivo existe
        if (Test-Path $serviceAccountPath) {
            # Convertir a path absoluto
            $absolutePath = (Resolve-Path $serviceAccountPath).Path
            
            # Configurar variable de entorno
            $env:GOOGLE_APPLICATION_CREDENTIALS = $absolutePath
            
            Write-Host ""
            Write-Host "✅ Configuración exitosa!" -ForegroundColor Green
            Write-Host "   Variable configurada: GOOGLE_APPLICATION_CREDENTIALS" -ForegroundColor Gray
            Write-Host "   Path: $absolutePath" -ForegroundColor Gray
            Write-Host ""
            Write-Host "⚠️  NOTA: Esta configuración es temporal (solo para esta sesión)" -ForegroundColor Yellow
            Write-Host ""
            Write-Host "Para hacerla permanente, agrega esta línea a tu perfil de PowerShell:" -ForegroundColor Cyan
            Write-Host "   `$env:GOOGLE_APPLICATION_CREDENTIALS=`"$absolutePath`"" -ForegroundColor White
            Write-Host ""
            Write-Host "🚀 Ahora puedes ejecutar:" -ForegroundColor Cyan
            Write-Host "   npx tsx scripts/clean-zadarma-duplicates.ts --dry-run" -ForegroundColor Yellow
            
        } else {
            Write-Host ""
            Write-Host "❌ Error: El archivo no existe en esa ubicación" -ForegroundColor Red
            Write-Host "   Path intentado: $serviceAccountPath" -ForegroundColor Gray
            exit 1
        }
    }
    
    "2" {
        Write-Host ""
        Write-Host "📋 Sigue estos pasos:" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "1. Ve a Firebase Console: https://console.firebase.google.com/" -ForegroundColor White
        Write-Host "2. Selecciona tu proyecto" -ForegroundColor White
        Write-Host "3. Ve a ⚙️ Project Settings > Service Accounts" -ForegroundColor White
        Write-Host "4. Click en 'Generate New Private Key'" -ForegroundColor White
        Write-Host "5. Guarda el archivo como 'service-account.json'" -ForegroundColor White
        Write-Host "6. Vuelve a ejecutar este script y elige la opción 1" -ForegroundColor White
        Write-Host ""
        
        # Abrir navegador
        $openBrowser = Read-Host "¿Abrir Firebase Console en el navegador? (S/N)"
        if ($openBrowser -eq "S" -or $openBrowser -eq "s") {
            Start-Process "https://console.firebase.google.com/"
        }
    }
    
    "3" {
        Write-Host ""
        Write-Host "🔧 Usando Firebase CLI..." -ForegroundColor Cyan
        Write-Host ""
        
        # Verificar si Firebase CLI está instalado
        $firebaseInstalled = Get-Command firebase -ErrorAction SilentlyContinue
        
        if ($firebaseInstalled) {
            Write-Host "✅ Firebase CLI detectado" -ForegroundColor Green
            Write-Host "   Iniciando login..." -ForegroundColor Gray
            Write-Host ""
            firebase login
            
            Write-Host ""
            Write-Host "⚠️  Nota: Para scripts, aún necesitas el service-account.json" -ForegroundColor Yellow
            Write-Host "   Firebase CLI es principalmente para desarrollo local" -ForegroundColor Gray
            
        } else {
            Write-Host "❌ Firebase CLI no está instalado" -ForegroundColor Red
            Write-Host ""
            Write-Host "Instálalo con:" -ForegroundColor Cyan
            Write-Host "   npm install -g firebase-tools" -ForegroundColor White
            Write-Host ""
        }
    }
    
    "4" {
        Write-Host ""
        Write-Host "❌ Configuración cancelada" -ForegroundColor Yellow
        exit 0
    }
    
    default {
        Write-Host ""
        Write-Host "❌ Opción inválida" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
