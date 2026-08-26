import type { ButtonHTMLAttributes } from "react";

type Variant = "default" | "outline" | "ghost";
type Size = "default" | "sm" | "icon";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const variantClasses: Record<Variant, string> = {
  default: "bg-[#D4AF37] text-black hover:bg-[#B8962E]",
  outline: "border border-white/20 text-white hover:bg-white/10 bg-transparent",
  ghost: "text-white hover:bg-white/10 bg-transparent",
};

const sizeClasses: Record<Size, string> = {
  default: "px-4 py-2 text-sm",
  sm: "px-2.5 py-1 text-xs",
  icon: "p-2",
};

export function Button({ variant = "default", size = "default", className = "", ...rest }: Props) {
  return (
    <button
      className={`inline-flex items-center justify-center rounded-md font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...rest}
    />
  );
}
