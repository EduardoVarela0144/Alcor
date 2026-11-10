// Alcor — evaluación técnica en tiempo real.
// Servidor Node sin dependencias ni base de datos: los links son tokens firmados
// (HMAC) y el progreso se guarda en un archivo JSON local. Además, el navegador del
// candidato y el del admin guardan respaldo y lo reenvían si el servidor se reinicia.

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const CHALLENGES = require('./challenges');

const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const SECRET = process.env.SESSION_SECRET || crypto.createHash('sha256').update('alcor:' + ADMIN_PASSWORD).digest('hex');
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const PUBLIC = path.join(__dirname, 'public');
const IS_PROD = process.env.NODE_ENV === 'production';
const ADMIN_TTL_MS = 12 * 60 * 60 * 1000;
const LANGS = ['python', 'javascript'];
const MAX_EXERCISES = 6;
const MAX_CODE = 100000;
const MAX_VERSIONS = 30;
const THEMES = ['system', 'light', 'dark'];
// Correo opcional vía Resend (https://resend.com). Sin estas variables, el admin usa su propio cliente de correo (mailto).
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const MAIL_FROM = process.env.MAIL_FROM || 'Alcor <onboarding@resend.dev>';
const validTz = (tz) => { try { return !!tz && typeof tz === 'string' && tz.length < 64 && !!new Intl.DateTimeFormat('en-US', { timeZone: tz }); } catch { return false; } };
const validEmail = (e) => typeof e === 'string' && e.length < 200 && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(e);

if (!ADMIN_PASSWORD) console.warn('[alcor] ADMIN_PASSWORD no está definido: el panel de admin queda deshabilitado.');

// ---------- almacenamiento (archivo JSON) ----------
let db = { candidates: {}, revoked: {} };
try { db = { candidates: {}, revoked: {}, ...JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) }; } catch { /* primer arranque */ }
let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFile(DB_FILE + '.tmp', JSON.stringify(db), (err) => {
      if (!err) fs.rename(DB_FILE + '.tmp', DB_FILE, () => {});
    });
  }, 250);
}

// ---------- utilidades ----------
const b64u = (buf) => Buffer.from(buf).toString('base64url');
const sign = (data) => crypto.createHmac('sha256', SECRET).update(data).digest('base64url');
function safeEqual(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}
function makeToken(payload) {
  const body = b64u(JSON.stringify(payload));
  return body + '.' + sign('cand:' + body);
}
function readToken(token) {
  const [body, sig] = String(token || '').split('.');
  if (!body || !sig || !safeEqual(sig, sign('cand:' + body))) return null;
  try { return JSON.parse(Buffer.from(body, 'base64url').toString('utf8')); } catch { return null; }
}
function parseCookies(req) {
  const out = {};
  (req.headers.cookie || '').split(';').forEach((p) => {
    const i = p.indexOf('=');
    if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}
function isAdmin(req) {
  if (!ADMIN_PASSWORD) return false;
  const c = parseCookies(req).alcor_admin || '';
  const [ts, sig] = c.split('.');
  if (!ts || !sig || !safeEqual(sig, sign('admin:' + ts))) return false;
  return Date.now() - Number(ts) < ADMIN_TTL_MS;
}
function send(res, status, data, headers = {}) {
  const body = typeof data === 'string' ? data : JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': typeof data === 'string' ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...headers,
  });
  res.end(body);
}
function readBody(req, limit = 2 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(new Error('too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); }
      catch { reject(new Error('bad json')); }
    });
    req.on('error', reject);
  });
}
const challengeById = (id) => CHALLENGES.find((c) => c.id === id);
const publicChallenge = (c, lang) => ({
  id: c.id, title: c.title, difficulty: c.difficulty, topic: c.topic, description: c.description,
  fn: c.fn[lang], starter: c.starter[lang],
  tests: c.tests.filter((t) => !t.hidden).map(({ args, expected }) => ({ args, expected })),
});
// Mezcla código recibido ({ idEjercicio: código }) solo para ejercicios de este candidato.
function mergeCode(cand, code) {
  if (!code || typeof code !== 'object') return;
  for (const id of cand.challengeIds) {
    if (typeof code[id] === 'string') cand.code[id] = code[id].slice(0, MAX_CODE);
  }
}

