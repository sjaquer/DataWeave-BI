'use server';
/**
 * @fileOverview Flujo de Genkit para normalizar títulos de productos.
 *
 * - normalizeProducts: Una función que invoca a una IA para limpiar y estandarizar una lista de títulos de productos.
 * - NormalizeProductsInput: El tipo de entrada para la función.
 * - NormalizeProductsOutput: El tipo de salida de la función.
 */

import {ai} from '@/ai/genkit';
import {
  NormalizeProductsInputSchema,
  NormalizeProductsOutputSchema,
  type NormalizeProductsInput,
  type NormalizeProductsOutput,
} from '@/ai/schemas/normalizeProductsSchema';

export async function normalizeProducts(
  input: NormalizeProductsInput
): Promise<NormalizeProductsOutput> {
  return await normalizeProductsFlow(input);
}

const normalizeProductsPrompt = ai.definePrompt({
  name: 'normalizeProductsPrompt',
  input: {schema: NormalizeProductsInputSchema},
  output: {schema: NormalizeProductsOutputSchema},
  prompt: `Eres un experto en limpieza de datos de E-commerce. Tu tarea es normalizar una lista de títulos de productos.
Estos títulos pueden tener prefijos como "1x ", mayúsculas/minúsculas inconsistentes, o ser poco claros.
Debes devolver un título limpio, legible y estandarizado para cada uno.
Por ejemplo, "1x LLAVE PARA GATO..." debe ser "Llave para Gato" y "LINTERNA MULTIFUNCIONAL" debe ser "Linterna Multifuncional".

Considera la siguiente lista de títulos de productos:
{{#each productTitles}}
- {{{this}}}
{{/each}}

Devuelve un único objeto JSON con un campo 'corrections' que mapea cada título original a su versión corregida.
Si un título ya es claro y está bien formateado, simplemente mejóralo o repítelo. Si no puedes identificar un producto, devuélvelo sin cambios.
Ejemplo de salida: {"corrections": {"1x LLAVE PARA GATO...": "Llave para Gato", "LINTERNA MULTIFUNCIONAL": "Linterna Multifuncional"}}`,
});

const normalizeProductsFlow = ai.defineFlow(
  {
    name: 'normalizeProductsFlow',
    inputSchema: NormalizeProductsInputSchema,
    outputSchema: NormalizeProductsOutputSchema,
  },
  async (input: NormalizeProductsInput) => {
    if (!input.productTitles || input.productTitles.length === 0) {
      return {corrections: {}};
    }

    const {output} = await normalizeProductsPrompt(input);
    if (!output) {
      throw new Error('La IA no generó una respuesta válida para los productos.');
    }

    return output;
  }
);
