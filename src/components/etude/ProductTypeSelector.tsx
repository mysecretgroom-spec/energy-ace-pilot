import { ProductType, PRODUCT_LABELS, PRODUCT_SHORT_LABELS, PRODUCT_COLORS } from "@/lib/productTypes";
import { Sun, Thermometer, Home, Check, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

const PRODUCT_ICON_COMPONENTS: Record<ProductType, React.ComponentType<{ className?: string }>> = {
  PV: Sun,
  PAC: Thermometer,
  ITE: Home,
};

// ═══════════════════════════════════════════════════════════════════
// MODE MULTI-PRODUIT - Sélection de plusieurs produits avec onglets
// ═══════════════════════════════════════════════════════════════════

interface ProductTypeSelectorProps {
  /** Produits actuellement actifs */
  activeProducts: ProductType[];
  /** Onglet actuellement affiché */
  currentTab: ProductType;
  /** Callback quand les produits actifs changent */
  onActiveProductsChange: (products: ProductType[]) => void;
  /** Callback quand on change d'onglet */
  onTabChange: (tab: ProductType) => void;
  disabled?: boolean;
  availableProducts?: ProductType[];
}

export const ProductTypeSelector = ({
  activeProducts,
  currentTab,
  onActiveProductsChange,
  onTabChange,
  disabled = false,
  availableProducts = ["PV", "PAC", "ITE"],
}: ProductTypeSelectorProps) => {
  const toggleProduct = (product: ProductType) => {
    if (disabled) return;

    const isActive = activeProducts.includes(product);

    if (isActive) {
      // Don't allow deactivating the last product
      if (activeProducts.length <= 1) return;
      const newProducts = activeProducts.filter(p => p !== product);
      onActiveProductsChange(newProducts);
      // If we're removing the current tab, switch to the first remaining product
      if (currentTab === product) {
        onTabChange(newProducts[0]);
      }
    } else {
      const newProducts = [...activeProducts, product];
      onActiveProductsChange(newProducts);
      // Auto-switch to newly added product
      onTabChange(product);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-muted-foreground">Produits de l'étude</label>
        {activeProducts.length > 1 && (
          <Badge variant="outline" className="text-[10px] h-5 bg-primary/10 text-primary border-primary/30">
            {activeProducts.length} produits
          </Badge>
        )}
      </div>

      {/* Sélecteur de produits actifs */}
      <div className="flex gap-1.5 w-full">
        {availableProducts.map((product) => {
          const Icon = PRODUCT_ICON_COMPONENTS[product];
          const isActive = activeProducts.includes(product);
          const isCurrent = currentTab === product;

          return (
            <button
              key={product}
              type="button"
              disabled={disabled}
              onClick={() => {
                if (isActive) {
                  // Si déjà actif, juste changer d'onglet
                  onTabChange(product);
                } else {
                  // Sinon, activer le produit
                  toggleProduct(product);
                }
              }}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 px-2 sm:px-3 py-2.5 rounded-lg border-2 transition-all min-h-[44px] relative",
                isActive && isCurrent
                  ? "border-primary bg-primary/10 text-primary shadow-sm"
                  : isActive
                    ? "border-primary/40 bg-primary/5 text-primary/80"
                    : "border-dashed border-border bg-background hover:bg-muted/50 text-muted-foreground",
                disabled && "opacity-50 cursor-not-allowed"
              )}
            >
              {/* Checkmark for active products */}
              {isActive && (
                <div className="absolute -top-1.5 -right-1.5 h-4 w-4 bg-primary rounded-full flex items-center justify-center">
                  <Check className="h-2.5 w-2.5 text-primary-foreground" />
                </div>
              )}

              {!isActive && (
                <Plus className="h-3 w-3 text-muted-foreground" />
              )}

              <Icon className={cn(
                "h-4 w-4",
                isActive ? PRODUCT_COLORS[product] : "text-muted-foreground"
              )} />
              <span className={cn(
                "font-medium text-xs",
                isCurrent && "font-bold"
              )}>
                {PRODUCT_SHORT_LABELS[product]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Description du produit actuel */}
      <p className="text-[10px] text-muted-foreground">
        {PRODUCT_LABELS[currentTab]}
        {activeProducts.length > 1 && (
          <span className="ml-1 text-primary">
            • Étude combinée ({activeProducts.map(p => PRODUCT_SHORT_LABELS[p]).join(" + ")})
          </span>
        )}
      </p>

      {/* Bouton de désactivation si multiple produits */}
      {activeProducts.length > 1 && !disabled && (
        <div className="flex gap-1 flex-wrap">
          {activeProducts.map((product) => (
            <button
              key={product}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleProduct(product);
              }}
              className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-muted hover:bg-destructive/10 hover:text-destructive transition-colors"
            >
              {PRODUCT_SHORT_LABELS[product]}
              <span className="text-muted-foreground">×</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};