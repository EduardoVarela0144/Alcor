// Runner compartido (candidato y admin): ejecuta tests en el navegador, con timeout.
(function () {
  const TIMEOUT_MS = 6000;
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
          w.addEventListener('error', (e) => reject(new Error(e.message || 'No se pudo cargar Python')));
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

  async function run(lang, code, fn, tests) {
    const w = getWorker(lang);
    await readyPromises[lang];
    const raw = await new Promise((resolve) => {
      const timer = setTimeout(() => {
        w.removeEventListener('message', onMsg);
        kill(lang);
        resolve({ error: `Tiempo límite excedido (${TIMEOUT_MS / 1000}s). ¿Hay un ciclo infinito?`, cases: [], stdout: '' });
      }, TIMEOUT_MS);
      const onMsg = (e) => {
        if (e.data && e.data.ready) return;
        clearTimeout(timer); w.removeEventListener('message', onMsg); resolve(e.data);
      };
      w.addEventListener('message', onMsg);
      w.postMessage({ code, fn, tests: tests.map((t) => ({ args: t.args })) });
    });
    const cases = tests.map((t, i) => {
      const c = raw.cases[i] || {};
      const ok = !raw.error && !c.error && deepEqual(c.actual, t.expected);
      return { args: t.args, expected: t.expected, actual: c.actual, error: c.error, ms: c.ms, hidden: !!t.hidden, ok };
    });
    return { error: raw.error || null, stdout: raw.stdout || '', cases, passed: cases.filter((c) => c.ok).length, total: cases.length };
  }

  window.AlcorRunner = { run, warmup };
})();
