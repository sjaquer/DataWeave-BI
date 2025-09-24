'use server';
import { config } from 'dotenv';
config();

// Import all the flows you want to be available in the dev UI
import './flows/analyzeMetricsFlow';
import './flows/normalizeProvinceFlow';
import './flows/normalizeProductsFlow';
