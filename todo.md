# Oposiciones Arquitecto Técnico — TODO

## Fase 1: Base de datos y diseño
- [x] Esquema DB: tablas documents, questions, answer_sessions, user_progress
- [x] Migración SQL aplicada
- [x] Sistema de diseño industrial brutalista (CSS variables, tipografía, paleta grises)
- [x] Layout principal con sidebar y AppLayout adaptado

## Fase 2: Gestión de documentos
- [x] Subida de PDFs a S3 desde la app
- [x] Panel de documentos activos (convocatoria / exámenes anteriores)
- [x] Eliminación de documentos
- [x] Visualización de metadatos del documento (nombre, fecha, tipo, tamaño)

## Fase 3: Banco de preguntas con IA
- [x] Extracción automática de preguntas desde PDF subido (IA)
- [x] Almacenamiento estructurado: pregunta, opciones A/B/C/D, respuesta correcta, bloque temático, fuente
- [x] Listado y gestión del banco de preguntas
- [x] Etiquetado por bloque temático

## Fase 4: Generación IA y modo práctica
- [x] Generación de nuevas preguntas con IA (conocimiento propio + convocatoria)
- [x] Modo práctica: responder pregunta, corrección inmediata, explicación IA
- [x] Filtrado por bloque temático o fuente (real vs. IA)
- [x] Configuración de número de preguntas por sesión

## Fase 5: Progreso y dashboard
- [x] Registro de sesiones de respuesta (acierto/fallo por pregunta)
- [x] Estadísticas por bloque temático: % aciertos, preguntas respondidas, fallos
- [x] Dashboard principal: resumen global + acceso rápido a modos de estudio
- [x] Indicadores visuales de progreso por bloque

## Fase 6: Sincronización GitHub
- [x] Configuración de repositorio GitHub del usuario
- [x] Sincronización: PDFs del repo aparecen en la app automáticamente
- [x] Push: documentos subidos desde la app se envían al repo
- [x] Panel de estado de sincronización (última sync, cambios pendientes)
- [x] Estructura de carpetas inicializada en Songorka/Estudia_opo_arq_tec

## Fase 7: Módulo de Exámenes
- [x] Página de configuración de examen: selección de temas, número de preguntas, fuente (real/IA/mixto)
- [x] Motor de examen: preguntas sin feedback inmediato, opción de dejar en blanco
- [x] Pantalla de feedback completo post-examen: nota, aciertos, fallos, en blanco
- [x] Desglose por tema en el feedback: mejor y peor preparado
- [x] Listado de preguntas falladas y en blanco con respuesta correcta y explicación
- [x] Historial de exámenes realizados con acceso al feedback anterior
- [x] Penalización configurable (ej: -0.25 por error, 0 en blanco)
- [x] Persistencia de exámenes en BD (tabla examSessions + examAnswers)

## Fase 8: Filtro temporal en Dashboard
- [x] Selector de rango temporal en Dashboard: hoy, última semana, último mes, todo el histórico
- [x] Estadísticas globales filtradas por rango de fechas
- [x] Gráfico de evolución de precisión en el tiempo
- [x] Actualizar endpoint stats.overview para aceptar parámetro de rango de fechas

## Pendiente (detectado en revisión)
- [ ] Acceso desde historial de exámenes para reabrir resultados anteriores
- [ ] Gráfico de evolución temporal de precisión en Dashboard