// Obtiene (o reconstruye desde el token) el registro de un candidato.
function getCandidate(token) {
  const p = readToken(token);
  if (!p || db.revoked[p.id]) return null;
  if (!db.candidates[p.id]) {
    const ids = (p.challenges || [p.challenge]).filter((id) => challengeById(id));
    if (!ids.length) return null;
    db.candidates[p.id] = {
      id: p.id, name: p.name, lang: p.lang, challengeIds: ids, minutes: p.minutes,
      createdAt: p.iat, token, status: 'pending', startedAt: null, submittedAt: null,
      code: {}, lastSeen: null, typingAt: null, results: {}, runs: 0, pastes: 0, blurs: 0, timeline: [],
      locked: !!p.locked, opensAt: Number(p.opensAt) || null, activatedAt: null,
      tz: validTz(p.tz) ? p.tz : 'UTC', theme: THEMES.includes(p.theme) ? p.theme : 'system', email: null, versions: {},
      rebuilt: true, // creado desde el token: puede recuperarse con el respaldo del navegador
    };
    save();
  }
  return db.candidates[p.id];
}
// Un link preparado queda bloqueado hasta que el admin lo activa o llega su hora programada.
const isOpen = (c) => !c.locked || !!c.activatedAt || (!!c.opensAt && Date.now() >= c.opensAt);
const summary = (c) => ({ ...c, timeline: undefined, code: undefined, versions: undefined, events: c.timeline.length, open: isOpen(c),
  versionCount: Object.values(c.versions || {}).reduce((n, v) => n + v.length, 0) });

// Versiones (copias que guarda el candidato): { idEjercicio: [{ id, t, label, code, auto }] }
function addVersion(cand, ex, v) {
  if (!cand.challengeIds.includes(ex) || typeof v.code !== 'string') return;
  cand.versions = cand.versions || {};
  const list = cand.versions[ex] = cand.versions[ex] || [];
  const id = String(v.id || crypto.randomBytes(5).toString('hex')).slice(0, 24);
  if (list.some((x) => x.id === id)) return;
  list.push({ id, t: Number(v.t) || Date.now(), label: String(v.label || '').slice(0, 80), code: v.code.slice(0, MAX_CODE), auto: !!v.auto });
  list.sort((a, b) => a.t - b.t);
  while (list.length > MAX_VERSIONS) {
    const i = list.findIndex((x) => x.auto); // primero se descartan las automáticas más viejas
    list.splice(i >= 0 ? i : 0, 1);
  }
}
function mergeVersions(cand, versions) {
  if (!versions || typeof versions !== 'object') return;
  for (const ex of Object.keys(versions)) for (const v of Array.isArray(versions[ex]) ? versions[ex].slice(-MAX_VERSIONS) : []) addVersion(cand, ex, v || {});
}

