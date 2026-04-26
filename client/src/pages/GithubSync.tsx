import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { Github, RefreshCw, Settings, CheckCircle } from "lucide-react";
import { toast } from "sonner";

export default function GithubSync() {
  const utils = trpc.useUtils();
  const { data: config } = trpc.github.getConfig.useQuery();
  const saveConfig = trpc.github.saveConfig.useMutation({
    onSuccess: () => {
      toast.success("Configuración guardada");
      utils.github.getConfig.invalidate();
    },
  });
  const syncMut = trpc.github.syncFromGithub.useMutation({
    onSuccess: (data) => {
      toast.success(`Sincronizado: ${data.added} documentos nuevos (${data.total} PDFs en repo)`);
      utils.documents.list.invalidate();
      utils.github.getConfig.invalidate();
    },
    onError: (err) => toast.error(`Error: ${err.message}`),
  });

  const [form, setForm] = useState({
    githubRepo: "Songorka/Estudia_opo_arq_tec",
    githubToken: "",
    githubBranch: "main",
  });
  const [showToken, setShowToken] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="px-6 py-8 border-b border-border" style={{ background: "oklch(1 0 0)" }}>
        <div className="label-caps mb-2">Sincronización bidireccional</div>
        <div className="display-lg">GitHub Sync</div>
      </div>

      <div className="p-6 space-y-6 max-w-xl">
        {/* Status */}
        <div className="border border-border bg-card">
          <div
            className="px-5 py-4 border-b border-border flex items-center gap-2"
            style={{ background: "oklch(0.10 0 0)" }}
          >
            <Github size={14} style={{ color: "oklch(0.60 0 0)" }} />
            <span className="label-caps" style={{ color: "oklch(0.60 0 0)" }}>
              Estado de sincronización
            </span>
          </div>
          <div className="p-5">
            <div className="flex items-center gap-3 mb-3">
              <CheckCircle size={16} style={{ color: "oklch(0.35 0 0)" }} />
              <div>
                <div
                  style={{
                    fontFamily: "'Barlow Condensed', sans-serif",
                    fontWeight: 700,
                    fontSize: "0.9rem",
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                  }}
                >
                  {config?.githubRepo ?? "Songorka/Estudia_opo_arq_tec"}
                </div>
                <div className="label-caps-sm">
                  Rama: {config?.githubBranch ?? "main"}
                </div>
              </div>
            </div>
            {config?.lastGithubSync && (
              <div className="label-caps-sm mb-4">
                Última sync: {new Date(config.lastGithubSync).toLocaleString("es-ES")}
              </div>
            )}
            <button
              onClick={() => syncMut.mutate()}
              disabled={syncMut.isPending}
              className="btn-industrial"
            >
              <RefreshCw size={14} className={syncMut.isPending ? "animate-spin" : ""} />
              {syncMut.isPending ? "Sincronizando..." : "Sincronizar desde GitHub"}
            </button>
          </div>
        </div>

        {/* How it works */}
        <div className="border border-border bg-card">
          <div
            className="px-5 py-4 border-b border-border"
            style={{ background: "oklch(0.97 0 0)" }}
          >
            <span className="label-caps">Cómo funciona</span>
          </div>
          <div className="p-5 space-y-4">
            <FlowStep
              num="01"
              title="Subir desde GitHub"
              desc="Añade PDFs a las carpetas convocatoria/, examenes/ o temas/ del repositorio y pulsa «Sincronizar». Los documentos aparecerán automáticamente en la app."
            />
            <div className="rule-thin" />
            <FlowStep
              num="02"
              title="Subir desde la app"
              desc="Sube un PDF desde el panel de Documentos y usa el botón «Push» para enviarlo al repositorio GitHub en la carpeta correspondiente."
            />
            <div className="rule-thin" />
            <FlowStep
              num="03"
              title="Fuente única de verdad"
              desc="Ambos lados se mantienen sincronizados. El repositorio GitHub actúa como copia de seguridad y punto de acceso externo."
            />
          </div>
        </div>

        {/* Config */}
        <div className="border border-border bg-card">
          <button
            onClick={() => setShowToken(!showToken)}
            className="w-full px-5 py-4 flex items-center gap-2 border-b border-border"
            style={{ background: "oklch(0.97 0 0)", border: "none", borderBottom: "1px solid oklch(0.82 0 0)", cursor: "pointer" }}
          >
            <Settings size={13} style={{ color: "oklch(0.55 0 0)" }} />
            <span className="label-caps">Configuración avanzada</span>
          </button>
          {showToken && (
            <div className="p-5 space-y-4">
              <div>
                <div className="label-caps mb-2">Repositorio (owner/repo)</div>
                <input
                  type="text"
                  value={form.githubRepo}
                  onChange={(e) => setForm((f) => ({ ...f, githubRepo: e.target.value }))}
                  className="w-full border border-border px-3 py-2 bg-background text-foreground"
                  style={{ fontFamily: "'Barlow', sans-serif", fontSize: "0.85rem", outline: "none" }}
                />
              </div>
              <div>
                <div className="label-caps mb-2">Rama</div>
                <input
                  type="text"
                  value={form.githubBranch}
                  onChange={(e) => setForm((f) => ({ ...f, githubBranch: e.target.value }))}
                  className="w-full border border-border px-3 py-2 bg-background text-foreground"
                  style={{ fontFamily: "'Barlow', sans-serif", fontSize: "0.85rem", outline: "none" }}
                />
              </div>
              <div>
                <div className="label-caps mb-2">
                  Token GitHub (necesario para push)
                </div>
                <input
                  type="password"
                  placeholder="ghp_..."
                  value={form.githubToken}
                  onChange={(e) => setForm((f) => ({ ...f, githubToken: e.target.value }))}
                  className="w-full border border-border px-3 py-2 bg-background text-foreground"
                  style={{ fontFamily: "'Barlow', sans-serif", fontSize: "0.85rem", outline: "none" }}
                />
                <div className="label-caps-sm mt-1">
                  Necesario solo para subir archivos al repo. Genera un token en GitHub → Settings → Developer settings → Personal access tokens.
                </div>
              </div>
              <button
                onClick={() => saveConfig.mutate(form)}
                disabled={saveConfig.isPending}
                className="btn-industrial"
              >
                {saveConfig.isPending ? "Guardando..." : "Guardar configuración"}
              </button>
            </div>
          )}
        </div>

        {/* Repo structure */}
        <div className="border border-border bg-card">
          <div
            className="px-5 py-4 border-b border-border"
            style={{ background: "oklch(0.97 0 0)" }}
          >
            <span className="label-caps">Estructura del repositorio</span>
          </div>
          <div className="p-5">
            <pre
              style={{
                fontFamily: "'Barlow', monospace",
                fontSize: "0.8rem",
                lineHeight: 1.8,
                color: "oklch(0.30 0 0)",
                background: "oklch(0.95 0 0)",
                padding: "1rem",
                overflowX: "auto",
              }}
            >
{`Estudia_opo_arq_tec/
├── convocatoria/    ← PDF de la convocatoria
├── examenes/        ← PDFs de exámenes anteriores
└── temas/           ← PDFs de temas desarrollados`}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}

function FlowStep({ num, title, desc }: { num: string; title: string; desc: string }) {
  return (
    <div className="flex gap-4">
      <div
        style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          fontWeight: 900,
          fontSize: "1.5rem",
          letterSpacing: "-0.02em",
          color: "oklch(0.82 0 0)",
          minWidth: "2.5rem",
          lineHeight: 1,
        }}
      >
        {num}
      </div>
      <div>
        <div
          style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontWeight: 700,
            fontSize: "0.85rem",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "oklch(0.15 0 0)",
            marginBottom: "0.3rem",
          }}
        >
          {title}
        </div>
        <p
          style={{
            fontFamily: "'Barlow', sans-serif",
            fontSize: "0.82rem",
            lineHeight: 1.6,
            color: "oklch(0.40 0 0)",
          }}
        >
          {desc}
        </p>
      </div>
    </div>
  );
}
