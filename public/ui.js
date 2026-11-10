// Helpers de UI compartidos.
window.UI = (function () {
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const json = (v, lang) => {
    if (v === undefined) return '—';
    const out = JSON.stringify(v);
    if (lang !== 'python') return out;
    // Literales de Python fuera de strings
    return out.replace(/("(?:[^"\\]|\\.)*")|\btrue\b|\bfalse\b|\bnull\b/g, (m, str) => str || ({ true: 'True', false: 'False', null: 'None' })[m]);
  };
  // Markdown mínimo: `código`
  const md = (s) => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>');
  const LANG = { python: 'Python', javascript: 'JavaScript' };

  function signature(lang, fn, args) {
    const a = args.map((v) => json(v, lang)).join(', ');
    return `${fn}(${a})`;
  }

  function renderResults(container, res, lang, fn) {
    if (res.error && !res.cases.some((c) => c.actual !== undefined)) {
      container.innerHTML = `<pre class="console err">${esc(res.error)}</pre>`;
      return;
    }
    container.innerHTML = res.cases.map((c, i) => `
      <div class="case ${c.ok ? 'ok' : 'fail'}">
        <div class="case-head"><span class="icon">${c.ok ? '✓' : '✕'}</span>
          Caso ${i + 1}${c.hidden ? ' <span class="chip" style="height:18px">oculto</span>' : ''}
          <span class="muted" style="margin-left:auto;font-weight:400">${c.ms != null ? c.ms.toFixed(1) + ' ms' : ''}</span></div>
        ${c.ok ? '' : `<div class="case-body"><b>Entrada</b>${esc(signature(lang, fn, c.args))}
<b>Esperado</b>${esc(json(c.expected, lang))}
<b>${c.error ? 'Error' : 'Obtenido'}</b>${esc(c.error || json(c.actual, lang))}</div>`}
      </div>`).join('');
  }

  function toast(msg) {
    const t = document.createElement('div');
    t.className = 'toast'; t.textContent = msg; document.body.appendChild(t);
    setTimeout(() => t.remove(), 2200);
  }

  const fmtTime = (ms) => {
    const s = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
    return (h ? h + ':' + String(m).padStart(2, '0') : String(m).padStart(2, '0')) + ':' + String(r).padStart(2, '0');
  };

  return { $, esc, md, json, LANG, signature, renderResults, toast, fmtTime };
})();