// ---------- correo ----------
function fmtDate(t, tz) {
  return new Intl.DateTimeFormat('es-MX', { timeZone: tz, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }).format(t);
}
function emailFor(cand, link) {
  const ex = cand.challengeIds.length === 1 ? `el ejercicio "${challengeById(cand.challengeIds[0]).title}"` : `${cand.challengeIds.length} ejercicios`;
  const lang = cand.lang === 'python' ? 'Python' : 'JavaScript';
  const when = cand.opensAt && !cand.activatedAt
    ? `La evaluación se abrirá el ${fmtDate(cand.opensAt, cand.tz)} (equivale a ${fmtDate(cand.opensAt, 'UTC')}). Al abrir el link verás la hora convertida a tu zona horaria.`
    : isOpen(cand) ? 'Ya puedes entrar cuando quieras.' : 'Te avisaremos cuando la evaluación esté activa; si abres el link antes verás una pantalla de espera.';
  const subject = `Tu evaluación técnica${cand.opensAt ? ' · ' + new Intl.DateTimeFormat('es-MX', { timeZone: cand.tz, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(cand.opensAt) : ''}`;
  const text = [
    `Hola ${cand.name},`, '',
    `Te compartimos el link de acceso a tu evaluación técnica: ${ex} en ${lang}, con una duración de ${cand.minutes} minutos.`, '',
    when, '', link, '',
    'Indicaciones:',
    '• El cronómetro empieza cuando presiones "Comenzar" y no se puede pausar.',
    '• Tu código se guarda automáticamente; puedes guardar versiones y regresar a ellas.',
    '• Usa una computadora con Chrome, Edge, Firefox o Safari actualizados.', '',
    '¡Mucho éxito!',
  ].join('\n');
  const esc = (x) => String(x).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const html = `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#171717;max-width:520px;margin:0 auto;padding:24px;line-height:1.55;font-size:15px">
<p style="font-weight:600;font-size:16px;margin:0 0 20px">✦ Alcor</p>
<p>Hola ${esc(cand.name)},</p>
<p>Te compartimos el link de acceso a tu evaluación técnica: ${esc(ex)} en ${lang}, con una duración de ${cand.minutes} minutos.</p>
<p>${esc(when)}</p>
<p style="margin:24px 0"><a href="${esc(link)}" style="background:#171717;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;display:inline-block;font-weight:500">Abrir evaluación</a></p>
<p style="color:#6b6b6b;font-size:13px">El cronómetro empieza cuando presiones "Comenzar". Tu código se guarda automáticamente.<br>Si el botón no funciona, copia este link: ${esc(link)}</p>
</div>`;
  return { subject, text, html };
}

// ---------- tiempo real (Server-Sent Events para el admin) ----------
const streams = new Set();
function broadcast(cand) {
  const msg = `data: ${JSON.stringify({ type: 'candidate', candidate: { ...summary(cand), code: cand.code } })}\n\n`;
  streams.forEach((res) => res.write(msg));
}
setInterval(() => streams.forEach((res) => res.write(': ping\n\n')), 25000);

// ---------- rate limit simple para el login ----------
const attempts = new Map();
function tooMany(ip) {
  const now = Date.now();
  const a = (attempts.get(ip) || []).filter((t) => now - t < 15 * 60 * 1000);
  attempts.set(ip, a);
  return a.length >= 10;
}

