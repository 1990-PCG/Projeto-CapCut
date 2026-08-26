import type { StickerOverlay } from "@/lib/video/overlays";
export type VideoResolution = "720p" | "1080p" | "1440p" | "2160p";
export type VideoFps = 24 | 30 | 60;
export type ExportPreset = "tiktok-1080-30" | "tiktok-1080-60" | "tiktok-720-30" | "youtube-1080-30" | "custom";
export interface VideoClip { id:string; url:string; name:string; sourcePath?:string; start:number; end:number; duration:number; }
export interface AudioTrack { url:string; name:string; offset:number; volume:number; replaceOriginal:boolean; }
export interface ProjectText { id:string; text:string; start:number; end:number; x:number; y:number; size:number; color:string; background:boolean; font?:string; }
export type TransitionKey = "none" | "fade" | "slide" | "wipe";
export interface VideoProjectSettings { clips:VideoClip[]; audio?:AudioTrack; texts:ProjectText[]; stickers?:StickerOverlay[]; aspect:"9:16"|"1:1"|"16:9"|"original"; resolution:VideoResolution; fps:VideoFps; preset:ExportPreset; volume:number; speed:number; filter:"none"|"vivid"|"cinema"|"bw"|"vintage"|"cool"|"warm"; motionTransfer:"none"|"slow-zoom"|"ken-burns"|"face-follow"; transition:TransitionKey; transitionDuration:number; loopLive:boolean; loopCount:number; }
export const EXPORT_PRESETS:Record<Exclude<ExportPreset,"custom">,{label:string;resolution:VideoResolution;fps:VideoFps;width:number;height:number}>={
  "tiktok-1080-30":{label:"TikTok 1080p · 30 FPS",resolution:"1080p",fps:30,width:1080,height:1920},
  "tiktok-1080-60":{label:"TikTok 1080p · 60 FPS",resolution:"1080p",fps:60,width:1080,height:1920},
  "tiktok-720-30":{label:"TikTok 720p · 30 FPS",resolution:"720p",fps:30,width:720,height:1280},
  "youtube-1080-30":{label:"YouTube 1080p · 30 FPS",resolution:"1080p",fps:30,width:1920,height:1080}
};
export const RESOLUTION_SIZES:Record<VideoResolution,number>={"720p":720,"1080p":1080,"1440p":1440,"2160p":2160};
