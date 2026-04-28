import { trpc } from "../lib/trpc";
import { useState } from "react";
import {
  BookOpen, FileText, CheckCircle, PlusCircle,
  ChevronRight, AlertCircle, Upload, Layers, EyeOff, Eye,
} from "lucide-react";
import { toast } from "sonner";
import { Link } from "wouter";

// ── Types ──────────────────────────────────────────────────────────

type TopicWithMeta = {
  id: number;
  name: string;
  description?: string | null;
  group?: string | null;
  topicNumber?: number | null;
  hidden?: boolean | null;
  displayLabel: string;
  totalAnswered: number;
  totalCorrect: number;
  totalWrong: number;
  hasDocument: boolean;
  documents: Array<{ id: number; name: string; processed: boolean }>;
};

// ── Helpers ────────────────────────────────────────────────────────

/** Agrupa los temas por su campo `group`. Los que no tienen grupo van a "_" */
function groupTopics(topics: TopicWithMeta[]): Array<{ groupKey: string; items: TopicWithMeta[] }> {
  const map = new Map<string, TopicWithMeta[]>();
  for (const t of topics) {
    const key = t.group?.trim() || "_";
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(t);
  }
  // Ordenar: grupos con nombre primero (alfabético), sin grupo al final
  const keys = Array.from(map.keys()).sort((a, b) => {
    if (a === "_") return 1;
    if (b === "_") return -1;
    return a.localeCompare(b, "es");
  });
  return keys.map((k) => ({ groupKey: k, items: map.get(k)! }));
}

// ── Main page ──────────────────────────────────────────────────────

