import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";
import type { VideoProjectSettings, ProjectText, TransitionKey } from "@/lib/video/types";
import type { StickerOverlay } from "@/lib/video/overlays";
import { ensureFontFile } from "@/lib/video/fonts";

// ---------------------------------------------------------------------------
// Este arquivo é uma cópia adaptada de src/lib/video/export.ts do app
// principal (videotiktokshop). A lógica de ffmpeg (corte, filtros de cor,
// texto, stickers, transições, mixagem de áudio) é EXATAMENTE a mesma —
// só removemos as partes que dependiam do Supabase (log em banco + upload
// pra Storage) e trocamos por um download direto no navegador, já que este
// projeto é um laboratório isolado, sem login/banco de dados.
// ---------------------------------------------------------------------------

let ffmpeg: FFmpeg | null = null;
let loading: Promise<FFmpeg> | null = null;
async function getFFmpeg(onProgress?: (p: number) => void) {
  if (ffmpeg?.loaded) return ffmpeg;
  if (loading) return loading;
  loading = (async () => {
    const x = new FFmpeg();
    x.on("progress", ({ progress }) => onProgress?.(Math.max(0, Math.min(1, progress))));
    const b = "https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd";
    await x.load({
      coreURL: await toBlobURL(`${b}/ffmpeg-core.js`, `text/javascript`),
      wasmURL: await toBlobURL(`${b}/ffmpeg-core.wasm`, `application/wasm`),
    });
    ffmpeg = x;
    return x;
  })();
  try {
    return await loading;
  } finally {
    loading = null;
  }
}

const esc = (t: string) => t.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/:/g, "\\:").replace(/,/g, "\\,");

function colorFilterChain(
  filter: "none" | "vivid" | "cinema" | "bw" | "vintage" | "cool" | "warm" = "none",
  brightness = 100,
  contrast = 100,
  saturation = 100
): string[] {
  const out: string[] = [];
  const b = (brightness - 100) / 200;
  const c = Math.max(0.01, contrast / 100);
  const s = Math.max(0, saturation / 100);
  if (brightness !== 100 || contrast !== 100 || saturation !== 100) {
    out.push(`eq=brightness=${b.toFixed(3)}:contrast=${c.toFixed(3)}:saturation=${s.toFixed(3)}`);
  }
  switch (filter) {
    case "vivid":
      out.push("eq=contrast=1.1:saturation=1.5");
      break;
    case "cinema":
      out.push("eq=contrast=1.2:saturation=0.9");
      break;
    case "bw":
      out.push("hue=s=0");
      break;
    case "vintage":
      out.push("colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131:0", "eq=contrast=0.95:saturation=1.2");
      break;
    case "cool":
      out.push("hue=h=-12", "eq=saturation=1.1");
      break;
    case "warm":
      out.push("hue=h=12", "eq=saturation=1.2:brightness=0.03");
      break;
    default:
      break;
  }
  return out;
}

type FontWriter = (name: string, data: Uint8Array) => Promise<unknown>;

async function projectTextFilters(write: FontWriter, texts: ProjectText[] = []): Promise<string[]> {
  const out: string[] = [];
  for (const t of texts) {
    const st = Math.max(0, t.start),
      en = Math.max(st, t.end);
    const bg = t.background ? ":box=1:boxcolor=black@0.55:boxborderw=10" : "";
    const fontFile = await ensureFontFile(write, t.font);
    const fontPart = fontFile ? `:fontfile=${fontFile}` : "";
    out.push(
      `drawtext=text='${esc(t.text)}'${fontPart}:fontcolor=${t.color}:fontsize=${Math.max(12, t.size)}:x=(w*${Math.max(
        0,
        Math.min(100, t.x)
      )}/100)-text_w/2:y=(h*${Math.max(0, Math.min(100, t.y))}/100)-text_h/2:enable='between(t,${st},${en})':shadowcolor=black@0.9:shadowx=2:shadowy=2${bg}`
    );
  }
  return out;
}

function zoomPanFilter(motion: string | undefined, intensity: number, w: number, h: number, fps: number, duration: number): string | null {
  if (!motion || duration <= 0) return null;
  const frames = Math.max(1, Math.round(duration * fps));
  const amt = 0.12 + (Math.max(0, Math.min(100, intensity)) / 100) * 0.35;
  const rate = (amt / frames).toFixed(6);
  let z: string;
  if (motion === "zoomOut") {
    z = `if(eq(on,1),${(1 + amt).toFixed(3)},max(zoom-${rate},1))`;
  } else if (motion === "kenburns" || motion === "ken-burns") {
    z = `min(zoom+${(Number(rate) / 1.6).toFixed(6)},${(1 + amt * 0.6).toFixed(3)})`;
  } else {
    z = `min(zoom+${rate},${(1 + amt).toFixed(3)})`;
  }
  return `scale=${w * 2}:${h * 2},zoompan=z='${z}':d=${frames}:s=${w}x${h}:fps=${fps}`;
}

