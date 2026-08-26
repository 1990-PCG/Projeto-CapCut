import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { fal } from "@fal-ai/client";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Motion Transfer (IA): recebe uma imagem de personagem + um vídeo de
// referência e gera um vídeo do personagem reproduzindo o movimento, via
// fal.ai (modelo "fal-ai/wan-motion"). A geração acontece do lado do fal.ai
// (fila assíncrona) — aqui só registramos o pedido, consultamos o andamento,
// e quando pronto baixamos o resultado para o Storage do próprio app.

const db = (context: any) => context.supabase as any;

function ensureFalConfigured() {
  const key = process.env["FAL_KEY"];
  if (!key) throw new Error("FAL_KEY não configurada. Cadastre a chave do fal.ai nas variáveis de ambiente.");
  fal.config({ credentials: key });
}

export const submitMotionTransfer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        characterImageUrl: z.string().url(),
        referenceVideoUrl: z.string().url(),
        prompt: z.string().max(500).optional(),
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    ensureFalConfigured();

    const { request_id } = await fal.queue.submit("fal-ai/wan-motion", {
      input: {
        image_url: data.characterImageUrl,
        video_url: data.referenceVideoUrl,
        prompt: data.prompt || "",
      },
    });

    const { data: row, error } = await db(context)
      .from("motion_transfers")
      .insert({
        user_id: context.userId,
        request_id,
        character_image_url: data.characterImageUrl,
        reference_video_url: data.referenceVideoUrl,
        prompt: data.prompt || null,
        status: "processing",
      })
      .select("*")
      .single();
    if (error) throw error;

    return row;
  });

export const checkMotionTransferStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await db(context)
      .from("motion_transfers")
      .select("*")
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw error;
    if (!row) throw new Error("Geração não encontrada.");
    if (row.status === "completed" || row.status === "failed") return row;

    ensureFalConfigured();
    const status = await fal.queue.status("fal-ai/wan-motion", { requestId: row.request_id, logs: false });

    if (status.status === "COMPLETED") {
      try {
        const result = await fal.queue.result("fal-ai/wan-motion", { requestId: row.request_id });
        const videoUrl = (result.data as any)?.video?.url as string | undefined;
        if (!videoUrl) throw new Error("O fal.ai não retornou um vídeo no resultado.");

        const res = await fetch(videoUrl);
        if (!res.ok) throw new Error("Falha ao baixar o vídeo gerado pelo fal.ai.");
        const bytes = new Uint8Array(await res.arrayBuffer());

        const path = `${context.userId}/motion-transfers/${row.id}.mp4`;
        const up = await db(context).storage.from("videos").upload(path, bytes, { contentType: "video/mp4", upsert: true });
        if (up.error) throw up.error;
        const pub = db(context).storage.from("videos").getPublicUrl(path).data.publicUrl;

        const { data: updated, error: updErr } = await db(context)
          .from("motion_transfers")
          .update({ status: "completed", result_path: path, result_url: pub, completed_at: new Date().toISOString() })
          .eq("id", row.id)
          .select("*")
          .single();
        if (updErr) throw updErr;
        return updated;
      } catch (e: any) {
        const message = e?.message || "Falha ao processar o resultado do fal.ai.";
        await db(context).from("motion_transfers").update({ status: "failed", error_message: message }).eq("id", row.id);
        throw new Error(message);
      }
    }

    if ((status as any).status === "ERROR" || (status as any).status === "FAILED") {
      const message = "A geração falhou no fal.ai.";
      await db(context).from("motion_transfers").update({ status: "failed", error_message: message }).eq("id", row.id);
      return { ...row, status: "failed", error_message: message };
    }

    // Ainda na fila ou em andamento (IN_QUEUE / IN_PROGRESS) — segue "processing".
    return row;
  });

export const listMyMotionTransfers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await db(context)
      .from("motion_transfers")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw error;
    return data;
  });
