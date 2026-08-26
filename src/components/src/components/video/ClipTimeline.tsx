import { useEffect, useRef, useState } from "react";
import { GripVertical, Trash2 } from "lucide-react";
import type { VideoClip } from "@/lib/video/types";

// Escala fixa da linha do tempo (pixels por segundo). Clipes maiores ficam
// visualmente mais largos, proporcional à duração já cortada (end - start).
const PX_PER_SEC = 50;
const MIN_LEN = 0.3; // duração mínima que um clipe pode ter após cortar

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

interface ClipTimelineProps {
  clips: VideoClip[];
  activeIndex: number;
  time: number;
  onSelect: (i: number) => void;
  onSeek: (sec: number) => void;
  onReorder: (from: number, to: number) => void;
  onTrim: (index: number, patch: Partial<Pick<VideoClip, "start" | "end">>) => void;
  onRemove: (index: number) => void;
  onDropFiles: (files: FileList) => void;
}

/**
 * Linha do tempo visual estilo CapCut para o Studio Pro:
 * - cada clipe aparece como um bloco com miniatura, proporcional à duração
 * - arraste o bloco pelo "grip" para reordenar os clipes
 * - arraste as bordas esquerda/direita do bloco para cortar início/fim
 * - arraste um arquivo de vídeo do computador para cima da área pra adicionar
 * - clique no bloco para selecionar aquele clipe e posicionar a reprodução
 *
 * Observação importante (limite conhecido): a pré-visualização continua
 * tocando UM clipe por vez (o "ativo") — não existe ainda reprodução
 * contínua emendando todos os clipes na prévia, isso exigiria remontar o
 * player por completo. Esta timeline é sobre organizar/cortar/reordenar
 * os clipes; a costura de verdade entre eles acontece na exportação.
 */
