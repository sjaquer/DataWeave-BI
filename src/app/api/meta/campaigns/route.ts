
import { NextResponse } from 'next/server';
import { FacebookAdsApi, AdAccount } from 'facebook-nodejs-business-sdk';

/**
 * Endpoint para obtener las métricas de rendimiento de las campañas de Meta.
 * Acepta parámetros de consulta 'startDate' y 'endDate' (en formato YYYY-MM-DD).
 */
export async function GET(req: Request) {
  const { META_ACCESS_TOKEN, META_AD_ACCOUNT_ID } = process.env;

  // 1. Validar que las credenciales existen
  if (!META_ACCESS_TOKEN || !META_AD_ACCOUNT_ID) {
    console.error('[API Meta] Error: Las credenciales de la API de Meta no están configuradas en el servidor.');
    return NextResponse.json({
      status: 'error',
      message: 'La configuración del servidor es incompleta. Faltan las credenciales de la API de Meta.'
    }, { status: 500 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!startDate || !endDate) {
        return NextResponse.json({
            status: 'error',
            message: 'Los parámetros startDate y endDate son obligatorios.'
        }, { status: 400 });
    }

    // 2. Inicializar la API y la cuenta publicitaria
    const api = FacebookAdsApi.init(META_ACCESS_TOKEN);
    const account = new AdAccount(META_AD_ACCOUNT_ID);

    // 3. Obtener las métricas de rendimiento (Insights)
    // Se piden los datos de rendimiento a nivel de campaña
    const insights = await account.getInsights(
      [
        'campaign_id',
        'campaign_name',
        'objective',
        'spend',
        'cpc',
        'ctr',
        'impressions',
        'clicks',
      ],
      {
        level: 'campaign',
        time_range: {
          since: startDate,
          until: endDate,
        },
      }
    );
    
    // Si no hay campañas con datos en ese rango, devolver un array vacío.
    if (insights.length === 0) {
      return NextResponse.json({ status: 'success', campaigns: [] }, { status: 200 });
    }

    const campaignIds = insights.map((insight: any) => insight.campaign_id);

    // 4. Obtener el estado de cada campaña (ACTIVE, PAUSED, etc.)
    // La llamada de "insights" no incluye el estado actual, por lo que se necesita una segunda llamada.
    const campaignsData = await account.getCampaigns(['status'], { ids: campaignIds });
    
    const campaignStatusMap = new Map();
    campaignsData.forEach((campaign: any) => {
      campaignStatusMap.set(campaign.id, campaign.status);
    });

    // 5. Combinar los datos de rendimiento con los de estado
    const formattedCampaigns = insights.map((insight: any) => ({
      id: insight.campaign_id,
      name: insight.campaign_name,
      objective: insight.objective,
      status: campaignStatusMap.get(insight.campaign_id) || 'UNKNOWN',
      spend: parseFloat(insight.spend || 0),
      cpc: parseFloat(insight.cpc || 0),
      ctr: parseFloat(insight.ctr || 0),
      impressions: parseInt(insight.impressions || 0, 10),
      clicks: parseInt(insight.clicks || 0, 10),
    }));

    return NextResponse.json({ status: 'success', campaigns: formattedCampaigns }, { status: 200 });

  } catch (error: any) {
    console.error('[API Meta] Error al obtener los datos de las campañas:', error.message);
    return NextResponse.json({ 
      status: 'error', 
      message: `Error al conectar con la API de Meta: ${error.message}` 
    }, { status: 500 });
  }
}
