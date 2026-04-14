/* ============================================================
   CHROMA — Professional Color Studio
   script.js — Pure JS, modular, no frameworks
   ============================================================ */

'use strict';

/* ===================== STATE ===================== */
const state = {
  h: 210,
  s: 0.71,
  v: 0.96,
  a: 1,
  history: [],
  favorites: [],
  gradientType: 'linear',
  gradientAngle: 135,
  gradientStops: [
    { color: '#6366f1', pos: 0 },
    { color: '#ec4899', pos: 100 }
  ],
  draggingCanvas: false,
};

const MAX_HISTORY = 20;

/* ===================== ELEMENTS ===================== */
const $ = id => document.getElementById(id);
const pickerCanvas   = $('pickerCanvas');
const pickerCursor   = $('pickerCursor');
const hueSlider      = $('hueSlider');
const hueThumb       = $('hueThumb');
const hueVal         = $('hueVal');
const opacitySlider  = $('opacitySlider');
const opacityThumb   = $('opacityThumb');
const opacityVal     = $('opacityVal');
const opacityTrack   = $('opacityTrack');
const previewBox     = $('previewBox');
const previewHex     = $('previewHex');
const hexInput       = $('hexInput');
const rgbInput       = $('rgbInput');
const rgbaInput      = $('rgbaInput');
const hslInput       = $('hslInput');
const hslaInput      = $('hslaInput');
const historyGrid    = $('historyGrid');
const favoritesGrid  = $('favoritesGrid');
const gradientPreview= $('gradientPreview');
const gradientOutput = $('gradientOutput');
const stopsList      = $('stopsList');
const angleSlider    = $('angleSlider');
const angleVal       = $('angleVal');
const angleRow       = $('angleRow');
const saveToFavBtn   = $('saveToFavBtn');
const randomBtn      = $('randomBtn');
const eyedropperBtn  = $('eyedropperBtn');
const themeToggle    = $('themeToggle');
const clearHistoryBtn= $('clearHistoryBtn');
const clearFavsBtn   = $('clearFavsBtn');
const exportPaletteBtn = $('exportPaletteBtn');
const importPaletteFile = $('importPaletteFile');
const addStopBtn     = $('addStopBtn');
const addCurrentToGradientBtn = $('addCurrentToGradientBtn');
const toast          = $('toast');

/* ===================== COLOR MATH ===================== */

function hsvToRgb(h, s, v) {
  let r, g, b;
  const i = Math.floor(h / 60) % 6;
  const f = h / 60 - Math.floor(h / 60);
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  switch (i) {
    case 0: r=v; g=t; b=p; break;
    case 1: r=q; g=v; b=p; break;
    case 2: r=p; g=v; b=t; break;
    case 3: r=p; g=q; b=v; break;
    case 4: r=t; g=p; b=v; break;
    default:r=v; g=p; b=q;
  }
  return { r: Math.round(r*255), g: Math.round(g*255), b: Math.round(b*255) };
}

function rgbToHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r,g,b), min = Math.min(r,g,b), d = max - min;
  let h = 0, s = max ? d/max : 0, v = max;
  if (d) {
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return { h, s, v };
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r,g,b), min = Math.min(r,g,b);
  let h = 0, s = 0, l = (max+min)/2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d/(2-max-min) : d/(max+min);
    switch(max) {
      case r: h = (g-b)/d + (g<b?6:0); break;
      case g: h = (b-r)/d + 2; break;
      case b: h = (r-g)/d + 4; break;
    }
    h *= 60;
  }
  return {
    h: Math.round(h),
    s: Math.round(s*100),
    l: Math.round(l*100)
  };
}

function hexToRgb(hex) {
  hex = hex.replace('#','');
  if (hex.length === 3) hex = hex.split('').map(c=>c+c).join('');
  if (hex.length !== 6) return null;
  const n = parseInt(hex, 16);
  return { r: (n>>16)&255, g: (n>>8)&255, b: n&255 };
}

function rgbToHex(r, g, b) {
  return '#' + [r,g,b].map(x=>x.toString(16).padStart(2,'0')).join('').toUpperCase();
}

function getCurrentRgb() {
  return hsvToRgb(state.h, state.s, state.v);
}

function getCurrentHex() {
  const {r,g,b} = getCurrentRgb();
  return rgbToHex(r,g,b);
}

