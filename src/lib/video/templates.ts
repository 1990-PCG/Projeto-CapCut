// Templates prontos: combinam num clique um filtro de cor, uma fonte,
// um estilo de legenda e (quando aplicável) um efeito de movimento —
// para o editor simples (VideoEditor) e para o Studio Pro (ProVideoEditor).
export interface VideoTemplate {
  key: string;
  label: string;
  description: string;
  editor: {
    filter: "none" | "vivid" | "cinema" | "bw" | "vintage" | "cool" | "warm";
    font: string;
    caption: { background: boolean; color: string; y: number; size: number };
    motion?: { key: "zoomIn" | "zoomOut" | "kenburns" | "pulse" | "shake"; intensity: number };
  };
  project: {
    filter: "none" | "vivid" | "cinema" | "bw" | "vintage" | "cool" | "warm";
    font: string;
    transition: "none" | "fade" | "slide" | "wipe";
    motionTransfer: "none" | "slow-zoom" | "ken-burns";
  };
}

export const VIDEO_TEMPLATES: VideoTemplate[] = [
  {
    key: "viral-tiktok",
    label: "Viral TikTok",
    description: "Cores vibrantes, zoom contínuo e legenda grande em caixa alta.",
    editor: { filter: "vivid", font: "anton", caption: { background: true, color: "#ffffff", y: 82, size: 30 }, motion: { key: "zoomIn", intensity: 40 } },
    project: { filter: "vivid", font: "anton", transition: "fade", motionTransfer: "slow-zoom" },
  },
  {
    key: "depoimento",
    label: "Depoimento / UGC",
    description: "Visual limpo e neutro, com cara de vídeo caseiro autêntico.",
    editor: { filter: "none", font: "poppins", caption: { background: true, color: "#ffffff", y: 82, size: 24 } },
    project: { filter: "none", font: "poppins", transition: "none", motionTransfer: "none" },
  },
  {
    key: "promo-forte",
    label: "Promoção / Oferta",
    description: "Alto contraste e tipografia enorme — pede o clique.",
    editor: { filter: "warm", font: "bebas", caption: { background: true, color: "#FFD400", y: 78, size: 34 }, motion: { key: "pulse", intensity: 45 } },
    project: { filter: "warm", font: "bebas", transition: "wipe", motionTransfer: "ken-burns" },
  },
  {
    key: "meme-engracado",
    label: "Engraçado / Meme",
    description: "Tipografia de quadrinho e energia de vídeo bem-humorado.",
    editor: { filter: "vintage", font: "bangers", caption: { background: true, color: "#ffffff", y: 15, size: 32 }, motion: { key: "shake", intensity: 30 } },
    project: { filter: "vintage", font: "bangers", transition: "slide", motionTransfer: "none" },
  },
  {
    key: "cinematografico",
    label: "Cinematográfico",
    description: "Tom sério e elegante — bom para produtos premium.",
    editor: { filter: "cinema", font: "default", caption: { background: false, color: "#ffffff", y: 88, size: 22 }, motion: { key: "kenburns", intensity: 30 } },
    project: { filter: "cinema", font: "default", transition: "fade", motionTransfer: "ken-burns" },
  },
];
