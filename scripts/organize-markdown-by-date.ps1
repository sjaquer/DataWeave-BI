<#
.SYNOPSIS
  Organiza archivos Markdown del repo en carpetas por fecha (YYYY-MM-DD).

.DESCRIPTION
  Este script busca recursivamente todos los archivos .md en la carpeta del repo
  y los mueve a `changelogs\YYYY-MM-DD\<filename>.md` donde la fecha se obtiene
  de la propiedad LastWriteTime del archivo (fecha de última modificación).

.PARAMETER WhatIf
  Si se pasa -WhatIf se realizará un "dry-run" (no moverá los archivos, solo mostrará lo que haría).

.EXAMPLE
  # Simulación (no hace cambios)
  .\organize-markdown-by-date.ps1 -WhatIf

  # Ejecutar y mover archivos
  .\organize-markdown-by-date.ps1

.NOTES
  - Asegúrate de ejecutar con permisos adecuados y de tener copia de seguridad si lo requieres.
  - El script moverá archivos .md independientemente de su carpeta original. Si existen
    archivos con el mismo nombre en la misma fecha, se sobrescribirán (opción -Force).
#>

param(
    [switch]$WhatIf
)

$root = Split-Path -Parent $MyInvocation.MyCommand.Definition
if (-not $root) {
    $root = Get-Location
}
# Normalize path: si el script se ejecuta desde otra ruta, usar el directorio del repositorio
$repoRoot = Resolve-Path "$root\.." | Select-Object -ExpandProperty Path
# Si prefieres forzar un repo root fijo, descomenta y ajusta la siguiente línea:
# $repoRoot = 'I:\Documentos\DESARROLLO\APLICACIONES EMPRESARIALES\DataWeave-BI'

$targetRoot = Join-Path $repoRoot 'changelogs'

Write-Output "Repo root: $repoRoot"
Write-Output "Target root: $targetRoot"

$mdFiles = Get-ChildItem -Path $repoRoot -Recurse -Filter *.md | Where-Object { -not $_.PSIsContainer }

# Patrónes a excluir (relativos al repo root). Ajusta si quieres incluir/excluir otros archivos.
$excludePatterns = @(
    'README.md',
    'README.MD',
    'docs\*',
    'scripts\*',
    'changelogs\*'
)

# Flag: agregar FrontMatter YAML con la fecha a los archivos movidos
$addFrontMatter = $true
if ($mdFiles.Count -eq 0) {
    Write-Output "No se encontraron archivos .md en $repoRoot"
    exit 0
}

foreach ($file in $mdFiles) {
    # Omitir la carpeta de destino si ya existe dentro del repo (evitar loops)
    if ($file.FullName -like "*\\changelogs\\*") {
        Write-Output "Omitiendo (ya en changelogs): $($file.FullName)"
        continue
    }

    # Comprobar exclusiones por patrón (ruta relativa desde repoRoot)
    $relativePath = $file.FullName.Substring($repoRoot.Length).TrimStart('\','/')
    $skip = $false
    foreach ($pattern in $excludePatterns) {
        if ($relativePath -like $pattern) {
            Write-Output "Omitiendo por exclusión ($pattern): $relativePath"
            $skip = $true
            break
        }
    }
    if ($skip) { continue }

    $date = $file.LastWriteTime.ToString('yyyy-MM-dd')
    $destDir = Join-Path $targetRoot $date
    $destPath = Join-Path $destDir $file.Name

    if ($WhatIf) {
        Write-Output "[DRY-RUN] Mover: $($file.FullName) -> $destPath"
    } else {
        if (-not (Test-Path $destDir)) {
            New-Item -ItemType Directory -Path $destDir -Force | Out-Null
        }
        try {
            Move-Item -Path $file.FullName -Destination $destPath -Force
            Write-Output "Movido: $($file.FullName) -> $destPath"

            if ($addFrontMatter) {
                try {
                    $content = Get-Content -Path $destPath -Raw -ErrorAction Stop
                    if (-not $content.TrimStart().StartsWith('---')) {
                        $fm = "---`nDate: $date`n---`n`n"
                        $newContent = $fm + $content
                        Set-Content -Path $destPath -Value $newContent -Encoding UTF8 -Force
                        Write-Output "FrontMatter añadido a: $destPath"
                    } else {
                        Write-Output "FrontMatter ya presente, se omitió: $destPath"
                    }
                } catch {
                    Write-Output ("WARN: no se pudo añadir FrontMatter a {0}: {1}" -f $destPath, $_)
                }
            }

        } catch {
            Write-Output ("ERROR al mover {0}: {1}" -f $($file.FullName), $_)
        }
    }
}

Write-Output "Organización completada."

# Generar índice changelogs/INDEX.md con enlaces por fecha
if (-not $WhatIf) {
    try {
        if (-not (Test-Path $targetRoot)) {
            New-Item -ItemType Directory -Path $targetRoot -Force | Out-Null
        }
        $indexLines = @()
        $indexLines += "# Changelogs por fecha`n"
        $dirs = Get-ChildItem -Path $targetRoot -Directory | Sort-Object Name -Descending
        foreach ($dir in $dirs) {
            $indexLines += "## $($dir.Name)`n"
            $files = Get-ChildItem -Path $dir.FullName -File | Sort-Object Name
            foreach ($f in $files) {
                # Ruta relativa desde repo root
                $rel = Join-Path (Split-Path -Leaf $dir.Name) $f.Name
                $relPath = "changelogs/$($dir.Name)/$($f.Name)"
                $indexLines += "- [$($f.Name)]($relPath)"
            }
            $indexLines += "`n"
        }
        $indexPath = Join-Path $targetRoot 'INDEX.md'
        $indexLines -join "`n" | Set-Content -Path $indexPath -Encoding UTF8 -Force
        Write-Output "Generado índice: $indexPath"
    } catch {
        Write-Output ("ERROR generando INDEX.md: {0}" -f $_)
    }
}