# Organizar Markdown por fecha

Este pequeño helper organiza todos los archivos `.md` del repositorio en carpetas por fecha de última modificación.

Ubicación del script:

- `scripts/organize-markdown-by-date.ps1`

Cómo usar:

1. Abrir PowerShell y situarse en la carpeta `scripts` del repo:

```powershell
cd "I:\Documentos\DESARROLLO\APLICACIONES EMPRESARIALES\DataWeave-BI\scripts"
```

2. Ejecutar en modo simulación (no moverá archivos):

```powershell
.\organize-markdown-by-date.ps1 -WhatIf
```

3. Si el resultado es correcto, ejecutar para mover los archivos:

```powershell
.\organize-markdown-by-date.ps1
```

Notas:

- Los archivos se moverán a `changelogs\YYYY-MM-DD\<archivo>.md` basándose en la fecha de última modificación.
- Si hay archivos con el mismo nombre y fecha, el script sobrescribirá el destino.
- Haz un backup o usa control de versiones para recuperar en caso necesario.

Comportamiento adicional

- El script excluye por defecto algunos archivos y carpetas para evitar mover documentación crítica o el propio script:
	- `README.md` (en la raíz), `docs\*`, `scripts\*`, `changelogs\*`.
- Se añade FrontMatter YAML con la fecha (`Date: YYYY-MM-DD`) al inicio de cada archivo movido si no tiene ya un bloque `---`.
- Se genera un índice en `changelogs/INDEX.md` con enlaces a los archivos organizados por fecha.

Si quieres excluir más archivos o desactivar la adición de FrontMatter, edita las variables `$excludePatterns` y `$addFrontMatter` dentro del script.
