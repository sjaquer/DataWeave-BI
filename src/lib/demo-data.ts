import { format, subDays, addHours, addMinutes } from 'date-fns';

// Nombres ficticios para asesores de demo
export const demoAgentMap: Record<string, string> = {
  "201": "María García",
  "202": "Carlos López",
  "203": "Ana Martínez",
  "204": "Luis Rodríguez",
  "205": "Sofia Fernández",
  "206": "Diego Sánchez",
  "207": "Valentina Torres",
  "208": "Andrés Ramírez",
};

// Datos de horarios de demo
export const demoSchedules: Record<string, any> = {
  "201": {
    monday: { active: true, start: "09:00", end: "18:00" },
    tuesday: { active: true, start: "09:00", end: "18:00" },
    wednesday: { active: true, start: "09:00", end: "18:00" },
    thursday: { active: true, start: "09:00", end: "18:00" },
    friday: { active: true, start: "09:00", end: "18:00" },
    saturday: { active: false, start: "09:00", end: "13:00" },
    sunday: { active: false, start: "09:00", end: "13:00" },
  },
  "202": {
    monday: { active: true, start: "08:00", end: "17:00" },
    tuesday: { active: true, start: "08:00", end: "17:00" },
    wednesday: { active: true, start: "08:00", end: "17:00" },
    thursday: { active: true, start: "08:00", end: "17:00" },
    friday: { active: true, start: "08:00", end: "17:00" },
    saturday: { active: true, start: "09:00", end: "13:00" },
    sunday: { active: false, start: "09:00", end: "13:00" },
  },
  "203": {
    monday: { active: true, start: "10:00", end: "19:00" },
    tuesday: { active: true, start: "10:00", end: "19:00" },
    wednesday: { active: true, start: "10:00", end: "19:00" },
    thursday: { active: true, start: "10:00", end: "19:00" },
    friday: { active: true, start: "10:00", end: "19:00" },
    saturday: { active: false, start: "09:00", end: "13:00" },
    sunday: { active: false, start: "09:00", end: "13:00" },
  },
  "204": {
    monday: { active: true, start: "09:30", end: "18:30" },
    tuesday: { active: true, start: "09:30", end: "18:30" },
    wednesday: { active: true, start: "09:30", end: "18:30" },
    thursday: { active: true, start: "09:30", end: "18:30" },
    friday: { active: true, start: "09:30", end: "18:30" },
    saturday: { active: true, start: "10:00", end: "14:00" },
    sunday: { active: false, start: "09:00", end: "13:00" },
  },
  "205": {
    monday: { active: true, start: "08:30", end: "17:30" },
    tuesday: { active: true, start: "08:30", end: "17:30" },
    wednesday: { active: true, start: "08:30", end: "17:30" },
    thursday: { active: true, start: "08:30", end: "17:30" },
    friday: { active: true, start: "08:30", end: "17:30" },
    saturday: { active: false, start: "09:00", end: "13:00" },
    sunday: { active: false, start: "09:00", end: "13:00" },
  },
  "206": {
    monday: { active: true, start: "07:00", end: "16:00" },
    tuesday: { active: true, start: "07:00", end: "16:00" },
    wednesday: { active: true, start: "07:00", end: "16:00" },
    thursday: { active: true, start: "07:00", end: "16:00" },
    friday: { active: true, start: "07:00", end: "16:00" },
    saturday: { active: true, start: "08:00", end: "12:00" },
    sunday: { active: false, start: "09:00", end: "13:00" },
  },
  "207": {
    monday: { active: true, start: "11:00", end: "20:00" },
    tuesday: { active: true, start: "11:00", end: "20:00" },
    wednesday: { active: true, start: "11:00", end: "20:00" },
    thursday: { active: true, start: "11:00", end: "20:00" },
    friday: { active: true, start: "11:00", end: "20:00" },
    saturday: { active: false, start: "09:00", end: "13:00" },
    sunday: { active: false, start: "09:00", end: "13:00" },
  },
  "208": {
    monday: { active: true, start: "09:00", end: "18:00" },
    tuesday: { active: true, start: "09:00", end: "18:00" },
    wednesday: { active: true, start: "09:00", end: "18:00" },
    thursday: { active: true, start: "09:00", end: "18:00" },
    friday: { active: true, start: "09:00", end: "18:00" },
    saturday: { active: true, start: "09:00", end: "13:00" },
    sunday: { active: false, start: "09:00", end: "13:00" },
  },
};

