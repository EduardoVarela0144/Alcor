(function () {
  const { $, $$, esc, md, json, LANG, renderResults, toast, fmtTime, fmtCountdown, signature, icon, LOGO, ago, hhmm,
    themeSwitch, localTz, zonedToUtc, utcToZonedInput, tzLabel, tzShort, fmtIn, tzOptions, modal, confirmBox } = UI;
  const CACHE_KEY = 'alcor:admin-cache';
  let challenges = [];
  let mailConfigured = false;
  const cands = new Map();
  let selected = null;       // candidato abierto
  let viewEx = null;         // ejercicio que se está viendo del candidato
  let follow = true;         // seguir el ejercicio que el candidato tiene abierto
  let viewingVersion = null; // versión que se está viendo (null = en vivo)
  let viewer = null;
  let detailCache = null;
  let filter = 'all';

  // ---------- estáticos ----------
  $$('.logo-slot').forEach((el) => { el.innerHTML = LOGO + 'Alcor'; });
  $$('.theme-slot').forEach((el) => { el.innerHTML = themeSwitch(); });
  $('#nav-cands').innerHTML = `${icon('users')} Candidatos <span class="count" id="count-cands"></span>`;
  $('#nav-new').innerHTML = `${icon('plus')} Nuevo candidato`;
  $('#nav-catalog').innerHTML = `${icon('book')} Catálogo <span class="count" id="count-cat"></span>`;
  $('#btn-export').innerHTML = `${icon('download')} Exportar`;
  $('#btn-logout').innerHTML = `${icon('logout')} Salir`;
  $('#btn-new-top').innerHTML = `${icon('plus')} Nuevo`;

  // ---------- estado de un candidato ----------
  const isLocked = (c) => c.status === 'pending' && c.locked && !c.activatedAt && !(c.opensAt && Date.now() >= c.opensAt);
  function statusOf(c) {
    if (isLocked(c)) return c.opensAt ? ['sched', 'Programado'] : ['ready', 'Preparado'];
    return { pending: ['', 'Sin iniciar'], in_progress: ['live', 'En curso'], submitted: ['done', 'Enviado'], expired: ['warn', 'Tiempo agotado'] }[c.status] || ['', c.status];
  }
  const statusHtml = (c) => { const [k, l] = statusOf(c); return `<span class="status ${k}">${l}</span>`; };
  const linkOf = (c) => `${location.origin}/c/${c.token}`;
  const chById = (id) => challenges.find((x) => x.id === id);
  const idsOf = (c) => c.challengeIds || (c.challengeId ? [c.challengeId] : []);
  const shortDate = (t, tz) => new Intl.DateTimeFormat('es-MX', { timeZone: tz || localTz(), weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(t);
  const isTyping = (c) => c.status === 'in_progress' && c.typingAt && Date.now() - c.typingAt < 3000;

  // ---------- respaldo local del admin ----------
  const cache = (() => { try { return JSON.parse(localStorage.getItem(CACHE_KEY)) || {}; } catch { return {}; } })();
  let cacheTimer = null;
  function remember(c) {
    cache[c.id] = { ...(cache[c.id] || {}), ...c };
    clearTimeout(cacheTimer);
    cacheTimer = setTimeout(() => { try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch { /* lleno */ } }, 500);
  }
  function forget(id) { delete cache[id]; try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch { /* */ } }

  async function api(path, opts = {}) {
    const r = await fetch(path, { ...opts, headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) } });
    if (r.status === 401) { showLogin(); throw new Error('401'); }
    const d = await r.json();
    if (!r.ok) { const e = new Error(d.error || 'Error'); e.data = d; e.status = r.status; throw e; }
    return d;
  }
  const fail = (err) => { if (err.message !== '401') toast(err.message); };

  // ---------- login ----------
  function showLogin() { $('#login').classList.remove('hidden'); $('#dash').classList.add('hidden'); }
  $('#login-form').onsubmit = async (e) => {
    e.preventDefault();
    $('#login-err').textContent = '';
    const r = await fetch('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: $('#pw').value }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { $('#login-err').textContent = d.error || 'Error'; return; }
    $('#pw').value = '';
    start();
  };
  $('#btn-logout').onclick = async () => { await fetch('/api/admin/logout', { method: 'POST' }); location.reload(); };

  // ---------- navegación ----------
  function go(view) {
    ['cands', 'new', 'catalog'].forEach((v) => {
      $('#view-' + v).classList.toggle('hidden', v !== view);
      $('#nav-' + v).classList.toggle('on', v === view);
    });
    if (view === 'new') renderNewForm();
    if (view === 'catalog') renderCatalogView();
  }
  $$('.nav-item').forEach((b) => b.onclick = () => go(b.dataset.view));
  document.addEventListener('click', (e) => { const b = e.target.closest('[data-goto]'); if (b) go(b.dataset.goto); });
  $$('#filter button').forEach((b) => b.onclick = () => { filter = b.dataset.f; $$('#filter button').forEach((x) => x.classList.toggle('on', x === b)); renderList(); });

  let started = false;
  async function start() {
    let me;
    try { me = await api('/api/admin/me'); } catch { return showLogin(); }
    mailConfigured = !!me.email;
    $('#login').classList.add('hidden'); $('#dash').classList.remove('hidden');
    if (started) return; started = true;
    challenges = await api('/api/admin/challenges');
    $('#count-cat').textContent = challenges.length;
    let list = await api('/api/admin/candidates');
    // Si el servidor se reinició y perdió candidatos, los re-subimos desde este navegador.
    const missing = Object.values(cache).filter((c) => {
      if (!c.token) return false;
      const srv = list.find((x) => x.id === c.id);
      return !srv || srv.recovered || (srv.rebuilt && c.status !== 'pending') || (srv.rebuilt && (c.email || c.locked !== srv.locked || c.opensAt !== srv.opensAt));
    });
    if (missing.length) {
      const { restored } = await api('/api/admin/restore', { method: 'POST', body: JSON.stringify({ candidates: missing }) });
      if (restored) { toast(`Se recuperaron ${restored} candidato(s) del respaldo local`); list = await api('/api/admin/candidates'); }
    }
    list.forEach((c) => { cands.set(c.id, c); remember(c); });
    renderList();
    renderEmptyDetail();
    connectStream();
    setInterval(() => { renderList(); if (selected) { renderStats(); renderHeadState(); } }, 1000);
  }

  // =====================================================================
  // Nuevo candidato
  // =====================================================================
  const form = { name: '', email: '', lang: 'python', theme: 'system', ids: [], minutes: null, activation: 'now', date: '', tz: localTz() };
  function renderNewForm(done) {
    const page = $('#new-page');
    if (done) return renderCreated(done);
    const groups = ['Fácil', 'Media', 'Difícil'];
    const segBtn = (key, v, label, ic) => `<button type="button" data-k="${key}" data-v="${v}" class="${form[key] === v ? 'on' : ''}">${ic ? icon(ic) : ''}${label}</button>`;
    page.innerHTML = `
      <h2>Nuevo candidato</h2>
      <p>Configura la evaluación, genera el link y compártelo por correo. Puedes dejarlo preparado y activarlo después.</p>
      <form id="new-form" autocomplete="off">
        <div class="card"><div class="card-h"><span class="n">1</span><h3>Candidato</h3></div><div class="card-b">
          <div class="grid2">
            <div><label for="f-name">Nombre</label><input id="f-name" placeholder="Ana López" maxlength="80" value="${esc(form.name)}" required></div>
            <div><label for="f-email">Correo <span class="faint" style="font-weight:400">(opcional)</span></label><input id="f-email" type="email" placeholder="ana@correo.com" value="${esc(form.email)}"></div>
          </div>
          <div class="grid2" style="margin-top:14px">
            <div><span class="label">Lenguaje</span><div class="seg full">${segBtn('lang', 'python', 'Python')}${segBtn('lang', 'javascript', 'JavaScript')}</div></div>
            <div><span class="label">Tema del editor del candidato</span><div class="seg full">${segBtn('theme', 'system', 'Sistema', 'monitor')}${segBtn('theme', 'light', 'Claro', 'sun')}${segBtn('theme', 'dark', 'Oscuro', 'moon')}</div>
            <div class="hint">El candidato puede cambiarlo cuando quiera.</div></div>
          </div>
        </div></div>

        <div class="card"><div class="card-h"><span class="n">2</span><h3>Ejercicios</h3><div class="spacer"></div><span class="faint" id="f-count"></span></div><div class="card-b">
          <div class="catalog" id="catalog">${groups.map((g) => {
            const items = challenges.filter((c) => c.difficulty === g);
            return `<div class="cat-group">${g}<span class="spacer"></span>${items.length}</div>` + items.map((c) => `
              <label class="cat-item" style="margin:0;font-weight:400"><input type="checkbox" value="${c.id}" ${form.ids.includes(c.id) ? 'checked' : ''}>
                <span class="t">${esc(c.title)}<small>${esc(c.topic || '')} · ${c.minutes} min · ${c.tests.length} casos</small></span>
                <button type="button" class="link" data-preview="${c.id}">Ver</button></label>`).join('');
          }).join('')}</div>
          <div class="grid2" style="margin-top:14px">
            <div><label for="f-min">Duración (minutos)</label><input id="f-min" type="number" min="5" max="240"><div class="hint">Se calcula con la suma sugerida; ajústala si quieres.</div></div>
          </div>
        </div></div>

        <div class="card"><div class="card-h"><span class="n">3</span><h3>Acceso</h3></div><div class="card-b">
          <div class="seg full">${segBtn('activation', 'now', 'Al instante', 'zap')}${segBtn('activation', 'manual', 'Preparado', 'lock')}${segBtn('activation', 'scheduled', 'Programado', 'calendar')}</div>
          <div class="hint" id="f-act-help"></div>
          <div id="f-sched" class="${form.activation === 'scheduled' ? '' : 'hidden'}">
            <div class="tz-row">
              <div><label for="f-date">Fecha y hora</label><input id="f-date" type="datetime-local" value="${esc(form.date)}"></div>
              <div><label for="f-tz">Zona horaria de esa hora</label><select id="f-tz">${tzOptions(form.tz)}</select></div>
            </div>
            <div class="tz-preview" id="f-tz-preview"></div>
          </div>
        </div>
        <div class="card-f"><span class="faint" style="font-size:12.5px" id="f-summary"></span><div class="spacer"></div>
          <button class="btn primary" id="f-submit"></button></div>
        </div>
      </form>`;

    const updateHelp = () => {
      $('#f-act-help').textContent = {
        now: 'El candidato puede empezar en cuanto abra el link.',
        manual: 'Comparte el link desde hoy. Verá “aún no inicia tu prueba” hasta que tú lo actives desde el panel.',
        scheduled: 'Se activa sola a la hora indicada. Cada candidato la ve convertida a su hora local.',
      }[form.activation];
      $('#f-submit').innerHTML = form.activation === 'now' ? `${icon('zap')} Generar link` : `${icon('lock')} Preparar link`;
      $('#f-sched').classList.toggle('hidden', form.activation !== 'scheduled');
      if (form.activation === 'scheduled' && !$('#f-date').value) {
        $('#f-date').value = form.date = utcToZonedInput(Date.now() + 864e5, form.tz).slice(0, 10) + 'T10:00'; // mañana 10:00
      }
      updateTzPreview();
    };
    const updateTzPreview = () => {
      const el = $('#f-tz-preview'); if (!el || form.activation !== 'scheduled') return;
      const v = $('#f-date').value; if (!v) { el.textContent = 'Elige fecha y hora.'; return; }
      const t = zonedToUtc(v, form.tz), mine = localTz();
      const rows = [
        `<b>${esc(fmtIn(t, form.tz))}</b> en ${esc(tzLabel(form.tz))} (${tzShort(t, form.tz)})`,
        mine !== form.tz ? `${esc(fmtIn(t, mine))} en tu hora (${esc(tzLabel(mine))})` : '',
        `${esc(fmtIn(t, 'UTC'))} UTC`,
        t <= Date.now() ? '<span style="color:var(--red)">Esa hora ya pasó.</span>' : `Se abre en ${fmtCountdown(t - Date.now())}.`,
      ].filter(Boolean);
      el.innerHTML = rows.join('<br>');
    };
    const updateSel = () => {
      form.ids = $$('#catalog input:checked').map((b) => b.value);
      $('#f-count').textContent = form.ids.length ? `${form.ids.length} seleccionado(s)` : 'Elige uno o varios (máx. 6)';
      const sum = form.ids.reduce((s, id) => s + chById(id).minutes, 0);
      if (!form.minutesTouched) $('#f-min').value = sum || 20;
      $('#f-summary').textContent = form.ids.length ? `${form.ids.length} ejercicio(s) · ${$('#f-min').value} min · ${LANG[form.lang]}` : '';
    };
    $$('#new-form .seg button').forEach((b) => b.onclick = () => {
      form[b.dataset.k] = b.dataset.v;
      $$(`#new-form .seg button[data-k="${b.dataset.k}"]`).forEach((x) => x.classList.toggle('on', x === b));
      updateHelp(); updateSel();
    });
    $$('#catalog input').forEach((box) => box.onchange = () => {
      if ($$('#catalog input:checked').length > 6) { box.checked = false; toast('Máximo 6 ejercicios por candidato'); }
      updateSel();
    });
    $$('[data-preview]').forEach((b) => b.onclick = (e) => { e.preventDefault(); previewModal(b.dataset.preview); });
    $('#f-min').oninput = () => { form.minutesTouched = true; updateSel(); };
    $('#f-name').oninput = (e) => { form.name = e.target.value; };
    $('#f-email').oninput = (e) => { form.email = e.target.value; };
    $('#f-date').oninput = (e) => { form.date = e.target.value; updateTzPreview(); };
    $('#f-tz').onchange = (e) => { form.tz = e.target.value; updateTzPreview(); };
    if (form.minutes) $('#f-min').value = form.minutes;
    updateHelp(); updateSel();

    $('#new-form').onsubmit = async (e) => {
      e.preventDefault();
      if (!form.ids.length) return toast('Selecciona al menos un ejercicio');
      let opensAt;
      if (form.activation === 'scheduled') {
        if (!$('#f-date').value) return toast('Elige fecha y hora');
        opensAt = zonedToUtc($('#f-date').value, form.tz);
        if (opensAt <= Date.now()) return toast('La fecha debe ser en el futuro');
      }
      try {
        const c = await api('/api/admin/candidates', { method: 'POST', body: JSON.stringify({
          name: $('#f-name').value, email: $('#f-email').value.trim() || undefined, lang: form.lang, theme: form.theme,
          challenges: form.ids, minutes: $('#f-min').value, activation: form.activation, opensAt, tz: form.tz,
        }) });
        cands.set(c.id, c); remember(c); renderList();
        Object.assign(form, { name: '', email: '', date: '', minutesTouched: false });
        renderCreated(c);
      } catch (err) { fail(err); }
    };
  }

  function renderCreated(c) {
    const [, label] = statusOf(c);
    $('#new-page').innerHTML = `
      <div class="card"><div class="card-b" style="padding:24px">
        <div class="success-ico">${icon('check')}</div>
        <h2 style="font-size:20px;margin:14px 0 4px">Link listo para ${esc(c.name)}</h2>
        <p class="muted" style="margin:0 0 18px">${esc(label)}${c.opensAt ? ` · se abre ${esc(shortDate(c.opensAt, c.tz))} (${esc(tzLabel(c.tz))})` : ''} · ${idsOf(c).length} ejercicio(s) · ${c.minutes} min</p>
        <label>Link de acceso</label>
        <div class="share"><input readonly value="${esc(linkOf(c))}" id="new-url"><button class="btn" id="cp">${icon('copy')} Copiar</button></div>
        <div style="display:flex;gap:8px;margin-top:16px;flex-wrap:wrap">
          <button class="btn primary" id="em">${icon('mail')} Enviar por correo</button>
          <button class="btn" id="vw">${icon('eye')} Ver candidato</button>
          <div class="spacer"></div>
          <button class="btn ghost" id="again">${icon('plus')} Crear otro</button>
        </div>
      </div></div>`;
    $('#cp').onclick = () => { navigator.clipboard.writeText(linkOf(c)); toast('Link copiado'); };
    $('#em').onclick = () => emailModal(c.id);
    $('#vw').onclick = () => { go('cands'); select(c.id); };
    $('#again').onclick = () => renderNewForm();
  }

  // =====================================================================
  // Catálogo
  // =====================================================================
  function previewHtml(c, lang) {
    const rows = c.tests.map((t, i) => `<tr><td style="width:56px">${i + 1}${t.hidden ? ' <span class="tag">oculto</span>' : ''}</td><td>${esc(signature(lang, c.fn[lang], t.args))}</td><td>${esc(json(t.expected, lang))}</td></tr>`).join('');
    return `
      <div style="display:flex;gap:6px;flex-wrap:wrap"><span class="tag">${esc(c.difficulty)}</span><span class="tag">${esc(c.topic || '')}</span><span class="tag">${c.minutes} min sugeridos</span></div>
      <h2>${esc(c.title)}</h2>
      <div class="section-title">Instrucciones (lo que verá el candidato)</div>
      <p class="desc">${md(c.description)}</p>
      <div class="section-title">Código inicial</div>
      <div class="grid2"><div><span class="label faint">Python</span><pre class="code">${esc(c.starter.python)}</pre></div><div><span class="label faint">JavaScript</span><pre class="code">${esc(c.starter.javascript)}</pre></div></div>
      <div class="section-title">Casos de prueba · ${c.tests.filter((t) => !t.hidden).length} visibles, ${c.tests.filter((t) => t.hidden).length} ocultos (${LANG[lang]})</div>
      <table class="tbl"><thead><tr><th>#</th><th>Entrada</th><th>Esperado</th></tr></thead><tbody>${rows}</tbody></table>
      <p class="faint" style="font-size:12px;margin-top:8px">Los casos ocultos solo los ves tú; el candidato ve únicamente los visibles.</p>`;
  }
  function previewModal(id) {
    const c = chById(id);
    const inForm = () => form.ids.includes(id);
    const m = modal({ title: 'Vista previa', body: `<div class="preview">${previewHtml(c, form.lang)}</div>`,
      footer: `<div class="spacer"></div><button class="btn" data-no>Cerrar</button><button class="btn primary" id="pv-add">${inForm() ? 'Quitar de la evaluación' : 'Agregar a la evaluación'}</button>` });
    m.el.querySelector('[data-no]').onclick = m.close;
    $('#pv-add').onclick = () => {
      const box = $(`#catalog input[value="${id}"]`);
      if (!box.checked && form.ids.length >= 6) return toast('Máximo 6 ejercicios por candidato');
      box.checked = !box.checked; box.onchange(); m.close();
    };
  }
  let catSel = null, catLang = 'python';
  function renderCatalogView() {
    $('#cat-count').textContent = `${challenges.length} ejercicios`;
    const groups = ['Fácil', 'Media', 'Difícil'];
    $('#cat-list').innerHTML = groups.map((g) => `<div class="cat-group">${g}</div>` + challenges.filter((c) => c.difficulty === g).map((c) => `
      <div class="row ${catSel === c.id ? 'on' : ''}" data-id="${c.id}"><div class="l1"><span class="name">${esc(c.title)}</span><span class="faint mono" style="font-size:12px">${c.minutes} min</span></div>
      <div class="l2">${esc(c.topic || '')}<span class="dot-sep">${c.tests.length} casos</span></div></div>`).join('')).join('');
    $$('#cat-list .row').forEach((r) => r.onclick = () => { catSel = r.dataset.id; renderCatalogView(); });
    const c = chById(catSel);
    $('#cat-detail').innerHTML = c ? `<div class="preview">
        <div class="seg" style="float:right">${['python', 'javascript'].map((l) => `<button data-l="${l}" class="${catLang === l ? 'on' : ''}">${LANG[l]}</button>`).join('')}</div>
        ${previewHtml(c, catLang)}
        <button class="btn primary" style="margin-top:16px" id="cat-use">${icon('plus')} Usar en un candidato nuevo</button></div>`
      : `<div class="empty-state"><div class="ico">${icon('book')}</div><h3>Catálogo</h3>Elige un ejercicio para ver sus instrucciones, el código inicial y todos sus casos de prueba.</div>`;
    $$('#cat-detail .seg button').forEach((b) => b.onclick = () => { catLang = b.dataset.l; renderCatalogView(); });
    if (c) $('#cat-use').onclick = () => { if (!form.ids.includes(c.id) && form.ids.length < 6) form.ids.push(c.id); form.lang = catLang; go('new'); };
  }

  // =====================================================================
  // Lista de candidatos
  // =====================================================================
  const matches = (c) => filter === 'all' || (filter === 'ready' && (isLocked(c) || c.status === 'pending'))
    || (filter === 'live' && c.status === 'in_progress') || (filter === 'done' && ['submitted', 'expired'].includes(c.status));
  function renderList() {
    const all = [...cands.values()].sort((a, b) => b.createdAt - a.createdAt);
    $('#count-cands').textContent = all.length || '';
    const list = all.filter(matches);
    const html = list.length ? list.map((c) => {
      const ids = idsOf(c), res = c.results || {};
      const passed = ids.reduce((s, id) => s + (res[id] ? res[id].passed : 0), 0);
      const total = ids.reduce((s, id) => s + (res[id] ? res[id].total : 0), 0);
      const label = ids.length === 1 ? (chById(ids[0]) || {}).title : `${ids.length} ejercicios`;
      const extra = isTyping(c) ? '<span class="typing">escribiendo</span>'
        : isLocked(c) && c.opensAt ? `<span>abre ${esc(shortDate(c.opensAt))}</span>`
        : c.status === 'in_progress' && c.startedAt ? `<span class="mono">${fmtTime(c.startedAt + c.minutes * 60000 - Date.now())}</span>`
        : total ? `<span class="mono">${passed}/${total}</span>` : `<span>${ago(c.createdAt)}</span>`;
      return `<div class="row ${c.id === selected ? 'on' : ''}" data-id="${c.id}">
        <div class="l1"><span class="name">${esc(c.name)}</span>${statusHtml(c)}</div>
        <div class="l2"><span>${esc(label || '')}</span><span class="dot-sep">${LANG[c.lang]}</span><span class="dot-sep"></span>${extra}</div></div>`;
    }).join('') : `<div class="empty">${all.length ? 'Nada en este filtro.' : 'Aún no hay candidatos.'}</div>`;
    if ($('#cand-list').dataset.html !== html) { $('#cand-list').dataset.html = html; $('#cand-list').innerHTML = html; $$('#cand-list .row').forEach((el) => el.onclick = () => select(el.dataset.id)); }
    const lockedN = all.filter(isLocked).length;
    const bulk = $('#btn-activate-all');
    bulk.classList.toggle('hidden', !lockedN);
    bulk.innerHTML = `${icon('unlock')} Activar ${lockedN === 1 ? '1 preparado' : `${lockedN} preparados`}`;
  }
  $('#btn-activate-all').onclick = async () => {
    const n = [...cands.values()].filter(isLocked).length;
    if (!await confirmBox(`¿Activar ${n} link(s)?`, 'Los candidatos con links preparados o programados podrán empezar en cuanto los abran.', 'Activar')) return;
    try { const { activated } = await api('/api/admin/activate-all', { method: 'POST' }); toast(`${activated} link(s) activados`); } catch (e) { fail(e); }
  };

  function renderEmptyDetail() {
    $('#detail').innerHTML = `<div class="empty-state"><div class="ico">${icon('users')}</div><h3>Ningún candidato seleccionado</h3>
      Elige uno de la lista para ver su código en tiempo real, o crea uno nuevo.<div style="margin-top:16px"><button class="btn primary" data-goto="new">${icon('plus')} Nuevo candidato</button></div></div>`;
  }

  // =====================================================================
  // Detalle del candidato
  // =====================================================================
  async function select(id) {
    selected = id; follow = true; viewingVersion = null;
    renderList();
    try { detailCache = await api('/api/admin/candidates/' + id); } catch (e) { return fail(e); }
    remember(detailCache);
    viewEx = detailCache.active || idsOf(detailCache)[0];
    renderDetail();
  }

  function renderDetail() {
    const c = detailCache;
    $('#detail').innerHTML = `
      <div class="d-head">
        <div class="t"><h2>${esc(c.name)}</h2><span id="d-status"></span><span id="d-typing"></span></div>
        <div class="meta">${LANG[c.lang]}<span class="dot-sep">${c.minutes} min</span><span class="dot-sep">${idsOf(c).length} ejercicio(s)</span>${c.email ? `<span class="dot-sep">${esc(c.email)}</span>` : ''}</div>
        <div class="d-actions" id="d-actions"></div>
      </div>
      <div id="d-notice"></div>
      <div class="kv" id="d-stats"></div>
      <div class="pills" id="d-pills"></div>
      <div class="d-body">
        <div class="d-code">
          <div class="subbar">
            <b style="font-weight:500" id="d-extitle"></b>
            <label style="margin:0 0 0 6px;display:flex;gap:6px;align-items:center;font-weight:400;color:var(--muted)"><input type="checkbox" id="d-follow" ${follow ? 'checked' : ''}> Seguir al candidato</label>
            <div class="spacer"></div>
            <button class="btn sm" id="d-run">${icon('play')} Correr todos los tests</button>
          </div>
          <div id="d-banner"></div>
          <div class="editor-wrap" style="min-height:320px"><textarea id="d-code"></textarea></div>
          <div class="results" style="height:auto;max-height:320px">
            <div class="tabs"><button class="tab on">Resultados (incluye casos ocultos)</button><span class="summary" id="d-summary"></span></div>
            <div class="results-body" id="d-results"></div>
          </div>
        </div>
        <div class="d-side">
          <div class="section-title">Instrucciones</div>
          <p id="d-desc" style="margin:0;line-height:1.6"></p>
          <div class="section-title">${icon('history').replace('<svg', '<svg style="width:13px;height:13px"')} Versiones del candidato</div>
          <div class="vlist" id="d-versions"></div>
          <div class="section-title">Actividad</div>
          <ul class="timeline" id="d-timeline"></ul>
        </div>
      </div>`;
    viewer = CodeMirror.fromTextArea($('#d-code'), { mode: c.lang === 'python' ? 'python' : 'javascript', lineNumbers: true, readOnly: true });
    $('#d-follow').onchange = (e) => { follow = e.target.checked; if (follow && c.active) showExercise(c.active); };
    $('#d-run').onclick = runHidden;
    renderHeadState(); showExercise(viewEx); renderStats(); renderTimeline();
  }

  // Botones y aviso que dependen del estado (se recalcula cada segundo por si llega la hora programada)
  function renderHeadState() {
    const c = detailCache; if (!c || !$('#d-actions')) return;
    $('#d-status').innerHTML = statusHtml(c);
    $('#d-typing').innerHTML = isTyping(c) ? '<span class="typing">escribiendo…</span>' : '';
    const pending = c.status === 'pending';
    const locked = isLocked(c);
    const acts = [
      pending && locked ? `<button class="btn sm primary" data-a="unlock">${icon('unlock')} Activar ahora</button>` : '',
      pending && !locked ? `<button class="btn sm" data-a="lock">${icon('lock')} Bloquear</button>` : '',
      pending ? `<button class="btn sm" data-a="schedule">${icon('calendar')} ${c.opensAt && locked ? 'Cambiar fecha' : 'Programar'}</button>` : '',
      `<button class="btn sm" data-a="email">${icon('mail')} Enviar correo</button>`,
      `<button class="btn sm" data-a="copy">${icon('copy')} Copiar link</button>`,
      '<div class="spacer"></div>',
      `<button class="btn sm ghost danger" data-a="revoke">${icon('trash')} Revocar</button>`,
    ].join('');
    let notice = '';
    if (locked && c.opensAt) notice = `${icon('calendar')}<span>Se abre el <b style="font-weight:500">${esc(fmtIn(c.opensAt, c.tz))}</b> (${esc(tzLabel(c.tz))})${c.tz !== localTz() ? ` · ${esc(shortDate(c.opensAt))} en tu hora` : ''}</span><span class="spacer"></span><span class="faint mono">en ${fmtCountdown(c.opensAt - Date.now())}</span>`;
    else if (locked) notice = `${icon('lock')}<span>Link bloqueado: si el candidato lo abre verá “aún no inicia tu prueba”.</span>`;
    else if (pending) notice = `${icon('unlock')}<span>Link activo: el candidato puede empezar cuando lo abra.</span>`;
    const key = acts + notice;
    if ($('#d-actions').dataset.key === key) return;
    $('#d-actions').dataset.key = key;
    $('#d-actions').innerHTML = acts;
    $('#d-notice').innerHTML = notice ? `<div class="notice">${notice.replace(/<svg /g, '<svg style="width:15px;height:15px;color:var(--muted)" ')}</div>` : '';
    $$('#d-actions [data-a]').forEach((b) => b.onclick = () => action(b.dataset.a));
  }

  async function action(a) {
    const c = detailCache;
    try {
      if (a === 'unlock') { await api(`/api/admin/candidates/${c.id}/activate`, { method: 'POST' }); toast('Link activado'); }
      if (a === 'lock') { await api(`/api/admin/candidates/${c.id}/deactivate`, { method: 'POST' }); toast('Link bloqueado'); }
      if (a === 'schedule') scheduleModal(c);
      if (a === 'email') emailModal(c.id);
      if (a === 'copy') { await navigator.clipboard.writeText(linkOf(c)); toast('Link copiado'); }
      if (a === 'revoke') {
        if (!await confirmBox(`¿Revocar a ${esc(c.name)}?`, 'Se borra su información y el link deja de funcionar. Esta acción no se puede deshacer.', 'Revocar', true)) return;
        await api('/api/admin/candidates/' + c.id, { method: 'DELETE' });
      }
    } catch (e) { fail(e); }
  }

  function scheduleModal(c) {
    let tz = c.tz && c.tz !== 'UTC' ? c.tz : localTz();
    const start = c.opensAt && c.opensAt > Date.now() ? c.opensAt : zonedToUtc(utcToZonedInput(Date.now() + 864e5, tz).slice(0, 10) + 'T10:00', tz);
    const m = modal({ title: 'Programar activación', size: 'sm', body: `<div style="padding:16px 18px">
        <label for="s-date">Fecha y hora</label><input id="s-date" type="datetime-local" value="${utcToZonedInput(start, tz)}">
        <label for="s-tz" style="margin-top:12px">Zona horaria de esa hora</label><select id="s-tz">${tzOptions(tz)}</select>
        <div class="tz-preview" id="s-prev"></div></div>`,
      footer: `${c.opensAt ? '<button class="btn ghost" id="s-clear">Quitar fecha</button>' : ''}<div class="spacer"></div><button class="btn" data-no>Cancelar</button><button class="btn primary" id="s-save">${icon('calendar')} Programar</button>` });
    const prev = () => {
      const v = $('#s-date').value; if (!v) return;
      const t = zonedToUtc(v, tz), mine = localTz();
      $('#s-prev').innerHTML = [`<b>${esc(fmtIn(t, tz))}</b> en ${esc(tzLabel(tz))}`, mine !== tz ? `${esc(fmtIn(t, mine))} en tu hora` : '', `${esc(fmtIn(t, 'UTC'))} UTC`,
        t <= Date.now() ? '<span style="color:var(--red)">Esa hora ya pasó.</span>' : 'El link queda bloqueado hasta esa hora.'].filter(Boolean).join('<br>');
    };
    $('#s-date').oninput = prev; $('#s-tz').onchange = (e) => { tz = e.target.value; prev(); }; prev();
    m.el.querySelector('[data-no]').onclick = m.close;
    $('#s-save').onclick = async () => {
      try { await api(`/api/admin/candidates/${c.id}/schedule`, { method: 'POST', body: JSON.stringify({ opensAt: zonedToUtc($('#s-date').value, tz), tz }) }); m.close(); toast('Activación programada'); }
      catch (e) { fail(e); }
    };
    if ($('#s-clear')) $('#s-clear').onclick = async () => {
      try { await api(`/api/admin/candidates/${c.id}/schedule`, { method: 'POST', body: JSON.stringify({ opensAt: null }) }); m.close(); toast('Fecha quitada: el link queda bloqueado'); }
      catch (e) { fail(e); }
    };
  }

  async function emailModal(id) {
    const c = cands.get(id) || detailCache;
    let msg;
    try { msg = await api(`/api/admin/candidates/${id}/email`, { method: 'POST', body: JSON.stringify({ link: linkOf(c) }) }); } catch (e) { return fail(e); }
    const m = modal({ title: 'Enviar link por correo', size: '', body: `<div style="padding:16px 18px;max-width:640px">
        <label for="e-to">Para</label><input id="e-to" type="email" placeholder="correo@candidato.com" value="${esc(msg.to || '')}">
        <label for="e-sub" style="margin-top:12px">Asunto</label><input id="e-sub" value="${esc(msg.subject)}">
        <label for="e-body" style="margin-top:12px">Mensaje</label><textarea id="e-body" rows="13" style="font:12.5px/1.6 var(--mono)">${esc(msg.text)}</textarea>
        <div class="hint">${mailConfigured ? 'Se enviará desde el servidor de Alcor.' : 'Se abrirá tu aplicación de correo con el mensaje listo. Para enviar directo desde Alcor, configura RESEND_API_KEY en Render.'}</div></div>`,
      footer: `<button class="btn" id="e-copy">${icon('copy')} Copiar mensaje</button><div class="spacer"></div><button class="btn" data-no>Cancelar</button>
        ${mailConfigured ? `<button class="btn" id="e-mailto">${icon('mail')} Abrir en mi correo</button><button class="btn primary" id="e-send">${icon('send')} Enviar</button>` : `<button class="btn primary" id="e-mailto">${icon('mail')} Abrir en mi correo</button>`}` });
    m.el.querySelector('[data-no]').onclick = m.close;
    const saveTo = async () => {
      const to = $('#e-to').value.trim();
      if (to && to !== msg.to) await api(`/api/admin/candidates/${id}/email`, { method: 'POST', body: JSON.stringify({ to, link: linkOf(c) }) });
      return to;
    };
    $('#e-copy').onclick = () => { navigator.clipboard.writeText(`${$('#e-sub').value}\n\n${$('#e-body').value}`); toast('Mensaje copiado'); };
    $('#e-mailto').onclick = async () => {
      try {
        const to = await saveTo();
        location.href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent($('#e-sub').value)}&body=${encodeURIComponent($('#e-body').value)}`;
        m.close();
      } catch (e) { fail(e); }
    };
    if ($('#e-send')) $('#e-send').onclick = async () => {
      try {
        const to = await saveTo(); if (!to) return toast('Escribe el correo del candidato');
        $('#e-send').disabled = true;
        await api(`/api/admin/candidates/${id}/email`, { method: 'POST', body: JSON.stringify({ send: true, link: linkOf(c) }) });
        m.close(); toast(`Correo enviado a ${to}`);
      } catch (e) { $('#e-send').disabled = false; fail(e); }
    };
  }

  function renderPills() {
    const c = detailCache; if (!c || !$('#d-pills')) return;
    const ids = idsOf(c);
    $('#d-pills').classList.toggle('hidden', ids.length < 2);
    $('#d-pills').innerHTML = ids.map((id, i) => {
      const r = (c.results || {})[id];
      const here = c.active === id && c.status === 'in_progress';
      return `<button class="pill ${id === viewEx ? 'on' : ''}" data-id="${id}">${i + 1}. ${esc(chById(id).title)}${r ? ` <span class="r">${r.passed}/${r.total}</span>` : ''}${here ? ' <span class="status live" title="El candidato está aquí"></span>' : ''}</button>`;
    }).join('');
    $$('#d-pills .pill').forEach((b) => b.onclick = () => { follow = false; $('#d-follow').checked = false; showExercise(b.dataset.id); });
  }

  function currentCode() {
    const c = detailCache, ch = chById(viewEx);
    if (viewingVersion) return viewingVersion.code;
    return c.code && typeof c.code[viewEx] === 'string' ? c.code[viewEx] : (c.status === 'pending' ? '' : ch.starter[c.lang]);
  }
  function showExercise(id) {
    viewEx = id; viewingVersion = null;
    const ch = chById(id);
    $('#d-extitle').textContent = ch.title;
    $('#d-desc').innerHTML = md(ch.description);
    setViewer();
    $('#d-results').innerHTML = '<div class="empty">Corre los tests para validar el código del candidato con todos los casos, incluidos los ocultos.</div>';
    $('#d-summary').innerHTML = '';
    renderPills(); renderVersions();
  }
  function setViewer() {
    const c = detailCache;
    const code = currentCode() || (c.lang === 'python' ? '# El candidato aún no inicia' : '// El candidato aún no inicia');
    if (viewer.getValue() !== code) { const s = viewer.getScrollInfo(); viewer.setValue(code); viewer.scrollTo(s.left, s.top); }
    $('#d-banner').innerHTML = viewingVersion
      ? `<div class="viewing-banner">${icon('history').replace('<svg', '<svg style="width:14px;height:14px"')}<span>Viendo versión “${esc(viewingVersion.label || 'sin nombre')}” · ${hhmm(viewingVersion.t)}</span><span class="spacer"></span><button class="btn sm" id="d-live">Volver a en vivo</button></div>` : '';
    if (viewingVersion) $('#d-live').onclick = () => { viewingVersion = null; setViewer(); renderVersions(); };
  }
  function renderVersions() {
    const c = detailCache; if (!$('#d-versions')) return;
    const list = ((c.versions || {})[viewEx] || []).slice().reverse();
    $('#d-versions').innerHTML = list.length ? list.map((v) => `<button class="vitem ${viewingVersion && viewingVersion.id === v.id ? 'on' : ''}" data-id="${v.id}">${icon(v.auto ? 'play' : 'save')}<span class="lab">${esc(v.label || 'Sin nombre')}</span><span class="when">${hhmm(v.t)}</span></button>`).join('')
      : '<div class="faint" style="font-size:12.5px">Aún no guarda versiones de este ejercicio.</div>';
    $$('#d-versions .vitem').forEach((b) => b.onclick = () => { follow = false; $('#d-follow').checked = false; viewingVersion = list.find((v) => v.id === b.dataset.id); setViewer(); renderVersions(); });
  }

  async function runHidden() {
    const c = detailCache, ch = chById(viewEx);
    const btn = $('#d-run'); btn.disabled = true; btn.textContent = 'Ejecutando…';
    try {
      const res = await AlcorRunner.run(c.lang, viewer.getValue(), ch.fn[c.lang], ch.tests);
      renderResults($('#d-results'), res, c.lang, ch.fn[c.lang]);
      if (res.stdout) $('#d-results').insertAdjacentHTML('beforeend', `<div class="section-title">Salida</div><pre class="console">${esc(res.stdout)}</pre>`);
      $('#d-summary').innerHTML = `<span class="tag ${res.passed === res.total ? 'ok' : 'bad'}">${res.passed}/${res.total} tests</span>`;
    } finally { btn.disabled = false; btn.innerHTML = `${icon('play')} Correr todos los tests`; }
  }

  function renderStats() {
    const c = detailCache; if (!c || !$('#d-stats')) return;
    const elapsed = c.startedAt ? (c.submittedAt || Date.now()) - c.startedAt : 0;
    const ids = idsOf(c), res = c.results || {};
    const passed = ids.reduce((s, id) => s + (res[id] ? res[id].passed : 0), 0);
    const total = ids.reduce((s, id) => s + (res[id] ? res[id].total : 0), 0);
    const left = c.startedAt && c.status === 'in_progress' ? c.startedAt + c.minutes * 60000 - Date.now() : null;
    const stat = (k, v) => `<div><div class="k">${k}</div><div class="v">${v}</div></div>`;
    $('#d-stats').innerHTML =
      stat('Tests del candidato', total ? `${passed}/${total}` : '—') +
      stat(left != null ? 'Tiempo restante' : 'Tiempo usado', left != null ? fmtTime(left) : c.startedAt ? fmtTime(elapsed) : '—') +
      stat('Ejecuciones', c.runs || 0) +
      stat('Pegados', c.pastes || 0) +
      stat('Cambios de pestaña', c.blurs || 0);
  }

  const EV = { activated: 'Link activado', deactivated: 'Link bloqueado', scheduled: 'Activación programada', emailed: 'Correo enviado', start: 'Inició la evaluación',
    run: 'Corrió tests', paste: 'Pegó texto', blur: 'Salió de la pestaña', focus: 'Regresó a la pestaña', submit: 'Envió su solución', expired: 'Se agotó el tiempo',
    reset: 'Reinició el código', restored: 'Sesión recuperada', version: 'Guardó versión', restore: 'Restauró versión' };
  function renderTimeline() {
    const c = detailCache; if (!c || !$('#d-timeline')) return;
    const items = (c.timeline || []).slice(-200).reverse();
    $('#d-timeline').innerHTML = items.length ? items.map((e) => `<li><time>${hhmm(e.t)}</time><span>${EV[e.type] || esc(e.type)}${e.exercise && idsOf(c).length > 1 ? ` <span class="faint">· ${esc((chById(e.exercise) || {}).title || '')}</span>` : ''}${e.type === 'run' && e.total != null ? ` <span class="mono">${e.passed}/${e.total}</span>` : ''}${e.detail ? ` <span class="muted">· ${esc(e.detail)}</span>` : ''}</span></li>`).join('') : '<li class="faint" style="display:block">Sin actividad todavía.</li>';
  }

  // =====================================================================
  // Tiempo real
  // =====================================================================
  function connectStream() {
    const es = new EventSource('/api/admin/stream');
    const st = $('#stream-status');
    es.onopen = () => { st.className = 'status live'; st.textContent = 'En tiempo real'; };
    es.onerror = () => { st.className = 'status warn'; st.textContent = 'Reconectando…'; };
    es.onmessage = async (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === 'deleted') {
        cands.delete(msg.id); forget(msg.id);
        if (selected === msg.id) { selected = null; detailCache = null; renderEmptyDetail(); }
        return renderList();
      }
      const c = msg.candidate;
      const prev = cands.get(c.id) || {};
      const merged = { ...prev, ...c, token: prev.token || c.token };
      cands.set(c.id, merged);
      remember({ ...merged, timeline: (cache[c.id] || {}).timeline, versions: (cache[c.id] || {}).versions });
      renderList();
      if (selected === c.id && detailCache) {
        const timelineChanged = c.events !== (detailCache.timeline || []).length;
        const versionsChanged = c.versionCount !== Object.values(detailCache.versions || {}).reduce((n, v) => n + v.length, 0);
        Object.assign(detailCache, c, { timeline: detailCache.timeline, versions: detailCache.versions });
        if (follow && c.active && c.active !== viewEx) showExercise(c.active);
        else if (!viewingVersion) setViewer();
        renderPills(); renderStats(); renderHeadState();
        if (timelineChanged || versionsChanged) {
          const d = await api('/api/admin/candidates/' + c.id);
          detailCache.timeline = d.timeline; detailCache.versions = d.versions; remember(d);
          renderTimeline(); renderVersions();
        }
      }
    };
  }

  start();
})();