export default function Temario() {
  const utils = trpc.useUtils();
  const { data: topics, isLoading } = trpc.topics.list.useQuery();

  const [showHidden, setShowHidden] = useState(false);

  const toggleHiddenMut = trpc.topics.toggleHidden.useMutation({
    onSuccess: () => utils.topics.list.invalidate(),
    onError: (err) => toast.error(`Error: ${err.message}`),
  });

  const createMut = trpc.topics.create.useMutation({
    onSuccess: () => {
      toast.success("Tema creado");
      utils.topics.list.invalidate();
      setNewName("");
      setNewDesc("");
      setNewGroup("");
      setNewNumber("");
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
  const [newGroup, setNewGroup] = useState("");
  const [newNumber, setNewNumber] = useState("");

  const allTopics = (topics as TopicWithMeta[] | undefined) ?? [];
  const visibleTopics = showHidden ? allTopics : allTopics.filter((t) => !t.hidden);
  const hiddenCount = allTopics.filter((t) => t.hidden).length;
  const withDoc = visibleTopics.filter((t) => t.hasDocument);
  const withoutDoc = visibleTopics.filter((t) => !t.hasDocument);
  const total = visibleTopics.length;

  const grouped = groupTopics(visibleTopics);

  // Grupos existentes para el autocompletado
  const existingGroups = Array.from(new Set(allTopics.map((t) => t.group).filter(Boolean))) as string[];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="px-6 py-8 border-b border-border" style={{ background: "oklch(1 0 0)" }}>
        <div className="label-caps mb-2">Bloques de estudio</div>
        <div className="display-lg">Temario</div>
        <div className="flex items-center gap-4 mt-2 flex-wrap">
          <span className="label-caps-sm">{total} temas · {withDoc.length} con documento · {withoutDoc.length} sin documento</span>
          {hiddenCount > 0 && (
            <button
              onClick={() => setShowHidden(!showHidden)}
              className="flex items-center gap-1"
              style={{ fontFamily: "'Barlow', sans-serif", fontSize: "0.7rem", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: showHidden ? "oklch(0.20 0 0)" : "oklch(0.55 0 0)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
            >
              {showHidden ? <Eye size={11} /> : <EyeOff size={11} />}
              {showHidden ? `Ocultar ${hiddenCount} ocultos` : `Mostrar ${hiddenCount} ocultos`}
            </button>
          )}
        </div>
      </div>

      <div className="p-6 space-y-6 max-w-3xl">

        {/* Progress bar */}
        {total > 0 && (
          <div className="border border-border bg-card p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="label-caps">Cobertura de documentos</span>
              <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: "1.4rem", letterSpacing: "0.03em" }}>
                {Math.round((withDoc.length / total) * 100)}%
              </span>
            </div>
            <div className="w-full h-2" style={{ background: "oklch(0.88 0 0)" }}>
              <div className="h-2 transition-all" style={{ width: `${(withDoc.length / total) * 100}%`, background: "oklch(0.15 0 0)" }} />
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
              border: "none", cursor: "pointer", textAlign: "left",
            }}
          >
            <PlusCircle size={14} />
            <span className="label-caps">Añadir nuevo tema</span>
          </button>
          {showForm && (
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Grupo */}
                <div>
                  <div className="label-caps mb-1">Grupo <span style={{ color: "oklch(0.65 0 0)", fontWeight: 400 }}>(opcional)</span></div>
                  <input
                    type="text"
                    placeholder="ej: General, Específico, Urbanismo…"
                    value={newGroup}
                    onChange={(e) => setNewGroup(e.target.value)}
                    list="existing-groups"
                    className="w-full border border-border px-3 py-2 bg-background text-foreground"
                    style={{ fontFamily: "'Barlow', sans-serif", fontSize: "0.85rem", outline: "none" }}
                  />
                  <datalist id="existing-groups">
                    {existingGroups.map((g) => <option key={g} value={g} />)}
                  </datalist>
                  <div className="label-caps-sm mt-1" style={{ color: "oklch(0.55 0 0)" }}>
                    Permite agrupar temas por bloque (ej. General, Específico)
                  </div>
                </div>
                {/* Número de tema */}
                <div>
                  <div className="label-caps mb-1">Número de tema <span style={{ color: "oklch(0.65 0 0)", fontWeight: 400 }}>(opcional)</span></div>
                  <input
                    type="number"
                    min={1}
                    placeholder="ej: 1, 2, 3…"
                    value={newNumber}
                    onChange={(e) => setNewNumber(e.target.value)}
                    className="w-full border border-border px-3 py-2 bg-background text-foreground"
                    style={{ fontFamily: "'Barlow', sans-serif", fontSize: "0.85rem", outline: "none" }}
                  />
                  <div className="label-caps-sm mt-1" style={{ color: "oklch(0.55 0 0)" }}>
                    Si hay Tema 1 en varios grupos, la app los diferencia
                  </div>
                </div>
              </div>
              {/* Nombre */}
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
                      createMut.mutate({
                        name: newName.trim(),
                        description: newDesc || undefined,
                        group: newGroup.trim() || undefined,
                        topicNumber: newNumber ? parseInt(newNumber) : undefined,
                      });
                    }
                  }}
                />
              </div>
              {/* Descripción */}
              <div>
                <div className="label-caps mb-1">Descripción <span style={{ color: "oklch(0.65 0 0)", fontWeight: 400 }}>(opcional)</span></div>
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
                      createMut.mutate({
                        name: newName.trim(),
                        description: newDesc || undefined,
                        group: newGroup.trim() || undefined,
                        topicNumber: newNumber ? parseInt(newNumber) : undefined,
                      });
                    }
                  }}
                  disabled={createMut.isPending || !newName.trim()}
                  className="btn-industrial"
                >
                  {createMut.isPending ? "Creando..." : "Crear tema"}
                </button>
                <button
                  onClick={() => { setShowForm(false); setNewName(""); setNewDesc(""); setNewGroup(""); setNewNumber(""); }}
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
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: "1rem", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "0.5rem" }}>
              Sin temas definidos
            </div>
            <div className="label-caps-sm">
              Añade los bloques temáticos de la oposición para organizar tu estudio.
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {grouped.map(({ groupKey, items }) => (
              <div key={groupKey}>
                {/* Cabecera de grupo */}
                <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border">
                  <Layers size={12} style={{ color: "oklch(0.45 0 0)" }} />
                  <span className="label-caps" style={{ color: "oklch(0.30 0 0)" }}>
                    {groupKey === "_" ? "Sin grupo" : groupKey}
                  </span>
                  <span className="label-caps-sm ml-1" style={{ color: "oklch(0.60 0 0)" }}>
                    ({items.length} {items.length === 1 ? "tema" : "temas"})
                  </span>
                </div>
                <div className="border border-border bg-card">
                  {items.map((topic, idx) => (
                    <TopicRow
                      key={topic.id}
                      topic={topic}
                      onToggleHidden={(hidden) => toggleHiddenMut.mutate({ id: topic.id, hidden })}
                      isLast={idx === items.length - 1}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Topic Row ──────────────────────────────────────────────────────

function TopicRow({
  topic,
  onToggleHidden,
  isLast,
}: {
  topic: TopicWithMeta;
  onToggleHidden: (hidden: boolean) => void;
  isLast: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const accuracy = topic.totalAnswered > 0
    ? Math.round((topic.totalCorrect / topic.totalAnswered) * 100)
    : null;

  return (
      <div className={isLast ? "" : "border-b border-border"} style={{ opacity: topic.hidden ? 0.5 : 1 }}>
      {/* Main row */}
      <div
        className="px-5 py-4 flex items-center gap-4 cursor-pointer"
        style={{ background: expanded ? "oklch(0.97 0 0)" : "transparent" }}
        onClick={() => setExpanded(!expanded)}
      >
        {/* Status indicator */}
        <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: topic.hasDocument ? "oklch(0.25 0 0)" : "oklch(0.78 0 0)", flexShrink: 0 }} />

        {/* Name + number badge */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Número de tema */}
            {topic.topicNumber != null && (
              <span style={{
                fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900,
                fontSize: "0.7rem", letterSpacing: "0.12em", textTransform: "uppercase",
                background: "oklch(0.15 0 0)", color: "oklch(0.97 0 0)",
                padding: "0.1rem 0.45rem", flexShrink: 0,
              }}>
                T{topic.topicNumber}
              </span>
            )}
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: "0.9rem", letterSpacing: "0.05em", textTransform: "uppercase", color: "oklch(0.12 0 0)" }}>
              {topic.name}
            </div>
          </div>
          {topic.description && (
            <div className="label-caps-sm mt-0.5">{topic.description}</div>
          )}
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4">
          {accuracy !== null && (
            <div className="text-right">
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: "1.1rem", color: "oklch(0.15 0 0)" }}>
                {accuracy}%
              </div>
              <div className="label-caps-sm">{topic.totalAnswered} resp.</div>
            </div>
          )}

          {/* Document badge */}
          {topic.hasDocument ? (
            <span className="flex items-center gap-1" style={{ background: "oklch(0.15 0 0)", color: "oklch(0.95 0 0)", padding: "2px 8px", fontFamily: "'Barlow', sans-serif", fontSize: "0.65rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>
              <FileText size={9} />
              PDF
            </span>
          ) : (
            <span className="flex items-center gap-1" style={{ background: "oklch(0.92 0 0)", color: "oklch(0.45 0 0)", padding: "2px 8px", fontFamily: "'Barlow', sans-serif", fontSize: "0.65rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>
              Sin PDF
            </span>
          )}

          <ChevronRight size={14} style={{ color: "oklch(0.55 0 0)", transform: expanded ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s" }} />
        </div>
      </div>

      {/* Expanded panel */}
      {expanded && (
        <div className="px-5 pb-4 border-t border-border" style={{ background: "oklch(0.97 0 0)" }}>
          <div className="pt-4 space-y-3">
            {/* Group + number info */}
            {(topic.group || topic.topicNumber != null) && (
              <div className="flex gap-4">
                {topic.group && (
                  <div>
                    <div className="label-caps-sm">Grupo</div>
                    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: "0.9rem" }}>{topic.group}</div>
                  </div>
                )}
                {topic.topicNumber != null && (
                  <div>
                    <div className="label-caps-sm">Número</div>
                    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: "0.9rem" }}>Tema {topic.topicNumber}</div>
                  </div>
                )}
              </div>
            )}

            {/* Stats row */}
            {topic.totalAnswered > 0 && (
              <div className="flex gap-6">
                <div>
                  <div className="label-caps-sm">Respondidas</div>
                  <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: "1.2rem" }}>{topic.totalAnswered}</div>
                </div>
                <div>
                  <div className="label-caps-sm">Correctas</div>
                  <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: "1.2rem" }}>{topic.totalCorrect}</div>
                </div>
                <div>
                  <div className="label-caps-sm">Errores</div>
                  <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: "1.2rem" }}>{topic.totalWrong}</div>
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
                      <span className="label-caps-sm" style={{ color: "oklch(0.25 0 0)" }}>{doc.name}</span>
                      {doc.processed ? (
                        <span className="label-caps-sm flex items-center gap-1" style={{ color: "oklch(0.35 0 0)" }}>
                          <CheckCircle size={9} /> Procesado
                        </span>
                      ) : (
                        <span className="label-caps-sm" style={{ color: "oklch(0.60 0 0)" }}>Sin procesar</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-3 pt-1 flex-wrap">
              {!topic.hasDocument && !topic.hidden && (
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
                  onToggleHidden(!topic.hidden);
                }}
                className="btn-industrial-outline flex items-center gap-2"
                style={{ fontSize: "0.72rem", color: "oklch(0.50 0 0)" }}
              >
                {topic.hidden ? <Eye size={11} /> : <EyeOff size={11} />}
                {topic.hidden ? "Mostrar tema" : "Ocultar tema"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
