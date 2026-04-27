import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { Trash2, Cpu, Plus, ChevronDown, ChevronUp, Flag, FlagOff, FileText, Sparkles, BookOpen } from "lucide-react";
import { toast } from "sonner";
import TopicSelector from "@/components/TopicSelector";

export default function Banco() {
  const utils = trpc.useUtils();
  const { data: topics } = trpc.questions.topicsWithCounts.useQuery();
  const [filterTopic, setFilterTopic] = useState<number | undefined>();
  const [filterSource, setFilterSource] = useState<string | undefined>();
  const [filterDocType, setFilterDocType] = useState<string | undefined>();
  const [showReview, setShowReview] = useState(false);

  const { data: questions, isLoading } = trpc.questions.list.useQuery({
    topicId: filterTopic,
    source: filterSource,
    docType: filterDocType,
    reviewOnly: showReview || undefined,
    limit: 100,
  });

  const deleteMut = trpc.questions.delete.useMutation({
    onSuccess: () => {
      utils.questions.list.invalidate();
      utils.stats.overview.invalidate();
    },
  });

  const reviewMut = trpc.questions.setReviewFlag.useMutation({
    onSuccess: () => {
      utils.questions.list.invalidate();
    },
  });

  const generateMut = trpc.questions.generate.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.count} preguntas generadas`);
      utils.questions.list.invalidate();
      utils.topics.list.invalidate();
      utils.stats.overview.invalidate();
      setGenForm({ topicId: undefined, topicName: "", count: 5, difficulty: undefined });
    },
    onError: (err) => {
      const code = err.data?.code ?? 'UNKNOWN';
      const msg = err.message || 'Error desconocido';
      console.error('[generate] error:', code, msg, err);
      toast.error(`[${code}] ${msg}`, { duration: 8000 });
    },
  });

  const [showGenForm, setShowGenForm] = useState(false);
  const [genForm, setGenForm] = useState<{
    topicId: number | undefined;
    topicName: string;
    count: number;
    difficulty: "facil" | "medio" | "dificil" | undefined;
  }>({ topicId: undefined, topicName: "", count: 5, difficulty: undefined });

  const [expandedId, setExpandedId] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-background">
      <div className="px-6 py-8 border-b border-border" style={{ background: "oklch(1 0 0)" }}>
        <div className="label-caps mb-2">Preguntas tipo test</div>
        <div className="display-lg">Banco de preguntas</div>
      </div>

      <div className="p-6 space-y-5">
        {/* Generate with AI */}
        <div className="border border-border bg-card">
          <button
            onClick={() => setShowGenForm(!showGenForm)}
            className="w-full px-5 py-4 flex items-center justify-between"
            style={{ background: "oklch(0.10 0 0)", border: "none", cursor: "pointer" }}
          >
            <div className="flex items-center gap-2">
              <Cpu size={14} style={{ color: "oklch(0.60 0 0)" }} />
              <span className="label-caps" style={{ color: "oklch(0.60 0 0)" }}>
                Generar preguntas con IA
              </span>
            </div>
            {showGenForm
              ? <ChevronUp size={14} style={{ color: "oklch(0.50 0 0)" }} />
              : <ChevronDown size={14} style={{ color: "oklch(0.50 0 0)" }} />}
          </button>

          {showGenForm && (
            <div className="p-5 border-t border-border">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                <div className="sm:col-span-1">
                  <div className="label-caps mb-2">Bloque tematico</div>
                  <TopicSelector
                    mode="single"
                    topics={topics ?? []}
                    value={genForm.topicId}
                    onChange={(id) => {
                      const topic = (topics ?? []).find((t) => t.id === id);
                      setGenForm((f) => ({ ...f, topicId: id, topicName: topic?.name ?? "" }));
                    }}
                    placeholder="Selecciona un bloque"
                  />
                  {genForm.topicId === undefined && (
                    <input
                      type="text"
                      placeholder="O escribe un tema nuevo..."
                      value={genForm.topicName}
                      onChange={(e) => setGenForm((f) => ({ ...f, topicName: e.target.value }))}
                      className="w-full border border-border px-3 py-2 bg-background text-foreground mt-2"
                      style={{ fontFamily: "'Barlow', sans-serif", fontSize: "0.85rem", outline: "none" }}
                    />
                  )}
                </div>
                <div>
                  <div className="label-caps mb-2">Numero: {genForm.count}</div>
                  <input
                    type="range" min={1} max={20} value={genForm.count}
                    onChange={(e) => setGenForm((f) => ({ ...f, count: Number(e.target.value) }))}
                    className="w-full mt-2"
                    style={{ accentColor: "oklch(0.10 0 0)" }}
                  />
                </div>
                <div>
                  <div className="label-caps mb-2">Dificultad</div>
                  <select
                    value={genForm.difficulty ?? ""}
                    onChange={(e) => setGenForm((f) => ({ ...f, difficulty: (e.target.value || undefined) as typeof genForm.difficulty }))}
                    className="w-full border border-border px-3 py-2 bg-background text-foreground"
                    style={{ fontFamily: "'Barlow', sans-serif", fontSize: "0.85rem", outline: "none" }}
                  >
                    <option value="">Mixta</option>
                    <option value="facil">Facil</option>
                    <option value="medio">Medio</option>
                    <option value="dificil">Dificil</option>
                  </select>
                </div>
              </div>
              <button
                onClick={() => {
                  const name = genForm.topicId
                    ? ((topics ?? []).find((t) => t.id === genForm.topicId)?.name ?? "")
                    : genForm.topicName.trim();
                  if (!name) { toast.error("Selecciona o escribe un bloque tematico"); return; }
                  generateMut.mutate({ topicId: genForm.topicId, topicName: name, count: genForm.count, difficulty: genForm.difficulty });
                }}
                disabled={generateMut.isPending}
                className="btn-industrial"
              >
                <Plus size={14} />
                {generateMut.isPending ? "Generando..." : "Generar preguntas"}
              </button>
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="label-caps">Filtrar:</div>
          <div style={{ minWidth: "200px", maxWidth: "280px" }}>
            <TopicSelector
              mode="single"
              topics={topics ?? []}
              value={filterTopic}
              onChange={setFilterTopic}
              placeholder="Todos los bloques"
            />
          </div>
          <div className="flex gap-1">
            {[
              { value: undefined, label: "Todas" },
              { value: "extracted", label: "Examenes" },
              { value: "ai_generated", label: "IA" },
            ].map((opt) => (
              <button
                key={String(opt.value)}
                onClick={() => { setFilterSource(opt.value); setFilterDocType(undefined); setShowReview(false); }}
                style={{
                  fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: "0.72rem",
                  letterSpacing: "0.1em", textTransform: "uppercase", padding: "0.4rem 0.8rem",
                  background: filterSource === opt.value && !filterDocType && !showReview ? "oklch(0.10 0 0)" : "transparent",
                  color: filterSource === opt.value && !filterDocType && !showReview ? "oklch(0.97 0 0)" : "oklch(0.40 0 0)",
                  border: `1px solid ${filterSource === opt.value && !filterDocType && !showReview ? "oklch(0.10 0 0)" : "oklch(0.82 0 0)"}`,
                  cursor: "pointer",
                }}
              >{opt.label}</button>
            ))}
          </div>
          <button
            onClick={() => { setShowReview(!showReview); setFilterSource(undefined); setFilterDocType(undefined); }}
            style={{
              fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: "0.72rem",
              letterSpacing: "0.1em", textTransform: "uppercase", padding: "0.4rem 0.8rem",
              background: showReview ? "oklch(0.35 0 0)" : "transparent",
              color: showReview ? "oklch(0.97 0 0)" : "oklch(0.50 0 0)",
              border: `1px solid ${showReview ? "oklch(0.35 0 0)" : "oklch(0.82 0 0)"}`,
              cursor: "pointer", display: "flex", alignItems: "center", gap: "0.3rem",
            }}
          >
            <Flag size={11} />
            En revision
          </button>
          <span className="label-caps-sm ml-auto">{questions?.length ?? 0} preguntas</span>
        </div>

        {/* Leyenda de fuentes */}
        <div className="flex flex-wrap gap-3 items-center py-2">
          <span className="label-caps-sm" style={{ color: "oklch(0.55 0 0)" }}>Leyenda:</span>
          <span className="badge-source badge-extracted" style={{ gap: "0.3rem" }}>
            <FileText size={9} /> Examen / Convocatoria
          </span>
          <span className="badge-source badge-tema" style={{ gap: "0.3rem" }}>
            <BookOpen size={9} /> Tema Teórico
          </span>
          <span className="badge-source badge-ai" style={{ gap: "0.3rem" }}>
            <Sparkles size={9} /> IA Generada
          </span>
        </div>

        {/* Question list */}
        <div className="border border-border bg-card">
          {isLoading ? (
            <div className="p-8 text-center label-caps">Cargando...</div>
          ) : !questions || questions.length === 0 ? (
            <div className="p-8 text-center">
              <div className="label-caps mb-1">{showReview ? "Sin preguntas en revision" : "Sin preguntas"}</div>
              <div className="label-caps-sm">
                {showReview ? "Marca preguntas durante la practica para revisarlas aqui" : "Sube un examen PDF o genera preguntas con IA"}
              </div>
            </div>
          ) : (
            questions.map((q) => (
              <QuestionRow
                key={q.id}
                question={q}
                expanded={expandedId === q.id}
                onToggle={() => setExpandedId(expandedId === q.id ? null : q.id)}
                onDelete={() => deleteMut.mutate({ id: q.id })}
                onToggleReview={() => reviewMut.mutate({ id: q.id, flag: !q.reviewFlag })}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// Determina el tipo de fuente de una pregunta para el badge y el borde
function getSourceMeta(q: { source: string; docType?: string | null }) {
  if (q.source === "ai_generated") {
    return {
      badgeClass: "badge-ai",
      label: "IA Generada",
      icon: <Sparkles size={9} />,
      borderColor: "oklch(0.55 0 0)",
    };
  }
  // extracted — distinguir por docType del documento origen
  if (q.docType === "tema") {
    return {
      badgeClass: "badge-tema",
      label: "Tema Teórico",
      icon: <BookOpen size={9} />,
      borderColor: "oklch(0.65 0 0)",
    };
  }
  if (q.docType === "convocatoria") {
    return {
      badgeClass: "badge-extracted",
      label: "Convocatoria",
      icon: <FileText size={9} />,
      borderColor: "oklch(0.15 0 0)",
    };
  }
  // examen (o sin docType)
  return {
    badgeClass: "badge-extracted",
    label: "Examen Anterior",
    icon: <FileText size={9} />,
    borderColor: "oklch(0.15 0 0)",
  };
}

function QuestionRow({
  question, expanded, onToggle, onDelete, onToggleReview,
}: {
  question: { id: number; source: string; docType?: string | null; question: string; optionA: string; optionB: string; optionC: string; optionD: string; correctOption: string; explanation?: string | null; difficulty?: string | null; reviewFlag: boolean };
  expanded: boolean; onToggle: () => void; onDelete: () => void; onToggleReview: () => void;
}) {
  const opts = [
    { key: "A", text: question.optionA },
    { key: "B", text: question.optionB },
    { key: "C", text: question.optionC },
    { key: "D", text: question.optionD },
  ];

  const sourceMeta = getSourceMeta(question);

  return (
    <div className="border-b border-border last:border-b-0" style={{ borderLeft: `3px solid ${sourceMeta.borderColor}` }}>
      <div
        className="px-5 py-4 flex items-start gap-4 cursor-pointer"
        onClick={onToggle}
        style={{ background: expanded ? "oklch(0.97 0 0)" : question.reviewFlag ? "oklch(0.975 0 0)" : "oklch(1 0 0)" }}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`badge-source ${sourceMeta.badgeClass}`}>
              {sourceMeta.icon}
              {sourceMeta.label}
            </span>
            {question.reviewFlag && (
              <span style={{
                display: "inline-flex", alignItems: "center", gap: "0.2rem",
                fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: "0.65rem",
                letterSpacing: "0.1em", textTransform: "uppercase", color: "oklch(0.35 0 0)",
                border: "1px solid oklch(0.60 0 0)", padding: "0.1rem 0.4rem",
              }}>
                <Flag size={9} />
                Revision
              </span>
            )}
            {question.difficulty && <span className="label-caps-sm">{question.difficulty}</span>}
          </div>
          <p style={{
            fontFamily: "'Barlow', sans-serif", fontSize: "0.88rem", lineHeight: 1.5, color: "oklch(0.15 0 0)",
            overflow: "hidden", display: "-webkit-box", WebkitLineClamp: expanded ? "unset" : 2, WebkitBoxOrient: "vertical",
          }}>
            {question.question}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); onToggleReview(); }}
            title={question.reviewFlag ? "Quitar de revision" : "Marcar para revision"}
            style={{ color: question.reviewFlag ? "oklch(0.30 0 0)" : "oklch(0.70 0 0)", background: "none", border: "none", padding: "4px", cursor: "pointer" }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "oklch(0.20 0 0)")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = question.reviewFlag ? "oklch(0.30 0 0)" : "oklch(0.70 0 0)")}
          >
            {question.reviewFlag ? <Flag size={13} /> : <FlagOff size={13} />}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            style={{ color: "oklch(0.70 0 0)", background: "none", border: "none", padding: "4px", cursor: "pointer" }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "oklch(0.20 0 0)")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "oklch(0.70 0 0)")}
          >
            <Trash2 size={14} />
          </button>
          {expanded ? <ChevronUp size={14} style={{ color: "oklch(0.55 0 0)" }} /> : <ChevronDown size={14} style={{ color: "oklch(0.55 0 0)" }} />}
        </div>
      </div>

      {expanded && (
        <div className="px-5 pb-5 border-t border-border" style={{ background: "oklch(0.98 0 0)" }}>
          <div className="space-y-2 mt-3">
            {opts.map(({ key, text }) => (
              <div key={key} className="flex items-start gap-3 py-2 px-3" style={{
                background: key === question.correctOption ? "oklch(0.92 0 0)" : "transparent",
                border: `1px solid ${key === question.correctOption ? "oklch(0.60 0 0)" : "oklch(0.88 0 0)"}`,
              }}>
                <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: "0.9rem", minWidth: "1.2rem", color: key === question.correctOption ? "oklch(0.20 0 0)" : "oklch(0.50 0 0)" }}>
                  {key}
                </span>
                <span style={{ fontFamily: "'Barlow', sans-serif", fontSize: "0.85rem", lineHeight: 1.5 }}>{text}</span>
              </div>
            ))}
          </div>
          {question.explanation && (
            <div className="mt-3 p-3" style={{ background: "oklch(0.94 0 0)", borderLeft: "3px solid oklch(0.40 0 0)" }}>
              <div className="label-caps mb-1">Explicacion</div>
              <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: "0.83rem", lineHeight: 1.6, color: "oklch(0.25 0 0)" }}>
                {question.explanation}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
