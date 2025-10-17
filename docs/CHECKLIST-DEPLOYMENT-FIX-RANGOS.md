# ✅ CHECKLIST DE DEPLOYMENT - Fix Suma Rangos de Fechas

**Versión**: 2.1.0  
**Fecha**: 17 de Enero, 2025  
**Prioridad**: CRÍTICA

---

## 📋 Pre-Deployment

- [ ] ✅ Código modificado y sin errores TypeScript
  - `src/app/(app)/dashboard/performance/page.tsx`
  - `src/lib/zadarma-helpers.ts`

- [ ] ✅ Documentación creada
  - `docs/FIX-SUMA-RANGOS-FECHAS-2025-01-17.md`
  - `scripts/resync-zadarma-historical.ps1`

- [ ] ✅ Tests locales (opcional pero recomendado)
  ```bash
  npm run dev
  # Verificar que la app compile sin errores
  ```

---

## 🚀 Deployment

### Paso 1: Commit y Push

```powershell
# En PowerShell, dentro del proyecto
cd "I:\Documentos\DESARROLLO\APLICACIONES EMPRESARIALES\DataWeave-BI"

# Ver cambios
git status

# Agregar cambios
git add .

# Commit
git commit -m "fix: Corregir suma de llamadas en rangos de fechas múltiples

- Agrupa llamadas por pbx_call_id + fecha
- Incluye fecha en docId de Firestore
- Corrige tipos TypeScript"

# Push
git push origin REUT_1
```

- [ ] Commit realizado
- [ ] Push exitoso

---

### Paso 2: Verificar Deployment en Vercel

1. Ve a: https://vercel.com/dashboard
2. Busca tu proyecto: DataWeave-BI
3. Espera a que el deployment termine
4. Verifica status: **Ready** ✅

- [ ] Deployment completado
- [ ] Sin errores en build
- [ ] Status: Ready

---

### Paso 3: Re-sincronizar Datos Históricos

**IMPORTANTE**: Este paso es CRÍTICO para ver los cambios.

#### Opción A: Script Automático (Recomendado)

```powershell
# Ejecutar el script
.\scripts\resync-zadarma-historical.ps1

# Seleccionar opción 1: "Re-sincronizar semana específica (oct 06-12, 2025)"
# Ingresar tu dominio cuando se solicite
```

- [ ] Script ejecutado
- [ ] Semana oct 06-12 re-sincronizada
- [ ] Sin errores en la sincronización

#### Opción B: Manual (Alternativa)

```powershell
$domain = "TU_DOMINIO.vercel.app"  # REEMPLAZAR

# Sincronizar cada día
$fechas = @("2025-10-06", "2025-10-07", "2025-10-08", "2025-10-09", "2025-10-10", "2025-10-11", "2025-10-12")

foreach ($fecha in $fechas) {
    $body = @{ startDate = "${fecha}T00:00:00Z"; endDate = "${fecha}T23:59:59Z"; forceSync = $true } | ConvertTo-Json
    Invoke-RestMethod -Uri "https://$domain/api/zadarma/sync" -Method Post -Body $body -ContentType "application/json"
    Start-Sleep -Seconds 2
}
```

- [ ] Sincronización manual completada

---

### Paso 4: Verificación en la Aplicación

1. Abre: `https://TU_DOMINIO.vercel.app`
2. Login con tu usuario
3. Ve a: **Dashboard → Rendimiento de Asesor**
4. Selecciona rango: **oct 06, 2025 - oct 12, 2025**

**Verificar**:

- [ ] Marisol (105): Muestra **700-900** intentos (antes: 132)
- [ ] Wendy (108): Muestra **700-900** intentos (antes: 97)
- [ ] Alanis (104): Muestra **700-900** intentos (antes: 85)
- [ ] Indicador muestra: 🟢 "Datos desde Firestore (caché histórico)"

---

### Paso 5: Tests de Regresión

#### Test 1: Consulta de Un Solo Día
- [ ] Seleccionar: oct 06, 2025 - oct 06, 2025
- [ ] Verificar: 100-160 llamadas por asesora
- [ ] Sin errores en consola

#### Test 2: Consulta de Mes Completo
- [ ] Seleccionar: oct 01, 2025 - oct 31, 2025
- [ ] Verificar: 3,000-5,000 llamadas por asesora
- [ ] Sin errores en consola

#### Test 3: Consulta de Hoy
- [ ] Seleccionar: Fecha de hoy
- [ ] Verificar: Datos actualizados
- [ ] Indicador muestra: 🔵 "Datos desde API de Zadarma (hoy)"

---

## 📊 Validación Final

### Métricas Esperadas (Semana oct 06-12)

| Asesora | Antes (Bug) | Después (Fix) | Status |
|---------|-------------|---------------|--------|
| Marisol (105) | 132 | 700-900 | [ ] ✅ |
| Wendy (108) | 97 | 700-900 | [ ] ✅ |
| Alanis (104) | 85 | 700-900 | [ ] ✅ |
| Avril (110) | 79 | 700-900 | [ ] ✅ |

### Indicadores de Calidad

- [ ] Números reflejan realidad operativa
- [ ] Primera llamada muestra hora correcta
- [ ] Última llamada muestra hora correcta
- [ ] Efectividad % es consistente
- [ ] Duración promedio es razonable

---

## 🔄 Post-Deployment

### Monitoreo (Primeras 24 horas)

- [ ] Revisar logs en Vercel (Functions → Logs)
- [ ] Verificar que no hay errores 500
- [ ] Confirmar que las consultas son rápidas (<1s para caché)

### Comunicación

- [ ] Notificar a managers que los números están corregidos
- [ ] Explicar que datos anteriores fueron re-sincronizados
- [ ] Indicar que rangos semanales/mensuales ahora son precisos

---

## 🆘 Rollback (Si es Necesario)

Si encuentras problemas críticos:

```powershell
# Revertir último commit
git revert HEAD

# Push del revert
git push origin REUT_1
```

- [ ] Rollback ejecutado (solo si es necesario)
- [ ] Razón del rollback documentada

---

## 📝 Notas Adicionales

### Datos Antiguos en Firestore

Los datos sincronizados con el formato antiguo (`docId` sin fecha) permanecerán en Firestore pero serán ignorados porque el nuevo formato tiene IDs diferentes. No es necesario limpiarlos.

### Sincronización Diaria Automática

El cron job configurado anteriormente (`/api/cron/zadarma-daily-sync`) **ya usa el nuevo formato** automáticamente. No requiere cambios.

### Performance

No se espera degradación de performance. El sistema puede tener más documentos en Firestore, pero la indexación por fecha lo compensa.

---

## ✅ Sign-Off

- [ ] Todos los checks completados
- [ ] Aplicación verificada en producción
- [ ] Usuarios notificados
- [ ] Documentación actualizada

**Fecha de Deployment**: _______________  
**Realizado por**: _______________  
**Verificado por**: _______________

---

## 📚 Referencias

- Documentación del fix: `docs/FIX-SUMA-RANGOS-FECHAS-2025-01-17.md`
- Script de re-sincronización: `scripts/resync-zadarma-historical.ps1`
- Sistema de caché: `docs/ZADARMA-AUTO-CACHING.md`

---

**¿Listo para deployment?** 🚀

Si todos los checks pre-deployment están marcados, puedes proceder con el Paso 1.
