(function () {
  const { $, esc, md, json, LANG, signature, renderResults, toast, fmtTime } = UI;
  const token = decodeURIComponent(location.pathname.split('/c/')[1] || '');
  const api = (sub = '') => `/api/session/${encodeURIComponent(token)}${sub}`;

  let S = null;            // estado de la sesión
  let editor = null;
  let clockOffset = 0;     // serverNow - Date.now()
  let pending = [];        // eventos por enviar
  let dirty = false;
  let finished = false;

  function show(id) {
    ['screen-msg', 'screen-welcome', 'screen-app'].forEach((s) => $('#' + s).classList.toggle('hidden', s !== id));
  }
  function message(title, text) { $('#msg-title').textContent = title; $('#msg-text').textContent = text; show('screen-msg'); }

  async function load() {
    const r = await fetch(api());
    if (!r.ok) return message('Link no válido', 'Este link de evaluación no existe o fue revocado. Pide uno nuevo a tu evaluador.');
    S = await r.json();
    clockOffset = S.serverNow - Date.now();
    route();
  }

  function route() {
    if (S.status === 'pending') return welcome();
    if (S.status === 'in_progress') return workspace();
    finished = true;
    message(S.status === 'expired' ? 'Se terminó el tiempo' : '¡Evaluación enviada!',
      `Gracias, ${S.name}. Tu solución quedó registrada y el evaluador ya puede revisarla. Puedes cerrar esta pestaña.`);
  }

  function welcome() {
    $('#w-name').textContent = S.name;
    $('#w-challenge').textContent = S.challenge.title;
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
      route();
    };
  }

  function workspace() {
    const ch = S.challenge;
    $('#p-title').textContent = ch.title;
    $('#p-desc').innerHTML = md(ch.description);
    $('#p-diff').textContent = ch.difficulty;
    $('#p-lang').textContent = LANG[S.lang];
    $('#t-name').textContent = S.name;
    $('#p-fn').textContent = S.lang === 'python' ? `def ${ch.fn}(...)` : `function ${ch.fn}(...)`;
    $('#p-examples').innerHTML = ch.tests.map((t) =>
      `<div class="example">${esc(signature(S.lang, ch.fn, t.args))}<br><span class="muted">→</span> ${esc(json(t.expected, S.lang))}</div>`).join('');
    show('screen-app');

    editor = CodeMirror.fromTextArea($('#editor'), {
      value: '', mode: S.lang === 'python' ? 'python' : 'javascript', lineNumbers: true, indentUnit: S.lang === 'python' ? 4 : 2,
      tabSize: 4, autoCloseBrackets: true, matchBrackets: true, styleActiveLine: true, autofocus: true,
      extraKeys: {
        Tab: (cm) => cm.somethingSelected() ? cm.indentSelection('add') : cm.replaceSelection(' '.repeat(cm.getOption('indentUnit')), 'end'),
        'Shift-Tab': (cm) => cm.indentSelection('subtract'),
        'Cmd-Enter': runTests, 'Ctrl-Enter': runTests,
      },
    });
    editor.setValue(S.code ?? ch.starter);
    editor.on('change', () => { dirty = true; });
    editor.on('paste', (cm, e) => {
      const text = (e.clipboardData || window.clipboardData).getData('text') || '';
      pending.push({ type: 'paste', detail: `${text.length} caracteres` });
    });
    window.addEventListener('blur', () => pending.push({ type: 'blur', detail: 'salió de la pestaña' }));
    window.addEventListener('focus', () => pending.push({ type: 'focus' }));

    $('#btn-run').onclick = runTests;
    $('#btn-submit').onclick = submit;
    $('#btn-reset').onclick = () => { if (confirm('¿Restaurar el código inicial? Perderás tus cambios.')) { editor.setValue(ch.starter); pending.push({ type: 'reset' }); } };
    document.querySelectorAll('.tab').forEach((t) => t.onclick = () => {
      document.querySelectorAll('.tab').forEach((x) => x.classList.toggle('active', x === t));
      $('#tab-tests').classList.toggle('hidden', t.dataset.tab !== 'tests');
      $('#tab-console').classList.toggle('hidden', t.dataset.tab !== 'console');
    });
    window.addEventListener('beforeunload', () => { if (!finished) navigator.sendBeacon(api('/sync'), new Blob([JSON.stringify({ code: editor.getValue(), events: pending })], { type: 'application/json' })); });

    if (S.lang === 'python') AlcorRunner.warmup('python');
    setInterval(sync, 3000);
    setInterval(tick, 500); tick();
  }

  function tick() {
    const left = S.deadline - (Date.now() + clockOffset);
    const el = $('#timer');
    el.textContent = fmtTime(left);
    el.classList.toggle('low', left < 5 * 60000);
    if (left <= 0 && !finished) submit(true);
  }

  async function sync() {
    if (finished || (!dirty && !pending.length)) return;
    const events = pending; pending = []; dirty = false;
    try {
      const r = await fetch(api('/sync'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: editor.getValue(), events }) });
      const d = await r.json();
      $('#sync-chip').className = 'chip live'; $('#sync-chip').innerHTML = '<span class="dot"></span>En vivo';
      if (d.status && d.status !== 'in_progress') { finished = true; S.status = d.status; route(); }
    } catch {
      pending = events.concat(pending); dirty = true;
      $('#sync-chip').className = 'chip warn'; $('#sync-chip').innerHTML = '<span class="dot"></span>Reconectando…';
    }
  }

  let running = false;
  async function runTests() {
    if (running) return;
    running = true;
    const btn = $('#btn-run');
    btn.disabled = true; btn.textContent = S.lang === 'python' ? 'Cargando / ejecutando…' : 'Ejecutando…';
    $('#summary').textContent = '';
    try {
      const res = await AlcorRunner.run(S.lang, editor.getValue(), S.challenge.fn, S.challenge.tests);
      renderResults($('#tab-tests'), res, S.lang, S.challenge.fn);
      const con = $('#tab-console');
      con.innerHTML = (res.stdout ? `<pre class="console">${esc(res.stdout)}</pre>` : '') + (res.error ? `<pre class="console err">${esc(res.error)}</pre>` : '') || '<pre class="console muted">(sin salida)</pre>';
      $('#summary').innerHTML = `<span class="chip ${res.passed === res.total ? 'live' : 'bad'}">${res.passed}/${res.total} tests</span>`;
      pending.push({ type: 'run', results: { passed: res.passed, total: res.total }, detail: res.error ? res.error.split('\n').slice(-2).join(' ') : undefined });
      dirty = true; sync();
    } finally {
      running = false; btn.disabled = false; btn.innerHTML = '▶ Correr tests <span class="kbd" style="border-color:var(--border)">⌘↵</span>';
    }
  }

  async function submit(auto) {
    if (finished) return;
    if (auto !== true && !confirm('¿Enviar tu solución? Ya no podrás editarla.')) return;
    finished = true;
    if (pending.length) await fetch(api('/sync'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: editor.getValue(), events: pending }) }).catch(() => {});
    const r = await fetch(api('/submit'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: editor.getValue() }) });
    const d = await r.json().catch(() => ({}));
    S.status = d.status || (auto === true ? 'expired' : 'submitted');
    route();
  }

  load().catch(() => message('Sin conexión', 'No pudimos cargar la evaluación. Revisa tu conexión y recarga la página.'));
})();
