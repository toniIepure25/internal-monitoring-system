"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "xs" | "sm" | "md";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const variants: Record<Variant, string> = {
  primary:   "bg-accent text-accentFg hover:bg-accent/90 active:bg-accent/80",
  secondary: "border border-border bg-transparent text-fg hover:bg-surfaceRaised hover:border-borderStrong",
  ghost:     "text-fgMuted hover:bg-surfaceRaised hover:text-fg",
  danger:    "bg-danger/10 text-danger hover:bg-danger/20",
};

const sizes: Record<Size, string> = {
  xs: "h-7 rounded px-2 text-[11px] gap-1",
  sm: "h-8 rounded-md px-2.5 text-xs gap-1.5",
  md: "h-9 rounded-md px-3.5 text-[13px] gap-2",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "sm", loading, className, children, disabled, ...props }, ref) => (
    <motion.div
      whileHover={disabled || loading ? undefined : { scale: 1.015 }}
      whileTap={disabled || loading ? undefined : { scale: 0.97 }}
      transition={{ duration: 0.15 }}
      className="inline-flex"
    >
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          "inline-flex items-center justify-center font-medium transition-colors disabled:pointer-events-none disabled:opacity-50",
          variants[variant],
          sizes[size],
          className,
        )}
        {...props}
      >
        {loading && (
          <span className="h-3 w-3 animate-spin rounded-full border-[1.5px] border-current/25 border-t-current" />
        )}
        {children}
      </button>
    </motion.div>
  ),
);

Button.displayName = "Button";
