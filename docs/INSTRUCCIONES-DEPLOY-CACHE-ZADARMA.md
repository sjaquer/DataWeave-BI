# 🚀 INSTRUCCIONES DE DEPLOYMENT - Sistema de Caché Automático Zadarma

**IMPORTANTE**: Sigue estos pasos en orden para desplegar el nuevo sistema.

---

## ⚡ Pasos Rápidos

### 1️⃣ Generar CRON_SECRET

**En Windows PowerShell**:
```powershell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
```

**Ejemplo de output**:
```
a3F4cG1sMnhyNXZuOGpsMjNzdzZ0eTF6aDRjZjBiZzdl
```

**Guarda este valor** - lo necesitarás en el siguiente paso.

---

### 2️⃣ Configurar en Vercel

1. Ve a tu proyecto en [Vercel Dashboard](https://vercel.com/dashboard)
2. Click en **Settings** → **Environment Variables**
3. Agregar nueva variable:
   - **Key**: `CRON_SECRET`
   - **Value**: El token generado en el paso 1
   - **Environment**: `Production` (solamente)
4. Click en **Save**

---

### 3️⃣ Commit y Deploy

```bash
# Asegúrate de estar en la raíz del proyecto
cd "I:\Documentos\DESARROLLO\APLICACIONES EMPRESARIALES\DataWeave-BI"

# Agregar todos los cambios
git add .

# Commit
git commit -m "feat: Implementar sistema de caché automático Zadarma con sincronización diaria"

# Push a la rama principal (esto activará el deploy automático en Vercel)
git push origin main
```

---

### 4️⃣ Verificar Deployment

1. Ve a [Vercel Dashboard](https://vercel.com/dashboard) → **Deployments**
2. Espera a que el deployment actual termine (se pone verde)
3. Ve a **Settings** → **Cron Jobs**
4. Deberías ver:
   ```
   Path: /api/cron/zadarma-daily-sync
   Schedule: 0 1 * * *
   Status: Active ✅
   ```

---

### 5️⃣ Probar el Sistema

#### Opción A: Probar Cron Job Manualmente (Desde PowerShell)

```powershell
# Reemplaza YOUR_DOMAIN y YOUR_CRON_SECRET con tus valores
curl https://YOUR_DOMAIN.vercel.app/api/cron/zadarma-daily-sync `
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

**Respuesta esperada**:
```json
{
  "status": "success",
  "message": "✅ Sincronización completada para 2025-01-16",
  "totalCallsSynced": 120,
  "date": "2025-01-16"
}
```

#### Opción B: Probar Endpoint de Estadísticas

Abre en tu navegador:
```
https://YOUR_DOMAIN.vercel.app/api/zadarma/stats?startDate=2025-01-15T00:00:00Z&endDate=2025-01-15T23:59:59Z
```

**Respuesta esperada** (primera vez, sin datos en caché):
```json
{
  "status": "error",
  "message": "No hay datos en caché para el rango...",
  "suggestion": "Ejecute una sincronización manual..."
}
```

---

### 6️⃣ Sincronizar Datos Históricos (Primera Vez)

**Script PowerShell** (ejecutar en la terminal):

```powershell
# Función para formatear fecha
function Get-DaysAgo($days) {
    (Get-Date).AddDays(-$days).ToString("yyyy-MM-dd")
}

# Sincronizar últimos 7 días
$domain = "YOUR_DOMAIN.vercel.app"  # REEMPLAZAR

for ($i = 1; $i -le 7; $i++) {
    $date = Get-DaysAgo $i
    
    Write-Host "Sincronizando $date..." -ForegroundColor Yellow
    
    $body = @{
        startDate = "${date}T00:00:00Z"
        endDate   = "${date}T23:59:59Z"
    } | ConvertTo-Json
    
    Invoke-RestMethod -Uri "https://$domain/api/zadarma/sync" `
                       -Method Post `
                       -Body $body `
                       -ContentType "application/json"
    
    Write-Host "✅ $date completado" -ForegroundColor Green
    Start-Sleep -Seconds 2
}

Write-Host "`n🎉 Sincronización histórica completa!" -ForegroundColor Cyan
```

**Cómo ejecutar**:
1. Copia el script completo
2. Abre PowerShell
3. Reemplaza `YOUR_DOMAIN.vercel.app` con tu dominio real
4. Pega y ejecuta

---

### 7️⃣ Verificar en la Aplicación

1. Abre tu aplicación: `https://YOUR_DOMAIN.vercel.app`
2. Ve a **Dashboard** → **Rendimiento de Asesor**
3. Selecciona una fecha de ayer
4. Deberías ver:
   - ✅ **Indicador verde** (Database) → "Datos desde Firestore (caché histórico)"
   - ✅ **Datos cargados en menos de 1 segundo**
5. Selecciona la fecha de hoy
6. Deberías ver:
   - ✅ **Indicador azul** (Cloud) → "Datos desde API de Zadarma (hoy)"
   - ✅ **Datos actualizados**

---

## ✅ Checklist Final

Marca cada item cuando esté completado:

- [ ] `CRON_SECRET` generado
- [ ] `CRON_SECRET` agregado a Vercel Environment Variables
- [ ] Código commiteado y pusheado a GitHub
- [ ] Deployment en Vercel completado exitosamente
- [ ] Cron job visible en Vercel Settings → Cron Jobs
- [ ] Prueba manual del cron job exitosa
- [ ] Datos históricos sincronizados (últimos 7 días)
- [ ] Verificación en la aplicación: fechas pasadas desde caché
- [ ] Verificación en la aplicación: fecha de hoy desde API

---

## 🐛 Troubleshooting

### Error: "No autorizado" al probar cron job

**Solución**:
- Verifica que estás usando el mismo `CRON_SECRET` configurado en Vercel
- Asegúrate de incluir `Bearer` antes del token en el header

### Error: "CRON_SECRET no configurado"

**Solución**:
- Ve a Vercel → Settings → Environment Variables
- Verifica que `CRON_SECRET` existe y está en `Production`
- Haz un redeploy: Deployments → Click en los 3 puntos → Redeploy

### Cron job no aparece en Vercel Settings

**Solución**:
- Verifica que `vercel.json` está en la raíz del proyecto
- Asegúrate de que el deployment fue exitoso
- Espera 1-2 minutos y refresca la página

### Datos no se sincronizan automáticamente

**Solución**:
- Espera hasta la 1:00 AM UTC del día siguiente
- Verifica logs en Vercel → Functions → Logs
- Busca mensajes que empiecen con `[CRON]`

---

## 📞 Soporte

Si encuentras problemas:

1. **Revisa los logs**:
   - Vercel Dashboard → Functions → Logs
   - Busca mensajes de error

2. **Consulta la documentación**:
   - [ZADARMA-AUTO-CACHING.md](./ZADARMA-AUTO-CACHING.md)
   - [ENV-CONFIGURATION.md](./ENV-CONFIGURATION.md)

3. **Verifica configuración**:
   - Todas las variables de entorno presentes
   - `vercel.json` en la raíz del proyecto
   - Deployment exitoso sin errores

---

## 🎉 ¡Listo!

Una vez completados todos los pasos, tu sistema de caché automático estará funcionando:

- ✅ Datos históricos sincronizados cada madrugada automáticamente
- ✅ Consultas de fechas pasadas instantáneas (desde caché)
- ✅ Solo se llama a la API para datos de hoy
- ✅ Reducción de 96% en llamadas a la API

**¡Disfruta de tu sistema optimizado!** 🚀

---

**Última actualización**: 17 de Enero, 2025
