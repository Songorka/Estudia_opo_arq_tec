/**
 * TopicSelector — selector de temas con bloques expandibles y selección múltiple.
 *
 * Modos:
 *  - mode="single"   → selecciona un solo topicId (o undefined para "todos")
 *  - mode="multi"    → selecciona un array de topicIds (vacío = todos)
 *
 * Agrupación:
 *  - Si el topic tiene campo `group`, se agrupa por ese campo.
 *  - Si no tiene `group`, se intenta inferir del nombre (compatibilidad retroactiva).
 *  - Si hay colisión de topicNumber entre grupos, se usa displayLabel del backend.
 *
 * Cada tema muestra su displayLabel (ej. "General · Tema 1 — Construcción")
 * o simplemente su nombre si no tiene numeración.
 */

import { useState, useMemo } from "react";
import { ChevronDown, ChevronUp, CheckSquare, Square, Minus } from "lucide-react";

type Topic = {
  id: number;
  name: string;
  group?: string | null;
  topicNumber?: number | null;
  displayLabel?: string;
  totalAnswered?: number;
  totalCorrect?: number;
  hidden?: boolean | null;
};

// ── Helpers de agrupación ──────────────────────────────────────────

/** Obtiene la clave de grupo de un tema, priorizando el campo `group` explícito */
function getGroupKey(t: Topic): string {
  if (t.group?.trim()) return t.group.trim();
  // Compatibilidad retroactiva: inferir del nombre
  const name = t.name;
  const matchTema = name.match(/^(Tema\s+\d+)/i);
  if (matchTema) return matchTema[1];
  const matchBloque = name.match(/^(Bloque\s+\S+)/i);
  if (matchBloque) return matchBloque[1];
  const matchGrupo = name.match(/^([^:\/—–\-]+?)[\s]*[:\-\/—–]/);
  if (matchGrupo) return matchGrupo[1].trim();
  return "Otros";
}

/** Etiqueta de visualización de un tema: usa displayLabel si existe, si no el nombre */
function getLabel(t: Topic): string {
  return t.displayLabel ?? t.name;
}

function groupTopics(topics: Topic[]): Array<{ key: string; topics: Topic[] }> {
  const map = new Map<string, Topic[]>();
  // Filtrar temas ocultos antes de agrupar
  const visible = topics.filter((t) => !t.hidden);
  for (const t of visible) {
    const key = getGroupKey(t);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(t);
  }
  return Array.from(map.entries()).map(([key, topics]) => ({ key, topics }));
}

// ── Componente principal ───────────────────────────────────────────

type SingleProps = {
  mode: "single";
  topics: Topic[];
  value: number | undefined;
  onChange: (id: number | undefined) => void;
  placeholder?: string;
};

type MultiProps = {
  mode: "multi";
  topics: Topic[];
  value: number[];
  onChange: (ids: number[]) => void;
  placeholder?: string;
};

type Props = SingleProps | MultiProps;