// Generar datos de llamadas realistas para demo
export function generateDemoCalls(startDate: Date, endDate: Date): any[] {
  const calls: any[] = [];
  const agents = Object.keys(demoAgentMap);
  
  // Calcular días en el rango
  const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  
  for (let dayOffset = 0; dayOffset < daysDiff; dayOffset++) {
    const currentDate = new Date(startDate);
    currentDate.setDate(currentDate.getDate() + dayOffset);
    const dateStr = format(currentDate, 'yyyy-MM-dd');
    const dayOfWeek = currentDate.getDay();
    
    // No generar llamadas para domingos
    if (dayOfWeek === 0) continue;
    
    // Menos llamadas los sábados
    const callMultiplier = dayOfWeek === 6 ? 0.4 : 1;
    
    agents.forEach((agentId) => {
      const agentSchedule = demoSchedules[agentId];
      if (!agentSchedule) return;
      
      const dayName = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][dayOfWeek];
      const daySchedule = agentSchedule[dayName];
      
      // Si el agente no trabaja este día, saltar
      if (!daySchedule || !daySchedule.active) return;
      
      // Parsear horarios
      const [startHour, startMin] = daySchedule.start.split(':').map(Number);
      const [endHour, endMin] = daySchedule.end.split(':').map(Number);
      
      const workHours = (endHour * 60 + endMin - startHour * 60 - startMin) / 60;
      
      // Variación por agente (algunos tienen más llamadas que otros)
      const agentMultiplier = 0.8 + Math.random() * 0.4; // 0.8 - 1.2
      const baseCalls = Math.floor(workHours * 6 * callMultiplier * agentMultiplier); // ~6 llamadas por hora
      const numCalls = Math.max(1, baseCalls + Math.floor(Math.random() * 10) - 5); // ±5 llamadas de variación
      
      for (let i = 0; i < numCalls; i++) {
        // Distribuir llamadas a lo largo del día de trabajo
        const workMinutes = workHours * 60;
        const callOffsetMinutes = Math.floor(Math.random() * workMinutes);
        const callHour = startHour + Math.floor(callOffsetMinutes / 60);
        const callMinute = startMin + (callOffsetMinutes % 60);
        const callSecond = Math.floor(Math.random() * 60);
        
        // Ajustar si los minutos exceden 60
        const finalCallHour = callHour + Math.floor(callMinute / 60);
        const finalCallMinute = callMinute % 60;
        
        const callTime = `${String(finalCallHour).padStart(2, '0')}:${String(finalCallMinute).padStart(2, '0')}:${String(callSecond).padStart(2, '0')}`;
        
        // 70% de llamadas contestadas
        const isAnswered = Math.random() < 0.70;
        const disposition = isAnswered ? 'answered' : (Math.random() < 0.5 ? 'no answer' : 'busy');
        
        // Duración de llamada (0-300 segundos para contestadas, 0 para no contestadas)
        let seconds = 0;
        if (isAnswered) {
          // Distribución más realista de duraciones
          const rand = Math.random();
          if (rand < 0.2) {
            seconds = Math.floor(Math.random() * 30) + 5; // Llamadas cortas (5-35s)
          } else if (rand < 0.6) {
            seconds = Math.floor(Math.random() * 90) + 30; // Llamadas medias (30-120s)
          } else {
            seconds = Math.floor(Math.random() * 180) + 120; // Llamadas largas (120-300s)
          }
        }
        
        // Generar número de destino ficticio
        const destination = `9${Math.floor(10000000 + Math.random() * 89999999)}`;
        
        calls.push({
          pbx_call_id: `demo_${dateStr}_${agentId}_${String(i).padStart(3, '0')}`,
          callstart: `${dateStr} ${callTime}`,
          sip: agentId,
          destination,
          disposition,
          seconds,
          callDate: dateStr,
          callTime,
          callHour: finalCallHour,
          isOutbound: true,
          isAnswered,
          agentName: demoAgentMap[agentId],
          originalIndex: i,
        });
      }
    });
  }
  
  // Ordenar por fecha/hora
  calls.sort((a, b) => a.callstart.localeCompare(b.callstart));
  
  console.log(`[DEMO] Generadas ${calls.length} llamadas para el período ${format(startDate, 'yyyy-MM-dd')} - ${format(endDate, 'yyyy-MM-dd')}`);
  
  return calls;
}

