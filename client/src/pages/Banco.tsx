import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { Trash2, Cpu, Plus, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import type { Question } from "../../../drizzle/schema";

export default function Banco() {
  const utils = trpc.useUtils();
  const { data: topics } = trpc.topics.list.useQuery();
  const [filterTopic, setFilterTopic] = useState<number | undefined>();
  const [filterSource, setFilterSource] = useState<string | undefined>();
  const [filterDocType, setFilterDocType] = useState<string | undefined>();

  const { data: questions, isLoading } = trpc.questions.list.useQuery({
    topicId: filterTopic,
    source: filterSource,
    docType: filterDocType,
    limit: 100,
  });

  const deleteMut = trpc.questions.delete.useMutation({
    onSuccess: () => {
      utils.questions.list.invalidate();
      utils.stats.overview.invalidate();
    },
  });

  const generateMut = trpc.questions.generate.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.count} preguntas generadas`);
      utils.questions.list.invalidate();
      utils.topics.list.invalidate();
      utils.stats.overview.invalidate();
      setGenForm({ topicName: "", count: 5, difficulty: undefined });
    },
    onError: (err) => toast.error(`Error: ${err.message}`),
  });

  const [showGenForm, setShowGenForm] = useState(false);
  const [genForm, setGenForm] = useState<{
    topicName: string;
    count: number;
    difficulty: "facil" | "medio" | "dificil" | undefined;
  }>({ topicName: "", count: 5, difficulty: undefined });

  const [expandedId, setExpandedId] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
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
            style={{
              background: "oklch(0.10 0 0)",
              border: "none",
              cursor: "pointer",
            }}
          >
            <div className="flex items-center gap-2">
              <Cpu size={14} style={{ color: "oklch(0.60 0 0)" }} />
              <span className="label-caps" style={{ color: "oklch(0.60 0 0)" }}>
                Generar preguntas con IA
              </span>
            </div>
            {showGenForm ? (
              <ChevronUp size={14} style={{ color: "oklch(0.50 0 0)" }} />
            ) : (
              <ChevronDown size={14} style={{ color: "oklch(0.50 0 0)" }} />
            )}
          </button>

          {showGenForm && (
            <div className="p-5 border-t border-border">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                <div className="sm:col-span-1">
                  <div className="label-caps mb-2">Bloque temático</div>
                  <input
                    type="text"
                    placeholder="ej: Estructuras, CTE, Instalaciones..."
                    value={genForm.topicName}
                    onChange={(e) => setGenForm((f) => ({ ...f, topicName: e.target.value }))}
                    list="topics-datalist"
                    className="w-full border border-border px-3 py-2 bg-background text-foreground"
                    style={{ fontFamily: "'Barlow', sans-serif", fontSize: "0.85rem", outline: "none" }}
                  />
                  <datalist id="topics-datalist">
                    {topics?.map((t) => <option key={t.id} value={t.name} />)}
                  </datalist>
                </div>
                <div>
                  <div className="label-caps mb-2">Número: {genForm.count}</div>
                  <input
                    type="range"
                    min={1}
                    max={20}
                    value={genForm.count}
                    onChange={(e) => setGenForm((f) => ({ ...f, count: Number(e.target.value) }))}
                    className="w-full mt-2"
                    style={{ accentColor: "oklch(0.10 0 0)" }}
                  />
                </div>
                <div>
                  <div className="label-caps mb-2">Dificultad</div>
                  <select
                    value={genForm.difficulty ?? ""}
                    onChange={(e) =>
                      setGenForm((f) => ({
                        ...f,
                        difficulty: (e.target.value || undefined) as typeof genForm.difficulty,
                      }))
                    }
                    className="w-full border border-border px-3 py-2 bg-background text-foreground"
                    style={{ fontFamily: "'Barlow', sans-serif", fontSize: "0.85rem", outline: "none" }}
                  >
                    <option value="">Mixta</option>
                    <option value="facil">Fácil</option>
                    <option value="medio">Medio</option>
                    <option value="dificil">Difícil</option>
                  </select>
                </div>
              </div>
              <button
                onClick={() => {
                  if (!genForm.topicName.trim()) {
                    toast.error("Indica un bloque temático");
                    return;
                  }
                  generateMut.mutate({
                    topicName: genForm.topicName,
                    count: genForm.count,
                    difficulty: genForm.difficulty,
                  });
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
          <select
            value={filterTopic ?? ""}
            onChange={(e) => setFilterTopic(e.target.value ? Number(e.target.value) : undefined)}
            className="border border-border px-3 py-2 bg-background text-foreground"
            style={{ fontFamily: "'Barlow', sans-serif", fontSize: "0.8rem", outline: "none" }}
          >
            <option value="">Todos los bloques</option>
            {topics?.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <div className="flex gap-1">
            {[
              { value: undefined, label: "Todas" },
              { value: "extracted", label: "Exámenes" },
              { value: "ai_generated", label: "IA" },
            ].map((opt) => (
              <button
                key={String(opt.value)}
                onClick={() => { setFilterSource(opt.value); setFilterDocType(undefined); }}
                style={{
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontWeight: 700,
                  fontSize: "0.72rem",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  padding: "0.4rem 0.8rem",
                  background: filterSource === opt.value && !filterDocType ? "oklch(0.10 0 0)" : "transparent",
                  color: filterSource === opt.value && !filterDocType ? "oklch(0.97 0 0)" : "oklch(0.40 0 0)",
                  border: `1px solid ${filterSource === opt.value && !filterDocType ? "oklch(0.10 0 0)" : "oklch(0.82 0 0)"}`,
                  cursor: "pointer",
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {/* Filter by document origin type */}
          <div className="flex gap-1">
            {[
              { value: undefined, label: "Origen: todos" },
              { value: "convocatoria", label: "Convocatoria" },
              { value: "examen", label: "Examen" },
              { value: "tema", label: "Tema" },
            ].map((opt) => (
              <button
                key={String(opt.value)}
                onClick={() => { setFilterDocType(opt.value); if (opt.value) setFilterSource(undefined); }}
                style={{
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontWeight: 700,
                  fontSize: "0.72rem",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  padding: "0.4rem 0.8rem",
                  background: filterDocType === opt.value ? "oklch(0.30 0 0)" : "transparent",
                  color: filterDocType === opt.value ? "oklch(0.97 0 0)" : "oklch(0.55 0 0)",
                  border: `1px solid ${filterDocType === opt.value ? "oklch(0.30 0 0)" : "oklch(0.88 0 0)"}`,
                  cursor: "pointer",
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <span className="label-caps-sm ml-auto">
            {questions?.length ?? 0} preguntas
          </span>
        </div>

        {/* Question list */}
        <div className="border border-border bg-card">
          {isLoading ? (
            <div className="p-8 text-center label-caps">Cargando...</div>
          ) : !questions || questions.length === 0 ? (
            <div className="p-8 text-center">
              <div className="label-caps mb-1">Sin preguntas</div>
              <div className="label-caps-sm">Sube un examen PDF o genera preguntas con IA</div>
            </div>
          ) : (
            questions.map((q: Question) => (
              <QuestionRow
                key={q.id}
                question={q}
                expanded={expandedId === q.id}
                onToggle={() => setExpandedId(expandedId === q.id ? null : q.id)}
                onDelete={() => deleteMut.mutate({ id: q.id })}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function QuestionRow({
  question,
  expanded,
  onToggle,
  onDelete,
}: {
  question: Question;
  expanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const opts = [
    { key: "A", text: question.optionA },
    { key: "B", text: question.optionB },
    { key: "C", text: question.optionC },
    { key: "D", text: question.optionD },
  ];

  return (
    <div className="border-b border-border last:border-b-0">
      <div
        className="px-5 py-4 flex items-start gap-4 cursor-pointer"
        onClick={onToggle}
        style={{ background: expanded ? "oklch(0.97 0 0)" : "oklch(1 0 0)" }}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span
              className={`badge-source ${question.source === "extracted" ? "badge-extracted" : "badge-ai"}`}
            >
              {question.source === "extracted" ? "Examen" : "IA"}
            </span>
            {question.difficulty && (
              <span className="label-caps-sm">{question.difficulty}</span>
            )}
          </div>
          <p
            style={{
              fontFamily: "'Barlow', sans-serif",
              fontSize: "0.88rem",
              lineHeight: 1.5,
              color: "oklch(0.15 0 0)",
              overflow: "hidden",
              display: "-webkit-box",
              WebkitLineClamp: expanded ? "unset" : 2,
              WebkitBoxOrient: "vertical",
            }}
          >
            {question.question}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            style={{ color: "oklch(0.70 0 0)", background: "none", border: "none", padding: "4px" }}
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
              <div
                key={key}
                className="flex items-start gap-3 py-2 px-3"
                style={{
                  background: key === question.correctOption ? "oklch(0.92 0 0)" : "transparent",
                  border: `1px solid ${key === question.correctOption ? "oklch(0.60 0 0)" : "oklch(0.88 0 0)"}`,
                }}
              >
                <span
                  style={{
                    fontFamily: "'Barlow Condensed', sans-serif",
                    fontWeight: 900,
                    fontSize: "0.9rem",
                    minWidth: "1.2rem",
                    color: key === question.correctOption ? "oklch(0.20 0 0)" : "oklch(0.50 0 0)",
                  }}
                >
                  {key}
                </span>
                <span style={{ fontFamily: "'Barlow', sans-serif", fontSize: "0.85rem", lineHeight: 1.5 }}>
                  {text}
                </span>
              </div>
            ))}
          </div>
          {question.explanation && (
            <div
              className="mt-3 p-3"
              style={{ background: "oklch(0.94 0 0)", borderLeft: "3px solid oklch(0.40 0 0)" }}
            >
              <div className="label-caps mb-1">Explicación</div>
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
