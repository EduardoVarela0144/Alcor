(function () {
  const { $, esc, md, json, LANG, renderResults, toast, fmtTime, signature } = UI;
  const CACHE_KEY = 'alcor:admin-cache';
  let challenges = [];
  const cands = new Map();
  let selected = null;       // candidato abierto
  let viewEx = null;         // ejercicio que se está viendo del candidato
  let follow = true;         // seguir automáticamente el ejercicio que el candidato tiene abierto
  let viewer = null;
  let detailCache = null;
  let previewing = null;

  const STATUS = {
    pending: ['Sin iniciar', ''], in_progress: ['En curso', 'live'], submitted: ['Enviado', 'done'], expired: ['Tiempo agotado', 'warn'],
  };
  // ¿El link sigue bloqueado? (preparado sin activar o programado a futuro)
  const isLocked = (c) => c.status === 'pending' && c.locked && !c.activatedAt && !(c.opensAt && Date.now() >= c.opensAt);
  const shortDate = (t) => new Date(t).toLocaleString('es-MX', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const chip = (s, c) => {
    if (c && isLocked(c)) return c.opensAt
      ? `<span class="chip ready" title="Se activa ${esc(shortDate(c.opensAt))}"><span class="dot"></span>Programado</span>`
      : '<span class="chip ready"><span class="dot"></span>Preparado</span>';
    return `<span class="chip ${(STATUS[s] || STATUS.pending)[1]}"><span class="dot"></span>${(STATUS[s] || STATUS.pending)[0]}</span>`;
  };
  const linkOf = (c) => `${location.origin}/c/${c.token}`;
  const chById = (id) => challenges.find((x) => x.id === id);
  const idsOf = (c) => c.challengeIds || (c.challengeId ? [c.challengeId] : []);

  // ---------- respaldo local del admin ----------
  const cache = (() => { try { return JSON.parse(localStorage.getItem(CACHE_KEY)) || {}; } catch { return {}; } })();
  let cacheTimer = null;
  function remember(c) {
    cache[c.id] = { ...(cache[c.id] || {}), ...c };
    clearTimeout(cacheTimer);
    cacheTimer = setTimeout(() => { try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch { /* lleno */ } }, 500);
  }
  function forget(id) { delete cache[id]; try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch { /* */ } }

  async function api(path, opts = {}) {
    const r = await fetch(path, { ...opts, headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) } });
    if (r.status === 401) { showLogin(); throw new Error('401'); }
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || 'Error');
    return d;
  }

  function showLogin() { $('#login').classList.remove('hidden'); $('#dash').classList.add('hidden'); }

  $('#login-form').onsubmit = async (e) => {
    e.preventDefault();
    $('#login-err').textContent = '';
    const r = await fetch('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: $('#pw').value }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { $('#login-err').textContent = d.error || 'Error'; return; }
    $('#pw').value = '';
    start();
  };
  $('#btn-logout').onclick = async () => { await fetch('/api/admin/logout', { method: 'POST' }); location.reload(); };

  let started = false;
  async function start() {
    try { await api('/api/admin/me'); } catch { return showLogin(); }
    $('#login').classList.add('hidden'); $('#dash').classList.remove('hidden');
    if (started) return; started = true;
    challenges = await api('/api/admin/challenges');
    renderCatalog();
    let list = await api('/api/admin/candidates');
    // Si el servidor se reinició y perdió candidatos, los re-subimos desde este navegador.
    const missing = Object.values(cache).filter((c) => {
      if (!c.token) return false;
      const srv = list.find((x) => x.id === c.id);
      return !srv || srv.recovered || (srv.rebuilt && c.status !== 'pending');
    });
    if (missing.length) {
      const { restored } = await api('/api/admin/restore', { method: 'POST', body: JSON.stringify({ candidates: missing }) });
      if (restored) { toast(`Se recuperaron ${restored} candidato(s) del respaldo local`); list = await api('/api/admin/candidates'); }
    }
    list.forEach((c) => { cands.set(c.id, c); remember(c); });
    renderList();
    connectStream();
    setInterval(() => { renderList(); if (selected) renderStats(); }, 1000);
  }

  // ---------- catálogo ----------
  function renderCatalog() {
    const groups = ['Fácil', 'Media', 'Difícil'];
    $('#catalog').innerHTML = groups.map((g) => {
      const items = challenges.filter((c) => c.difficulty === g);
      return items.length ? `<div class="cat-group">${g} · ${items.length}</div>` + items.map((c) => `
        <div class="cat-item" data-id="${c.id}">
          <input type="checkbox" value="${c.id}" aria-label="Seleccionar ${esc(c.title)}">
          <div class="t">${esc(c.title)}<small>${esc(c.topic || '')} · ${c.minutes} min · ${c.tests.length} casos</small></div>
          <span class="eye">Ver ›</span>
        </div>`).join('') : '';
    }).join('');
    document.querySelectorAll('.cat-item').forEach((el) => {
      const box = el.querySelector('input');
      box.onclick = (e) => e.stopPropagation();
      box.onchange = () => {
        const checked = [...document.querySelectorAll('#catalog input:checked')];
        if (checked.length > 6) { box.checked = false; toast('Máximo 6 ejercicios por candidato'); }
        updateSelection();
      };
      el.onclick = () => preview(el.dataset.id);
    });
    updateSelection();
  }
  const selectedIds = () => [...document.querySelectorAll('#catalog input:checked')].map((b) => b.value);
  function updateSelection() {
    const ids = selectedIds();
    $('#f-count').textContent = ids.length ? `· ${ids.length} seleccionado(s)` : '';
    $('#f-min').value = ids.reduce((s, id) => s + chById(id).minutes, 0) || 20;
  }

  function preview(id) {
    previewing = id; selected = null; viewer = null; detailCache = null;
    document.querySelectorAll('.cat-item').forEach((el) => el.classList.toggle('previewing', el.dataset.id === id));
    renderList();
    const c = chById(id);
    const isChecked = selectedIds().includes(id);
    const rows = (lang) => c.tests.map((t, i) => `<tr><td>${i + 1}${t.hidden ? ' <span class="chip" style="height:18px">oculto</span>' : ''}</td><td>${esc(signature(lang, c.fn[lang], t.args))}</td><td>${esc(json(t.expected, lang))}</td></tr>`).join('');
    const lang = $('#f-lang').value;
    $('#detail').innerHTML = `
      <div class="preview">
        <div class="meta" style="display:flex;gap:6px;flex-wrap:wrap"><span class="chip">${esc(c.difficulty)}</span><span class="chip">${esc(c.topic || '')}</span><span class="chip">${c.minutes} min sugeridos</span></div>
        <h2>${esc(c.title)}</h2>
        <div class="section-title">Instrucciones (lo que verá el candidato)</div>
        <p style="font-size:15px">${md(c.description)}</p>
        <div class="section-title">Función y código inicial</div>
        <div class="two"><div><label>Python</label><pre>${esc(c.starter.python)}</pre></div><div><label>JavaScript</label><pre>${esc(c.starter.javascript)}</pre></div></div>
        <div class="section-title">Casos de prueba (${LANG[lang]}) · ${c.tests.filter((t) => !t.hidden).length} visibles, ${c.tests.filter((t) => t.hidden).length} ocultos</div>
        <table><thead><tr><th>#</th><th>Entrada</th><th>Esperado</th></tr></thead><tbody>${rows(lang)}</tbody></table>
        <p class="muted" style="font-size:12px">Los casos ocultos solo los ves tú; el candidato ve únicamente los visibles.</p>
        <button class="btn ${isChecked ? '' : 'primary'}" id="pv-toggle" style="margin-top:8px">${isChecked ? 'Quitar de la selección' : '＋ Agregar a la evaluación'}</button>
      </div>`;
    $('#pv-toggle').onclick = () => {
      const box = document.querySelector(`#catalog input[value="${id}"]`);
      if (!box.checked && selectedIds().length >= 6) return toast('Máximo 6 ejercicios por candidato');
      box.checked = !box.checked; updateSelection(); preview(id);
    };
  }
  $('#f-lang').onchange = () => { if (previewing && !selected) preview(previewing); };

  let activation = 'now';
  const ACT_HELP = {
    now: 'El candidato puede empezar en cuanto abra el link.',
    manual: 'Comparte el link desde hoy. Verá “aún no está activa” hasta que tú presiones Activar.',
    scheduled: 'Se activa sola en la fecha y hora que elijas (también puedes activarla antes).',
  };
  document.querySelectorAll('#f-act button').forEach((b) => b.onclick = () => {
    activation = b.dataset.v;
    document.querySelectorAll('#f-act button').forEach((x) => x.classList.toggle('on', x === b));
    $('#f-act-help').textContent = ACT_HELP[activation];
    $('#f-opens').classList.toggle('hidden', activation !== 'scheduled');
    if (activation === 'scheduled' && !$('#f-opens').value) {
      const d = new Date(Date.now() + 24 * 3600e3); d.setHours(10, 0, 0, 0);
      $('#f-opens').value = new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    }
    $('#f-submit').textContent = activation === 'now' ? 'Generar link' : 'Preparar link';
  });

  $('#new-form').onsubmit = async (e) => {
    e.preventDefault();
    const ids = selectedIds();
    if (!ids.length) return toast('Selecciona al menos un ejercicio del catálogo');
    try {
      const c = await api('/api/admin/candidates', { method: 'POST', body: JSON.stringify({
        name: $('#f-name').value, lang: $('#f-lang').value, challenges: ids, minutes: $('#f-min').value,
        activation, opensAt: activation === 'scheduled' ? new Date($('#f-opens').value).getTime() : undefined,
      }) });
      cands.set(c.id, c); remember(c);
      $('#new-url').value = linkOf(c);
      $('#new-link').classList.remove('hidden');
      $('#f-name').value = '';
      renderList(); select(c.id);
    } catch (err) { if (err.message !== '401') toast(err.message); }
  };
  $('#btn-copy-new').onclick = () => { navigator.clipboard.writeText($('#new-url').value); toast('Link copiado'); };

  // ---------- lista de candidatos ----------
  const isTyping = (c) => c.status === 'in_progress' && c.typingAt && Date.now() - c.typingAt < 3000;
  function renderList() {
    const list = [...cands.values()].sort((a, b) => b.createdAt - a.createdAt);
    $('#cand-list').innerHTML = list.length ? list.map((c) => {
      const ids = idsOf(c);
      const res = c.results || {};
      const passed = ids.reduce((s, id) => s + (res[id] ? res[id].passed : 0), 0);
      const total = ids.reduce((s, id) => s + (res[id] ? res[id].total : 0), 0);
      const label = ids.length === 1 ? (chById(ids[0]) || {}).title : `${ids.length} ejercicios`;
      return `<div class="cand ${c.id === selected ? 'active' : ''}" data-id="${c.id}">
        <div class="top"><span class="name">${esc(c.name)}</span>${chip(c.status, c)}</div>
        <div class="sub">${isLocked(c) && c.opensAt ? `Abre ${esc(shortDate(c.opensAt))} · ` : ''}${esc(label || '')} · ${LANG[c.lang]}${total ? ` · ${passed}/${total} tests` : ''}${isTyping(c) ? ' · <span class="typing">escribiendo</span>' : ''}</div></div>`;
    }).join('') : '<div class="empty" style="padding:8px 16px">Aún no hay candidatos.</div>';
    document.querySelectorAll('.cand').forEach((el) => el.onclick = () => select(el.dataset.id));
    const lockedN = list.filter(isLocked).length;
    const bulk = $('#btn-activate-all');
    bulk.classList.toggle('hidden', !lockedN);
    bulk.textContent = `Activar ${lockedN === 1 ? 'preparado' : `los ${lockedN} preparados`}`;
  }

  $('#btn-activate-all').onclick = async () => {
    const n = [...cands.values()].filter(isLocked).length;
    if (!confirm(`¿Activar ${n} link(s) preparados? Los candidatos podrán empezar en cuanto los abran.`)) return;
    const { activated } = await api('/api/admin/activate-all', { method: 'POST' });
    toast(`${activated} link(s) activados`);
  };
  async function setActive(id, on) {
    try { await api(`/api/admin/candidates/${id}/${on ? 'activate' : 'deactivate'}`, { method: 'POST' }); toast(on ? 'Link activado: el candidato ya puede empezar' : 'Link desactivado'); }
    catch (err) { if (err.message !== '401') toast(err.message); }
  }

  async function select(id) {
    selected = id; previewing = null; follow = true;
    document.querySelectorAll('.cat-item').forEach((el) => el.classList.remove('previewing'));
    renderList();
    detailCache = await api('/api/admin/candidates/' + id);
    remember(detailCache);
    viewEx = detailCache.active || idsOf(detailCache)[0];
    renderDetail();
  }

  function renderDetail() {
    const c = detailCache;
    const ids = idsOf(c);
    $('#detail').innerHTML = `
      <div class="detail-head">
        <h2>${esc(c.name)}</h2><span id="d-status">${chip(c.status, c)}</span><span id="d-typing"></span>
        <span class="muted">${LANG[c.lang]} · ${c.minutes} min</span>
        <div style="flex:1"></div>
        <span id="d-act"></span>
        <button class="btn sm" id="d-copy">Copiar link</button>
        <button class="btn sm danger" id="d-del">Revocar</button>
      </div>
      <div class="stats" id="d-stats"></div>
      <div class="ex-pills" id="d-pills"></div>
      <div class="detail-body">
        <div class="code">
          <div class="topbar" style="height:46px">
            <span style="font-size:13px;font-weight:600" id="d-extitle"></span>
            <label style="margin:0 0 0 8px;display:flex;gap:6px;align-items:center;font-weight:400"><input type="checkbox" id="d-follow" style="width:auto;height:auto" ${follow ? 'checked' : ''}> Seguir al candidato</label>
            <div class="spacer"></div>
            <button class="btn sm primary" id="d-run">▶ Correr todos los tests (incl. ocultos)</button>
          </div>
          <div class="editor-wrap" style="min-height:320px"><textarea id="d-code"></textarea></div>
          <div class="results" style="height:auto;max-height:340px">
            <div class="tabs"><button class="tab active">Resultados del evaluador</button><span class="summary" id="d-summary"></span></div>
            <div class="results-body" id="d-results"><div class="empty">Los resultados que ve el candidato son informativos. Aquí puedes re-ejecutar su código con todos los casos, incluidos los ocultos.</div></div>
          </div>
        </div>
        <div class="side">
          <div class="section-title">Instrucciones</div>
          <p id="d-desc" style="margin:0 0 8px"></p>
          <div class="section-title">Actividad</div>
          <ul class="timeline" id="d-timeline"></ul>
        </div>
      </div>`;
    viewer = CodeMirror.fromTextArea($('#d-code'), { mode: c.lang === 'python' ? 'python' : 'javascript', lineNumbers: true, readOnly: true });
    $('#d-copy').onclick = () => { navigator.clipboard.writeText(linkOf(c)); toast('Link copiado'); };
    $('#d-del').onclick = async () => {
      if (!confirm(`¿Revocar y borrar a ${c.name}? El link dejará de funcionar.`)) return;
      await api('/api/admin/candidates/' + c.id, { method: 'DELETE' });
    };
    $('#d-follow').onchange = (e) => { follow = e.target.checked; if (follow && c.active) showExercise(c.active); };
    $('#d-run').onclick = async () => {
      const ch = chById(viewEx);
      const btn = $('#d-run'); btn.disabled = true; btn.textContent = 'Ejecutando…';
      try {
        const res = await AlcorRunner.run(c.lang, viewer.getValue(), ch.fn[c.lang], ch.tests);
        renderResults($('#d-results'), res, c.lang, ch.fn[c.lang]);
        if (res.stdout) $('#d-results').insertAdjacentHTML('beforeend', `<div class="section-title">Salida</div><pre class="console">${esc(res.stdout)}</pre>`);
        $('#d-summary').innerHTML = `<span class="chip ${res.passed === res.total ? 'live' : 'bad'}">${res.passed}/${res.total} tests</span>`;
      } finally { btn.disabled = false; btn.textContent = '▶ Correr todos los tests (incl. ocultos)'; }
    };
    showExercise(viewEx);
    renderStats(); renderTimeline();
  }

  function renderPills() {
    const c = detailCache; if (!c || !$('#d-pills')) return;
    const ids = idsOf(c);
    $('#d-pills').classList.toggle('hidden', ids.length < 2);
    $('#d-pills').innerHTML = ids.map((id, i) => {
      const r = (c.results || {})[id];
      const here = c.active === id && c.status === 'in_progress';
      return `<button class="ex-pill ${id === viewEx ? 'active' : ''}" data-id="${id}">${i + 1}. ${esc(chById(id).title)}${r ? ` <span class="r">${r.passed}/${r.total}</span>` : ''}${here ? ' 👁' : ''}</button>`;
    }).join('');
    document.querySelectorAll('.ex-pill').forEach((b) => b.onclick = () => {
      follow = false; if ($('#d-follow')) $('#d-follow').checked = false; showExercise(b.dataset.id);
    });
  }

  function showExercise(id) {
    viewEx = id;
    const c = detailCache, ch = chById(id);
    $('#d-extitle').textContent = ch.title;
    $('#d-desc').innerHTML = md(ch.description);
    const code = c.code && typeof c.code[id] === 'string' ? c.code[id] : (c.status === 'pending' ? '' : ch.starter[c.lang]);
    viewer.setValue(code || (c.lang === 'python' ? '# El candidato aún no inicia' : '// El candidato aún no inicia'));
    $('#d-results').innerHTML = '<div class="empty">Los resultados que ve el candidato son informativos. Aquí puedes re-ejecutar su código con todos los casos, incluidos los ocultos.</div>';
    $('#d-summary').innerHTML = '';
    renderPills();
  }

  function renderActButton() {
    const c = detailCache; const el = $('#d-act'); if (!c || !el) return;
    let html = '';
    if (isLocked(c)) html = `${c.opensAt ? `<span class="muted" style="font-size:12px;margin-right:6px">Abre ${esc(shortDate(c.opensAt))}</span>` : ''}<button class="btn sm primary" data-on="1">▶ Activar ahora</button>`;
    else if (c.status === 'pending' && c.locked) html = '<button class="btn sm" data-on="0">Desactivar</button>';
    if (el.dataset.html !== html) {
      el.dataset.html = html; el.innerHTML = html;
      const b = el.querySelector('button'); if (b) b.onclick = () => setActive(c.id, b.dataset.on === '1');
    }
  }

  function renderStats() {
    const c = detailCache; if (!c || !$('#d-stats')) return;
    const elapsed = c.startedAt ? (c.submittedAt || Date.now()) - c.startedAt : 0;
    const ids = idsOf(c), res = c.results || {};
    const passed = ids.reduce((s, id) => s + (res[id] ? res[id].passed : 0), 0);
    const total = ids.reduce((s, id) => s + (res[id] ? res[id].total : 0), 0);
    const left = c.startedAt && c.status === 'in_progress' ? c.startedAt + c.minutes * 60000 - Date.now() : null;
    const stat = (k, v) => `<div class="stat"><div class="k">${k}</div><div class="v">${v}</div></div>`;
    $('#d-stats').innerHTML =
      stat('Tests (candidato)', total ? `${passed}/${total}` : '—') +
      stat(left != null ? 'Le quedan' : 'Tiempo usado', left != null ? fmtTime(left) : c.startedAt ? fmtTime(elapsed) : '—') +
      stat('Ejecuciones', c.runs) +
      stat('Pegados', c.pastes) +
      stat('Cambios de pestaña', c.blurs);
    $('#d-status').innerHTML = chip(c.status, c);
    renderActButton();
    $('#d-typing').innerHTML = isTyping(c) ? '<span class="typing">escribiendo…</span>' : '';
  }

  const EV = { activated: 'Link activado', deactivated: 'Link desactivado', start: 'Inició la evaluación', run: 'Corrió tests', paste: 'Pegó texto', blur: 'Salió de la pestaña', focus: 'Regresó a la pestaña', submit: 'Envió su solución', expired: 'Se agotó el tiempo', reset: 'Reinició el código', restored: 'Sesión recuperada' };
  function renderTimeline() {
    const c = detailCache; if (!c || !$('#d-timeline')) return;
    const items = (c.timeline || []).slice(-200).reverse();
    $('#d-timeline').innerHTML = items.length ? items.map((e) => `<li><time>${new Date(e.t).toLocaleTimeString()}</time><span>${EV[e.type] || esc(e.type)}${e.exercise && idsOf(c).length > 1 ? ` <span class="muted">(${esc((chById(e.exercise) || {}).title || '')})</span>` : ''}${e.type === 'run' && e.total != null ? ` · <b>${e.passed}/${e.total}</b>` : ''}${e.detail ? ` <span class="muted">· ${esc(e.detail)}</span>` : ''}</span></li>`).join('') : '<li class="muted">Sin actividad todavía.</li>';
  }

  // ---------- tiempo real ----------
  function connectStream() {
    const es = new EventSource('/api/admin/stream');
    const chipEl = $('#stream-chip');
    es.onopen = () => { chipEl.className = 'chip live'; chipEl.innerHTML = '<span class="dot"></span>Tiempo real'; };
    es.onerror = () => { chipEl.className = 'chip warn'; chipEl.innerHTML = '<span class="dot"></span>Reconectando…'; };
    es.onmessage = async (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === 'deleted') {
        cands.delete(msg.id); forget(msg.id);
        if (selected === msg.id) { selected = null; $('#detail').innerHTML = '<div class="empty" style="padding:40px">Candidato revocado.</div>'; }
        return renderList();
      }
      const c = msg.candidate;
      const prev = cands.get(c.id) || {};
      const merged = { ...prev, ...c, token: prev.token || c.token };
      cands.set(c.id, merged);
      remember({ ...merged, timeline: (cache[c.id] || {}).timeline });
      renderList();
      if (selected === c.id && detailCache) {
        const timelineChanged = c.events !== (detailCache.timeline || []).length;
        Object.assign(detailCache, c, { timeline: detailCache.timeline });
        if (follow && c.active && c.active !== viewEx) showExercise(c.active);
        else if (viewer && c.code && typeof c.code[viewEx] === 'string' && viewer.getValue() !== c.code[viewEx]) {
          const scroll = viewer.getScrollInfo();
          viewer.setValue(c.code[viewEx]); viewer.scrollTo(scroll.left, scroll.top);
        }
        renderPills(); renderStats();
        if (timelineChanged) {
          const d = await api('/api/admin/candidates/' + c.id);
          detailCache.timeline = d.timeline; remember(d); renderTimeline();
        }
      }
    };
  }

  start();
})();