// ---------- archivos estáticos ----------
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.png': 'image/png' };
function serveFile(res, file) {
  const full = path.join(PUBLIC, file);
  if (!full.startsWith(PUBLIC + path.sep)) return send(res, 404, 'Not found');
  fs.readFile(full, (err, data) => {
    if (err) return send(res, 404, 'Not found');
    res.writeHead(200, { 'Content-Type': MIME[path.extname(full)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
}

// ---------- rutas ----------
async function handle(req, res) {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname;
  const m = req.method;
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'DENY');

  if (p === '/healthz') return send(res, 200, 'ok');

  // Páginas
  if (m === 'GET' && (p === '/' || p === '/admin')) return serveFile(res, 'admin.html');
  if (m === 'GET' && p.startsWith('/c/')) return serveFile(res, 'candidate.html');

  // ----- Admin -----
  if (p === '/api/admin/login' && m === 'POST') {
    const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
    if (!ADMIN_PASSWORD) return send(res, 503, { error: 'Define ADMIN_PASSWORD en el servidor.' });
    if (tooMany(ip)) return send(res, 429, { error: 'Demasiados intentos. Espera 15 minutos.' });
    const body = await readBody(req).catch(() => ({}));
    if (!safeEqual(body.password || '', ADMIN_PASSWORD)) {
      attempts.get(ip).push(Date.now());
      return send(res, 401, { error: 'Contraseña incorrecta.' });
    }
    const ts = String(Date.now());
    const cookie = `alcor_admin=${ts}.${sign('admin:' + ts)}; HttpOnly; Path=/; SameSite=Strict; Max-Age=${ADMIN_TTL_MS / 1000}${IS_PROD ? '; Secure' : ''}`;
    return send(res, 200, { ok: true }, { 'Set-Cookie': cookie });
  }
  if (p === '/api/admin/logout' && m === 'POST') {
    return send(res, 200, { ok: true }, { 'Set-Cookie': 'alcor_admin=; HttpOnly; Path=/; Max-Age=0' });
  }
  if (p.startsWith('/api/admin/')) {
    if (!isAdmin(req)) return send(res, 401, { error: 'No autorizado' });

    if (p === '/api/admin/me' && m === 'GET') return send(res, 200, { ok: true, email: !!RESEND_API_KEY });

    if (p === '/api/admin/challenges' && m === 'GET') return send(res, 200, CHALLENGES);

    if (p === '/api/admin/candidates' && m === 'GET') {
      const list = Object.values(db.candidates).sort((a, b) => b.createdAt - a.createdAt).map(summary);
      return send(res, 200, list);
    }
    if (p === '/api/admin/candidates' && m === 'POST') {
      const body = await readBody(req).catch(() => ({}));
      const name = String(body.name || '').trim().slice(0, 80);
      const lang = LANGS.includes(body.lang) ? body.lang : null;
      const ids = [...new Set(Array.isArray(body.challenges) ? body.challenges : [])].filter((id) => challengeById(id)).slice(0, MAX_EXERCISES);
      const defMinutes = ids.reduce((s, id) => s + challengeById(id).minutes, 0);
      const minutes = Math.min(Math.max(parseInt(body.minutes, 10) || defMinutes || 30, 5), 240);
      if (!name || !lang || !ids.length) return send(res, 400, { error: 'Nombre, lenguaje y al menos un ejercicio son obligatorios.' });
      const activation = ['now', 'manual', 'scheduled'].includes(body.activation) ? body.activation : 'now';
      const opensAt = activation === 'scheduled' ? Number(body.opensAt) : null;
      if (activation === 'scheduled' && !(opensAt > Date.now())) return send(res, 400, { error: 'La fecha de activación debe ser en el futuro.' });
      const payload = { id: crypto.randomBytes(9).toString('base64url'), name, lang, challenges: ids, minutes, iat: Date.now() };
      if (activation !== 'now') { payload.locked = true; if (opensAt) payload.opensAt = opensAt; }
      if (validTz(body.tz)) payload.tz = body.tz;
      if (THEMES.includes(body.theme) && body.theme !== 'system') payload.theme = body.theme;
      if (body.email && !validEmail(body.email)) return send(res, 400, { error: 'El correo no es válido.' });
      const token = makeToken(payload);
      const cand = getCandidate(token);
      cand.rebuilt = false;
      if (body.email) cand.email = body.email;
      broadcast(cand);
      return send(res, 201, { ...summary(cand), token });
    }
    // Respaldo desde el navegador del admin: re-sube candidatos que el servidor perdió (p. ej. tras un reinicio).
    if (p === '/api/admin/restore' && m === 'POST') {
      const body = await readBody(req, 8 * 1024 * 1024).catch(() => ({}));
      let restored = 0;
      for (const rec of Array.isArray(body.candidates) ? body.candidates.slice(0, 500) : []) {
        const tp = readToken(rec && rec.token);
        if (!tp || db.revoked[tp.id]) continue;
        const cur = db.candidates[tp.id];
        if (cur && !cur.rebuilt && !cur.recovered) continue; // el servidor ya tiene datos completos
        const ok = ['pending', 'in_progress', 'submitted', 'expired'];
        const timeline = Array.isArray(rec.timeline) ? rec.timeline.slice(-2000) : [];
        if (cur && cur.recovered) {
          // El candidato ya recuperó su sesión (código y hora de inicio): solo sumamos el historial del admin.
          cur.results = { ...(rec.results && typeof rec.results === 'object' ? rec.results : {}), ...cur.results };
          cur.runs = Math.max(cur.runs, +rec.runs || 0); cur.pastes = Math.max(cur.pastes, +rec.pastes || 0); cur.blurs = Math.max(cur.blurs, +rec.blurs || 0);
          cur.timeline = timeline.concat(cur.timeline).sort((a, b) => a.t - b.t).slice(-2000);
          cur.recovered = false;
          restored++; broadcast(cur);
          continue;
        }
        const cand = getCandidate(rec.token);
        Object.assign(cand, {
          status: ok.includes(rec.status) ? rec.status : cand.status,
          startedAt: Number(rec.startedAt) || null, submittedAt: Number(rec.submittedAt) || null,
          activatedAt: Number(rec.activatedAt) || (Number(rec.startedAt) ? Number(rec.startedAt) : null),
          lastSeen: Number(rec.lastSeen) || null, results: rec.results && typeof rec.results === 'object' ? rec.results : {},
          runs: +rec.runs || 0, pastes: +rec.pastes || 0, blurs: +rec.blurs || 0,
          timeline, rebuilt: false,
        });
        mergeCode(cand, rec.code); mergeVersions(cand, rec.versions);
        if (validEmail(rec.email)) cand.email = rec.email;
        if (typeof rec.locked === 'boolean') cand.locked = rec.locked;
        if (rec.opensAt !== undefined) cand.opensAt = Number(rec.opensAt) || null;
        if (cand.status !== 'pending') cand.timeline.push({ t: Date.now(), type: 'restored', detail: 'recuperado del respaldo del admin' });
        restored++; broadcast(cand);
      }
      if (restored) save();
      return send(res, 200, { restored });
    }
    const mDetail = p.match(/^\/api\/admin\/candidates\/([\w-]+)$/);
    if (mDetail && m === 'GET') {
      const c = db.candidates[mDetail[1]];
      return c ? send(res, 200, c) : send(res, 404, { error: 'No existe' });
    }
    const mSched = p.match(/^\/api\/admin\/candidates\/([\w-]+)\/(schedule|email)$/);
    if (mSched && m === 'POST') {
      const c = db.candidates[mSched[1]];
      if (!c) return send(res, 404, { error: 'No existe' });
      const body = await readBody(req).catch(() => ({}));
      if (mSched[2] === 'schedule') {
        if (c.status !== 'pending') return send(res, 409, { error: 'El candidato ya empezó.' });
        const at = body.opensAt == null ? null : Number(body.opensAt);
        if (at !== null && !(at > Date.now())) return send(res, 400, { error: 'La fecha debe ser en el futuro.' });
        if (validTz(body.tz)) c.tz = body.tz;
        c.locked = true; c.activatedAt = null; c.opensAt = at;
        c.timeline.push({ t: Date.now(), type: at ? 'scheduled' : 'deactivated', detail: at ? fmtDate(at, c.tz) : undefined });
        save(); broadcast(c);
        return send(res, 200, summary(c));
      }
      // email: arma el mensaje; si hay Resend lo envía, si no, el admin lo abre en su cliente de correo.
      if (body.to !== undefined) {
        if (!validEmail(body.to)) return send(res, 400, { error: 'El correo no es válido.' });
        c.email = body.to;
      }
      const msg = emailFor(c, String(body.link || ''));
      if (!body.send) return send(res, 200, { ...msg, to: c.email, configured: !!RESEND_API_KEY });
      if (!RESEND_API_KEY) return send(res, 501, { error: 'Envío directo no configurado.', ...msg });
      if (!c.email) return send(res, 400, { error: 'Falta el correo del candidato.' });
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST', headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: MAIL_FROM, to: [c.email], subject: msg.subject, html: msg.html, text: msg.text }),
      }).catch((e) => ({ ok: false, status: 0, text: async () => String(e) }));
      if (!r.ok) { const t = await r.text(); console.error('[alcor] resend', r.status, t); return send(res, 502, { error: 'El proveedor de correo rechazó el envío: ' + t.slice(0, 200) }); }
      c.emailedAt = Date.now(); c.timeline.push({ t: c.emailedAt, type: 'emailed', detail: c.email });
      save(); broadcast(c);
      return send(res, 200, { sent: true, to: c.email });
    }
    const mAct = p.match(/^\/api\/admin\/candidates\/([\w-]+)\/(activate|deactivate)$/);
    if (mAct && m === 'POST') {
      const c = db.candidates[mAct[1]];
      if (!c) return send(res, 404, { error: 'No existe' });
      if (mAct[2] === 'activate') {
        if (!c.activatedAt) { c.activatedAt = Date.now(); c.timeline.push({ t: c.activatedAt, type: 'activated' }); }
      } else {
        if (c.status !== 'pending') return send(res, 409, { error: 'El candidato ya empezó; no se puede desactivar.' });
        c.locked = true; c.activatedAt = null; c.opensAt = null; c.timeline.push({ t: Date.now(), type: 'deactivated' });
      }
      save(); broadcast(c);
      return send(res, 200, summary(c));
    }
    if (p === '/api/admin/activate-all' && m === 'POST') {
      let n = 0;
      for (const c of Object.values(db.candidates)) {
        if (c.status === 'pending' && !isOpen(c)) { c.activatedAt = Date.now(); c.timeline.push({ t: c.activatedAt, type: 'activated' }); broadcast(c); n++; }
      }
      if (n) save();
      return send(res, 200, { activated: n });
    }
    if (mDetail && m === 'DELETE') {
      delete db.candidates[mDetail[1]];
      db.revoked[mDetail[1]] = Date.now(); save();
      streams.forEach((r) => r.write(`data: ${JSON.stringify({ type: 'deleted', id: mDetail[1] })}\n\n`));
      return send(res, 200, { ok: true });
    }
    if (p === '/api/admin/stream' && m === 'GET') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
      res.write('retry: 2000\n\n');
      streams.add(res);
      req.on('close', () => streams.delete(res));
      return;
    }
    if (p === '/api/admin/export' && m === 'GET') {
      return send(res, 200, db, { 'Content-Disposition': 'attachment; filename="alcor-export.json"' });
    }
    return send(res, 404, { error: 'Not found' });
  }

  // ----- Candidato -----
  const mc = p.match(/^\/api\/session\/([^/]+)(?:\/(start|sync|submit|resume))?$/);
  if (mc) {
    const cand = getCandidate(mc[1]);
    if (!cand) return send(res, 404, { error: 'Link inválido.' });
    const now = Date.now();
    const deadline = () => (cand.startedAt ? cand.startedAt + cand.minutes * 60000 : null);
    const view = () => ({
      id: cand.id, name: cand.name, lang: cand.lang, minutes: cand.minutes, status: cand.status,
      startedAt: cand.startedAt, deadline: deadline(), serverNow: Date.now(), code: cand.code,
      open: isOpen(cand), opensAt: cand.opensAt, tz: cand.tz, theme: cand.theme, versions: cand.versions || {},
      challenges: cand.challengeIds.map((id) => publicChallenge(challengeById(id), cand.lang)),
    });
    const fillStarters = () => cand.challengeIds.forEach((id) => {
      if (typeof cand.code[id] !== 'string') cand.code[id] = challengeById(id).starter[cand.lang];
    });

    if (!mc[2] && m === 'GET') return send(res, 200, view());

    if (mc[2] === 'start' && m === 'POST') {
      if (cand.status === 'pending' && !isOpen(cand)) return send(res, 423, { error: 'La evaluación aún no está activa.', ...view() });
      if (cand.status === 'pending') {
        cand.status = 'in_progress'; cand.startedAt = now; cand.lastSeen = now; cand.rebuilt = false;
        fillStarters();
        cand.timeline.push({ t: now, type: 'start' });
        save(); broadcast(cand);
      }
      return send(res, 200, view());
    }

    // Respaldo desde el navegador del candidato: si el servidor perdió la sesión, se recupera
    // con la hora de inicio y el código guardados localmente.
    if (mc[2] === 'resume' && m === 'POST') {
      const body = await readBody(req).catch(() => ({}));
      if (cand.rebuilt && cand.status === 'pending' && Number(body.startedAt)) {
        cand.startedAt = Math.min(Math.max(Number(body.startedAt), cand.createdAt), now);
        cand.status = body.status === 'submitted' ? 'submitted' : 'in_progress';
        if (cand.status === 'submitted') cand.submittedAt = Number(body.submittedAt) || now;
        cand.lastSeen = now; cand.rebuilt = false; cand.recovered = true;
        if (!isOpen(cand)) cand.activatedAt = cand.startedAt; // si ya había empezado, ya estaba activo
        mergeCode(cand, body.code); mergeVersions(cand, body.versions); fillStarters();
        cand.timeline.push({ t: now, type: 'restored', detail: 'recuperado del respaldo del candidato' });
        save(); broadcast(cand);
      }
      return send(res, 200, view());
    }

    if (mc[2] === 'sync' && m === 'POST') {
      if (cand.status !== 'in_progress') return send(res, 409, { error: 'La evaluación no está activa.', status: cand.status });
      const body = await readBody(req).catch(() => null);
      if (!body) return send(res, 400, { error: 'Bad request' });
      const before = JSON.stringify(cand.code);
      mergeCode(cand, body.code);
      if (JSON.stringify(cand.code) !== before) cand.typingAt = now;
      cand.lastSeen = now;
      if (typeof body.active === 'string' && cand.challengeIds.includes(body.active)) cand.active = body.active;
      for (const ev of Array.isArray(body.events) ? body.events.slice(0, 50) : []) {
        const type = String(ev.type || '').slice(0, 20);
        const ex = cand.challengeIds.includes(ev.exercise) ? ev.exercise : undefined;
        if (type === 'version' && ex) addVersion(cand, ex, { id: ev.id, t: ev.t, label: ev.label, code: ev.code, auto: ev.auto });
        if (type === 'version' && ev.auto) continue; // las automáticas no llenan la actividad
        if (type === 'paste') cand.pastes++;
        if (type === 'blur') cand.blurs++;
        if (type === 'run') {
          cand.runs++;
          if (ex && ev.results) cand.results[ex] = { passed: +ev.results.passed || 0, total: +ev.results.total || 0, at: now };
        }
        const detail = type === 'version' ? ev.label : ev.detail;
        cand.timeline.push({ t: now, type, exercise: ex, detail: detail ? String(detail).slice(0, 200) : undefined,
          passed: ev.results ? ev.results.passed : undefined, total: ev.results ? ev.results.total : undefined });
      }
      if (cand.timeline.length > 2000) cand.timeline = cand.timeline.slice(-2000);
      const d = deadline();
      if (d && now > d + 30000) { cand.status = 'expired'; cand.submittedAt = now; cand.timeline.push({ t: now, type: 'expired' }); }
      save(); broadcast(cand);
      return send(res, 200, { ok: true, status: cand.status, savedAt: now });
    }

    if (mc[2] === 'submit' && m === 'POST') {
      if (cand.status !== 'in_progress') return send(res, 409, { error: 'La evaluación ya terminó.', status: cand.status });
      const body = await readBody(req).catch(() => ({}));
      mergeCode(cand, body.code);
      const d = deadline();
      cand.status = body.auto || (d && now > d + 30000) ? 'expired' : 'submitted';
      cand.submittedAt = now; cand.lastSeen = now;
      cand.timeline.push({ t: now, type: cand.status === 'expired' ? 'expired' : 'submit' });
      save(); broadcast(cand);
      return send(res, 200, view());
    }
    return send(res, 405, { error: 'Method not allowed' });
  }

  // Estáticos
  if (m === 'GET' && /^\/(vendor\/[\w\/-]+\/)?[\w.-]+\.(css|js|svg|ico|png)$/.test(p) && !p.includes('..')) return serveFile(res, p.slice(1));
  return send(res, 404, 'Not found');
}

http.createServer((req, res) => {
  handle(req, res).catch((err) => { console.error(err); if (!res.headersSent) send(res, 500, { error: 'Error interno' }); });
}).listen(PORT, () => console.log(`[alcor] escuchando en http://localhost:${PORT}`));
