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
- [x] Acceso desde historial de exámenes para reabrir resultados anteriores
- [x] Gráfico de evolución temporal de precisión en Dashboard

## Fase 8: Reorganización de Documentos por categoría

- [x] Tres categorías diferenciadas en la UI: Convocatoria, Exámenes, Temas Teóricos
- [x] Cada categoría con su propio panel de subida y descripción de uso
- [x] Convocatoria: solo un PDF activo a la vez (reemplaza el anterior)
- [x] Exámenes: múltiples PDFs, cada uno con año/convocatoria identificable
- [x] Temas Teóricos: múltiples PDFs organizados por bloque temático
- [x] Etiqueta visual de categoría en cada documento de la lista
- [x] Filtro por categoría en el banco de preguntas (fuente: convocatoria / examen / tema)
- [x] Actualizar el tipo `docType` en la BD para reflejar los tres valores: convocatoria, examen, tema

## Fase 8b: Gaps detectados en revisión

- [x] Backend: al subir convocatoria nueva, archivar/reemplazar la anterior automáticamente
- [x] Temas teóricos: selector de bloque temático al subir + visualización en lista
- [x] Banco de preguntas: filtro por tipo de documento origen (convocatoria / examen / tema)

## Bugs detectados (fase 9)

- [x] Push a GitHub falla: el token no está configurado o no se valida correctamente antes del push
- [x] Extracción de preguntas desde PDF falla: error al llamar a la IA con la URL del archivo

## Fase 9: Bugs + Temario

- [x] Bug push GitHub: mostrar aviso claro cuando no hay token y redirigir a configuración
- [x] Bug extracción PDF: corregir la URL de acceso al archivo en S3 para la IA
- [x] Sección Temario: página con listado de todos los temas (topics) de la BD
- [x] Temario: indicador visual de si el tema tiene documento PDF asociado
- [x] Temario: acceso rápido a subir documento para temas sin PDF
- [x] Navegación: añadir Temario al sidebar

## Fase 10: Extracción PDF + Temas automáticos

- [x] Diagnosticar y corregir el error de extracción de preguntas desde PDF
- [x] Al procesar la convocatoria, extraer automáticamente los temas y crearlos en el Temario
- [x] Al procesar exámenes/temas, asociar las preguntas al bloque temático correspondiente

## Fase 10b: Gaps detectados

- [x] Al extraer preguntas de documentos tipo `tema`, usar `doc.topicId` para forzar la asociación al bloque seleccionado al subir (evitar duplicados de temas por inferencia IA)

## Fase 10c: Validación topicId en temas

- [x] Frontend: bloquear subida de documentos tipo `tema` si no se selecciona bloque temático
- [x] Backend: validar que `topicId` es obligatorio en `getUploadUrl` para tipo `tema`
