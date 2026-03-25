import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--app-radius-md)] text-sm font-semibold ring-offset-background transition-[background-color,border-color,color,box-shadow,transform,opacity] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none aria-busy:pointer-events-none aria-busy:opacity-70 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-[0_18px_32px_-20px_hsl(var(--primary)/0.48)] hover:-translate-y-px hover:bg-primary/95 hover:shadow-[0_24px_36px_-22px_hsl(var(--primary)/0.55)]",
        primary:
          "bg-primary text-primary-foreground shadow-[0_18px_32px_-20px_hsl(var(--primary)/0.48)] hover:-translate-y-px hover:bg-primary/95 hover:shadow-[0_24px_36px_-22px_hsl(var(--primary)/0.55)]",
        destructive:
          "bg-destructive text-destructive-foreground shadow-[0_18px_32px_-22px_hsl(var(--destructive)/0.36)] hover:-translate-y-px hover:bg-destructive/95 hover:shadow-[0_24px_36px_-22px_hsl(var(--destructive)/0.44)]",
        outline:
          "border border-input bg-background/96 text-foreground shadow-[0_10px_24px_-24px_hsl(var(--app-shadow-deep)/0.22)] hover:-translate-y-px hover:border-primary/20 hover:bg-accent/60 hover:text-accent-foreground hover:shadow-[0_16px_30px_-24px_hsl(var(--app-shadow-deep)/0.26)]",
        secondary:
          "border border-border/60 bg-secondary/78 text-secondary-foreground shadow-[0_10px_24px_-24px_hsl(var(--app-shadow-deep)/0.18)] hover:-translate-y-px hover:border-primary/16 hover:bg-secondary/96 hover:shadow-[0_16px_30px_-24px_hsl(var(--app-shadow-deep)/0.24)]",
        ghost:
          "text-foreground/80 shadow-none hover:bg-accent/72 hover:text-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        plain: "text-foreground shadow-none hover:text-primary",
      },
      size: {
        default: "h-10 px-4 py-2",
        md: "h-10 px-4 py-2",
        sm: "h-9 px-3 text-[13px]",
        lg: "h-11 px-5 text-sm",
        xl: "h-12 px-6 text-[15px]",
        icon: "h-10 w-10",
        "icon-sm": "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, type, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        // Default type to "button" unless explicitly set (and only for native button)
        type={type ?? (!asChild ? "button" : undefined)}
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
