import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

interface Ctx {
  value: string;
  onValueChange: (v: string) => void;
  open: boolean;
  setOpen: (b: boolean) => void;
  registerLabel: (value: string, label: ReactNode) => void;
  labels: Record<string, ReactNode>;
}
const SelectCtx = createContext<Ctx | null>(null);

/**
 * Versão leve do shadcn/Radix Select. Mantém a mesma composição
 * (Select / SelectTrigger / SelectValue / SelectContent / SelectItem)
 * para que ProVideoEditor.tsx e ClipTimeline.tsx não precisem de nenhuma
 * alteração — só o "motor" por trás é mais simples (sem Radix).
 */
export function Select({
  value,
  onValueChange,
  children,
}: {
  value: string;
  onValueChange: (v: string) => void;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [labels, setLabels] = useState<Record<string, ReactNode>>({});
  const registerLabel = (v: string, label: ReactNode) => setLabels((l) => (l[v] === label ? l : { ...l, [v]: label }));
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);
  return (
    <SelectCtx.Provider value={{ value, onValueChange, open, setOpen, registerLabel, labels }}>
      <div ref={ref} className="relative">
        {children}
      </div>
    </SelectCtx.Provider>
  );
}

export function SelectTrigger({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ctx = useContext(SelectCtx)!;
  return (
    <button
      type="button"
      onClick={() => ctx.setOpen(!ctx.open)}
      className={`w-full flex items-center justify-between rounded-md border border-white/20 bg-black/40 px-3 py-2 text-sm text-white ${className}`}
    >
      {children}
      <ChevronDown className="h-3.5 w-3.5 opacity-60" />
    </button>
  );
}

export function SelectValue({ placeholder }: { placeholder?: string }) {
  const ctx = useContext(SelectCtx)!;
  return <span className="truncate">{ctx.labels[ctx.value] ?? placeholder ?? ctx.value}</span>;
}

export function SelectContent({ children }: { children: ReactNode }) {
  const ctx = useContext(SelectCtx)!;
  // Mantemos os itens sempre "montados" (só escondidos via CSS) para que cada
  // SelectItem consiga registrar seu label no contexto mesmo fechado.
  return (
    <div
      className={`absolute z-20 mt-1 w-full rounded-md border border-white/15 bg-[#151515] shadow-lg max-h-64 overflow-y-auto ${
        ctx.open ? "block" : "hidden"
      }`}
    >
      {children}
    </div>
  );
}

export function SelectItem({ value, children }: { value: string; children: ReactNode }) {
  const ctx = useContext(SelectCtx)!;
  useEffect(() => {
    ctx.registerLabel(value, children);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, children]);
  return (
    <div
      onClick={() => {
        ctx.onValueChange(value);
        ctx.setOpen(false);
      }}
      className={`px-3 py-2 text-sm cursor-pointer hover:bg-white/10 ${
        ctx.value === value ? "text-[#D4AF37]" : "text-white"
      }`}
    >
      {children}
    </div>
  );
}
