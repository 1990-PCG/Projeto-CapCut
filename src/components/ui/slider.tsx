interface Props {
  value: number[];
  min?: number;
  max?: number;
  step?: number;
  onValueChange: (v: number[]) => void;
  className?: string;
}

/** Versão leve do Slider (shadcn/Radix usa múltiplas alças; aqui só precisamos de uma). */
export function Slider({ value, min = 0, max = 100, step = 1, onValueChange, className = "" }: Props) {
  return (
    <input
      type="range"
      className={`w-full accent-[#D4AF37] ${className}`}
      value={value[0] ?? 0}
      min={min}
      max={max}
      step={step}
      onChange={(e) => onValueChange([Number(e.target.value)])}
    />
  );
}
