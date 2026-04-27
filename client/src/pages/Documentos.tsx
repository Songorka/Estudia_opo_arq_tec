import { trpc } from "@/lib/trpc";
import { useState, useRef } from "react";
import {
  FileText, Upload, Trash2, Cpu, CheckCircle, AlertCircle,
  Github, BookOpen, ClipboardList, GraduationCap, ChevronDown, ChevronUp, Tag,
} from "lucide-react";
import { toast } from "sonner";
import type { Document } from "../../../drizzle/schema";

// ── Helpers ────────────────────────────────────────────────────────

const CATEGORY_META = {
  convocatoria: {
    label: "Convocatoria oficial",
    icon: ClipboardList,
    description: "El PDF oficial de la convocatoria. Solo puede haber uno activo. Si subes uno nuevo, el anterior queda archivado.",
    color: "oklch(0.10 0 0)",
    badgeClass: "badge-source badge-extracted",
    yearLabel: false,
    hint: "Sube el BOE o documento oficial de la convocatoria.",
  },
  examen: {
    label: "Exámenes anteriores",
    icon: BookOpen,
    description: "PDFs de exámenes reales de convocatorias anteriores. Cada uno puede procesarse con IA para extraer las preguntas al banco.",
    color: "oklch(0.25 0 0)",
    badgeClass: "badge-source badge-ai",
    yearLabel: true,
    hint: "Identifica el año o convocatoria para organizar mejor las preguntas extraídas.",
  },
  tema: {
    label: "Temas teóricos",
    icon: GraduationCap,
    description: "Temas desarrollados que irás añadiendo. Se usarán para generar preguntas y dar feedback contextualizado.",
    color: "oklch(0.40 0 0)",
    badgeClass: "badge-source",
    yearLabel: false,
    hint: "Organiza cada PDF por bloque temático para facilitar la generación de preguntas.",
  },
} as const;

type DocType = keyof typeof CATEGORY_META;

// ── Main page ──────────────────────────────────────────────────────

