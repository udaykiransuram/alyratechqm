import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex min-w-0 max-w-full items-center justify-center gap-2 rounded-[var(--app-radius-md)] text-center text-sm font-semibold leading-5 tracking-[0em] ring-offset-background transition-[background-color,border-color,color,box-shadow,transform,opacity] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-45 disabled:shadow-none aria-busy:pointer-events-none aria-busy:cursor-wait aria-busy:opacity-70 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "border border-[hsl(var(--primary)/0.14)] bg-primary text-primary-foreground shadow-[0_20px_34px_-24px_hsl(var(--primary)/0.38),inset_0_1px_0_hsl(var(--background)/0.16)] hover:-translate-y-px hover:bg-primary/95 hover:shadow-[0_24px_38px_-24px_hsl(var(--primary)/0.42),inset_0_1px_0_hsl(var(--background)/0.18)] active:translate-y-0",
        primary:
          "border border-[hsl(var(--primary)/0.14)] bg-primary text-primary-foreground shadow-[0_20px_34px_-24px_hsl(var(--primary)/0.38),inset_0_1px_0_hsl(var(--background)/0.16)] hover:-translate-y-px hover:bg-primary/95 hover:shadow-[0_24px_38px_-24px_hsl(var(--primary)/0.42),inset_0_1px_0_hsl(var(--background)/0.18)] active:translate-y-0",
        destructive:
          "border border-[hsl(var(--destructive)/0.16)] bg-destructive text-destructive-foreground shadow-[0_20px_34px_-24px_hsl(var(--destructive)/0.28),inset_0_1px_0_hsl(var(--background)/0.16)] hover:-translate-y-px hover:bg-destructive/95 hover:shadow-[0_24px_38px_-24px_hsl(var(--destructive)/0.34),inset_0_1px_0_hsl(var(--background)/0.18)] active:translate-y-0",
        outline:
          "border border-border/78 bg-[hsl(var(--app-surface-1)/0.98)] text-foreground shadow-[0_14px_24px_-24px_hsl(var(--app-shadow-deep)/0.08),inset_0_1px_0_hsl(var(--app-surface-1)/0.82)] hover:-translate-y-px hover:border-primary/20 hover:bg-[hsl(var(--app-surface-2)/0.92)] hover:text-foreground hover:shadow-[0_18px_28px_-24px_hsl(var(--app-shadow-deep)/0.12),inset_0_1px_0_hsl(var(--app-surface-1)/0.86)] active:translate-y-0",
        secondary:
          "border border-border/76 bg-[hsl(var(--app-surface-1)/0.98)] text-foreground shadow-[0_14px_24px_-24px_hsl(var(--app-shadow-deep)/0.08),inset_0_1px_0_hsl(var(--app-surface-1)/0.82)] hover:-translate-y-px hover:border-primary/18 hover:bg-[hsl(var(--app-surface-2)/0.88)] hover:shadow-[0_18px_28px_-24px_hsl(var(--app-shadow-deep)/0.12),inset_0_1px_0_hsl(var(--app-surface-1)/0.86)] active:translate-y-0",
        ghost:
          "text-foreground/72 shadow-none hover:bg-[hsl(var(--app-surface-2)/0.72)] hover:text-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        plain: "text-muted-foreground shadow-none hover:text-foreground",
      },
      size: {
        default: "min-h-11 px-4.5 py-2.5",
        md: "min-h-11 px-4.5 py-2.5",
        sm: "min-h-9 px-3.5 py-2 text-[13px]",
        lg: "min-h-12 px-5.5 py-3 text-sm",
        xl: "min-h-12 px-6 py-3 text-[15px]",
        hero: "min-h-14 px-7 py-3.5 text-[15px]",
        icon: "h-11 w-11 shrink-0 p-0",
        "icon-sm": "h-9 w-9 shrink-0 p-0",
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
