// Pizarrón de diagramas para entrevistas de System Design (sin dependencias).
// Valor: JSON { v: 1, elements: [...], notes: '' }. Se guarda como el "código" del ejercicio,
// así que el autoguardado, la vista en vivo del admin y las versiones funcionan igual.
//
// Elementos:
//   { id, type: 'rect' | 'ellipse' | 'diamond' | 'db', x, y, w, h, text, color, dash }
//   { id, type: 'text', x, y, text, color, size }
//   { id, type: 'arrow', from: { id } | { x, y }, to: { id } | { x, y }, text, color, dash }
//   { id, type: 'pen', points: [[x, y], ...], color }
(function () {
  const t = (k, v) => (window.I18N ? I18N.t(k, v) : k);
  const COLORS = [
    { id: 'ink', v: 'var(--text)' }, { id: 'blue', v: '#3b82f6' }, { id: 'green', v: '#16a34a' },
    { id: 'amber', v: '#d97706' }, { id: 'red', v: '#dc2626' }, { id: 'violet', v: '#7c3aed' },
  ];
  const SHAPES = ['rect', 'ellipse', 'diamond', 'db'];
  const DEFAULT_SIZE = { rect: [150, 70], ellipse: [130, 70], diamond: [140, 90], db: [110, 90] };
  const colorVal = (c) => (COLORS.find((x) => x.id === c) || COLORS[0]).v;
  const EMPTY = () => ({ v: 1, elements: [], notes: '' });
  const uid = () => Math.random().toString(36).slice(2, 9);
  const r1 = (n) => Math.round(n * 10) / 10;
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function parse(s) {
    try {
      const o = typeof s === 'string' ? JSON.parse(s) : s;
      if (o && Array.isArray(o.elements)) return { v: 1, elements: o.elements.filter((e) => e && e.id && e.type), notes: typeof o.notes === 'string' ? o.notes : '' };
    } catch { /* valor inválido: pizarrón vacío */ }
    return EMPTY();
  }

  // ---------- geometría ----------
  function bbox(el, all) {
    if (SHAPES.includes(el.type)) return { x: el.x, y: el.y, w: el.w, h: el.h };
    if (el.type === 'text') {
      const lines = String(el.text || ' ').split('\n'), size = el.size || 18;
      return { x: el.x, y: el.y, w: Math.max(20, Math.max(...lines.map((l) => l.length)) * size * 0.58), h: lines.length * size * 1.3 };
    }
    if (el.type === 'pen') {
      const xs = el.points.map((p) => p[0]), ys = el.points.map((p) => p[1]);
      const x = Math.min(...xs), y = Math.min(...ys);
      return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
    }
    if (el.type === 'arrow') {
      const [a, b] = arrowEnds(el, all);
      return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) };
    }
    return { x: 0, y: 0, w: 0, h: 0 };
  }
  const center = (b) => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });
  // Punto del borde de una figura en dirección a `p`
  function edgePoint(el, p) {
    const c = center(el), dx = p.x - c.x, dy = p.y - c.y, hw = el.w / 2, hh = el.h / 2;
    if (!dx && !dy) return c;
    let s;
    if (el.type === 'ellipse') s = 1 / Math.sqrt((dx / hw) ** 2 + (dy / hh) ** 2);
    else if (el.type === 'diamond') s = 1 / (Math.abs(dx) / hw + Math.abs(dy) / hh);
    else s = Math.min(Math.abs(dx) ? hw / Math.abs(dx) : Infinity, Math.abs(dy) ? hh / Math.abs(dy) : Infinity);
    const gap = 3 / Math.hypot(dx, dy);
    return { x: c.x + dx * (s + gap), y: c.y + dy * (s + gap) };
  }
  function arrowEnds(a, all) {
    const find = (ref) => (ref && ref.id ? all.find((e) => e.id === ref.id && SHAPES.includes(e.type)) : null);
    const fa = find(a.from), fb = find(a.to);
    const ref = (ref, el) => (el ? center(el) : { x: ref.x || 0, y: ref.y || 0 });
    const ra = ref(a.from, fa), rb = ref(a.to, fb);
    return [fa ? edgePoint(fa, rb) : ra, fb ? edgePoint(fb, ra) : rb];
  }

  // ---------- render a SVG (string) ----------
  function labelSvg(text, cx, cy, size, color) {
    if (!text) return '';
    const lines = String(text).split('\n');
    const first = -((lines.length - 1) / 2) * 1.25;
    return `<text x="${r1(cx)}" y="${r1(cy)}" text-anchor="middle" dominant-baseline="central" font-size="${size}" fill="${color}" style="font-family:var(--sans,sans-serif)">${lines.map((l, i) => `<tspan x="${r1(cx)}" dy="${i ? 1.25 : first}em">${esc(l) || ' '}</tspan>`).join('')}</text>`;
  }
  function elementSvg(el, all) {
    const col = colorVal(el.color), dash = el.dash ? ' stroke-dasharray="7 6"' : '';
    const fill = `fill="${col}" fill-opacity="${el.color === 'ink' || !el.color ? 0.04 : 0.1}"`;
    const stroke = `stroke="${col}" stroke-width="2"${dash} stroke-linejoin="round" stroke-linecap="round"`;
    const { x, y, w, h } = el;
    let body = '';
    if (el.type === 'rect') body = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="9" ${fill} ${stroke}/>` + labelSvg(el.text, x + w / 2, y + h / 2, 15, col);
    else if (el.type === 'ellipse') body = `<ellipse cx="${x + w / 2}" cy="${y + h / 2}" rx="${w / 2}" ry="${h / 2}" ${fill} ${stroke}/>` + labelSvg(el.text, x + w / 2, y + h / 2, 15, col);
    else if (el.type === 'diamond') body = `<polygon points="${x + w / 2},${y} ${x + w},${y + h / 2} ${x + w / 2},${y + h} ${x},${y + h / 2}" ${fill} ${stroke}/>` + labelSvg(el.text, x + w / 2, y + h / 2, 14, col);
    else if (el.type === 'db') {
      const ry = Math.min(14, h * 0.18), rx = w / 2;
      body = `<path d="M${x},${y + ry} L${x},${y + h - ry} A${rx},${ry} 0 0 0 ${x + w},${y + h - ry} L${x + w},${y + ry} A${rx},${ry} 0 0 1 ${x},${y + ry} Z" ${fill} ${stroke}/>`
        + `<ellipse cx="${x + rx}" cy="${y + ry}" rx="${rx}" ry="${ry}" ${fill} ${stroke}/>` + labelSvg(el.text, x + w / 2, y + h / 2 + ry / 2, 15, col);
    } else if (el.type === 'text') {
      const size = el.size || 18, lines = String(el.text || '').split('\n');
      body = `<text x="${x}" y="${y}" font-size="${size}" fill="${col}" style="font-family:var(--sans,sans-serif)">${lines.map((l, i) => `<tspan x="${x}" dy="${i ? 1.3 : 1}em">${esc(l) || ' '}</tspan>`).join('')}</text>`;
    } else if (el.type === 'pen') {
      const d = el.points.map((p, i) => `${i ? 'L' : 'M'}${p[0]},${p[1]}`).join(' ');
      body = `<path d="${d}" fill="none" ${stroke}/><path d="${d}" fill="none" stroke="transparent" stroke-width="14"/>`;
    } else if (el.type === 'arrow') {
      const [a, b] = arrowEnds(el, all);
      const ang = Math.atan2(b.y - a.y, b.x - a.x), L = 13, W = 0.45;
      const p1 = `${r1(b.x - L * Math.cos(ang - W))},${r1(b.y - L * Math.sin(ang - W))}`, p2 = `${r1(b.x - L * Math.cos(ang + W))},${r1(b.y - L * Math.sin(ang + W))}`;
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      let label = '';
      if (el.text) {
        const lines = String(el.text).split('\n'), lw = Math.max(...lines.map((l) => l.length)) * 7.6 + 12, lh = lines.length * 17 + 6;
        label = `<rect x="${r1(mx - lw / 2)}" y="${r1(my - lh / 2)}" width="${r1(lw)}" height="${lh}" rx="5" style="fill:var(--panel,#fff)"/>` + labelSvg(el.text, mx, my, 13, col);
      }
      body = `<line x1="${r1(a.x)}" y1="${r1(a.y)}" x2="${r1(b.x)}" y2="${r1(b.y)}" ${stroke}/><line x1="${r1(a.x)}" y1="${r1(a.y)}" x2="${r1(b.x)}" y2="${r1(b.y)}" stroke="transparent" stroke-width="14"/>`
        + `<polygon points="${r1(b.x)},${r1(b.y)} ${p1} ${p2}" fill="${col}" stroke="${col}" stroke-width="1.5" stroke-linejoin="round"/>` + label;
    }
    return `<g data-id="${esc(el.id)}" class="b-el">${body}</g>`;
  }
  // Orden de pintado: trazos y flechas debajo de las figuras no; flechas encima para que se vean
  const zOrder = (els) => els.filter((e) => e.type === 'pen').concat(els.filter((e) => SHAPES.includes(e.type)), els.filter((e) => e.type === 'arrow'), els.filter((e) => e.type === 'text'));
  function contentBox(els) {
    if (!els.length) return null;
    const bs = els.map((e) => bbox(e, els));
    const x = Math.min(...bs.map((b) => b.x)), y = Math.min(...bs.map((b) => b.y));
    return { x, y, w: Math.max(...bs.map((b) => b.x + b.w)) - x, h: Math.max(...bs.map((b) => b.y + b.h)) - y };
  }
  // SVG independiente (vista previa, exportar). `resolve` cambia variables CSS por colores reales.
  function toSVG(value, { resolve = false, pad = 30, maxW } = {}) {
    const v = parse(value);
    const box = contentBox(v.elements) || { x: 0, y: 0, w: 400, h: 200 };
    const vb = `${r1(box.x - pad)} ${r1(box.y - pad)} ${r1(box.w + pad * 2)} ${r1(box.h + pad * 2)}`;
    let inner = zOrder(v.elements).map((e) => elementSvg(e, v.elements)).join('');
    let bg = '';
    if (resolve) {
      const cs = getComputedStyle(document.documentElement);
      const val = (n, d) => cs.getPropertyValue(n).trim() || d;
      inner = inner.replace(/var\(--text\)/g, val('--text', '#18181b')).replace(/var\(--panel,#fff\)/g, val('--panel', '#fff')).replace(/var\(--sans,sans-serif\)/g, 'Helvetica, Arial, sans-serif');
      bg = `<rect x="${r1(box.x - pad)}" y="${r1(box.y - pad)}" width="${r1(box.w + pad * 2)}" height="${r1(box.h + pad * 2)}" fill="${val('--panel', '#fff')}"/>`;
    }
    const size = maxW ? ` width="${Math.min(maxW, box.w + pad * 2)}"` : ` width="${r1(box.w + pad * 2)}" height="${r1(box.h + pad * 2)}"`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}"${size}>${bg}${inner}</svg>`;
  }

  // ---------- íconos ----------
  const I = {
    select: '<path d="M4 3l7 17 2.5-7.5L21 10z"/>', rect: '<rect x="3" y="6" width="18" height="12" rx="2"/>', ellipse: '<ellipse cx="12" cy="12" rx="9" ry="6.5"/>',
    diamond: '<path d="M12 3l9 9-9 9-9-9z"/>', db: '<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6"/>',
    arrow: '<path d="M5 19L19 5M10 5h9v9"/>', text: '<path d="M5 6V4h14v2M12 4v16M9 20h6"/>', pen: '<path d="M3 21l3.5-1 11-11-2.5-2.5-11 11zM14 5.5l2.5 2.5"/>',
    undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>', redo: '<path d="M15 14l5-5-5-5"/><path d="M20 9H10a6 6 0 0 0 0 12h3"/>',
    trash: '<path d="M3 6h18M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6M9 6V4h6v2"/>', dash: '<path d="M3 12h3M10 12h4M18 12h3"/>',
    minus: '<path d="M5 12h14"/>', plus: '<path d="M12 5v14M5 12h14"/>', fit: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
    png: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>', copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/>',
  };
  const ic = (n) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[n]}</svg>`;

  // ---------- componente interactivo ----------
  // Selección múltiple (Shift+clic o recuadro), puntos de conexión en las figuras y
  // "conectar varios a uno": con varias figuras seleccionadas, arrastrar desde el punto
  // de cualquiera crea una flecha desde cada una hacia la figura donde sueltas.
  function create(root, { readOnly = false, onChange = () => {}, onPaste = () => {} } = {}) {
    let state = EMPTY();
    let sel = new Set();      // ids seleccionados
    let primary = null;       // último seleccionado (el que se edita/redimensiona)
    let hoverId = null;       // figura bajo el puntero (muestra sus puntos de conexión)
    let tool = 'select';
    let color = 'ink';
    let view = { x: 0, y: 0, z: 1 };
    let fitted = false;
    let undo = [], redo = [];
    let drag = null, space = false, editing = null, lastDown = null;
    const gid = 'g' + uid();

    const TOOLS = [['select', '1'], ['rect', '2'], ['ellipse', '3'], ['diamond', '4'], ['db', '5'], ['arrow', '6'], ['text', '7'], ['pen', '8']];
    root.classList.add('board');
    root.innerHTML = `
      <div class="b-tools">
        ${readOnly ? '' : `<div class="b-group">${TOOLS.map(([k, key]) => `<button type="button" class="b-btn" data-tool="${k}" title="${t('b.' + k)} (${key})">${ic(k)}</button>`).join('')}</div>
        <div class="b-group b-colors">${COLORS.map((c) => `<button type="button" class="b-color" data-color="${c.id}" title="${t('b.color')}" style="--c:${c.v}"></button>`).join('')}</div>
        <div class="b-group">
          <button type="button" class="b-btn" data-act="dash" title="${t('b.dash')}">${ic('dash')}</button>
          <button type="button" class="b-btn" data-act="dup" title="${t('b.dup')} (Ctrl+D)">${ic('copy')}</button>
          <button type="button" class="b-btn" data-act="del" title="${t('b.del')} (Supr)">${ic('trash')}</button>
          <button type="button" class="b-btn" data-act="undo" title="${t('b.undo')} (Ctrl+Z)">${ic('undo')}</button>
          <button type="button" class="b-btn" data-act="redo" title="${t('b.redo')} (Ctrl+Shift+Z)">${ic('redo')}</button>
        </div>
        <span class="b-selinfo" data-selinfo></span>`}
        <div class="b-spacer"></div>
        <div class="b-group">
          <button type="button" class="b-btn" data-act="zout" title="${t('b.zoom_out')}">${ic('minus')}</button>
          <span class="b-zoom" data-zoom>100%</span>
          <button type="button" class="b-btn" data-act="zin" title="${t('b.zoom_in')}">${ic('plus')}</button>
          <button type="button" class="b-btn" data-act="fit" title="${t('b.fit')}">${ic('fit')}</button>
          <button type="button" class="b-btn" data-act="png" title="${t('b.png')}">${ic('png')}</button>
        </div>
      </div>
      <div class="b-stage" tabindex="0">
        <svg class="b-svg"><defs><pattern id="${gid}" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" style="fill:var(--border-strong)"/></pattern></defs>
          <g class="b-world"><rect class="b-grid" x="-50000" y="-50000" width="100000" height="100000" fill="url(#${gid})"/><g class="b-content"></g><g class="b-overlay"></g></g></svg>
        <textarea class="b-edit hidden" rows="1"></textarea>
        <div class="b-hint">${readOnly ? '' : t('b.hint')}</div>
      </div>
      <div class="b-notes">
        <div class="b-notes-h">${t('b.notes')}</div>
        <textarea class="b-notes-t" placeholder="${readOnly ? '' : t('b.notes_ph')}" ${readOnly ? 'readonly' : ''}></textarea>
      </div>`;
    const $ = (s) => root.querySelector(s);
    const stage = $('.b-stage'), svg = $('.b-svg'), world = $('.b-world'), content = $('.b-content'), overlay = $('.b-overlay');
    const editBox = $('.b-edit'), notes = $('.b-notes-t'), hint = $('.b-hint');

    const byId = (id) => state.elements.find((e) => e.id === id);
    const emit = () => onChange(getValue());
    const snapshot = () => { undo.push(JSON.stringify(state.elements)); if (undo.length > 100) undo.shift(); redo = []; };
    function getValue() { return JSON.stringify({ v: 1, elements: state.elements.map(clean), notes: state.notes }); }
    const clean = (e) => { const c = { ...e }; delete c._fresh; return c; };
    const selected = () => [...sel].map(byId).filter(Boolean);
    const selShapes = () => selected().filter((e) => SHAPES.includes(e.type));
    function select(id, add = false) {
      if (!add) sel = new Set();
      if (id) { if (add && sel.has(id)) sel.delete(id); else sel.add(id); }
      primary = id && sel.has(id) ? id : [...sel].pop() || null;
      paint();
    }
    const clearSel = () => { sel = new Set(); primary = null; };

    // ---------- pintar ----------
    function applyView() {
      world.setAttribute('transform', `translate(${r1(view.x)},${r1(view.y)}) scale(${view.z})`);
      const z = root.querySelector('[data-zoom]'); if (z) z.textContent = Math.round(view.z * 100) + '%';
      paintOverlay();
    }
    function paint() {
      content.innerHTML = zOrder(state.elements).map((e) => elementSvg(e, state.elements)).join('');
      if (editing) { const g = content.querySelector(`[data-id="${editing.id}"] text`); if (g) g.style.opacity = 0; }
      paintOverlay();
      hint.classList.toggle('hidden', readOnly || state.elements.length > 0);
      if (!readOnly) {
        root.querySelectorAll('[data-tool]').forEach((b) => b.classList.toggle('on', b.dataset.tool === tool));
        const pc = primary && byId(primary) && byId(primary).color;
        root.querySelectorAll('[data-color]').forEach((b) => b.classList.toggle('on', b.dataset.color === (pc || color)));
        const info = root.querySelector('[data-selinfo]');
        const n = sel.size, ns = selShapes().length;
        if (info) info.textContent = n > 1 ? (ns > 1 ? t('b.sel_n_connect', { n }) : t('b.sel_n', { n })) : '';
      }
      stage.dataset.tool = tool;
    }
    // Puntos de conexión: centro de cada lado de la figura
    const ports = (e) => [[e.x + e.w / 2, e.y], [e.x + e.w, e.y + e.h / 2], [e.x + e.w / 2, e.y + e.h], [e.x, e.y + e.h / 2]];
    function paintOverlay() {
      if (readOnly) { overlay.innerHTML = ''; return; }
      const z = view.z, hs = 8 / z, sw = 1.25 / z;
      let html = '';
      const single = sel.size === 1 && byId(primary);
      for (const el of selected()) {
        if (el.type === 'arrow') {
          const [a, b] = arrowEnds(el, state.elements);
          html += single ? [['a0', a], ['a1', b]].map(([h, p]) => `<circle data-handle="${h}" cx="${p.x}" cy="${p.y}" r="${hs * 0.7}" class="b-handle" stroke-width="${sw}"/>`).join('')
            : `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" class="b-sel" stroke-width="${4 / z}" stroke-opacity=".35"/>`;
          continue;
        }
        const b = bbox(el, state.elements), pad = 5 / z;
        html += `<rect x="${b.x - pad}" y="${b.y - pad}" width="${b.w + pad * 2}" height="${b.h + pad * 2}" class="b-sel" stroke-width="${sw}" stroke-dasharray="${4 / z} ${3 / z}"/>`;
        if (single && SHAPES.includes(el.type)) {
          html += [['nw', b.x, b.y], ['ne', b.x + b.w, b.y], ['sw', b.x, b.y + b.h], ['se', b.x + b.w, b.y + b.h]]
            .map(([h, x, y]) => `<rect data-handle="${h}" x="${x - hs / 2}" y="${y - hs / 2}" width="${hs}" height="${hs}" rx="${2 / z}" class="b-handle" stroke-width="${sw}"/>`).join('');
        }
      }
      // puntos de conexión en las figuras seleccionadas y en la que está bajo el puntero
      if (tool === 'select' && !(drag && drag.mode !== 'connect')) {
        const ids = new Set(selShapes().map((e) => e.id)); if (hoverId && byId(hoverId)) ids.add(hoverId);
        for (const id of ids) {
          const e = byId(id); if (!e || !SHAPES.includes(e.type)) continue;
          html += ports(e).map(([x, y]) => `<circle data-connect="${e.id}" cx="${x}" cy="${y}" r="${5.5 / z}" class="b-port" stroke-width="${sw}"><title>${t('b.connect')}</title></circle>`).join('');
        }
      }
      // vista previa: flechas al arrastrar desde un punto, recuadro de selección
      if (drag && drag.mode === 'connect') {
        const target = drag.target && byId(drag.target);
        for (const sid of drag.sources) {
          const s = byId(sid); if (!s) continue;
          const end = target ? center(target) : drag.p;
          const a = edgePoint(s, end), bpt = target ? edgePoint(target, center(s)) : end;
          html += `<line x1="${a.x}" y1="${a.y}" x2="${bpt.x}" y2="${bpt.y}" class="b-ghost" stroke-width="${2 / z}" stroke-dasharray="${5 / z} ${4 / z}"/>`;
        }
        if (target) { const b = bbox(target), pad = 6 / z; html += `<rect x="${b.x - pad}" y="${b.y - pad}" width="${b.w + pad * 2}" height="${b.h + pad * 2}" rx="${8 / z}" class="b-target" stroke-width="${2 / z}"/>`; }
      }
      if (drag && drag.mode === 'marquee') {
        const m = drag.rect;
        html += `<rect x="${m.x}" y="${m.y}" width="${m.w}" height="${m.h}" class="b-marquee" stroke-width="${sw}"/>`;
      }
      overlay.innerHTML = html;
    }
    const setTool = (k) => { tool = k; if (k !== 'select') clearSel(); paint(); };

    // ---------- coordenadas ----------
    const toWorld = (e) => { const r = svg.getBoundingClientRect(); return { x: (e.clientX - r.left - view.x) / view.z, y: (e.clientY - r.top - view.y) / view.z }; };
    const shapeAt = (p, exclude = []) => {
      for (let i = state.elements.length - 1; i >= 0; i--) {
        const e = state.elements[i];
        if (!SHAPES.includes(e.type) || exclude.includes(e.id)) continue;
        if (p.x >= e.x - 6 && p.x <= e.x + e.w + 6 && p.y >= e.y - 6 && p.y <= e.y + e.h + 6) return e;
      }
      return null;
    };
    function zoomAt(f, sx, sy) {
      const nz = Math.min(3, Math.max(0.2, view.z * f));
      view.x = sx - (sx - view.x) * (nz / view.z); view.y = sy - (sy - view.y) * (nz / view.z); view.z = nz;
      applyView();
    }
    function fit() {
      const box = contentBox(state.elements), r = svg.getBoundingClientRect();
      if (!r.width || !r.height) return;
      if (!box) { view = { x: r.width / 2 - 200, y: r.height / 2 - 120, z: 1 }; return applyView(); }
      const z = Math.min(1.25, Math.max(0.2, Math.min((r.width - 80) / Math.max(box.w, 1), (r.height - 80) / Math.max(box.h, 1))));
      view = { z, x: r.width / 2 - (box.x + box.w / 2) * z, y: r.height / 2 - (box.y + box.h / 2) * z };
      applyView();
    }

    // ---------- edición de texto ----------
    function editText(el) {
      if (readOnly) return;
      commitText();
      editing = el;
      const r = svg.getBoundingClientRect(), sr = stage.getBoundingClientRect();
      let box;
      if (el.type === 'text') box = { x: el.x, y: el.y, w: Math.max(160, bbox(el).w + 40), h: bbox(el).h + 10, align: 'left' };
      else if (el.type === 'arrow') { const [a, b] = arrowEnds(el, state.elements); box = { x: (a.x + b.x) / 2 - 80, y: (a.y + b.y) / 2 - 16, w: 160, h: 32, align: 'center' }; }
      else box = { x: el.x + 6, y: el.y + el.h / 2 - 18, w: el.w - 12, h: 36, align: 'center' };
      Object.assign(editBox.style, {
        left: (r.left - sr.left + view.x + box.x * view.z) + 'px', top: (r.top - sr.top + view.y + box.y * view.z) + 'px',
        width: Math.max(80, box.w * view.z) + 'px', minHeight: box.h * view.z + 'px', fontSize: ((el.type === 'text' ? el.size || 18 : el.type === 'arrow' ? 13 : 15) * view.z) + 'px',
        textAlign: box.align, color: colorVal(el.color),
      });
      editBox.value = el.text || '';
      editBox.classList.remove('hidden');
      paint();
      // Foco inmediato para no perder las primeras teclas; el segundo intento cubre navegadores que lo pierden al soltar el clic
      editBox.focus({ preventScroll: true }); editBox.select();
      setTimeout(() => { if (editing === el && document.activeElement !== editBox) editBox.focus({ preventScroll: true }); }, 0);
    }
    function commitText() {
      if (!editing) return;
      const el = byId(editing.id), val = editBox.value.replace(/\s+$/, '');
      editing = null; editBox.classList.add('hidden');
      if (el) {
        if (el.text !== val) { if (!el._fresh) snapshot(); el.text = val; }
        delete el._fresh;
        if (el.type === 'text' && !val) { state.elements = state.elements.filter((e) => e !== el); sel.delete(el.id); if (primary === el.id) primary = null; }
      }
      paint(); emit();
    }
    editBox.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if ((e.key === 'Enter' && !e.shiftKey) || e.key === 'Escape') { e.preventDefault(); commitText(); stage.focus(); }
    });
    editBox.addEventListener('blur', commitText);

    // ---------- acciones ----------
    function remove() {
      if (!sel.size) return;
      snapshot();
      const ids = new Set(sel);
      state.elements = state.elements.filter((e) => !ids.has(e.id));
      // las flechas conectadas a una figura borrada también se borran
      state.elements = state.elements.filter((e) => !(e.type === 'arrow' && ((e.from.id && ids.has(e.from.id)) || (e.to.id && ids.has(e.to.id)))));
      clearSel(); paint(); emit();
    }
    function duplicate() {
      const els = selected().filter((e) => e.type !== 'arrow'); if (!els.length) return;
      snapshot();
      const map = {};
      const copies = els.map((el) => {
        const c = JSON.parse(JSON.stringify(el)); c.id = uid(); map[el.id] = c.id;
        if (c.type === 'pen') c.points = c.points.map(([x, y]) => [x + 20, y + 20]); else { c.x += 20; c.y += 20; }
        return c;
      });
      // también copia las flechas que unen figuras duplicadas
      const arrows = state.elements.filter((a) => a.type === 'arrow' && a.from.id && a.to.id && map[a.from.id] && map[a.to.id])
        .map((a) => ({ ...JSON.parse(JSON.stringify(a)), id: uid(), from: { id: map[a.from.id] }, to: { id: map[a.to.id] } }));
      state.elements.push(...copies, ...arrows);
      sel = new Set(copies.map((c) => c.id)); primary = copies[copies.length - 1].id;
      paint(); emit();
    }
    function doUndo() { if (!undo.length) return; redo.push(JSON.stringify(state.elements)); state.elements = JSON.parse(undo.pop()); clearSel(); paint(); emit(); }
    function doRedo() { if (!redo.length) return; undo.push(JSON.stringify(state.elements)); state.elements = JSON.parse(redo.pop()); clearSel(); paint(); emit(); }
    function setColor(c) {
      color = c;
      const els = selected().filter((e) => e.color !== c);
      if (els.length) { snapshot(); els.forEach((e) => { e.color = c; }); emit(); }
      paint();
    }
    function toggleDash() {
      const els = selected().filter((e) => e.type !== 'text'); if (!els.length) return;
      snapshot(); const on = !els.every((e) => e.dash); els.forEach((e) => { e.dash = on; }); paint(); emit();
    }
    function selectAll() { sel = new Set(state.elements.map((e) => e.id)); primary = [...sel].pop() || null; paint(); }
    async function exportPng() {
      const svgStr = toSVG(getValue(), { resolve: true });
      const img = new Image();
      const url = URL.createObjectURL(new Blob([svgStr], { type: 'image/svg+xml' }));
      await new Promise((ok, ko) => { img.onload = ok; img.onerror = ko; img.src = url; });
      const c = document.createElement('canvas'); c.width = img.width * 2; c.height = img.height * 2;
      const ctx = c.getContext('2d'); ctx.scale(2, 2); ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      const a = document.createElement('a'); a.download = 'diagrama.png'; a.href = c.toDataURL('image/png'); a.click();
    }
    // Crea flechas desde cada figura de `sources` hacia `targetId` (sin duplicar las que ya existen)
    function connect(sources, targetId) {
      const exists = (s) => state.elements.some((a) => a.type === 'arrow' && a.from.id === s && a.to.id === targetId);
      const made = sources.filter((s) => s !== targetId && byId(s) && !exists(s)).map((s) => ({ id: uid(), type: 'arrow', from: { id: s }, to: { id: targetId }, text: '', color }));
      if (!made.length) return [];
      state.elements.push(...made);
      return made;
    }

    root.querySelector('.b-tools').addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.tool) setTool(b.dataset.tool);
      if (b.dataset.color) setColor(b.dataset.color);
      const a = b.dataset.act, r = svg.getBoundingClientRect();
      if (a === 'del') remove(); if (a === 'dup') duplicate(); if (a === 'undo') doUndo(); if (a === 'redo') doRedo(); if (a === 'dash') toggleDash();
      if (a === 'zin') zoomAt(1.2, r.width / 2, r.height / 2); if (a === 'zout') zoomAt(1 / 1.2, r.width / 2, r.height / 2);
      if (a === 'fit') fit(); if (a === 'png') exportPng().catch(() => {});
    });

    // ---------- puntero ----------
    const newText = (p) => {
      snapshot();
      const el2 = { id: uid(), type: 'text', x: r1(p.x), y: r1(p.y - 12), text: '', color, size: 18, _fresh: true };
      state.elements.push(el2); sel = new Set([el2.id]); primary = el2.id; editText(el2);
    };
    svg.addEventListener('pointerdown', (e) => {
      if (editing) commitText();
      e.preventDefault(); // evita que el navegador mueva el foco y se lo quite al cuadro de texto
      stage.focus({ preventScroll: true });
      const p = toWorld(e);
      svg.setPointerCapture(e.pointerId);
      if (readOnly || e.button === 1 || space) { drag = { mode: 'pan', sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y }; return; }
      // Doble clic propio: el evento dblclick del navegador falla porque el SVG se vuelve a pintar entre clics
      const now = Date.now();
      if (tool === 'select' && !e.shiftKey && lastDown && now - lastDown.t < 450 && Math.hypot(e.clientX - lastDown.x, e.clientY - lastDown.y) < 6) {
        lastDown = null;
        const g2 = e.target.closest('[data-id]'), hit2 = g2 && byId(g2.dataset.id);
        if (hit2 && hit2.type !== 'pen') { sel = new Set([hit2.id]); primary = hit2.id; editText(hit2); }
        else if (!hit2) newText(p);
        return;
      }
      lastDown = { t: now, x: e.clientX, y: e.clientY };
      // Arrastrar desde un punto de conexión: flecha(s) nueva(s). Si la figura es parte de una
      // selección con varias figuras, se conectan todas.
      const port = e.target.closest('[data-connect]');
      if (port) {
        const from = port.dataset.connect;
        const sources = sel.has(from) && selShapes().length > 1 ? selShapes().map((s) => s.id) : [from];
        drag = { mode: 'connect', sources, p, target: null };
        return paintOverlay();
      }
      const handle = e.target.closest('[data-handle]');
      const el = primary && byId(primary);
      if (handle && el) {
        snapshot();
        drag = { mode: handle.dataset.handle[0] === 'a' ? 'endpoint' : 'resize', h: handle.dataset.handle, orig: JSON.parse(JSON.stringify(el)), start: p, el };
        return;
      }
      if (tool === 'select') {
        const g = e.target.closest('[data-id]');
        if (g) {
          const id = g.dataset.id;
          if (e.shiftKey) { select(id, true); return; }
          if (!sel.has(id)) select(id); else { primary = id; paint(); }
          snapshot();
          drag = { mode: 'move', start: p, orig: selected().map((x) => JSON.parse(JSON.stringify(x))), moved: false };
        } else {
          // recuadro de selección (Shift agrega a la selección actual)
          if (!e.shiftKey) clearSel();
          drag = { mode: 'marquee', start: p, base: new Set(sel), rect: { x: p.x, y: p.y, w: 0, h: 0 } };
          paint();
        }
        return;
      }
      snapshot();
      if (SHAPES.includes(tool)) {
        const el2 = { id: uid(), type: tool, x: r1(p.x), y: r1(p.y), w: 0, h: 0, text: '', color };
        state.elements.push(el2); drag = { mode: 'create', start: p, el: el2 };
      } else if (tool === 'arrow') {
        const s = shapeAt(p);
        const el2 = { id: uid(), type: 'arrow', from: s ? { id: s.id } : { x: r1(p.x), y: r1(p.y) }, to: { x: r1(p.x), y: r1(p.y) }, text: '', color };
        state.elements.push(el2); drag = { mode: 'arrow', start: p, el: el2 };
      } else if (tool === 'pen') {
        const el2 = { id: uid(), type: 'pen', points: [[r1(p.x), r1(p.y)]], color };
        state.elements.push(el2); drag = { mode: 'pen', el: el2 };
      } else if (tool === 'text') {
        undo.pop(); tool = 'select'; newText(p); return;
      }
      paint();
    });
    svg.addEventListener('pointermove', (e) => {
      const p = toWorld(e);
      if (!drag) {
        // puntos de conexión al pasar sobre una figura
        if (readOnly || tool !== 'select') return;
        const over = e.target.closest('[data-connect]') ? e.target.closest('[data-connect]').dataset.connect : (shapeAt(p) || {}).id || null;
        if (over !== hoverId) { hoverId = over; paintOverlay(); }
        return;
      }
      const d = drag;
      if (d.mode === 'pan') { view.x = d.vx + e.clientX - d.sx; view.y = d.vy + e.clientY - d.sy; return applyView(); }
      if (d.mode === 'connect') {
        d.p = p;
        const tgt = shapeAt(p, d.sources.length === 1 ? d.sources : []);
        d.target = tgt && !(d.sources.length > 1 && d.sources.includes(tgt.id) && false) ? tgt.id : null;
        return paintOverlay();
      }
      if (d.mode === 'marquee') {
        const x = Math.min(d.start.x, p.x), y = Math.min(d.start.y, p.y), w = Math.abs(p.x - d.start.x), h = Math.abs(p.y - d.start.y);
        d.rect = { x, y, w, h };
        sel = new Set(d.base);
        for (const el of state.elements) {
          const b = bbox(el, state.elements);
          if (b.x >= x && b.y >= y && b.x + b.w <= x + w && b.y + b.h <= y + h) sel.add(el.id);
        }
        primary = [...sel].pop() || null;
        return paint();
      }
      const dx = p.x - (d.start ? d.start.x : 0), dy = p.y - (d.start ? d.start.y : 0);
      if (d.mode === 'move') {
        d.moved = d.moved || Math.abs(dx) + Math.abs(dy) > 1;
        for (const o of d.orig) {
          const el = byId(o.id); if (!el) continue;
          if (el.type === 'pen') el.points = o.points.map(([x, y]) => [r1(x + dx), r1(y + dy)]);
          else if (el.type === 'arrow') { ['from', 'to'].forEach((k) => { if (!o[k].id) el[k] = { x: r1(o[k].x + dx), y: r1(o[k].y + dy) }; }); }
          else { el.x = r1(o.x + dx); el.y = r1(o.y + dy); }
        }
      } else if (d.mode === 'create') {
        const el = d.el;
        el.x = r1(Math.min(d.start.x, p.x)); el.y = r1(Math.min(d.start.y, p.y)); el.w = r1(Math.abs(dx)); el.h = r1(Math.abs(dy));
      } else if (d.mode === 'resize') {
        const o = d.orig, el = d.el;
        let x1 = o.x, y1 = o.y, x2 = o.x + o.w, y2 = o.y + o.h;
        if (d.h.includes('w')) x1 += dx; if (d.h.includes('e')) x2 += dx; if (d.h.includes('n')) y1 += dy; if (d.h.includes('s')) y2 += dy;
        el.x = r1(Math.min(x1, x2)); el.y = r1(Math.min(y1, y2)); el.w = r1(Math.max(20, Math.abs(x2 - x1))); el.h = r1(Math.max(20, Math.abs(y2 - y1)));
      } else if (d.mode === 'arrow' || d.mode === 'endpoint') {
        const key = d.mode === 'arrow' || d.h === 'a1' ? 'to' : 'from';
        d.el[key] = { x: r1(p.x), y: r1(p.y) };
      } else if (d.mode === 'pen') {
        const last = d.el.points[d.el.points.length - 1];
        if (Math.hypot(p.x - last[0], p.y - last[1]) > 2.5 / view.z) d.el.points.push([r1(p.x), r1(p.y)]);
      }
      paint();
    });
    const endDrag = (e) => {
      if (!drag) return;
      const d = drag; drag = null;
      const p = toWorld(e);
      if (d.mode === 'pan') return;
      if (d.mode === 'marquee') return paint();
      if (d.mode === 'connect') {
        if (d.target) {
          snapshot();
          const made = connect(d.sources, d.target);
          if (!made.length) undo.pop();
          else { sel = new Set(made.map((a) => a.id)); primary = made[made.length - 1].id; emit(); }
        } else if (Math.hypot(p.x - d.p.x, p.y - d.p.y) < 1 && d.sources.length === 1) {
          // clic sin arrastrar en un punto: solo selecciona la figura
          sel = new Set(d.sources); primary = d.sources[0];
        } else if (d.sources.length === 1) {
          // soltar en el vacío: flecha suelta (luego se puede arrastrar su punta a otra figura)
          snapshot();
          const a = { id: uid(), type: 'arrow', from: { id: d.sources[0] }, to: { x: r1(p.x), y: r1(p.y) }, text: '', color };
          state.elements.push(a); sel = new Set([a.id]); primary = a.id; emit();
        }
        return paint();
      }
      if (d.mode === 'move' && !d.moved) { undo.pop(); return; }
      if (d.mode === 'create') {
        const el = d.el;
        if (el.w < 8 && el.h < 8) { const [w, h] = DEFAULT_SIZE[el.type]; el.w = w; el.h = h; el.x = r1(d.start.x - w / 2); el.y = r1(d.start.y - h / 2); }
        tool = 'select'; sel = new Set([el.id]); primary = el.id; el._fresh = true; paint(); emit(); editText(el); return;
      }
      if (d.mode === 'arrow' || d.mode === 'endpoint') {
        const key = d.mode === 'arrow' || d.h === 'a1' ? 'to' : 'from', other = key === 'to' ? 'from' : 'to';
        const s = shapeAt(p, d.el[other] && d.el[other].id ? [d.el[other].id] : []);
        if (s) d.el[key] = { id: s.id };
        const [a, b] = arrowEnds(d.el, state.elements);
        if (d.mode === 'arrow' && Math.hypot(a.x - b.x, a.y - b.y) < 10 && !(d.el.from.id && d.el.to.id)) {
          state.elements = state.elements.filter((x) => x !== d.el); undo.pop(); paint(); return;
        }
        if (d.mode === 'arrow') { tool = 'select'; sel = new Set([d.el.id]); primary = d.el.id; }
      }
      if (d.mode === 'pen' && d.el.points.length < 2) { state.elements = state.elements.filter((x) => x !== d.el); undo.pop(); paint(); return; }
      paint(); emit();
    };
    svg.addEventListener('pointerup', endDrag);
    svg.addEventListener('pointercancel', endDrag);
    svg.addEventListener('pointerleave', () => { if (!drag && hoverId) { hoverId = null; paintOverlay(); } });
    svg.addEventListener('wheel', (e) => {
      e.preventDefault();
      const r = svg.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey) zoomAt(Math.exp(-e.deltaY * 0.01), e.clientX - r.left, e.clientY - r.top);
      else { view.x -= e.deltaX; view.y -= e.deltaY; applyView(); }
    }, { passive: false });

    // ---------- teclado ----------
    stage.addEventListener('keydown', (e) => {
      if (readOnly || editing) return;
      const mod = e.ctrlKey || e.metaKey;
      if (e.key === ' ') { space = true; stage.classList.add('panning'); e.preventDefault(); return; }
      if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); return e.shiftKey ? doRedo() : doUndo(); }
      if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); return doRedo(); }
      if (mod && e.key.toLowerCase() === 'd') { e.preventDefault(); return duplicate(); }
      if (mod && e.key.toLowerCase() === 'a') { e.preventDefault(); return selectAll(); }
      if (mod) return;
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); return remove(); }
      if (e.key === 'Escape') { clearSel(); tool = 'select'; return paint(); }
      if (e.key === 'Enter' && primary) { e.preventDefault(); const el = byId(primary); if (el && el.type !== 'pen') editText(el); return; }
      const tk = TOOLS.find(([, key]) => key === e.key);
      if (tk) { e.preventDefault(); setTool(tk[0]); }
    });
    stage.addEventListener('keyup', (e) => { if (e.key === ' ') { space = false; stage.classList.remove('panning'); } });

    // ---------- notas ----------
    notes.addEventListener('input', () => { state.notes = notes.value; emit(); });
    notes.addEventListener('paste', (e) => onPaste((e.clipboardData || window.clipboardData).getData('text') || ''));

    // ---------- API ----------
    function setValue(v) {
      const next = parse(v);
      const same = JSON.stringify(next) === getValue();
      if (same && fitted) return;
      if (editing && !readOnly) { editing = null; editBox.classList.add('hidden'); }
      state = next;
      sel = new Set([...sel].filter((id) => byId(id))); if (primary && !byId(primary)) primary = [...sel].pop() || null;
      if (document.activeElement !== notes || readOnly) notes.value = state.notes;
      undo = readOnly ? [] : undo;
      paint();
      if (!fitted) { fitted = true; requestAnimationFrame(fit); }
    }
    const ro = new ResizeObserver(() => { if (!fitted) return; paintOverlay(); });
    ro.observe(svg);
    return {
      getValue, setValue,
      reset(v) { undo = []; redo = []; fitted = false; clearSel(); setValue(v); },
      fit, focus: () => stage.focus(), exportPng,
      destroy() { ro.disconnect(); root.innerHTML = ''; },
    };
  }

  window.AlcorBoard = { create, toSVG, parse, EMPTY: () => JSON.stringify(EMPTY()) };
})();
