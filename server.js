// Alcor — evaluación técnica en tiempo real.
// Servidor Node sin dependencias ni base de datos: los links son tokens firmados
// (HMAC) y el progreso se guarda en un archivo JSON local.

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

if (!ADMIN_PASSWORD) console.warn('[alcor] ADMIN_PASSWORD no está definido: el panel de admin queda deshabilitado.');

// ---------- almacenamiento (archivo JSON) ----------
let db = { candidates: {} };
try { db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); } catch { /* primer arranque */ }
let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFile(DB_FILE + '.tmp', JSON.stringify(db), (err) => {
      if (!err) fs.rename(DB_FILE + '.tmp', DB_FILE, () => {});
    });
  }, 300);
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
function readBody(req, limit = 512 * 1024) {
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
  id: c.id, title: c.title, difficulty: c.difficulty, description: c.description,
  fn: c.fn[lang], starter: c.starter[lang],
  tests: c.tests.filter((t) => !t.hidden).map(({ args, expected }) => ({ args, expected })),
});

// Obtiene (o reconstruye desde el token) el registro de un candidato.
function getCandidate(token) {
  const p = readToken(token);
  if (!p || (db.revoked && db.revoked[p.id])) return null;
  if (!db.candidates[p.id]) {
    db.candidates[p.id] = {
      id: p.id, name: p.name, lang: p.lang, challengeId: p.challenge, minutes: p.minutes,
      createdAt: p.iat, token, status: 'pending', startedAt: null, submittedAt: null,
      code: null, lastSeen: null, results: null, runs: 0, pastes: 0, blurs: 0, timeline: [],
    };
    save();
  }
  return db.candidates[p.id];
}
const summary = (c) => ({ ...c, timeline: undefined, code: undefined, events: c.timeline.length });

// ---------- tiempo real (Server-Sent Events para el admin) ----------
const streams = new Set();
function broadcast(cand, full = false) {
  const msg = `data: ${JSON.stringify({ type: 'candidate', candidate: full ? cand : { ...summary(cand), code: cand.code } })}\n\n`;
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

    if (p === '/api/admin/me' && m === 'GET') return send(res, 200, { ok: true });

    if (p === '/api/admin/challenges' && m === 'GET') return send(res, 200, CHALLENGES);

    if (p === '/api/admin/candidates' && m === 'GET') {
      const list = Object.values(db.candidates).sort((a, b) => b.createdAt - a.createdAt).map(summary);
      return send(res, 200, list);
    }
    if (p === '/api/admin/candidates' && m === 'POST') {
      const body = await readBody(req).catch(() => ({}));
      const name = String(body.name || '').trim().slice(0, 80);
      const lang = LANGS.includes(body.lang) ? body.lang : null;
      const ch = challengeById(body.challenge);
      const minutes = Math.min(Math.max(parseInt(body.minutes, 10) || (ch && ch.minutes) || 30, 5), 240);
      if (!name || !lang || !ch) return send(res, 400, { error: 'Nombre, lenguaje y reto son obligatorios.' });
      const payload = { id: crypto.randomBytes(9).toString('base64url'), name, lang, challenge: ch.id, minutes, iat: Date.now() };
      const token = makeToken(payload);
      const cand = getCandidate(token);
      broadcast(cand);
      return send(res, 201, { ...summary(cand), token });
    }
    const mDetail = p.match(/^\/api\/admin\/candidates\/([\w-]+)$/);
    if (mDetail && m === 'GET') {
      const c = db.candidates[mDetail[1]];
      return c ? send(res, 200, c) : send(res, 404, { error: 'No existe' });
    }
    if (mDetail && m === 'DELETE') {
      delete db.candidates[mDetail[1]];
      db.revoked = db.revoked || {}; db.revoked[mDetail[1]] = Date.now(); save();
      streams.forEach((r) => r.write(`data: ${JSON.stringify({ type: 'deleted', id: mDetail[1] })}\n\n`));
      return send(res, 200, { ok: true });
    }
    if (p === '/api/admin/stream' && m === 'GET') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
      res.write('retry: 3000\n\n');
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
  const mc = p.match(/^\/api\/session\/([^/]+)(?:\/(start|sync|submit))?$/);
  if (mc) {
    const cand = getCandidate(mc[1]);
    if (!cand) return send(res, 404, { error: 'Link inválido.' });
    const ch = challengeById(cand.challengeId);
    const now = Date.now();
    const deadline = cand.startedAt ? cand.startedAt + cand.minutes * 60000 : null;
    const view = () => ({
      name: cand.name, lang: cand.lang, minutes: cand.minutes, status: cand.status,
      startedAt: cand.startedAt, deadline: cand.startedAt ? cand.startedAt + cand.minutes * 60000 : null,
      serverNow: Date.now(), code: cand.code, challenge: publicChallenge(ch, cand.lang),
    });

    if (!mc[2] && m === 'GET') return send(res, 200, view());

    if (mc[2] === 'start' && m === 'POST') {
      if (cand.status === 'pending') {
        cand.status = 'in_progress'; cand.startedAt = now; cand.lastSeen = now;
        cand.code = cand.code ?? ch.starter[cand.lang];
        cand.timeline.push({ t: now, type: 'start' });
        save(); broadcast(cand);
      }
      return send(res, 200, view());
    }

    if (mc[2] === 'sync' && m === 'POST') {
      if (cand.status !== 'in_progress') return send(res, 409, { error: 'La evaluación no está activa.', status: cand.status });
      const body = await readBody(req).catch(() => null);
      if (!body) return send(res, 400, { error: 'Bad request' });
      if (typeof body.code === 'string') cand.code = body.code.slice(0, 100000);
      cand.lastSeen = now;
      for (const ev of Array.isArray(body.events) ? body.events.slice(0, 50) : []) {
        const type = String(ev.type || '').slice(0, 20);
        if (type === 'paste') cand.pastes++;
        if (type === 'blur') cand.blurs++;
        if (type === 'run') {
          cand.runs++;
          if (ev.results) cand.results = { passed: +ev.results.passed || 0, total: +ev.results.total || 0, at: now };
        }
        cand.timeline.push({ t: now, type, detail: ev.detail ? String(ev.detail).slice(0, 200) : undefined,
          passed: ev.results ? ev.results.passed : undefined, total: ev.results ? ev.results.total : undefined });
      }
      if (cand.timeline.length > 2000) cand.timeline = cand.timeline.slice(-2000);
      const expired = deadline && now > deadline + 30000;
      if (expired) { cand.status = 'expired'; cand.submittedAt = now; cand.timeline.push({ t: now, type: 'expired' }); }
      save(); broadcast(cand);
      return send(res, 200, { ok: true, status: cand.status });
    }

    if (mc[2] === 'submit' && m === 'POST') {
      if (cand.status !== 'in_progress') return send(res, 409, { error: 'La evaluación ya terminó.', status: cand.status });
      const body = await readBody(req).catch(() => ({}));
      if (typeof body.code === 'string') cand.code = body.code.slice(0, 100000);
      cand.status = 'submitted'; cand.submittedAt = now; cand.lastSeen = now;
      cand.timeline.push({ t: now, type: 'submit' });
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
