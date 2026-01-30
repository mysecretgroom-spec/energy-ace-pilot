import { ProductType, PRODUCT_LABELS, PRODUCT_SHORT_LABELS, PRODUCT_COLORS } from "@/lib/productTypes";
import { Sun, Thermometer, Home } from "lucide-react";
import { cn } from "@/lib/utils";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

interface ProductTypeSelectorProps {
  value: ProductType;
  onChange: (value: ProductType) => void;
  disabled?: boolean;
  availableProducts?: ProductType[];
}

const PRODUCT_ICON_COMPONENTS: Record<ProductType, React.ComponentType<{ className?: string }>> = {
  PV: Sun,
  PAC: Thermometer,
  ITE: Home,
};

export const ProductTypeSelector = ({
  value,
  onChange,
  disabled = false,
  availableProducts = ["PV", "PAC", "ITE"],
}: ProductTypeSelectorProps) => {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">Type de produit</label>
      <ToggleGroup
        type="single"
        value={value}
        onValueChange={(val) => val && onChange(val as ProductType)}
        disabled={disabled}
        className="justify-start gap-1.5 w-full"
      >
        {availableProducts.map((product) => {
          const Icon = PRODUCT_ICON_COMPONENTS[product];
          const isSelected = value === product;
          
          return (
            <ToggleGroupItem
              key={product}
              value={product}
              aria-label={PRODUCT_LABELS[product]}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 px-2 sm:px-3 py-2 rounded-lg border transition-all min-h-[40px]",
                isSelected
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-background hover:bg-muted/50"
              )}
            >
              <Icon className={cn("h-4 w-4", isSelected ? PRODUCT_COLORS[product] : "text-muted-foreground")} />
              <span className="font-medium text-xs">{PRODUCT_SHORT_LABELS[product]}</span>
            </ToggleGroupItem>
          );
        })}
      </ToggleGroup>
      <p className="text-[10px] text-muted-foreground">{PRODUCT_LABELS[value]}</p>
    </div>
  );
};