// Datos de métricas de rendimiento precalculados para demo
export function generateDemoPerformanceData(startDate: Date, endDate: Date) {
  const calls = generateDemoCalls(startDate, endDate);
  
  // Procesar datos como lo hace la página real
  const performanceByAgent: Record<string, any> = {};
  const dailyPerformance: Record<string, Record<string, any>> = {};
  
  // Inicializar agentes
  Object.entries(demoAgentMap).forEach(([id, name]) => {
    const agentSchedule = demoSchedules[id];
    let scheduledHours = 9; // Por defecto 9 horas
    
    if (agentSchedule) {
      // Calcular horas promedio basadas en el horario
      const workDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
      let totalHours = 0;
      let activeDays = 0;
      
      workDays.forEach(day => {
        const daySchedule = agentSchedule[day];
        if (daySchedule && daySchedule.active) {
          const [startH, startM] = daySchedule.start.split(':').map(Number);
          const [endH, endM] = daySchedule.end.split(':').map(Number);
          const hours = (endH * 60 + endM - startH * 60 - startM) / 60;
          totalHours += hours;
          activeDays++;
        }
      });
      
      if (activeDays > 0) {
        scheduledHours = totalHours / activeDays;
      }
    }
    
    performanceByAgent[id] = {
      id,
      name,
      totalCalls: 0,
      effectiveCalls: 0,
      effectivenessRate: 0,
      totalSeconds: 0,
      averageCallDuration: 0,
      firstCallTime: null,
      lastCallTime: null,
      compliance: undefined,
      callTarget: undefined,
      scheduledHours: Math.round(scheduledHours * 10) / 10, // Redondear a 1 decimal
      actualHours: 0,
    };
    dailyPerformance[id] = {};
  });
  
  // Procesar llamadas
  calls.forEach((call) => {
    const agentId = call.sip;
    if (!performanceByAgent[agentId]) return;
    
    const isEffective = call.disposition === 'answered' && call.seconds > 0;
    const callDate = call.callDate;
    const callTime = call.callTime;
    
    performanceByAgent[agentId].totalCalls++;
    if (isEffective) performanceByAgent[agentId].effectiveCalls++;
    performanceByAgent[agentId].totalSeconds += call.seconds;
    
    if (!performanceByAgent[agentId].firstCallTime || callTime < performanceByAgent[agentId].firstCallTime) {
      performanceByAgent[agentId].firstCallTime = callTime;
    }
    if (!performanceByAgent[agentId].lastCallTime || callTime > performanceByAgent[agentId].lastCallTime) {
      performanceByAgent[agentId].lastCallTime = callTime;
    }
    
    // Datos diarios
    if (!dailyPerformance[agentId][callDate]) {
      dailyPerformance[agentId][callDate] = {
        totalCalls: 0,
        effectiveCalls: 0,
        effectivenessRate: 0,
        totalSeconds: 0,
        averageCallDuration: 0,
        firstCallTime: null,
        lastCallTime: null,
        scheduledHours: 9,
        actualHours: 0,
      };
    }
    
    const dayData = dailyPerformance[agentId][callDate];
    dayData.totalCalls++;
    if (isEffective) dayData.effectiveCalls++;
    dayData.totalSeconds += call.seconds;
    
    if (!dayData.firstCallTime || callTime < dayData.firstCallTime) {
      dayData.firstCallTime = callTime;
    }
    if (!dayData.lastCallTime || callTime > dayData.lastCallTime) {
      dayData.lastCallTime = callTime;
    }
  });
  
  // Calcular métricas finales
  Object.values(performanceByAgent).forEach((agent: any) => {
    agent.effectivenessRate = agent.totalCalls > 0 
      ? (agent.effectiveCalls / agent.totalCalls) * 100 
      : 0;
    agent.averageCallDuration = agent.effectiveCalls > 0 
      ? agent.totalSeconds / agent.effectiveCalls 
      : 0;
    
    // Calcular horas trabajadas
    if (agent.firstCallTime && agent.lastCallTime) {
      const [startH, startM] = agent.firstCallTime.split(':').map(Number);
      const [endH, endM] = agent.lastCallTime.split(':').map(Number);
      agent.actualHours = (endH * 60 + endM - startH * 60 - startM) / 60;
    }
    
    agent.compliance = agent.scheduledHours > 0 
      ? Math.min(100, (agent.actualHours / agent.scheduledHours) * 100)
      : 0;
    agent.callTarget = agent.scheduledHours * 12; // 12 calls per hour target
  });
  
  // Calcular métricas diarias
  Object.keys(dailyPerformance).forEach((agentId) => {
    Object.values(dailyPerformance[agentId]).forEach((dayData: any) => {
      dayData.effectivenessRate = dayData.totalCalls > 0 
        ? (dayData.effectiveCalls / dayData.totalCalls) * 100 
        : 0;
      dayData.averageCallDuration = dayData.effectiveCalls > 0 
        ? dayData.totalSeconds / dayData.effectiveCalls 
        : 0;
      
      if (dayData.firstCallTime && dayData.lastCallTime) {
        const [startH, startM] = dayData.firstCallTime.split(':').map(Number);
        const [endH, endM] = dayData.lastCallTime.split(':').map(Number);
        dayData.actualHours = (endH * 60 + endM - startH * 60 - startM) / 60;
      }
      
      dayData.compliance = dayData.scheduledHours > 0 
        ? Math.min(100, (dayData.actualHours / dayData.scheduledHours) * 100)
        : 0;
      dayData.callTarget = dayData.scheduledHours * 12;
    });
  });
  
  return {
    performance: Object.values(performanceByAgent),
    daily: dailyPerformance,
    calls,
  };
}

