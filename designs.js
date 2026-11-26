// Problemas de System Design. El candidato dibuja su diagrama en el pizarrón y escribe
// sus decisiones en las notas. `rubric` es solo para el evaluador (como los casos ocultos).
// Cada problema trae su traducción al inglés en `en`.

const D = (o) => ({ kind: 'design', ...o });
// Problemas de IA / RAG: 60 minutos, aparecen en su propio grupo del catálogo
const AI = (o) => D({ track: 'ai', difficulty: 'Difícil', minutes: 60, topic: 'IA / RAG', ...o, en: { topic: 'AI / RAG', ...o.en } });

module.exports = [
  // ---------------- IA / RAG (60 min) ----------------
  AI({
    id: 'ai-rag-docs', title: 'Asistente RAG sobre documentos internos',
    description: 'Diseña un asistente que responde preguntas de los empleados usando los documentos internos de la empresa (wikis, PDFs, tickets, Drive). Son 2 millones de documentos que cambian todos los días, y cada respuesta debe citar sus fuentes.',
    requirements: ['Ingerir y mantener actualizados 2 millones de documentos de varias fuentes', 'Responder en menos de 5 segundos con citas a los documentos usados', 'Respetar permisos: nadie ve contenido de documentos a los que no tiene acceso', 'Reducir alucinaciones: decir "no sé" cuando no hay información', 'Medir la calidad de las respuestas y mejorarla con el tiempo'],
    questions: ['¿Cómo partes (chunking) los documentos y qué metadatos guardas?', '¿Qué modelo de embeddings y qué base vectorial usas? ¿Búsqueda híbrida?', '¿Cómo aplicas los permisos en la búsqueda?', '¿Cómo armas el prompt y controlas el tamaño del contexto?', '¿Cómo evalúas que las respuestas sean correctas y estén bien fundamentadas?', '¿Qué haces cuando un documento cambia o se borra?'],
    rubric: ['Pipeline de ingesta: conectores, parsing/OCR, limpieza, chunking con solapamiento y metadatos', 'Embeddings en lote e incrementales, reindexación al cambiar documentos', 'Base vectorial + búsqueda híbrida (BM25 + vectores) y re-ranking', 'Filtrado por permisos (ACL) dentro de la búsqueda, no después', 'Construcción del prompt: top-k, presupuesto de tokens, instrucciones de citar y abstenerse', 'Citas verificables y manejo de "no sé"', 'Evaluación: conjunto dorado, métricas de recuperación (recall@k) y de fidelidad, LLM-as-judge, feedback de usuarios', 'Latencia y costo: caché semántico, streaming, modelos más chicos donde se pueda', 'Observabilidad: trazas por pregunta (consulta, chunks, prompt, respuesta)'],
    en: {
      title: 'RAG assistant over internal documents',
      description: 'Design an assistant that answers employee questions using the company’s internal documents (wikis, PDFs, tickets, Drive). There are 2 million documents that change every day, and every answer must cite its sources.',
      requirements: ['Ingest and keep up to date 2 million documents from several sources', 'Answer in under 5 seconds with citations to the documents used', 'Respect permissions: nobody sees content from documents they cannot access', 'Reduce hallucinations: say "I don’t know" when there is no information', 'Measure answer quality and improve it over time'],
      questions: ['How do you chunk the documents and what metadata do you keep?', 'Which embedding model and vector store do you use? Hybrid search?', 'How do you enforce permissions during retrieval?', 'How do you build the prompt and control the context size?', 'How do you evaluate that answers are correct and grounded?', 'What happens when a document changes or is deleted?'],
      rubric: ['Ingestion pipeline: connectors, parsing/OCR, cleaning, overlapping chunks with metadata', 'Batch and incremental embeddings, reindexing when documents change', 'Vector store + hybrid search (BM25 + vectors) and re-ranking', 'Permission (ACL) filtering inside retrieval, not afterwards', 'Prompt construction: top-k, token budget, instructions to cite and abstain', 'Verifiable citations and handling "I don’t know"', 'Evaluation: golden set, retrieval metrics (recall@k) and faithfulness, LLM-as-judge, user feedback', 'Latency and cost: semantic cache, streaming, smaller models where possible', 'Observability: per-question traces (query, chunks, prompt, answer)'],
    },
  }),
  AI({
    id: 'ai-ingestion-pipeline', title: 'Pipeline de ingesta y embeddings a escala',
    description: 'Diseña el pipeline que procesa 50,000 documentos nuevos por hora (PDFs escaneados, HTML, Word, hojas de cálculo) y los deja listos para búsqueda semántica. Varios equipos de producto consumen el índice resultante.',
    requirements: ['Extraer texto, tablas e imágenes, incluido OCR para escaneos', 'Generar embeddings sin pasarse de los límites de la API ni del presupuesto', 'Procesar solo lo que cambió (incremental) y evitar duplicados', 'Poder cambiar de modelo de embeddings sin apagar la búsqueda', 'Reintentar fallas y saber en qué estado está cada documento'],
    questions: ['¿Cómo divides el pipeline en etapas y cómo se comunican?', '¿Cómo manejas los límites de tasa y el costo del proveedor de embeddings?', '¿Cómo detectas que un documento ya fue procesado?', '¿Cómo migras a un nuevo modelo de embeddings sin downtime?', '¿Qué monitoreas para saber que la calidad no se degradó?'],
    rubric: ['Etapas desacopladas con colas: extracción, limpieza, chunking, embeddings, indexado', 'Parsing por tipo de archivo + OCR, preservando estructura (títulos, tablas)', 'Hash de contenido para deduplicar y procesar incrementalmente', 'Batching, rate limiting, reintentos con backoff y dead-letter queue', 'Control de costo: caché de embeddings, priorización, modelos open-source auto-hospedados como opción', 'Versionado de índices y migración en paralelo (dual-write / blue-green) al cambiar de modelo', 'Estado por documento y reprocesamiento idempotente', 'Métricas: throughput, latencia por etapa, errores, muestras de calidad de chunks'],
    en: {
      title: 'Ingestion and embeddings pipeline at scale',
      description: 'Design the pipeline that processes 50,000 new documents per hour (scanned PDFs, HTML, Word, spreadsheets) and makes them ready for semantic search. Several product teams consume the resulting index.',
      requirements: ['Extract text, tables and images, including OCR for scans', 'Generate embeddings without exceeding API limits or the budget', 'Process only what changed (incremental) and avoid duplicates', 'Be able to switch embedding models without taking search down', 'Retry failures and know the state of every document'],
      questions: ['How do you split the pipeline into stages and how do they communicate?', 'How do you handle the embedding provider’s rate limits and cost?', 'How do you detect that a document was already processed?', 'How do you migrate to a new embedding model with no downtime?', 'What do you monitor to know quality has not degraded?'],
      rubric: ['Decoupled stages with queues: extraction, cleaning, chunking, embeddings, indexing', 'Per-file-type parsing + OCR, preserving structure (headings, tables)', 'Content hashing for deduplication and incremental processing', 'Batching, rate limiting, retries with backoff and a dead-letter queue', 'Cost control: embedding cache, prioritization, self-hosted open-source models as an option', 'Index versioning and parallel migration (dual-write / blue-green) when switching models', 'Per-document state and idempotent reprocessing', 'Metrics: throughput, per-stage latency, errors, chunk quality samples'],
    },
  }),
  AI({
    id: 'ai-support-agent', title: 'Agente de soporte con herramientas',
    description: 'Diseña un agente de IA que atiende el chat de soporte de una tienda en línea: responde dudas con la base de conocimiento y puede ejecutar acciones (consultar pedidos, iniciar reembolsos, cambiar direcciones). Atiende 20,000 conversaciones al día.',
    requirements: ['Responder con información de la base de conocimiento y del pedido del cliente', 'Ejecutar acciones reales mediante herramientas (APIs internas)', 'Nunca hacer reembolsos por encima de un límite sin aprobación humana', 'Pasar la conversación a un humano cuando haga falta, con contexto', 'Resistir intentos de manipulación (prompt injection)'],
    questions: ['¿Cómo decide el agente qué herramienta usar y con qué datos?', '¿Qué guardrails pones antes y después de cada acción?', '¿Cómo manejas la memoria de la conversación y el contexto del cliente?', '¿Cuándo y cómo escalas a un humano?', '¿Cómo pruebas el agente antes de cada cambio de prompt o modelo?'],
    rubric: ['Orquestador del agente: loop de razonamiento con function calling y límites de pasos', 'Herramientas con esquemas estrictos, permisos mínimos y validación de parámetros', 'Guardrails: políticas (montos, identidad verificada), confirmación del usuario, aprobación humana', 'Defensa contra prompt injection: separar instrucciones de datos, no confiar en contenido recuperado', 'RAG sobre la base de conocimiento + contexto del pedido', 'Memoria: resumen de conversación, estado estructurado del caso', 'Escalamiento a humano con traspaso de contexto', 'Evaluación: conversaciones de prueba, simulación, métricas de resolución y de errores en acciones; auditoría de cada acción'],
    en: {
      title: 'Support agent with tools',
      description: 'Design an AI agent that handles the support chat of an online store: it answers questions using the knowledge base and can take actions (look up orders, start refunds, change addresses). It handles 20,000 conversations a day.',
      requirements: ['Answer with information from the knowledge base and the customer’s order', 'Take real actions through tools (internal APIs)', 'Never refund above a limit without human approval', 'Hand the conversation to a human when needed, with context', 'Resist manipulation attempts (prompt injection)'],
      questions: ['How does the agent decide which tool to use and with which data?', 'What guardrails do you put before and after each action?', 'How do you handle conversation memory and customer context?', 'When and how do you escalate to a human?', 'How do you test the agent before every prompt or model change?'],
      rubric: ['Agent orchestrator: reasoning loop with function calling and step limits', 'Tools with strict schemas, least privilege and parameter validation', 'Guardrails: policies (amounts, verified identity), user confirmation, human approval', 'Prompt injection defense: separate instructions from data, do not trust retrieved content', 'RAG over the knowledge base + order context', 'Memory: conversation summary, structured case state', 'Escalation to a human with context handoff', 'Evaluation: test conversations, simulation, resolution and action-error metrics; audit log of every action'],
    },
  }),
  AI({
    id: 'ai-llm-gateway', title: 'Gateway de LLMs para toda la empresa',
    description: 'Diseña un gateway interno por el que pasan todas las llamadas a modelos de lenguaje de la empresa (varios proveedores y modelos propios). Lo usan 40 equipos y hoy el gasto en LLMs crece sin control.',
    requirements: ['Una sola API para varios proveedores y modelos', 'Presupuestos y límites por equipo, con reportes de costo', 'Fallback automático si un proveedor falla o está lento', 'Quitar datos sensibles (PII) antes de enviarlos a proveedores externos', 'Registrar cada llamada para auditoría y depuración'],
    questions: ['¿Cómo enrutas cada petición al modelo adecuado?', '¿Dónde y cómo cuentas tokens y costo?', '¿Cómo implementas caché sin devolver respuestas incorrectas?', '¿Cómo detectas y ocultas PII?', '¿Qué pasa con el streaming de respuestas?'],
    rubric: ['API unificada y adaptadores por proveedor', 'Ruteo por costo/latencia/calidad y fallbacks con circuit breaker', 'Rate limits y presupuestos por equipo; conteo de tokens y atribución de costo', 'Caché exacta y semántica con criterios de cuándo usarla', 'Redacción de PII y políticas de qué datos pueden salir', 'Soporte de streaming y timeouts', 'Logging y trazas con retención y control de acceso', 'Alta disponibilidad del gateway (no debe ser un punto único de falla)'],
    en: {
      title: 'Company-wide LLM gateway',
      description: 'Design an internal gateway that every language-model call in the company goes through (several providers and in-house models). 40 teams use it and LLM spend is currently growing out of control.',
      requirements: ['A single API for several providers and models', 'Budgets and limits per team, with cost reports', 'Automatic fallback if a provider fails or is slow', 'Strip sensitive data (PII) before sending it to external providers', 'Log every call for auditing and debugging'],
      questions: ['How do you route each request to the right model?', 'Where and how do you count tokens and cost?', 'How do you add caching without returning wrong answers?', 'How do you detect and mask PII?', 'What about streaming responses?'],
      rubric: ['Unified API and per-provider adapters', 'Routing by cost/latency/quality and fallbacks with a circuit breaker', 'Per-team rate limits and budgets; token counting and cost attribution', 'Exact and semantic caching with criteria for when to use it', 'PII redaction and policies on what data may leave', 'Streaming support and timeouts', 'Logging and traces with retention and access control', 'Gateway high availability (it must not be a single point of failure)'],
    },
  }),
  AI({
    id: 'ai-eval-platform', title: 'Plataforma de evaluación y observabilidad de LLMs',
    description: 'Diseña la plataforma que usan los equipos para evaluar sus aplicaciones con LLMs antes de cada release y monitorearlas en producción (chatbots, RAG, agentes). Hoy los cambios de prompt rompen cosas sin que nadie se entere.',
    requirements: ['Correr suites de evaluación sobre conjuntos de prueba versionados', 'Comparar dos versiones (prompt, modelo, retrieval) lado a lado', 'Bloquear un deploy si la calidad baja de un umbral', 'Ver trazas de producción y detectar regresiones', 'Convertir fallas de producción en nuevos casos de prueba'],
    questions: ['¿Qué métricas usas y cómo calificas respuestas abiertas?', '¿Cómo haces confiable el uso de un LLM como juez?', '¿Cómo integras la evaluación al CI/CD?', '¿Cómo muestreas producción sin violar privacidad?', '¿Cómo manejas el costo de correr miles de evaluaciones?'],
    rubric: ['Datasets versionados y casos etiquetados (incluyendo casos difíciles y adversariales)', 'Métricas deterministas + LLM-as-judge con rúbricas, calibración contra humanos', 'Runner distribuido con caché de resultados y control de costo', 'Comparaciones A/B y reportes de regresión', 'Integración con CI/CD y umbrales de bloqueo', 'Tracing en producción (spans de retrieval, prompts, tools), muestreo y redacción de PII', 'Ciclo de feedback: fallas de producción → nuevos casos de prueba', 'Monitoreo online: drift, tasa de "no sé", feedback de usuarios'],
    en: {
      title: 'LLM evaluation and observability platform',
      description: 'Design the platform teams use to evaluate their LLM applications before every release and monitor them in production (chatbots, RAG, agents). Today prompt changes break things without anyone noticing.',
      requirements: ['Run evaluation suites on versioned test sets', 'Compare two versions (prompt, model, retrieval) side by side', 'Block a deploy if quality drops below a threshold', 'View production traces and detect regressions', 'Turn production failures into new test cases'],
      questions: ['Which metrics do you use and how do you grade open-ended answers?', 'How do you make an LLM-as-judge reliable?', 'How do you integrate evaluation into CI/CD?', 'How do you sample production without violating privacy?', 'How do you handle the cost of running thousands of evaluations?'],
      rubric: ['Versioned datasets and labeled cases (including hard and adversarial ones)', 'Deterministic metrics + LLM-as-judge with rubrics, calibrated against humans', 'Distributed runner with result caching and cost control', 'A/B comparisons and regression reports', 'CI/CD integration and blocking thresholds', 'Production tracing (retrieval, prompt and tool spans), sampling and PII redaction', 'Feedback loop: production failures → new test cases', 'Online monitoring: drift, "I don’t know" rate, user feedback'],
    },
  }),
  // ---------------- Clásicos ----------------
  D({
    id: 'sd-url-shortener', title: 'Acortador de URLs', difficulty: 'Media', topic: 'Diseño de sistemas', minutes: 35,
    description: 'Diseña un servicio como bit.ly que convierte URLs largas en links cortos y redirige a quien los abre. Se crean 100 millones de links al mes y hay 100 lecturas por cada escritura.',
    requirements: ['Crear un link corto a partir de una URL larga', 'Redirigir rápido (latencia baja) al abrir el link', 'Alias personalizado opcional y fecha de expiración', 'Contar clics por link', 'Alta disponibilidad: las redirecciones no deben caerse'],
    questions: ['¿Cómo generas los códigos cortos sin colisiones?', '¿Qué base de datos usas y cómo es el esquema?', '¿Dónde pones caché para las redirecciones?', '¿Cómo escalas cuando el tráfico se multiplica por 10?', '¿Cómo registras los clics sin frenar la redirección?'],
    rubric: ['Aclara requerimientos y estima tráfico/almacenamiento', 'Define API (crear, redirigir, estadísticas)', 'Estrategia de IDs (base62, contador, hash) y manejo de colisiones', 'Modelo de datos y elección de base de datos justificada', 'Caché (CDN / Redis) para lecturas', 'Escalamiento: réplicas, particionado, balanceo', 'Analítica asíncrona (cola / stream)', 'Explica trade-offs y cuellos de botella'],
    en: {
      title: 'URL shortener', topic: 'System design',
      description: 'Design a service like bit.ly that turns long URLs into short links and redirects whoever opens them. 100 million links are created per month and there are 100 reads for every write.',
      requirements: ['Create a short link from a long URL', 'Redirect quickly (low latency) when the link is opened', 'Optional custom alias and expiration date', 'Count clicks per link', 'High availability: redirects must not go down'],
      questions: ['How do you generate short codes without collisions?', 'Which database do you use and what is the schema?', 'Where do you cache redirects?', 'How do you scale when traffic grows 10x?', 'How do you record clicks without slowing down the redirect?'],
      rubric: ['Clarifies requirements and estimates traffic/storage', 'Defines the API (create, redirect, stats)', 'ID strategy (base62, counter, hash) and collision handling', 'Data model and a justified database choice', 'Caching (CDN / Redis) for reads', 'Scaling: replicas, partitioning, load balancing', 'Asynchronous analytics (queue / stream)', 'Explains trade-offs and bottlenecks'],
    },
  }),
  D({
    id: 'sd-rate-limiter', title: 'Rate limiter distribuido', difficulty: 'Media', topic: 'Diseño de sistemas', minutes: 30,
    description: 'Diseña un rate limiter para el API gateway de una empresa con decenas de servidores. Cada cliente tiene un límite de peticiones por minuto según su plan.',
    requirements: ['Limitar por API key y por IP', 'Límites distintos por plan (gratis, pro, empresa)', 'Funcionar con muchos servidores detrás de un balanceador', 'Responder 429 con el tiempo de espera', 'Agregar muy poca latencia a cada petición'],
    questions: ['¿Qué algoritmo usas (token bucket, ventana deslizante...)?', '¿Dónde guardas los contadores compartidos?', '¿Qué pasa si el almacén de contadores se cae?', '¿Cómo evitas condiciones de carrera entre servidores?'],
    rubric: ['Compara algoritmos (token bucket, leaky bucket, ventana fija/deslizante)', 'Almacén compartido (p. ej. Redis) con operaciones atómicas', 'Ubicación: gateway / middleware / sidecar', 'Manejo de fallas (fail-open vs fail-closed)', 'Configuración de límites por plan', 'Headers de respuesta y 429', 'Considera latencia y consistencia'],
    en: {
      title: 'Distributed rate limiter', topic: 'System design',
      description: 'Design a rate limiter for the API gateway of a company with dozens of servers. Each client has a requests-per-minute limit based on their plan.',
      requirements: ['Limit by API key and by IP', 'Different limits per plan (free, pro, enterprise)', 'Work across many servers behind a load balancer', 'Respond 429 with the retry time', 'Add very little latency to each request'],
      questions: ['Which algorithm do you use (token bucket, sliding window...)?', 'Where do you store the shared counters?', 'What happens if the counter store goes down?', 'How do you avoid race conditions between servers?'],
      rubric: ['Compares algorithms (token bucket, leaky bucket, fixed/sliding window)', 'Shared store (e.g. Redis) with atomic operations', 'Placement: gateway / middleware / sidecar', 'Failure handling (fail-open vs fail-closed)', 'Per-plan limit configuration', 'Response headers and 429', 'Considers latency and consistency'],
    },
  }),
  D({
    id: 'sd-notifications', title: 'Sistema de notificaciones', difficulty: 'Media', topic: 'Diseño de sistemas', minutes: 35,
    description: 'Diseña un sistema que envía notificaciones por push, correo y SMS a millones de usuarios. Otros servicios de la empresa lo usan para avisar de pagos, mensajes y promociones.',
    requirements: ['Enviar por push, correo y SMS', 'Respetar las preferencias de cada usuario', 'Notificaciones urgentes (pagos) antes que las de marketing', 'Reintentar si un proveedor falla, sin enviar duplicados', 'Plantillas y estadísticas de entrega'],
    questions: ['¿Cómo desacoplas a quien pide la notificación de quien la envía?', '¿Cómo priorizas lo urgente?', '¿Cómo evitas enviar la misma notificación dos veces?', '¿Qué haces cuando un proveedor externo está caído?'],
    rubric: ['API de entrada y validación de preferencias', 'Colas por canal y por prioridad', 'Workers por canal y proveedores externos', 'Reintentos con backoff y dead-letter queue', 'Idempotencia / deduplicación', 'Plantillas y rate limits por usuario', 'Seguimiento de estado y métricas'],
    en: {
      title: 'Notification system', topic: 'System design',
      description: 'Design a system that sends push, email and SMS notifications to millions of users. Other services in the company use it to notify about payments, messages and promotions.',
      requirements: ['Send via push, email and SMS', 'Respect each user’s preferences', 'Urgent notifications (payments) before marketing ones', 'Retry if a provider fails, without sending duplicates', 'Templates and delivery statistics'],
      questions: ['How do you decouple whoever requests the notification from whoever sends it?', 'How do you prioritize urgent messages?', 'How do you avoid sending the same notification twice?', 'What do you do when an external provider is down?'],
      rubric: ['Ingestion API and preference checks', 'Queues per channel and priority', 'Per-channel workers and external providers', 'Retries with backoff and a dead-letter queue', 'Idempotency / deduplication', 'Templates and per-user rate limits', 'Status tracking and metrics'],
    },
  }),
  D({
    id: 'sd-chat', title: 'App de mensajería', difficulty: 'Difícil', topic: 'Diseño de sistemas', minutes: 45,
    description: 'Diseña una app de mensajería como WhatsApp con chats uno a uno y grupales para 50 millones de usuarios activos al día.',
    requirements: ['Mensajes en tiempo real 1 a 1 y en grupos (hasta 500 personas)', 'Entregar mensajes a quien estaba desconectado al volver', 'Confirmaciones de enviado, entregado y leído', 'Estado en línea / última vez', 'Historial guardado y sincronizado entre dispositivos'],
    questions: ['¿Qué protocolo usas para el tiempo real?', '¿Cómo sabes a qué servidor está conectado cada usuario?', '¿Cómo guardas los mensajes y cómo los particionas?', '¿Cómo entregas un mensaje a un grupo grande?'],
    rubric: ['Conexiones persistentes (WebSockets) y servidores de chat', 'Registro de presencia / qué usuario está en qué servidor', 'Flujo de envío con colas y entrega offline', 'Almacenamiento de mensajes (wide-column) y partición por chat', 'Fan-out en grupos', 'Confirmaciones y orden de mensajes', 'Push para usuarios desconectados', 'Escalamiento y tolerancia a fallas'],
    en: {
      title: 'Messaging app', topic: 'System design',
      description: 'Design a messaging app like WhatsApp with one-to-one and group chats for 50 million daily active users.',
      requirements: ['Real-time 1:1 and group messages (up to 500 people)', 'Deliver messages to offline users when they come back', 'Sent, delivered and read receipts', 'Online status / last seen', 'History stored and synced across devices'],
      questions: ['Which protocol do you use for real time?', 'How do you know which server each user is connected to?', 'How do you store messages and how do you partition them?', 'How do you deliver a message to a large group?'],
      rubric: ['Persistent connections (WebSockets) and chat servers', 'Presence registry / which user is on which server', 'Send flow with queues and offline delivery', 'Message storage (wide-column) partitioned by chat', 'Group fan-out', 'Receipts and message ordering', 'Push for offline users', 'Scaling and fault tolerance'],
    },
  }),
  D({
    id: 'sd-news-feed', title: 'Feed de red social', difficulty: 'Difícil', topic: 'Diseño de sistemas', minutes: 45,
    description: 'Diseña el feed de inicio de una red social: cada usuario ve las publicaciones recientes de las personas que sigue. Algunas cuentas tienen millones de seguidores.',
    requirements: ['Publicar texto e imágenes', 'Ver el feed ordenado y paginado', 'Que el feed cargue en menos de 200 ms', 'Soportar cuentas famosas con millones de seguidores', 'Likes y comentarios'],
    questions: ['¿Armas el feed al publicar (fan-out on write) o al leer?', '¿Qué haces con las cuentas famosas?', '¿Dónde guardas las imágenes?', '¿Cómo paginas el feed?'],
    rubric: ['Servicios: publicación, grafo social, feed, medios', 'Fan-out on write vs on read y enfoque híbrido para famosos', 'Caché del feed por usuario', 'Almacenamiento de medios en object storage + CDN', 'Paginación por cursor', 'Contadores de likes/comentarios', 'Ranking y consistencia eventual'],
    en: {
      title: 'Social media feed', topic: 'System design',
      description: 'Design the home feed of a social network: each user sees recent posts from the people they follow. Some accounts have millions of followers.',
      requirements: ['Post text and images', 'View the feed sorted and paginated', 'The feed must load in under 200 ms', 'Support celebrity accounts with millions of followers', 'Likes and comments'],
      questions: ['Do you build the feed when posting (fan-out on write) or when reading?', 'What do you do about celebrity accounts?', 'Where do you store images?', 'How do you paginate the feed?'],
      rubric: ['Services: posting, social graph, feed, media', 'Fan-out on write vs on read and a hybrid approach for celebrities', 'Per-user feed cache', 'Media in object storage + CDN', 'Cursor-based pagination', 'Like/comment counters', 'Ranking and eventual consistency'],
    },
  }),
  D({
    id: 'sd-file-sync', title: 'Almacenamiento de archivos', difficulty: 'Difícil', topic: 'Diseño de sistemas', minutes: 45,
    description: 'Diseña un servicio como Dropbox o Google Drive: los usuarios suben archivos y estos se sincronizan entre sus dispositivos.',
    requirements: ['Subir y descargar archivos de hasta 10 GB', 'Sincronizar cambios entre dispositivos', 'Compartir archivos y carpetas con otras personas', 'Historial de versiones', 'Funcionar con conexiones lentas o intermitentes'],
    questions: ['¿Cómo subes archivos grandes de forma confiable?', '¿Cómo detectas y envías solo lo que cambió?', '¿Dónde guardas los archivos y dónde sus metadatos?', '¿Qué pasa si dos dispositivos editan el mismo archivo?'],
    rubric: ['Separación de metadatos (BD) y bloques (object storage)', 'Chunking, deduplicación y subidas reanudables', 'Servicio de sincronización y notificación de cambios', 'Resolución de conflictos', 'Permisos y compartir', 'Versionado', 'CDN / URLs firmadas para descargas'],
    en: {
      title: 'File storage and sync', topic: 'System design',
      description: 'Design a service like Dropbox or Google Drive: users upload files and they sync across their devices.',
      requirements: ['Upload and download files up to 10 GB', 'Sync changes across devices', 'Share files and folders with other people', 'Version history', 'Work on slow or flaky connections'],
      questions: ['How do you upload large files reliably?', 'How do you detect and send only what changed?', 'Where do you store files and where their metadata?', 'What happens if two devices edit the same file?'],
      rubric: ['Separate metadata (DB) from blocks (object storage)', 'Chunking, deduplication and resumable uploads', 'Sync service and change notifications', 'Conflict resolution', 'Permissions and sharing', 'Versioning', 'CDN / signed URLs for downloads'],
    },
  }),
];
