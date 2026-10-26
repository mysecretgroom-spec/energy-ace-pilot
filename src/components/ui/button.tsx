import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-base font-semibold ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 active:scale-[0.97]",
  {
    variants: {
      variant: {
        default: "btn-glass-primary text-primary-foreground font-bold tracking-tight",
        destructive: "bg-destructive text-destructive-foreground shadow-[inset_0_1px_0_hsl(var(--glass-highlight)/0.35),0_8px_20px_-6px_hsl(var(--destructive)/0.5)] hover:bg-destructive/90",
        outline: "btn-glass text-foreground hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground shadow-[inset_0_1px_0_hsl(var(--glass-highlight)/0.6),0_6px_16px_-6px_hsl(var(--secondary)/0.7)] hover:brightness-105",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-12 px-5 py-3 [&_svg]:size-5",
        sm: "h-11 rounded-xl px-4 text-sm [&_svg]:size-4",
        lg: "h-14 rounded-xl px-8 text-lg [&_svg]:size-5",
        icon: "h-12 w-12 [&_svg]:size-5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
