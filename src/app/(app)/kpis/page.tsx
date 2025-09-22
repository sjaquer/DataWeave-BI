import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Activity, DollarSign, Users, CreditCard, Truck, CheckCircle, TrendingUp, Frown } from "lucide-react"

type KpiCardProps = {
  title: string;
  value: string;
  change: string;
  icon: React.ElementType;
  isPositive: boolean;
  description: string;
};

const KpiCard = ({ title, value, change, icon: Icon, isPositive, description }: KpiCardProps) => (
  <Card>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      <Icon className="h-4 w-4 text-muted-foreground" />
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{value}</div>
      <p className="text-xs text-muted-foreground">
        <span className={isPositive ? "text-accent" : "text-destructive"}>{change}</span> {description}
      </p>
    </CardContent>
  </Card>
);

export default function KpiPage() {
  const kpis = [
    { title: "Total Revenue", value: "$4,203,190", change: "+12.5%", icon: DollarSign, isPositive: true, description: "from last quarter" },
    { title: "Avg. Order Value", value: "$124.50", change: "+3.2%", icon: CreditCard, isPositive: true, description: "from last quarter" },
    { title: "Conversion Rate", value: "3.45%", change: "+0.5%", icon: TrendingUp, isPositive: true, description: "from last quarter" },
    { title: "New Customers", value: "1,284", change: "+8.1%", icon: Users, isPositive: true, description: "from last quarter" },
    { title: "Marketing ROI", value: "5.2x", change: "-0.5x", icon: Activity, isPositive: false, description: "from last campaign" },
    { title: "On-Time Delivery", value: "98.2%", change: "+1.2%", icon: Truck, isPositive: true, description: "from last month" },
    { title: "Customer Satisfaction", value: "92%", change: "+2%", icon: CheckCircle, isPositive: true, description: "from last survey" },
    { title: "Cart Abandonment Rate", value: "68%", change: "-3%", icon: Frown, isPositive: true, description: "from last month" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <h1 className="text-3xl font-bold tracking-tight">KPI Monitoring</h1>
        <p className="text-muted-foreground">
          Track key performance indicators across your business.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.title} {...kpi} />
        ))}
      </div>
    </div>
  )
}