export default function TopicSelector(props: Props) {
  const { topics, placeholder = "Todos los bloques" } = props;
  const [open, setOpen] = useState(false);

  const groups = useMemo(() => groupTopics(topics), [topics]);
  const useGroups = topics.length > 8 || groups.length > 1;

  // Compute display label
  let label = placeholder;
  if (props.mode === "single") {
    if (props.value !== undefined) {
      const t = topics.find((t) => t.id === props.value);
      label = t ? getLabel(t) : placeholder;
    }
  } else {
    if (props.value.length === 1) {
      const t = topics.find((t) => t.id === props.value[0]);
      label = t ? getLabel(t) : placeholder;
    } else if (props.value.length > 1) {
      label = `${props.value.length} temas seleccionados`;
    }
  }

  const isSelected = (id: number): boolean => {
    if (props.mode === "single") return props.value === id;
    return props.value.includes(id);
  };

  const toggleTopic = (id: number) => {
    if (props.mode === "single") {
      props.onChange(props.value === id ? undefined : id);
      setOpen(false);
    } else {
      const current = props.value;
      props.onChange(current.includes(id) ? current.filter((x) => x !== id) : [...current, id]);
    }
  };

  const toggleGroup = (groupTopics: Topic[]) => {
    if (props.mode !== "multi") return;
    const ids = groupTopics.map((t) => t.id);
    const allSelected = ids.every((id) => props.value.includes(id));
    if (allSelected) {
      props.onChange(props.value.filter((id) => !ids.includes(id)));
    } else {
      const newIds = [...props.value];
      for (const id of ids) {
        if (!newIds.includes(id)) newIds.push(id);
      }
      props.onChange(newIds);
    }
  };

  const groupState = (groupTopics: Topic[]): "all" | "some" | "none" => {
    if (props.mode !== "multi") return "none";
    const ids = groupTopics.map((t) => t.id);
    const selected = ids.filter((id) => props.value.includes(id));
    if (selected.length === 0) return "none";
    if (selected.length === ids.length) return "all";
    return "some";
  };

  const clearAll = () => {
    if (props.mode === "single") props.onChange(undefined);
    else props.onChange([]);
  };

  const hasSelection = props.mode === "single" ? props.value !== undefined : props.value.length > 0;

  return (
    <div style={{ position: "relative", userSelect: "none" }}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0.5rem 0.75rem",
          border: `1px solid ${hasSelection ? "oklch(0.30 0 0)" : "oklch(0.82 0 0)"}`,
          background: hasSelection ? "oklch(0.10 0 0)" : "oklch(1 0 0)",
          color: hasSelection ? "oklch(0.97 0 0)" : "oklch(0.30 0 0)",
          fontFamily: "'Barlow', sans-serif",
          fontSize: "0.85rem",
          cursor: "pointer",
          textAlign: "left",
          gap: "0.5rem",
        }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
          {label}
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: "0.25rem", flexShrink: 0 }}>
          {hasSelection && (
            <span
              onClick={(e) => { e.stopPropagation(); clearAll(); }}
              style={{
                fontSize: "0.7rem",
                fontFamily: "'Barlow Condensed', sans-serif",
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: hasSelection ? "oklch(0.70 0 0)" : "oklch(0.50 0 0)",
                padding: "0 0.25rem",
              }}
            >
              ✕
            </span>
          )}
          {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </span>
      </button>

      {/* Dropdown */}
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 2px)",
            left: 0,
            right: 0,
            zIndex: 50,
            background: "oklch(1 0 0)",
            border: "1px solid oklch(0.82 0 0)",
            boxShadow: "0 4px 12px oklch(0 0 0 / 0.12)",
            maxHeight: "320px",
            overflowY: "auto",
          }}
        >
          {/* "Todos" option */}
          <div
            onClick={clearAll}
            style={{
              padding: "0.5rem 0.75rem",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              cursor: "pointer",
              borderBottom: "1px solid oklch(0.92 0 0)",
              background: !hasSelection ? "oklch(0.95 0 0)" : "oklch(1 0 0)",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "oklch(0.95 0 0)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = !hasSelection ? "oklch(0.95 0 0)" : "oklch(1 0 0)")}
          >
            {props.mode === "multi" ? (
              !hasSelection
                ? <CheckSquare size={13} style={{ color: "oklch(0.20 0 0)", flexShrink: 0 }} />
                : <Square size={13} style={{ color: "oklch(0.60 0 0)", flexShrink: 0 }} />
            ) : null}
            <span style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontWeight: 700,
              fontSize: "0.75rem",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: !hasSelection ? "oklch(0.10 0 0)" : "oklch(0.40 0 0)",
            }}>
              {props.mode === "single" ? "Todos los bloques" : "Todos los temas"}
            </span>
          </div>

          {useGroups ? (
            <GroupedTopicList
              groups={groups}
              mode={props.mode}
              isSelected={isSelected}
              toggleTopic={toggleTopic}
              toggleGroup={props.mode === "multi" ? toggleGroup : undefined}
              groupState={props.mode === "multi" ? groupState : undefined}
            />
          ) : (
            <FlatTopicList
              topics={topics}
              mode={props.mode}
              isSelected={isSelected}
              toggleTopic={toggleTopic}
            />
          )}
        </div>
      )}

      {/* Backdrop */}
      {open && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 49 }}
          onClick={() => setOpen(false)}
        />
      )}
    </div>
  );
}

// ── Lista plana (pocos temas) ──────────────────────────────────────

function FlatTopicList({
  topics,
  mode,
  isSelected,
  toggleTopic,
}: {
  topics: Topic[];
  mode: "single" | "multi";
  isSelected: (id: number) => boolean;
  toggleTopic: (id: number) => void;
}) {
  return (
    <>
      {topics.map((t) => (
        <TopicItem key={t.id} topic={t} mode={mode} selected={isSelected(t.id)} onToggle={() => toggleTopic(t.id)} indent={false} />
      ))}
    </>
  );
}

// ── Lista agrupada ─────────────────────────────────────────────────