// Usuario demo
export const DEMO_CREDENTIALS = {
  email: 'admin@admin',
  password: 'admin',
};

export const DEMO_USER_PROFILE = {
  uid: 'demo-user-001',
  email: 'admin@admin',
  role: 'gerente' as const,
  displayName: 'Usuario Demo',
  createdAt: new Date(),
};

// Datos demo para envíos
export function generateDemoShipments(startDate: Date, endDate: Date) {
  const shipments = [];
  const statuses = ['pendiente', 'en-transito', 'entregado', 'devuelto'];
  const provinces = ['Lima', 'Arequipa', 'Cusco', 'Trujillo', 'Piura', 'Chiclayo', 'Huancayo', 'Ica'];
  const couriers = ['Courier A', 'Courier B', 'Courier Express', 'Delivery Pro'];
  
  const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  
  for (let dayOffset = 0; dayOffset < daysDiff; dayOffset++) {
    const currentDate = new Date(startDate);
    currentDate.setDate(currentDate.getDate() + dayOffset);
    const dateStr = format(currentDate, 'yyyy-MM-dd');
    
    const numShipments = 15 + Math.floor(Math.random() * 25); // 15-40 envíos por día
    
    for (let i = 0; i < numShipments; i++) {
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      const province = provinces[Math.floor(Math.random() * provinces.length)];
      const courier = couriers[Math.floor(Math.random() * couriers.length)];
      
      shipments.push({
        id: `DEMO-${dateStr}-${String(i).padStart(3, '0')}`,
        date: dateStr,
        status,
        province,
        courier,
        amount: 50 + Math.floor(Math.random() * 200), // S/50 - S/250
        weight: 0.5 + Math.random() * 3, // 0.5kg - 3.5kg
        customerName: `Cliente ${Math.floor(Math.random() * 1000)}`,
        trackingCode: `TRK${Math.floor(Math.random() * 1000000)}`,
      });
    }
  }
  
  return shipments;
}

