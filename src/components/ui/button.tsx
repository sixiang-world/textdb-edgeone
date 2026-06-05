import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-[0_3px_0_rgba(0,0,0,0.2)] hover:shadow-[inset_0_2px_3px_rgba(0,0,0,0.18)] hover:translate-y-px active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.25)] active:translate-y-[2px] border-primary/90",
        // NOTE: --color-border 未在 CSS 中定义，shadow-[0_3px_0_var(--color-border)] 实际不生效。
        //        当前有意保留此状态：outline 按钮呈现扁平效果，符合整体极简线条风格。
        //        如需恢复 3D 阴影，在 src/index.css @theme inline 中添加 --color-border 定义即可。
        outline:
          "border-border bg-background hover:shadow-[inset_0_2px_3px_rgba(0,0,0,0.1)] hover:translate-y-px active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.18)] active:translate-y-[2px] hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground shadow-[0_3px_0_rgba(0,0,0,0.14)] hover:shadow-[inset_0_2px_3px_rgba(0,0,0,0.14)] hover:translate-y-px active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.2)] active:translate-y-[2px] hover:bg-secondary/80 aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        ghost:
          "shadow-none hover:bg-muted hover:text-foreground hover:shadow-[inset_0_1px_2px_rgba(0,0,0,0.06)] active:shadow-[inset_0_2px_3px_rgba(0,0,0,0.12)] aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50",
        destructive:
          "bg-destructive/10 text-destructive shadow-[0_3px_0_rgba(0,0,0,0.12)] hover:shadow-[inset_0_2px_3px_rgba(0,0,0,0.14)] hover:translate-y-px active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.2)] active:translate-y-[2px] hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
        link: "text-primary underline-offset-4 hover:underline shadow-none",
      },
      size: {
        default:
          "h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        icon: "size-8",
        "icon-xs":
          "size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
