(function () {
  const { t, loc, exText, diff, starter, langSwitch, $, $$, esc, md, json, LANG, signature, renderResults, fmtTime, fmtCountdown, hhmm, icon, LOGO,
    themeSwitch, getTheme, applyTheme, onThemeChange, localTz, fmtIn, tzLabel, modal, confirmBox, toast } = UI;
  const token = decodeURIComponent(location.pathname.split('/c/')[1] || '');
  const api = (sub = '') => `/api/session/${encodeURIComponent(token)}${sub}`;
  const LS_KEY = 'alcor:' + token.slice(-24);
  const HEADERS = () => ({ 'Content-Type': 'application/json', 'X-Lang': I18N.lang() });

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

  // Textos fijos de la página (se vuelven a pintar si el admin preparó otro idioma)
  function paintStatic() {
    I18N.apply();
    document.title = 'Alcor · ' + t('c.title');
    $$('.logo-slot').forEach((el) => { el.innerHTML = LOGO + 'Alcor'; });
    $$('.theme-slot').forEach((el) => { el.innerHTML = themeSwitch(S && S.theme) + langSwitch(); });
    $('#btn-run').innerHTML = `${icon('play')} ${t('c.run')} <span class="kbd">⌘↵</span>`;
    $('#btn-versions').innerHTML = `${icon('history')} ${t('c.versions')}`;
  }
  paintStatic();
  onThemeChange(() => { if (editor) editor.refresh(); }); // re-medir si cambia el tamaño del código

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
    if (!r.ok) return message(t('c.invalid.t'), t('c.invalid.d'));
    S = await r.json();
    // Idioma y tema que preparó el evaluador (si el candidato no ha elegido otros)
    if (!I18N.stored() && S.ui && S.ui !== I18N.lang()) { I18N.setFallback(S.ui); paintStatic(); }
    if (!getTheme() && S.theme) { applyTheme(S.theme); paintStatic(); }
    const local = readLocal();
    // Si el servidor perdió la sesión (reinicio) pero este navegador tiene respaldo, la recuperamos.
    if (S.status === 'pending' && local && local.startedAt) {
      const rr = await fetch(api('/resume'), { method: 'POST', headers: HEADERS(), body: JSON.stringify(local) });
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
    message(S.status === 'expired' ? t('c.expired.t') : t('c.sent.t'), t('c.done.d', { name: S.name }));
    watchReopen();
  }
  // Si el evaluador reabre la evaluación, la página vuelve al editor automáticamente.
  let reopenTimer = null;
  function watchReopen() {
    clearInterval(reopenTimer);
    reopenTimer = setInterval(async () => {
      try {
        const r = await fetch(api()); if (!r.ok) return;
        const d = await r.json();
        if (d.status === 'in_progress') { clearInterval(reopenTimer); location.reload(); }
      } catch { /* sin red: reintenta */ }
    }, 5000);
  }

  // ---------- link preparado: pantalla de espera ----------
  let lockTimer = null;
  function locked() {
    $('#l-hello').textContent = t('c.hello', { name: S.name });
    const tz = localTz();
    const sched = !!S.opensAt;
    $('#l-sched').classList.toggle('hidden', !sched);
    $('#l-status').textContent = sched ? t('c.locked.sched') : t('c.locked.wait');
    $('#l-status').className = 'status ' + (sched ? 'sched' : 'ready');
    if (sched) {
      $('#l-local').innerHTML = t('c.locked.local', { date: esc(fmtIn(S.opensAt, tz)), tz: esc(tzLabel(tz)) }).replace('<b>', '<b style="color:var(--text);font-weight:500">');
      $('#l-other').textContent = S.tz && S.tz !== tz ? t('c.locked.other', { date: fmtIn(S.opensAt, S.tz, { weekday: undefined }), tz: tzLabel(S.tz) }) : '';
    }
    show('screen-locked');
    if (S.lang === 'python') AlcorRunner.warmup('python').catch(() => {});
    clearInterval(lockTimer);
    let polls = 0;
    const tick = () => { if (S.opensAt) $('#l-countdown').textContent = t('c.locked.in', { t: fmtCountdown(S.opensAt - (Date.now() + clockOffset)) }); };
    tick();
    lockTimer = setInterval(async () => {
      tick();
      const due = S.opensAt && Date.now() + clockOffset >= S.opensAt;
      if (++polls % 4 !== 0 && !due) return; // consulta cada ~4 s
      try {
        const r = await fetch(api());
        if (!r.ok) { clearInterval(lockTimer); return message(t('c.invalid.t'), t('c.revoked.d')); }
        const d = await r.json();
        if (d.open || d.status !== 'pending') { clearInterval(lockTimer); S = d; clockOffset = S.serverNow - Date.now(); route(); }
        else if (d.opensAt !== S.opensAt) { S = d; locked(); } // el evaluador cambió la fecha
      } catch { /* sin red: reintenta */ }
    }, 1000);
  }

  function welcome() {
    $('#w-hello').textContent = t('c.hello', { name: S.name });
    $('#w-challenge').textContent = S.challenges.length === 1 ? exText(S.challenges[0], 'title') : t('c.n_ex', { n: S.challenges.length });
    $('#w-lang').textContent = LANG[S.lang];
    $('#w-min').textContent = `${S.minutes} min`;
    const rule = (ic) => `<li>${icon(ic)}<span>${t('c.rule.' + ic)}</span></li>`;
    $('#w-rules').innerHTML = ['clock', 'play', 'save', 'history', 'eye', 'send'].map(rule).join('');
    show('screen-welcome');
    if (S.lang === 'python') {
      $('#w-warm').textContent = t('c.py.loading');
      AlcorRunner.warmup('python').then(() => ($('#w-warm').textContent = t('c.py.ready'))).catch(() => ($('#w-warm').textContent = t('c.py.fail')));
    }
    $('#btn-start').onclick = async () => {
      $('#btn-start').disabled = true;
      const r = await fetch(api('/start'), { method: 'POST', headers: HEADERS() });
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
      return `<button class="ex-tab ${c.id === active ? 'on' : ''}" data-id="${c.id}"><span class="n">${i + 1}</span><span class="t">${esc(exText(c, 'title'))}</span>${r ? `<span class="r ${r.passed === r.total ? 'ok' : ''}">${r.passed}/${r.total}</span>` : ''}</button>`;
    }).join('');
    $$('.ex-tab').forEach((b) => b.onclick = () => open(b.dataset.id));
  }

  function open(id) {
    active = id;
    const ch = challenge(id);
    $('#p-title').textContent = exText(ch, 'title');
    $('#p-desc').innerHTML = md(exText(ch, 'description'));
    $('#p-diff').textContent = diff(ch.difficulty);
    $('#p-topic').textContent = exText(ch, 'topic') || '';
    $('#p-fn').textContent = S.lang === 'python' ? `def ${ch.fn}(...)` : `function ${ch.fn}(...)`;
    $('#p-examples').innerHTML = ch.tests.map((tc) =>
      `<div class="example">${esc(signature(S.lang, ch.fn, tc.args))}<br><span class="faint">→</span> ${esc(json(tc.expected, S.lang))}</div>`).join('');
    editor.swapDoc(docs[id]);
    editor.focus();
    const r = results[id];
    if (r) showResults(r); else {
      $('#tab-tests').innerHTML = `<div class="empty">${t('c.tests.empty')}</div>`;
      $('#tab-console').innerHTML = `<pre class="console faint">${t('c.console.empty')}</pre>`;
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
      docs[ch.id] = CodeMirror.Doc(typeof S.code[ch.id] === 'string' ? S.code[ch.id] : starter(ch.starter), mode);
      docs[ch.id].on('change', () => { dirty = true; writeLocal(); setSave('saving'); queueSync(); });
    }
    editor.on('paste', (cm, e) => {
      const text = (e.clipboardData || window.clipboardData).getData('text') || '';
      pending.push({ type: 'paste', exercise: active, detail: String(text.length) }); // número de caracteres
    });
    window.addEventListener('blur', () => { pending.push({ type: 'blur', exercise: active }); queueSync(); });
    window.addEventListener('focus', () => { pending.push({ type: 'focus', exercise: active }); queueSync(); });
    window.addEventListener('online', () => { dirty = true; sync(); });

    $('#btn-run').onclick = runTests;
    $('#btn-submit').onclick = () => submit(false);
    $('#btn-versions').onclick = openVersions;
    $$('.tab').forEach((tb) => tb.onclick = () => {
      $$('.tab').forEach((x) => x.classList.toggle('on', x === tb));
      $('#tab-tests').classList.toggle('hidden', tb.dataset.tab !== 'tests');
      $('#tab-console').classList.toggle('hidden', tb.dataset.tab !== 'console');
    });
    // Al cerrar o recargar (también al cambiar de idioma): último guardado garantizado.
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
  // Las automáticas se guardan como "Tests 3/5"; se muestran traducidas.
  const versionLabel = (v) => { const mt = /^Tests (\d+)\/(\d+)$/.exec(v.label || ''); return mt ? t('v.tests', { p: mt[1], t: mt[2] }) : v.label || t('no_name'); };
  function updateVersionsBtn() {
    const n = exVersions().length;
    $('#btn-versions').innerHTML = `${icon('history')} ${t('c.versions')}${n ? ` <span class="faint mono" style="font-size:11.5px">${n}</span>` : ''}`;
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
    const m = modal({ title: t('v.save.title'), size: 'sm',
      body: `<div style="padding:16px 18px"><label for="v-name">${t('v.name')}</label><input id="v-name" placeholder="${t('v.name.ph')}" maxlength="80"><div class="hint">${t('v.save.hint')}</div></div>`,
      footer: `<div class="spacer"></div><button class="btn" data-no>${t('cancel')}</button><button class="btn primary" data-yes>${icon('save')} ${t('save')}</button>` });
    const go = () => { const v = addVersion($('#v-name').value.trim() || t('v.default', { n: exVersions().length + 1 }), false); m.close(); toast(v ? t('v.saved') : t('v.nochange')); };
    m.el.querySelector('[data-yes]').onclick = go;
    m.el.querySelector('[data-no]').onclick = m.close;
    $('#v-name').addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
    $('#v-name').focus();
  }
  function openVersions() {
    const list = exVersions().slice().reverse();
    const m = modal({ title: esc(t('v.title', { ex: exText(challenge(active), 'title') })),
      body: `<div class="vmodal"><div class="code"><div class="code-h" id="vm-h"></div><div class="editor-wrap"><textarea id="vm-code"></textarea></div></div><div class="lst"><div class="vlist" id="vm-list"></div></div></div>`,
      footer: `<button class="btn" id="vm-save">${icon('save')} ${t('v.save_current')}</button><div class="spacer"></div><button class="btn" data-no>${t('close')}</button><button class="btn primary" id="vm-restore" disabled>${icon('rotate')} ${t('v.restore')}</button>` });
    const viewer = CodeMirror.fromTextArea($('#vm-code'), { mode: S.lang === 'python' ? 'python' : 'javascript', lineNumbers: true, readOnly: true });
    let sel = null;
    const item = (v, cur) => `<button class="vitem ${sel === (cur ? 'cur' : v.id) ? 'on' : ''}" data-id="${cur ? 'cur' : v.id}">
      ${icon(cur ? 'eye' : v.auto ? 'play' : 'save')}<span class="lab">${esc(cur ? t('v.current') : versionLabel(v))}</span><span class="when">${cur ? t('now') : hhmm(v.t)}</span></button>`;
    const render = () => {
      $('#vm-list').innerHTML = item(null, true) + (list.length
        ? `<div class="section-title" style="margin:12px 8px 4px">${t('v.saved_list')}</div>` + list.map((v) => item(v)).join('')
        : `<div class="empty" style="padding:20px 8px">${t('v.empty')}</div>`);
      $$('#vm-list .vitem').forEach((b) => b.onclick = () => pick(b.dataset.id));
    };
    const pick = (id) => {
      sel = id;
      const v = list.find((x) => x.id === id);
      viewer.setValue(id === 'cur' ? docs[active].getValue() : v.code);
      $('#vm-h').textContent = id === 'cur' ? t('v.current.h') : `${versionLabel(v)} · ${new Date(v.t).toLocaleString(loc(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}${v.auto ? ' · ' + t('v.auto') : ''}`;
      $('#vm-restore').disabled = id === 'cur';
      render(); setTimeout(() => viewer.refresh(), 0);
    };
    pick(list[0] ? list[0].id : 'cur');
    m.el.querySelector('[data-no]').onclick = m.close;
    $('#vm-save').onclick = () => { m.close(); saveVersionPrompt(); };
    $('#vm-restore').onclick = async () => {
      const v = list.find((x) => x.id === sel); if (!v) return;
      if (!await confirmBox(t('v.restore.q'), t('v.restore.d'), t('v.restore.ok'))) return;
      addVersion(t('v.before_restore'), false);
      docs[active].setValue(v.code);
      pending.push({ type: 'restore', exercise: active, detail: versionLabel(v) });
      queueSync(); m.close(); toast(t('v.restored'));
    };
  }

  // ---------- autoguardado ----------
  let syncTimer = null, inFlight = false;
  function queueSync() { clearTimeout(syncTimer); syncTimer = setTimeout(sync, 400); }
  function setSave(state) {
    const el = $('#save');
    el.className = 'save' + (state === 'saved' ? '' : ' ' + state);
    el.textContent = state === 'saving' ? t('c.save.saving') : state === 'offline' ? t('c.save.offline') : t('c.save.saved');
    if (state === 'saved') el.title = t('c.save.last', { t: new Date(lastSaved).toLocaleTimeString(loc()) });
  }
  async function sync() {
    if (finished || inFlight || (!dirty && !pending.length)) return;
    inFlight = true;
    const events = pending; pending = []; dirty = false;
    try {
      const r = await fetch(api('/sync'), { method: 'POST', headers: HEADERS(), body: JSON.stringify({ code: currentCode(), active, events }) });
      const d = await r.json();
      if (d.status && d.status !== 'in_progress') { finished = true; S.status = d.status; writeLocal(); return route(); }
      if (!r.ok) throw new Error(d.error);
      if (d.deadline && d.deadline !== S.deadline) { // el evaluador te dio más tiempo
        if (d.deadline > S.deadline) toast(t('c.more_time'));
        S.deadline = d.deadline;
      }
      if (d.serverNow) clockOffset = d.serverNow - Date.now();
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
    $('#tab-console').innerHTML = ((res.stdout ? `<pre class="console">${esc(res.stdout)}</pre>` : '') + (res.error ? `<pre class="console err">${esc(res.error)}</pre>` : '')) || `<pre class="console faint">${t('c.console.none')}</pre>`;
    $('#summary').innerHTML = `<span class="tag ${res.passed === res.total ? 'ok' : 'bad'}">${res.passed}/${res.total} tests</span>`;
  }

  let running = false;
  async function runTests() {
    if (running) return;
    running = true;
    const id = active, ch = challenge(id);
    const btn = $('#btn-run');
    btn.disabled = true; btn.textContent = t('running');
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
      running = false; btn.disabled = false; btn.innerHTML = `${icon('play')} ${t('c.run')} <span class="kbd">⌘↵</span>`;
    }
  }

  async function submit(auto) {
    if (finished) return;
    if (!auto && !await confirmBox(S.challenges.length > 1 ? t('c.submit.many') : t('c.submit.one'), t('c.submit.d'), t('c.submit'))) return;
    finished = true;
    const body = JSON.stringify({ code: currentCode(), auto: !!auto });
    let d = {};
    for (let i = 0; i < 4; i++) { // reintentos por si falla la red
      try {
        if (pending.length) { await fetch(api('/sync'), { method: 'POST', headers: HEADERS(), body: JSON.stringify({ code: currentCode(), events: pending }) }); pending = []; }
        const r = await fetch(api('/submit'), { method: 'POST', headers: HEADERS(), body });
        d = await r.json(); break;
      } catch { await new Promise((ok) => setTimeout(ok, 1500 * (i + 1))); }
    }
    if (d.status === 'in_progress' && d.deadline) { // el evaluador amplió el tiempo justo a tiempo: seguimos
      finished = false; S.deadline = d.deadline; clockOffset = d.serverNow - Date.now();
      toast(t('c.more_time')); return;
    }
    S.status = d.status || (auto ? 'expired' : 'submitted');
    S.submittedAt = Date.now();
    writeLocal();
    route();
  }

  load().catch(() => message(t('c.offline.t'), t('c.offline.d')));
})();
