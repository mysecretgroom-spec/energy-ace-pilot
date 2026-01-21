import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { PieChart as PieChartIcon } from "lucide-react";

interface ExpenseItem {
  montant: number;
  categorie: string;
}

interface ExpenseChartProps {
  frais: ExpenseItem[];
}

const categoryLabels: Record<string, string> = {
  carburant: "Carburant",
  repas: "Repas",
  hotel: "Hôtel",
  peage: "Péage",
  parking: "Parking",
  autre: "Autre",
};

const categoryColors: Record<string, string> = {
  carburant: "hsl(var(--chart-1))",
  repas: "hsl(var(--chart-2))",
  hotel: "hsl(var(--chart-3))",
  peage: "hsl(var(--chart-4))",
  parking: "hsl(var(--chart-5))",
  autre: "hsl(var(--muted-foreground))",
};

export function ExpenseChart({ frais }: ExpenseChartProps) {
  // Aggregate by category
  const categoryTotals = frais.reduce((acc, item) => {
    const cat = item.categorie;
    acc[cat] = (acc[cat] || 0) + Number(item.montant);
    return acc;
  }, {} as Record<string, number>);

  const chartData = Object.entries(categoryTotals)
    .map(([categorie, value]) => ({
      name: categoryLabels[categorie] || categorie,
      value: Number(value.toFixed(2)),
      color: categoryColors[categorie] || categoryColors.autre,
    }))
    .sort((a, b) => b.value - a.value);

  const total = chartData.reduce((sum, item) => sum + item.value, 0);

  if (chartData.length === 0) {
    return (
      <Card className="shadow-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <PieChartIcon className="h-4 w-4" />
            Répartition par catégorie
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 text-center text-muted-foreground text-sm">
          Aucune donnée à afficher
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <PieChartIcon className="h-4 w-4" />
          Répartition par catégorie
        </CardTitle>
      </CardHeader>
      <CardContent className="p-2">
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={70}
                paddingAngle={2}
                dataKey="value"
                label={({ name, percent }) => 
                  percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : ""
                }
                labelLine={false}
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number) => [`${value.toFixed(2)} €`, ""]}
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        
        {/* Legend */}
        <div className="grid grid-cols-2 gap-1 mt-2 text-xs">
          {chartData.map((item) => (
            <div key={item.name} className="flex items-center gap-2">
              <div
                className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-muted-foreground truncate">{item.name}</span>
              <span className="font-medium text-foreground ml-auto">
                {item.value.toFixed(0)}€
              </span>
            </div>
          ))}
        </div>
        
        <div className="mt-3 pt-2 border-t text-center">
          <span className="text-xs text-muted-foreground">Total: </span>
          <span className="font-bold text-foreground">{total.toFixed(2)} €</span>
        </div>
      </CardContent>
    </Card>
  );
}
