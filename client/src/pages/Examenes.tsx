import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { CheckCircle, XCircle, Minus, ChevronRight, RotateCcw, Trophy, TrendingDown, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { Link } from "wouter";

type ExamState = "config" | "exam" | "result" | "history_result";

type Question = {
  id: number;
  question: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: string;
  explanation: string | null;
  topicId: number | null;
  difficulty: string | null;
};

type Answer = {
  questionId: number;
  selectedOption: "A" | "B" | "C" | "D" | "blank";
};

const PENALTY_OPTIONS = [
  { label: "Sin penalización (0)", value: "0" },
  { label: "Penalización 1/4 (−0.25)", value: "0.25" },
  { label: "Penalización 1/3 (−0.33)", value: "0.33" },
  { label: "Penalización 1/2 (−0.50)", value: "0.5" },
];

export default function Examenes() {
  const [state, setState] = useState<ExamState>("config");
  const [examId, setExamId] = useState<number | null>(null);
  const [historyExamId, setHistoryExamId] = useState<number | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Map<number, Answer>>(new Map());
  const [currentIdx, setCurrentIdx] = useState(0);

  const { data: topics } = trpc.topics.list.useQuery();
  const { data: examList, refetch: refetchList } = trpc.exam.list.useQuery();
  const startExam = trpc.exam.start.useMutation();
  const submitAnswer = trpc.exam.submitAnswer.useMutation();
  const finishExam = trpc.exam.finish.useMutation();

  const { data: result } = trpc.exam.getResult.useQuery(
    { examSessionId: examId! },
    { enabled: state === "result" && examId !== null }
  );

  const { data: historyResult } = trpc.exam.getResult.useQuery(
    { examSessionId: historyExamId! },
    { enabled: state === "history_result" && historyExamId !== null }
  );

  const handleViewHistory = (id: number) => {
    setHistoryExamId(id);
    setState("history_result");
  };

  const [config, setConfig] = useState<{
    title: string;
    topicIds: number[];
    source: string;
    count: number;
    penaltyPerError: string;
  }>({
    title: `Examen ${new Date().toLocaleDateString("es-ES")}`,
    topicIds: [],
    source: "all",
    count: 20,
    penaltyPerError: "0.25",
  });

  const handleStart = async () => {
    try {
      const res = await startExam.mutateAsync(config);
      setExamId(res.examId);
      setQuestions(res.questions as Question[]);
      setAnswers(new Map());
      setCurrentIdx(0);
      setState("exam");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error al iniciar el examen";
      toast.error(message);
    }
  };

  const handleSelectOption = async (option: "A" | "B" | "C" | "D" | "blank") => {
    if (!examId) return;
    const q = questions[currentIdx];
    if (!q) return;
    if (answers.has(q.id)) return; // ya respondida

    const newAnswers = new Map(answers);
    newAnswers.set(q.id, { questionId: q.id, selectedOption: option });
    setAnswers(newAnswers);

    await submitAnswer.mutateAsync({
      examSessionId: examId,
      questionId: q.id,
      selectedOption: option,
    });
  };

  const handleFinish = async () => {
    if (!examId) return;
    // Submit blank for unanswered questions
    for (const q of questions) {
      if (!answers.has(q.id)) {
        await submitAnswer.mutateAsync({
          examSessionId: examId,
          questionId: q.id,
          selectedOption: "blank",
        });
      }
    }
    await finishExam.mutateAsync({ examSessionId: examId });
    await refetchList();
    setState("result");
  };

  const handleReset = () => {
    setExamId(null);
    setQuestions([]);
    setAnswers(new Map());
    setCurrentIdx(0);
    setConfig({
      title: `Examen ${new Date().toLocaleDateString("es-ES")}`,
      topicIds: [],
      source: "all",
      count: 20,
      penaltyPerError: "0.25",
    });
    setState("config");
  };

  if (state === "history_result") {
    if (!historyResult) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="label-caps">Cargando resultados...</div>
        </div>
      );
    }
    // Reuse the result screen with historyResult
    return (
      <ResultScreen
        result={historyResult}
        title={historyResult.session.title ?? "Examen anterior"}
        onReset={() => { setHistoryExamId(null); setState("config"); }}
      />
    );
  }

  if (state === "config") {
    return <ConfigScreen topics={topics ?? []} config={config} setConfig={setConfig} onStart={handleStart} loading={startExam.isPending} examList={examList ?? []} onViewHistory={handleViewHistory} />;
  }

  if (state === "exam") {
    const q = questions[currentIdx];
    const answered = answers.get(q?.id ?? -1);
    const answeredCount = answers.size;
    const progress = Math.round(((currentIdx + 1) / questions.length) * 100);

    return (
      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border" style={{ background: "oklch(1 0 0)" }}>
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="label-caps mb-1">{config.title}</div>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: "0.85rem", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                {currentIdx + 1} / {questions.length}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="label-caps-sm">
                <span style={{ color: "oklch(0.20 0 0)", fontWeight: 700 }}>{answeredCount}</span> respondidas · <span style={{ color: "oklch(0.55 0 0)" }}>{questions.length - answeredCount}</span> pendientes
              </div>
              <button
                onClick={handleFinish}
                disabled={finishExam.isPending}
                className="btn-industrial"
                style={{ fontSize: "0.72rem" }}
              >
                {finishExam.isPending ? "Finalizando..." : "Finalizar examen"}
              </button>
            </div>
          </div>
          <div className="progress-bar-track">
            <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
          </div>
        </div>

        {/* Question navigator */}
        <div className="px-6 py-3 border-b border-border overflow-x-auto" style={{ background: "oklch(0.97 0 0)" }}>
          <div className="flex gap-1">
            {questions.map((q, i) => {
              const ans = answers.get(q.id);
              return (
                <button
                  key={q.id}
                  onClick={() => setCurrentIdx(i)}
                  style={{
                    width: "28px",
                    height: "28px",
                    fontFamily: "'Barlow Condensed', sans-serif",
                    fontWeight: 700,
                    fontSize: "0.72rem",
                    border: i === currentIdx ? "2px solid oklch(0.10 0 0)" : "1px solid oklch(0.82 0 0)",
                    background: ans
                      ? ans.selectedOption === "blank"
                        ? "oklch(0.88 0 0)"
                        : "oklch(0.25 0 0)"
                      : "oklch(1 0 0)",
                    color: ans && ans.selectedOption !== "blank" ? "oklch(0.97 0 0)" : "oklch(0.30 0 0)",
                    cursor: "pointer",
                    flexShrink: 0,
                  }}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
        </div>

        {/* Question */}
        {q && (
          <div className="p-6 max-w-2xl">
            <div className="border border-border bg-card mb-4">
              <div className="px-5 py-3 border-b border-border flex items-center justify-between" style={{ background: "oklch(0.97 0 0)" }}>
                <span className="label-caps">Pregunta {currentIdx + 1}</span>
                {q.difficulty && (
                  <span className="badge-source badge-extracted">{q.difficulty}</span>
                )}
              </div>
              <div className="p-5">
                <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: "0.95rem", lineHeight: 1.7, color: "oklch(0.10 0 0)" }}>
                  {q.question}
                </p>
              </div>
            </div>

            <div className="space-y-2 mb-5">
              {(["A", "B", "C", "D"] as const).map((opt) => {
                const optText = q[`option${opt}` as keyof Question] as string;
                const isSelected = answered?.selectedOption === opt;
                return (
                  <button
                    key={opt}
                    onClick={() => handleSelectOption(opt)}
                    disabled={!!answered}
                    className={`option-card w-full text-left ${isSelected ? "selected" : ""}`}
                    style={{ opacity: answered && !isSelected ? 0.6 : 1 }}
                  >
                    <span className="option-letter">{opt}</span>
                    <span style={{ fontFamily: "'Barlow', sans-serif", fontSize: "0.88rem", lineHeight: 1.5 }}>{optText}</span>
                  </button>
                );
              })}
            </div>

            {/* Dejar en blanco */}
            {!answered && (
              <button
                onClick={() => handleSelectOption("blank")}
                className="btn-industrial-outline w-full justify-center"
                style={{ fontSize: "0.72rem" }}
              >
                <Minus size={13} />
                Dejar en blanco
              </button>
            )}

            {/* Navigation */}
            <div className="flex justify-between mt-5">
              <button
                onClick={() => setCurrentIdx(Math.max(0, currentIdx - 1))}
                disabled={currentIdx === 0}
                className="btn-industrial-outline"
                style={{ fontSize: "0.72rem" }}
              >
                ← Anterior
              </button>
              <button
                onClick={() => setCurrentIdx(Math.min(questions.length - 1, currentIdx + 1))}
                disabled={currentIdx === questions.length - 1}
                className="btn-industrial"
                style={{ fontSize: "0.72rem" }}
              >
                Siguiente →
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Result screen
  if (state === "result" && result) {
    return <ResultScreen result={result} title={result.session.title} onReset={handleReset} />;
  }

  return null;
}

// ── Result Screen ──────────────────────────────────────────────────

type ExamResult = {
  session: {
    id: number;
    title: string;
    totalQuestions: number;
    correctAnswers: number;
    wrongAnswers: number;
    blankAnswers: number;
    finalScore: string | null;
    penaltyPerError: string | null;
    startedAt: Date;
  };
  answers: Array<{
    id: number;
    question: string;
    optionA: string;
    optionB: string;
    optionC: string;
    optionD: string;
    correctOption: string;
    selectedOption: string;
    isCorrect: boolean;
    explanation: string | null;
    topicName: string | null;
  }>;
  topicStats: Array<{ topicId: number | string | null; name: string; correct: number; wrong: number; blank: number; total: number; pct: number }>;
  bestTopic: { topicId: number | string | null; name: string; correct: number; total: number; pct: number } | null;
  worstTopic: { topicId: number | string | null; name: string; correct: number; total: number; pct: number } | null;
};

function ResultScreen({ result, title, onReset }: { result: ExamResult; title: string; onReset: () => void }) {
    const { session, answers: examAnswers, topicStats, bestTopic, worstTopic } = result;
    const total = session.totalQuestions;
    const correct = session.correctAnswers;
    const wrong = session.wrongAnswers;
    const blank = session.blankAnswers;
    const finalScore = parseFloat(session.finalScore ?? "0");
    const maxScore = total;
    const pct = maxScore > 0 ? Math.round((finalScore / maxScore) * 100) : 0;

    const wrongAnswers = examAnswers.filter((a) => !a.isCorrect && a.selectedOption !== "blank");
    const blankAnswers = examAnswers.filter((a) => a.selectedOption === "blank");

    return (
      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="px-6 py-8 border-b border-border" style={{ background: "oklch(1 0 0)" }}>
          <div className="label-caps mb-2">Resultado del examen</div>
          <div className="display-lg">{session.title}</div>
          <div className="label-caps-sm mt-1">{new Date(session.startedAt).toLocaleString("es-ES")}</div>
        </div>

        <div className="p-6 space-y-6">
          {/* Score hero */}
          <div className="border border-border bg-card">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-0">
              <div className="p-6 border-r border-border">
                <div className="label-caps mb-2">Nota final</div>
                <div className="stat-number">{finalScore.toFixed(2)}</div>
                <div className="label-caps-sm mt-1">sobre {maxScore}</div>
              </div>
              <div className="p-6 border-r border-border">
                <div className="label-caps mb-2 flex items-center gap-1">
                  <CheckCircle size={11} /> Correctas
                </div>
                <div className="stat-number" style={{ color: "oklch(0.20 0 0)" }}>{correct}</div>
                <div className="label-caps-sm mt-1">{total > 0 ? Math.round((correct / total) * 100) : 0}% del total</div>
              </div>
              <div className="p-6 border-r border-border">
                <div className="label-caps mb-2 flex items-center gap-1">
                  <XCircle size={11} /> Falladas
                </div>
                <div className="stat-number" style={{ color: "oklch(0.50 0 0)" }}>{wrong}</div>
                <div className="label-caps-sm mt-1">−{(wrong * parseFloat(session.penaltyPerError ?? "0.25")).toFixed(2)} pts</div>
              </div>
              <div className="p-6">
                <div className="label-caps mb-2 flex items-center gap-1">
                  <Minus size={11} /> En blanco
                </div>
                <div className="stat-number" style={{ color: "oklch(0.65 0 0)" }}>{blank}</div>
                <div className="label-caps-sm mt-1">sin penalización</div>
              </div>
            </div>
            <div className="px-6 pb-5">
              <div className="flex justify-between label-caps mb-1">
                <span>Precisión</span>
                <span>{pct}%</span>
              </div>
              <div className="progress-bar-track" style={{ height: "8px" }}>
                <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
              </div>
            </div>
          </div>

          {/* Best / Worst topic */}
          {topicStats.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {bestTopic && (
                <div className="border border-border bg-card p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingUp size={14} style={{ color: "oklch(0.25 0 0)" }} />
                    <span className="label-caps">Mejor preparado</span>
                  </div>
                  <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: "1.2rem", textTransform: "uppercase", letterSpacing: "-0.01em" }}>
                    {bestTopic.name}
                  </div>
                  <div className="label-caps-sm mt-1">{bestTopic.correct}/{bestTopic.total} correctas · {bestTopic.pct}%</div>
                </div>
              )}
              {worstTopic && worstTopic.topicId !== bestTopic?.topicId && (
                <div className="border border-border bg-card p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingDown size={14} style={{ color: "oklch(0.55 0 0)" }} />
                    <span className="label-caps">Peor preparado</span>
                  </div>
                  <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: "1.2rem", textTransform: "uppercase", letterSpacing: "-0.01em", color: "oklch(0.40 0 0)" }}>
                    {worstTopic.name}
                  </div>
                  <div className="label-caps-sm mt-1">{worstTopic.correct}/{worstTopic.total} correctas · {worstTopic.pct}%</div>
                </div>
              )}
            </div>
          )}

          {/* Per-topic breakdown */}
          {topicStats.length > 0 && (
            <div className="border border-border bg-card">
              <div className="px-5 py-4 border-b border-border" style={{ background: "oklch(0.97 0 0)" }}>
                <span className="label-caps">Desglose por bloque temático</span>
              </div>
              {[...topicStats].reverse().map((t) => (
                <div key={t.topicId} className="px-5 py-4 border-b border-border last:border-b-0">
                  <div className="flex items-center justify-between mb-1">
                    <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: "0.85rem", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                      {t.name}
                    </span>
                    <div className="flex items-center gap-4">
                      <span className="label-caps-sm">{t.correct}✓ {t.wrong}✗ {t.blank}—</span>
                      <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: "1.1rem", color: t.pct >= 70 ? "oklch(0.20 0 0)" : t.pct >= 50 ? "oklch(0.40 0 0)" : "oklch(0.55 0 0)" }}>
                        {t.pct}%
                      </span>
                    </div>
                  </div>
                  <div className="progress-bar-track">
                    <div className="progress-bar-fill" style={{ width: `${t.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Wrong answers review */}
          {wrongAnswers.length > 0 && (
            <div className="border border-border bg-card">
              <div className="px-5 py-4 border-b border-border" style={{ background: "oklch(0.97 0 0)" }}>
                <span className="label-caps">Preguntas falladas ({wrongAnswers.length})</span>
              </div>
              {wrongAnswers.map((a, i) => (
                <ReviewItem key={a.id} answer={a} index={i} type="wrong" />
              ))}
            </div>
          )}

          {/* Blank answers review */}
          {blankAnswers.length > 0 && (
            <div className="border border-border bg-card">
              <div className="px-5 py-4 border-b border-border" style={{ background: "oklch(0.97 0 0)" }}>
                <span className="label-caps">Preguntas en blanco ({blankAnswers.length})</span>
              </div>
              {blankAnswers.map((a, i) => (
                <ReviewItem key={a.id} answer={a} index={i} type="blank" />
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button onClick={onReset} className="btn-industrial">
              <RotateCcw size={14} />
              Nuevo examen
            </button>
            <Link href="/progreso" className="btn-industrial-outline">
              <Trophy size={14} />
              Ver progreso
            </Link>
          </div>
        </div>
      </div>
    );
}

// ── Config Screen ──────────────────────────────────────────────────

function ConfigScreen({
  topics,
  config,
  setConfig,
  onStart,
  loading,
  examList,
  onViewHistory,
}: {
  topics: Array<{ id: number; name: string }>;
  config: { title: string; topicIds: number[]; source: string; count: number; penaltyPerError: string };
  setConfig: React.Dispatch<React.SetStateAction<typeof config>>;
  onStart: () => void;
  loading: boolean;
  examList: Array<{ id: number; title: string; status: string; finalScore: string | null; totalQuestions: number; correctAnswers: number; startedAt: Date }>;
  onViewHistory: (id: number) => void;
}) {
  const toggleTopic = (id: number) => {
    setConfig((c) => ({
      ...c,
      topicIds: c.topicIds.includes(id) ? c.topicIds.filter((t) => t !== id) : [...c.topicIds, id],
    }));
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="px-6 py-8 border-b border-border" style={{ background: "oklch(1 0 0)" }}>
        <div className="label-caps mb-2">Crear nuevo examen</div>
        <div className="display-lg">Exámenes</div>
      </div>

      <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Config form */}
        <div className="space-y-5">
          <div className="border border-border bg-card">
            <div className="px-5 py-4 border-b border-border" style={{ background: "oklch(0.97 0 0)" }}>
              <span className="label-caps">Configuración del examen</span>
            </div>
            <div className="p-5 space-y-5">
              {/* Title */}
              <div>
                <div className="label-caps mb-2">Nombre del examen</div>
                <input
                  type="text"
                  value={config.title}
                  onChange={(e) => setConfig((c) => ({ ...c, title: e.target.value }))}
                  className="w-full border border-border px-3 py-2 bg-background text-foreground"
                  style={{ fontFamily: "'Barlow', sans-serif", fontSize: "0.88rem", outline: "none" }}
                />
              </div>

              {/* Topics */}
              <div>
                <div className="label-caps mb-2">Bloques temáticos <span className="label-caps-sm">(vacío = todos)</span></div>
                {topics.length === 0 ? (
                  <div className="label-caps-sm">No hay bloques temáticos. Genera preguntas primero.</div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {topics.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => toggleTopic(t.id)}
                        style={{
                          padding: "0.3rem 0.7rem",
                          fontFamily: "'Barlow Condensed', sans-serif",
                          fontWeight: 700,
                          fontSize: "0.72rem",
                          letterSpacing: "0.1em",
                          textTransform: "uppercase",
                          border: config.topicIds.includes(t.id) ? "2px solid oklch(0.10 0 0)" : "1px solid oklch(0.82 0 0)",
                          background: config.topicIds.includes(t.id) ? "oklch(0.10 0 0)" : "oklch(1 0 0)",
                          color: config.topicIds.includes(t.id) ? "oklch(0.97 0 0)" : "oklch(0.30 0 0)",
                          cursor: "pointer",
                        }}
                      >
                        {t.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Source */}
              <div>
                <div className="label-caps mb-2">Fuente de preguntas</div>
                <select
                  value={config.source}
                  onChange={(e) => setConfig((c) => ({ ...c, source: e.target.value }))}
                  className="w-full border border-border px-3 py-2 bg-background text-foreground"
                  style={{ fontFamily: "'Barlow', sans-serif", fontSize: "0.88rem", outline: "none" }}
                >
                  <option value="all">Todas (exámenes reales + IA)</option>
                  <option value="extracted">Solo exámenes reales</option>
                  <option value="ai_generated">Solo generadas por IA</option>
                </select>
              </div>

              {/* Count */}
              <div>
                <div className="label-caps mb-2">Número de preguntas: <strong>{config.count}</strong></div>
                <input
                  type="range"
                  min={5}
                  max={100}
                  step={5}
                  value={config.count}
                  onChange={(e) => setConfig((c) => ({ ...c, count: Number(e.target.value) }))}
                  className="w-full"
                  style={{ accentColor: "oklch(0.10 0 0)" }}
                />
                <div className="flex justify-between label-caps-sm mt-1">
                  <span>5</span><span>100</span>
                </div>
              </div>

              {/* Penalty */}
              <div>
                <div className="label-caps mb-2">Penalización por error</div>
                <div className="grid grid-cols-2 gap-2">
                  {PENALTY_OPTIONS.map((p) => (
                    <button
                      key={p.value}
                      onClick={() => setConfig((c) => ({ ...c, penaltyPerError: p.value }))}
                      style={{
                        padding: "0.5rem 0.75rem",
                        fontFamily: "'Barlow Condensed', sans-serif",
                        fontWeight: 700,
                        fontSize: "0.72rem",
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        border: config.penaltyPerError === p.value ? "2px solid oklch(0.10 0 0)" : "1px solid oklch(0.82 0 0)",
                        background: config.penaltyPerError === p.value ? "oklch(0.10 0 0)" : "oklch(1 0 0)",
                        color: config.penaltyPerError === p.value ? "oklch(0.97 0 0)" : "oklch(0.30 0 0)",
                        cursor: "pointer",
                        textAlign: "left",
                      }}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <button onClick={onStart} disabled={loading} className="btn-industrial w-full justify-center">
                <ChevronRight size={16} />
                {loading ? "Preparando examen..." : "Iniciar examen"}
              </button>
            </div>
          </div>
        </div>

        {/* Exam history */}
        <div>
          <div className="border border-border bg-card">
            <div className="px-5 py-4 border-b border-border" style={{ background: "oklch(0.97 0 0)" }}>
              <span className="label-caps">Historial de exámenes</span>
            </div>
            {examList.length === 0 ? (
              <div className="p-8 text-center">
                <div className="label-caps mb-1">Sin exámenes realizados</div>
                <div className="label-caps-sm">Los resultados aparecerán aquí</div>
              </div>
            ) : (
              <div>
                {examList.map((exam) => {
                  const pct = exam.totalQuestions > 0 ? Math.round((exam.correctAnswers / exam.totalQuestions) * 100) : 0;
                  return (
                    <div key={exam.id} className="px-5 py-4 border-b border-border last:border-b-0">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex-1 min-w-0">
                          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: "0.85rem", letterSpacing: "0.05em", textTransform: "uppercase", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {exam.title}
                          </div>
                          <div className="label-caps-sm">{new Date(exam.startedAt).toLocaleDateString("es-ES")}</div>
                        </div>
                        <div className="flex items-center gap-3 ml-3">
                          <div className="text-right">
                            {exam.status === "finished" ? (
                              <>
                                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: "1.1rem", letterSpacing: "-0.01em" }}>
                                  {exam.finalScore ?? "—"}
                                </div>
                                <div className="label-caps-sm">{pct}% precisión</div>
                              </>
                            ) : (
                              <span className="badge-source badge-ai">En curso</span>
                            )}
                          </div>
                          {exam.status === "finished" && (
                            <button
                              onClick={() => onViewHistory(exam.id)}
                              className="btn-industrial-outline"
                              style={{ fontSize: "0.65rem", padding: "0.25rem 0.5rem", flexShrink: 0 }}
                            >
                              Ver
                            </button>
                          )}
                        </div>
                      </div>
                      {exam.status === "finished" && (
                        <div className="progress-bar-track mt-1">
                          <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Review Item ────────────────────────────────────────────────────

function ReviewItem({
  answer,
  index,
  type,
}: {
  answer: {
    question: string;
    optionA: string;
    optionB: string;
    optionC: string;
    optionD: string;
    correctOption: string;
    selectedOption: string;
    explanation: string | null;
    topicName: string | null;
  };
  index: number;
  type: "wrong" | "blank";
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border-b border-border last:border-b-0">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-5 py-4 text-left flex items-start gap-3"
        style={{ background: "none", border: "none", cursor: "pointer" }}
      >
        <div style={{ minWidth: "1.5rem", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: "0.85rem", color: "oklch(0.65 0 0)", lineHeight: 1.5 }}>
          {index + 1}
        </div>
        <div className="flex-1">
          <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: "0.85rem", lineHeight: 1.5, color: "oklch(0.15 0 0)", textAlign: "left" }}>
            {answer.question}
          </p>
          {answer.topicName && (
            <div className="label-caps-sm mt-1">{answer.topicName}</div>
          )}
        </div>
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: "0.72rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "oklch(0.55 0 0)", minWidth: "1.5rem" }}>
          {expanded ? "▲" : "▼"}
        </div>
      </button>
      {expanded && (
        <div className="px-5 pb-4 ml-9">
          <div className="space-y-1 mb-3">
            {(["A", "B", "C", "D"] as const).map((opt) => {
              const optText = answer[`option${opt}` as keyof typeof answer] as string;
              const isCorrect = answer.correctOption === opt;
              const isSelected = answer.selectedOption === opt;
              return (
                <div
                  key={opt}
                  style={{
                    display: "flex",
                    gap: "0.5rem",
                    padding: "0.4rem 0.6rem",
                    background: isCorrect ? "oklch(0.91 0 0)" : isSelected ? "oklch(0.94 0 0)" : "transparent",
                    border: isCorrect ? "1px solid oklch(0.50 0 0)" : "1px solid transparent",
                  }}
                >
                  <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: "0.85rem", minWidth: "1rem", color: isCorrect ? "oklch(0.20 0 0)" : "oklch(0.55 0 0)" }}>
                    {opt}
                  </span>
                  <span style={{ fontFamily: "'Barlow', sans-serif", fontSize: "0.82rem", color: isCorrect ? "oklch(0.15 0 0)" : "oklch(0.40 0 0)" }}>
                    {optText}
                    {isCorrect && " ✓"}
                    {isSelected && !isCorrect && " ✗"}
                  </span>
                </div>
              );
            })}
          </div>
          {answer.explanation && (
            <div style={{ background: "oklch(0.95 0 0)", padding: "0.75rem", borderLeft: "3px solid oklch(0.40 0 0)" }}>
              <div className="label-caps mb-1">Explicación</div>
              <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: "0.82rem", lineHeight: 1.6, color: "oklch(0.30 0 0)" }}>
                {answer.explanation}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
