import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { Suspense, lazy } from "react";

const ProVideoEditor = lazy(() =>
  import("@/components/video/ProVideoEditor").then((m) => ({ default: m.ProVideoEditor })),
);

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Studio Pro — Editor de vídeos vertical" },
      {
        name: "description",
        content:
          "Edite vídeos verticais no navegador: cortes, textos, stickers, transições e exportação para TikTok, Reels e Shorts.",
      },
      { property: "og:title", content: "Studio Pro — Editor de vídeos vertical" },
      {
        property: "og:description",
        content: "Cortes, textos, stickers e exportação pronta para redes sociais.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

function Home() {
  return (
    <main className="min-h-screen bg-background p-4 md:p-8">
      <h1 className="mb-6 text-2xl font-semibold text-foreground">Studio Pro</h1>
      <ClientOnly fallback={<p className="text-muted-foreground">Carregando editor…</p>}>
        <Suspense fallback={<p className="text-muted-foreground">Carregando editor…</p>}>
          <ProVideoEditor />
        </Suspense>
      </ClientOnly>
    </main>
  );
}
