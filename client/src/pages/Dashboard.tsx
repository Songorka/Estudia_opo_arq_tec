import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { FileText, BookOpen, ChevronRight, BarChart3, Github, Plus } from "lucide-react";

export default function Dashboard() {
  const { data: stats } = trpc.stats.overview.useQuery();
  const { data: recentDocs } = trpc.documents.list.useQuery({ limit: 3 });
  const { data: topics } = trpc.topics.list.useQuery();

  const totalAnswered = stats?.totalAnswered ?? 0;
  const totalCorrect = stats?.totalCorrect ?? 0;
  const accuracy = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0;
  const totalQuestions = stats?.totalQuestions ?? 0;
  const totalDocuments = stats?.totalDocuments ?? 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Header strip */}
      <div
        className="px-6 py-8 border-b border-border"
        style={{ background: "oklch(1 0 0)" }}
      >
        <div className="label-caps mb-2">Panel de control</div>
        <div className="display-lg">Dashboard</div>
      </div>

      <div className="p-6 space-y-6">
        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-0 border border-border">
          <StatBlock
            label="Preguntas respondidas"
            value={totalAnswered}
            sub="total acumulado"
          />
          <StatBlock
            label="Precisión global"
            value={`${accuracy}%`}
            sub={`${totalCorrect} correctas`}
            border
          />
          <StatBlock
            label="Banco de preguntas"
            value={totalQuestions}
            sub="disponibles"
            border
          />
          <StatBlock
            label="Documentos"
            value={totalDocuments}
            sub="cargados"
            border
          />
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Quick actions */}
          <div className="md:col-span-2 space-y-4">
            <div className="label-caps mb-3">Acceso rápido</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <QuickAction
                href="/practica"
                icon={<ChevronRight size={22} strokeWidth={2.5} />}
                title="Modo práctica"
                desc="Responde preguntas con corrección inmediata"
                dark
              />
              <QuickAction
                href="/banco"
                icon={<BookOpen size={22} strokeWidth={1.8} />}
                title="Banco de preguntas"
                desc="Gestiona y filtra todas las preguntas"
              />
              <QuickAction
                href="/documentos"
                icon={<FileText size={22} strokeWidth={1.8} />}
                title="Documentos"
                desc="Sube PDFs y extrae preguntas con IA"
              />
              <QuickAction
                href="/progreso"
                icon={<BarChart3 size={22} strokeWidth={1.8} />}
                title="Progreso"
                desc="Estadísticas por bloque temático"
              />
            </div>
          </div>

          {/* Right column */}
          <div className="space-y-4">
            {/* Documentos recientes */}
            <div className="border border-border bg-card">
              <div
                className="px-4 py-3 border-b border-border flex items-center justify-between"
                style={{ background: "oklch(0.97 0 0)" }}
              >
                <span className="label-caps">Documentos recientes</span>
                <Link href="/documentos">
                  <span className="label-caps-sm" style={{ color: "oklch(0.35 0 0)", cursor: "pointer" }}>
                    Ver todos →
                  </span>
                </Link>
              </div>
              <div>
                {recentDocs && recentDocs.length > 0 ? (
                  recentDocs.map((doc) => (
                    <div
                      key={doc.id}
                      className="px-4 py-3 border-b border-border last:border-b-0 flex items-center gap-3"
                    >
                      <FileText size={14} style={{ color: "oklch(0.55 0 0)", flexShrink: 0 }} />
                      <div className="min-w-0">
                        <div
                          style={{
                            fontFamily: "'Barlow', sans-serif",
                            fontSize: "0.8rem",
                            fontWeight: 500,
                            color: "oklch(0.15 0 0)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {doc.name}
                        </div>
                        <div className="label-caps-sm">{doc.type}</div>
                      </div>
                      <span
                        className={`badge-source ${doc.processed ? "badge-extracted" : "badge-ai"} ml-auto`}
                        style={{ flexShrink: 0 }}
                      >
                        {doc.processed ? "OK" : "Pendiente"}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="px-4 py-6 text-center">
                    <div className="label-caps mb-3">Sin documentos</div>
                    <Link href="/documentos">
                      <button className="btn-industrial text-xs px-3 py-2">
                        <Plus size={12} />
                        Subir PDF
                      </button>
                    </Link>
                  </div>
                )}
              </div>
            </div>

            {/* GitHub sync status */}
            <div className="border border-border bg-card">
              <div
                className="px-4 py-3 border-b border-border flex items-center gap-2"
                style={{ background: "oklch(0.10 0 0)" }}
              >
                <Github size={13} style={{ color: "oklch(0.60 0 0)" }} />
                <span className="label-caps" style={{ color: "oklch(0.60 0 0)" }}>
                  GitHub Sync
                </span>
              </div>
              <div className="px-4 py-4">
                <div
                  style={{
                    fontFamily: "'Barlow', sans-serif",
                    fontSize: "0.78rem",
                    color: "oklch(0.40 0 0)",
                    lineHeight: 1.5,
                  }}
                >
                  Songorka/Estudia_opo_arq_tec
                </div>
                <Link href="/github">
                  <button className="btn-industrial-outline mt-3 text-xs px-3 py-2" style={{ fontSize: "0.7rem" }}>
                    <Github size={11} />
                    Gestionar sync
                  </button>
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Progress by topic */}
        {topics && topics.length > 0 && (
          <div className="border border-border bg-card">
            <div
              className="px-5 py-4 border-b border-border flex items-center justify-between"
              style={{ background: "oklch(0.97 0 0)" }}
            >
              <span className="label-caps">Progreso por bloque temático</span>
              <Link href="/progreso">
                <span className="label-caps-sm" style={{ color: "oklch(0.35 0 0)", cursor: "pointer" }}>
                  Ver detalle →
                </span>
              </Link>
            </div>
            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {topics.slice(0, 6).map((topic) => {
                const pct =
                  topic.totalAnswered > 0
                    ? Math.round((topic.totalCorrect / topic.totalAnswered) * 100)
                    : 0;
                return (
                  <div key={topic.id}>
                    <div className="flex items-center justify-between mb-1">
                      <span
                        style={{
                          fontFamily: "'Barlow Condensed', sans-serif",
                          fontWeight: 700,
                          fontSize: "0.78rem",
                          letterSpacing: "0.05em",
                          textTransform: "uppercase",
                          color: "oklch(0.20 0 0)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          maxWidth: "70%",
                        }}
                      >
                        {topic.name}
                      </span>
                      <span className="label-caps-sm">{pct}%</span>
                    </div>
                    <div className="progress-bar-track">
                      <div
                        className="progress-bar-fill"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="label-caps-sm mt-1">
                      {topic.totalAnswered} respondidas
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatBlock({
  label,
  value,
  sub,
  border = false,
}: {
  label: string;
  value: string | number;
  sub: string;
  border?: boolean;
}) {
  return (
    <div
      className="p-5 bg-card"
      style={{
        borderLeft: border ? "1px solid oklch(0.82 0 0)" : "none",
      }}
    >
      <div className="label-caps mb-2">{label}</div>
      <div className="stat-number">{value}</div>
      <div className="label-caps-sm mt-1">{sub}</div>
    </div>
  );
}

function QuickAction({
  href,
  icon,
  title,
  desc,
  dark = false,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  desc: string;
  dark?: boolean;
}) {
  return (
    <Link href={href}>
      <div
        className="p-5 border border-border cursor-pointer transition-all h-full"
        style={{
          background: dark ? "oklch(0.10 0 0)" : "oklch(1 0 0)",
          color: dark ? "oklch(0.90 0 0)" : "oklch(0.10 0 0)",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLDivElement).style.background = dark
            ? "oklch(0.20 0 0)"
            : "oklch(0.95 0 0)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLDivElement).style.background = dark
            ? "oklch(0.10 0 0)"
            : "oklch(1 0 0)";
        }}
      >
        <div className="mb-3">{icon}</div>
        <div
          style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontWeight: 900,
            fontSize: "1rem",
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            marginBottom: "0.4rem",
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontFamily: "'Barlow', sans-serif",
            fontSize: "0.78rem",
            color: dark ? "oklch(0.55 0 0)" : "oklch(0.45 0 0)",
            lineHeight: 1.4,
          }}
        >
          {desc}
        </div>
      </div>
    </Link>
  );
}
