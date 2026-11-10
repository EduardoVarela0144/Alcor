(function () {
  const { $, esc, LANG, renderResults, toast, fmtTime } = UI;
  let challenges = [];
  const cands = new Map();
  let selected = null;
  let viewer = null;
  let detailCache = null;

  const STATUS = {
    pending: ['Sin iniciar', ''], in_progress: ['En curso', 'live'], submitted: ['Enviado', 'done'], expired: ['Tiempo agotado', 'warn'],
  };
  const chip = (s) => `<span class="chip ${STATUS[s][1]}"><span class="dot"></span>${STATUS[s][0]}</span>`;
  const linkOf = (c) => `${location.origin}/c/${c.token}`;
  const ago = (t) => { if (!t) return '—'; const s = (Date.now() - t) / 1000; return s < 60 ? 'hace segundos' : s < 3600 ? `hace ${Math.floor(s / 60)} min` : new Date(t).toLocaleString(); };

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

  async function start() {
    try { await api('/api/admin/me'); } catch { return showLogin(); }
    $('#login').classList.add('hidden'); $('#dash').classList.remove('hidden');
    challenges = await api('/api/admin/challenges');
    $('#f-ch').innerHTML = challenges.map((c) => `<option value="${c.id}">${esc(c.title)} · ${esc(c.difficulty)}</option>`).join('');
    $('#f-ch').onchange = () => { $('#f-min').value = challenges.find((c) => c.id === $('#f-ch').value).minutes; };
    $('#f-ch').onchange();
    (await api('/api/admin/candidates')).forEach((c) => cands.set(c.id, c));
    renderList();
    connectStream();
    setInterval(() => { renderList(); if (selected) renderStats(); }, 5000);
  }

  $('#new-form').onsubmit = async (e) => {
    e.preventDefault();
    try {
      const c = await api('/api/admin/candidates', { method: 'POST', body: JSON.stringify({ name: $('#f-name').value, lang: $('#f-lang').value, challenge: $('#f-ch').value, minutes: $('#f-min').value }) });
      cands.set(c.id, c);
      $('#new-url').value = linkOf(c);
      $('#new-link').classList.remove('hidden');
      $('#f-name').value = '';
      renderList(); select(c.id);
    } catch (err) { if (err.message !== '401') toast(err.message); }
  };
  $('#btn-copy-new').onclick = () => { navigator.clipboard.writeText($('#new-url').value); toast('Link copiado'); };

  function renderList() {
    const list = [...cands.values()].sort((a, b) => b.createdAt - a.createdAt);
    $('#cand-list').innerHTML = list.length ? list.map((c) => {
      const ch = challenges.find((x) => x.id === c.challengeId);
      const r = c.results ? ` · ${c.results.passed}/${c.results.total} tests` : '';
      return `<div class="cand ${c.id === selected ? 'active' : ''}" data-id="${c.id}">
        <div class="top"><span class="name">${esc(c.name)}</span>${chip(c.status)}</div>
        <div class="sub">${esc(ch ? ch.title : c.challengeId)} · ${LANG[c.lang]}${r}</div></div>`;
    }).join('') : '<div class="empty" style="padding:8px 16px">Aún no hay candidatos.</div>';
    document.querySelectorAll('.cand').forEach((el) => el.onclick = () => select(el.dataset.id));
  }

  async function select(id) {
    selected = id; renderList();
    detailCache = await api('/api/admin/candidates/' + id);
    renderDetail();
  }

  function renderDetail() {
    const c = detailCache;
    const ch = challenges.find((x) => x.id === c.challengeId);
    $('#detail').innerHTML = `
      <div class="detail-head">
        <h2>${esc(c.name)}</h2><span id="d-status">${chip(c.status)}</span>
        <span class="muted">${esc(ch.title)} · ${LANG[c.lang]} · ${c.minutes} min</span>
        <div style="flex:1"></div>
        <button class="btn sm" id="d-copy">Copiar link</button>
        <button class="btn sm danger" id="d-del">Revocar</button>
      </div>
      <div class="stats" id="d-stats"></div>
      <div class="detail-body">
        <div class="code">
          <div class="topbar" style="height:46px">
            <span class="muted" style="font-size:13px">Código en vivo</span><div class="spacer"></div>
            <button class="btn sm primary" id="d-run">▶ Correr todos los tests (incl. ocultos)</button>
          </div>
          <div class="editor-wrap" style="min-height:300px"><textarea id="d-code"></textarea></div>
          <div class="results" style="height:auto;max-height:340px">
            <div class="tabs"><button class="tab active">Resultados del evaluador</button><span class="summary" id="d-summary"></span></div>
            <div class="results-body" id="d-results"><div class="empty">Los resultados que ve el candidato son informativos. Aquí puedes re-ejecutar su código con todos los casos, incluidos los ocultos.</div></div>
          </div>
        </div>
        <div class="side">
          <div class="section-title">Actividad</div>
          <ul class="timeline" id="d-timeline"></ul>
        </div>
      </div>`;
    viewer = CodeMirror.fromTextArea($('#d-code'), { mode: c.lang === 'python' ? 'python' : 'javascript', lineNumbers: true, readOnly: true });
    viewer.setValue(c.code ?? '# El candidato aún no inicia');
    $('#d-copy').onclick = () => { navigator.clipboard.writeText(linkOf(c)); toast('Link copiado'); };
    $('#d-del').onclick = async () => {
      if (!confirm(`¿Revocar y borrar a ${c.name}? El link dejará de funcionar.`)) return;
      await api('/api/admin/candidates/' + c.id, { method: 'DELETE' });
    };
    $('#d-run').onclick = async () => {
      const btn = $('#d-run'); btn.disabled = true; btn.textContent = 'Ejecutando…';
      try {
        const res = await AlcorRunner.run(c.lang, viewer.getValue(), ch.fn[c.lang], ch.tests);
        renderResults($('#d-results'), res, c.lang, ch.fn[c.lang]);
        if (res.stdout) $('#d-results').insertAdjacentHTML('beforeend', `<div class="section-title">Salida</div><pre class="console">${esc(res.stdout)}</pre>`);
        $('#d-summary').innerHTML = `<span class="chip ${res.passed === res.total ? 'live' : 'bad'}">${res.passed}/${res.total} tests</span>`;
      } finally { btn.disabled = false; btn.textContent = '▶ Correr todos los tests (incl. ocultos)'; }
    };
    renderStats(); renderTimeline();
  }

  function renderStats() {
    const c = detailCache; if (!c || !$('#d-stats')) return;
    const elapsed = c.startedAt ? (c.submittedAt || Date.now()) - c.startedAt : 0;
    const stat = (k, v) => `<div class="stat"><div class="k">${k}</div><div class="v">${v}</div></div>`;
    $('#d-stats').innerHTML =
      stat('Tests (candidato)', c.results ? `${c.results.passed}/${c.results.total}` : '—') +
      stat('Tiempo', c.startedAt ? fmtTime(elapsed) : '—') +
      stat('Ejecuciones', c.runs) +
      stat('Pegados', c.pastes) +
      stat('Cambios de pestaña', c.blurs);
    $('#d-status').innerHTML = chip(c.status);
  }

  const EV = { start: 'Inició la evaluación', run: 'Corrió tests', paste: 'Pegó texto', blur: 'Salió de la pestaña', focus: 'Regresó a la pestaña', submit: 'Envió su solución', expired: 'Se agotó el tiempo', reset: 'Reinició el código' };
  function renderTimeline() {
    const c = detailCache; if (!c || !$('#d-timeline')) return;
    const items = (c.timeline || []).slice(-200).reverse();
    $('#d-timeline').innerHTML = items.length ? items.map((e) => `<li><time>${new Date(e.t).toLocaleTimeString()}</time><span>${EV[e.type] || esc(e.type)}${e.type === 'run' && e.total != null ? ` · <b>${e.passed}/${e.total}</b>` : ''}${e.detail ? ` <span class="muted">· ${esc(e.detail)}</span>` : ''}</span></li>`).join('') : '<li class="muted">Sin actividad todavía.</li>';
  }

  function connectStream() {
    const es = new EventSource('/api/admin/stream');
    const chipEl = $('#stream-chip');
    es.onopen = () => { chipEl.className = 'chip live'; chipEl.innerHTML = '<span class="dot"></span>Tiempo real'; };
    es.onerror = () => { chipEl.className = 'chip warn'; chipEl.innerHTML = '<span class="dot"></span>Reconectando…'; };
    es.onmessage = async (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === 'deleted') {
        cands.delete(msg.id);
        if (selected === msg.id) { selected = null; $('#detail').innerHTML = '<div class="empty" style="padding:40px">Candidato revocado.</div>'; }
        return renderList();
      }
      const c = msg.candidate;
      const prev = cands.get(c.id);
      cands.set(c.id, { ...prev, ...c, token: (prev && prev.token) || c.token });
      renderList();
      if (selected === c.id && detailCache) {
        const timelineChanged = c.events !== (detailCache.timeline || []).length;
        Object.assign(detailCache, c, { timeline: detailCache.timeline });
        if (viewer && c.code != null && viewer.getValue() !== c.code) {
          const scroll = viewer.getScrollInfo();
          viewer.setValue(c.code); viewer.scrollTo(scroll.left, scroll.top);
        }
        renderStats();
        if (timelineChanged) { const d = await api('/api/admin/candidates/' + c.id); detailCache.timeline = d.timeline; renderTimeline(); }
      }
    };
  }

  start();
})();
