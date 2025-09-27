import { z } from 'zod';

// --- Esquema de Entrada ---
export const GetMetricsInputSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
}).optional();

export type GetMetricsInput = z.infer<typeof GetMetricsInputSchema>;


// --- Definición de Esquemas de Salida ---

export const DailyMetricSchema = z.object({
  date: z.string(),
  totalOrders: z.number(),
  confirmed: z.number(),
  unconfirmed: z.number(),
  confirmationRate: z.number(),
  byStore: z.record(z.object({
    confirmed: z.number(),
    unconfirmed: z.number(),
  })).optional(),
});
export type DailyMetric = z.infer<typeof DailyMetricSchema>;

export const ProvinceMetricSchema = z.object({
  name: z.string(),
  totalOrders: z.number(),
  confirmedOrders: z.number(),
  confirmationRate: z.number(),
  totalSpent: z.number(),
});
export type ProvinceMetric = z.infer<typeof ProvinceMetricSchema>;


export const ProductMetricSchema = z.object({
  name: z.string(),
  totalOrders: z.number(),
});
export type ProductMetric = z.infer<typeof ProductMetricSchema>;


export const PersonnelMetricSchema = z.object({
  name: z.string(),
  confirmedOrders: z.number(),
});
export type PersonnelMetric = z.infer<typeof PersonnelMetricSchema>;


export const MiscMetricsSchema = z.object({
  globalConfirmed: z.number(),
  globalUnconfirmed: z.number(),
});
export type MiscMetrics = z.infer<typeof MiscMetricsSchema>;

export const StoreMetricSchema = z.object({
  name: z.string(),
  totalOrders: z.number(),
  confirmedOrders: z.number(),
  confirmationRate: z.number(),
  totalSpent: z.number(),
  averageTicket: z.number(),
  topProducts: z.array(z.object({
    name: z.string(),
    count: z.number()
  }))
});
export type StoreMetric = z.infer<typeof StoreMetricSchema>;

// --- Esquemas de Inventario ---

export const InventoryFlowTrendSchema = z.object({
  date: z.string(),
  Entradas: z.number(),
  Salidas: z.number(),
});
export type InventoryFlowTrend = z.infer<typeof InventoryFlowTrendSchema>;

export const MostMovedProductsSchema = z.object({
  name: z.string(),
  movements: z.number(),
});
export type MostMovedProducts = z.infer<typeof MostMovedProductsSchema>;

export const InventoryPersonnelMetricSchema = z.object({
    name: z.string(),
    entries: z.number(),
    exits: z.number(),
});
export type InventoryPersonnelMetric = z.infer<typeof InventoryPersonnelMetricSchema>;


// --- Esquema de Salida Principal ---

export const GetMetricsOutputSchema = z.object({
    dailyMetrics: z.array(DailyMetricSchema),
    provinceMetrics: z.array(ProvinceMetricSchema),
    mostRequestedProducts: z.array(ProductMetricSchema),
    mostPurchasedProducts: z.array(ProductMetricSchema),
    personnelMetrics: z.array(PersonnelMetricSchema),
    storeMetrics: z.array(StoreMetricSchema),
    miscMetrics: MiscMetricsSchema,
    inventoryFlowTrend: z.array(InventoryFlowTrendSchema).optional(),
    mostMovedProducts: z.array(MostMovedProductsSchema).optional(),
    inventoryPersonnelMetrics: z.array(InventoryPersonnelMetricSchema).optional(),
});

export type GetMetricsOutput = z.infer<typeof GetMetricsOutputSchema>;
