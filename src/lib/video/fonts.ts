// Fontes selecionáveis para textos e legendas.
// URLs apontam para o repositório público google/fonts via jsDelivr (CDN
// estável, gratuito, sem chave de API) — usadas tanto no preview (via
// @font-face injetado no navegador) quanto na exportação real (o arquivo
// .ttf é baixado e passado para o ffmpeg como fontfile= no drawtext).
export interface FontOption {
  key: string;
  label: string;
  family: string;
  url: string | null; // null = fonte padrão do navegador/sistema
}

const GF = "https://cdn.jsdelivr.net/gh/google/fonts@main";

export const FONT_OPTIONS: FontOption[] = [
  { key: "default", label: "Padrão", family: "inherit", url: null },
  { key: "anton", label: "Anton (Impacto)", family: "VE-Anton", url: `${GF}/ofl/anton/Anton-Regular.ttf` },
  { key: "poppins", label: "Poppins (Moderna)", family: "VE-Poppins", url: `${GF}/ofl/poppins/Poppins-Bold.ttf` },
  { key: "bebas", label: "Bebas Neue (Condensada)", family: "VE-Bebas", url: `${GF}/ofl/bebasneue/BebasNeue-Regular.ttf` },
  { key: "bangers", label: "Bangers (Quadrinho)", family: "VE-Bangers", url: `${GF}/ofl/bangers/Bangers-Regular.ttf` },
  { key: "marker", label: "Permanent Marker (Manuscrita)", family: "VE-Marker", url: `${GF}/apache/permanentmarker/PermanentMarker-Regular.ttf` },
];

function findFont(key?: string): FontOption {
  return FONT_OPTIONS.find((f) => f.key === key) ?? FONT_OPTIONS[0]!;
}

/** CSS font-family a usar no preview (HTML/CSS) para a fonte escolhida. */
export function fontFamilyFor(key?: string): string {
  const f = findFont(key);
  return f.family === "inherit" ? "inherit" : `'${f.family}', sans-serif`;
}

const injectedStyles = new Set<string>();
/** Injeta um @font-face no <head> para a fonte poder ser usada no preview do navegador. Idempotente. */
export function ensureFontLoaded(key?: string) {
  if (typeof document === "undefined") return;
  const f = findFont(key);
  if (!f.url || injectedStyles.has(f.key)) return;
  injectedStyles.add(f.key);
  const style = document.createElement("style");
  style.setAttribute("data-ve-font", f.key);
  style.textContent = `@font-face{font-family:'${f.family}';src:url('${f.url}') format('truetype');font-display:swap;}`;
  document.head.appendChild(style);
}

// ---------------------------------------------------------------------------
// Lado ffmpeg: baixa o .ttf e escreve no sistema de arquivos virtual do
// ffmpeg.wasm, retornando o nome de arquivo para usar em `fontfile=`.
// Resultado é cacheado em memória (mesma fonte não é baixada duas vezes por sessão).
// ---------------------------------------------------------------------------
const fontFileCache = new Map<string, string>();

export async function ensureFontFile(
  ffmpegWrite: (name: string, data: Uint8Array) => Promise<unknown>,
  key?: string
): Promise<string | null> {
  const f = findFont(key);
  if (!f.url) return null;
  const cached = fontFileCache.get(f.key);
  if (cached) return cached;
  try {
    const { fetchFile } = await import("@ffmpeg/util");
    const data = await fetchFile(f.url);
    const filename = `font-${f.key}.ttf`;
    await ffmpegWrite(filename, data);
    fontFileCache.set(f.key, filename);
    return filename;
  } catch {
    // Se o download da fonte falhar (sem internet, CDN fora do ar, etc.),
    // seguimos sem fontfile — o texto ainda é gravado, só que com a fonte
    // padrão do ffmpeg, em vez de travar a exportação inteira por causa disso.
    return null;
  }
}
