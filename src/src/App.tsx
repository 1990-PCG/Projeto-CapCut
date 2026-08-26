import { Toaster } from "sonner";
import { ProVideoEditor } from "@/components/video/ProVideoEditor";
import { renderProjectLocally } from "@/lib/video/export";

/**
 * App raiz do laboratório de testes (Opção 3).
 * Sem login, sem Supabase — é só o editor rodando isolado, pra testar
 * as funcionalidades novas com segurança antes de levar pro app principal.
 */
export default function App() {
  return (
    <div className="min-h-screen bg-[#0A0A0A] p-4 md:p-8">
      <Toaster theme="dark" position="top-right" />
      <div className="max-w-6xl mx-auto space-y-4">
        <div>
          <h1 className="text-2xl font-light text-[#D4AF37]">Laboratório de Edição — Opção 3</h1>
          <p className="text-white/50 text-sm mt-1">
            Projeto isolado para testar o editor multi-clipe (Studio Pro) e as novas funcionalidades estilo CapCut,
            sem depender do app principal.
          </p>
        </div>
        <ProVideoEditor
          onExport={async (settings, onProgress) => {
            await renderProjectLocally({ settings, onProgress });
          }}
        />
      </div>
    </div>
  );
}
