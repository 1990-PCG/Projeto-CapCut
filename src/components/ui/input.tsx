import type { InputHTMLAttributes } from "react";

export function Input({ className = "", ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`w-full rounded-md border border-white/20 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#D4AF37]/60 ${className}`}
      {...rest}
    />
  );
}
