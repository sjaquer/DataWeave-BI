/**
 * @fileOverview Define los esquemas y tipos para el flujo de normalización de productos.
 */
import {z} from 'genkit';

// Esquema para la entrada del flujo: una lista de títulos de productos.
export const NormalizeProductsInputSchema = z.object({
  productTitles: z
    .array(z.string())
    .describe('Una lista de títulos de productos para estandarizar.'),
});
export type NormalizeProductsInput = z.infer<
  typeof NormalizeProductsInputSchema
>;

// Esquema para la salida del flujo: un mapa de correcciones.
export const NormalizeProductsOutputSchema = z.object({
  corrections: z
    .record(z.string())
    .describe(
      'Un objeto que mapea cada título de producto original a su versión estandarizada.'
    ),
});
export type NormalizeProductsOutput = z.infer<
  typeof NormalizeProductsOutputSchema
>;
