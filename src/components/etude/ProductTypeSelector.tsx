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
    <div className="space-y-1.5 sm:space-y-2">
      <label className="text-xs sm:text-sm font-medium text-muted-foreground">Type de produit</label>
      <ToggleGroup
        type="single"
        value={value}
        onValueChange={(val) => val && onChange(val as ProductType)}
        disabled={disabled}
        className="justify-start gap-1.5 sm:gap-2 w-full"
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
                "flex-1 flex items-center justify-center gap-1.5 sm:gap-2 px-2 sm:px-4 py-2.5 sm:py-3 rounded-lg sm:rounded-xl border-2 transition-all min-h-[44px]",
                isSelected
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-muted bg-background hover:bg-muted/50"
              )}
            >
              <Icon className={cn("h-4 w-4 sm:h-5 sm:w-5", isSelected ? PRODUCT_COLORS[product] : "text-muted-foreground")} />
              <span className="font-medium text-xs sm:text-sm">{PRODUCT_SHORT_LABELS[product]}</span>
            </ToggleGroupItem>
          );
        })}
      </ToggleGroup>
      <p className="text-[10px] sm:text-xs text-muted-foreground">{PRODUCT_LABELS[value]}</p>
    </div>
  );
};
