// Ejecuta código Python del candidato con Pyodide (CPython en WebAssembly) dentro de un Web Worker.
importScripts('https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js');

const ready = loadPyodide().then((py) => { self.postMessage({ ready: true }); return py; });

const HARNESS = `
import json, sys, io, time, traceback
def __alcor_run(code, fn, tests_json):
    out = io.StringIO()
    old = sys.stdout, sys.stderr
    sys.stdout = sys.stderr = out
    res = {"cases": []}
    try:
        ns = {"__name__": "__main__"}
        try:
            exec(compile(code, "solution.py", "exec"), ns)
        except BaseException:
            res["error"] = traceback.format_exc(limit=-2)
            return json.dumps(res)
        f = ns.get(fn)
        if not callable(f):
            res["error"] = 'No se encontró la función "%s".' % fn
            return json.dumps(res)
        for t in json.loads(tests_json):
            start = time.perf_counter()
            try:
                actual = f(*t["args"])
                if isinstance(actual, tuple):
                    actual = list(actual)
                res["cases"].append({"actual": json.loads(json.dumps(actual, default=str)), "ms": (time.perf_counter() - start) * 1000})
            except BaseException as ex:
                res["cases"].append({"error": "%s: %s" % (type(ex).__name__, ex), "ms": (time.perf_counter() - start) * 1000})
    finally:
        sys.stdout, sys.stderr = old
        res["stdout"] = out.getvalue()[-20000:]
    return json.dumps(res)
`;

self.onmessage = async (e) => {
  const { code, fn, tests } = e.data;
  try {
    const py = await ready;
    if (!py.globals.get('__alcor_run')) py.runPython(HARNESS);
    const run = py.globals.get('__alcor_run');
    const out = run(code, fn, JSON.stringify(tests));
    self.postMessage(JSON.parse(out));
  } catch (err) {
    self.postMessage({ error: String(err && err.message ? err.message : err), stdout: '', cases: [] });
  }
};
