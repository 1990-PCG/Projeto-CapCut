import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { Toaster } from "sonner";

const ProVideoEditor = lazy(() =>
  import("@/components/video/ProVideoEditor").then((m) => ({ default: m.ProVideoEditor })),
);

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Studio Pro — Editor de vídeo multi-clipe" },
      {
        name: "description",
        content:
          "Editor de vídeo no navegador: cortes, textos, stickers, áudio e exportação em 9:16 para TikTok.",
      },
      { property: "og:title", content: "Studio Pro — Editor de vídeo multi-clipe" },
      {
        property: "og:description",
        content: "Corte, adicione textos e stickers e exporte vídeos verticais direto do navegador.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen bg-[#0A0A0A] p-4 md:p-8">
      <Toaster theme="dark" position="top-right" />
      <div className="max-w-6xl mx-auto space-y-4">
        <div>
          <h1 className="text-2xl font-light text-[#D4AF37]">Laboratório de Edição — Studio Pro</h1>
          <p className="text-white/50 text-sm mt-1">
            Editor multi-clipe estilo CapCut rodando isolado no navegador.
          </p>
        </div>
        <ClientOnly fallback={<div className="text-white/40 text-sm">Carregando editor…</div>}>
          <Suspense fallback={<div className="text-white/40 text-sm">Carregando editor…</div>}>
            <ProVideoEditor
              onExport={async (settings, onProgress) => {
                const { renderProjectLocally } = await import("@/lib/video/export");
                await renderProjectLocally({ settings, onProgress });
              }}
            />
          </Suspense>
        </ClientOnly>
      </div>
    </div>
  );
}
