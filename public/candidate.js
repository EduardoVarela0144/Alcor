(function () {
  const { $, esc, md, json, LANG, signature, renderResults, fmtTime } = UI;
  const token = decodeURIComponent(location.pathname.split('/c/')[1] || '');
  const api = (sub = '') => `/api/session/${encodeURIComponent(token)}${sub}`;
  const LS_KEY = 'alcor:' + token.slice(-24);

  let S = null;              // estado de la sesión
  let editor = null;
  let docs = {};             // un documento de CodeMirror por ejercicio
  let active = null;         // id del ejercicio abierto
  let results = {};          // últimos resultados por ejercicio
  let clockOffset = 0;       // serverNow - Date.now()
  let pending = [];          // eventos por enviar
  let dirty = false;
  let finished = false;
  let lastSaved = 0;

  // ---------- respaldo local (localStorage) ----------
  function readLocal() { try { return JSON.parse(localStorage.getItem(LS_KEY)) || null; } catch { return null; } }
  function writeLocal() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({
        startedAt: S.startedAt, status: S.status, submittedAt: S.submittedAt, code: currentCode(), active, savedAt: Date.now(),
      }));
    } catch { /* almacenamiento lleno o bloqueado */ }
  }
  const currentCode = () => Object.fromEntries(Object.entries(docs).map(([id, d]) => [id, d.getValue()]));

  function show(id) {
    ['screen-msg', 'screen-locked', 'screen-welcome', 'screen-app'].forEach((s) => $('#' + s).classList.toggle('hidden', s !== id));
  }
  function message(title, text) { $('#msg-title').textContent = title; $('#msg-text').textContent = text; show('screen-msg'); }

  async function load() {
    const r = await fetch(api());
    if (!r.ok) return message('Link no válido', 'Este link de evaluación no existe o fue revocado. Pide uno nuevo a tu evaluador.');
    S = await r.json();
    // Si el servidor perdió la sesión (reinicio) pero este navegador tiene respaldo, la recuperamos.
    const local = readLocal();
    if (S.status === 'pending' && local && local.startedAt) {
      const rr = await fetch(api('/resume'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(local) });
      if (rr.ok) S = await rr.json();
    }
    // Si el respaldo local es más nuevo que lo que tiene el servidor (p. ej. se fue el internet), lo usamos.
    if (S.status === 'in_progress' && local && local.code) {
      for (const id of Object.keys(local.code)) if (typeof local.code[id] === 'string' && local.code[id] !== S.code[id]) { S.code[id] = local.code[id]; dirty = true; }
      if (local.active) active = local.active;
    }
    clockOffset = S.serverNow - Date.now();
    route();
  }

  function route() {
    if (S.status === 'pending' && !S.open) return locked();
    if (S.status === 'pending') return welcome();
    if (S.status === 'in_progress') return workspace();
    finished = true;
    message(S.status === 'expired' ? 'Se terminó el tiempo' : '¡Evaluación enviada!',
      `Gracias, ${S.name}. Tu solución quedó registrada y el evaluador ya puede revisarla. Puedes cerrar esta pestaña.`);
  }

  // Link preparado: espera a que el admin lo active (o a la hora programada) y se actualiza solo.
  let lockTimer = null;
  function locked() {
    $('#l-name').textContent = S.name;
    const when = S.opensAt ? new Date(S.opensAt) : null;
    $('#l-when').textContent = when ? `Se abrirá el ${when.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })} a las ${when.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}.` : '';
    show('screen-locked');
    if (S.lang === 'python') AlcorRunner.warmup('python').catch(() => {});
    clearInterval(lockTimer);
    let polls = 0;
    lockTimer = setInterval(async () => {
      if (S.opensAt) $('#l-countdown').textContent = 'Faltan ' + fmtTime(S.opensAt - (Date.now() + clockOffset));
      const due = S.opensAt && Date.now() + clockOffset >= S.opensAt;
      if (++polls % 4 !== 0 && !due) return; // consulta cada ~4 s
      try {
        const r = await fetch(api());
        if (!r.ok) { clearInterval(lockTimer); return message('Link no válido', 'Este link de evaluación fue revocado. Pide uno nuevo a tu evaluador.'); }
        const d = await r.json();
        if (d.open || d.status !== 'pending') { clearInterval(lockTimer); S = d; clockOffset = S.serverNow - Date.now(); route(); }
      } catch { /* sin red: reintenta */ }
    }, 1000);
  }

  function welcome() {
    $('#w-name').textContent = S.name;
    $('#w-challenge').textContent = S.challenges.length === 1 ? S.challenges[0].title : `${S.challenges.length} ejercicios`;
    $('#w-lang').textContent = LANG[S.lang];
    $('#w-min').textContent = `${S.minutes} min`;
    show('screen-welcome');
    if (S.lang === 'python') {
      $('#w-warm').textContent = 'Preparando intérprete de Python…';
      AlcorRunner.warmup('python').then(() => ($('#w-warm').textContent = 'Intérprete de Python listo ✓')).catch(() => ($('#w-warm').textContent = 'No se pudo precargar Python; se intentará al correr los tests.'));
    }
    $('#btn-start').onclick = async () => {
      $('#btn-start').disabled = true;
      const r = await fetch(api('/start'), { method: 'POST' });
      S = await r.json(); clockOffset = S.serverNow - Date.now();
      $('#btn-start').disabled = false;
      writeLocal();
      route();
    };
  }

  const challenge = (id) => S.challenges.find((c) => c.id === id);

  function renderTabs() {
    $('#ex-tabs').innerHTML = S.challenges.length < 2 ? '' : S.challenges.map((c, i) => {
      const r = results[c.id];
      return `<button class="ex-tab ${c.id === active ? 'active' : ''}" data-id="${c.id}"><span class="n">${i + 1}</span><span class="t">${esc(c.title)}</span>${r ? `<span class="r ${r.passed === r.total ? 'ok' : ''}">${r.passed}/${r.total}</span>` : ''}</button>`;
    }).join('');
    $('#ex-tabs').classList.toggle('hidden', S.challenges.length < 2);
    document.querySelectorAll('.ex-tab').forEach((b) => b.onclick = () => open(b.dataset.id));
  }

  function open(id) {
    active = id;
    const ch = challenge(id);
    $('#p-title').textContent = ch.title;
    $('#p-desc').innerHTML = md(ch.description);
    $('#p-diff').textContent = ch.difficulty;
    $('#p-topic').textContent = ch.topic || '';
    $('#p-lang').textContent = LANG[S.lang];
    $('#p-fn').textContent = S.lang === 'python' ? `def ${ch.fn}(...)` : `function ${ch.fn}(...)`;
    $('#p-examples').innerHTML = ch.tests.map((t) =>
      `<div class="example">${esc(signature(S.lang, ch.fn, t.args))}<br><span class="muted">→</span> ${esc(json(t.expected, S.lang))}</div>`).join('');
    editor.swapDoc(docs[id]);
    editor.focus();
    const r = results[id];
    if (r) showResults(r); else {
      $('#tab-tests').innerHTML = '<div class="empty">Presiona “Correr tests” para ejecutar tu solución contra los casos de ejemplo.</div>';
      $('#tab-console').innerHTML = '<pre class="console muted">Aquí aparece lo que imprimas con print() / console.log().</pre>';
      $('#summary').textContent = '';
    }
    renderTabs();
    dirty = true; queueSync();
  }

  function workspace() {
    $('#t-name').textContent = S.name;
    show('screen-app');
    const mode = S.lang === 'python' ? 'python' : 'javascript';
    editor = CodeMirror.fromTextArea($('#editor'), {
      mode, lineNumbers: true, indentUnit: S.lang === 'python' ? 4 : 2,
      tabSize: 4, autoCloseBrackets: true, matchBrackets: true, styleActiveLine: true, autofocus: true,
      extraKeys: {
        Tab: (cm) => cm.somethingSelected() ? cm.indentSelection('add') : cm.replaceSelection(' '.repeat(cm.getOption('indentUnit')), 'end'),
        'Shift-Tab': (cm) => cm.indentSelection('subtract'),
        'Cmd-Enter': runTests, 'Ctrl-Enter': runTests,
        'Cmd-S': () => { dirty = true; sync(); }, 'Ctrl-S': () => { dirty = true; sync(); },
      },
    });
    for (const ch of S.challenges) {
      docs[ch.id] = CodeMirror.Doc(typeof S.code[ch.id] === 'string' ? S.code[ch.id] : ch.starter, mode);
      docs[ch.id].on('change', () => { dirty = true; writeLocal(); setSaveChip('saving'); queueSync(); });
    }
    editor.on('paste', (cm, e) => {
      const text = (e.clipboardData || window.clipboardData).getData('text') || '';
      pending.push({ type: 'paste', exercise: active, detail: `${text.length} caracteres` });
    });
    window.addEventListener('blur', () => { pending.push({ type: 'blur', exercise: active, detail: 'salió de la pestaña' }); queueSync(); });
    window.addEventListener('focus', () => { pending.push({ type: 'focus', exercise: active }); queueSync(); });
    window.addEventListener('online', () => { dirty = true; sync(); });

    $('#btn-run').onclick = runTests;
    $('#btn-submit').onclick = () => submit(false);
    $('#btn-reset').onclick = () => {
      if (confirm('¿Restaurar el código inicial de este ejercicio? Perderás tus cambios.')) { docs[active].setValue(challenge(active).starter); pending.push({ type: 'reset', exercise: active }); }
    };
    document.querySelectorAll('.tab').forEach((t) => t.onclick = () => {
      document.querySelectorAll('.tab').forEach((x) => x.classList.toggle('active', x === t));
      $('#tab-tests').classList.toggle('hidden', t.dataset.tab !== 'tests');
      $('#tab-console').classList.toggle('hidden', t.dataset.tab !== 'console');
    });
    // Al cerrar o recargar: último guardado garantizado.
    const flush = () => {
      if (finished) return;
      writeLocal();
      navigator.sendBeacon(api('/sync'), new Blob([JSON.stringify({ code: currentCode(), active, events: pending })], { type: 'application/json' }));
      pending = [];
    };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });

    open(active && challenge(active) ? active : S.challenges[0].id);
    if (S.lang === 'python') AlcorRunner.warmup('python');
    setInterval(() => { if (dirty || pending.length) sync(); }, 2000); // red de seguridad
    setInterval(tick, 500); tick();
  }

  // ---------- autoguardado ----------
  let syncTimer = null, inFlight = false;
  function queueSync() { clearTimeout(syncTimer); syncTimer = setTimeout(sync, 400); }
  function setSaveChip(state) {
    const el = $('#sync-chip');
    if (state === 'saving') { el.className = 'chip'; el.innerHTML = '<span class="dot"></span>Guardando…'; }
    if (state === 'saved') { el.className = 'chip live'; el.innerHTML = '<span class="dot"></span>Guardado'; el.title = 'Último guardado: ' + new Date(lastSaved).toLocaleTimeString(); }
    if (state === 'offline') { el.className = 'chip warn'; el.innerHTML = '<span class="dot"></span>Sin conexión · guardado local'; }
  }
  async function sync() {
    if (finished || inFlight || (!dirty && !pending.length)) return;
    inFlight = true;
    const events = pending; pending = []; dirty = false;
    try {
      const r = await fetch(api('/sync'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: currentCode(), active, events }) });
      const d = await r.json();
      if (d.status && d.status !== 'in_progress') { finished = true; S.status = d.status; writeLocal(); return route(); }
      if (!r.ok) throw new Error(d.error);
      lastSaved = Date.now();
      setSaveChip(dirty ? 'saving' : 'saved');
    } catch {
      pending = events.concat(pending); dirty = true;
      setSaveChip('offline');
    } finally {
      inFlight = false;
      if (dirty && !finished) queueSync();
    }
  }

  function tick() {
    const left = S.deadline - (Date.now() + clockOffset);
    const el = $('#timer');
    el.textContent = fmtTime(left);
    el.classList.toggle('low', left < 5 * 60000);
    if (left <= 0 && !finished) submit(true);
  }

  function showResults(res) {
    const ch = challenge(active);
    renderResults($('#tab-tests'), res, S.lang, ch.fn);
    $('#tab-console').innerHTML = ((res.stdout ? `<pre class="console">${esc(res.stdout)}</pre>` : '') + (res.error ? `<pre class="console err">${esc(res.error)}</pre>` : '')) || '<pre class="console muted">(sin salida)</pre>';
    $('#summary').innerHTML = `<span class="chip ${res.passed === res.total ? 'live' : 'bad'}">${res.passed}/${res.total} tests</span>`;
  }

  let running = false;
  async function runTests() {
    if (running) return;
    running = true;
    const id = active, ch = challenge(id);
    const btn = $('#btn-run');
    btn.disabled = true; btn.textContent = S.lang === 'python' ? 'Cargando / ejecutando…' : 'Ejecutando…';
    $('#summary').textContent = '';
    try {
      const res = await AlcorRunner.run(S.lang, docs[id].getValue(), ch.fn, ch.tests);
      results[id] = res;
      if (active === id) showResults(res);
      renderTabs();
      pending.push({ type: 'run', exercise: id, results: { passed: res.passed, total: res.total }, detail: res.error ? res.error.split('\n').filter(Boolean).slice(-1).join(' ') : undefined });
      dirty = true; queueSync();
    } finally {
      running = false; btn.disabled = false; btn.innerHTML = '▶ Correr tests <span class="kbd" style="border-color:var(--border)">⌘↵</span>';
    }
  }

  async function submit(auto) {
    if (finished) return;
    if (!auto && !confirm(S.challenges.length > 1 ? '¿Enviar todos tus ejercicios? Ya no podrás editarlos.' : '¿Enviar tu solución? Ya no podrás editarla.')) return;
    finished = true;
    const body = JSON.stringify({ code: currentCode(), auto: !!auto });
    let d = {};
    for (let i = 0; i < 4; i++) { // reintentos por si falla la red
      try {
        if (pending.length) await fetch(api('/sync'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: currentCode(), events: pending }) });
        const r = await fetch(api('/submit'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
        d = await r.json(); break;
      } catch { await new Promise((ok) => setTimeout(ok, 1500 * (i + 1))); }
    }
    S.status = d.status || (auto ? 'expired' : 'submitted');
    S.submittedAt = Date.now();
    writeLocal();
    route();
  }

  load().catch(() => message('Sin conexión', 'No pudimos cargar la evaluación. Revisa tu conexión y recarga la página; tu código está respaldado en este navegador.'));
})();