// Datos demo para campañas de Meta
export function generateDemoMetaCampaigns() {
  return [
    {
      id: 'demo-campaign-1',
      name: 'Campaña Primavera 2026',
      status: 'active',
      budget: 5000,
      spent: 3245.50,
      impressions: 125000,
      clicks: 2450,
      conversions: 48,
      ctr: 1.96,
      cpc: 1.32,
      roas: 4.8,
      startDate: '2026-01-01',
      endDate: '2026-02-28',
    },
    {
      id: 'demo-campaign-2',
      name: 'Oferta Especial Enero',
      status: 'completed',
      budget: 2500,
      spent: 2500,
      impressions: 85000,
      clicks: 1680,
      conversions: 35,
      ctr: 1.98,
      cpc: 1.49,
      roas: 5.2,
      startDate: '2026-01-15',
      endDate: '2026-01-30',
    },
    {
      id: 'demo-campaign-3',
      name: 'Retargeting Q1',
      status: 'active',
      budget: 1500,
      spent: 892.75,
      impressions: 45000,
      clicks: 890,
      conversions: 22,
      ctr: 1.98,
      cpc: 1.00,
      roas: 6.1,
      startDate: '2026-01-20',
      endDate: '2026-03-31',
    }
  ];
}

// Datos demo para provincias
export function generateDemoProvinces() {
  return [
    { name: 'Lima', sales: 1250, orders: 445, avgOrder: 280.90 },
    { name: 'Arequipa', sales: 680, orders: 234, avgOrder: 290.60 },
    { name: 'Cusco', sales: 520, orders: 189, avgOrder: 275.13 },
    { name: 'Trujillo', sales: 490, orders: 176, avgOrder: 278.41 },
    { name: 'Piura', sales: 380, orders: 142, avgOrder: 267.61 },
    { name: 'Chiclayo', sales: 340, orders: 128, avgOrder: 265.63 },
    { name: 'Huancayo', sales: 290, orders: 108, avgOrder: 268.52 },
    { name: 'Ica', sales: 270, orders: 98, avgOrder: 275.51 },
    { name: 'Tacna', sales: 210, orders: 78, avgOrder: 269.23 },
    { name: 'Puno', sales: 180, orders: 67, avgOrder: 268.66 },
  ];
}

// Datos demo para inventario
export function generateDemoInventory() {
  const products = [
    'Producto Premium A',
    'Producto Básico B',
    'Kit Completo C',
    'Edición Especial D',
    'Pack Familiar E',
    'Versión Compacta F',
    'Serie Profesional G',
    'Modelo Estándar H',
    'Línea Económica I',
    'Colección Premium J'
  ];
  
  return products.map((product, index) => ({
    id: `PROD-${String(index + 1).padStart(3, '0')}`,
    name: product,
    sku: `SKU${String(index + 1).padStart(4, '0')}`,
    stock: Math.floor(Math.random() * 500) + 50,
    reserved: Math.floor(Math.random() * 100),
    sold: Math.floor(Math.random() * 200) + 50,
    price: 45 + Math.floor(Math.random() * 200),
    status: Math.random() > 0.8 ? 'low-stock' : 'available',
    lastUpdate: format(subDays(new Date(), Math.floor(Math.random() * 30)), 'yyyy-MM-dd'),
  }));
}

// Datos demo para análisis diario
export function generateDemoDaily(startDate: Date, endDate: Date) {
  const daily = [];
  const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  
  for (let dayOffset = 0; dayOffset < daysDiff; dayOffset++) {
    const currentDate = new Date(startDate);
    currentDate.setDate(currentDate.getDate() + dayOffset);
    const dateStr = format(currentDate, 'yyyy-MM-dd');
    const dayOfWeek = currentDate.getDay();
    
    // Menos ventas los domingos
    const dayMultiplier = dayOfWeek === 0 ? 0.3 : dayOfWeek === 6 ? 0.7 : 1;
    
    const sales = Math.floor((800 + Math.random() * 400) * dayMultiplier);
    const orders = Math.floor((25 + Math.random() * 15) * dayMultiplier);
    const visitors = Math.floor((1200 + Math.random() * 800) * dayMultiplier);
    
    daily.push({
      date: dateStr,
      sales,
      orders,
      visitors,
      avgOrder: orders > 0 ? sales / orders : 0,
      conversionRate: visitors > 0 ? (orders / visitors) * 100 : 0,
      dayOfWeek: ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][dayOfWeek]
    });
  }
  
  return daily;
}

