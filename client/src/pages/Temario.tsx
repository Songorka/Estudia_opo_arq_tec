import { trpc } from "@/lib/trpc";
import { useState } from "react";
import {
  BookOpen, FileText, CheckCircle, PlusCircle, Trash2,
  ChevronRight, AlertCircle, Upload,
} from "lucide-react";
import { toast } from "sonner";
import { Link } from "wouter";

// ── Types ──────────────────────────────────────────────────────────

type TopicWithMeta = {
  id: number;
  name: string;
  description?: string | null;
  totalAnswered: number;
  totalCorrect: number;
  totalWrong: number;
  hasDocument: boolean;
  documents: Array<{ id: number; name: string; processed: boolean }>;
};

// ── Main page ──────────────────────────────────────────────────────

export default function Temario() {
  const utils = trpc.useUtils();
  const { data: topics, isLoading } = trpc.topics.list.useQuery();

  const createMut = trpc.topics.create.useMutation({
    onSuccess: () => {
      toast.success("Tema creado");
      utils.topics.list.invalidate();
      setNewName("");
      setNewDesc("");
      setShowForm(false);
    },
    onError: (err) => toast.error(`Error: ${err.message}`),
  });

  const deleteMut = trpc.topics.delete.useMutation({
    onSuccess: () => {
      toast.success("Tema eliminado");
      utils.topics.list.invalidate();
    },
    onError: (err) => toast.error(`Error: ${err.message}`),
  });

  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");

  const withDoc = (topics as TopicWithMeta[] | undefined)?.filter((t) => t.hasDocument) ?? [];
  const withoutDoc = (topics as TopicWithMeta[] | undefined)?.filter((t) => !t.hasDocument) ?? [];
  const total = (topics as TopicWithMeta[] | undefined)?.length ?? 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="px-6 py-8 border-b border-border" style={{ background: "oklch(1 0 0)" }}>
        <div className="label-caps mb-2">Bloques de estudio</div>
        <div className="display-lg">Temario</div>
        <div className="label-caps-sm mt-2">
          {total} temas · {withDoc.length} con documento · {withoutDoc.length} sin documento
        </div>
      </div>

      <div className="p-6 space-y-6 max-w-3xl">

        {/* Progress bar */}
        {total > 0 && (
          <div className="border border-border bg-card p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="label-caps">Cobertura de documentos</span>
              <span
                style={{
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontWeight: 700,
                  fontSize: "1.4rem",
                  letterSpacing: "0.03em",
                }}
              >
                {Math.round((withDoc.length / total) * 100)}%
              </span>
            </div>
            <div className="w-full h-2" style={{ background: "oklch(0.88 0 0)" }}>
              <div
                className="h-2 transition-all"
                style={{
                  width: `${(withDoc.length / total) * 100}%`,
                  background: "oklch(0.15 0 0)",
                }}
              />
            </div>
            <div className="label-caps-sm mt-2">
              {withDoc.length} de {total} temas tienen PDF de estudio preparado
            </div>
          </div>
        )}

        {/* Add topic form */}
        <div className="border border-border bg-card">
          <button
            onClick={() => setShowForm(!showForm)}
            className="w-full px-5 py-4 flex items-center gap-2"
            style={{
              background: showForm ? "oklch(0.10 0 0)" : "oklch(0.97 0 0)",
              color: showForm ? "oklch(0.95 0 0)" : "oklch(0.15 0 0)",
              border: "none",
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            <PlusCircle size={14} />
            <span className="label-caps">Añadir nuevo tema</span>
          </button>
          {showForm && (
            <div className="p-5 space-y-4">
              <div>
                <div className="label-caps mb-1">Nombre del tema</div>
                <input
                  type="text"
                  placeholder="ej: Estructuras de hormigón"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full border border-border px-3 py-2 bg-background text-foreground"
                  style={{ fontFamily: "'Barlow', sans-serif", fontSize: "0.85rem", outline: "none" }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newName.trim()) {
                      createMut.mutate({ name: newName.trim(), description: newDesc || undefined });
                    }
                  }}
                />
              </div>
              <div>
                <div className="label-caps mb-1">Descripción (opcional)</div>
                <input
                  type="text"
                  placeholder="Breve descripción del bloque"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full border border-border px-3 py-2 bg-background text-foreground"
                  style={{ fontFamily: "'Barlow', sans-serif", fontSize: "0.85rem", outline: "none" }}
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    if (newName.trim()) {
                      createMut.mutate({ name: newName.trim(), description: newDesc || undefined });
                    }
                  }}
                  disabled={createMut.isPending || !newName.trim()}
                  className="btn-industrial"
                >
                  {createMut.isPending ? "Creando..." : "Crear tema"}
                </button>
                <button
                  onClick={() => { setShowForm(false); setNewName(""); setNewDesc(""); }}
                  className="btn-industrial-outline"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="p-12 text-center label-caps">Cargando temario...</div>
        ) : total === 0 ? (
          <div className="border border-border bg-card p-12 text-center">
            <BookOpen size={32} style={{ color: "oklch(0.75 0 0)", margin: "0 auto 1rem" }} />
            <div
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                fontWeight: 700,
                fontSize: "1rem",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                marginBottom: "0.5rem",
              }}
            >
              Sin temas definidos
            </div>
            <div className="label-caps-sm">
              Añade los bloques temáticos de la oposición para organizar tu estudio.
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Topics with document */}
            {withDoc.length > 0 && (
              <div>
                <div className="label-caps mb-3 flex items-center gap-2">
                  <CheckCircle size={12} />
                  Temas con documento ({withDoc.length})
                </div>
                <div className="border border-border bg-card">
                  {withDoc.map((topic, idx) => (
                    <TopicRow
                      key={topic.id}
                      topic={topic}
                      onDelete={() => deleteMut.mutate({ id: topic.id })}
                      isLast={idx === withDoc.length - 1}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Topics without document */}
            {withoutDoc.length > 0 && (
              <div>
                <div className="label-caps mb-3 flex items-center gap-2">
                  <AlertCircle size={12} />
                  Temas sin documento ({withoutDoc.length})
                </div>
                <div className="border border-border bg-card">
                  {withoutDoc.map((topic, idx) => (
                    <TopicRow
                      key={topic.id}
                      topic={topic}
                      onDelete={() => deleteMut.mutate({ id: topic.id })}
                      isLast={idx === withoutDoc.length - 1}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Topic Row ──────────────────────────────────────────────────────

function TopicRow({
  topic,
  onDelete,
  isLast,
}: {
  topic: TopicWithMeta;
  onDelete: () => void;
  isLast: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const accuracy = topic.totalAnswered > 0
    ? Math.round((topic.totalCorrect / topic.totalAnswered) * 100)
    : null;

  return (
    <div className={isLast ? "" : "border-b border-border"}>
      {/* Main row */}
      <div
        className="px-5 py-4 flex items-center gap-4 cursor-pointer"
        style={{ background: expanded ? "oklch(0.97 0 0)" : "transparent" }}
        onClick={() => setExpanded(!expanded)}
      >
        {/* Status indicator */}
        <div
          style={{
            width: "8px",
            height: "8px",
            borderRadius: "50%",
            background: topic.hasDocument ? "oklch(0.25 0 0)" : "oklch(0.78 0 0)",
            flexShrink: 0,
          }}
        />

        {/* Name */}
        <div className="flex-1 min-w-0">
          <div
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontWeight: 700,
              fontSize: "0.9rem",
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              color: "oklch(0.12 0 0)",
            }}
          >
            {topic.name}
          </div>
          {topic.description && (
            <div className="label-caps-sm mt-0.5">{topic.description}</div>
          )}
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4">
          {accuracy !== null && (
            <div className="text-right">
              <div
                style={{
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontWeight: 700,
                  fontSize: "1.1rem",
                  letterSpacing: "0.03em",
                  color: "oklch(0.15 0 0)",
                }}
              >
                {accuracy}%
              </div>
              <div className="label-caps-sm">{topic.totalAnswered} resp.</div>
            </div>
          )}

          {/* Document badge */}
          {topic.hasDocument ? (
            <span
              className="flex items-center gap-1"
              style={{
                background: "oklch(0.15 0 0)",
                color: "oklch(0.95 0 0)",
                padding: "2px 8px",
                fontFamily: "'Barlow', sans-serif",
                fontSize: "0.65rem",
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              <FileText size={9} />
              PDF
            </span>
          ) : (
            <span
              className="flex items-center gap-1"
              style={{
                background: "oklch(0.92 0 0)",
                color: "oklch(0.45 0 0)",
                padding: "2px 8px",
                fontFamily: "'Barlow', sans-serif",
                fontSize: "0.65rem",
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              Sin PDF
            </span>
          )}

          <ChevronRight
            size={14}
            style={{
              color: "oklch(0.55 0 0)",
              transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
              transition: "transform 0.15s",
            }}
          />
        </div>
      </div>

      {/* Expanded panel */}
      {expanded && (
        <div
          className="px-5 pb-4 border-t border-border"
          style={{ background: "oklch(0.97 0 0)" }}
        >
          <div className="pt-4 space-y-3">
            {/* Stats row */}
            {topic.totalAnswered > 0 && (
              <div className="flex gap-6">
                <div>
                  <div className="label-caps-sm">Respondidas</div>
                  <div
                    style={{
                      fontFamily: "'Barlow Condensed', sans-serif",
                      fontWeight: 700,
                      fontSize: "1.2rem",
                    }}
                  >
                    {topic.totalAnswered}
                  </div>
                </div>
                <div>
                  <div className="label-caps-sm">Correctas</div>
                  <div
                    style={{
                      fontFamily: "'Barlow Condensed', sans-serif",
                      fontWeight: 700,
                      fontSize: "1.2rem",
                    }}
                  >
                    {topic.totalCorrect}
                  </div>
                </div>
                <div>
                  <div className="label-caps-sm">Errores</div>
                  <div
                    style={{
                      fontFamily: "'Barlow Condensed', sans-serif",
                      fontWeight: 700,
                      fontSize: "1.2rem",
                    }}
                  >
                    {topic.totalWrong}
                  </div>
                </div>
              </div>
            )}

            {/* Documents */}
            {topic.documents.length > 0 && (
              <div>
                <div className="label-caps mb-2">Documentos asociados</div>
                <div className="space-y-1">
                  {topic.documents.map((doc) => (
                    <div key={doc.id} className="flex items-center gap-2">
                      <FileText size={12} style={{ color: "oklch(0.50 0 0)" }} />
                      <span className="label-caps-sm" style={{ color: "oklch(0.25 0 0)" }}>
                        {doc.name}
                      </span>
                      {doc.processed ? (
                        <span className="label-caps-sm flex items-center gap-1" style={{ color: "oklch(0.35 0 0)" }}>
                          <CheckCircle size={9} /> Procesado
                        </span>
                      ) : (
                        <span className="label-caps-sm" style={{ color: "oklch(0.60 0 0)" }}>
                          Sin procesar
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-3 pt-1">
              {!topic.hasDocument && (
                <Link href="/documentos">
                  <button className="btn-industrial flex items-center gap-2" style={{ fontSize: "0.72rem" }}>
                    <Upload size={11} />
                    Subir documento
                  </button>
                </Link>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(`¿Eliminar el tema "${topic.name}"?`)) onDelete();
                }}
                className="btn-industrial-outline flex items-center gap-2"
                style={{ fontSize: "0.72rem", color: "oklch(0.50 0 0)" }}
              >
                <Trash2 size={11} />
                Eliminar tema
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
