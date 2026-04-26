import { trpc } from "@/lib/trpc";

export default function Progreso() {
  const { data: progress, isLoading } = trpc.stats.progress.useQuery();
  const { data: overview } = trpc.stats.overview.useQuery();

  const totalAnswered = overview?.totalAnswered ?? 0;
  const totalCorrect = overview?.totalCorrect ?? 0;
  const globalPct = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="px-6 py-8 border-b border-border" style={{ background: "oklch(1 0 0)" }}>
        <div className="label-caps mb-2">Estadísticas de estudio</div>
        <div className="display-lg">Progreso</div>
      </div>

      <div className="p-6 space-y-6">
        {/* Global stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-0 border border-border">
          <StatBlock label="Respondidas" value={totalAnswered} sub="total" />
          <StatBlock label="Correctas" value={totalCorrect} sub="aciertos" border />
          <StatBlock
            label="Errores"
            value={totalAnswered - totalCorrect}
            sub="fallos"
            border
          />
          <StatBlock label="Precisión" value={`${globalPct}%`} sub="global" border />
        </div>

        {/* Global progress bar */}
        <div className="border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="label-caps">Precisión global</span>
            <span
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                fontWeight: 900,
                fontSize: "1.4rem",
                letterSpacing: "-0.02em",
              }}
            >
              {globalPct}%
            </span>
          </div>
          <div className="progress-bar-track" style={{ height: "10px" }}>
            <div className="progress-bar-fill" style={{ width: `${globalPct}%` }} />
          </div>
          <div className="flex justify-between label-caps-sm mt-2">
            <span>{totalCorrect} correctas</span>
            <span>{totalAnswered - totalCorrect} errores</span>
          </div>
        </div>

        {/* By topic */}
        <div className="border border-border bg-card">
          <div
            className="px-5 py-4 border-b border-border"
            style={{ background: "oklch(0.97 0 0)" }}
          >
            <span className="label-caps">Desglose por bloque temático</span>
          </div>

          {isLoading ? (
            <div className="p-8 text-center label-caps">Cargando...</div>
          ) : !progress || progress.length === 0 ? (
            <div className="p-8 text-center">
              <div className="label-caps mb-1">Sin datos de progreso</div>
              <div className="label-caps-sm">Practica preguntas para ver tus estadísticas</div>
            </div>
          ) : (
            <div>
              {progress.map((item) => {
                const pct =
                  item.totalAnswered > 0
                    ? Math.round((item.totalCorrect / item.totalAnswered) * 100)
                    : 0;
                return (
                  <div
                    key={item.topicId}
                    className="px-5 py-4 border-b border-border last:border-b-0"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <span
                          style={{
                            fontFamily: "'Barlow Condensed', sans-serif",
                            fontWeight: 700,
                            fontSize: "0.9rem",
                            letterSpacing: "0.06em",
                            textTransform: "uppercase",
                            color: "oklch(0.15 0 0)",
                          }}
                        >
                          {item.topicName ?? `Bloque ${item.topicId}`}
                        </span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="label-caps-sm">{item.totalAnswered} resp.</span>
                        <span
                          style={{
                            fontFamily: "'Barlow Condensed', sans-serif",
                            fontWeight: 900,
                            fontSize: "1.2rem",
                            letterSpacing: "-0.02em",
                            color: pct >= 70 ? "oklch(0.20 0 0)" : pct >= 50 ? "oklch(0.40 0 0)" : "oklch(0.55 0 0)",
                          }}
                        >
                          {pct}%
                        </span>
                      </div>
                    </div>
                    <div className="progress-bar-track">
                      <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="flex justify-between label-caps-sm mt-1">
                      <span>{item.totalCorrect} correctas</span>
                      <span>{item.totalWrong} errores</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
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
      style={{ borderLeft: border ? "1px solid oklch(0.82 0 0)" : "none" }}
    >
      <div className="label-caps mb-2">{label}</div>
      <div className="stat-number">{value}</div>
      <div className="label-caps-sm mt-1">{sub}</div>
    </div>
  );
}
