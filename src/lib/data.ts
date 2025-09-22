export const salesByMonth = [
  { month: "Ene", total: Math.floor(Math.random() * 5000) + 1000 },
  { month: "Feb", total: Math.floor(Math.random() * 5000) + 1000 },
  { month: "Mar", total: Math.floor(Math.random() * 5000) + 1000 },
  { month: "Abr", total: Math.floor(Math.random() * 5000) + 1000 },
  { month: "May", total: Math.floor(Math.random() * 5000) + 1000 },
  { month: "Jun", total: Math.floor(Math.random() * 5000) + 1000 },
  { month: "Jul", total: Math.floor(Math.random() * 5000) + 1000 },
  { month: "Ago", total: Math.floor(Math.random() * 5000) + 1000 },
  { month: "Sep", total: Math.floor(Math.random() * 5000) + 1000 },
  { month: "Oct", total: Math.floor(Math.random() * 5000) + 1000 },
  { month: "Nov", total: Math.floor(Math.random() * 5000) + 1000 },
  { month: "Dic", total: Math.floor(Math.random() * 5000) + 1000 },
];

export const topProducts = [
    { name: 'Amoladora Angular', sales: 450 },
    { name: 'Taladro Percutor', sales: 380 },
    { name: 'Sierra Circular', sales: 320 },
    { name: 'Lijadora Orbital', sales: 280 },
    { name: 'Juego de Brocas', sales: 210 },
];

export const salesByRegion = [
    { name: 'Lima', sales: 12500 },
    { name: 'Arequipa', sales: 8700 },
    { name: 'Trujillo', sales: 7200 },
    { name: 'Cusco', sales: 5400 },
    { name: 'Piura', sales: 4800 },
];

export const customerDemographics = {
    byLocation: [
        { name: 'Urbano', value: 400, fill: 'var(--color-chart-1)' },
        { name: 'Suburbano', value: 300, fill: 'var(--color-chart-2)' },
        { name: 'Rural', value: 300, fill: 'var(--color-chart-3)' },
    ],
    byAge: [
        { name: '18-24', value: 250, fill: 'var(--color-chart-1)' },
        { name: '25-34', value: 450, fill: 'var(--color-chart-2)' },
        { name: '35-44', value: 300, fill: 'var(--color-chart-3)' },
        { name: '45+', value: 200, fill: 'var(--color-chart-4)' },
    ]
}

export const peruOrderData = [
  { province: "Amazonas", orders: 15 },
  { province: "Ancash", orders: 40 },
  { province: "Apurimac", orders: 20 },
  { province: "Arequipa", orders: 85 },
  { province: "Ayacucho", orders: 30 },
  { province: "Cajamarca", orders: 50 },
  { province: "Callao", orders: 110 },
  { province: "Cusco", orders: 70 },
  { province: "Huancavelica", orders: 10 },
  { province: "Huanuco", orders: 25 },
  { province: "Ica", orders: 60 },
  { province: "Junin", orders: 55 },
  { province: "La Libertad", orders: 75 },
  { province: "Lambayeque", orders: 65 },
  { province: "Lima", orders: 200 },
  { province: "Loreto", orders: 45 },
  { province: "Madre de Dios", orders: 5 },
  { province: "Moquegua", orders: 12 },
  { province: "Pasco", orders: 8 },
  { province: "Piura", orders: 80 },
  { province: "Puno", orders: 35 },
  { province: "San Martin", orders: 48 },
  { province: "Tacna", orders: 28 },
  { province: "Tumbes", orders: 22 },
  { province: "Ucayali", orders: 18 },
];


export const kpiData = {
    totalRevenue: {
        value: '$45,231.89',
        change: '+20.1%',
        description: 'from last month'
    },
    subscriptions: {
        value: '+2350',
        change: '+180.1%',
        description: 'from last month'
    },
    sales: {
        value: '+12,234',
        change: '+19%',
        description: 'from last month'
    },
    activeNow: {
        value: '+573',
        change: '+201',
        description: 'since last hour'
    }
}
