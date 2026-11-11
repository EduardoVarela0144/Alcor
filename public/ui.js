// Helpers de UI compartidos (admin y candidato).
window.UI = (function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const json = (v, lang) => {
    if (v === undefined) return '—';
    const out = JSON.stringify(v);
    if (lang !== 'python') return out;
    // Literales de Python fuera de strings
    return out.replace(/("(?:[^"\\]|\\.)*")|\btrue\b|\bfalse\b|\bnull\b/g, (m, str) => str || ({ true: 'True', false: 'False', null: 'None' })[m]);
  };
  const md = (s) => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>');
  const LANG = { python: 'Python', javascript: 'JavaScript' };
  const signature = (lang, fn, args) => `${fn}(${args.map((v) => json(v, lang)).join(', ')})`;

  // Íconos (trazo 1.5, estilo Lucide)
  const P = {
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    book: '<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
    moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z"/>',
    monitor: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>',
    lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    unlock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/>',
    copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    trash: '<path d="M3 6h18M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>',
    play: '<path d="m6 3 14 9-14 9V3z"/>',
    history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l4 2"/>',
    save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/>',
    rotate: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
    eye: '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>',
    send: '<path d="m22 2-7 20-4-9-9-4 20-7z"/>',
    zap: '<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
    globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20"/>',
  };
  const icon = (n) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n] || ''}</svg>`;
  const LOGO = '<span class="logo"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.6 7.4L22 12l-7.4 2.6L12 22l-2.6-7.4L2 12l7.4-2.6z"/></svg></span>';

  // ---------- temas (ver themes.js) ----------
  const TH = window.AlcorThemes;
  let themeFallback = null; // tema que preparó el admin para el candidato (si él no ha elegido uno)
  const themeId = () => TH.get() || themeFallback || 'system';
  const getTheme = TH.get;
  function applyTheme(id) { themeFallback = id; if (!TH.get()) TH.apply(id); refreshThemeButtons(); }
  function setTheme(id) { TH.set(id); refreshThemeButtons(); }
  const SYSTEM = { id: 'system', name: 'Sistema' };
  function swatch(t) {
    if (t.id === 'system') {
      const l = TH.byId('light').c, d = TH.byId('dark').c;
      return `<span class="swatch" style="background:linear-gradient(135deg,${l.panel} 50%,${d.panel} 50%);border-color:${l.borderStrong}"></span>`;
    }
    return `<span class="swatch" style="background:${t.c.panel};border-color:${t.c.borderStrong}"><i style="background:${t.c.primary}"></i></span>`;
  }
  const themeLabel = (id) => (TH.byId(id) || SYSTEM).name;
  function themeBtnInner() { const id = themeId(); return `${swatch(TH.byId(id) || SYSTEM)}<span class="tname">${esc(themeLabel(id))}</span>`; }
  function refreshThemeButtons() { $$('[data-theme-open]').forEach((b) => { b.innerHTML = themeBtnInner(); }); }
  // Botón que abre el selector de temas; `fallback` es el tema que preparó el admin.
  function themeSwitch(fallback) {
    if (fallback && !themeFallback) themeFallback = fallback;
    return `<button type="button" class="btn sm theme-btn" data-theme-open title="Cambiar tema" aria-label="Cambiar tema">${themeBtnInner()}</button>`;
  }
  function themeCard(t, on) {
    const prev = (c) => `<span class="tp" style="background:${c.bg};border-color:${c.border}">
        <span class="tp-side" style="background:${c.subtle};border-color:${c.border}"><i style="background:${c.faint}"></i><i style="background:${c.faint}"></i></span>
        <span class="tp-main" style="background:${c.panel}">
          <i style="background:${c.k};width:30%"></i><i style="background:${c.d};width:55%;margin-left:12%"></i><i style="background:${c.s};width:40%;margin-left:12%"></i><i style="background:${c.n};width:22%"></i>
          <b style="background:${c.primary}"></b></span></span>`;
    const body = t.id === 'system'
      ? `<span class="tp-split">${prev(TH.byId('light').c)}${prev(TH.byId('dark').c)}</span>`
      : prev(t.c);
    return `<button type="button" class="theme-card ${on ? 'on' : ''}" data-theme-pick="${t.id}">${body}<span class="tc-name">${esc(t.name)}${on ? icon('check') : ''}</span></button>`;
  }
  function openThemePicker() {
    const render = () => {
      const cur = themeId();
      const grid = (list) => `<div class="theme-grid">${list.map((t) => themeCard(t, t.id === cur)).join('')}</div>`;
      const size = TH.size();
      return `<div class="picker">
        <div class="section-title" style="margin-top:0">Automático</div>${grid([SYSTEM])}
        <div class="section-title">Claros</div>${grid(TH.list.filter((t) => !t.dark))}
        <div class="section-title">Oscuros</div>${grid(TH.list.filter((t) => t.dark))}
        <div class="section-title">Tamaño del código</div>
        <div class="seg">${[12, 13.5, 15, 17].map((px, i) => `<button type="button" data-size="${px}" class="${size === px ? 'on' : ''}">${['Chico', 'Normal', 'Grande', 'Muy grande'][i]}</button>`).join('')}</div>
      </div>`;
    };
    const m = modal({ title: 'Tema', body: render() });
    m.el.querySelector('.modal').style.maxWidth = '780px';
    const wire = () => {
      $$('[data-theme-pick]', m.el).forEach((b) => b.onclick = () => { setTheme(b.dataset.themePick); m.el.querySelector('.modal-b').innerHTML = render(); wire(); });
      $$('[data-size]', m.el).forEach((b) => b.onclick = () => { TH.setSize(Number(b.dataset.size)); m.el.querySelector('.modal-b').innerHTML = render(); wire(); });
    };
    wire();
  }
  document.addEventListener('click', (e) => { if (e.target.closest('[data-theme-open]')) openThemePicker(); });
  // Lista de temas para formularios (p. ej. el tema inicial del candidato).
  function themeOptions(selected) {
    const o = (t) => `<option value="${t.id}" ${t.id === selected ? 'selected' : ''}>${esc(t.name)}</option>`;
    return `<optgroup label="Automático">${o(SYSTEM)}</optgroup><optgroup label="Claros">${TH.list.filter((t) => !t.dark).map(o).join('')}</optgroup><optgroup label="Oscuros">${TH.list.filter((t) => t.dark).map(o).join('')}</optgroup>`;
  }

  // ---------- zonas horarias ----------
  const localTz = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const POPULAR_TZ = ['America/Mexico_City', 'America/Bogota', 'America/Lima', 'America/Santiago', 'America/Argentina/Buenos_Aires', 'America/Caracas',
    'America/Guatemala', 'America/Monterrey', 'America/Tijuana', 'America/New_York', 'America/Chicago', 'America/Los_Angeles', 'America/Sao_Paulo',
    'Europe/Madrid', 'Europe/London', 'Europe/Berlin', 'Asia/Tokyo', 'Asia/Kolkata', 'Australia/Sydney', 'UTC'];
  function tzOffsetMs(t, tz) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
      .formatToParts(t).map((p) => [p.type, p.value]));
    return Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour % 24, +parts.minute, +parts.second) - Math.floor(t / 1000) * 1000;
  }
  // "2026-11-11T10:00" interpretado en la zona `tz` → milisegundos UTC
  function zonedToUtc(local, tz) {
    const [d, h] = local.split('T'); const [Y, M, D] = d.split('-').map(Number); const [hh, mm] = (h || '0:0').split(':').map(Number);
    const guess = Date.UTC(Y, M - 1, D, hh, mm);
    let t = guess - tzOffsetMs(guess, tz);
    t = guess - tzOffsetMs(t, tz); // segunda pasada por cambios de horario
    return t;
  }
  function utcToZonedInput(t, tz) {
    const z = new Date(t + tzOffsetMs(t, tz));
    return z.toISOString().slice(0, 16);
  }
  const tzLabel = (tz) => tz.replace(/_/g, ' ').split('/').pop();
  function tzShort(t, tz) {
    try { return new Intl.DateTimeFormat('es-MX', { timeZone: tz, timeZoneName: 'shortOffset' }).formatToParts(t).find((p) => p.type === 'timeZoneName').value; } catch { return ''; }
  }
  const fmtIn = (t, tz, opts = {}) => new Intl.DateTimeFormat('es-MX', { timeZone: tz, weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', ...opts }).format(t);
  function tzOptions(selected) {
    const all = (Intl.supportedValuesOf ? Intl.supportedValuesOf('timeZone') : POPULAR_TZ).filter((z) => !POPULAR_TZ.includes(z));
    const opt = (z) => `<option value="${z}" ${z === selected ? 'selected' : ''}>${esc(tzLabel(z))} (${tzShort(Date.now(), z)})</option>`;
    const mine = localTz();
    return `<optgroup label="Tu zona horaria">${opt(mine)}</optgroup><optgroup label="Frecuentes">${POPULAR_TZ.filter((z) => z !== mine).map(opt).join('')}</optgroup><optgroup label="Todas">${all.filter((z) => z !== mine).map(opt).join('')}</optgroup>`;
  }

  // ---------- resultados de tests ----------
  function renderResults(container, res, lang, fn) {
    if (res.error && !res.cases.some((c) => c.actual !== undefined)) {
      container.innerHTML = `<pre class="console err">${esc(res.error)}</pre>`;
      return;
    }
    container.innerHTML = res.cases.map((c, i) => `
      <div class="case ${c.ok ? 'ok' : 'fail'}">
        <div class="case-head"><span class="icon">${c.ok ? '✓' : '✕'}</span>
          Caso ${i + 1}${c.hidden ? ' <span class="tag">oculto</span>' : ''}
          <span class="faint mono" style="margin-left:auto;font-weight:400;font-size:11.5px">${c.ms != null ? c.ms.toFixed(1) + ' ms' : ''}</span></div>
        ${c.ok ? '' : `<div class="case-body"><b>Entrada</b>${esc(signature(lang, fn, c.args))}
<b>Esperado</b>${esc(json(c.expected, lang))}
<b>${c.error ? 'Error' : 'Obtenido'}</b>${esc(c.error || json(c.actual, lang))}</div>`}
      </div>`).join('');
  }

  // ---------- modal ----------
  function modal({ title, body, footer = '', size = '' }) {
    const ov = document.createElement('div');
    ov.className = 'overlay';
    ov.innerHTML = `<div class="modal ${size}" role="dialog" aria-modal="true"><div class="modal-h"><h3>${title}</h3><div class="spacer"></div><button class="icon-btn" data-close aria-label="Cerrar">${icon('x')}</button></div><div class="modal-b">${body}</div>${footer ? `<div class="modal-f">${footer}</div>` : ''}</div>`;
    const close = () => { ov.remove(); document.removeEventListener('keydown', onKey); };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    ov.addEventListener('mousedown', (e) => { if (e.target === ov) close(); });
    ov.querySelector('[data-close]').onclick = close;
    document.addEventListener('keydown', onKey);
    document.body.appendChild(ov);
    return { el: ov, close };
  }
  function confirmBox(title, text, okLabel = 'Confirmar', danger = false) {
    return new Promise((resolve) => {
      const m = modal({ title, size: 'sm', body: `<p style="margin:0;padding:16px 18px;color:var(--muted);line-height:1.6">${text}</p>`,
        footer: `<div class="spacer"></div><button class="btn" data-no>Cancelar</button><button class="btn primary ${danger ? 'danger' : ''}" data-yes>${okLabel}</button>` });
      const done = (v) => { m.close(); resolve(v); };
      m.el.querySelector('[data-no]').onclick = () => done(false);
      m.el.querySelector('[data-yes]').onclick = () => done(true);
      m.el.querySelector('[data-close]').onclick = () => done(false);
      m.el.querySelector('[data-yes]').focus();
    });
  }

  function toast(msg) {
    $$('.toast').forEach((t) => t.remove());
    const t = document.createElement('div');
    t.className = 'toast'; t.textContent = msg; document.body.appendChild(t);
    setTimeout(() => t.remove(), 2400);
  }

  const fmtTime = (ms) => {
    const s = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
    return (h ? h + ':' + String(m).padStart(2, '0') : String(m).padStart(2, '0')) + ':' + String(r).padStart(2, '0');
  };
  const fmtCountdown = (ms) => {
    const s = Math.max(0, Math.floor(ms / 1000));
    const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
    return d ? `${d} d ${h} h ${m} min` : h ? `${h} h ${m} min` : fmtTime(ms);
  };
  const ago = (t) => {
    const s = (Date.now() - t) / 1000;
    if (s < 45) return 'hace un momento';
    if (s < 3600) return `hace ${Math.round(s / 60)} min`;
    if (s < 86400) return `hace ${Math.round(s / 3600)} h`;
    return new Date(t).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
  };
  const hhmm = (t) => new Date(t).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

  return { $, $$, esc, md, json, LANG, signature, renderResults, toast, fmtTime, fmtCountdown, ago, hhmm, icon, LOGO,
    themeSwitch, setTheme, getTheme, applyTheme, themeOptions, themeLabel, swatch, onThemeChange: TH.onChange, localTz, zonedToUtc, utcToZonedInput, tzLabel, tzShort, fmtIn, tzOptions, modal, confirmBox };
})();