export default function Documentos() {
  const utils = trpc.useUtils();
  const { data: docs, isLoading } = trpc.documents.list.useQuery();

  const getUploadUrl = trpc.documents.getUploadUrl.useMutation();
  const confirmUpload = trpc.documents.confirmUpload.useMutation();
  const deleteMut = trpc.documents.delete.useMutation({
    onSuccess: () => utils.documents.list.invalidate(),
  });
  const extractMut = trpc.documents.extractQuestions.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.count} preguntas extraídas correctamente`);
      utils.documents.list.invalidate();
      utils.questions.list.invalidate();
      utils.topics.list.invalidate();
    },
    onError: (err) => toast.error(`Error al extraer: ${err.message}`),
  });
  const pushMut = trpc.github.pushToGithub.useMutation({
    onSuccess: (data) => toast.success(`Subido a GitHub: ${data.path}`),
    onError: (err) => toast.error(`Error GitHub: ${err.message}`),
  });

  const { data: topics } = trpc.topics.list.useQuery();

  const convocatoriaDocs = docs?.filter((d: Document) => d.type === "convocatoria") ?? [];
  const examenDocs = docs?.filter((d: Document) => d.type === "examen") ?? [];
  const temaDocs = docs?.filter((d: Document) => d.type === "tema") ?? [];

  const sharedProps = {
    getUploadUrl,
    confirmUpload,
    onDelete: (id: number) => deleteMut.mutate({ id }),
    onExtract: (id: number) => {
      toast.info("Extrayendo preguntas con IA...");
      extractMut.mutate({ documentId: id });
    },
    onPush: (id: number) => pushMut.mutate({ documentId: id }),
    extractingId: extractMut.isPending ? extractMut.variables?.documentId : undefined,
    pushingId: pushMut.isPending ? pushMut.variables?.documentId : undefined,
    invalidate: () => utils.documents.list.invalidate(),
    topics: topics ?? [],
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="px-6 py-8 border-b border-border" style={{ background: "oklch(1 0 0)" }}>
        <div className="label-caps mb-2">Gestión de archivos</div>
        <div className="display-lg">Documentos</div>
        <div className="label-caps-sm mt-2">
          {(docs?.length ?? 0)} archivos · {convocatoriaDocs.length} convocatoria · {examenDocs.length} exámenes · {temaDocs.length} temas
        </div>
      </div>

      <div className="p-6 space-y-6">
        {isLoading ? (
          <div className="p-12 text-center label-caps">Cargando documentos...</div>
        ) : (
          <>
            <CategorySection
              type="convocatoria"
              docs={convocatoriaDocs}
              {...sharedProps}
            />
            <CategorySection
              type="examen"
              docs={examenDocs}
              {...sharedProps}
            />
            <CategorySection
              type="tema"
              docs={temaDocs}
              {...sharedProps}
            />
          </>
        )}
      </div>
    </div>
  );
}

// ── Category Section ───────────────────────────────────────────────

function CategorySection({
  type,
  docs,
  getUploadUrl,
  confirmUpload,
  onDelete,
  onExtract,
  onPush,
  extractingId,
  pushingId,
  invalidate,
  topics,
}: {
  type: DocType;
  docs: Document[];
  getUploadUrl: ReturnType<typeof trpc.documents.getUploadUrl.useMutation>;
  confirmUpload: ReturnType<typeof trpc.documents.confirmUpload.useMutation>;
  onDelete: (id: number) => void;
  onExtract: (id: number) => void;
  onPush: (id: number) => void;
  extractingId: number | undefined;
  pushingId: number | undefined;
  invalidate: () => void;
  topics: Array<{ id: number; name: string }>;
}) {
  const meta = CATEGORY_META[type];
  const Icon = meta.icon;
  const [uploading, setUploading] = useState(false);
  const [year, setYear] = useState("");
  const [selectedTopicId, setSelectedTopicId] = useState<number | undefined>();
  const [collapsed, setCollapsed] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".pdf")) {
      toast.error("Solo se admiten archivos PDF");
      return;
    }

    setUploading(true);
    try {
      const { key, docId } = await getUploadUrl.mutateAsync({
        name: file.name,
        type,
        year: year || undefined,
        topicId: type === "tema" ? selectedTopicId : undefined,
        fileSize: file.size,
      });

      const formData = new FormData();
      formData.append("file", file);
      formData.append("key", key);

      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload failed");

      await confirmUpload.mutateAsync({ id: docId });
      await invalidate();
      toast.success(`${meta.label} subido correctamente`);
      setYear("");
      setSelectedTopicId(undefined);
    } catch {
      toast.error("Error al subir el documento");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="border border-border bg-card">
      {/* Category header */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full px-5 py-4 border-b border-border flex items-center justify-between"
        style={{ background: meta.color, cursor: "pointer", border: "none", borderBottom: "1px solid oklch(0.82 0 0)" }}
      >
        <div className="flex items-center gap-3">
          <Icon size={16} style={{ color: type === "convocatoria" ? "oklch(0.75 0 0)" : type === "examen" ? "oklch(0.80 0 0)" : "oklch(0.85 0 0)" }} />
          <div>
            <span className="label-caps" style={{ color: type === "convocatoria" ? "oklch(0.70 0 0)" : "oklch(0.75 0 0)" }}>
              {meta.label}
            </span>
            <span
              className="ml-3"
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                fontWeight: 900,
                fontSize: "1rem",
                color: type === "convocatoria" ? "oklch(0.97 0 0)" : "oklch(0.97 0 0)",
                letterSpacing: "-0.01em",
              }}
            >
              {docs.length}
            </span>
          </div>
        </div>
        {collapsed
          ? <ChevronDown size={14} style={{ color: "oklch(0.70 0 0)" }} />
          : <ChevronUp size={14} style={{ color: "oklch(0.70 0 0)" }} />
        }
      </button>

      {!collapsed && (
        <>
          {/* Description + upload */}
          <div className="p-5 border-b border-border" style={{ background: "oklch(0.98 0 0)" }}>
            <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: "0.82rem", color: "oklch(0.40 0 0)", lineHeight: 1.6, marginBottom: "1rem" }}>
              {meta.description}
            </p>

            <div className="flex flex-wrap items-end gap-3">
              {meta.yearLabel && (
                <div>
                  <div className="label-caps mb-1">Año / convocatoria</div>
                  <input
                    type="text"
                    placeholder="ej: 2023"
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                    className="border border-border px-3 py-2 bg-background text-foreground"
                    style={{ fontFamily: "'Barlow', sans-serif", fontSize: "0.82rem", outline: "none", width: "130px" }}
                  />
                </div>
              )}
              {type === "tema" && (
                <div>
                  <div className="label-caps mb-1">Bloque temático</div>
                  <select
                    value={selectedTopicId ?? ""}
                    onChange={(e) => setSelectedTopicId(e.target.value ? Number(e.target.value) : undefined)}
                    className="border border-border px-3 py-2 bg-background text-foreground"
                    style={{ fontFamily: "'Barlow', sans-serif", fontSize: "0.82rem", outline: "none", minWidth: "180px" }}
                  >
                    <option value="">Sin bloque asignado</option>
                    {topics.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <label className="btn-industrial cursor-pointer" style={{ fontSize: "0.72rem" }}>
                <Upload size={12} />
                {uploading ? "Subiendo..." : `Subir PDF`}
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={handleUpload}
                  disabled={uploading}
                />
              </label>
              <span className="label-caps-sm" style={{ color: "oklch(0.55 0 0)" }}>
                {meta.hint}
              </span>
            </div>
          </div>

          {/* Document list */}
          {docs.length === 0 ? (
            <div className="p-6 text-center">
              <FileText size={24} style={{ color: "oklch(0.80 0 0)", margin: "0 auto 0.75rem" }} />
              <div className="label-caps-sm">Sin documentos en esta categoría</div>
            </div>
          ) : (
            <div>
              {docs.map((doc: Document) => (
                <DocRow
                  key={doc.id}
                  doc={doc}
                  type={type}
                  onDelete={() => onDelete(doc.id)}
                  onExtract={() => onExtract(doc.id)}
                  onPush={() => onPush(doc.id)}
                  extracting={extractingId === doc.id}
                  pushing={pushingId === doc.id}
                  topics={topics}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Doc Row ────────────────────────────────────────────────────────

function DocRow({
  doc,
  type,
  onDelete,
  onExtract,
  onPush,
  extracting,
  pushing,
  topics,
}: {
  doc: Document;
  type: DocType;
  onDelete: () => void;
  onExtract: () => void;
  onPush: () => void;
  extracting: boolean;
  pushing: boolean;
  topics: Array<{ id: number; name: string }>;
}) {
  const meta = CATEGORY_META[type];
  const topicName = doc.topicId ? topics.find((t) => t.id === doc.topicId)?.name : undefined;

  return (
    <div className="px-5 py-4 border-b border-border last:border-b-0 flex items-center gap-4">
      <FileText size={16} style={{ color: "oklch(0.60 0 0)", flexShrink: 0 }} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontWeight: 700,
              fontSize: "0.88rem",
              letterSpacing: "0.03em",
              textTransform: "uppercase",
              color: "oklch(0.15 0 0)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              maxWidth: "280px",
            }}
          >
            {doc.name}
          </span>
          <span className={meta.badgeClass}>
            {meta.label}
          </span>
          {doc.year && (
            <span className="badge-source badge-ai">{doc.year}</span>
          )}
          {topicName && (
            <span className="badge-source" style={{ display: "flex", alignItems: "center", gap: "3px", background: "oklch(0.92 0 0)", color: "oklch(0.25 0 0)" }}>
              <Tag size={9} />
              {topicName}
            </span>
          )}
          {doc.githubPath && (
            <span className="badge-source badge-ai" style={{ display: "flex", alignItems: "center", gap: "3px" }}>
              <Github size={9} />
              GitHub
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-1">
          {doc.processed ? (
            <span className="flex items-center gap-1 label-caps-sm" style={{ color: "oklch(0.30 0 0)" }}>
              <CheckCircle size={10} /> Procesado
            </span>
          ) : doc.processingError ? (
            <span className="flex items-center gap-1 label-caps-sm" style={{ color: "oklch(0.50 0 0)" }}>
              <AlertCircle size={10} /> Error al procesar
            </span>
          ) : (
            <span className="label-caps-sm" style={{ color: "oklch(0.60 0 0)" }}>Sin procesar</span>
          )}
          {doc.fileSize && (
            <span className="label-caps-sm">{(doc.fileSize / 1024).toFixed(0)} KB</span>
          )}
          <span className="label-caps-sm">{new Date(doc.createdAt).toLocaleDateString("es-ES")}</span>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Extraer con IA: solo para exámenes y temas */}
        {type !== "convocatoria" && !doc.processed && (
          <button
            onClick={onExtract}
            disabled={extracting}
            className="btn-industrial"
            style={{ fontSize: "0.65rem", padding: "0.3rem 0.6rem" }}
            title="Extraer preguntas con IA"
          >
            <Cpu size={11} />
            {extracting ? "Procesando..." : "Extraer IA"}
          </button>
        )}
        {/* Para convocatoria: solo botón de procesar para indexar contenido */}
        {type === "convocatoria" && !doc.processed && (
          <button
            onClick={onExtract}
            disabled={extracting}
            className="btn-industrial"
            style={{ fontSize: "0.65rem", padding: "0.3rem 0.6rem" }}
            title="Procesar convocatoria con IA"
          >
            <Cpu size={11} />
            {extracting ? "Procesando..." : "Procesar"}
          </button>
        )}
        <button
          onClick={onPush}
          disabled={pushing}
          className="btn-industrial-outline"
          style={{ fontSize: "0.65rem", padding: "0.3rem 0.6rem" }}
          title="Subir a GitHub"
        >
          <Github size={11} />
          {pushing ? "Subiendo..." : "Push"}
        </button>
        <button
          onClick={onDelete}
          className="p-2"
          style={{ color: "oklch(0.65 0 0)", background: "none", border: "none", cursor: "pointer" }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "oklch(0.20 0 0)")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "oklch(0.65 0 0)")}
          title="Eliminar"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}
