# DataWeave-BI

Repositorio: DataWeave BI — integración Zadarma (webhook + backfill) y visualización de métricas.

Este README documenta la arquitectura, endpoints, scripts y procedimientos para desplegar, probar y poblar datos relacionados con la integración de Zadarma.

## Contenido rápido
- `src/app/api/zadarma/webhook/route.ts` - Webhook para recibir eventos `NOTIFY_END` y `NOTIFY_MISSED` (GET para verificación `zd_echo`, POST para eventos).
- `src/app/api/zadarma/backfill/route.ts` - Endpoint para ejecutar backfill desde producción: `/api/zadarma/backfill?days=N`.
- `src/app/api/zadarma/stats/route.ts` - Lectura de métricas desde Firestore (requiere `startDate` y `endDate`).
- `src/lib/zadarma-helpers.ts` - Helpers: `fetchZadarmaAdaptive`, `saveZadarmaCalls`, `getZadarmaCallsFromFirestore`, locks y metadata.
- `scripts/zadarma-backfill.ts` - Script local para backfill (divide por horas y respeta rate limit).
- `scripts/test-webhook-manual.ts` - Enviar eventos de prueba al webhook.

## Resumen de la arquitectura

1. Webhook (tiempo real)
	 - Zadarma envía `NOTIFY_END` y `NOTIFY_MISSED` al endpoint `GET/POST /api/zadarma/webhook`.
	 - `GET` sirve para verificación (`?zd_echo=...`) y responde texto plano.
	 - `POST` responde inmediatamente `200 OK` y procesa el payload en background. Guarda en Firestore en la colección `zadarma_calls` usando `set(..., { merge: true })` para idempotencia.

2. Backfill (histórico y rectificación)
	 - `scripts/zadarma-backfill.ts` permite ejecutar cargas históricas locales respetando rate limits (pausa 21s entre llamadas).
	 - En producción hay un endpoint `GET /api/zadarma/backfill?days=N` que usa `fetchZadarmaAdaptive` y `saveZadarmaCalls` para obtener y guardar llamadas.

3. Stats (UI)
	 - `GET /api/zadarma/stats?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD` lee desde Firestore los documentos en `zadarma_calls` y devuelve metadata y lista de llamadas.

## Variables de entorno necesarias
- `ZADARMA_API_KEY` (prod/backfill)
- `ZADARMA_API_SECRET` (prod/backfill)
- `SERVICE_ACCOUNT` (Firebase Admin JSON string, para despliegues que usen firebase-admin)

Colocar estas variables en Vercel (o `.env.local` para desarrollo local). Si `SERVICE_ACCOUNT` no está presente, `src/lib/firebase-admin.ts` no inicializará admin y las funciones que dependen de Firestore fallarán en runtime.

## Uso rápido

1) Probar webhook localmente

Inicia la app en modo desarrollo:

```powershell
npm run dev
```

Enviar un evento de prueba (ejemplo curl):

```powershell
curl -X POST "http://localhost:9002/api/zadarma/webhook" \
	-H "Content-Type: application/json" \
	-d '{"event":"NOTIFY_END","pbx_call_id":"test123","call_start":"2025-10-30 10:00:00","duration":"120","disposition":"answered","caller_id":"+51999999999","called_did":"+51888888888","sip":"101"}'
```

2) Ejecutar backfill localmente (muestra pequeña)

```powershell
npx tsx scripts/zadarma-backfill.ts --from="2025-10-29" --to="2025-10-29" --timezone="America/Lima"
```

3) Ejecutar backfill en producción desde el navegador (después de deploy)

Abrir consola del navegador y ejecutar:

```javascript
fetch('https://dataweave-bi.vercel.app/api/zadarma/backfill?days=7')
	.then(r => r.json())
	.then(console.log)
	.catch(console.error);
```

Respuesta esperada (JSON):

```json
{
	"status": "success",
	"message": "Backfill completado: X llamadas guardadas",
	"data": {
		"days": 7,
		"range": { "start": "yyyy-mm-dd", "end": "yyyy-mm-dd" },
		"callsProcessed": 142,
		"callsSaved": 142
	}
}
```

Si la respuesta tiene `status: 'error'` o es 500, revisar logs de Vercel y compartir el stack para diagnóstico.

## Scripts disponibles (package.json)
- `npm run dev` — iniciar la app en dev (Next.js)
- `npm run build` — build
- `npm run typecheck` — tsc --noEmit
- `npm run zadarma:backfill` — `tsx scripts/zadarma-backfill.ts` (local)
- `npm run zadarma:backfill:test` — backfill de prueba (1 día)
- `npm run zadarma:backfill:daily` — backfill de 1 día (últimas 24h)
- `npm run test:webhook` — ejecuta `scripts/test-webhook-manual.ts`
- `npm run fill:testdata` — llena Firestore con datos de prueba

## Troubleshooting rápido
- Si `500` en `/api/zadarma/backfill`: comprobar que `ZADARMA_API_KEY` y `ZADARMA_API_SECRET` están en Vercel.
- Si Firestore no se inicializa: verificar `SERVICE_ACCOUNT` o que el Admin SDK esté correctamente configurado.
- Si la UI de Performance no muestra datos: usar `GET /api/zadarma/stats?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD` para comprobar si Firestore tiene datos.

## Qué hice y por qué (histórico de cambios relevantes)
- Separé GET/POST en el webhook para cumplir con la verificación `zd_echo` de Zadarma.
- Reescribí el endpoint de backfill para reutilizar `fetchZadarmaAdaptive` y `saveZadarmaCalls`, evitando la firma manual que provocaba fallos.
- Dejé `/api/zadarma/stats` como solo lectura desde Firestore para que la UI solo consulte la caché poblada por webhook + backfill.
- Añadí scripts de testing y documentación en `docs/` para procedimientos de despliegue y backfill.

## Próximos pasos sugeridos
1. Verificar despliegue en Vercel y ejecutar backfill (7 días) desde el navegador.
2. Si falla, obtener logs de la función y pasarlos aquí.
3. Confirmar que Firestore contiene `zadarma_calls` con `last_updated_by: 'backfill'`.
4. Crear README con ejemplos de queries y alertas (opcional — ya en progreso).

---

Si quieres, puedo ahora mismo completar/expandir este README con secciones más detalladas (ejemplos de queries, formato exacto de documentos en `zadarma_calls`, comandos para extracción masiva de logs, y un apartado de preguntas frecuentes).¿Lo hago ahora y lo guardo en el repo en español completo? 

