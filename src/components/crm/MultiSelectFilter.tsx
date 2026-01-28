import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FilterOption {
  id: string;
  label: string;
  color?: string;
  icon?: React.ReactNode;
}

interface MultiSelectFilterProps {
  label: string;
  icon?: React.ReactNode;
  options: FilterOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
  className?: string;
  placeholder?: string;
}

export function MultiSelectFilter({
  label,
  icon,
  options,
  selected,
  onChange,
  className,
  placeholder = "Tous"
}: MultiSelectFilterProps) {
  const [open, setOpen] = useState(false);

  const toggleOption = (id: string) => {
    if (selected.includes(id)) {
      onChange(selected.filter(s => s !== id));
    } else {
      onChange([...selected, id]);
    }
  };

  const selectAll = () => {
    onChange([]);
  };

  const selectedLabels = options
    .filter(o => selected.includes(o.id))
    .map(o => o.label);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "h-9 justify-between gap-2 font-normal",
            selected.length > 0 && "border-primary/50 bg-primary/5",
            className
          )}
        >
          <div className="flex items-center gap-2 truncate">
            {icon}
            {selected.length === 0 ? (
              <span className="text-muted-foreground">{placeholder}</span>
            ) : selected.length === 1 ? (
              <span className="truncate">{selectedLabels[0]}</span>
            ) : (
              <span className="truncate">{selected.length} sélectionnés</span>
            )}
          </div>
          <ChevronDown className="h-4 w-4 opacity-50 flex-shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="start">
        <div className="space-y-1">
          {/* Select all / Clear */}
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-xs h-8"
            onClick={selectAll}
          >
            {selected.length === 0 ? "✓ " : ""}{placeholder}
          </Button>
          
          <div className="h-px bg-border my-1" />
          
          {/* Options */}
          {options.map((option) => (
            <div
              key={option.id}
              className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent cursor-pointer"
              onClick={() => toggleOption(option.id)}
            >
              <Checkbox
                checked={selected.includes(option.id)}
                className="h-4 w-4"
              />
              {option.color && (
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: option.color }}
                />
              )}
              {option.icon}
              <span className="text-sm truncate">{option.label}</span>
            </div>
          ))}
        </div>
        
        {/* Clear button when filters active */}
        {selected.length > 0 && (
          <>
            <div className="h-px bg-border my-2" />
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs h-8 text-muted-foreground"
              onClick={() => {
                onChange([]);
                setOpen(false);
              }}
            >
              <X className="h-3 w-3 mr-1" />
              Effacer les filtres
            </Button>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
