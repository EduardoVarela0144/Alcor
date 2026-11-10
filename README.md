# ✦ Alcor

Evaluaciones técnicas en tiempo real. Escribes el nombre del candidato, eliges uno o varios ejercicios
del catálogo, Alcor genera un link y el candidato los resuelve en **Python** o **JavaScript** dentro de un editor en el navegador,
con **tests automáticos**. Tú ves su código, ejecuciones y actividad **en vivo** desde un panel
de administrador al que solo tú tienes acceso.

- **Sin base de datos ni dependencias**: un solo `server.js` con Node puro. El estado vive en `data/db.json`.
- **Ejecución local en el navegador**: JavaScript corre en un Web Worker; Python corre con
  [Pyodide](https://pyodide.org) (CPython en WebAssembly). Timeout de 6 s contra ciclos infinitos.
- **Links firmados (HMAC)**: el link contiene nombre, reto, lenguaje y duración firmados; aunque el
  servidor se reinicie, el link sigue siendo válido.
- **Tests ocultos**: el candidato solo ve los ejemplos. Los casos ocultos solo llegan al admin, que
  puede re-ejecutar el código del candidato con todos los casos (los resultados del candidato son
  informativos y no se pueden falsificar para el admin).
- **Versiones**: el candidato guarda copias con nombre (⌘S / Ctrl+S) y se crea una automática cada vez que corre
  los tests. Puede ver cualquiera y restaurarla; antes de restaurar se guarda su código actual. Tú también ves sus versiones.
- **22 temas + Sistema** (Claro, Papel, GitHub, Solarized, Catppuccin, Rosé Pine, Menta, Oscuro, Medianoche, Dracula,
  Nord, One Dark, Tokyo Night, Gruvbox, Monokai, Océano y dos de alto contraste) con vista previa, más tamaño del código.
  Eliges el tema inicial del candidato al preparar el link y cada quien puede cambiarlo. Se definen en `public/themes.js`.
- **Correo con el link**: mensaje listo con la fecha en la zona del candidato y en UTC. Se abre en tu cliente de correo
  (mailto) o, si configuras `RESEND_API_KEY`, se envía directo desde Alcor.
- **Zonas horarias**: programas la hora en la zona que elijas (la tuya o la del candidato); el candidato la ve convertida
  a su hora local con cuenta regresiva.
- **Bloquear / desbloquear** cualquier link que aún no se usa, aunque ya lo hayas mandado, y cambiar su fecha.
- **Señales de integridad**: número de pegados (paste), cambios de pestaña, ejecuciones y una línea de tiempo.
- **Tiempo real** vía Server-Sent Events (sin websockets ni buses de mensajes): ves el código ~0.5 s después
  de cada tecla, un indicador de "escribiendo…" y puedes seguir automáticamente el ejercicio que tiene abierto.
- **Catálogo de 17 ejercicios** (Fácil / Media / Difícil) con vista previa de instrucciones y casos antes de asignarlos.
- **Autoguardado triple**: servidor (cada tecla, con reintentos), `localStorage` del candidato (sobrevive a
  recargas, cierres y caídas de internet) y `localStorage` del admin. Si el servidor se reinicia y pierde
  `db.json`, la sesión se reconstruye sola con esos respaldos (código, hora de inicio, ejecuciones e historial).

## Flujo

1. Entras a `/admin` con tu `ADMIN_PASSWORD`.
2. Escribes el nombre y el lenguaje, marcas uno o varios ejercicios del catálogo (clic en el nombre para ver
   instrucciones y casos) y ajustas los minutos → **Generar link**.
   Elige la **activación**:
   - **Al instante**: el candidato puede empezar en cuanto abra el link.
   - **Preparado**: dejas links listos con anticipación; el candidato ve "aún no está activa" hasta que
     presionas **Activar ahora** (o **Activar los N preparados** para todos a la vez).
   - **Programado**: se activa sola en la fecha y hora que elijas.
3. Mandas el link `/c/…` al candidato. Su página se actualiza sola al activarse, y el cronómetro arranca
   cuando presiona *Comenzar*.
4. Ves su código en vivo, sus corridas de tests y su actividad. Al terminar, corres los tests ocultos.
5. **Revocar** borra al candidato e invalida su link. **Exportar JSON** descarga todo.

## Correr localmente

```bash
ADMIN_PASSWORD=mi-clave node server.js
# abre http://localhost:3000/admin
```

Variables de entorno:

| Variable | Descripción |
| --- | --- |
| `ADMIN_PASSWORD` | **Obligatoria.** Contraseña del panel de admin. Sin ella el panel queda deshabilitado. |
| `SESSION_SECRET` | Secreto para firmar links y la cookie de admin. Si cambia, los links anteriores dejan de funcionar. |
| `DATA_DIR` | Carpeta donde se guarda `db.json` (por defecto `./data`). |
| `PORT` | Puerto HTTP (por defecto 3000). |
| `RESEND_API_KEY` | Opcional. API key de [Resend](https://resend.com) para enviar correos desde Alcor. |
| `MAIL_FROM` | Opcional. Remitente, p. ej. `Alcor <evaluaciones@tudominio.com>` (dominio verificado en Resend). |

## Agregar retos

Edita `challenges.js`. Cada ejercicio define el enunciado, el nombre de la función por lenguaje, el código
inicial y los casos `{ args, expected, hidden? }`. Las entradas y salidas son JSON.

## Despliegue en Render

El repo incluye `render.yaml` (Blueprint). Servicio web Node, plan free, `startCommand: node server.js`.
Define `ADMIN_PASSWORD` en *Environment*; `SESSION_SECRET` se genera solo.

> **Nota sobre el plan free**: el disco es efímero y el servicio se duerme tras 15 min sin tráfico.
> Los links siguen funcionando (son firmados) y el progreso se reconstruye con los respaldos del navegador
> del candidato y del admin. Para garantía total (p. ej. si borras el caché del navegador), agrega un
> *Persistent Disk* en Render y apunta `DATA_DIR` a su ruta de montaje, o exporta el JSON al terminar.

Diseño basado en referencias de Mobbin: Linear y Vercel (sidebar neutro, listas densas, estados con punto de
color, botón primario monocromo), Snowflake (historial de versiones) e incident.io (selector de zona horaria).
Tipografía Geist / Geist Mono.

Editor: [CodeMirror 5](https://codemirror.net/5/) (MIT) incluido en `public/vendor/`.