function getCurrentHsl() {
  const {r,g,b} = getCurrentRgb();
  return rgbToHsl(r,g,b);
}

/* ===================== CANVAS PICKER ===================== */

function drawPickerCanvas() {
  const ctx = pickerCanvas.getContext('2d');
  const W = pickerCanvas.width;
  const H = pickerCanvas.height;

  // Base hue fill
  ctx.fillStyle = `hsl(${state.h}, 100%, 50%)`;
  ctx.fillRect(0, 0, W, H);

  // White → transparent gradient (left to right)
  const white = ctx.createLinearGradient(0, 0, W, 0);
  white.addColorStop(0, 'rgba(255,255,255,1)');
  white.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = white;
  ctx.fillRect(0, 0, W, H);

  // Black → transparent gradient (bottom to top)
  const black = ctx.createLinearGradient(0, 0, 0, H);
  black.addColorStop(0, 'rgba(0,0,0,0)');
  black.addColorStop(1, 'rgba(0,0,0,1)');
  ctx.fillStyle = black;
  ctx.fillRect(0, 0, W, H);
}

function updateCursorPosition() {
  const W = pickerCanvas.offsetWidth;
  const H = pickerCanvas.offsetHeight;
  pickerCursor.style.left = (state.s * W) + 'px';
  pickerCursor.style.top = ((1 - state.v) * H) + 'px';
}

function pickFromCanvas(e) {
  const rect = pickerCanvas.getBoundingClientRect();
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
  const y = Math.max(0, Math.min(clientY - rect.top, rect.height));
  state.s = x / rect.width;
  state.v = 1 - y / rect.height;
  updateAll();
}

pickerCanvas.addEventListener('mousedown', e => {
  state.draggingCanvas = true;
  pickFromCanvas(e);
});
pickerCanvas.addEventListener('touchstart', e => {
  state.draggingCanvas = true;
  pickFromCanvas(e);
  e.preventDefault();
}, { passive: false });

document.addEventListener('mousemove', e => { if (state.draggingCanvas) pickFromCanvas(e); });
document.addEventListener('touchmove', e => { if (state.draggingCanvas) { pickFromCanvas(e); e.preventDefault(); } }, { passive: false });
document.addEventListener('mouseup', () => state.draggingCanvas = false);
document.addEventListener('touchend', () => state.draggingCanvas = false);

/* ===================== SLIDERS ===================== */

function syncSliderThumb(input, thumb, min, max) {
  const pct = (input.value - min) / (max - min) * 100;
  thumb.style.left = pct + '%';
}

hueSlider.addEventListener('input', () => {
  state.h = parseInt(hueSlider.value);
  hueVal.textContent = state.h + '°';
  syncSliderThumb(hueSlider, hueThumb, 0, 360);
  drawPickerCanvas();
  updateAll();
});

opacitySlider.addEventListener('input', () => {
  state.a = parseInt(opacitySlider.value) / 100;
  opacityVal.textContent = Math.round(state.a * 100) + '%';
  syncSliderThumb(opacitySlider, opacityThumb, 0, 100);
  updateAll(true); // skip history
});

angleSlider.addEventListener('input', () => {
  state.gradientAngle = parseInt(angleSlider.value);
  angleVal.textContent = state.gradientAngle + '°';
  updateGradient();
});

function updateOpacityTrack() {
  const {r,g,b} = getCurrentRgb();
  opacityTrack.style.setProperty('--opacity-gradient',
    `linear-gradient(to right, rgba(${r},${g},${b},0), rgba(${r},${g},${b},1))`);
}

/* ===================== MAIN UPDATE LOOP ===================== */

let lastHex = '';

