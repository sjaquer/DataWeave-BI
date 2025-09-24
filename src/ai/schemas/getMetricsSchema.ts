
import { z } from 'zod';

// --- Definición de Esquemas de Salida ---

export const DailyMetricSchema = z.object({
  date: z.string(),
  totalOrders: z.number(),
  confirmed: z.number(),
  unconfirmed: z.number(),
  confirmationRate: z.number(),
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


export const GetMetricsOutputSchema = z.object({
    dailyMetrics: z.array(DailyMetricSchema),
    provinceMetrics: z.array(ProvinceMetricSchema),
    productMetrics: z.array(ProductMetricSchema),
    personnelMetrics: z.array(PersonnelMetricSchema),
    miscMetrics: MiscMetricsSchema
});

export type GetMetricsOutput = z.infer<typeof GetMetricsOutputSchema>;

    