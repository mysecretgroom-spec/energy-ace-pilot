import { useNavigate } from "react-router-dom";
import { Plus, Camera, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DashboardQuickActions() {
  const navigate = useNavigate();

  const actions = [
    {
      icon: Plus,
      label: "Nouveau RDV",
      onClick: () => navigate("/planning"),
      color: "bg-primary text-primary-foreground hover:bg-primary/90",
    },
    {
      icon: Camera,
      label: "Scanner",
      onClick: () => {
        // Navigate to CRM with scanner intent
        navigate("/crm?tab=clients");
      },
      color: "bg-secondary text-secondary-foreground hover:bg-secondary/90",
    },
    {
      icon: Phone,
      label: "Rappel",
      onClick: () => navigate("/crm"),
      color: "bg-muted text-foreground hover:bg-muted/80",
    },
  ];

  return (
    <div className="flex items-center gap-2">
      {actions.map((action) => (
        <Button
          key={action.label}
          variant="ghost"
          className={`flex-1 flex flex-col items-center gap-1.5 h-auto py-3 rounded-xl ${action.color}`}
          onClick={action.onClick}
        >
          <action.icon className="h-5 w-5" />
          <span className="text-[10px] font-medium">{action.label}</span>
        </Button>
      ))}
    </div>
  );
}
