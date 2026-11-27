// Ejecución de Java para los ejercicios de código.
//
// Java no corre en el navegador, así que el código del candidato se compila y ejecuta en
// un servicio aparte (runner/, desplegado como "alcor-runner") que NO tiene las credenciales
// de Alcor: así el código de un candidato nunca puede leer ADMIN_PASSWORD ni los datos.
//   RUNNER_URL + RUNNER_TOKEN  → usa el runner remoto (producción)
//   JAVA_LOCAL=1               → usa javac/java locales (solo desarrollo)
//
// El servidor arma un archivo Solution.java con: el código del candidato + un arnés (AlcorMain)
// que llama al método con cada caso, mide el tiempo, captura lo que imprime y devuelve JSON.

const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const RUNNER_URL = (process.env.RUNNER_URL || '').replace(/\/$/, '');
const RUNNER_TOKEN = process.env.RUNNER_TOKEN || '';
const LOCAL = process.env.JAVA_LOCAL === '1';
const available = () => !!RUNNER_URL || LOCAL;
const MARK = '__ALCOR_RESULT__';

// ---------- literales de Java a partir de los casos JSON ----------
const jstr = (s) => JSON.stringify(String(s)).replace(/[\u2028\u2029]/g, (c) => (c === '\u2028' ? '\\u2028' : '\\u2029'));
function leaf(v) {
  if (typeof v === 'string') return jstr(v);
  if (typeof v === 'boolean') return String(v);
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : `${v}d`;
  if (v === null) return 'null';
  if (Array.isArray(v)) return objList(v);
  throw new Error('tipo no soportado');
}
const objList = (arr) => (arr.length ? `new ArrayList<Object>(Arrays.<Object>asList(${arr.map(leaf).join(', ')}))` : 'new ArrayList<Object>()');
function lit(v, type) {
  switch (type) {
    case 'int': case 'long': case 'boolean': return String(v);
    case 'double': return `${v}d`;
    case 'String': return jstr(v);
    case 'int[]': return `new int[]{${v.join(', ')}}`;
    case 'String[]': return `new String[]{${v.map(jstr).join(', ')}}`;
    case 'int[][]': return v.length ? `new int[][]{${v.map((r) => `{${r.join(', ')}}`).join(', ')}}` : 'new int[0][]';
    case 'List<Object>': return objList(v);
    case 'List<List<Object>>': return v.length ? `new ArrayList<List<Object>>(Arrays.<List<Object>>asList(${v.map(objList).join(', ')}))` : 'new ArrayList<List<Object>>()';
    default: throw new Error('tipo no soportado: ' + type);
  }
}

