import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { FileText, BookOpen, ChevronRight, BarChart3, Github, Plus, ClipboardList, Calendar } from "lucide-react";
import { useState, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type DateRange = "all" | "today" | "week" | "month";

function getDateRange(range: DateRange): { from?: string; to?: string } {
  if (range === "all") return {};
  const now = new Date();
  const to = now.toISOString();
  if (range === "today") {
    const from = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    return { from, to };
  }
  if (range === "week") {
    const from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    return { from, to };
  }
  if (range === "month") {
    const from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    return { from, to };
  }
  return {};
}

const RANGE_LABELS: Record<DateRange, string> = {
  all: "Todo el histórico",
  today: "Hoy",
  week: "Última semana",
  month: "Último mes",
};

const EVOLUTION_DAYS: Record<DateRange, number> = {
  all: 90,
  today: 7,
  week: 14,
  month: 30,
};

export default function Dashboard() {
  const [dateRange, setDateRange] = useState<DateRange>("all");
  const rangeParams = useMemo(() => getDateRange(dateRange), [dateRange]);
  const evolutionDays = EVOLUTION_DAYS[dateRange];

  const { data: stats } = trpc.stats.overview.useQuery(rangeParams);
  const { data: progressData } = trpc.stats.progress.useQuery(rangeParams);
  const { data: evolutionData } = trpc.stats.evolution.useQuery({ days: evolutionDays });
  const { data: recentDocs } = trpc.documents.list.useQuery({ limit: 3 });

  const totalAnswered = stats?.totalAnswered ?? 0;
  const totalCorrect = stats?.totalCorrect ?? 0;
  const accuracy = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0;
  const totalQuestions = stats?.totalQuestions ?? 0;
  const totalDocuments = stats?.totalDocuments ?? 0;
  const totalExams = stats?.totalExams ?? 0;

  const hasEvolutionData = evolutionData && evolutionData.length > 1;

  return (
    <div className="min-h-screen bg-background">
      {/* Header strip */}
      <div className="px-6 py-8 border-b border-border" style={{ background: "oklch(1 0 0)" }}>
        <div className="label-caps mb-2">Panel de control</div>
        <div className="display-lg">Dashboard</div>
      </div>

      <div className="p-6 space-y-6">
        {/* Date range filter */}
        <div className="flex items-center gap-2 flex-wrap">
          <Calendar size={13} style={{ color: "oklch(0.55 0 0)" }} />
          <span className="label-caps">Período:</span>
          {(["all", "today", "week", "month"] as DateRange[]).map((r) => (
            <button
              key={r}
              onClick={() => setDateRange(r)}
              style={{
                padding: "0.25rem 0.65rem",
                fontFamily: "'Barlow Condensed', sans-serif",
                fontWeight: 700,
                fontSize: "0.70rem",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                border: dateRange === r ? "2px solid oklch(0.10 0 0)" : "1px solid oklch(0.82 0 0)",
                background: dateRange === r ? "oklch(0.10 0 0)" : "oklch(1 0 0)",
                color: dateRange === r ? "oklch(0.97 0 0)" : "oklch(0.40 0 0)",
                cursor: "pointer",
              }}
            >
              {RANGE_LABELS[r]}
            </button>
          ))}
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-0 border border-border">
          <StatBlock label="Respondidas" value={totalAnswered} sub={RANGE_LABELS[dateRange]} />
          <StatBlock label="Precisión" value={`${accuracy}%`} sub={`${totalCorrect} correctas`} border />
          <StatBlock label="Banco" value={totalQuestions} sub="preguntas totales" border />
          <StatBlock label="Documentos" value={totalDocuments} sub="cargados" border />
          <StatBlock label="Exámenes" value={totalExams} sub="realizados" border />
        </div>

        {/* Evolution chart */}
        {hasEvolutionData && (
          <div className="border border-border bg-card">
            <div
              className="px-5 py-4 border-b border-border flex items-center justify-between"
              style={{ background: "oklch(0.97 0 0)" }}
            >
              <span className="label-caps">Evolución de precisión</span>
              <span className="label-caps-sm">Últimos {evolutionDays} días</span>
            </div>
            <div className="p-5" style={{ height: "200px" }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={evolutionData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.90 0 0)" />
                  <XAxis
                    dataKey="day"
                    tick={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10, fill: "oklch(0.55 0 0)", letterSpacing: "0.05em" }}
                    tickFormatter={(v: string) => {
                      const d = new Date(v);
                      return `${d.getDate()}/${d.getMonth() + 1}`;
                    }}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10, fill: "oklch(0.55 0 0)" }}
                    tickFormatter={(v: number) => `${v}%`}
                  />
                  <Tooltip
                    contentStyle={{
                      fontFamily: "'Barlow Condensed', sans-serif",
                      fontSize: "0.75rem",
                      border: "1px solid oklch(0.82 0 0)",
                      background: "oklch(1 0 0)",
                      letterSpacing: "0.05em",
                    }}
                    formatter={(value: number) => [`${value}%`, "Precisión"]}
                    labelFormatter={(label: string) => {
                      const d = new Date(label);
                      return d.toLocaleDateString("es-ES");
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="pct"
                    stroke="oklch(0.20 0 0)"
                    strokeWidth={2}
                    dot={{ fill: "oklch(0.20 0 0)", r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

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
                href="/examenes"
                icon={<ClipboardList size={22} strokeWidth={1.8} />}
                title="Exámenes"
                desc="Crea un examen con feedback completo"
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

        {/* Progress by topic (filtered) */}
        {progressData && progressData.length > 0 && (
          <div className="border border-border bg-card">
            <div
              className="px-5 py-4 border-b border-border flex items-center justify-between"
              style={{ background: "oklch(0.97 0 0)" }}
            >
              <span className="label-caps">Progreso por bloque temático</span>
              <div className="flex items-center gap-3">
                <span className="label-caps-sm">{RANGE_LABELS[dateRange]}</span>
                <Link href="/progreso">
                  <span className="label-caps-sm" style={{ color: "oklch(0.35 0 0)", cursor: "pointer" }}>
                    Ver detalle →
                  </span>
                </Link>
              </div>
            </div>
            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {progressData.slice(0, 6).map((topic) => {
                const answered = Number(topic.totalAnswered ?? 0);
                const correct = Number(topic.totalCorrect ?? 0);
                const pct = answered > 0 ? Math.round((correct / answered) * 100) : 0;
                return (
                  <div key={String(topic.topicId)}>
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
                        {topic.topicName ?? "Sin tema"}
                      </span>
                      <span className="label-caps-sm">{pct}%</span>
                    </div>
                    <div className="progress-bar-track">
                      <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="label-caps-sm mt-1">{answered} respondidas</div>
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
