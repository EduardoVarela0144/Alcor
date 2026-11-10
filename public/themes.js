// Temas de Alcor. Cada tema define la paleta completa de la interfaz y del editor.
// Se carga en el <head> para aplicar el tema antes de pintar (sin parpadeo) y el
// servidor también lo usa para validar el tema que elige el admin.
(function (root) {
  // k: palabra clave · d: definición · s: string · n: número · b: builtin · p: propiedad · c: comentario
  const T = [
    // ---------- claros ----------
    { id: 'light', name: 'Claro', dark: false, c: { bg: '#fafafa', panel: '#ffffff', subtle: '#f4f4f5', hover: '#f0f0f1', border: '#e8e8ea', borderStrong: '#d9d9dd', text: '#18181b', muted: '#6b6b73', faint: '#a1a1aa', primary: '#18181b', primaryInk: '#ffffff', accent: '#f0512a', k: '#c2410c', d: '#1d4ed8', s: '#15803d', n: '#7c3aed', b: '#0e7490', p: '#9333ea' } },
    { id: 'paper', name: 'Papel', dark: false, c: { bg: '#f5f0e6', panel: '#fffdf8', subtle: '#f1ebdf', hover: '#ebe4d6', border: '#e4dccb', borderStrong: '#d6ccb7', text: '#2b2620', muted: '#75695a', faint: '#a89c8a', primary: '#2b2620', primaryInk: '#fffdf8', accent: '#c2410c', k: '#a0522d', d: '#2f5d8a', s: '#4f7a28', n: '#8a4baf', b: '#2a7b7b', p: '#7a4f9a' } },
    { id: 'github-light', name: 'GitHub Claro', dark: false, c: { bg: '#f6f8fa', panel: '#ffffff', subtle: '#f6f8fa', hover: '#eef1f4', border: '#d0d7de', borderStrong: '#c4ccd5', text: '#1f2328', muted: '#59636e', faint: '#8c959f', primary: '#1f883d', primaryInk: '#ffffff', accent: '#0969da', k: '#cf222e', d: '#8250df', s: '#0a3069', n: '#0550ae', b: '#953800', p: '#0550ae' } },
    { id: 'solarized-light', name: 'Solarized Claro', dark: false, c: { bg: '#f4eedb', panel: '#fdf6e3', subtle: '#eee8d5', hover: '#e8e1cb', border: '#e2dbc4', borderStrong: '#d3cbb2', text: '#073642', muted: '#586e75', faint: '#93a1a1', primary: '#268bd2', primaryInk: '#fdf6e3', accent: '#cb4b16', k: '#859900', d: '#268bd2', s: '#2aa198', n: '#d33682', b: '#b58900', p: '#6c71c4' } },
    { id: 'latte', name: 'Catppuccin Latte', dark: false, c: { bg: '#e6e9ef', panel: '#eff1f5', subtle: '#e6e9ef', hover: '#dce0e8', border: '#ccd0da', borderStrong: '#bcc0cc', text: '#4c4f69', muted: '#6c6f85', faint: '#9ca0b0', primary: '#8839ef', primaryInk: '#ffffff', accent: '#fe640b', k: '#8839ef', d: '#1e66f5', s: '#40a02b', n: '#fe640b', b: '#179299', p: '#d20f39' } },
    { id: 'rose-pine-dawn', name: 'Rosé Pine Dawn', dark: false, c: { bg: '#f4ede8', panel: '#fffaf3', subtle: '#f2e9e1', hover: '#ebe1d8', border: '#dfdad9', borderStrong: '#cecacd', text: '#575279', muted: '#797593', faint: '#9893a5', primary: '#907aa9', primaryInk: '#ffffff', accent: '#d7827e', k: '#286983', d: '#d7827e', s: '#ea9d34', n: '#b4637a', b: '#56949f', p: '#907aa9' } },
    { id: 'mint', name: 'Menta', dark: false, c: { bg: '#f1f7f4', panel: '#ffffff', subtle: '#e9f3ee', hover: '#e0eee7', border: '#d3e5dc', borderStrong: '#bdd8ca', text: '#14281f', muted: '#4f6b5e', faint: '#8aa699', primary: '#0f766e', primaryInk: '#ffffff', accent: '#0d9488', k: '#be185d', d: '#0f766e', s: '#4d7c0f', n: '#7c3aed', b: '#0369a1', p: '#b45309' } },
    { id: 'contrast-light', name: 'Alto contraste claro', dark: false, c: { bg: '#ffffff', panel: '#ffffff', subtle: '#f0f0f0', hover: '#e4e4e4', border: '#000000', borderStrong: '#000000', text: '#000000', muted: '#1f1f1f', faint: '#3d3d3d', primary: '#000000', primaryInk: '#ffffff', accent: '#0047ff', k: '#b00000', d: '#0000c0', s: '#005f00', n: '#6a00a8', b: '#004f5f', p: '#6a00a8' } },
    // ---------- oscuros ----------
    { id: 'dark', name: 'Oscuro', dark: true, c: { bg: '#09090b', panel: '#111113', subtle: '#18181b', hover: '#1f1f23', border: '#242428', borderStrong: '#303036', text: '#ededef', muted: '#a1a1aa', faint: '#6b6b73', primary: '#ededef', primaryInk: '#09090b', accent: '#f0512a', k: '#fb923c', d: '#60a5fa', s: '#4ade80', n: '#c4b5fd', b: '#22d3ee', p: '#d8b4fe' } },
    { id: 'midnight', name: 'Medianoche', dark: true, c: { bg: '#000000', panel: '#000000', subtle: '#0b0b0b', hover: '#151515', border: '#1d1d1d', borderStrong: '#2b2b2b', text: '#f5f5f5', muted: '#a3a3a3', faint: '#5c5c5c', primary: '#ffffff', primaryInk: '#000000', accent: '#f0512a', k: '#fb923c', d: '#60a5fa', s: '#4ade80', n: '#c4b5fd', b: '#22d3ee', p: '#d8b4fe' } },
    { id: 'github-dark', name: 'GitHub Oscuro', dark: true, c: { bg: '#010409', panel: '#0d1117', subtle: '#161b22', hover: '#1f2630', border: '#30363d', borderStrong: '#3d444d', text: '#e6edf3', muted: '#9198a1', faint: '#6e7681', primary: '#238636', primaryInk: '#ffffff', accent: '#2f81f7', k: '#ff7b72', d: '#d2a8ff', s: '#a5d6ff', n: '#79c0ff', b: '#ffa657', p: '#79c0ff' } },
    { id: 'dracula', name: 'Dracula', dark: true, c: { bg: '#21222c', panel: '#282a36', subtle: '#2f3241', hover: '#343746', border: '#3a3d4e', borderStrong: '#44475a', text: '#f8f8f2', muted: '#b4b7c9', faint: '#6272a4', primary: '#bd93f9', primaryInk: '#282a36', accent: '#ff79c6', k: '#ff79c6', d: '#50fa7b', s: '#f1fa8c', n: '#bd93f9', b: '#8be9fd', p: '#ffb86c' } },
    { id: 'nord', name: 'Nord', dark: true, c: { bg: '#2b303b', panel: '#2e3440', subtle: '#343b48', hover: '#3b4252', border: '#3b4252', borderStrong: '#434c5e', text: '#eceff4', muted: '#b8c0cf', faint: '#7b88a1', primary: '#88c0d0', primaryInk: '#2e3440', accent: '#88c0d0', k: '#81a1c1', d: '#88c0d0', s: '#a3be8c', n: '#b48ead', b: '#8fbcbb', p: '#d08770' } },
    { id: 'one-dark', name: 'One Dark', dark: true, c: { bg: '#21252b', panel: '#282c34', subtle: '#2c313a', hover: '#323842', border: '#3a3f4b', borderStrong: '#4b5263', text: '#dcdfe4', muted: '#9da5b4', faint: '#5c6370', primary: '#61afef', primaryInk: '#282c34', accent: '#61afef', k: '#c678dd', d: '#61afef', s: '#98c379', n: '#d19a66', b: '#56b6c2', p: '#e06c75' } },
    { id: 'tokyo-night', name: 'Tokyo Night', dark: true, c: { bg: '#16161e', panel: '#1a1b26', subtle: '#1f2335', hover: '#24283b', border: '#292e42', borderStrong: '#3b4261', text: '#c0caf5', muted: '#9aa5ce', faint: '#565f89', primary: '#7aa2f7', primaryInk: '#1a1b26', accent: '#bb9af7', k: '#bb9af7', d: '#7aa2f7', s: '#9ece6a', n: '#ff9e64', b: '#2ac3de', p: '#73daca' } },
    { id: 'mocha', name: 'Catppuccin Mocha', dark: true, c: { bg: '#181825', panel: '#1e1e2e', subtle: '#252537', hover: '#2a2b3c', border: '#313244', borderStrong: '#45475a', text: '#cdd6f4', muted: '#a6adc8', faint: '#6c7086', primary: '#cba6f7', primaryInk: '#1e1e2e', accent: '#f5c2e7', k: '#cba6f7', d: '#89b4fa', s: '#a6e3a1', n: '#fab387', b: '#94e2d5', p: '#f38ba8' } },
    { id: 'gruvbox', name: 'Gruvbox', dark: true, c: { bg: '#1d2021', panel: '#282828', subtle: '#32302f', hover: '#3c3836', border: '#3c3836', borderStrong: '#504945', text: '#ebdbb2', muted: '#bdae93', faint: '#7c6f64', primary: '#fabd2f', primaryInk: '#282828', accent: '#fe8019', k: '#fb4934', d: '#fabd2f', s: '#b8bb26', n: '#d3869b', b: '#8ec07c', p: '#83a598' } },
    { id: 'solarized-dark', name: 'Solarized Oscuro', dark: true, c: { bg: '#00222b', panel: '#002b36', subtle: '#073642', hover: '#0b3d4a', border: '#0e4553', borderStrong: '#1b5260', text: '#e4dfcf', muted: '#93a1a1', faint: '#657b83', primary: '#268bd2', primaryInk: '#fdf6e3', accent: '#cb4b16', k: '#859900', d: '#268bd2', s: '#2aa198', n: '#d33682', b: '#b58900', p: '#6c71c4' } },
    { id: 'rose-pine', name: 'Rosé Pine', dark: true, c: { bg: '#191724', panel: '#1f1d2e', subtle: '#26233a', hover: '#2a273f', border: '#2e2b42', borderStrong: '#403d52', text: '#e0def4', muted: '#908caa', faint: '#6e6a86', primary: '#c4a7e7', primaryInk: '#191724', accent: '#ebbcba', k: '#31748f', d: '#ebbcba', s: '#f6c177', n: '#eb6f92', b: '#9ccfd8', p: '#c4a7e7' } },
    { id: 'monokai', name: 'Monokai', dark: true, c: { bg: '#1e1f1c', panel: '#272822', subtle: '#2e2f29', hover: '#3e3d32', border: '#3b3c35', borderStrong: '#49483e', text: '#f8f8f2', muted: '#b8b8a8', faint: '#75715e', primary: '#a6e22e', primaryInk: '#272822', accent: '#f92672', k: '#f92672', d: '#a6e22e', s: '#e6db74', n: '#ae81ff', b: '#66d9ef', p: '#fd971f' } },
    { id: 'ocean', name: 'Océano', dark: true, c: { bg: '#0b1220', panel: '#0f172a', subtle: '#152036', hover: '#1b2842', border: '#1e2b44', borderStrong: '#2a3a5a', text: '#e2e8f0', muted: '#94a3b8', faint: '#5b6b85', primary: '#38bdf8', primaryInk: '#0b1220', accent: '#38bdf8', k: '#f472b6', d: '#38bdf8', s: '#86efac', n: '#fbbf24', b: '#5eead4', p: '#c4b5fd' } },
    { id: 'contrast-dark', name: 'Alto contraste oscuro', dark: true, c: { bg: '#000000', panel: '#000000', subtle: '#111111', hover: '#1c1c1c', border: '#ffffff', borderStrong: '#ffffff', text: '#ffffff', muted: '#e6e6e6', faint: '#c2c2c2', primary: '#ffd600', primaryInk: '#000000', accent: '#ffd600', k: '#ff9e64', d: '#82aaff', s: '#c3e88d', n: '#f78c6c', b: '#89ddff', p: '#ffcb6b' } },
  ];
  const IDS = ['system'].concat(T.map((t) => t.id));
  if (typeof module !== 'undefined' && module.exports) { module.exports = { IDS, THEMES: T }; return; }

  const KEY = 'alcor:theme', SIZE_KEY = 'alcor:code-size';
  const VARS = { bg: '--bg', panel: '--panel', subtle: '--subtle', hover: '--hover', border: '--border', borderStrong: '--border-strong', text: '--text', muted: '--muted',
    faint: '--faint', primary: '--primary', primaryInk: '--primary-ink', accent: '--brand', k: '--syn-kw', d: '--syn-def', s: '--syn-str', n: '--syn-num', b: '--syn-builtin', p: '--syn-prop' };
  const store = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch { /* */ } } };
  const listeners = [];
  const byId = (id) => T.find((t) => t.id === id);
  const hexA = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };

  function apply(id) {
    const el = document.documentElement;
    Object.values(VARS).concat(['--focus']).forEach((v) => el.style.removeProperty(v));
    const t = byId(id);
    if (!t) { delete el.dataset.theme; el.dataset.themeId = 'system'; }
    else {
      el.dataset.theme = t.dark ? 'dark' : 'light'; // base: estados, sombras y color-scheme
      el.dataset.themeId = t.id;
      if (t.id !== 'light' && t.id !== 'dark') {
        for (const [k, v] of Object.entries(VARS)) if (t.c[k]) el.style.setProperty(v, t.c[k]);
        el.style.setProperty('--focus', hexA(t.c.accent, t.dark ? 0.35 : 0.22));
      }
    }
    listeners.forEach((fn) => { try { fn(id); } catch { /* */ } });
  }
  function applySize(px) { document.documentElement.style.setProperty('--code-size', px + 'px'); listeners.forEach((fn) => { try { fn(); } catch { /* */ } }); }

  root.AlcorThemes = {
    list: T, byId, IDS,
    get: () => store.get(KEY),
    current: () => store.get(KEY) || 'system',
    set(id) { store.set(KEY, id); apply(id); },
    apply,
    size: () => Number(store.get(SIZE_KEY)) || 13.5,
    setSize(px) { store.set(SIZE_KEY, String(px)); applySize(px); },
    onChange(fn) { listeners.push(fn); },
  };
  // Aplicar de inmediato (antes de pintar)
  apply(store.get(KEY) || 'system');
  if (store.get(SIZE_KEY)) document.documentElement.style.setProperty('--code-size', store.get(SIZE_KEY) + 'px');
})(typeof window !== 'undefined' ? window : globalThis);
