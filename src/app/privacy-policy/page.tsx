
import React from 'react';

// Componente para estilizar las secciones y facilitar la lectura
const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="mb-8">
    <h2 className="text-2xl font-bold border-b pb-2 mb-4">{title}</h2>
    <div className="space-y-4 text-muted-foreground">{children}</div>
  </div>
);

export default function PrivacyPolicyPage() {
  return (
    <div className="bg-background text-foreground min-h-screen">
      <main className="container mx-auto px-4 py-12 md:py-20">
        <div className="max-w-3xl mx-auto">
          <header className="text-center mb-12">
            <h1 className="text-4xl font-extrabold tracking-tight">Política de Privacidad</h1>
            <p className="mt-2 text-lg text-muted-foreground">Última actualización: 20 de Octubre de 2025</p>
          </header>

          <div className="prose prose-lg max-w-none">
            <p className="lead">
              Bienvenido a nuestro Dashboard de Métricas. Su privacidad es de suma importancia para nosotros. Esta política de privacidad explica qué datos recopilamos, cómo los usamos y protegemos, especialmente en relación con la integración de la API de Marketing de Meta (Facebook).
            </p>

            <Section title="1. Datos que Recopilamos">
              <p>
                Nuestra aplicación se conecta a la API de Marketing de Meta para acceder a los datos de rendimiento de sus campañas publicitarias. Los datos que solicitamos y procesamos se limitan estrictamente a lo necesario para el funcionamiento del dashboard. Esto incluye:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  <strong>Métricas de Campañas:</strong> Gasto (spend), impresiones, clics, coste por clic (CPC), y ratio de clics (CTR).
                </li>
                <li>
                  <strong>Metadatos de Campañas:</strong> Nombre de la campaña, ID de la campaña, estado (activa, pausada) y objetivo.
                </li>
                <li>
                  <strong>No Recopilamos Datos Personales de Usuarios Finales:</strong> Es importante destacar que esta aplicación no accede, almacena ni procesa información personal identificable (PII) de los usuarios que interactúan con sus anuncios. Nuestro único propósito es analizar el rendimiento agregado de las campañas.
                </li>
              </ul>
            </Section>

            <Section title="2. Cómo Usamos sus Datos">
              <p>
                Los datos obtenidos de la API de Meta se utilizan exclusivamente para los siguientes propósitos:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  <strong>Visualización de Datos:</strong> Para presentar las métricas de sus campañas en forma de gráficos, tablas y tarjetas de KPIs dentro de su dashboard privado.
                </li>
                <li>
                  <strong>Análisis de Rendimiento:</strong> Para permitirle analizar y comparar el rendimiento de diferentes campañas publicitarias en los rangos de fechas que usted seleccione.
                </li>
                <li>
                  <strong>Uso Interno:</strong> Los datos son para su uso exclusivo. No se utilizan para ningún otro propósito, ni se combinan con datos de otras fuentes externas no relacionadas.
                </li>
              </ul>
            </Section>

            <Section title="3. Cómo Compartimos sus Datos">
              <p>
                <strong>No compartimos sus datos con terceros.</strong>
              </p>
              <p>
                Los datos de rendimiento de sus campañas son confidenciales y solo son accesibles por usted a través de su cuenta en nuestro dashboard. No vendemos, alquilamos ni compartimos esta información con ninguna otra entidad o servicio.
              </p>
            </Section>
            
            <Section title="4. Seguridad de los Datos">
              <p>
                Tomamos medidas razonables para proteger la información que procesamos. El acceso a la API de Meta se realiza a través de tokens de acceso seguros, que se almacenan de forma encriptada y segura en nuestro backend. El acceso al dashboard está protegido por un sistema de autenticación para garantizar que solo los usuarios autorizados puedan ver sus datos.
              </p>
            </Section>

            <Section title="5. Cambios a esta Política de Privacidad">
              <p>
                Podemos actualizar esta política de privacidad de vez en cuando. Le notificaremos de cualquier cambio publicando la nueva política en esta página. Le recomendamos que revise esta política periódicamente para cualquier cambio.
              </p>
            </Section>

            <Section title="6. Contacto">
              <p>
                Si tiene alguna pregunta sobre esta Política de Privacidad, por favor, póngase en contacto con nosotros a través de los canales de soporte designados.
              </p>
            </Section>
          </div>
        </div>
      </main>
    </div>
  );
}