// Datos demo para análisis mensual (returns)
export function generateDemoMonthlyReturns() {
  const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio'];
  
  return months.map((month, index) => ({
    month,
    sales: 15000 + Math.floor(Math.random() * 5000),
    returns: 450 + Math.floor(Math.random() * 200),
    returnRate: 2.5 + Math.random() * 2,
    netSales: 0, // Se calculará después
    profit: 0, // Se calculará después
  })).map(item => {
    item.netSales = item.sales - (item.returns * 65); // Asumiendo precio promedio de devolución
    item.profit = item.netSales * 0.25; // 25% margen
    return item;
  });
}

// Función helper para verificar si estamos en modo demo
export function isDemoModeActive(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('demoSession') === 'active';
}

// --- Funciones adicionales para demo (tiendas, productos, inventario, campañas) ---
export function generateDemoStoreMetrics(startDate: Date, endDate: Date) {
  const stores = ['Dearel', 'Blumi', 'Novi', 'Trazto', 'Cumbre'];
  return stores.map((name) => {
    const totalOrders = 400 + Math.floor(Math.random() * 1200);
    const confirmed = Math.floor(totalOrders * (0.75 + Math.random() * 0.18));
    const avgTicket = 60 + Math.floor(Math.random() * 90);
    const topProducts = generateDemoInventory()
      .map(p => ({ name: p.name, count: Math.floor(Math.random() * 300) }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      name,
      totalOrders,
      confirmedOrders: confirmed,
      totalSpent: confirmed * avgTicket,
      confirmationRate: Number(((confirmed / totalOrders) * 100).toFixed(1)),
      averageTicket: avgTicket,
      topProducts,
    };
  });
}

export function generateDemoProductStats() {
  const products = generateDemoInventory();
  // tasa de confirmación por producto y 5 más comprados
  const stats = products.map(p => ({
    name: p.name,
    totalSold: p.sold,
    confirmationRate: Number((75 + Math.random() * 20).toFixed(1)),
    avgPrice: p.price,
  }));

  const top5 = [...stats].sort((a, b) => b.totalSold - a.totalSold).slice(0, 5);
  return { stats, top5 };
}

export function generateDemoInventorySummary() {
  const items = generateDemoInventory();
  const totalStock = items.reduce((s, it) => s + it.stock, 0);
  const totalReserved = items.reduce((s, it) => s + it.reserved, 0);
  const totalSold = items.reduce((s, it) => s + it.sold, 0);
  const lowStock = items.filter(it => it.stock < 80).slice(0, 8);
  return {
    totalProducts: items.length,
    totalStock,
    totalReserved,
    totalSold,
    lowStock,
    topMoving: items.sort((a,b) => b.sold - a.sold).slice(0,5),
  };
}

export function generateDemoCampaignMetrics(startDate: Date, endDate: Date) {
  const base = generateDemoMetaCampaigns();
  // añadir métricas por día y por provincia simplificadas
  return base.map(c => ({
    ...c,
    daily: Array.from({ length: 7 }).map((_, i) => ({
      date: format(new Date(Date.now() - i * 86400000), 'yyyy-MM-dd'),
      impressions: Math.floor(c.impressions / 7 * (0.7 + Math.random() * 0.6)),
      clicks: Math.floor(c.clicks / 7 * (0.7 + Math.random() * 0.6)),
      conversions: Math.max(0, Math.floor(c.conversions / 7 * (0.6 + Math.random() * 0.8)))
    })),
    byProvince: generateDemoProvinces().map(p => ({ province: p.name, impressions: Math.floor(1000 + Math.random()*5000), clicks: Math.floor(50 + Math.random()*400) }))
  }));
}

export { generateDemoProvinces as generateDemoProvinceMetrics };
