'use server';

/**
 * @fileOverview Generates a markdown document outlining the optimal database schema for KPI analysis.
 *
 * - generateDatabaseSchema - A function that generates the database schema.
 * - GenerateDatabaseSchemaInput - The input type for the generateDatabaseSchema function.
 * - GenerateDatabaseSchemaOutput - The return type for the generateDatabaseSchema function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateDatabaseSchemaInputSchema = z.object({
  salesDataDescription: z
    .string()
    .describe('Description of the sales data available.'),
  customerDataDescription: z
    .string()
    .describe('Description of the customer data available.'),
  regionalSalesDataDescription: z
    .string()
    .describe('Description of the regional sales data available.'),
});
export type GenerateDatabaseSchemaInput = z.infer<
  typeof GenerateDatabaseSchemaInputSchema
>;

const GenerateDatabaseSchemaOutputSchema = z.object({
  databaseSchemaMarkdown: z
    .string()
    .describe('Markdown document outlining the optimal database schema.'),
});
export type GenerateDatabaseSchemaOutput = z.infer<
  typeof GenerateDatabaseSchemaOutputSchema
>;

export async function generateDatabaseSchema(
  input: GenerateDatabaseSchemaInput
): Promise<GenerateDatabaseSchemaOutput> {
  return generateDatabaseSchemaFlow(input);
}

const prompt = ai.definePrompt({
  name: 'databaseSchemaPrompt',
  input: {schema: GenerateDatabaseSchemaInputSchema},
  output: {schema: GenerateDatabaseSchemaOutputSchema},
  prompt: `You are a database architect expert. Generate a markdown document outlining the optimal database schema for performing comprehensive KPI analysis, based on the following data descriptions. The markdown document should contain table definitions, data types, primary keys, foreign keys and indexes.

Sales Data Description: {{{salesDataDescription}}}
Customer Data Description: {{{customerDataDescription}}}
Regional Sales Data Description: {{{regionalSalesDataDescription}}}`,
});

const generateDatabaseSchemaFlow = ai.defineFlow(
  {
    name: 'generateDatabaseSchemaFlow',
    inputSchema: GenerateDatabaseSchemaInputSchema,
    outputSchema: GenerateDatabaseSchemaOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