function GroupedTopicList({
  groups,
  mode,
  isSelected,
  toggleTopic,
  toggleGroup,
  groupState,
}: {
  groups: Array<{ key: string; topics: Topic[] }>;
  mode: "single" | "multi";
  isSelected: (id: number) => boolean;
  toggleTopic: (id: number) => void;
  toggleGroup?: (topics: Topic[]) => void;
  groupState?: (topics: Topic[]) => "all" | "some" | "none";
}) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    () => new Set(groups.map((g) => g.key))
  );

  const toggleExpand = (key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <>
      {groups.map((group) => {
        const expanded = expandedGroups.has(group.key);
        const state = groupState?.(group.topics) ?? "none";

        return (
          <div key={group.key}>
            {/* Group header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                padding: "0.45rem 0.75rem",
                background: "oklch(0.96 0 0)",
                borderBottom: "1px solid oklch(0.90 0 0)",
                gap: "0.5rem",
              }}
            >
              {/* Checkbox de grupo (solo multi) */}
              {mode === "multi" && toggleGroup && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); toggleGroup(group.topics); }}
                  style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex", alignItems: "center", flexShrink: 0 }}
                >
                  {state === "all" ? (
                    <CheckSquare size={13} style={{ color: "oklch(0.10 0 0)" }} />
                  ) : state === "some" ? (
                    <Minus size={13} style={{ color: "oklch(0.40 0 0)" }} />
                  ) : (
                    <Square size={13} style={{ color: "oklch(0.65 0 0)" }} />
                  )}
                </button>
              )}

              {/* Group label + expand toggle */}
              <button
                type="button"
                onClick={() => toggleExpand(group.key)}
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: "none",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                  gap: "0.5rem",
                }}
              >
                <span style={{
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontWeight: 900,
                  fontSize: "0.72rem",
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: state !== "none" ? "oklch(0.10 0 0)" : "oklch(0.35 0 0)",
                }}>
                  {group.key}
                  <span style={{ fontWeight: 400, marginLeft: "0.4rem", color: "oklch(0.55 0 0)" }}>
                    ({group.topics.length})
                  </span>
                </span>
                {expanded
                  ? <ChevronUp size={11} style={{ color: "oklch(0.50 0 0)", flexShrink: 0 }} />
                  : <ChevronDown size={11} style={{ color: "oklch(0.50 0 0)", flexShrink: 0 }} />}
              </button>
            </div>

            {/* Topics in group */}
            {expanded && group.topics.map((t) => (
              <TopicItem
                key={t.id}
                topic={t}
                mode={mode}
                selected={isSelected(t.id)}
                onToggle={() => toggleTopic(t.id)}
                indent={true}
              />
            ))}
          </div>
        );
      })}
    </>
  );
}

// ── Fila de tema individual ────────────────────────────────────────

function TopicItem({
  topic,
  mode,
  selected,
  onToggle,
  indent,
}: {
  topic: Topic;
  mode: "single" | "multi";
  selected: boolean;
  onToggle: () => void;
  indent: boolean;
}) {
  const accuracy = topic.totalAnswered && topic.totalAnswered > 0
    ? Math.round(((topic.totalCorrect ?? 0) / topic.totalAnswered) * 100)
    : null;

  const label = getLabel(topic);

  return (
    <div
      onClick={onToggle}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.5rem",
        padding: `0.45rem ${indent ? "1.25rem" : "0.75rem"}`,
        cursor: "pointer",
        background: selected ? "oklch(0.93 0 0)" : "oklch(1 0 0)",
        borderBottom: "1px solid oklch(0.94 0 0)",
      }}
      onMouseEnter={(e) => { if (!selected) e.currentTarget.style.background = "oklch(0.97 0 0)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = selected ? "oklch(0.93 0 0)" : "oklch(1 0 0)"; }}
    >
      {/* Número de tema badge */}
      {topic.topicNumber != null && (
        <span style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          fontWeight: 900,
          fontSize: "0.62rem",
          letterSpacing: "0.1em",
          background: selected ? "oklch(0.15 0 0)" : "oklch(0.88 0 0)",
          color: selected ? "oklch(0.97 0 0)" : "oklch(0.35 0 0)",
          padding: "0.05rem 0.35rem",
          flexShrink: 0,
        }}>
          T{topic.topicNumber}
        </span>
      )}

      {mode === "multi" ? (
        selected
          ? <CheckSquare size={13} style={{ color: "oklch(0.10 0 0)", flexShrink: 0 }} />
          : <Square size={13} style={{ color: "oklch(0.70 0 0)", flexShrink: 0 }} />
      ) : (
        <div style={{
          width: "8px",
          height: "8px",
          borderRadius: "50%",
          background: selected ? "oklch(0.10 0 0)" : "oklch(0.85 0 0)",
          flexShrink: 0,
        }} />
      )}

      <span style={{
        flex: 1,
        fontFamily: "'Barlow', sans-serif",
        fontSize: "0.83rem",
        color: selected ? "oklch(0.10 0 0)" : "oklch(0.25 0 0)",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}>
        {label}
      </span>

      {accuracy !== null && (
        <span style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          fontWeight: 700,
          fontSize: "0.72rem",
          color: accuracy >= 70 ? "oklch(0.25 0 0)" : accuracy >= 50 ? "oklch(0.45 0 0)" : "oklch(0.60 0 0)",
          flexShrink: 0,
        }}>
          {accuracy}%
        </span>
      )}
    </div>
  );
}
