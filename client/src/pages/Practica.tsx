import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { ChevronRight, RotateCcw, CheckCircle, XCircle, BookOpen } from "lucide-react";
import { toast } from "sonner";
import type { Question } from "../../../drizzle/schema";

type SessionState = "config" | "playing" | "finished";

export default function Practica() {
  const { data: topics } = trpc.topics.list.useQuery();
  const startSession = trpc.practice.startSession.useMutation();
  const submitAnswer = trpc.practice.submitAnswer.useMutation();
  const finishSession = trpc.practice.finishSession.useMutation();

  const [state, setState] = useState<SessionState>("config");
  const [config, setConfig] = useState<{
    topicId: number | undefined;
    source: string | undefined;
    count: number;
  }>({
    topicId: undefined,
    source: undefined,
    count: 10,
  });

  const [sessionId, setSessionId] = useState<number | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedOption, setSelectedOption] = useState<"A" | "B" | "C" | "D" | null>(null);
  const [feedback, setFeedback] = useState<{
    isCorrect: boolean;
    correctOption: string;
    explanation: string | null;
  } | null>(null);
  const [results, setResults] = useState<{ correct: number; wrong: number }>({ correct: 0, wrong: 0 });

  const currentQuestion = questions[currentIdx];

  async function handleStart() {
    try {
      const res = await startSession.mutateAsync({
        topicId: config.topicId,
        source: config.source,
        count: config.count,
      });
      setSessionId(res.sessionId);
      setQuestions(res.questions as Question[]);
      setCurrentIdx(0);
      setSelectedOption(null);
      setFeedback(null);
      setResults({ correct: 0, wrong: 0 });
      setState("playing");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al iniciar";
      toast.error(msg);
    }
  }

  async function handleAnswer(option: "A" | "B" | "C" | "D") {
    if (feedback || !sessionId || !currentQuestion) return;
    setSelectedOption(option);

    const res = await submitAnswer.mutateAsync({
      sessionId,
      questionId: currentQuestion.id,
      selectedOption: option,
      topicId: currentQuestion.topicId ?? undefined,
    });

    setFeedback(res);
    setResults((r) => ({
      correct: r.correct + (res.isCorrect ? 1 : 0),
      wrong: r.wrong + (res.isCorrect ? 0 : 1),
    }));
  }

  async function handleNext() {
    if (currentIdx + 1 >= questions.length) {
      // Finish
      if (sessionId) {
        await finishSession.mutateAsync({
          sessionId,
          correct: results.correct + (feedback?.isCorrect ? 0 : 0),
          wrong: results.wrong,
          total: questions.length,
        });
      }
      setState("finished");
    } else {
      setCurrentIdx((i) => i + 1);
      setSelectedOption(null);
      setFeedback(null);
    }
  }

  function handleRestart() {
    setState("config");
    setSessionId(null);
    setQuestions([]);
    setCurrentIdx(0);
    setSelectedOption(null);
    setFeedback(null);
    setResults({ correct: 0, wrong: 0 });
  }

  if (state === "config") {
    return <ConfigScreen topics={topics ?? []} config={config} setConfig={setConfig} onStart={handleStart} loading={startSession.isPending} />;
  }

  if (state === "finished") {
    const total = questions.length;
    const pct = total > 0 ? Math.round((results.correct / total) * 100) : 0;
    return (
      <div className="min-h-screen bg-background">
        <div className="px-6 py-8 border-b border-border" style={{ background: "oklch(1 0 0)" }}>
          <div className="label-caps mb-2">Sesión completada</div>
          <div className="display-lg">Resultado</div>
        </div>
        <div className="p-6 max-w-lg">
          <div className="border border-border bg-card">
            <div className="p-8 border-b border-border" style={{ background: "oklch(0.10 0 0)" }}>
              <div className="stat-number" style={{ color: "oklch(0.97 0 0)" }}>{pct}%</div>
              <div className="label-caps mt-2" style={{ color: "oklch(0.55 0 0)" }}>Precisión</div>
            </div>
            <div className="grid grid-cols-3 divide-x divide-border">
              <div className="p-5 text-center">
                <div className="display-md">{total}</div>
                <div className="label-caps mt-1">Total</div>
              </div>
              <div className="p-5 text-center">
                <div className="display-md">{results.correct}</div>
                <div className="label-caps mt-1">Correctas</div>
              </div>
              <div className="p-5 text-center">
                <div className="display-md">{results.wrong}</div>
                <div className="label-caps mt-1">Errores</div>
              </div>
            </div>
            <div className="p-5 flex gap-3">
              <button onClick={handleRestart} className="btn-industrial flex-1 justify-center">
                <RotateCcw size={14} />
                Nueva sesión
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!currentQuestion) return null;

  const options: Array<{ key: "A" | "B" | "C" | "D"; text: string }> = [
    { key: "A", text: currentQuestion.optionA },
    { key: "B", text: currentQuestion.optionB },
    { key: "C", text: currentQuestion.optionC },
    { key: "D", text: currentQuestion.optionD },
  ];

  const progress = Math.round(((currentIdx + 1) / questions.length) * 100);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="px-6 py-5 border-b border-border" style={{ background: "oklch(1 0 0)" }}>
        <div className="flex items-center justify-between mb-3">
          <div className="label-caps">Modo práctica</div>
          <div className="label-caps">
            {currentIdx + 1} / {questions.length}
          </div>
        </div>
        <div className="progress-bar-track">
          <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="p-6 max-w-2xl">
        {/* Question */}
        <div className="border border-border bg-card mb-4">
          <div
            className="px-5 py-3 border-b border-border flex items-center gap-3"
            style={{ background: "oklch(0.97 0 0)" }}
          >
            <span className="badge-source badge-extracted">
              {currentQuestion.source === "extracted" ? "Examen real" : "Generada IA"}
            </span>
            {currentQuestion.difficulty && (
              <span className="label-caps-sm">{currentQuestion.difficulty}</span>
            )}
          </div>
          <div className="p-5">
            <p
              style={{
                fontFamily: "'Barlow', sans-serif",
                fontSize: "1rem",
                fontWeight: 500,
                lineHeight: 1.6,
                color: "oklch(0.12 0 0)",
              }}
            >
              {currentQuestion.question}
            </p>
          </div>
        </div>

        {/* Options */}
        <div className="space-y-2 mb-4">
          {options.map(({ key, text }) => {
            let cardClass = "option-card";
            if (feedback) {
              if (key === feedback.correctOption) cardClass += " correct";
              else if (key === selectedOption && !feedback.isCorrect) cardClass += " wrong";
            } else if (key === selectedOption) {
              cardClass += " selected";
            }
            return (
              <div
                key={key}
                className={cardClass}
                onClick={() => handleAnswer(key)}
              >
                <span className="option-letter">{key}</span>
                <span
                  style={{
                    fontFamily: "'Barlow', sans-serif",
                    fontSize: "0.9rem",
                    lineHeight: 1.5,
                  }}
                >
                  {text}
                </span>
              </div>
            );
          })}
        </div>

        {/* Feedback */}
        {feedback && (
          <div
            className="border border-border p-5 mb-4"
            style={{
              background: feedback.isCorrect ? "oklch(0.92 0 0)" : "oklch(0.96 0 0)",
              borderColor: feedback.isCorrect ? "oklch(0.35 0 0)" : "oklch(0.65 0 0)",
            }}
          >
            <div className="flex items-center gap-2 mb-2">
              {feedback.isCorrect ? (
                <CheckCircle size={16} style={{ color: "oklch(0.25 0 0)" }} />
              ) : (
                <XCircle size={16} style={{ color: "oklch(0.50 0 0)" }} />
              )}
              <span
                style={{
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontWeight: 900,
                  fontSize: "0.85rem",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: feedback.isCorrect ? "oklch(0.20 0 0)" : "oklch(0.40 0 0)",
                }}
              >
                {feedback.isCorrect ? "Correcto" : `Incorrecto — Respuesta: ${feedback.correctOption}`}
              </span>
            </div>
            {feedback.explanation && (
              <p
                style={{
                  fontFamily: "'Barlow', sans-serif",
                  fontSize: "0.85rem",
                  lineHeight: 1.6,
                  color: "oklch(0.25 0 0)",
                }}
              >
                {feedback.explanation}
              </p>
            )}
          </div>
        )}

        {/* Next button */}
        {feedback && (
          <button onClick={handleNext} className="btn-industrial w-full justify-center">
            {currentIdx + 1 >= questions.length ? "Ver resultado" : "Siguiente pregunta"}
            <ChevronRight size={16} />
          </button>
        )}
      </div>
    </div>
  );
}

