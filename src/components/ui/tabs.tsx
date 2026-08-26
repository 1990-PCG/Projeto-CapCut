import { createContext, useContext, useState, type ReactNode } from "react";

interface Ctx {
  value: string;
  setValue: (v: string) => void;
}
const TabsCtx = createContext<Ctx | null>(null);

export function Tabs({ defaultValue, children }: { defaultValue: string; children: ReactNode }) {
  const [value, setValue] = useState(defaultValue);
  return <TabsCtx.Provider value={{ value, setValue }}>{children}</TabsCtx.Provider>;
}

export function TabsList({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`inline-flex rounded-md bg-black/40 p-1 ${className}`}>{children}</div>;
}

export function TabsTrigger({ value, children }: { value: string; children: ReactNode }) {
  const ctx = useContext(TabsCtx)!;
  const active = ctx.value === value;
  return (
    <button
      type="button"
      onClick={() => ctx.setValue(value)}
      className={`flex-1 rounded px-2 py-1.5 text-xs transition-colors ${
        active ? "bg-[#D4AF37] text-black" : "text-white/70 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

export function TabsContent({
  value,
  children,
  className = "",
}: {
  value: string;
  children: ReactNode;
  className?: string;
}) {
  const ctx = useContext(TabsCtx)!;
  if (ctx.value !== value) return null;
  return <div className={`mt-3 ${className}`}>{children}</div>;
}
