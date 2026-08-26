// Tipo de sticker/emoji animado, compartilhado entre o editor simples,
// o Studio Pro e o pipeline de exportação (ffmpeg).
export type StickerAnim = "none" | "bounce" | "spin";
export interface StickerOverlay {
  id: string;
  emoji: string;
  start: number;
  end: number;
  x: number; // 0-100 (%)
  y: number; // 0-100 (%)
  size: number; // px de referência (lado do sticker)
  anim: StickerAnim;
}

export const STICKER_PALETTE: string[] = [
  "🔥", "⭐", "💯", "✅", "❤️", "🎉", "⚡", "🚀", "👍", "😂", "😱", "💥", "🎯", "💰", "🛒",
];
