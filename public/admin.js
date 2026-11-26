(function () {
  const { t, loc, exText, diff, starter, langSwitch, $, $$, esc, md, json, LANG, renderResults, toast, fmtTime, fmtCountdown, signature, icon, LOGO, ago, hhmm,
    themeSwitch, themeOptions, onThemeChange, localTz, zonedToUtc, utcToZonedInput, tzLabel, tzShort, fmtIn, tzOptions, modal, confirmBox } = UI;
  const CACHE_KEY = 'alcor:admin-cache';
  onThemeChange(() => { if (viewer) viewer.refresh(); }); // re-medir el editor si cambia el tamaño del código
  let challenges = [];
  let mailConfigured = false;
  const cands = new Map();
  let selected = null;       // candidato abierto
  let viewEx = null;         // ejercicio que se está viendo del candidato
  let follow = true;         // seguir el ejercicio que el candidato tiene abierto
  let viewingVersion = null; // versión que se está viendo (null = en vivo)
  let viewer = null;
  let boardView = null;      // pizarrón de solo lectura (system design)
  let detailCache = null;
  let filter = 'all';

  // ---------- estáticos ----------
  I18N.apply();
  $$('.logo-slot').forEach((el) => { el.innerHTML = LOGO + 'Alcor'; });
  $$('.theme-slot').forEach((el) => { el.innerHTML = themeSwitch() + langSwitch(); });
  $('#nav-cands').innerHTML = `${icon('users')} ${t('a.nav.cands')} <span class="count" id="count-cands"></span>`;
  $('#nav-new').innerHTML = `${icon('plus')} ${t('a.nav.new')}`;
  $('#nav-catalog').innerHTML = `${icon('book')} ${t('a.nav.catalog')} <span class="count" id="count-cat"></span>`;
  $('#nav-notices').innerHTML = `${icon('bell')} ${t('a.nav.notices')} <span class="badge hidden" id="count-notices"></span>`;
  $('#btn-export').innerHTML = `${icon('download')} ${t('a.export')}`;
  $('#btn-logout').innerHTML = `${icon('logout')} ${t('a.logout')}`;
  $('#btn-new-top').innerHTML = `${icon('plus')} ${t('a.new')}`;

  // ---------- estado de un candidato ----------
  const isLocked = (c) => c.status === 'pending' && c.locked && !c.activatedAt && !(c.opensAt && Date.now() >= c.opensAt);
  function statusOf(c) {
    if (isLocked(c)) return c.opensAt ? ['sched', t('st.sched')] : ['ready', t('st.ready')];
    return { pending: ['', t('st.pending')], in_progress: ['live', t('st.live')], submitted: ['done', t('st.done')], expired: ['warn', t('st.expired')] }[c.status] || ['', c.status];
  }
  const statusHtml = (c) => { const [k, l] = statusOf(c); return `<span class="status ${k}">${l}</span>`; };
  const linkOf = (c) => `${location.origin}/c/${c.token}`;
  const chById = (id) => challenges.find((x) => x.id === id);
  const title = (id) => { const c = chById(id); return c ? exText(c, 'title') : id; };
  const idsOf = (c) => c.challengeIds || (c.challengeId ? [c.challengeId] : []);
  const shortDate = (ms, tz) => new Intl.DateTimeFormat(loc(), { timeZone: tz || localTz(), weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(ms);
  const isTyping = (c) => c.status === 'in_progress' && c.typingAt && Date.now() - c.typingAt < 3000;
  const deadlineOf = (c) => c.deadlineAt || (c.startedAt ? c.startedAt + c.minutes * 60000 : 0);
  const UI_LANG_NAME = { es: 'Español', en: 'English' };

  // ---------- respaldo local del admin ----------
  const cache = (() => { try { return JSON.parse(localStorage.getItem(CACHE_KEY)) || {}; } catch { return {}; } })();
  let cacheTimer = null;
  function remember(c) {
    cache[c.id] = { ...(cache[c.id] || {}), ...c };
    clearTimeout(cacheTimer);
    cacheTimer = setTimeout(() => { try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch { /* lleno */ } }, 500);
  }
  function forget(id) { delete cache[id]; try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch { /* */ } }

  // Todas las peticiones mandan el idioma para que los errores lleguen traducidos.
  const HEADERS = { 'Content-Type': 'application/json', 'X-Lang': I18N.lang() };
  async function api(path, opts = {}) {
    const r = await fetch(path, { ...opts, headers: { ...HEADERS, ...(opts.headers || {}) } });
    if (r.status === 401) { showLogin(); throw new Error('401'); }
    const d = await r.json();
    if (!r.ok) { const e = new Error(d.error || t('error')); e.data = d; e.status = r.status; throw e; }
    return d;
  }
  const fail = (err) => { if (err.message !== '401') toast(err.message); };

  // ---------- login ----------
  function showLogin() { $('#login').classList.remove('hidden'); $('#dash').classList.add('hidden'); }
  $('#login-form').onsubmit = async (e) => {
    e.preventDefault();
    $('#login-err').textContent = '';
    const r = await fetch('/api/admin/login', { method: 'POST', headers: HEADERS, body: JSON.stringify({ password: $('#pw').value }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { $('#login-err').textContent = d.error || t('error'); return; }
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
  $$('.nav-item[data-view]').forEach((b) => b.onclick = () => go(b.dataset.view));
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
      if (restored) { toast(t('a.restored', { n: restored })); list = await api('/api/admin/candidates'); }
    }
    list.forEach((c) => { cands.set(c.id, c); remember(c); });
    renderList();
    renderEmptyDetail();
    loadNotices();
    connectStream();
    setInterval(() => { renderList(); if (selected) { renderStats(); renderHeadState(); } }, 1000);
  }

  // =====================================================================
  // Nuevo candidato
  // =====================================================================
  const form = { name: '', email: '', type: 'coding', lang: 'python', theme: 'system', ui: I18N.lang(), ids: [], minutes: null, activation: 'now', date: '', tz: localTz() };
  const GROUPS = ['Fácil', 'Media', 'Difícil'];
  const isDesign = (c) => c && c.kind === 'design';
  // Ejercicios agrupados: los de programación por dificultad y los de diseño aparte
  const groupsFor = (type) => [
    ...(type !== 'design' ? GROUPS.map((g) => ({ label: diff(g), items: challenges.filter((c) => !isDesign(c) && c.difficulty === g) })) : []),
    ...(type !== 'coding' ? [{ label: t('a.group.design'), items: challenges.filter(isDesign) }] : []),
  ].filter((g) => g.items.length);
  const exMeta = (c) => isDesign(c)
    ? `${diff(c.difficulty)} · ${c.minutes} min · ${t('a.n_req', { n: (exText(c, 'requirements') || []).length })}`
    : `${esc(exText(c, 'topic') || '')} · ${c.minutes} min · ${t('a.n_cases', { n: c.tests.length })}`;
  function renderNewForm(done) {
    const page = $('#new-page');
    if (done) return renderCreated(done);
    const segBtn = (key, v, label, ic) => `<button type="button" data-k="${key}" data-v="${v}" class="${form[key] === v ? 'on' : ''}">${ic ? icon(ic) : ''}${label}</button>`;
    page.innerHTML = `
      <h2>${t('a.nav.new')}</h2>
      <p>${t('a.new.d')}</p>
      <form id="new-form" autocomplete="off">
        <div class="card"><div class="card-h"><span class="n">1</span><h3>${t('a.s.cand')}</h3></div><div class="card-b">
          <span class="label">${t('a.kind')}</span>
          <div class="seg full">${segBtn('type', 'coding', t('kind.coding'), 'play')}${segBtn('type', 'design', t('kind.design'), 'book')}${segBtn('type', 'mixed', t('kind.mixed'), 'plus')}</div>
          <div class="hint" id="f-type-help" style="margin-bottom:14px"></div>
          <div class="grid2">
            <div><label for="f-name">${t('a.name')}</label><input id="f-name" placeholder="Ana López" maxlength="80" value="${esc(form.name)}" required></div>
            <div><label for="f-email">${t('a.email')} <span class="faint" style="font-weight:400">${t('a.optional')}</span></label><input id="f-email" type="email" placeholder="${t('a.email.ph')}" value="${esc(form.email)}"></div>
          </div>
          <div class="grid2" style="margin-top:14px">
            <div id="f-plang"><span class="label">${t('a.plang')}</span><div class="seg full">${segBtn('lang', 'python', 'Python')}${segBtn('lang', 'javascript', 'JavaScript')}</div></div>
            <div><span class="label">${t('a.ui0')}</span><div class="seg full">${segBtn('ui', 'es', 'Español')}${segBtn('ui', 'en', 'English')}</div></div>
          </div>
          <div class="grid2" style="margin-top:14px">
            <div><label for="f-theme">${t('a.theme0')}</label><select id="f-theme">${themeOptions(form.theme)}</select></div>
            <div class="hint" style="align-self:end;margin-bottom:8px">${t('a.can_change')}</div>
          </div>
        </div></div>

        <div class="card"><div class="card-h"><span class="n">2</span><h3>${t('a.s.ex')}</h3><div class="spacer"></div><span class="faint" id="f-count"></span></div><div class="card-b">
          <div class="catalog" id="catalog"></div>
          <div class="grid2" style="margin-top:14px">
            <div><label for="f-min">${t('a.duration')}</label><input id="f-min" type="number" min="5" max="240"><div class="hint">${t('a.duration.h')}</div></div>
          </div>
        </div></div>

        <div class="card"><div class="card-h"><span class="n">3</span><h3>${t('a.s.access')}</h3></div><div class="card-b">
          <div class="seg full">${segBtn('activation', 'now', t('a.act.now'), 'zap')}${segBtn('activation', 'manual', t('a.act.manual'), 'lock')}${segBtn('activation', 'scheduled', t('a.act.sched'), 'calendar')}</div>
          <div class="hint" id="f-act-help"></div>
          <div id="f-sched" class="${form.activation === 'scheduled' ? '' : 'hidden'}">
            <div class="tz-row">
              <div><label for="f-date">${t('a.datetime')}</label><input id="f-date" type="datetime-local" value="${esc(form.date)}"></div>
              <div><label for="f-tz">${t('a.tz_of')}</label><select id="f-tz">${tzOptions(form.tz)}</select></div>
            </div>
            <div class="tz-preview" id="f-tz-preview"></div>
          </div>
        </div>
        <div class="card-f"><span class="faint" style="font-size:12.5px" id="f-summary"></span><div class="spacer"></div>
          <button class="btn primary" id="f-submit"></button></div>
        </div>
      </form>`;

    const updateHelp = () => {
      $('#f-act-help').textContent = t({ now: 'a.act.now.h', manual: 'a.act.manual.h', scheduled: 'a.act.sched.h' }[form.activation]);
      $('#f-submit').innerHTML = form.activation === 'now' ? `${icon('zap')} ${t('a.gen')}` : `${icon('lock')} ${t('a.prep')}`;
      $('#f-sched').classList.toggle('hidden', form.activation !== 'scheduled');
      if (form.activation === 'scheduled' && !$('#f-date').value) {
        $('#f-date').value = form.date = utcToZonedInput(Date.now() + 864e5, form.tz).slice(0, 10) + 'T10:00'; // mañana 10:00
      }
      updateTzPreview();
    };
    const updateTzPreview = () => {
      const el = $('#f-tz-preview'); if (!el || form.activation !== 'scheduled') return;
      const v = $('#f-date').value; if (!v) { el.textContent = t('a.pick_dt'); return; }
      const at = zonedToUtc(v, form.tz), mine = localTz();
      const rows = [
        `${t('a.in_tz', { date: `<b>${esc(fmtIn(at, form.tz))}</b>`, tz: esc(tzLabel(form.tz)) })} (${tzShort(at, form.tz)})`,
        mine !== form.tz ? esc(t('a.in_mine', { date: fmtIn(at, mine), tz: tzLabel(mine) })) : '',
        `${esc(fmtIn(at, 'UTC'))} UTC`,
        at <= Date.now() ? `<span style="color:var(--red)">${t('a.past')}</span>` : t('a.opens_in', { t: fmtCountdown(at - Date.now()) }),
      ].filter(Boolean);
      el.innerHTML = rows.join('<br>');
    };
    const updateSel = () => {
      form.ids = $$('#catalog input:checked').map((b) => b.value);
      $('#f-count').textContent = form.ids.length ? t('a.n_sel', { n: form.ids.length }) : t('a.pick_ex');
      const sum = form.ids.reduce((s, id) => s + chById(id).minutes, 0);
      if (!form.minutesTouched) $('#f-min').value = sum || 20;
      const kindLabel = form.type === 'design' ? t('kind.design') : form.type === 'mixed' ? `${t('kind.mixed')} · ${LANG[form.lang]}` : LANG[form.lang];
      $('#f-summary').textContent = form.ids.length ? t('a.summary', { n: form.ids.length, m: $('#f-min').value, lang: kindLabel }) : '';
    };
    // Catálogo según el tipo de entrevista
    const renderCatalog = () => {
      const allowed = new Set(groupsFor(form.type).flatMap((g) => g.items.map((c) => c.id)));
      form.ids = form.ids.filter((id) => allowed.has(id)); // quita lo que ya no aplica al tipo elegido
      $('#catalog').innerHTML = groupsFor(form.type).map((g) => `<div class="cat-group">${g.label}<span class="spacer"></span>${g.items.length}</div>` + g.items.map((c) => `
        <label class="cat-item" style="margin:0;font-weight:400"><input type="checkbox" value="${c.id}" ${form.ids.includes(c.id) ? 'checked' : ''}>
          <span class="t">${esc(exText(c, 'title'))}<small>${exMeta(c)}</small></span>
          <button type="button" class="link" data-preview="${c.id}">${t('a.view')}</button></label>`).join('')).join('');
      $$('#catalog input').forEach((box) => box.onchange = () => {
        if ($$('#catalog input:checked').length > 6) { box.checked = false; toast(t('a.max6')); }
        updateSel();
      });
      $$('[data-preview]').forEach((b) => b.onclick = (e) => { e.preventDefault(); previewModal(b.dataset.preview); });
      $('#f-type-help').textContent = t('a.kind.' + form.type + '.h');
      $('#f-plang').classList.toggle('hidden', form.type === 'design'); // el lenguaje solo aplica a coding
    };
    $$('#new-form .seg button').forEach((b) => b.onclick = () => {
      form[b.dataset.k] = b.dataset.v;
      $$(`#new-form .seg button[data-k="${b.dataset.k}"]`).forEach((x) => x.classList.toggle('on', x === b));
      if (b.dataset.k === 'type') { form.minutesTouched = false; renderCatalog(); }
      updateHelp(); updateSel();
    });
    renderCatalog();
    $('#f-min').oninput = () => { form.minutesTouched = true; updateSel(); };
    $('#f-name').oninput = (e) => { form.name = e.target.value; };
    $('#f-email').oninput = (e) => { form.email = e.target.value; };
    $('#f-theme').onchange = (e) => { form.theme = e.target.value; };
    $('#f-date').oninput = (e) => { form.date = e.target.value; updateTzPreview(); };
    $('#f-tz').onchange = (e) => { form.tz = e.target.value; updateTzPreview(); };
    if (form.minutes) $('#f-min').value = form.minutes;
    updateHelp(); updateSel();

    $('#new-form').onsubmit = async (e) => {
      e.preventDefault();
      if (!form.ids.length) return toast(t('a.need_ex'));
      let opensAt;
      if (form.activation === 'scheduled') {
        if (!$('#f-date').value) return toast(t('a.need_dt'));
        opensAt = zonedToUtc($('#f-date').value, form.tz);
        if (opensAt <= Date.now()) return toast(t('a.future'));
      }
      try {
        const c = await api('/api/admin/candidates', { method: 'POST', body: JSON.stringify({
          name: $('#f-name').value, email: $('#f-email').value.trim() || undefined, lang: form.lang, theme: form.theme, ui: form.ui, type: form.type,
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
        <h2 style="font-size:20px;margin:14px 0 4px">${esc(t('a.ready_for', { name: c.name }))}</h2>
        <p class="muted" style="margin:0 0 18px">${esc(label)}${c.opensAt ? ` · ${esc(t('a.opens', { date: shortDate(c.opensAt, c.tz) }))} (${esc(tzLabel(c.tz))})` : ''} · ${t('a.n_ex', { n: idsOf(c).length })} · ${c.minutes} min · ${UI_LANG_NAME[c.ui || 'es']}</p>
        <label>${t('a.link')}</label>
        <div class="share"><input readonly value="${esc(linkOf(c))}" id="new-url"><button class="btn" id="cp">${icon('copy')} ${t('copy')}</button></div>
        <div style="display:flex;gap:8px;margin-top:16px;flex-wrap:wrap">
          <button class="btn primary" id="em">${icon('mail')} ${t('a.send_email')}</button>
          <button class="btn" id="vw">${icon('eye')} ${t('a.view_cand')}</button>
          <div class="spacer"></div>
          <button class="btn ghost" id="again">${icon('plus')} ${t('a.again')}</button>
        </div>
      </div></div>`;
    $('#cp').onclick = () => { navigator.clipboard.writeText(linkOf(c)); toast(t('a.copied')); };
    $('#em').onclick = () => emailModal(c.id);
    $('#vw').onclick = () => { go('cands'); select(c.id); };
    $('#again').onclick = () => renderNewForm();
  }

  // =====================================================================
  // Catálogo
  // =====================================================================
  function designPreviewHtml(c) {
    const list = (arr, cls = '') => `<ul class="req-list ${cls}">${(arr || []).map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`;
    return `
      <div style="display:flex;gap:6px;flex-wrap:wrap"><span class="tag kind-tag">${t('kind.design')}</span><span class="tag">${esc(diff(c.difficulty))}</span><span class="tag">${t('a.suggested', { n: c.minutes })}</span></div>
      <h2>${esc(exText(c, 'title'))}</h2>
      <div class="section-title">${t('a.instr_cand')}</div>
      <p class="desc">${md(exText(c, 'description'))}</p>
      <div class="section-title">${t('a.requirements')}</div>${list(exText(c, 'requirements'))}
      <div class="section-title">${t('a.questions')}</div>${list(exText(c, 'questions'))}
      <div class="section-title">${t('a.rubric')}</div>${list(exText(c, 'rubric'), 'rubric')}
      <p class="faint" style="font-size:12px;margin-top:10px">${t('a.design_note')}</p>`;
  }
  function previewHtml(c, lang) {
    if (isDesign(c)) return designPreviewHtml(c);
    const rows = c.tests.map((tc, i) => `<tr><td style="width:56px">${i + 1}${tc.hidden ? ` <span class="tag">${t('hidden')}</span>` : ''}</td><td>${esc(signature(lang, c.fn[lang], tc.args))}</td><td>${esc(json(tc.expected, lang))}</td></tr>`).join('');
    return `
      <div style="display:flex;gap:6px;flex-wrap:wrap"><span class="tag">${esc(diff(c.difficulty))}</span><span class="tag">${esc(exText(c, 'topic') || '')}</span><span class="tag">${t('a.suggested', { n: c.minutes })}</span></div>
      <h2>${esc(exText(c, 'title'))}</h2>
      <div class="section-title">${t('a.instr_cand')}</div>
      <p class="desc">${md(exText(c, 'description'))}</p>
      <div class="section-title">${t('a.starter')}</div>
      <div class="grid2"><div><span class="label faint">Python</span><pre class="code">${esc(starter(c.starter.python))}</pre></div><div><span class="label faint">JavaScript</span><pre class="code">${esc(starter(c.starter.javascript))}</pre></div></div>
      <div class="section-title">${t('a.cases_h', { v: c.tests.filter((x) => !x.hidden).length, h: c.tests.filter((x) => x.hidden).length, lang: LANG[lang] })}</div>
      <table class="tbl"><thead><tr><th>#</th><th>${t('a.th.input')}</th><th>${t('a.th.expected')}</th></tr></thead><tbody>${rows}</tbody></table>
      <p class="faint" style="font-size:12px;margin-top:8px">${t('a.hidden_note')}</p>`;
  }
  function previewModal(id) {
    const c = chById(id);
    const inForm = () => form.ids.includes(id);
    const m = modal({ title: t('a.preview'), body: `<div class="preview">${previewHtml(c, form.lang)}</div>`,
      footer: `<div class="spacer"></div><button class="btn" data-no>${t('close')}</button><button class="btn primary" id="pv-add">${inForm() ? t('a.remove_ev') : t('a.add_ev')}</button>` });
    m.el.querySelector('[data-no]').onclick = m.close;
    $('#pv-add').onclick = () => {
      const box = $(`#catalog input[value="${id}"]`);
      if (!box.checked && form.ids.length >= 6) return toast(t('a.max6'));
      box.checked = !box.checked; box.onchange(); m.close();
    };
  }
  let catSel = null, catLang = 'python';
  function renderCatalogView() {
    $('#cat-count').textContent = t('a.cat.count', { n: challenges.length });
    $('#cat-list').innerHTML = groupsFor('mixed').map((g) => `<div class="cat-group">${g.label}</div>` + g.items.map((c) => `
      <div class="row ${catSel === c.id ? 'on' : ''}" data-id="${c.id}"><div class="l1"><span class="name">${esc(exText(c, 'title'))}</span><span class="faint mono" style="font-size:12px">${c.minutes} min</span></div>
      <div class="l2">${exMeta(c)}</div></div>`).join('')).join('');
    $$('#cat-list .row').forEach((r) => r.onclick = () => { catSel = r.dataset.id; renderCatalogView(); });
    const c = chById(catSel);
    $('#cat-detail').innerHTML = c ? `<div class="preview">
        ${isDesign(c) ? '' : `<div class="seg" style="float:right">${['python', 'javascript'].map((l) => `<button data-l="${l}" class="${catLang === l ? 'on' : ''}">${LANG[l]}</button>`).join('')}</div>`}
        ${previewHtml(c, catLang)}
        <button class="btn primary" style="margin-top:16px" id="cat-use">${icon('plus')} ${t('a.use_new')}</button></div>`
      : `<div class="empty-state"><div class="ico">${icon('book')}</div><h3>${t('a.nav.catalog')}</h3>${t('a.cat.empty')}</div>`;
    $$('#cat-detail .seg button').forEach((b) => b.onclick = () => { catLang = b.dataset.l; renderCatalogView(); });
    if (c) $('#cat-use').onclick = () => {
      if (isDesign(c) && form.type === 'coding') form.type = 'design';
      if (!isDesign(c) && form.type === 'design') form.type = 'coding';
      if (!form.ids.includes(c.id) && form.ids.length < 6) form.ids.push(c.id);
      if (!isDesign(c)) form.lang = catLang;
      form.minutesTouched = false; go('new');
    };
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
      const label = ids.length === 1 ? title(ids[0]) : t('c.n_ex', { n: ids.length });
      const extra = isTyping(c) ? `<span class="typing">${t('a.typing')}</span>`
        : isLocked(c) && c.opensAt ? `<span>${esc(t('a.opens_short', { date: shortDate(c.opensAt) }))}</span>`
        : c.status === 'in_progress' && c.startedAt ? `<span class="mono">${fmtTime(deadlineOf(c) - Date.now())}</span>`
        : total ? `<span class="mono">${passed}/${total}</span>` : `<span>${ago(c.createdAt)}</span>`;
      return `<div class="row ${c.id === selected ? 'on' : ''}" data-id="${c.id}">
        <div class="l1"><span class="name">${esc(c.name)}</span>${statusHtml(c)}</div>
        <div class="l2"><span>${esc(label || '')}</span><span class="dot-sep">${c.type === 'design' ? t('kind.design') : c.type === 'mixed' ? t('kind.mixed') : LANG[c.lang]}</span><span class="dot-sep"></span>${extra}</div></div>`;
    }).join('') : `<div class="empty">${all.length ? t('a.list.filter') : t('a.list.none')}</div>`;
    if ($('#cand-list').dataset.html !== html) { $('#cand-list').dataset.html = html; $('#cand-list').innerHTML = html; $$('#cand-list .row').forEach((el) => el.onclick = () => select(el.dataset.id)); }
    const lockedN = all.filter(isLocked).length;
    const bulk = $('#btn-activate-all');
    bulk.classList.toggle('hidden', !lockedN);
    bulk.innerHTML = `${icon('unlock')} ${t('a.activate_n', { n: lockedN })}`;
  }
  $('#btn-activate-all').onclick = async () => {
    const n = [...cands.values()].filter(isLocked).length;
    if (!await confirmBox(t('a.activate_q', { n }), t('a.activate_d'), t('a.activate'))) return;
    try { const { activated } = await api('/api/admin/activate-all', { method: 'POST' }); toast(t('a.activated_n', { n: activated })); } catch (e) { fail(e); }
  };

  function renderEmptyDetail() {
    $('#detail').innerHTML = `<div class="empty-state"><div class="ico">${icon('users')}</div><h3>${t('a.empty.h')}</h3>
      ${t('a.empty.d')}<div style="margin-top:16px"><button class="btn primary" data-goto="new">${icon('plus')} ${t('a.nav.new')}</button></div></div>`;
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
        <div class="meta">${c.type && c.type !== 'coding' ? `<span class="tag kind-tag" style="margin-right:4px">${t('kind.' + c.type)}</span>` : ''}${c.type === 'design' ? '' : LANG[c.lang]}<span class="dot-sep">${c.minutes} min</span><span class="dot-sep">${t('a.n_ex', { n: idsOf(c).length })}</span><span class="dot-sep">${UI_LANG_NAME[c.ui || 'es']}</span>${c.email ? `<span class="dot-sep">${esc(c.email)}</span>` : ''}</div>
        <div class="d-actions" id="d-actions"></div>
      </div>
      <div id="d-notice"></div>
      <div class="kv" id="d-stats"></div>
      <div class="pills" id="d-pills"></div>
      <div class="d-body">
        <div class="d-code">
          <div class="subbar">
            <b style="font-weight:500" id="d-extitle"></b>
            <label style="margin:0 0 0 6px;display:flex;gap:6px;align-items:center;font-weight:400;color:var(--muted)"><input type="checkbox" id="d-follow" ${follow ? 'checked' : ''}> ${t('a.follow')}</label>
            <div class="spacer"></div>
            <button class="btn sm" id="d-run">${icon('play')} ${t('a.run_all')}</button>
          </div>
          <div id="d-banner"></div>
          <div class="d-board hidden" id="d-board"></div>
          <div class="editor-wrap" style="min-height:320px" id="d-codewrap"><textarea id="d-code"></textarea></div>
          <div class="results" style="height:auto;max-height:320px" id="d-res">
            <div class="tabs"><button class="tab on">${t('a.results_all')}</button><span class="summary" id="d-summary"></span></div>
            <div class="results-body" id="d-results"></div>
          </div>
        </div>
        <div class="d-side">
          <div class="section-title">${t('c.instructions')}</div>
          <p id="d-desc" style="margin:0;line-height:1.6"></p>
          <div id="d-rubric"></div>
          <div class="section-title">${icon('history').replace('<svg', '<svg style="width:13px;height:13px"')} ${t('a.cand_versions')}</div>
          <div class="vlist" id="d-versions"></div>
          <div class="section-title">${t('a.activity')}</div>
          <ul class="timeline" id="d-timeline"></ul>
        </div>
      </div>`;
    viewer = CodeMirror.fromTextArea($('#d-code'), { mode: c.lang === 'python' ? 'python' : 'javascript', lineNumbers: true, readOnly: true });
    boardView = idsOf(c).some((id) => isDesign(chById(id))) ? AlcorBoard.create($('#d-board'), { readOnly: true }) : null;
    $('#d-follow').onchange = (e) => { follow = e.target.checked; if (follow && c.active) showExercise(c.active); };
    $('#d-run').onclick = runHidden;
    renderHeadState(); showExercise(viewEx); renderStats(); renderTimeline();
  }

  // Botones y aviso que dependen del estado (se recalcula cada segundo por si llega la hora programada)
  function renderHeadState() {
    const c = detailCache; if (!c || !$('#d-actions')) return;
    $('#d-status').innerHTML = statusHtml(c);
    $('#d-typing').innerHTML = isTyping(c) ? `<span class="typing">${t('a.typing2')}</span>` : '';
    const pending = c.status === 'pending';
    const locked = isLocked(c);
    const acts = [
      pending && locked ? `<button class="btn sm primary" data-a="unlock">${icon('unlock')} ${t('a.b.unlock')}</button>` : '',
      pending && !locked ? `<button class="btn sm" data-a="lock">${icon('lock')} ${t('a.b.lock')}</button>` : '',
      pending ? `<button class="btn sm" data-a="schedule">${icon('calendar')} ${c.opensAt && locked ? t('a.b.change_date') : t('a.b.schedule')}</button>` : '',
      ['submitted', 'expired'].includes(c.status) ? `<button class="btn sm primary" data-a="time">${icon('rotate')} ${t('a.b.reopen')}</button>` : '',
      c.status === 'in_progress' ? `<button class="btn sm" data-a="time">${icon('clock')} ${t('a.b.add_time')}</button>` : '',
      `<button class="btn sm" data-a="email">${icon('mail')} ${t('a.b.email')}</button>`,
      `<button class="btn sm" data-a="copy">${icon('copy')} ${t('a.b.copy')}</button>`,
      '<div class="spacer"></div>',
      `<button class="btn sm ghost danger" data-a="revoke">${icon('trash')} ${t('a.b.revoke')}</button>`,
    ].join('');
    let notice = '';
    if (locked && c.opensAt) notice = `${icon('calendar')}<span>${t('a.n.sched', { date: esc(fmtIn(c.opensAt, c.tz)), tz: esc(tzLabel(c.tz)) })}${c.tz !== localTz() ? esc(t('a.n.sched_mine', { date: shortDate(c.opensAt) })) : ''}</span><span class="spacer"></span><span class="faint mono">${t('a.n.in', { t: fmtCountdown(c.opensAt - Date.now()) })}</span>`;
    else if (locked) notice = `${icon('lock')}<span>${t('a.n.locked')}</span>`;
    else if (pending) notice = `${icon('unlock')}<span>${t('a.n.open')}</span>`;
    else if (c.status === 'expired') notice = `${icon('clock')}<span>${t('a.n.expired')}</span>`;
    else if (c.status === 'submitted') notice = `${icon('check')}<span>${t('a.n.submitted', { at: c.submittedAt ? t('a.n.at', { t: hhmm(c.submittedAt) }) : '' })}</span>`;
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
      if (a === 'unlock') { await api(`/api/admin/candidates/${c.id}/activate`, { method: 'POST' }); toast(t('a.t.unlocked')); }
      if (a === 'lock') { await api(`/api/admin/candidates/${c.id}/deactivate`, { method: 'POST' }); toast(t('a.t.locked')); }
      if (a === 'schedule') scheduleModal(c);
      if (a === 'time') timeModal(c);
      if (a === 'email') emailModal(c.id);
      if (a === 'copy') { await navigator.clipboard.writeText(linkOf(c)); toast(t('a.copied')); }
      if (a === 'revoke') {
        if (!await confirmBox(esc(t('a.revoke_q', { name: c.name })), t('a.revoke_d'), t('a.b.revoke'), true)) return;
        await api('/api/admin/candidates/' + c.id, { method: 'DELETE' });
      }
    } catch (e) { fail(e); }
  }

  // Reabrir (terminada) o agregar tiempo (en curso)
  function timeModal(c) {
    const reopen = c.status !== 'in_progress';
    let mins = 10;
    const m = modal({ title: esc(t(reopen ? 'a.reopen_t' : 'a.addtime_t', { name: c.name })), size: 'sm', body: `<div style="padding:16px 18px">
        <p class="muted" style="margin:0 0 14px;line-height:1.6">${t(reopen ? 'a.reopen_d' : 'a.addtime_d')}</p>
        <span class="label">${t(reopen ? 'a.mins_avail' : 'a.mins_extra')}</span>
        <div class="seg full" id="t-quick">${[5, 10, 15, 30].map((n) => `<button type="button" data-n="${n}" class="${n === mins ? 'on' : ''}">${n} min</button>`).join('')}</div>
        <input id="t-min" type="number" min="1" max="240" value="${mins}" style="margin-top:10px">
        <div class="hint" id="t-prev"></div></div>`,
      footer: `<div class="spacer"></div><button class="btn" data-no>${t('cancel')}</button><button class="btn primary" id="t-ok">${icon(reopen ? 'rotate' : 'clock')} ${t(reopen ? 'a.b.reopen' : 'a.add')}</button>` });
    const prev = () => {
      mins = Math.max(1, Math.min(240, parseInt($('#t-min').value, 10) || 0));
      const base = reopen ? Date.now() : Math.max(deadlineOf(c), Date.now());
      $('#t-prev').textContent = t('a.ends_at', { t: hhmm(base + mins * 60000) });
      $$('#t-quick button').forEach((b) => b.classList.toggle('on', Number(b.dataset.n) === mins));
    };
    $$('#t-quick button').forEach((b) => b.onclick = () => { $('#t-min').value = b.dataset.n; prev(); });
    $('#t-min').oninput = prev; prev();
    m.el.querySelector('[data-no]').onclick = m.close;
    $('#t-ok').onclick = async () => {
      try {
        await api(`/api/admin/candidates/${c.id}/time`, { method: 'POST', body: JSON.stringify({ minutes: mins }) });
        m.close(); toast(reopen ? t('a.reopened_t', { n: mins }) : t('a.added_t', { n: mins, name: c.name }));
      } catch (e) { fail(e); }
    };
  }

  function scheduleModal(c) {
    let tz = c.tz && c.tz !== 'UTC' ? c.tz : localTz();
    const begin = c.opensAt && c.opensAt > Date.now() ? c.opensAt : zonedToUtc(utcToZonedInput(Date.now() + 864e5, tz).slice(0, 10) + 'T10:00', tz);
    const m = modal({ title: t('a.sched_t'), size: 'sm', body: `<div style="padding:16px 18px">
        <label for="s-date">${t('a.datetime')}</label><input id="s-date" type="datetime-local" value="${utcToZonedInput(begin, tz)}">
        <label for="s-tz" style="margin-top:12px">${t('a.tz_of')}</label><select id="s-tz">${tzOptions(tz)}</select>
        <div class="tz-preview" id="s-prev"></div></div>`,
      footer: `${c.opensAt ? `<button class="btn ghost" id="s-clear">${t('a.clear_date')}</button>` : ''}<div class="spacer"></div><button class="btn" data-no>${t('cancel')}</button><button class="btn primary" id="s-save">${icon('calendar')} ${t('a.b.schedule')}</button>` });
    const prev = () => {
      const v = $('#s-date').value; if (!v) return;
      const at = zonedToUtc(v, tz), mine = localTz();
      $('#s-prev').innerHTML = [t('a.in_tz', { date: `<b>${esc(fmtIn(at, tz))}</b>`, tz: esc(tzLabel(tz)) }), mine !== tz ? esc(t('a.in_mine2', { date: fmtIn(at, mine) })) : '', `${esc(fmtIn(at, 'UTC'))} UTC`,
        at <= Date.now() ? `<span style="color:var(--red)">${t('a.past')}</span>` : t('a.locked_until')].filter(Boolean).join('<br>');
    };
    $('#s-date').oninput = prev; $('#s-tz').onchange = (e) => { tz = e.target.value; prev(); }; prev();
    m.el.querySelector('[data-no]').onclick = m.close;
    $('#s-save').onclick = async () => {
      try { await api(`/api/admin/candidates/${c.id}/schedule`, { method: 'POST', body: JSON.stringify({ opensAt: zonedToUtc($('#s-date').value, tz), tz }) }); m.close(); toast(t('a.sched_ok')); }
      catch (e) { fail(e); }
    };
    if ($('#s-clear')) $('#s-clear').onclick = async () => {
      try { await api(`/api/admin/candidates/${c.id}/schedule`, { method: 'POST', body: JSON.stringify({ opensAt: null }) }); m.close(); toast(t('a.sched_cleared')); }
      catch (e) { fail(e); }
    };
  }

  async function emailModal(id) {
    const c = cands.get(id) || detailCache;
    let msg;
    try { msg = await api(`/api/admin/candidates/${id}/email`, { method: 'POST', body: JSON.stringify({ link: linkOf(c) }) }); } catch (e) { return fail(e); }
    const m = modal({ title: t('a.mail_t'), size: '', body: `<div style="padding:16px 18px;max-width:640px">
        <label for="e-to">${t('a.to')}</label><input id="e-to" type="email" placeholder="${t('a.to.ph')}" value="${esc(msg.to || '')}">
        <label for="e-sub" style="margin-top:12px">${t('a.subject')}</label><input id="e-sub" value="${esc(msg.subject)}">
        <label for="e-body" style="margin-top:12px">${t('a.message')}</label><textarea id="e-body" rows="13" style="font:12.5px/1.6 var(--mono)">${esc(msg.text)}</textarea>
        <div class="hint">${mailConfigured ? t('a.mail_server') : t('a.mail_client')}</div></div>`,
      footer: `<button class="btn" id="e-copy">${icon('copy')} ${t('a.copy_msg')}</button><div class="spacer"></div><button class="btn" data-no>${t('cancel')}</button>
        ${mailConfigured ? `<button class="btn" id="e-mailto">${icon('mail')} ${t('a.open_mail')}</button><button class="btn primary" id="e-send">${icon('send')} ${t('a.send')}</button>` : `<button class="btn primary" id="e-mailto">${icon('mail')} ${t('a.open_mail')}</button>`}` });
    m.el.querySelector('[data-no]').onclick = m.close;
    const saveTo = async () => {
      const to = $('#e-to').value.trim();
      if (to && to !== msg.to) await api(`/api/admin/candidates/${id}/email`, { method: 'POST', body: JSON.stringify({ to, link: linkOf(c) }) });
      return to;
    };
    $('#e-copy').onclick = () => { navigator.clipboard.writeText(`${$('#e-sub').value}\n\n${$('#e-body').value}`); toast(t('a.msg_copied')); };
    $('#e-mailto').onclick = async () => {
      try {
        const to = await saveTo();
        location.href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent($('#e-sub').value)}&body=${encodeURIComponent($('#e-body').value)}`;
        m.close();
      } catch (e) { fail(e); }
    };
    if ($('#e-send')) $('#e-send').onclick = async () => {
      try {
        const to = await saveTo(); if (!to) return toast(t('a.need_to'));
        $('#e-send').disabled = true;
        await api(`/api/admin/candidates/${id}/email`, { method: 'POST', body: JSON.stringify({ send: true, link: linkOf(c) }) });
        m.close(); toast(t('a.mail_sent', { to }));
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
      return `<button class="pill ${id === viewEx ? 'on' : ''}" data-id="${id}">${i + 1}. ${esc(title(id))}${r ? ` <span class="r">${r.passed}/${r.total}</span>` : ''}${here ? ` <span class="status live" title="${t('a.cand_here')}"></span>` : ''}</button>`;
    }).join('');
    $$('#d-pills .pill').forEach((b) => b.onclick = () => { follow = false; $('#d-follow').checked = false; showExercise(b.dataset.id); });
  }

  function currentCode() {
    const c = detailCache, ch = chById(viewEx);
    if (viewingVersion) return viewingVersion.code;
    return c.code && typeof c.code[viewEx] === 'string' ? c.code[viewEx] : (c.status === 'pending' || isDesign(ch) ? '' : starter(ch.starter[c.lang]));
  }
  function showExercise(id) {
    viewEx = id; viewingVersion = null;
    const ch = chById(id), design = isDesign(ch);
    $('#d-extitle').textContent = exText(ch, 'title');
    $('#d-desc').innerHTML = md(exText(ch, 'description'));
    // System design: diagrama en vivo + rúbrica; coding: código + tests
    $('#d-board').classList.toggle('hidden', !design);
    $('#d-codewrap').classList.toggle('hidden', design);
    $('#d-res').classList.toggle('hidden', design);
    $('#d-run').classList.toggle('hidden', design);
    const list = (k, cls = '') => `<div class="section-title">${t(k === 'requirements' ? 'a.requirements' : 'a.rubric')}</div><ul class="req-list ${cls}">${(exText(ch, k) || []).map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`;
    $('#d-rubric').innerHTML = design ? list('requirements') + list('rubric', 'rubric') : '';
    if (design && boardView) boardView.reset(currentCode() || AlcorBoard.EMPTY());
    setViewer();
    $('#d-results').innerHTML = `<div class="empty">${t('a.run_hint')}</div>`;
    $('#d-summary').innerHTML = '';
    renderPills(); renderVersions();
  }
  function setViewer() {
    const c = detailCache;
    if (isDesign(chById(viewEx))) { if (boardView) boardView.setValue(currentCode() || AlcorBoard.EMPTY()); }
    else {
      const code = currentCode() || (c.lang === 'python' ? '# ' : '// ') + t('a.not_started');
      if (viewer.getValue() !== code) { const s = viewer.getScrollInfo(); viewer.setValue(code); viewer.scrollTo(s.left, s.top); }
    }
    $('#d-banner').innerHTML = viewingVersion
      ? `<div class="viewing-banner">${icon('history').replace('<svg', '<svg style="width:14px;height:14px"')}<span>${esc(t('a.viewing', { label: versionLabel(viewingVersion), t: hhmm(viewingVersion.t) }))}</span><span class="spacer"></span><button class="btn sm" id="d-live">${t('a.back_live')}</button></div>` : '';
    if (viewingVersion) $('#d-live').onclick = () => { viewingVersion = null; setViewer(); renderVersions(); };
  }
  // Las versiones automáticas se guardan como "Tests 3/5"; las mostramos traducidas.
  const versionLabel = (v) => { const mt = /^Tests (\d+)\/(\d+)$/.exec(v.label || ''); return mt ? t('v.tests', { p: mt[1], t: mt[2] }) : v.label || t('no_name'); };
  function renderVersions() {
    const c = detailCache; if (!$('#d-versions')) return;
    const list = ((c.versions || {})[viewEx] || []).slice().reverse();
    $('#d-versions').innerHTML = list.length ? list.map((v) => `<button class="vitem ${viewingVersion && viewingVersion.id === v.id ? 'on' : ''}" data-id="${v.id}">${icon(v.auto ? 'play' : 'save')}<span class="lab">${esc(versionLabel(v))}</span><span class="when">${hhmm(v.t)}</span></button>`).join('')
      : `<div class="faint" style="font-size:12.5px">${t('a.no_versions')}</div>`;
    $$('#d-versions .vitem').forEach((b) => b.onclick = () => { follow = false; $('#d-follow').checked = false; viewingVersion = list.find((v) => v.id === b.dataset.id); setViewer(); renderVersions(); });
  }

  async function runHidden() {
    const c = detailCache, ch = chById(viewEx);
    const btn = $('#d-run'); btn.disabled = true; btn.textContent = t('running');
    try {
      const res = await AlcorRunner.run(c.lang, viewer.getValue(), ch.fn[c.lang], ch.tests);
      renderResults($('#d-results'), res, c.lang, ch.fn[c.lang]);
      if (res.stdout) $('#d-results').insertAdjacentHTML('beforeend', `<div class="section-title">${t('a.output')}</div><pre class="console">${esc(res.stdout)}</pre>`);
      $('#d-summary').innerHTML = `<span class="tag ${res.passed === res.total ? 'ok' : 'bad'}">${res.passed}/${res.total} tests</span>`;
    } finally { btn.disabled = false; btn.innerHTML = `${icon('play')} ${t('a.run_all')}`; }
  }

  function renderStats() {
    const c = detailCache; if (!c || !$('#d-stats')) return;
    const elapsed = c.startedAt ? (c.submittedAt || Date.now()) - c.startedAt : 0;
    const ids = idsOf(c), res = c.results || {};
    const passed = ids.reduce((s, id) => s + (res[id] ? res[id].passed : 0), 0);
    const total = ids.reduce((s, id) => s + (res[id] ? res[id].total : 0), 0);
    const left = c.startedAt && c.status === 'in_progress' ? deadlineOf(c) - Date.now() : null;
    const stat = (k, v) => `<div><div class="k">${k}</div><div class="v">${v}</div></div>`;
    $('#d-stats').innerHTML =
      stat(t('a.k.tests'), total ? `${passed}/${total}` : '—') +
      stat(left != null ? t('a.k.left') : t('a.k.used'), left != null ? fmtTime(left) : c.startedAt ? fmtTime(elapsed) : '—') +
      stat(t('a.k.runs'), c.runs || 0) +
      stat(t('a.k.pastes'), c.pastes || 0) +
      stat(t('a.k.blurs'), c.blurs || 0);
  }

  // =====================================================================
  // Avisos (se acabó el tiempo / envió su evaluación)
  // =====================================================================
  const SEEN_KEY = 'alcor:notices-seen';
  let notices = [];
  const noticeText = (n) => t('notice.' + n.kind, { name: n.name });
  const seenAt = () => { try { return Number(localStorage.getItem(SEEN_KEY)) || 0; } catch { return 0; } };
  function renderBadge() {
    const n = notices.filter((x) => x.t > seenAt()).length;
    const b = $('#count-notices');
    b.textContent = n > 9 ? '9+' : n; b.classList.toggle('hidden', !n);
  }
  async function loadNotices() { try { notices = await api('/api/admin/notices'); renderBadge(); } catch { /* */ } }
  function beep() {
    try {
      const ac = new (window.AudioContext || window.webkitAudioContext)();
      [0, 0.16].forEach((at, i) => {
        const o = ac.createOscillator(), g = ac.createGain();
        o.frequency.value = i ? 880 : 660; o.type = 'sine';
        g.gain.setValueAtTime(0.0001, ac.currentTime + at);
        g.gain.exponentialRampToValueAtTime(0.12, ac.currentTime + at + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + at + 0.14);
        o.connect(g).connect(ac.destination); o.start(ac.currentTime + at); o.stop(ac.currentTime + at + 0.16);
      });
    } catch { /* sin audio */ }
  }
  function onNotice(n) {
    notices.unshift(n); renderBadge();
    toast(noticeText(n)); beep();
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        const nt = new Notification('Alcor', { body: noticeText(n), icon: '/favicon.svg', tag: n.id });
        nt.onclick = () => { window.focus(); go('cands'); select(n.candidate); nt.close(); };
      } catch { /* */ }
    }
  }
  $('#nav-notices').onclick = () => {
    const perm = 'Notification' in window ? Notification.permission : 'unsupported';
    const item = (n) => `<button class="vitem" data-c="${n.candidate}" style="padding:10px 12px">${icon(n.kind === 'expired' ? 'clock' : 'check')}<span class="lab" style="white-space:normal">${esc(noticeText(n))}${n.t > seenAt() ? ` <span class="tag" style="margin-left:4px">${t('new')}</span>` : ''}</span><span class="when">${new Date(n.t).toLocaleString(loc(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })}</span></button>`;
    const m = modal({ title: t('a.notices'), size: 'sm', body: `<div style="padding:8px">
        ${perm === 'default' ? `<div class="notice" style="border:1px solid var(--border);border-radius:8px;margin:4px 4px 10px">${icon('bell').replace('<svg', '<svg style="width:15px;height:15px;color:var(--muted)"')}<span style="flex:1">${t('a.notices.perm')}</span><button class="btn sm primary" id="n-perm">${t('a.activate')}</button></div>` : ''}
        ${perm === 'denied' ? `<div class="hint" style="margin:4px 8px 10px">${t('a.notices.denied')}</div>` : ''}
        <div class="vlist">${notices.length ? notices.map(item).join('') : `<div class="empty">${t('a.notices.empty')}</div>`}</div></div>` });
    try { localStorage.setItem(SEEN_KEY, String(Date.now())); } catch { /* */ }
    renderBadge();
    $$('[data-c]', m.el).forEach((b) => b.onclick = () => { m.close(); if (cands.has(b.dataset.c)) { go('cands'); select(b.dataset.c); } else toast(t('a.gone')); });
    if ($('#n-perm')) $('#n-perm').onclick = async () => { const r = await Notification.requestPermission(); m.close(); toast(r === 'granted' ? t('a.notif_on') : t('a.notif_off')); };
  };

  // =====================================================================
  // Actividad
  // =====================================================================
  const WHY = ['late_save', 'late_submit', 'late_return', 'tab_closed', 'from_admin', 'from_candidate'];
  function evDetail(e) {
    if (e.type === 'scheduled' && e.at) return fmtIn(e.at, e.tz || localTz());
    if (e.type === 'paste' && /^\d+$/.test(String(e.detail))) return t('ev.chars', { n: e.detail });
    if (e.type === 'version' && e.detail) return versionLabel({ label: e.detail });
    if (WHY.includes(e.detail)) return t('why.' + e.detail);
    return e.detail;
  }
  function renderTimeline() {
    const c = detailCache; if (!c || !$('#d-timeline')) return;
    const items = (c.timeline || []).slice(-200).reverse();
    $('#d-timeline').innerHTML = items.length ? items.map((e) => {
      const label = I18N.D[I18N.lang()]['ev.' + e.type] ? t('ev.' + e.type) : esc(e.type);
      const detail = evDetail(e);
      return `<li><time>${hhmm(e.t)}</time><span>${label}${e.exercise && idsOf(c).length > 1 ? ` <span class="faint">· ${esc(title(e.exercise))}</span>` : ''}${e.type === 'run' && e.total != null ? ` <span class="mono">${e.passed}/${e.total}</span>` : ''}${detail ? ` <span class="muted">· ${esc(detail)}</span>` : ''}</span></li>`;
    }).join('') : `<li class="faint" style="display:block">${t('a.no_activity')}</li>`;
  }

  // =====================================================================
  // Tiempo real
  // =====================================================================
  function connectStream() {
    const es = new EventSource('/api/admin/stream');
    const st = $('#stream-status');
    es.onopen = () => { st.className = 'status live'; st.textContent = t('a.live'); };
    es.onerror = () => { st.className = 'status warn'; st.textContent = t('a.reconnecting'); };
    es.onmessage = async (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === 'notice') return onNotice(msg.notice);
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
