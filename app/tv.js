/* TV dashboard - strict ES5 (Chromium M47 / Tizen 3.0). No arrow fns, let/const, template literals, fetch, Promise. */
(function () {
  'use strict';

  var POLL_MS = 30000;
  var STALE_S = 300;          // status older than 5 min -> "offline" marker
  var WAKE_MS = 60000;        // calm screen: show full UI this long after a key press

  // Candidate Tizen app IDs per tile (tried in order). Fill IPTV with the real ID from the diagnostics screen.
  var APPS = [
    { key: 'youtube', label: 'YouTube', sub: 'TizenTube', letter: 'Y', color: '#e53935', ids: ['111299001912', '9Ur5IzDKqV.TizenYouTube'] },
    { key: 'netflix', label: 'Netflix', letter: 'N', color: '#c40f1a', ids: ['11101200001', '3201907018807', 'org.tizen.netflix-app'] },
    { key: 'prime', label: 'Prime Video', letter: 'P', color: '#1799d8', ids: ['3201512006785', '3201910019365', 'org.tizen.primevideo'] },
    { key: 'iptv', label: 'IPTV', letter: 'TV', color: '#2e9b6a', ids: [] /* e.g. ['XXXXXXXXXX.IPTV'] */ },
    { key: 'disney', label: 'Disney+', letter: 'D', color: '#1f3fa8', ids: ['3201901017640'] },
    { key: 'diag', label: '?', letter: '?', color: '#3a3f57', diag: true }
  ];

  var T = {
    de: {
      noPlain: 'Nur auf dem Fernseher startbar (Tizen-App nötig).',
      failed: 'App nicht gefunden – ID prüfen (blaue Taste = Diagnose).',
      noId: 'Keine App-ID hinterlegt – siehe Diagnose (blaue Taste).',
      launching: 'Starte ',
      ideas: 'Ideen für heute', noIdeas: 'Keine Ideen gerade',
      range: 'Tief / Hoch', home: 'zuhause', away: 'unterwegs', offline: 'Keine aktuellen Daten',
      diag: 'Diagnose: installierte Apps (Name / ID)', diagHint: 'Zurück = schließen   ↑↓ = blättern',
      diagNo: 'Tizen-API nicht verfügbar (normaler Browser).', diagWait: 'Lade …',
      cond: { 'clear-night': 'Klare Nacht', cloudy: 'Bewölkt', exceptional: 'Ausnahmewetter', fog: 'Nebel', hail: 'Hagel', lightning: 'Gewitter', 'lightning-rainy': 'Gewitter mit Regen', partlycloudy: 'Wolkig', pouring: 'Starkregen', rainy: 'Regen', snowy: 'Schnee', 'snowy-rainy': 'Schneeregen', sunny: 'Sonnig', windy: 'Windig', 'windy-variant': 'Windig und wolkig', unknown: 'Wetter unbekannt', unavailable: 'Wetter nicht verfügbar' },
      flags: { storm: 'Wichtig jetzt: Gewitter', hail: 'Wichtig jetzt: Hagel', exceptional: 'Wichtig jetzt: Unwetterlage', heat: 'Wichtig jetzt: große Hitze', frost: 'Wichtig jetzt: strenger Frost', wind: 'Wichtig jetzt: starker Wind' }
    },
    en: {
      noPlain: 'Can only be launched on the TV (Tizen app needed).',
      failed: 'App not found – check ID (blue key = diagnostics).',
      noId: 'No app ID set – see diagnostics (blue key).',
      launching: 'Starting ',
      ideas: 'Ideas for today', noIdeas: 'No ideas right now',
      range: 'Low / High', home: 'home', away: 'away', offline: 'No current data',
      diag: 'Diagnostics: installed apps (name / ID)', diagHint: 'Back = close   Up/Down = scroll',
      diagNo: 'Tizen API not available (plain browser).', diagWait: 'Loading …',
      cond: { 'clear-night': 'Clear night', cloudy: 'Cloudy', exceptional: 'Exceptional', fog: 'Fog', hail: 'Hail', lightning: 'Thunderstorm', 'lightning-rainy': 'Thunderstorm with rain', partlycloudy: 'Partly cloudy', pouring: 'Pouring rain', rainy: 'Rain', snowy: 'Snow', 'snowy-rainy': 'Sleet', sunny: 'Sunny', windy: 'Windy', 'windy-variant': 'Windy and cloudy', unknown: 'Weather unknown', unavailable: 'Weather unavailable' },
      flags: { storm: 'Important now: thunderstorm', hail: 'Important now: hail', exceptional: 'Important now: severe weather', heat: 'Important now: extreme heat', frost: 'Important now: hard frost', wind: 'Important now: strong wind' }
    },
    es: {
      noPlain: 'Solo se puede abrir en la tele (hace falta app Tizen).',
      failed: 'App no encontrada – revisa el ID (botón azul = diagnóstico).',
      noId: 'Sin ID de app – ver diagnóstico (botón azul).',
      launching: 'Abriendo ',
      ideas: 'Ideas para hoy', noIdeas: 'Sin ideas ahora',
      range: 'Mín / Máx', home: 'en casa', away: 'fuera', offline: 'Sin datos actuales',
      diag: 'Diagnóstico: apps instaladas (nombre / ID)', diagHint: 'Atrás = cerrar   ↑↓ = desplazar',
      diagNo: 'API de Tizen no disponible (navegador normal).', diagWait: 'Cargando …',
      cond: { 'clear-night': 'Noche despejada', cloudy: 'Nublado', exceptional: 'Excepcional', fog: 'Niebla', hail: 'Granizo', lightning: 'Tormenta', 'lightning-rainy': 'Tormenta con lluvia', partlycloudy: 'Parcialmente nublado', pouring: 'Lluvia fuerte', rainy: 'Lluvia', snowy: 'Nieve', 'snowy-rainy': 'Aguanieve', sunny: 'Soleado', windy: 'Ventoso', 'windy-variant': 'Ventoso y nublado', unknown: 'Tiempo desconocido', unavailable: 'Tiempo no disponible' },
      flags: { storm: 'Importante ahora: tormenta', hail: 'Importante ahora: granizo', exceptional: 'Importante ahora: tiempo extremo', heat: 'Importante ahora: mucho calor', frost: 'Importante ahora: helada fuerte', wind: 'Importante ahora: viento fuerte' }
    }
  };

  var DAYS = { de: ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'], en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], es: ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'] };
  var MONTHS = { de: ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'], en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'], es: ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'] };

  var status = null;
  var lang = 'de';
  var focusIdx = 0;
  var diagOpen = false;
  var diagRows = [];
  var diagTop = 0;
  var wakeUntil = 0;
  var toastTimer = null;
  var lastClock = '';
  var styleEl = null;
  var $ = function (id) { return document.getElementById(id); };

  function tr() { return T[lang] || T.de; }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function num(v) { return (typeof v === 'number' && isFinite(v)) ? Math.round(v) : null; }
  function tempStr(v) { var n = num(v); return n === null ? '--' : n + '°'; }

  // ---------- accent ----------
  function setAccent(hex) {
    if (!/^#[0-9a-fA-F]{6}$/.test(hex || '')) { hex = '#a77bff'; }
    if (!styleEl) {
      styleEl = document.createElement('style');
      document.getElementsByTagName('head')[0].appendChild(styleEl);
    }
    var r = parseInt(hex.substr(1, 2), 16), g = parseInt(hex.substr(3, 2), 16), b = parseInt(hex.substr(5, 2), 16);
    var rgba = function (a) { return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')'; };
    styleEl.innerHTML =
      '#screen{background-image:-webkit-radial-gradient(18% 8%,circle farthest-corner,' + rgba(0.26) + ',rgba(11,13,20,0) 60%),-webkit-linear-gradient(top,#121624,#090b11);' +
      'background-image:radial-gradient(circle farthest-corner at 18% 8%,' + rgba(0.26) + ',rgba(11,13,20,0) 60%),linear-gradient(to bottom,#121624,#090b11);}' +
      '.idea .n{color:' + hex + ';}' +
      '.chip.on{border-color:' + hex + ';background-color:' + rgba(0.28) + ';}' +
      '.app.focus{box-shadow:0 0 0 6px ' + hex + ',0 0 40px ' + rgba(0.55) + ';}' +
      '#ideas-title{color:' + hex + ';}';
  }

  // ---------- clock ----------
  function localDate(l) {
    var d = new Date();
    var w = DAYS[l][d.getDay()], m = MONTHS[l][d.getMonth()];
    if (l === 'en') { return w + ', ' + m + ' ' + d.getDate() + ', ' + d.getFullYear(); }
    if (l === 'es') { return w + ', ' + d.getDate() + ' de ' + m + ' de ' + d.getFullYear(); }
    return w + ', ' + d.getDate() + '. ' + m + ' ' + d.getFullYear();
  }
  function tick() {
    var d = new Date();
    var s = pad(d.getHours()) + ':' + pad(d.getMinutes());
    if (s !== lastClock) {
      lastClock = s;
      $('clock').innerHTML = s;
      $('date').innerHTML = esc(localDate(lang));
    }
    applyMode();
    if (status && (new Date().getTime() / 1000 - status.epoch) > STALE_S) { setOffline(true); }
  }

  // ---------- helpers ----------
  function hasClass(el, c) { return (' ' + el.className + ' ').indexOf(' ' + c + ' ') >= 0; }
  function addClass(el, c) { if (!hasClass(el, c)) { el.className = (el.className ? el.className + ' ' : '') + c; } }
  function removeClass(el, c) { el.className = (' ' + el.className + ' ').replace(' ' + c + ' ', ' ').replace(/^\s+|\s+$/g, ''); }
  function setOffline(on) {
    var o = $('offline');
    o.innerHTML = on ? esc(tr().offline) : '';
    if (on) { addClass(o, 'show'); } else { removeClass(o, 'show'); }
  }

  // ---------- render ----------
  function calmNow() {
    return !!(status && status.profile === 'none' && new Date().getTime() > wakeUntil);
  }
  function applyMode() {
    var s = $('screen');
    if (calmNow()) { addClass(s, 'calm'); } else { removeClass(s, 'calm'); }
  }
  function render() {
    if (!status) { return; }
    lang = T[status.lang] ? status.lang : 'de';
    setAccent(status.accent_hex);
    var t = tr();
    var names = [];
    if (status.profile === 'malik' || status.profile === 'beide') { names.push('Malik'); }
    if (status.profile === 'diana' || status.profile === 'beide') { names.push('Diana'); }
    $('greet').innerHTML = esc((status.greeting || '') + (names.length ? ', ' + names.join(' & ') : ''));
    $('date').innerHTML = esc(localDate(lang));

    // who is home chips
    var h = status.home || {};
    $('chips').innerHTML =
      '<span class="chip' + (h.malik ? ' on' : '') + '">Malik · ' + esc(h.malik ? t.home : t.away) + '</span>' +
      '<span class="chip' + (h.diana ? ' on' : '') + '">Diana · ' + esc(h.diana ? t.home : t.away) + '</span>';

    // weather
    var w = status.weather || {};
    $('w-temp').innerHTML = tempStr(w.temp);
    $('w-cond').innerHTML = esc(t.cond[w.condition] || w.condition || '');
    $('w-range').innerHTML = esc(t.range) + ': ' + tempStr(w.min) + ' / ' + tempStr(w.max);

    // flags
    var f = status.flags || [], fh = '', i;
    for (i = 0; i < f.length; i++) { fh += '<span class="flag">' + esc(t.flags[f[i]] || f[i]) + '</span>'; }
    $('flags').innerHTML = fh;

    // ideas
    $('ideas-title').innerHTML = esc(t.ideas);
    var ideas = status.ideas || [], ih = '';
    if (!ideas.length) { ih = '<div class="idea card empty">' + esc(t.noIdeas) + '</div>'; }
    for (i = 0; i < ideas.length && i < 3; i++) {
      ih += '<div class="idea card"><div class="n">' + (i + 1) + '</div><div class="t">' + esc(ideas[i].name) + '</div>' +
        (ideas[i].why ? '<div class="w">' + esc(ideas[i].why) + '</div>' : '') + '</div>';
    }
    $('ideas').innerHTML = ih;
    setOffline(false);
    applyMode();
  }

  function renderApps() {
    var h = '', i, a;
    for (i = 0; i < APPS.length; i++) {
      a = APPS[i];
      h += '<div class="app card' + (a.diag ? ' q' : '') + (i === focusIdx ? ' focus' : '') + '" id="app-' + i + '">' +
        '<div class="ico" style="background:' + a.color + '">' + esc(a.letter) + '</div>' +
        '<div class="lbl">' + esc(a.label) + '</div></div>';
    }
    $('apps').innerHTML = h;
  }
  function setFocus(i) {
    if (i < 0 || i >= APPS.length) { return; }
    var old = $('app-' + focusIdx);
    if (old) { removeClass(old, 'focus'); }
    focusIdx = i;
    addClass($('app-' + i), 'focus');
  }

  // ---------- toast ----------
  function toast(msg) {
    var el = $('toast');
    el.innerHTML = esc(msg);
    addClass(el, 'show');
    if (toastTimer) { clearTimeout(toastTimer); }
    toastTimer = setTimeout(function () { removeClass(el, 'show'); }, 4500);
  }

  // ---------- launching ----------
  function hasTizenApp() { return !!(window.tizen && window.tizen.application && window.tizen.application.launch); }
  function launchApp(a) {
    if (a.diag) { openDiag(); return; }
    if (!hasTizenApp()) { toast(tr().noPlain); return; }
    if (!a.ids || !a.ids.length) { toast(tr().noId); return; }
    var idx = 0;
    toast(tr().launching + a.label + ' …');
    var next = function () {
      if (idx >= a.ids.length) { toast(tr().failed); return; }
      var id = a.ids[idx++];
      try {
        window.tizen.application.launch(id, function () { /* launched */ }, function () { next(); });
      } catch (e) { next(); }
    };
    next();
  }

  // ---------- diagnostics ----------
  function renderDiag() {
    var h = '', i, r, end = Math.min(diagRows.length, diagTop + 21);
    for (i = diagTop; i < end; i++) {
      r = diagRows[i];
      h += '<div class="drow"><b>' + esc(r.name) + '</b><span>' + esc(r.id) + '</span></div>';
    }
    if (!diagRows.length) { h = '<div class="drow">' + esc(diagMsg) + '</div>'; }
    $('diag-body').innerHTML = h;
    $('diag-hint').innerHTML = esc(tr().diagHint + (diagRows.length ? '   (' + (diagTop + 1) + '-' + end + ' / ' + diagRows.length + ')' : ''));
  }
  var diagMsg = '';
  function openDiag() {
    diagOpen = true; diagRows = []; diagTop = 0;
    $('diag-title').innerHTML = esc(tr().diag);
    addClass($('diag'), 'show');
    if (!(window.tizen && window.tizen.application && window.tizen.application.getAppsInfo)) {
      diagMsg = tr().diagNo; renderDiag(); return;
    }
    diagMsg = tr().diagWait; renderDiag();
    try {
      window.tizen.application.getAppsInfo(function (list) {
        var rows = [], i;
        for (i = 0; i < list.length; i++) { rows.push({ name: list[i].name || '?', id: list[i].id || '?' }); }
        rows.sort(function (a, b) { return String(a.name).toLowerCase() < String(b.name).toLowerCase() ? -1 : 1; });
        diagRows = rows; diagMsg = ''; renderDiag();
      }, function (e) { diagMsg = 'Error: ' + (e && e.message ? e.message : e); renderDiag(); });
    } catch (e2) { diagMsg = 'Error: ' + e2; renderDiag(); }
  }
  function closeDiag() { diagOpen = false; removeClass($('diag'), 'show'); }

  // ---------- keys ----------
  function onKey(e) {
    var k = e.keyCode;
    wakeUntil = new Date().getTime() + WAKE_MS;
    applyMode();
    if (diagOpen) {
      if (k === 10009 || k === 27 || k === 8 || k === 13) { closeDiag(); }
      else if (k === 40) { diagTop = Math.min(Math.max(0, diagRows.length - 21), diagTop + 10); renderDiag(); }
      else if (k === 38) { diagTop = Math.max(0, diagTop - 10); renderDiag(); }
      e.preventDefault();
      return;
    }
    if (k === 37) { setFocus(focusIdx - 1); }
    else if (k === 39) { setFocus(focusIdx + 1); }
    else if (k === 38 || k === 40) { /* single row */ }
    else if (k === 13) { launchApp(APPS[focusIdx]); }
    else if (k === 406 || k === 457 || k === 73) { openDiag(); }   // blue, info, "i"
    else if (k === 10009) {
      try { if (window.tizen && window.tizen.application) { window.tizen.application.getCurrentApplication().exit(); } } catch (e3) { }
    }
    else { return; }
    e.preventDefault();
  }

  // ---------- polling (JSONP-style script tag; works cross-origin without CORS) ----------
  var pollScript = null;
  var pollTimer = null;
  function statusUrl() { return window.TV_STATUS_URL || 'status.js'; }
  function onStatus(obj) {
    if (pollTimer) { clearTimeout(pollTimer); pollTimer = null; }
    if (obj && typeof obj === 'object') { status = obj; render(); } else { setOffline(true); }
  }
  window.TV_STATUS_CB = onStatus;
  function poll() {
    var head = document.getElementsByTagName('head')[0];
    if (pollScript && pollScript.parentNode) { pollScript.parentNode.removeChild(pollScript); }
    var s = document.createElement('script');
    var u = statusUrl();
    s.src = u + (u.indexOf('?') >= 0 ? '&' : '?') + 't=' + new Date().getTime();
    s.onerror = function () { setOffline(true); };
    pollScript = s;
    if (pollTimer) { clearTimeout(pollTimer); }
    pollTimer = setTimeout(function () { setOffline(true); }, 10000);
    head.appendChild(s);
  }

  function init() {
    try {
      if (window.tizen && window.tizen.tvinputdevice) {
        var names = ['ColorF0Red', 'ColorF1Green', 'ColorF2Yellow', 'ColorF3Blue', 'Info', 'MediaPlayPause', 'MediaPlay', 'MediaPause', 'MediaStop', 'MediaRewind', 'MediaFastForward'], i;
        for (i = 0; i < names.length; i++) { try { window.tizen.tvinputdevice.registerKey(names[i]); } catch (e) { } }
      }
    } catch (e1) { }
    setAccent('#a77bff');
    renderApps();
    document.addEventListener('keydown', onKey, false);
    tick();
    setInterval(tick, 1000);
    poll();
    setInterval(poll, POLL_MS);
  }
  init();
})();
