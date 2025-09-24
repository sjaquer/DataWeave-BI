'use server';
/**
 * @fileOverview Flujo de Genkit para normalizar nombres de provincias peruanas.
 *
 * - normalizeProvinces: Una función que invoca a una IA para estandarizar una lista de nombres de provincias.
 * - NormalizeProvincesInput: El tipo de entrada para la función.
 * - NormalizeProvincesOutput: El tipo de salida de la función.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import {
  NormalizeProvincesInputSchema,
  NormalizeProvincesOutputSchema,
  type NormalizeProvincesInput,
  type NormalizeProvincesOutput,
} from '@/ai/schemas/normalizeProvinceSchema';

export async function normalizeProvinces(
  input: NormalizeProvincesInput
): Promise<NormalizeProvincesOutput> {
  return await normalizeProvincesFlow(input);
}

// Define el prompt que se enviará al modelo de lenguaje.
const normalizeProvincePrompt = ai.definePrompt({
  name: 'normalizeProvincePrompt',
  input: {schema: NormalizeProvincesInputSchema},
  output: {schema: NormalizeProvincesOutputSchema},
  prompt: `Eres un experto en limpieza y estandarización de datos geográficos de Perú.
Tu tarea es normalizar una lista de nombres de provincias que pueden tener errores, estar en mayúsculas/minúsculas o tener tildes incorrectas.
Debes devolver el nombre canónico y estandarizado para cada una. Por ejemplo, "LIMA" o "lima" debe ser "Lima", y "Cuzco" debe ser "Cusco".
El territorio peruano se divide en 25 departamentos y 196 provincias.

Considera la siguiente lista de nombres de provincias:
{{#each provinceNames}}
- {{{this}}}
{{/each}}

Devuelve un único objeto JSON que mapee cada nombre de provincia original a su versión corregida y estandarizada.
Si un nombre ya es correcto, simplemente repítelo. Si no puedes identificar una provincia, devuélvela sin cambios.
Ejemplo de salida: {"LIMA": "Lima", "Arequipa": "Arequipa", "Santa": "Santa"}`,
});


// Define el flujo de Genkit que orquesta la llamada a la IA.
const normalizeProvincesFlow = ai.defineFlow(
  {
    name: 'normalizeProvincesFlow',
    inputSchema: NormalizeProvincesInputSchema,
    outputSchema: NormalizeProvincesOutputSchema,
  },
  async (input: NormalizeProvincesInput) => {

    if (!input.provinceNames || input.provinceNames.length === 0) {
        return {};
    }
    
    // Ejecuta el prompt de normalización.
    const {output} = await normalizeProvincePrompt(input);
    if (!output) {
      throw new Error('La IA no generó una respuesta válida.');
    }

    return output;
  }
);
