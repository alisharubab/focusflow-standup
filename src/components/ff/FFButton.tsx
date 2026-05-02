import { ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "ghost" | "danger" | "highlight";
type Size = "sm" | "md" | "lg";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const FFButton = forwardRef<HTMLButtonElement, Props>(
  ({ variant = "primary", size = "md", loading, className, children, disabled, ...rest }, ref) => {
    const base =
      "inline-flex items-center justify-center gap-2 font-medium rounded-md transition-all duration-150 active:scale-[0.97] disabled:opacity-40 disabled:active:scale-100 disabled:cursor-not-allowed select-none whitespace-nowrap";
    const variants: Record<Variant, string> = {
      primary:
        "bg-primary text-primary-foreground shadow-ff-sm hover:bg-[hsl(var(--primary-hover))]",
      highlight:
        "bg-highlight text-white shadow-ff-sm hover:brightness-110",
      ghost:
        "bg-transparent text-foreground border border-border hover:bg-bg-secondary",
      danger:
        "bg-destructive-light text-destructive border border-[hsl(0_60%_85%)] hover:brightness-95",
    };
    const sizes: Record<Size, string> = {
      sm: "h-8 px-3 text-[13px]",
      md: "h-10 px-4 text-sm",
      lg: "h-12 px-5 text-[15px]",
    };
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(base, variants[variant], sizes[size], className)}
        {...rest}
      >
        {loading && (
          <span className="inline-block w-3.5 h-3.5 border-2 border-current border-r-transparent rounded-full animate-spin" />
        )}
        {children}
      </button>
    );
  },
);
FFButton.displayName = "FFButton";
export default FFButton;
