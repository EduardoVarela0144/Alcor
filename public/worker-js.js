// Ejecuta código JavaScript del candidato en un Web Worker aislado.
self.onmessage = async (e) => {
  const { code, fn, tests } = e.data;
  const logs = [];
  const fmt = (v) => (typeof v === 'string' ? v : (() => { try { return JSON.stringify(v); } catch { return String(v); } })());
  const con = {};
  ['log', 'info', 'warn', 'error', 'debug'].forEach((k) => { con[k] = (...a) => { if (logs.length < 500) logs.push(a.map(fmt).join(' ')); }; });
  let target;
  try {
    target = new Function('console', `"use strict";\n${code}\n;return typeof ${fn} === 'function' ? ${fn} : undefined;`)(con);
  } catch (err) {
    self.postMessage({ error: String(err && err.stack ? err.message : err), stdout: logs.join('\n'), cases: [] });
    return;
  }
  if (!target) {
    self.postMessage({ error: `No se encontró la función "${fn}".`, stdout: logs.join('\n'), cases: [] });
    return;
  }
  const cases = [];
  for (const t of tests) {
    const start = performance.now();
    try {
      let actual = target(...JSON.parse(JSON.stringify(t.args)));
      if (actual && typeof actual.then === 'function') actual = await actual;
      actual = actual === undefined ? null : JSON.parse(JSON.stringify(actual));
      cases.push({ actual, ms: performance.now() - start });
    } catch (err) {
      cases.push({ error: String(err && err.message ? err.message : err), ms: performance.now() - start });
    }
  }
  self.postMessage({ stdout: logs.join('\n'), cases });
};