function updateAll(skipHistory = false) {
  const {r,g,b} = getCurrentRgb();
  const hex = rgbToHex(r,g,b);
  const {h,s,l} = rgbToHsl(r,g,b);
  const aRound = Math.round(state.a * 100) / 100;

  // Preview
  const cssColor = `rgba(${r},${g},${b},${state.a})`;
  previewBox.style.background = cssColor;
  previewHex.textContent = hex;

  // Format inputs
  hexInput.value  = hex;
  rgbInput.value  = `rgb(${r}, ${g}, ${b})`;
  rgbaInput.value = `rgba(${r}, ${g}, ${b}, ${aRound})`;
  hslInput.value  = `hsl(${h}, ${s}%, ${l}%)`;
  hslaInput.value = `hsla(${h}, ${s}%, ${l}%, ${aRound})`;

  // Sliders
  syncSliderThumb(hueSlider, hueThumb, 0, 360);
  syncSliderThumb(opacitySlider, opacityThumb, 0, 100);
  hueSlider.value = state.h;
  opacitySlider.value = Math.round(state.a * 100);
  hueVal.textContent = Math.round(state.h) + '°';
  opacityVal.textContent = Math.round(state.a * 100) + '%';

  // Cursor
  updateCursorPosition();
  updateOpacityTrack();

  // WCAG
  updateWCAG(r, g, b);

  // History (only on mouse-up type events)
  if (!skipHistory && hex !== lastHex) {
    lastHex = hex;
    scheduleHistory(hex);
  }
}

/* ===================== HISTORY DEBOUNCE ===================== */

let historyTimer;
function scheduleHistory(hex) {
  clearTimeout(historyTimer);
  historyTimer = setTimeout(() => addToHistory(hex), 500);
}

function addToHistory(hex) {
  state.history = state.history.filter(c => c !== hex);
  state.history.unshift(hex);
  if (state.history.length > MAX_HISTORY) state.history.pop();
  saveLocal();
  renderHistory();
}

/* ===================== FORMATS → STATE ===================== */

function parseHexInput(val) {
  val = val.trim();
  if (!val.startsWith('#')) val = '#' + val;
  const rgb = hexToRgb(val);
  if (!rgb) return false;
  const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
  state.h = hsv.h; state.s = hsv.s; state.v = hsv.v;
  hueSlider.value = state.h;
  drawPickerCanvas();
  updateAll();
  return true;
}

function parseRgbInput(val) {
  const m = val.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)/);
  if (!m) return false;
  const [,r,g,b,a] = m;
  const hsv = rgbToHsv(+r,+g,+b);
  state.h=hsv.h; state.s=hsv.s; state.v=hsv.v;
  if (a !== undefined) { state.a = parseFloat(a); opacitySlider.value = Math.round(state.a*100); }
  hueSlider.value = state.h;
  drawPickerCanvas();
  updateAll();
  return true;
}

function parseHslInput(val) {
  const m = val.match(/hsla?\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%(?:\s*,\s*([\d.]+))?\s*\)/);
  if (!m) return false;
  const [,h,s,l,a] = m;
  const {r,g,b} = hslToRgb(+h,+s/100,+l/100);
  const hsv = rgbToHsv(r,g,b);
  state.h=hsv.h; state.s=hsv.s; state.v=hsv.v;
  if (a !== undefined) { state.a = parseFloat(a); opacitySlider.value = Math.round(state.a*100); }
  hueSlider.value = state.h;
  drawPickerCanvas();
  updateAll();
  return true;
}

function hslToRgb(h, s, l) {
  let r, g, b;
  if (!s) { r = g = b = l; }
  else {
    const hue2rgb = (p,q,t) => {
      if (t<0) t+=1; if (t>1) t-=1;
      if (t<1/6) return p+(q-p)*6*t;
      if (t<1/2) return q;
      if (t<2/3) return p+(q-p)*(2/3-t)*6;
      return p;
    };
    const q = l < 0.5 ? l*(1+s) : l+s-l*s;
    const p = 2*l-q;
    r = hue2rgb(p,q,h/360+1/3);
    g = hue2rgb(p,q,h/360);
    b = hue2rgb(p,q,h/360-1/3);
  }
  return { r: Math.round(r*255), g: Math.round(g*255), b: Math.round(b*255) };
}

// Format input listeners
hexInput.addEventListener('change', () => parseHexInput(hexInput.value));
hexInput.addEventListener('keydown', e => { if (e.key === 'Enter') parseHexInput(hexInput.value); });
rgbInput.addEventListener('change', () => parseRgbInput(rgbInput.value));
rgbaInput.addEventListener('change', () => parseRgbInput(rgbaInput.value));
hslInput.addEventListener('change', () => parseHslInput(hslInput.value));
hslaInput.addEventListener('change', () => parseHslInput(hslaInput.value));

/* ===================== WCAG ===================== */