export function ClipTimeline({
  clips,
  activeIndex,
  time,
  onSelect,
  onSeek,
  onReorder,
  onTrim,
  onRemove,
  onDropFiles,
}: ClipTimelineProps) {
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [isFileOver, setIsFileOver] = useState(false);
  const trimming = useRef<{ index: number; edge: "start" | "end"; startX: number; original: number } | null>(null);

  // Gera uma miniatura (1 frame) por clipe, uma única vez, para dar a
  // sensação de "filminho" dentro do bloco (igual ao CapCut).
  useEffect(() => {
    clips.forEach((c) => {
      if (thumbs[c.id]) return;
      const v = document.createElement("video");
      v.crossOrigin = "anonymous";
      v.preload = "auto";
      v.muted = true;
      v.src = c.url;
      const capture = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = 80;
          canvas.height = 142;
          const ctx = canvas.getContext("2d");
          if (!ctx) return;
          ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
          setThumbs((t) => ({ ...t, [c.id]: canvas.toDataURL("image/jpeg", 0.6) }));
        } catch {
          // Se o navegador não deixar capturar o frame por algum motivo,
          // seguimos sem miniatura — o bloco continua funcional mesmo assim.
        }
      };
      v.addEventListener("loadeddata", () => {
        v.currentTime = Math.min(0.15, (c.duration || 0) / 2 || 0);
      });
      v.addEventListener("seeked", capture, { once: true });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clips.map((c) => c.id).join(",")]);

  const startTrim = (index: number, edge: "start" | "end") => (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const c = clips[index];
    if (!c) return;
    trimming.current = { index, edge, startX: e.clientX, original: edge === "start" ? c.start : c.end };
    const move = (ev: PointerEvent) => {
      const st = trimming.current;
      if (!st) return;
      const clip = clips[st.index];
      if (!clip) return;
      const deltaSec = (ev.clientX - st.startX) / PX_PER_SEC;
      if (st.edge === "start") {
        onTrim(st.index, { start: clamp(st.original + deltaSec, 0, clip.end - MIN_LEN) });
      } else {
        onTrim(st.index, { end: clamp(st.original + deltaSec, clip.start + MIN_LEN, clip.duration) });
      }
    };
    const up = () => {
      trimming.current = null;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <div
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("Files")) {
          e.preventDefault();
          setIsFileOver(true);
        }
      }}
      onDragLeave={() => setIsFileOver(false)}
      onDrop={(e) => {
        if (e.dataTransfer.files?.length) {
          e.preventDefault();
          setIsFileOver(false);
          onDropFiles(e.dataTransfer.files);
        }
      }}
      className={`rounded-lg border p-2 transition-colors ${
        isFileOver ? "border-[#D4AF37] bg-[#D4AF37]/5" : "border-white/10"
      }`}
    >
      <div className="flex items-center justify-between mb-1.5 gap-2 flex-wrap">
        <span className="text-[10px] uppercase tracking-widest text-white/50">Linha do tempo</span>
        <span className="text-[10px] text-white/30">
          Arraste um vídeo aqui para adicionar · segure o ⠿ para reordenar · arraste as bordas para cortar
        </span>
      </div>

      {!clips.length ? (
        <div className="h-16 flex items-center justify-center text-xs text-white/30 border border-dashed border-white/15 rounded">
          Nenhum vídeo ainda — arraste um arquivo aqui ou use "Adicionar vídeos"
        </div>
      ) : (
        <div className="flex gap-1 overflow-x-auto pb-1">
          {clips.map((c, i) => {
            const width = Math.max(56, (c.end - c.start) * PX_PER_SEC);
            const isDragTarget = overIndex === i && dragIndex !== null && dragIndex !== i;
            return (
              <div
                key={c.id}
                onDragOver={(e) => {
                  if (dragIndex !== null) {
                    e.preventDefault();
                    setOverIndex(i);
                  }
                }}
                onDrop={(e) => {
                  if (dragIndex !== null) {
                    e.preventDefault();
                    if (dragIndex !== i) onReorder(dragIndex, i);
                  }
                  setDragIndex(null);
                  setOverIndex(null);
                }}
                className={`relative shrink-0 h-16 rounded overflow-hidden border-2 bg-black ${
                  i === activeIndex ? "border-[#D4AF37]" : isDragTarget ? "border-[#D4AF37]/50" : "border-white/10"
                }`}
                style={{ width }}
              >
                {thumbs[c.id] && (
                  <div
                    className="absolute inset-0 opacity-90"
                    style={{
                      backgroundImage: `url(${thumbs[c.id]})`,
                      backgroundRepeat: "repeat-x",
                      backgroundSize: "auto 100%",
                    }}
                  />
                )}
                {/* Área clicável: seleciona o clipe e posiciona a reprodução no ponto clicado */}
                <div
                  className="absolute inset-0 cursor-pointer"
                  onClick={(e) => {
                    onSelect(i);
                    const rect = e.currentTarget.getBoundingClientRect();
                    const relSec = c.start + (e.clientX - rect.left) / PX_PER_SEC;
                    onSeek(clamp(relSec, c.start, c.end));
                  }}
                />
                {/* Alça para arrastar e reordenar */}
                <div
                  draggable
                  onDragStart={(e) => {
                    setDragIndex(i);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onDragEnd={() => {
                    setDragIndex(null);
                    setOverIndex(null);
                  }}
                  className="absolute top-0.5 left-1/2 -translate-x-1/2 cursor-grab active:cursor-grabbing bg-black/60 rounded px-1 py-0.5 z-10"
                  title="Arrastar para reordenar"
                >
                  <GripVertical className="h-3 w-3 text-white/80" />
                </div>
                {/* Alças de corte (início/fim) */}
                <div
                  onPointerDown={startTrim(i, "start")}
                  className="absolute left-0 top-0 h-full w-2 cursor-ew-resize bg-white/30 hover:bg-[#D4AF37] z-10"
                  title="Arrastar para cortar o início"
                />
                <div
                  onPointerDown={startTrim(i, "end")}
                  className="absolute right-0 top-0 h-full w-2 cursor-ew-resize bg-white/30 hover:bg-[#D4AF37] z-10"
                  title="Arrastar para cortar o fim"
                />
                {/* Cursor de reprodução, só no clipe ativo */}
                {i === activeIndex && (
                  <div
                    className="absolute top-0 h-full w-0.5 bg-red-500 z-10 pointer-events-none"
                    style={{ left: clamp((time - c.start) * PX_PER_SEC, 0, width) }}
                  />
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(i);
                  }}
                  className="absolute bottom-0.5 right-0.5 bg-black/60 rounded p-0.5 z-10 hover:bg-red-900/60"
                  title="Remover clipe"
                >
                  <Trash2 className="h-3 w-3 text-white/70" />
                </button>
                <div className="absolute bottom-0.5 left-1 text-[9px] text-white/90 truncate max-w-[70%] z-10 drop-shadow">
                  {i + 1}. {c.name}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
