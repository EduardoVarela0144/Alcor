// Problemas de System Design. El candidato dibuja su diagrama en el pizarrón y escribe
// sus decisiones en las notas. `rubric` es solo para el evaluador (como los casos ocultos).
// Cada problema trae su traducción al inglés en `en`.

const D = (o) => ({ kind: 'design', ...o });

module.exports = [
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
