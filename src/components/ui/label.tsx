import type { LabelHTMLAttributes } from "react";

export function Label({ className = "", ...rest }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={`block text-xs text-white/70 mb-1 ${className}`} {...rest} />;
}