function ConfigScreen({
  topics,
  config,
  setConfig,
  onStart,
  loading,
}: {
  topics: Array<{ id: number; name: string; totalAnswered: number }>;
  config: { topicId: number | undefined; source: string | undefined; count: number };
  setConfig: React.Dispatch<React.SetStateAction<typeof config>>;
  onStart: () => void;
  loading: boolean;
}) {
  return (
    <div className="min-h-screen bg-background">
      <div className="px-6 py-8 border-b border-border" style={{ background: "oklch(1 0 0)" }}>
        <div className="label-caps mb-2">Selecciona los parámetros</div>
        <div className="display-lg">Modo práctica</div>
      </div>

      <div className="p-6 max-w-lg">
        <div className="border border-border bg-card">
          <div className="p-6 space-y-5">
            {/* Topic filter */}
            <div>
              <div className="label-caps mb-2">Bloque temático</div>
              <select
                value={config.topicId ?? ""}
                onChange={(e) =>
                  setConfig((c) => ({
                    ...c,
                    topicId: e.target.value ? Number(e.target.value) : undefined,
                  }))
                }
                className="w-full border border-border px-3 py-2 bg-background text-foreground"
                style={{ fontFamily: "'Barlow', sans-serif", fontSize: "0.85rem", outline: "none" }}
              >
                <option value="">Todos los bloques</option>
                {topics.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.totalAnswered} respondidas)
                  </option>
                ))}
              </select>
            </div>

            {/* Source filter */}
            <div>
              <div className="label-caps mb-2">Fuente de preguntas</div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: undefined, label: "Todas" },
                  { value: "extracted", label: "Exámenes reales" },
                  { value: "ai_generated", label: "Generadas IA" },
                ].map((opt) => (
                  <button
                    key={String(opt.value)}
                    onClick={() => setConfig((c) => ({ ...c, source: opt.value }))}
                    className="py-2 px-3 border"
                    style={{
                      fontFamily: "'Barlow Condensed', sans-serif",
                      fontWeight: 700,
                      fontSize: "0.72rem",
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      background: config.source === opt.value ? "oklch(0.10 0 0)" : "transparent",
                      color: config.source === opt.value ? "oklch(0.97 0 0)" : "oklch(0.40 0 0)",
                      borderColor: config.source === opt.value ? "oklch(0.10 0 0)" : "oklch(0.82 0 0)",
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Count */}
            <div>
              <div className="label-caps mb-2">Número de preguntas: {config.count}</div>
              <input
                type="range"
                min={5}
                max={50}
                step={5}
                value={config.count}
                onChange={(e) => setConfig((c) => ({ ...c, count: Number(e.target.value) }))}
                className="w-full"
                style={{ accentColor: "oklch(0.10 0 0)" }}
              />
              <div className="flex justify-between label-caps-sm mt-1">
                <span>5</span>
                <span>50</span>
              </div>
            </div>
          </div>

          <div className="px-6 pb-6">
            <button
              onClick={onStart}
              disabled={loading}
              className="btn-industrial w-full justify-center"
            >
              <BookOpen size={16} />
              {loading ? "Preparando..." : "Comenzar sesión"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