function relativeLuminance(r, g, b) {
  const sRGB = [r/255, g/255, b/255].map(c =>
    c <= 0.03928 ? c/12.92 : Math.pow((c+0.055)/1.055, 2.4)
  );
  return 0.2126*sRGB[0] + 0.7152*sRGB[1] + 0.0722*sRGB[2];
}

function contrastRatio(l1, l2) {
  const lighter = Math.max(l1, l2);
  const darker  = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function wcagGrade(ratio) {
  const badges = [];
  if (ratio >= 7)   badges.push({label:'AAA', type:'pass'});
  else              badges.push({label:'AAA', type:'fail'});
  if (ratio >= 4.5) badges.push({label:'AA', type:'pass'});
  else              badges.push({label:'AA', type:'fail'});
  if (ratio >= 3)   badges.push({label:'AA Large', type:'pass'});
  else              badges.push({label:'AA Large', type:'fail'});
  return badges;
}

function updateWCAG(r, g, b) {
  const lColor = relativeLuminance(r, g, b);
  const lWhite = 1;
  const lBlack = 0;

  const ratioWhite = contrastRatio(lColor, lWhite);
  const ratioBlack = contrastRatio(lColor, lBlack);

  // On white
  $('wcagWhiteRatio').textContent = ratioWhite.toFixed(2) + ':1';
  $('wcagColorOnWhiteSwatch').style.background = `rgb(${r},${g},${b})`;
  $('wcagColorOnWhiteSwatch').style.color = ratioWhite > 4.5 ? `rgb(${r},${g},${b})` : `rgb(${r},${g},${b})`;
  renderWcagBadges('wcagWhiteBadges', wcagGrade(ratioWhite));

  // On black
  $('wcagBlackRatio').textContent = ratioBlack.toFixed(2) + ':1';
  $('wcagColorOnBlackSwatch').style.background = `rgb(${r},${g},${b})`;
  renderWcagBadges('wcagBlackBadges', wcagGrade(ratioBlack));
}

function renderWcagBadges(containerId, badges) {
  const el = $(containerId);
  el.innerHTML = badges.map(b =>
    `<span class="wcag-badge badge-${b.type}">${b.label}</span>`
  ).join('');
}

/* ===================== GRADIENT ===================== */

function updateGradient() {
  const stops = state.gradientStops
    .slice()
    .sort((a,b) => a.pos - b.pos)
    .map(s => `${s.color} ${s.pos}%`)
    .join(', ');

  let css;
  if (state.gradientType === 'linear') {
    css = `linear-gradient(${state.gradientAngle}deg, ${stops})`;
  } else {
    css = `radial-gradient(circle, ${stops})`;
  }
  gradientPreview.style.background = css;
  gradientOutput.value = `background: ${css};`;
}

function renderStops() {
  stopsList.innerHTML = '';
  state.gradientStops.forEach((stop, i) => {
    const div = document.createElement('div');
    div.className = 'stop-item';
    div.innerHTML = `
      <input type="color" class="stop-color-input" value="${stop.color}" data-idx="${i}" />
      <input type="range" class="stop-pos-input" min="0" max="100" value="${stop.pos}" data-idx="${i}" title="${stop.pos}%" />
      <span class="stop-pos-label">${stop.pos}%</span>
      ${state.gradientStops.length > 2 ? `<button class="stop-remove" data-idx="${i}">✕</button>` : ''}
    `;
    stopsList.appendChild(div);
  });

  stopsList.querySelectorAll('.stop-color-input').forEach(inp => {
    inp.addEventListener('input', e => {
      state.gradientStops[+e.target.dataset.idx].color = e.target.value;
      updateGradient();
    });
  });

  stopsList.querySelectorAll('.stop-pos-input').forEach(inp => {
    inp.addEventListener('input', e => {
      const idx = +e.target.dataset.idx;
      const val = parseInt(e.target.value);
      state.gradientStops[idx].pos = val;
      e.target.nextElementSibling.textContent = val + '%';
      updateGradient();
    });
  });

  stopsList.querySelectorAll('.stop-remove').forEach(btn => {
    btn.addEventListener('click', e => {
      state.gradientStops.splice(+e.target.dataset.idx, 1);
      renderStops();
      updateGradient();
    });
  });
}

addStopBtn.addEventListener('click', () => {
  const hex = getCurrentHex();
  state.gradientStops.push({ color: hex, pos: 50 });
  renderStops();
  updateGradient();
});

addCurrentToGradientBtn.addEventListener('click', () => {
  const hex = getCurrentHex();
  state.gradientStops.push({ color: hex, pos: Math.round(Math.random() * 80 + 10) });
  renderStops();
  updateGradient();
  showToast('Color added to gradient!');
});

// Type toggle
document.querySelectorAll('.seg-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.seg-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.gradientType = btn.dataset.type;
    angleRow.style.display = state.gradientType === 'radial' ? 'none' : '';
    updateGradient();
  });
});

