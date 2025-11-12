import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * HEALTH CHECK ENDPOINT
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * PROPÓSITO:
 * ==========
 * Endpoint simple para verificar que el servicio está funcionando correctamente.
 * Útil para monitoreo en Render, uptime checks, y debugging.
 * 
 * VERIFICA:
 * =========
 * - Servicio responde (HTTP 200)
 * - Firebase Admin SDK está inicializado
 * - Conexión a Firestore funciona
 * 
 * USO:
 * ====
 * GET /api/health
 * 
 * RESPUESTA OK:
 * =============
 * {
 *   "status": "ok",
 *   "timestamp": "2025-01-17T12:34:56.789Z",
 *   "service": "dataweave-bi",
 *   "database": "connected",
 *   "environment": "production"
 * }
 * 
 * RESPUESTA ERROR:
 * ================
 * {
 *   "status": "error",
 *   "message": "Firebase not initialized",
 *   "timestamp": "2025-01-17T12:34:56.789Z",
 *   "environment": "production"
 * }
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 */

export async function GET() {
  try {
    // Verificar que db esté inicializado
    if (!db || typeof db.collection !== 'function') {
      return NextResponse.json({
        status: 'error',
        message: 'Firebase Admin SDK no está inicializado',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'unknown'
      }, { status: 500 });
    }

    // Intentar una operación simple en Firestore
    await db.collection('_health_check').limit(1).get();
    
    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'dataweave-bi',
      database: 'connected',
      environment: process.env.NODE_ENV || 'unknown'
    }, { status: 200 });

  } catch (error: any) {
    console.error('[HEALTH-CHECK] Error:', error);
    
    return NextResponse.json({
      status: 'error',
      message: error.message || 'Unknown error',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'unknown'
    }, { status: 500 });
  }
}