// ---------- arnés ----------
const IMPORTS = 'import java.util.*; import java.util.function.*; import java.util.stream.*; import java.io.*; ';
const HARNESS_LIB = `
class AlcorMain {
  interface AlcorCall { Object call() throws Throwable; }
  static StringBuilder out = new StringBuilder();
  static void run(AlcorCall c) {
    if (out.length() > 0) out.append(',');
    long t0 = System.nanoTime();
    try { Object r = c.call(); double ms = (System.nanoTime() - t0) / 1e6; out.append("{\\"actual\\":").append(AlcorJson.of(r)).append(",\\"ms\\":").append(ms).append('}'); }
    catch (Throwable e) { double ms = (System.nanoTime() - t0) / 1e6; out.append("{\\"error\\":").append(AlcorJson.str(e.toString())).append(",\\"ms\\":").append(ms).append('}'); }
  }
  public static void main(String[] args) throws Exception {
    PrintStream real = System.out;
    ByteArrayOutputStream buf = new ByteArrayOutputStream();
    PrintStream cap = new PrintStream(buf, true, "UTF-8");
    System.setOut(cap); System.setErr(cap);
    __CASES__
    System.setOut(real);
    String printed = buf.toString("UTF-8");
    if (printed.length() > 20000) printed = printed.substring(printed.length() - 20000);
    real.print("\\n${MARK}{\\"cases\\":[" + out + "],\\"stdout\\":" + AlcorJson.str(printed) + "}\\n");
    real.flush();
  }
}
class AlcorJson {
  static String str(String s) {
    StringBuilder b = new StringBuilder("\\"");
    for (char ch : s.toCharArray()) {
      switch (ch) {
        case '"': b.append("\\\\\\""); break; case '\\\\': b.append("\\\\\\\\"); break;
        case '\\n': b.append("\\\\n"); break; case '\\r': b.append("\\\\r"); break; case '\\t': b.append("\\\\t"); break;
        default: if (ch < 0x20) b.append(String.format("\\\\u%04x", (int) ch)); else b.append(ch);
      }
    }
    return b.append('"').toString();
  }
  static String of(Object o) {
    if (o == null) return "null";
    if (o instanceof String) return str((String) o);
    if (o instanceof Character) return str(String.valueOf(o));
    if (o instanceof Boolean) return o.toString();
    if (o instanceof Double || o instanceof Float) { double d = ((Number) o).doubleValue(); return Double.isFinite(d) ? (d == Math.rint(d) && Math.abs(d) < 1e15 ? String.valueOf((long) d) : String.valueOf(d)) : "null"; }
    if (o instanceof Number) return o.toString();
    if (o instanceof int[]) { int[] a = (int[]) o; StringBuilder b = new StringBuilder("["); for (int i = 0; i < a.length; i++) { if (i > 0) b.append(','); b.append(a[i]); } return b.append(']').toString(); }
    if (o instanceof long[]) { long[] a = (long[]) o; StringBuilder b = new StringBuilder("["); for (int i = 0; i < a.length; i++) { if (i > 0) b.append(','); b.append(a[i]); } return b.append(']').toString(); }
    if (o instanceof double[]) { double[] a = (double[]) o; StringBuilder b = new StringBuilder("["); for (int i = 0; i < a.length; i++) { if (i > 0) b.append(','); b.append(of(a[i])); } return b.append(']').toString(); }
    if (o instanceof boolean[]) { boolean[] a = (boolean[]) o; StringBuilder b = new StringBuilder("["); for (int i = 0; i < a.length; i++) { if (i > 0) b.append(','); b.append(a[i]); } return b.append(']').toString(); }
    if (o instanceof char[]) return str(new String((char[]) o));
    if (o instanceof Object[]) { Object[] a = (Object[]) o; StringBuilder b = new StringBuilder("["); for (int i = 0; i < a.length; i++) { if (i > 0) b.append(','); b.append(of(a[i])); } return b.append(']').toString(); }
    if (o instanceof Iterable) { StringBuilder b = new StringBuilder("["); boolean first = true; for (Object x : (Iterable<?>) o) { if (!first) b.append(','); first = false; b.append(of(x)); } return b.append(']').toString(); }
    if (o instanceof Map) { StringBuilder b = new StringBuilder("{"); boolean first = true; for (Map.Entry<?, ?> e : ((Map<?, ?>) o).entrySet()) { if (!first) b.append(','); first = false; b.append(str(String.valueOf(e.getKey()))).append(':').append(of(e.getValue())); } return b.append('}').toString(); }
    return str(o.toString());
  }
}
`;

// Arma el archivo completo. Los imports van en la misma línea que la línea 1 del candidato
// para que los números de línea de los errores coincidan con lo que ve en su editor.
function buildSource(userCode, ch, tests) {
  const { params } = ch.java;
  const fn = ch.fn.java;
  const code = String(userCode).replace(/^\s*package\s+[\w.]+\s*;/m, '');
  const cases = tests.map((t) => `run(() -> new Solution().${fn}(${t.args.map((a, i) => lit(a, params[i])).join(', ')}));`).join('\n    ');
  return IMPORTS + code + '\n' + HARNESS_LIB.replace('__CASES__', cases);
}

