// Runner compartido (candidato y admin): ejecuta tests en el navegador, con timeout.
(function () {
  const TIMEOUT_MS = 6000;
  const tr = (k, v) => (window.I18N ? I18N.t(k, v) : k);
  const workers = {};
  const readyPromises = {};

  function getWorker(lang) {
    if (workers[lang]) return workers[lang];
    const w = new Worker(lang === 'python' ? '/worker-py.js' : '/worker-js.js');
    workers[lang] = w;
    readyPromises[lang] = lang === 'python'
      ? new Promise((resolve, reject) => {
          const onMsg = (e) => { if (e.data && e.data.ready) { w.removeEventListener('message', onMsg); resolve(); } };
          w.addEventListener('message', onMsg);
          w.addEventListener('error', (e) => reject(new Error(e.message || tr('run.pyload'))));
        })
      : Promise.resolve();
    return w;
  }
  function kill(lang) {
    if (workers[lang]) workers[lang].terminate();
    delete workers[lang]; delete readyPromises[lang];
  }

  function deepEqual(a, b) {
    if (a === b) return true;
    if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) < 1e-9;
    if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => deepEqual(x, b[i]));
    if (a && b && typeof a === 'object' && typeof b === 'object') {
      const ka = Object.keys(a), kb = Object.keys(b);
      return ka.length === kb.length && ka.every((k) => deepEqual(a[k], b[k]));
    }
    return false;
  }

  // Precarga (útil para Python, que tarda unos segundos la primera vez).
  function warmup(lang) { getWorker(lang); return readyPromises[lang]; }

  const REMOTE_ERR = { __NOFN__: (fn) => tr('run.nofn', { fn }), __TIMEOUT__: () => tr('run.timeout', { s: 10 }), __NOJAVA__: () => tr('run.nojava'), __RUNNER_DOWN__: () => tr('run.down'), __BUSY__: () => tr('run.busy') };
  // `remote(code)` ejecuta en el servidor (Java) y devuelve { error?, stdout, cases }
  async function run(lang, code, fn, tests, remote) {
    let raw;
    if (lang === 'java') {
      try { raw = await remote(code); } catch { raw = { error: '__RUNNER_DOWN__' }; }
      raw = { cases: [], stdout: '', ...raw };
      if (REMOTE_ERR[raw.error]) raw.error = REMOTE_ERR[raw.error](fn);
      return finish(raw, fn, tests);
    }
    const w = getWorker(lang);
    await readyPromises[lang];
    raw = await new Promise((resolve) => {
      const timer = setTimeout(() => {
        w.removeEventListener('message', onMsg);
        kill(lang);
        resolve({ error: tr('run.timeout', { s: TIMEOUT_MS / 1000 }), cases: [], stdout: '' });
      }, TIMEOUT_MS);
      const onMsg = (e) => {
        if (e.data && e.data.ready) return;
        clearTimeout(timer); w.removeEventListener('message', onMsg); resolve(e.data);
      };
      w.addEventListener('message', onMsg);
      w.postMessage({ code, fn, tests: tests.map((t) => ({ args: t.args })) });
    });
    return finish(raw, fn, tests);
  }
  function finish(raw, fn, tests) {
    const cases = tests.map((t, i) => {
      const c = raw.cases[i] || {};
      const ok = !raw.error && !c.error && deepEqual(c.actual, t.expected);
      return { args: t.args, expected: t.expected, actual: c.actual, error: c.error, ms: c.ms, hidden: !!t.hidden, ok };
    });
    const error = raw.error === '__NOFN__' ? tr('run.nofn', { fn }) : raw.error || null;
    return { error, stdout: raw.stdout || '', cases, passed: cases.filter((c) => c.ok).length, total: cases.length };
  }

  window.AlcorRunner = { run, warmup };
})();
