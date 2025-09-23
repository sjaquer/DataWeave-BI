import { shopifyApi, ApiVersion, Session } from '@shopify/shopify-api';
import '@shopify/shopify-api/adapters/node';

// Función para obtener las credenciales de una tienda específica desde las variables de entorno
const getShopifyCredentials = (storeId: string) => {
  const sanitizedStoreId = storeId.toUpperCase().replace(/-/g, '_');
  const apiKey = process.env[`SHOPIFY_API_KEY_${sanitizedStoreId}`];
  const apiSecretKey = process.env[`SHOPIFY_API_SECRET_${sanitizedStoreId}`];
  const accessToken = process.env[`SHOPIFY_ACCESS_TOKEN_${sanitizedStoreId}`];
  const shop = `${storeId}.myshopify.com`;

  if (!apiKey || !apiSecretKey || !accessToken) {
    throw new Error(`Faltan las credenciales de Shopify para la tienda: ${storeId}. Asegúrate de que SHOPIFY_API_KEY_${sanitizedStoreId}, SHOPIFY_API_SECRET_${sanitizedStoreId}, y SHOPIFY_ACCESS_TOKEN_${sanitizedStoreId} están configuradas.`);
  }

  return { apiKey, apiSecretKey, accessToken, shop };
};

// Función para inicializar y devolver un cliente de Shopify para una tienda específica
export const getShopifyClient = (storeId: string) => {
  const { apiKey, apiSecretKey, accessToken, shop } = getShopifyCredentials(storeId);

  const shopify = shopifyApi({
    apiKey: apiKey,
    apiSecretKey: apiSecretKey,
    scopes: ['read_orders'],
    hostName: 'localhost', // No es relevante para el uso de la API de Admin con token privado
    apiVersion: ApiVersion.April24,
    isEmbeddedApp: false,
  });

  const session = new Session({
    id: `session_${storeId}`,
    shop,
    state: 'state',
    isOnline: false,
    accessToken,
  });

  const client = new shopify.clients.Graphql({ session });

  return client;
};