async function renderEmojiPng(emoji: string, px: number): Promise<Uint8Array> {
  const scale = 3;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(16, Math.round(px * scale));
  canvas.height = canvas.width;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D não disponível neste navegador.");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `${Math.round(canvas.height * 0.8)}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
  ctx.fillText(emoji, canvas.width / 2, canvas.height / 2 + canvas.height * 0.04);
  const blob: Blob = await new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Falha ao gerar imagem do sticker."))), "image/png")
  );
  return new Uint8Array(await blob.arrayBuffer());
}

interface StickerBuildResult {
  inputArgs: string[];
  parts: string[];
  videoLabel: string;
}

async function buildStickerOverlayParts(
  write: FontWriter,
  stickers: StickerOverlay[],
  baseLabel: string,
  timeOffset: number,
  startInputIndex: number
): Promise<StickerBuildResult | null> {
  if (!stickers.length) return null;
  const inputArgs: string[] = [];
  const parts: string[] = [];
  let label = baseLabel;
  for (let i = 0; i < stickers.length; i++) {
    const st = stickers[i]!;
    const png = await renderEmojiPng(st.emoji, st.size);
    const filename = `sticker${i}.png`;
    await write(filename, png);
    inputArgs.push("-i", filename);
    const inputIdx = startInputIndex + i;
    const t0 = Math.max(0, st.start - timeOffset),
      t1 = Math.max(t0, st.end - timeOffset);
    let src = `${inputIdx}:v`;
    if (st.anim === "spin") {
      parts.push(`[${inputIdx}:v]rotate='2*PI*t/1.6':c=none:ow=rotw('2*PI*t/1.6'):oh=roth('2*PI*t/1.6')[stk${i}]`);
      src = `stk${i}`;
    }
    const yExpr = st.anim === "bounce" ? `(H*${st.y}/100-h/2)+(H*0.03)*sin(2*PI*t/0.9)` : `(H*${st.y}/100-h/2)`;
    const outLabel = `ovl${i}`;
    parts.push(`[${label}][${src}]overlay=x=(W*${st.x}/100-w/2):y=${yExpr}:enable='between(t,${t0},${t1})':eval=frame[${outLabel}]`);
    label = outLabel;
  }
  return { inputArgs, parts, videoLabel: label };
}

function projectSize(s: VideoProjectSettings): [number, number] {
  const n = s.resolution === "720p" ? 720 : s.resolution === "1440p" ? 1440 : s.resolution === "2160p" ? 2160 : 1080;
  if (s.aspect === "9:16") return [Math.round(n * 9 / 16 < 720 ? 720 : n), Math.round(n * 16 / 9)];
  if (s.aspect === "1:1") return [n, n];
  return [Math.round(n * 16 / 9), n];
}

async function projectVideoFilters(write: FontWriter, s: VideoProjectSettings, w: number, h: number, duration: number): Promise<string> {
  const a = [`scale=${w}:${h}:force_original_aspect_ratio=decrease`, `pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:black`];
  a.push(...colorFilterChain(s.filter));
  if (s.motionTransfer === "slow-zoom" || s.motionTransfer === "ken-burns") {
    const zf = zoomPanFilter(s.motionTransfer, 45, w, h, s.fps, duration);
    if (zf) a.push(zf);
  }
  a.push(...(await projectTextFilters(write, s.texts)));
  return a.join(",");
}

const XFADE_NAME: Record<Exclude<TransitionKey, "none">, string> = { fade: "fade", slide: "slideleft", wipe: "wipeleft" };

/**
 * Renderiza o projeto (idêntico ao renderProjectAndUpload do app principal)
 * e, em vez de subir para o Supabase Storage, dispara o download do arquivo
 * .mp4 direto no navegador.
 */
