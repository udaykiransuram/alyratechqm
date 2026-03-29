import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold transition-[background-color,border-color,color,box-shadow] focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "app-status-badge app-status-badge-info",
        info:
          "app-status-badge app-status-badge-info",
        secondary:
          "app-status-badge app-status-badge-neutral",
        neutral:
          "app-status-badge app-status-badge-neutral",
        destructive:
          "app-status-badge app-status-badge-danger",
        danger:
          "app-status-badge app-status-badge-danger",
        outline:
          "app-status-badge border-border/78 bg-[hsl(var(--app-surface-1)/0.98)] text-foreground/84",
        success:
          "app-status-badge app-status-badge-success",
        warning:
          "app-status-badge app-status-badge-warning",
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
