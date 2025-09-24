/**
 * @fileOverview Define los esquemas y tipos para el flujo de normalización de provincias.
 */
import {z} from 'genkit';

// Esquema para la entrada del flujo: una lista de nombres de provincias.
export const NormalizeProvincesInputSchema = z.object({
  provinceNames: z
    .array(z.string())
    .describe('Una lista de nombres de provincias para estandarizar.'),
});
export type NormalizeProvincesInput = z.infer<
  typeof NormalizeProvincesInputSchema
>;

// Esquema para la salida del flujo: un mapa de correcciones.
export const NormalizeProvincesOutputSchema = z
  .record(z.string())
  .describe(
    'Un objeto que mapea cada nombre de provincia original a su versión estandarizada.'
  );
export type NormalizeProvincesOutput = z.infer<
  typeof NormalizeProvincesOutputSchema
>;
