(function () {
  const { $, $$, esc, md, json, LANG, signature, renderResults, fmtTime, fmtCountdown, hhmm, icon, LOGO,
    themeSwitch, getTheme, applyTheme, localTz, fmtIn, tzLabel, modal, confirmBox, toast } = UI;
  const token = decodeURIComponent(location.pathname.split('/c/')[1] || '');
  const api = (sub = '') => `/api/session/${encodeURIComponent(token)}${sub}`;
  const LS_KEY = 'alcor:' + token.slice(-24);

  let S = null;              // estado de la sesión
  let editor = null;
  let docs = {};             // un documento de CodeMirror por ejercicio
  let active = null;         // id del ejercicio abierto
  let results = {};          // últimos resultados por ejercicio
  let versions = {};         // { ejercicio: [{ id, t, label, code, auto }] }
  let clockOffset = 0;       // serverNow - Date.now()
  let pending = [];          // eventos por enviar
  let dirty = false;
  let finished = false;
  let lastSaved = 0;

  $$('.logo-slot').forEach((el) => { el.innerHTML = LOGO + 'Alcor'; });
  const mountTheme = () => $$('.theme-slot').forEach((el) => { el.innerHTML = themeSwitch(S && S.theme); });
  mountTheme();
  $('#btn-run').innerHTML = `${icon('play')} Correr tests <span class="kbd">⌘↵</span>`;
  $('#btn-versions').innerHTML = `${icon('history')} Versiones`;

  // ---------- respaldo local (localStorage) ----------
  function readLocal() { try { return JSON.parse(localStorage.getItem(LS_KEY)) || null; } catch { return null; } }
  function writeLocal() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({
        startedAt: S.startedAt, status: S.status, submittedAt: S.submittedAt, code: currentCode(), versions, active, savedAt: Date.now(),
      }));
    } catch { /* almacenamiento lleno o bloqueado */ }
  }
  const currentCode = () => Object.fromEntries(Object.entries(docs).map(([id, d]) => [id, d.getValue()]));

  function show(id) {
    ['screen-msg', 'screen-locked', 'screen-welcome', 'screen-app'].forEach((s) => $('#' + s).classList.toggle('hidden', s !== id));
  }
  function message(title, text) { $('#msg-title').textContent = title; $('#msg-text').textContent = text; show('screen-msg'); }

  function mergeVersionMaps(a, b) {
    const out = {};
    for (const src of [a || {}, b || {}]) for (const ex of Object.keys(src)) {
      out[ex] = out[ex] || [];
      for (const v of src[ex] || []) if (!out[ex].some((x) => x.id === v.id)) out[ex].push(v);
    }
    for (const ex of Object.keys(out)) out[ex].sort((x, y) => x.t - y.t);
    return out;
  }

  async function load() {
    const r = await fetch(api());
    if (!r.ok) return message('Link no válido', 'Este link de evaluación no existe o fue revocado. Pide uno nuevo a tu evaluador.');
    S = await r.json();
    if (!getTheme() && S.theme) { applyTheme(S.theme); mountTheme(); } // tema que preparó el evaluador
    const local = readLocal();
    // Si el servidor perdió la sesión (reinicio) pero este navegador tiene respaldo, la recuperamos.
    if (S.status === 'pending' && local && local.startedAt) {
      const rr = await fetch(api('/resume'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(local) });
      if (rr.ok) S = await rr.json();
    }
    versions = mergeVersionMaps(S.versions, local && local.versions);
    // Si el respaldo local es más nuevo que lo del servidor (p. ej. se fue el internet), lo usamos.
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
    message(S.status === 'expired' ? 'Se terminó el tiempo' : 'Evaluación enviada',
      `Gracias, ${S.name}. Tu solución quedó registrada y el evaluador ya puede revisarla. Puedes cerrar esta pestaña.`);
  }

  // ---------- link preparado: pantalla de espera ----------
  let lockTimer = null;
  function locked() {
    $('#l-name').textContent = S.name;
    const tz = localTz();
    const sched = !!S.opensAt;
    $('#l-sched').classList.toggle('hidden', !sched);
    $('#l-status').textContent = sched ? 'Programada' : 'Esperando activación';
    $('#l-status').className = 'status ' + (sched ? 'sched' : 'ready');
    if (sched) {
      $('#l-local').innerHTML = `Inicia el <b style="color:var(--text);font-weight:500">${esc(fmtIn(S.opensAt, tz))}</b> · tu hora local (${esc(tzLabel(tz))})`;
      $('#l-other').textContent = S.tz && S.tz !== tz ? `Hora del evaluador: ${fmtIn(S.opensAt, S.tz, { weekday: undefined })} (${tzLabel(S.tz)})` : '';
    }
    show('screen-locked');
    if (S.lang === 'python') AlcorRunner.warmup('python').catch(() => {});
    clearInterval(lockTimer);
    let polls = 0;
    const tick = () => { if (S.opensAt) $('#l-countdown').textContent = 'En ' + fmtCountdown(S.opensAt - (Date.now() + clockOffset)); };
    tick();
    lockTimer = setInterval(async () => {
      tick();
      const due = S.opensAt && Date.now() + clockOffset >= S.opensAt;
      if (++polls % 4 !== 0 && !due) return; // consulta cada ~4 s
      try {
        const r = await fetch(api());
        if (!r.ok) { clearInterval(lockTimer); return message('Link no válido', 'Este link de evaluación fue revocado. Pide uno nuevo a tu evaluador.'); }
        const d = await r.json();
        if (d.open || d.status !== 'pending') { clearInterval(lockTimer); S = d; clockOffset = S.serverNow - Date.now(); route(); }
        else if (d.opensAt !== S.opensAt) { S = d; locked(); } // el evaluador cambió la fecha
      } catch { /* sin red: reintenta */ }
    }, 1000);
  }

  function welcome() {
    $('#w-name').textContent = S.name;
    $('#w-challenge').textContent = S.challenges.length === 1 ? S.challenges[0].title : `${S.challenges.length} ejercicios`;
    $('#w-lang').textContent = LANG[S.lang];
    $('#w-min').textContent = `${S.minutes} min`;
    const rule = (ic, t) => `<li>${icon(ic)}<span>${t}</span></li>`;
    $('#w-rules').innerHTML =
      rule('clock', 'El cronómetro empieza al presionar “Comenzar” y no se puede pausar.') +
      rule('play', 'Tu código se ejecuta en tu navegador. Corre los tests las veces que quieras.') +
      rule('save', 'Todo se guarda solo mientras escribes, aunque cierres la pestaña o se vaya el internet.') +
      rule('history', 'Guarda versiones de tu código y regresa a una anterior si algo deja de funcionar.') +
      rule('eye', 'El evaluador ve tu código en tiempo real. Se registran pegados de texto y cambios de pestaña.') +
      rule('send', 'Al enviar ya no podrás editar. Si se acaba el tiempo se envía solo.');
    show('screen-welcome');
    if (S.lang === 'python') {
      $('#w-warm').textContent = 'Preparando intérprete de Python…';
      AlcorRunner.warmup('python').then(() => ($('#w-warm').textContent = 'Intérprete de Python listo')).catch(() => ($('#w-warm').textContent = 'No se pudo precargar Python; se intentará al correr los tests.'));
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
    const many = S.challenges.length > 1;
    $('#ex-tabs').classList.toggle('hidden', !many);
    if (!many) return;
    $('#ex-tabs').innerHTML = S.challenges.map((c, i) => {
      const r = results[c.id];
      return `<button class="ex-tab ${c.id === active ? 'on' : ''}" data-id="${c.id}"><span class="n">${i + 1}</span><span class="t">${esc(c.title)}</span>${r ? `<span class="r ${r.passed === r.total ? 'ok' : ''}">${r.passed}/${r.total}</span>` : ''}</button>`;
    }).join('');
    $$('.ex-tab').forEach((b) => b.onclick = () => open(b.dataset.id));
  }

  function open(id) {
    active = id;
    const ch = challenge(id);
    $('#p-title').textContent = ch.title;
    $('#p-desc').innerHTML = md(ch.description);
    $('#p-diff').textContent = ch.difficulty;
    $('#p-topic').textContent = ch.topic || '';
    $('#p-fn').textContent = S.lang === 'python' ? `def ${ch.fn}(...)` : `function ${ch.fn}(...)`;
    $('#p-examples').innerHTML = ch.tests.map((t) =>
      `<div class="example">${esc(signature(S.lang, ch.fn, t.args))}<br><span class="faint">→</span> ${esc(json(t.expected, S.lang))}</div>`).join('');
    editor.swapDoc(docs[id]);
    editor.focus();
    const r = results[id];
    if (r) showResults(r); else {
      $('#tab-tests').innerHTML = '<div class="empty">Presiona “Correr tests” para ejecutar tu solución contra los casos de ejemplo.</div>';
      $('#tab-console').innerHTML = '<pre class="console faint">Aquí aparece lo que imprimas con print() / console.log().</pre>';
      $('#summary').textContent = '';
    }
    renderTabs(); updateVersionsBtn();
    dirty = true; queueSync();
  }

  function workspace() {
    show('screen-app');
    const mode = S.lang === 'python' ? 'python' : 'javascript';
    editor = CodeMirror.fromTextArea($('#editor'), {
      mode, lineNumbers: true, indentUnit: S.lang === 'python' ? 4 : 2,
      tabSize: 4, autoCloseBrackets: true, matchBrackets: true, styleActiveLine: true, autofocus: true,
      extraKeys: {
        Tab: (cm) => cm.somethingSelected() ? cm.indentSelection('add') : cm.replaceSelection(' '.repeat(cm.getOption('indentUnit')), 'end'),
        'Shift-Tab': (cm) => cm.indentSelection('subtract'),
        'Cmd-Enter': runTests, 'Ctrl-Enter': runTests,
        'Cmd-S': () => saveVersionPrompt(), 'Ctrl-S': () => saveVersionPrompt(),
      },
    });
    for (const ch of S.challenges) {
      docs[ch.id] = CodeMirror.Doc(typeof S.code[ch.id] === 'string' ? S.code[ch.id] : ch.starter, mode);
      docs[ch.id].on('change', () => { dirty = true; writeLocal(); setSave('saving'); queueSync(); });
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
    $('#btn-versions').onclick = openVersions;
    $$('.tab').forEach((t) => t.onclick = () => {
      $$('.tab').forEach((x) => x.classList.toggle('on', x === t));
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

  // ---------- versiones ----------
  const exVersions = () => versions[active] || [];
  function updateVersionsBtn() {
    const n = exVersions().length;
    $('#btn-versions').innerHTML = `${icon('history')} Versiones${n ? ` <span class="faint mono" style="font-size:11.5px">${n}</span>` : ''}`;
  }
  function addVersion(label, auto, code) {
    const v = { id: Math.random().toString(36).slice(2, 10), t: Date.now() + clockOffset, label, code: code ?? docs[active].getValue(), auto: !!auto };
    const list = versions[active] = versions[active] || [];
    const last = list[list.length - 1];
    if (auto && last && last.code === v.code) return null; // sin cambios desde la última
    list.push(v);
    while (list.length > 30) { const i = list.findIndex((x) => x.auto); list.splice(i >= 0 ? i : 0, 1); }
    pending.push({ type: 'version', exercise: active, ...v });
    writeLocal(); queueSync(); updateVersionsBtn();
    return v;
  }
  function saveVersionPrompt() {
    const m = modal({ title: 'Guardar versión', size: 'sm',
      body: `<div style="padding:16px 18px"><label for="v-name">Nombre (opcional)</label><input id="v-name" placeholder="Ej. Funciona con los ejemplos" maxlength="80"><div class="hint">Guarda una copia de este ejercicio para poder regresar a ella después.</div></div>`,
      footer: `<div class="spacer"></div><button class="btn" data-no>Cancelar</button><button class="btn primary" data-yes>${icon('save')} Guardar</button>` });
    const go = () => { const v = addVersion($('#v-name').value.trim() || `Versión ${exVersions().length + 1}`, false); m.close(); toast(v ? 'Versión guardada' : 'Sin cambios'); };
    m.el.querySelector('[data-yes]').onclick = go;
    m.el.querySelector('[data-no]').onclick = m.close;
    $('#v-name').addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
    $('#v-name').focus();
  }
  function openVersions() {
    const list = exVersions().slice().reverse();
    const m = modal({ title: `Versiones · ${esc(challenge(active).title)}`,
      body: `<div class="vmodal"><div class="code"><div class="code-h" id="vm-h"></div><div class="editor-wrap"><textarea id="vm-code"></textarea></div></div><div class="lst"><div class="vlist" id="vm-list"></div></div></div>`,
      footer: `<button class="btn" id="vm-save">${icon('save')} Guardar versión actual</button><div class="spacer"></div><button class="btn" data-no>Cerrar</button><button class="btn primary" id="vm-restore" disabled>${icon('rotate')} Restaurar esta versión</button>` });
    const viewer = CodeMirror.fromTextArea($('#vm-code'), { mode: S.lang === 'python' ? 'python' : 'javascript', lineNumbers: true, readOnly: true });
    let sel = null;
    const item = (v, cur) => `<button class="vitem ${sel === (cur ? 'cur' : v.id) ? 'on' : ''}" data-id="${cur ? 'cur' : v.id}">
      ${icon(cur ? 'eye' : v.auto ? 'play' : 'save')}<span class="lab">${esc(cur ? 'Versión actual' : v.label || 'Sin nombre')}</span><span class="when">${cur ? 'ahora' : hhmm(v.t)}</span></button>`;
    const render = () => {
      $('#vm-list').innerHTML = item(null, true) + (list.length
        ? `<div class="section-title" style="margin:12px 8px 4px">Guardadas</div>` + list.map((v) => item(v)).join('')
        : '<div class="empty" style="padding:20px 8px">Aún no hay versiones. Guarda una con el botón de abajo o con ⌘S / Ctrl+S. También se guarda una automáticamente cada vez que corres los tests.</div>');
      $$('#vm-list .vitem').forEach((b) => b.onclick = () => pick(b.dataset.id));
    };
    const pick = (id) => {
      sel = id;
      const v = list.find((x) => x.id === id);
      viewer.setValue(id === 'cur' ? docs[active].getValue() : v.code);
      $('#vm-h').textContent = id === 'cur' ? 'Versión actual (lo que tienes en el editor)' : `${v.label || 'Sin nombre'} · ${new Date(v.t).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}${v.auto ? ' · automática' : ''}`;
      $('#vm-restore').disabled = id === 'cur';
      render(); setTimeout(() => viewer.refresh(), 0);
    };
    pick(list[0] ? list[0].id : 'cur');
    m.el.querySelector('[data-no]').onclick = m.close;
    $('#vm-save').onclick = () => { m.close(); saveVersionPrompt(); };
    $('#vm-restore').onclick = async () => {
      const v = list.find((x) => x.id === sel); if (!v) return;
      if (!await confirmBox('¿Restaurar esta versión?', 'Tu código actual se guardará antes como una versión, así que puedes volver a él cuando quieras.', 'Restaurar')) return;
      addVersion('Antes de restaurar', false);
      docs[active].setValue(v.code);
      pending.push({ type: 'restore', exercise: active, detail: v.label || 'versión' });
      queueSync(); m.close(); toast('Versión restaurada');
    };
  }

  // ---------- autoguardado ----------
  let syncTimer = null, inFlight = false;
  function queueSync() { clearTimeout(syncTimer); syncTimer = setTimeout(sync, 400); }
  function setSave(state) {
    const el = $('#save');
    el.className = 'save' + (state === 'saved' ? '' : ' ' + state);
    el.textContent = state === 'saving' ? 'Guardando…' : state === 'offline' ? 'Sin conexión · guardado en este equipo' : 'Guardado';
    if (state === 'saved') el.title = 'Último guardado: ' + new Date(lastSaved).toLocaleTimeString('es-MX');
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
      setSave(dirty ? 'saving' : 'saved');
    } catch {
      pending = events.concat(pending); dirty = true;
      setSave('offline');
    } finally {
      inFlight = false;
      if (dirty && !finished) queueSync();
    }
  }

  function tick() {
    const left = S.deadline - (Date.now() + clockOffset);
    const el = $('#timer');
    el.innerHTML = icon('clock') + fmtTime(left);
    el.querySelector('svg').style.cssText = 'width:13px;height:13px;color:var(--muted)';
    el.classList.toggle('low', left < 5 * 60000);
    if (left <= 0 && !finished) submit(true);
  }

  function showResults(res) {
    const ch = challenge(active);
    renderResults($('#tab-tests'), res, S.lang, ch.fn);
    $('#tab-console').innerHTML = ((res.stdout ? `<pre class="console">${esc(res.stdout)}</pre>` : '') + (res.error ? `<pre class="console err">${esc(res.error)}</pre>` : '')) || '<pre class="console faint">(sin salida)</pre>';
    $('#summary').innerHTML = `<span class="tag ${res.passed === res.total ? 'ok' : 'bad'}">${res.passed}/${res.total} tests</span>`;
  }

  let running = false;
  async function runTests() {
    if (running) return;
    running = true;
    const id = active, ch = challenge(id);
    const btn = $('#btn-run');
    btn.disabled = true; btn.textContent = S.lang === 'python' ? 'Ejecutando…' : 'Ejecutando…';
    $('#summary').textContent = '';
    try {
      const code = docs[id].getValue();
      const res = await AlcorRunner.run(S.lang, code, ch.fn, ch.tests);
      results[id] = res;
      if (active === id) showResults(res);
      renderTabs();
      pending.push({ type: 'run', exercise: id, results: { passed: res.passed, total: res.total }, detail: res.error ? res.error.split('\n').filter(Boolean).slice(-1).join(' ') : undefined });
      if (active === id) addVersion(`Tests ${res.passed}/${res.total}`, true, code); // versión automática
      dirty = true; queueSync();
    } finally {
      running = false; btn.disabled = false; btn.innerHTML = `${icon('play')} Correr tests <span class="kbd">⌘↵</span>`;
    }
  }

  async function submit(auto) {
    if (finished) return;
    if (!auto && !await confirmBox(S.challenges.length > 1 ? '¿Enviar todos tus ejercicios?' : '¿Enviar tu solución?', 'Después de enviar ya no podrás editar tu código.', 'Enviar')) return;
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
