import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ImagePlus, Video, Wand2, Download } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { submitMotionTransfer, checkMotionTransferStatus, listMyMotionTransfers } from "@/lib/motion.functions";

export const Route = createFileRoute("/dashboard/motion-transfer")({ component: MotionTransfer });

interface Transfer {
  id: string;
  status: "queued" | "processing" | "completed" | "failed";
  character_image_url: string;
  reference_video_url: string;
  result_url?: string | null;
  error_message?: string | null;
  created_at: string;
}

function MotionTransfer() {
  const submit = useServerFn(submitMotionTransfer);
  const checkStatus = useServerFn(checkMotionTransferStatus);
  const listMine = useServerFn(listMyMotionTransfers);

  const imageRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [prompt, setPrompt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refreshList = async () => {
    try {
      const list = await listMine();
      setTransfers(list as Transfer[]);
    } catch {
      // silencioso — a lista é conveniência, não é crítica para o fluxo principal
    }
  };

  useEffect(() => {
    void refreshList();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Enquanto houver qualquer geração "processing", consulta o andamento a cada poucos segundos.
  useEffect(() => {
    const hasPending = transfers.some((t) => t.status === "processing" || t.status === "queued");
    if (pollRef.current) clearInterval(pollRef.current);
    if (!hasPending) return;
    pollRef.current = setInterval(async () => {
      const pending = transfers.filter((t) => t.status === "processing" || t.status === "queued");
      for (const t of pending) {
        try {
          const updated = await checkStatus({ data: { id: t.id } });
          setTransfers((list) => list.map((x) => (x.id === t.id ? (updated as Transfer) : x)));
          if ((updated as Transfer).status === "completed") toast.success("Motion Transfer pronto!");
          if ((updated as Transfer).status === "failed") toast.error((updated as Transfer).error_message || "Falha na geração.");
        } catch (e: any) {
          toast.error(e?.message || "Erro ao consultar o andamento.");
        }
      }
    }, 6000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transfers.map((t) => t.status).join(",")]);

  const uploadToStorage = async (file: File, userId: string, kind: "image" | "video") => {
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const path = `${userId}/motion-inputs/${crypto.randomUUID()}-${safe}`;
    const { error } = await supabase.storage.from("videos").upload(path, file, { contentType: file.type });
    if (error) throw error;
    return supabase.storage.from("videos").getPublicUrl(path).data.publicUrl;
  };

  const handleGenerate = async () => {
    if (!imageFile || !videoFile) {
      toast.error("Selecione a imagem do personagem e o vídeo de referência.");
      return;
    }
    setSubmitting(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Faça login novamente.");

      const [characterImageUrl, referenceVideoUrl] = await Promise.all([
        uploadToStorage(imageFile, user.id, "image"),
        uploadToStorage(videoFile, user.id, "video"),
      ]);

      const row = await submit({ data: { characterImageUrl, referenceVideoUrl, prompt: prompt || undefined } });
      setTransfers((list) => [row as Transfer, ...list]);
      toast.success("Geração enviada! Isso costuma levar cerca de 1 minuto.");
      setImageFile(null);
      setVideoFile(null);
      setPrompt("");
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível iniciar a geração.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="text-[#D4AF37] text-2xl font-light">Motion Transfer (IA)</h2>
        <p className="text-white/60 mt-1">
          Envie a foto de um personagem e um vídeo de referência — a IA gera um vídeo do personagem reproduzindo o
          mesmo movimento. Cada geração tem um custo por segundo de vídeo, cobrado pelo fal.ai.
        </p>
      </div>

      <Card className="bg-[#121212] border-[#D4AF37]/20">
        <CardContent className="p-4 space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-white flex items-center gap-2 mb-2">
                <ImagePlus className="h-4 w-4" /> Imagem do personagem
              </Label>
              <input
                ref={imageRef}
                hidden
                type="file"
                accept="image/*"
                onChange={(e) => setImageFile(e.target.files?.[0] || null)}
              />
              <Button variant="outline" className="w-full" onClick={() => imageRef.current?.click()}>
                {imageFile ? imageFile.name : "Escolher imagem"}
              </Button>
            </div>
            <div>
              <Label className="text-white flex items-center gap-2 mb-2">
                <Video className="h-4 w-4" /> Vídeo de referência (movimento)
              </Label>
              <input
                ref={videoRef}
                hidden
                type="file"
                accept="video/*"
                onChange={(e) => setVideoFile(e.target.files?.[0] || null)}
              />
              <Button variant="outline" className="w-full" onClick={() => videoRef.current?.click()}>
                {videoFile ? videoFile.name : "Escolher vídeo"}
              </Button>
            </div>
          </div>
          <div>
            <Label className="text-white mb-2">Descrição opcional (ajuda a IA a entender a cena)</Label>
            <Input value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Ex: mulher dançando" />
          </div>
          <Button onClick={handleGenerate} disabled={submitting} className="w-full bg-[#D4AF37] text-black">
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enviando...
              </>
            ) : (
              <>
                <Wand2 className="mr-2 h-4 w-4" /> Gerar vídeo
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h3 className="text-white/70 text-sm uppercase tracking-widest">Gerações recentes</h3>
        {!transfers.length && <p className="text-white/40 text-sm">Nenhuma geração ainda.</p>}
        {transfers.map((t) => (
          <Card key={t.id} className="bg-[#121212] border-[#D4AF37]/20">
            <CardContent className="p-4 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <div className="text-sm text-white/70">
                <div>{new Date(t.created_at).toLocaleString("pt-BR")}</div>
                <div className="mt-1">
                  {t.status === "processing" || t.status === "queued" ? (
                    <span className="text-[#D4AF37] flex items-center gap-1">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Gerando...
                    </span>
                  ) : t.status === "completed" ? (
                    <span className="text-green-400">Concluído</span>
                  ) : (
                    <span className="text-red-400">Falhou{t.error_message ? `: ${t.error_message}` : ""}</span>
                  )}
                </div>
              </div>
              {t.status === "completed" && t.result_url && (
                <div className="flex items-center gap-3">
                  <video src={t.result_url} controls className="h-28 rounded bg-black" />
                  <a href={t.result_url} download target="_blank" rel="noreferrer">
                    <Button variant="outline" size="sm">
                      <Download className="mr-2 h-4 w-4" /> Baixar
                    </Button>
                  </a>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