// ---------- ejecución ----------
function spawnLimited(cmd, args, { cwd, timeout }) {
  return new Promise((resolve) => {
    const env = { PATH: process.env.PATH || '/usr/bin:/bin', HOME: cwd, LANG: 'C.UTF-8' }; // sin las variables de Alcor
    const p = spawn(cmd, args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '', err = '', killed = false;
    const cap = (s, d) => (s.length > 1e6 ? s : s + d);
    p.stdout.on('data', (d) => { out = cap(out, d); });
    p.stderr.on('data', (d) => { err = cap(err, d); });
    const timer = setTimeout(() => { killed = true; p.kill('SIGKILL'); }, timeout);
    p.on('close', (code) => { clearTimeout(timer); resolve({ code, out, err, timeout: killed }); });
    p.on('error', (e) => { clearTimeout(timer); resolve({ code: -1, out, err: String(e), timeout: false }); });
  });
}
async function runLocal(source) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'alcor-java-'));
  try {
    fs.writeFileSync(path.join(dir, 'Solution.java'), source);
    const c = await spawnLimited('javac', ['-encoding', 'UTF-8', '-nowarn', '-J-Xmx256m', '-d', dir, 'Solution.java'], { cwd: dir, timeout: 20000 });
    if (c.code !== 0) return { compileError: (c.err || c.out).replace(/\r/g, ''), timeout: c.timeout };
    const r = await spawnLimited('java', ['-Xmx256m', '-Xss32m', '-XX:+UseSerialGC', '-XX:TieredStopAtLevel=1', '-Djava.awt.headless=true', '-cp', dir, 'AlcorMain'], { cwd: dir, timeout: 10000 });
    return { stdout: r.out, stderr: r.err, timeout: r.timeout, exit: r.code };
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
async function runRemote(source) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 60000); // incluye el arranque en frío del runner
  try {
    const r = await fetch(RUNNER_URL + '/run', { method: 'POST', headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Runner-Token': RUNNER_TOKEN }, body: source, signal: ctrl.signal });
    if (!r.ok) return { infraError: `runner ${r.status}` };
    return await r.json();
  } catch (e) { return { infraError: String(e.message || e) }; } finally { clearTimeout(timer); }
}
// Despierta al runner (el plan gratis de Render lo duerme) cuando un candidato de Java abre su link
function warm() { if (RUNNER_URL) fetch(RUNNER_URL + '/healthz').catch(() => {}); }

// Corre los casos y devuelve el mismo formato que los workers del navegador:
// { error?, stdout, cases: [{ actual | error, ms }] }
async function run(userCode, ch, tests) {
  if (!available()) return { error: '__NOJAVA__', cases: [], stdout: '' };
  let source;
  try { source = buildSource(userCode, ch, tests); } catch (e) { return { error: String(e.message), cases: [], stdout: '' }; }
  const r = RUNNER_URL ? await runRemote(source) : await runLocal(source);
  if (r.infraError) return { error: '__RUNNER_DOWN__', cases: [], stdout: '' };
  if (r.compileError) {
    const msg = r.compileError.replace(/\/[^\s:]*\/Solution\.java/g, 'Solution.java').trim();
    // Si el error está en el arnés porque no existe el método, mostramos el mensaje amigable
    if (/AlcorMain|cannot find symbol[\s\S]*method/.test(msg) && new RegExp(`symbol:\\s+method ${ch.fn.java}\\b`).test(msg)) return { error: '__NOFN__', cases: [], stdout: '' };
    return { error: msg.slice(0, 8000), cases: [], stdout: '' };
  }
  if (r.timeout) return { error: '__TIMEOUT__', cases: [], stdout: '' };
  const line = String(r.stdout || '').split('\n').reverse().find((l) => l.startsWith(MARK));
  if (!line) return { error: (r.stderr || r.stdout || 'El programa terminó sin resultados (¿System.exit?).').slice(-4000), cases: [], stdout: '' };
  try { return JSON.parse(line.slice(MARK.length)); } catch { return { error: 'Salida inválida', cases: [], stdout: '' }; }
}

module.exports = { run, warm, available, buildSource };
