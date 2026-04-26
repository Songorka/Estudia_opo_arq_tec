import { trpc } from "@/lib/trpc";
import { useState, useRef } from "react";
import { FileText, Upload, Trash2, Cpu, CheckCircle, AlertCircle, Github } from "lucide-react";
import { toast } from "sonner";
import type { Document } from "../../../drizzle/schema";

const TYPE_LABELS: Record<string, string> = {
  convocatoria: "Convocatoria",
  examen: "Examen anterior",
  tema: "Tema desarrollado",
  otro: "Otro",
};

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

  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState<{
    type: "convocatoria" | "examen" | "tema" | "otro";
    year: string;
  }>({ type: "examen", year: "" });
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
        type: form.type,
        year: form.year || undefined,
        fileSize: file.size,
      });

      // Upload directly to storage via server endpoint
      const formData = new FormData();
      formData.append("file", file);
      formData.append("key", key);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Upload failed");

      await confirmUpload.mutateAsync({ id: docId });
      await utils.documents.list.invalidate();
      toast.success("Documento subido correctamente");
    } catch (err) {
      toast.error("Error al subir el documento");
      console.error(err);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="px-6 py-8 border-b border-border" style={{ background: "oklch(1 0 0)" }}>
        <div className="label-caps mb-2">Gestión de archivos</div>
        <div className="display-lg">Documentos</div>
      </div>

      <div className="p-6 space-y-6">
        {/* Upload form */}
        <div className="border border-border bg-card">
          <div
            className="px-5 py-4 border-b border-border"
            style={{ background: "oklch(0.10 0 0)" }}
          >
            <div className="flex items-center gap-2">
              <Upload size={14} style={{ color: "oklch(0.60 0 0)" }} />
              <span className="label-caps" style={{ color: "oklch(0.60 0 0)" }}>
                Subir nuevo documento
              </span>
            </div>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
              <div>
                <div className="label-caps mb-2">Tipo de documento</div>
                <select
                  value={form.type}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      type: e.target.value as typeof form.type,
                    }))
                  }
                  className="w-full border border-border px-3 py-2 bg-background text-foreground"
                  style={{
                    fontFamily: "'Barlow', sans-serif",
                    fontSize: "0.85rem",
                    outline: "none",
                  }}
                >
                  <option value="convocatoria">Convocatoria</option>
                  <option value="examen">Examen anterior</option>
                  <option value="tema">Tema desarrollado</option>
                  <option value="otro">Otro</option>
                </select>
              </div>
              <div>
                <div className="label-caps mb-2">Año (opcional)</div>
                <input
                  type="text"
                  placeholder="ej: 2023"
                  value={form.year}
                  onChange={(e) => setForm((f) => ({ ...f, year: e.target.value }))}
                  className="w-full border border-border px-3 py-2 bg-background text-foreground"
                  style={{ fontFamily: "'Barlow', sans-serif", fontSize: "0.85rem", outline: "none" }}
                />
              </div>
              <div className="flex items-end">
                <label className="btn-industrial w-full justify-center cursor-pointer">
                  <Upload size={14} />
                  {uploading ? "Subiendo..." : "Seleccionar PDF"}
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".pdf"
                    className="hidden"
                    onChange={handleUpload}
                    disabled={uploading}
                  />
                </label>
              </div>
            </div>
            <div className="label-caps-sm">
              Los PDFs de exámenes pueden procesarse con IA para extraer preguntas automáticamente.
            </div>
          </div>
        </div>

        {/* Document list */}
        <div className="border border-border bg-card">
          <div
            className="px-5 py-4 border-b border-border flex items-center justify-between"
            style={{ background: "oklch(0.97 0 0)" }}
          >
            <span className="label-caps">Documentos activos</span>
            <span className="label-caps-sm">{docs?.length ?? 0} archivos</span>
          </div>

          {isLoading ? (
            <div className="p-8 text-center label-caps">Cargando...</div>
          ) : !docs || docs.length === 0 ? (
            <div className="p-8 text-center">
              <FileText size={32} style={{ color: "oklch(0.75 0 0)", margin: "0 auto 1rem" }} />
              <div className="label-caps mb-1">Sin documentos</div>
              <div className="label-caps-sm">Sube un PDF o sincroniza desde GitHub</div>
            </div>
          ) : (
            <div>
              {docs.map((doc: Document) => (
                <DocRow
                  key={doc.id}
                  doc={doc}
                  onDelete={() => {
                    deleteMut.mutate({ id: doc.id });
                  }}
                  onExtract={() => {
                    toast.info("Extrayendo preguntas con IA...");
                    extractMut.mutate({ documentId: doc.id });
                  }}
                  onPush={() => pushMut.mutate({ documentId: doc.id })}
                  extracting={extractMut.isPending && extractMut.variables?.documentId === doc.id}
                  pushing={pushMut.isPending && pushMut.variables?.documentId === doc.id}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DocRow({
  doc,
  onDelete,
  onExtract,
  onPush,
  extracting,
  pushing,
}: {
  doc: Document;
  onDelete: () => void;
  onExtract: () => void;
  onPush: () => void;
  extracting: boolean;
  pushing: boolean;
}) {
  return (
    <div className="px-5 py-4 border-b border-border last:border-b-0 flex items-center gap-4">
      <FileText size={18} style={{ color: "oklch(0.55 0 0)", flexShrink: 0 }} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontWeight: 700,
              fontSize: "0.9rem",
              letterSpacing: "0.03em",
              textTransform: "uppercase",
              color: "oklch(0.15 0 0)",
            }}
          >
            {doc.name}
          </span>
          <span className="badge-source badge-extracted">
            {TYPE_LABELS[doc.type] ?? doc.type}
          </span>
          {doc.year && (
            <span className="badge-source badge-ai">{doc.year}</span>
          )}
          {doc.githubPath && (
            <span className="badge-source badge-ai">
              <Github size={9} style={{ marginRight: "3px" }} />
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
              <AlertCircle size={10} /> Error
            </span>
          ) : (
            <span className="label-caps-sm">Sin procesar</span>
          )}
          {doc.fileSize && (
            <span className="label-caps-sm">
              {(doc.fileSize / 1024).toFixed(0)} KB
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {!doc.processed && (
          <button
            onClick={onExtract}
            disabled={extracting}
            className="btn-industrial text-xs px-3 py-2"
            style={{ fontSize: "0.68rem" }}
            title="Extraer preguntas con IA"
          >
            <Cpu size={11} />
            {extracting ? "Procesando..." : "Extraer IA"}
          </button>
        )}
        <button
          onClick={onPush}
          disabled={pushing}
          className="btn-industrial-outline text-xs px-3 py-2"
          style={{ fontSize: "0.68rem" }}
          title="Subir a GitHub"
        >
          <Github size={11} />
          {pushing ? "Subiendo..." : "Push"}
        </button>
        <button
          onClick={onDelete}
          className="p-2"
          style={{ color: "oklch(0.60 0 0)", background: "none", border: "none" }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "oklch(0.20 0 0)")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = "oklch(0.60 0 0)")}
          title="Eliminar"
        >
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  );
}