/* ===================== HISTORY UI ===================== */

function renderHistory() {
  historyGrid.innerHTML = '';
  if (!state.history.length) {
    historyGrid.innerHTML = '<span class="swatch-empty">No colors yet</span>';
    return;
  }
  state.history.forEach(hex => {
    historyGrid.appendChild(createSwatch(hex, () => loadColor(hex), null));
  });
}

/* ===================== FAVORITES UI ===================== */

function renderFavorites() {
  favoritesGrid.innerHTML = '';
  if (!state.favorites.length) {
    favoritesGrid.innerHTML = '<span class="swatch-empty">No favorites saved</span>';
    return;
  }
  state.favorites.forEach((hex, i) => {
    favoritesGrid.appendChild(createSwatch(hex, () => loadColor(hex), () => removeFavorite(i)));
  });
}

function removeFavorite(idx) {
  state.favorites.splice(idx, 1);
  saveLocal();
  renderFavorites();
}

saveToFavBtn.addEventListener('click', () => {
  const hex = getCurrentHex();
  if (state.favorites.includes(hex)) {
    showToast('Already in favorites!');
    return;
  }
  state.favorites.unshift(hex);
  if (state.favorites.length > 30) state.favorites.pop();
  saveLocal();
  renderFavorites();
  showToast('⭐ Saved to favorites!');
  saveToFavBtn.classList.add('starred');
  setTimeout(() => saveToFavBtn.classList.remove('starred'), 1200);
});

/* ===================== SWATCH FACTORY ===================== */

function createSwatch(hex, onClick, onRemove) {
  const div = document.createElement('div');
  div.className = 'color-swatch';
  div.style.background = hex;
  div.title = hex;

  const tip = document.createElement('div');
  tip.className = 'swatch-tooltip';
  tip.textContent = hex;
  div.appendChild(tip);

  if (onRemove) {
    const rm = document.createElement('button');
    rm.className = 'swatch-remove';
    rm.textContent = '✕';
    rm.addEventListener('click', e => { e.stopPropagation(); onRemove(); });
    div.appendChild(rm);
  }

  div.addEventListener('click', () => {
    onClick();
    rippleEffect(div);
  });

  return div;
}

function rippleEffect(el) {
  const r = document.createElement('span');
  r.className = 'ripple-effect';
  r.style.left = '50%';
  r.style.top = '50%';
  el.style.position = 'relative';
  el.style.overflow = 'hidden';
  el.appendChild(r);
  setTimeout(() => r.remove(), 600);
}

/* ===================== LOAD COLOR ===================== */

function loadColor(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return;
  const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
  state.h = hsv.h;
  state.s = hsv.s;
  state.v = hsv.v;
  hueSlider.value = state.h;
  drawPickerCanvas();
  updateAll();
  showToast('Color loaded: ' + hex);
}

/* ===================== RANDOM COLOR ===================== */

randomBtn.addEventListener('click', () => {
  state.h = Math.random() * 360;
  state.s = 0.4 + Math.random() * 0.6;
  state.v = 0.5 + Math.random() * 0.5;
  hueSlider.value = state.h;
  drawPickerCanvas();
  updateAll();
  showToast('🎲 Random color!');
});

/* ===================== EYEDROPPER ===================== */

eyedropperBtn.addEventListener('click', async () => {
  if (!window.EyeDropper) {
    showToast('Eyedropper not supported in this browser');
    return;
  }
  try {
    const dropper = new EyeDropper();
    const result = await dropper.open();
    loadColor(result.sRGBHex.toUpperCase());
  } catch(e) {
    // user cancelled
  }
});

