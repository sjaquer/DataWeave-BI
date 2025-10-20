/**
 * Tipos de datos para la integración con Zadarma
 */

export interface ZadarmaCall {
  pbx_call_id: string;
  callstart: string;
  sip: string;
  clid: string;
  destination: string | number;
  disposition: "answered" | "busy" | "cancel" | "no answer" | "failed" | "congestion";
  seconds: number;
}

export interface ZadarmaCallDocument extends ZadarmaCall {
  // Campos adicionales para Firestore
  id: string; // pbx_call_id
  callDate: string; // YYYY-MM-DD para indexación
  agentId: string; // sip (ID del agente)
  agentName?: string; // Nombre del agente
  isConsolidated: boolean; // Si es la llamada consolidada del grupo
  syncedAt: string; // Timestamp de sincronización
  createdAt: any; // Firestore Timestamp
  updatedAt: any; // Firestore Timestamp
}

export interface ZadarmaSyncMetadata {
  lastSyncDate: string; // YYYY-MM-DD
  lastSyncTimestamp: any; // Firestore Timestamp
  totalCallsSynced: number;
  dateRange: {
    start: string;
    end: string;
  };
  status: 'success' | 'error' | 'partial';
  errorMessage?: string;
}

export interface AdvisorPerformance {
  id: string; // agentId
  name: string;
  totalCalls: number;
  effectiveCalls: number;
  effectivenessRate: number;
  totalSeconds: number;
  averageCallDuration: number;
  firstCallTime: string | null;
  lastCallTime: string | null;
}

export interface ZadarmaStatsQuery {
  startDate?: string;
  endDate?: string;
  forceRefresh?: boolean; // Forzar llamada a API en lugar de Firestore
}

export interface ZadarmaStatsResponse {
  status: 'success' | 'error';
  message?: string;
  stats: ZadarmaCall[];
  fromCache: boolean;
  lastSync?: string;
  totalCalls?: number;
}

// Mapeo de agentes
export const AGENT_MAP: { [key: string]: string } = {
  "101": "Aylen",
  "104": "Alanis",
  "105": "Marisol",
  "107": "Lisset",
  "108": "Wendy",
  "110": "Avril",
  "111": "Luz",
  "113": "Fiorela",
  "114": "Eduardo",
  "115": "Daiana",
};
