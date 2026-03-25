import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold transition-[background-color,border-color,color,box-shadow] focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground shadow-[0_10px_24px_-24px_hsl(var(--primary)/0.35)] hover:bg-primary/90",
        secondary:
          "border-border/60 bg-secondary/84 text-secondary-foreground shadow-[0_10px_24px_-24px_hsl(var(--app-shadow-deep)/0.18)] hover:bg-secondary",
        destructive:
          "border-destructive/20 bg-destructive/10 text-destructive hover:bg-destructive/15",
        outline: "border-border/70 bg-background/90 text-foreground shadow-[0_10px_24px_-24px_hsl(var(--app-shadow-deep)/0.12)]",
        success:
          "border-[hsl(var(--app-success)/0.22)] bg-[hsl(var(--app-success)/0.12)] text-[hsl(var(--app-success))]",
        warning:
          "border-[hsl(var(--app-warning)/0.22)] bg-[hsl(var(--app-warning)/0.12)] text-[hsl(var(--app-warning))]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