/* ===================== THEME TOGGLE ===================== */

themeToggle.addEventListener('click', () => {
  const html = document.documentElement;
  html.dataset.theme = html.dataset.theme === 'dark' ? 'light' : 'dark';
  localStorage.setItem('chroma-theme', html.dataset.theme);
});

/* ===================== COPY ===================== */

document.querySelectorAll('.copy-btn').forEach(btn => {
  btn.addEventListener('click', e => {
    const target = btn.dataset.target;
    const el = $(target);
    if (!el) return;
    navigator.clipboard.writeText(el.value).then(() => {
      showToast('✓ Copied: ' + el.value.slice(0, 30) + (el.value.length > 30 ? '…' : ''));
      btn.style.color = 'var(--accent)';
      setTimeout(() => btn.style.color = '', 800);
    });
    rippleEffect(btn);
  });
});

/* ===================== CLEAR ===================== */

clearHistoryBtn.addEventListener('click', () => {
  state.history = [];
  saveLocal();
  renderHistory();
  showToast('History cleared');
});

clearFavsBtn.addEventListener('click', () => {
  if (!state.favorites.length) return;
  state.favorites = [];
  saveLocal();
  renderFavorites();
  showToast('Favorites cleared');
});

/* ===================== EXPORT / IMPORT ===================== */

exportPaletteBtn.addEventListener('click', () => {
  const data = JSON.stringify({ favorites: state.favorites, history: state.history }, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'chroma-palette.json';
  a.click();
  URL.revokeObjectURL(url);
  showToast('📦 Palette exported!');
});

importPaletteFile.addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = evt => {
    try {
      const data = JSON.parse(evt.target.result);
      if (data.favorites) state.favorites = [...new Set([...data.favorites, ...state.favorites])].slice(0, 30);
      if (data.history) state.history = [...new Set([...data.history, ...state.history])].slice(0, MAX_HISTORY);
      saveLocal();
      renderFavorites();
      renderHistory();
      showToast('✅ Palette imported!');
    } catch {
      showToast('❌ Invalid palette file');
    }
  };
  reader.readAsText(file);
  importPaletteFile.value = '';
});

/* ===================== KEYBOARD SHORTCUTS ===================== */

document.addEventListener('keydown', e => {
  // Skip if typing in an input
  if (e.target.tagName === 'INPUT') return;

  switch(e.key.toLowerCase()) {
    case 'c':
      navigator.clipboard.writeText(getCurrentHex()).then(() => showToast('✓ HEX copied!'));
      break;
    case 'r':
      randomBtn.click();
      break;
    case 'e':
      eyedropperBtn.click();
      break;
    case 't':
      themeToggle.click();
      break;
    case 's':
      saveToFavBtn.click();
      break;
  }
});

/* ===================== TOAST ===================== */

let toastTimer;
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('visible'), 2200);
}

/* ===================== LOCALSTORAGE ===================== */

function saveLocal() {
  localStorage.setItem('chroma-history', JSON.stringify(state.history));
  localStorage.setItem('chroma-favorites', JSON.stringify(state.favorites));
}

function loadLocal() {
  try {
    const hist = localStorage.getItem('chroma-history');
    const favs = localStorage.getItem('chroma-favorites');
    const theme = localStorage.getItem('chroma-theme');
    if (hist) state.history = JSON.parse(hist);
    if (favs) state.favorites = JSON.parse(favs);
    if (theme) document.documentElement.dataset.theme = theme;
  } catch(e) {}
}

/* ===================== INIT ===================== */

function init() {
  loadLocal();
  drawPickerCanvas();
  renderStops();
  updateGradient();
  updateAll(true);
  renderHistory();
  renderFavorites();

  // Eyedropper availability
  if (!window.EyeDropper) {
    eyedropperBtn.style.opacity = '0.4';
    eyedropperBtn.title = 'Eyedropper not supported in this browser';
  }

  // Initial angle slider
  angleVal.textContent = state.gradientAngle + '°';
  angleSlider.value = state.gradientAngle;

  // Initial hue/opacity sync
  hueSlider.value = state.h;
  opacitySlider.value = Math.round(state.a * 100);
  syncSliderThumb(hueSlider, hueThumb, 0, 360);
  syncSliderThumb(opacitySlider, opacityThumb, 0, 100);
}

init();
