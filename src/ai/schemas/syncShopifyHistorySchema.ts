import { z } from 'genkit';

export const SyncShopifyHistoryInputSchema = z.object({
  storeId: z.string().min(1, 'El ID de la tienda es requerido.'),
});
export type SyncShopifyHistoryInput = z.infer<
  typeof SyncShopifyHistoryInputSchema
>;

export const SyncShopifyHistoryOutputSchema = z.object({
  status: z.string(),
  message: z.string(),
  ordersProcessed: z.number(),
});
export type SyncShopifyHistoryOutput = z.infer<
  typeof SyncShopifyHistoryOutputSchema
>;
