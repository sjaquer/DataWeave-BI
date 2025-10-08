
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

// Nuevo esquema para tasa de confirmación por producto
export const ProductConfirmationRateSchema = z.object({
  name: z.string(),
  requested: z.number(),
  confirmed: z.number(),
  confirmationRate: z.number(),
});
export type ProductConfirmationRate = z.infer<typeof ProductConfirmationRateSchema>;


export const PersonnelMetricSchema = z.object({
  name: z.string(),
  confirmedOrders: z.number(),
});
export type PersonnelMetric = z.infer<typeof PersonnelMetricSchema>;


export const MiscMetricsSchema = z.object({
  globalConfirmed: z.number(),
  globalUnconfirmed: z.number(),
  dailyOrderVariation: z.number().optional(),
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
  })),
  dailyOrderVariation: z.number().optional(),
  confirmationRateTrend: z.number().optional(),
});
export type StoreMetric = z.infer<typeof StoreMetricSchema>;

// --- Esquemas de Inventario ---

export const InventoryFlowTrendSchema = z.object({
  date: z.string(),
  Entradas: z.number(),
  Salidas: z.number(),
  store: z.string().optional(),
});
export type InventoryFlowTrend = z.infer<typeof InventoryFlowTrendSchema>;

export const MostMovedProductsSchema = z.object({
  name: z.string(),
  movements: z.number(),
  store: z.string().optional(),
});
export type MostMovedProducts = z.infer<typeof MostMovedProductsSchema>;

export const InventoryPersonnelMetricSchema = z.object({
    name: z.string(),
    entries: z.number(),
    exits: z.number(),
});
export type InventoryPersonnelMetric = z.infer<typeof InventoryPersonnelMetricSchema>;

// --- Esquema para Devoluciones de Cliente ---
export const CustomerReturnSchema = z.object({
    date: z.string(),
    productName: z.string(),
    quantity: z.number(),
    user: z.string(),
    orderNumber: z.string(),
    store: z.string(),
});
export type CustomerReturn = z.infer<typeof CustomerReturnSchema>;

// Nuevo esquema para productos más devueltos
export const MostReturnedProductsSchema = z.object({
  name: z.string(),
  returns: z.number(),
  store: z.string().optional(),
});
export type MostReturnedProducts = z.infer<typeof MostReturnedProductsSchema>;

// Nuevo esquema para estado de inventario actual
export const CurrentInventoryItemSchema = z.object({
  sku: z.string(),
  productName: z.string(),
  store: z.string(),
  currentStock: z.number(),
  lastMovementDate: z.string(),
});
export type CurrentInventoryItem = z.infer<typeof CurrentInventoryItemSchema>;

// Nuevo esquema para previsión de compra
export const PurchaseForecastItemSchema = z.object({
    productName: z.string(),
    last30dSales: z.number(),
    currentStock: z.number(),
    suggestedPurchase: z.number(),
    daysLeft: z.number(),
    urgency: z.string(),
});
export type PurchaseForecastItem = z.infer<typeof PurchaseForecastItemSchema>;

// Nuevo esquema para reporte mensual de productos
export const MonthlyProductReportSchema = z.object({
    sku: z.string(),
    productName: z.string(),
    currentStock: z.number(),
    monthlySales: z.number(),
    previousMonthSales: z.number(),
    salesTrend: z.number(),
    suggestedPurchase: z.number(),
});
export type MonthlyProductReport = z.infer<typeof MonthlyProductReportSchema>;


// --- Esquema para el nuevo gráfico de rendimiento de tiendas ---
export const DailyStorePerformanceSchema = z.record(z.union([z.string(), z.number()]));
export type DailyStorePerformance = z.infer<typeof DailyStorePerformanceSchema>;


// --- Esquema de Salida Principal ---

export const GetMetricsOutputSchema = z.object({
    dailyMetrics: z.array(DailyMetricSchema),
    provinceMetrics: z.array(ProvinceMetricSchema),
    provinceMetricsByStore: z.record(z.array(ProvinceMetricSchema)).optional(),
    mostRequestedProducts: z.array(ProductMetricSchema),
    mostPurchasedProducts: z.array(ProductMetricSchema),
    productConfirmationRates: z.array(ProductConfirmationRateSchema).optional(),
    personnelMetrics: z.array(PersonnelMetricSchema),
    storeMetrics: z.array(StoreMetricSchema),
    miscMetrics: MiscMetricsSchema,
    inventoryFlowTrend: z.array(InventoryFlowTrendSchema).optional(),
    mostMovedProducts: z.array(MostMovedProductsSchema).optional(),
    mostIncomingProducts: z.array(MostMovedProductsSchema).optional(),
    inventoryPersonnelMetrics: z.array(InventoryPersonnelMetricSchema).optional(),
    dailyStorePerformance: z.array(DailyStorePerformanceSchema).optional(),
    customerReturns: z.array(CustomerReturnSchema).optional(),
    mostReturnedProducts: z.array(MostReturnedProductsSchema).optional(),
    currentInventory: z.array(CurrentInventoryItemSchema).optional(),
    purchaseForecast: z.array(PurchaseForecastItemSchema).optional(),
    monthlyProductReport: z.array(MonthlyProductReportSchema).optional(),
});

export type GetMetricsOutput = z.infer<typeof GetMetricsOutputSchema>;

    

    