export async function renderProjectLocally(params: { settings: VideoProjectSettings; onProgress?: (p: number) => void }) {
  const x = await getFFmpeg(params.onProgress);
  const write: FontWriter = (name, data) => x.writeFile(name, data);

  const clipDurations: number[] = [];
  for (let i = 0; i < params.settings.clips.length; i++) {
    const clip = params.settings.clips[i]!;
    await x.writeFile(`raw${i}.mp4`, await fetchFile(clip.url));
    const start = Math.max(0, clip.start || 0);
    const end = Math.max(start + 0.05, clip.end || clip.duration || start + 0.05);
    await x.exec(["-i", `raw${i}.mp4`, "-ss", String(start), "-to", String(end), "-c:v", "libx264", "-preset", "ultrafast", "-crf", "20", "-c:a", "aac", "-y", `clip${i}.mp4`]);
    clipDurations.push(end - start);
  }

  const baseDuration = clipDurations.reduce((n, d) => n + d, 0);
  const [w, h] = projectSize(params.settings);
  const useTransitions = params.settings.transition !== "none" && params.settings.clips.length > 1;
  const transitionDuration = Math.max(0.15, Math.min(2, params.settings.transitionDuration || 0.5));

  const videoInputArgs: string[] = [];
  const complexParts: string[] = [];
  let mainVideoLabel: string;
  let originalAudioLabel: string;
  let nextInputIndex: number;
  let timelineDuration = baseDuration;

  if (useTransitions) {
    for (let i = 0; i < params.settings.clips.length; i++) videoInputArgs.push("-i", `clip${i}.mp4`);
    const xfadeName = XFADE_NAME[params.settings.transition as Exclude<TransitionKey, "none">] ?? "fade";
    let cum = clipDurations[0] ?? 0;
    let label = "0:v";
    for (let i = 1; i < params.settings.clips.length; i++) {
      const offset = Math.max(0, cum - transitionDuration);
      const nextLabel = `xf${i}`;
      complexParts.push(`[${label}][${i}:v]xfade=transition=${xfadeName}:duration=${transitionDuration}:offset=${offset.toFixed(2)}[${nextLabel}]`);
      cum = cum + (clipDurations[i] ?? 0) - transitionDuration;
      label = nextLabel;
    }
    mainVideoLabel = label;
    timelineDuration = cum;
    const audioInputs = params.settings.clips.map((_, i) => `[${i}:a]`).join("");
    complexParts.push(`${audioInputs}concat=n=${params.settings.clips.length}:v=0:a=1[origaud]`);
    originalAudioLabel = "origaud";
    nextInputIndex = params.settings.clips.length;
  } else {
    videoInputArgs.push("-f", "concat", "-safe", "0", "-i", "concat.txt");
    await x.writeFile("concat.txt", params.settings.clips.map((_, i) => `file 'clip${i}.mp4'`).join("\n"));
    mainVideoLabel = "0:v";
    originalAudioLabel = "0:a";
    nextInputIndex = 1;
  }

  const vf = await projectVideoFilters(write, params.settings, w, h, timelineDuration);
  complexParts.push(`[${mainVideoLabel}]${vf}[vraw]`);
  let videoLabel = "vraw";

  const stickers = params.settings.stickers ?? [];
  const extraInputArgs: string[] = [];
  if (stickers.length) {
    const built = await buildStickerOverlayParts(write, stickers, videoLabel, 0, nextInputIndex);
    if (built) {
      extraInputArgs.push(...built.inputArgs);
      complexParts.push(...built.parts);
      videoLabel = built.videoLabel;
      nextInputIndex += stickers.length;
    }
  }

  const hasAudio = !!params.settings.audio?.url;
  const audioExtraArgs: string[] = [];
  if (hasAudio) {
    await x.writeFile("audio.ext", await fetchFile(params.settings.audio!.url));
    audioExtraArgs.push("-itsoffset", String(params.settings.audio!.offset || 0), "-i", "audio.ext");
  }
  const audioInputIndex = nextInputIndex;

  let finalAudioLabel: string;
  if (hasAudio) {
    const vol = Math.max(0, params.settings.audio!.volume ?? 1);
    const mix = !params.settings.audio!.replaceOriginal;
    if (mix) {
      complexParts.push(`[${audioInputIndex}:a]volume=${vol}[a1]`, `[${originalAudioLabel}][a1]amix=inputs=2:duration=longest:dropout_transition=0[aout]`);
    } else {
      complexParts.push(`[${audioInputIndex}:a]volume=${vol}[aout]`);
    }
    finalAudioLabel = "aout";
  } else {
    finalAudioLabel = originalAudioLabel;
  }

  const encodeArgs = ["-r", String(params.settings.fps), "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart"];
  const args = [...videoInputArgs, ...extraInputArgs, ...audioExtraArgs, "-filter_complex", complexParts.join(";"), "-map", `[${videoLabel}]`, "-map", `[${finalAudioLabel}]`, "-shortest", ...encodeArgs, "-y", "project.mp4"];
  await x.exec(args);

  let loopCount = params.settings.loopLive ? Math.max(params.settings.loopCount, Math.ceil(5400 / Math.max(1, timelineDuration))) : 1;
  if (params.settings.loopLive) {
    params.settings.aspect = "9:16";
    if (loopCount > 1) await x.exec(["-stream_loop", String(loopCount - 1), "-i", "project.mp4", "-c", "copy", "-y", "live.mp4"]);
  }
  const finalName = params.settings.loopLive ? "live.mp4" : "project.mp4";
  params.onProgress?.(0.98);

  const data = await x.readFile(finalName);
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data as unknown as ArrayBuffer);
  const blob = new Blob([bytes.buffer as ArrayBuffer], { type: "video/mp4" });
  const url = URL.createObjectURL(blob);

  // Dispara o download local (equivalente ao upload pro Supabase Storage no app principal).
  const a = document.createElement("a");
  a.href = url;
  a.download = `capcut-lab-${Date.now()}.mp4`;
  document.body.appendChild(a);
  a.click();
  a.remove();

  params.onProgress?.(1);
  return { url, duration: timelineDuration * loopCount, loopCount };
}
