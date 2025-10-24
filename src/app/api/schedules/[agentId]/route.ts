import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';

const SCHEDULES_COLLECTION = 'user_schedules';

// Estructura de horario por defecto para un nuevo usuario
const defaultSchedule = {
  monday: { active: true, start: "09:00", end: "18:00" },
  tuesday: { active: true, start: "09:00", end: "18:00" },
  wednesday: { active: true, start: "09:00", end: "18:00" },
  thursday: { active: true, start: "09:00", end: "18:00" },
  friday: { active: true, start: "09:00", end: "18:00" },
  saturday: { active: false, start: "09:00", end: "13:00" },
  sunday: { active: false, start: "09:00", end: "13:00" },
};

/**
 * GET: Obtiene el horario para un asesor específico.
 * Si el asesor no tiene un horario configurado, devuelve uno por defecto.
 */
export async function GET(req: NextRequest, { params }: { params: { agentId: string } }) {
  try {
    const agentId = params.agentId;
    if (!agentId) {
      return NextResponse.json({ error: 'Agent ID es requerido' }, { status: 400 });
    }

    const docRef = db.collection(SCHEDULES_COLLECTION).doc(agentId);
    const docSnap = await docRef.get();

    if (docSnap.exists) {
      return NextResponse.json(docSnap.data());
    } else {
      // Devuelve un horario por defecto si no existe
      return NextResponse.json(defaultSchedule);
    }
  } catch (error) {
    console.error("Error al obtener horario:", error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

/**
 * POST: Crea o actualiza el horario para un asesor específico.
 */
export async function POST(req: NextRequest, { params }: { params: { agentId: string } }) {
  try {
    const agentId = params.agentId;
    if (!agentId) {
      return NextResponse.json({ error: 'Agent ID es requerido' }, { status: 400 });
    }

    const scheduleData = await req.json();
    
    // Aquí se podría añadir una validación más robusta del objeto scheduleData
    if (!scheduleData || typeof scheduleData !== 'object') {
        return NextResponse.json({ error: 'Datos de horario inválidos' }, { status: 400 });
    }

    const docRef = db.collection(SCHEDULES_COLLECTION).doc(agentId);
    await docRef.set(scheduleData, { merge: true });

    return NextResponse.json({ success: true, message: `Horario para ${agentId} actualizado.` });

  } catch (error) {
    console.error("Error al actualizar horario:", error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

