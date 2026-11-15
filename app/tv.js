/* TV dashboard - strict ES5 (Chromium M47 / Tizen 3.0). No arrow fns, let/const, template literals, fetch, Promise. */
(function () {
  'use strict';
  if (window.TV_LOADED) { return; }   // already started (live copy and bundled fallback must not both run)
  window.TV_LOADED = true;

  var POLL_MS = 30000;
  var STALE_S = 300;          // status older than 5 min -> "offline" marker
  var WAKE_MS = 60000;        // calm screen: show full UI this long after a key press

  // Home Assistant webhooks (see HA package tv_apps.yaml, local_only). Override with window.TV_HA_URL.
  var HA_URL = window.TV_HA_URL || 'http://192.168.68.58:8123';
  var WELCOME_MS = 20000;     // welcome overlay visible this long (or until a key is pressed)
  var WELCOME_MAX_AGE_S = 1860; // arrival older than ~30 min -> no welcome
  var COLS = 5;               // tiles per row (2 rows)

  // Tizen app IDs are tried first when window.tizen can launch apps (plain Tizen web app). Inside TizenBrew that API
  // is missing, so every tile falls back to the HA webhook, which selects the app on the TV media_player.
  var APPS = [
    { key: 'youtube', label: 'YouTube', hook: 'tv_app_youtube', letter: 'Y', color: '#e53935', ids: ['111299001912', '9Ur5IzDKqV.TizenYouTube'] },
    { key: 'netflix', label: 'Netflix', hook: 'tv_app_netflix', letter: 'N', color: '#c40f1a', ids: ['11101200001', '3201907018807', 'org.tizen.netflix-app'] },
    { key: 'prime', label: 'Prime Video', hook: 'tv_app_prime', letter: 'P', color: '#1799d8', ids: ['3201512006785', '3201910019365', 'org.tizen.primevideo'] },
    { key: 'iptv', label: 'IPTV', hook: 'tv_app_iptv', letter: 'TV', color: '#2e9b6a', ids: [] },
    { key: 'disney', label: 'Disney+', hook: 'tv_app_disney', letter: 'D', color: '#1f3fa8', ids: ['3201901017640'] },
    { key: 'zattoo', label: 'Zattoo', hook: 'tv_app_zattoo', letter: 'Z', color: '#e07b00', ids: [] },
    { key: 'ard', label: 'ARD', hook: 'tv_app_ard', letter: 'A', color: '#0a4b9c', ids: [] },
    { key: 'zdf', label: 'ZDF', hook: 'tv_app_zdf', letter: 'ZDF', color: '#d9650e', ids: [] },
    { key: 'spotify', label: 'Spotify', hook: 'tv_app_spotify', letter: 'S', color: '#1a9e48', ids: [] },
    { key: 'diag', label: '?', letter: '?', color: '#3a3f57', diag: true }
  ];

  var T = {
    de: {
      welcome: 'Willkommen zuhause, ', wWeather: 'Wetter morgen', wToday: 'Heute noch', wTomorrow: 'Morgen', wIdea: 'Ausflugsidee', wWaste: 'Nächste Abfuhr',
      wNoEv: 'Keine Termine', wAllDay: 'ganztägig', wHint: 'Beliebige Taste = schließen', wRange: 'Tief / Hoch', dToday: 'heute', dTomorrow: 'morgen', dIn: function (n) { return 'in ' + n + ' Tagen'; },
      launching: 'Startet ',
      ideas: 'Ideen für heute', noIdeas: 'Keine Ideen gerade',
      range: 'Tief / Hoch', home: 'zuhause', away: 'unterwegs', offline: 'Keine aktuellen Daten',
      diag: 'Diagnose: installierte Apps (Name / ID)', diagHint: 'Zurück = schließen   ↑↓ = blättern',
      diagNo: 'Tizen-API nicht verfügbar (normaler Browser).', diagWait: 'Lade …',
      cond: { 'clear-night': 'Klare Nacht', cloudy: 'Bewölkt', exceptional: 'Ausnahmewetter', fog: 'Nebel', hail: 'Hagel', lightning: 'Gewitter', 'lightning-rainy': 'Gewitter mit Regen', partlycloudy: 'Wolkig', pouring: 'Starkregen', rainy: 'Regen', snowy: 'Schnee', 'snowy-rainy': 'Schneeregen', sunny: 'Sonnig', windy: 'Windig', 'windy-variant': 'Windig und wolkig', unknown: 'Wetter unbekannt', unavailable: 'Wetter nicht verfügbar' },
      flags: { storm: 'Wichtig jetzt: Gewitter', hail: 'Wichtig jetzt: Hagel', exceptional: 'Wichtig jetzt: Unwetterlage', heat: 'Wichtig jetzt: große Hitze', frost: 'Wichtig jetzt: strenger Frost', wind: 'Wichtig jetzt: starker Wind' }
    },
    en: {
      welcome: 'Welcome home, ', wWeather: 'Weather tomorrow', wToday: 'Rest of today', wTomorrow: 'Tomorrow', wIdea: 'Outing idea', wWaste: 'Next waste pickup',
      wNoEv: 'No appointments', wAllDay: 'all day', wHint: 'Any key = close', wRange: 'Low / High', dToday: 'today', dTomorrow: 'tomorrow', dIn: function (n) { return 'in ' + n + ' days'; },
      launching: 'Starting ',
      ideas: 'Ideas for today', noIdeas: 'No ideas right now',
      range: 'Low / High', home: 'home', away: 'away', offline: 'No current data',
      diag: 'Diagnostics: installed apps (name / ID)', diagHint: 'Back = close   Up/Down = scroll',
      diagNo: 'Tizen API not available (plain browser).', diagWait: 'Loading …',
      cond: { 'clear-night': 'Clear night', cloudy: 'Cloudy', exceptional: 'Exceptional', fog: 'Fog', hail: 'Hail', lightning: 'Thunderstorm', 'lightning-rainy': 'Thunderstorm with rain', partlycloudy: 'Partly cloudy', pouring: 'Pouring rain', rainy: 'Rain', snowy: 'Snow', 'snowy-rainy': 'Sleet', sunny: 'Sunny', windy: 'Windy', 'windy-variant': 'Windy and cloudy', unknown: 'Weather unknown', unavailable: 'Weather unavailable' },
      flags: { storm: 'Important now: thunderstorm', hail: 'Important now: hail', exceptional: 'Important now: severe weather', heat: 'Important now: extreme heat', frost: 'Important now: hard frost', wind: 'Important now: strong wind' }
    },
    es: {
      welcome: 'Bienvenido a casa, ', wWeather: 'Tiempo de mañana', wToday: 'Resto de hoy', wTomorrow: 'Mañana', wIdea: 'Idea de excursión', wWaste: 'Próxima recogida de basura',
      wNoEv: 'Sin citas', wAllDay: 'todo el día', wHint: 'Cualquier tecla = cerrar', wRange: 'Mín / Máx', dToday: 'hoy', dTomorrow: 'mañana', dIn: function (n) { return 'en ' + n + ' días'; },
      launching: 'Iniciando ',
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
  var welcomeOpen = false;
  var welcomeTimer = null;
  var welcomeShownFor = null;
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
    fotoTick(s);
    maybeReload();
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
    var gtxt = (typeof status.greeting === 'string') ? status.greeting : (status.greeting_text || '');
    $('greet').innerHTML = esc(gtxt + (names.length ? ', ' + names.join(' & ') : ''));
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
    try { setRadarChip(); } catch (eRc) { }

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
    fotoTexts();
    maybeWelcome();
  }

  function renderApps() {
    var h = '', i, a;
    for (i = 0; i < APPS.length; i++) {
      a = APPS[i];
      if (i % COLS === 0) { h += '<div class="arow">'; }
      h += '<div class="app card' + (a.diag ? ' q' : '') + (i === focusIdx ? ' focus' : '') + '" id="app-' + i + '">' +
        '<div class="ico" style="background:' + a.color + '">' + esc(a.letter) + '</div>' +
        '<div class="lbl">' + esc(a.label) + '</div></div>';
      if (i % COLS === COLS - 1 || i === APPS.length - 1) { h += '</div>'; }
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
  var hookImg = null;
  function callHook(a) {
    if (!a.hook) { return; }
    try {
      // image request = simple GET, no CORS preflight; the response body is irrelevant
      hookImg = new Image();
      hookImg.src = HA_URL + '/api/webhook/' + a.hook + '?t=' + new Date().getTime();
    } catch (e) { }
  }
  function launchApp(a) {
    if (a.diag) { openDiag(); return; }
    toast(tr().launching + a.label + ' …');
    if (a.key === 'youtube') { launchTizenTube(a); return; }   // TizenTube if installed, else webhook fallback
    if (!hasTizenApp() || !a.ids || !a.ids.length) { callHook(a); return; }
    var idx = 0;
    var next = function () {
      if (idx >= a.ids.length) { callHook(a); return; }
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


  // ---------- welcome overlay (someone came home within ~30 min) ----------
  function dayDiff(iso) {
    var m = /^(\d{4})-(\d\d)-(\d\d)/.exec(iso || '');
    if (!m) { return null; }
    var d = new Date(+m[1], +m[2] - 1, +m[3]);
    var n = new Date();
    n = new Date(n.getFullYear(), n.getMonth(), n.getDate());
    return Math.round((d.getTime() - n.getTime()) / 86400000);
  }
  function wasteText(w) {
    var t = tr(), diff = dayDiff(w.date), when = '';
    if (diff === null) { return esc(w.label ? w.label + ': ' + w.value : w.value); }
    if (diff < 0) { return ''; }
    when = diff === 0 ? t.dToday : (diff === 1 ? t.dTomorrow : t.dIn(diff));
    var d = new Date(+w.date.substr(0, 4), +w.date.substr(5, 2) - 1, +w.date.substr(8, 2));
    return esc((w.label ? w.label + ': ' : '') + when + ' (' + DAYS[lang][d.getDay()].substr(0, 2) + ' ' + pad(d.getDate()) + '.' + pad(d.getMonth() + 1) + '.)');
  }
  function evList(list) {
    var h = '', i, e, t = tr();
    for (i = 0; i < list.length && i < 4; i++) {
      e = list[i];
      h += '<div class="wev"><span class="wt">' + esc(e.time || t.wAllDay) + '</span><span class="wn">' + esc(e.title) + '</span></div>';
    }
    return h;
  }
  function welcomeHtml(g) {
    var t = tr(), h = '', w = g.weather_tomorrow, ev = g.events || {}, left = '', right = '', i;
    h += '<div class="wtitle">' + esc(t.welcome + g.who.join(' & ')) + '</div><div class="wcols"><div class="wcol">';
    if (w && (num(w.min) !== null || num(w.max) !== null || w.condition)) {
      left += '<div class="wcard card"><div class="wh">' + esc(t.wWeather) + '</div><div class="wbig">' + esc(t.cond[w.condition] || w.condition || '') + '</div>' +
        '<div class="wsub">' + esc(t.wRange) + ': ' + tempStr(w.min) + ' / ' + tempStr(w.max) + '</div></div>';
    }
    if (g.idea && g.idea.name) {
      left += '<div class="wcard card"><div class="wh">' + esc(t.wIdea) + '</div><div class="wbig">' + esc(g.idea.name) + '</div>' +
        (g.idea.why ? '<div class="wsub">' + esc(g.idea.why) + '</div>' : '') + '</div>';
    }
    var wl = g.waste || [], wt = '', one;
    for (i = 0; i < wl.length; i++) {
      one = wasteText(wl[i]);
      if (one) { wt += '<div class="wsub wwaste">' + one + '</div>'; }
    }
    if (wt) { left += '<div class="wcard card"><div class="wh">' + esc(t.wWaste) + '</div>' + wt + '</div>'; }
    h += left + '</div><div class="wcol">';
    if (g.events) {
      right += '<div class="wcard card"><div class="wh">' + esc(t.wToday) + '</div>' + (ev.today ? evList(ev.today) : '<div class="wsub">' + esc(t.wNoEv) + '</div>') + '</div>';
      right += '<div class="wcard card"><div class="wh">' + esc(t.wTomorrow) + '</div>' + (ev.tomorrow ? evList(ev.tomorrow) : '<div class="wsub">' + esc(t.wNoEv) + '</div>') + '</div>';
    }
    h += right + '</div></div><div class="whint">' + esc(t.wHint) + '</div>';
    return h;
  }
  function hideWelcome() {
    welcomeOpen = false;
    if (welcomeTimer) { clearTimeout(welcomeTimer); welcomeTimer = null; }
    var el = $('welcome');
    if (el) { removeClass(el, 'show'); }
  }
  function maybeWelcome() {
    try {
      var g = status && status.greeting;
      if (!g || typeof g !== 'object' || !g.who || !g.who.length || !g.since) { return; }
      if (welcomeShownFor === g.since || welcomeOpen || diagOpen) { return; }
      if (new Date().getTime() / 1000 - g.since > WELCOME_MAX_AGE_S) { return; }
      fotoPause();
      var el = $('welcome');
      if (!el) {
        el = document.createElement('div');
        el.id = 'welcome';
        $('screen').appendChild(el);
      }
      el.innerHTML = welcomeHtml(g);
      welcomeShownFor = g.since;
      welcomeOpen = true;
      addClass(el, 'show');
      if (welcomeTimer) { clearTimeout(welcomeTimer); }
      welcomeTimer = setTimeout(hideWelcome, WELCOME_MS);
    } catch (e) { hideWelcome(); }   // never break the dashboard
  }

  // ---------- photos: Immich screensaver + QR photo beaming (server: tv-fotos on :8095) ----------
  var FOTO_BASE = window.TV_FOTO_BASE || 'http://192.168.68.58:8095';
  var FOTO_STATE_MS = 3000;     // poll for beamed photos
  var SLIDES_MS = 600000;       // refresh album list
  var SLIDE_MS = window.TV_SLIDE_MS || 10000;   // screensaver: time per photo
  var BEAM_MS = 15000;          // beamed photo stays this long ...
  var BEAM_MIN_MS = 6000;       // ... but at least this long when more are waiting
  var BLANK = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
  var FT = {
    de: { qt: 'Fotos aufs TV senden', qs: 'QR-Code scannen (WLAN DMRooftop)', from: 'von ' },
    en: { qt: 'Send photos to the TV', qs: 'Scan the QR code (Wi-Fi DMRooftop)', from: 'from ' },
    es: { qt: 'Enviar fotos a la TV', qs: 'Escanea el QR (WiFi DMRooftop)', from: 'de ' }
  };
  var fState = { saver: true, idleMin: window.TV_IDLE_MIN || 5 };
  var slides = [], slideOrder = [], slidePos = 0, slidesBusy = false, slidesAt = 0;
  var lastKeyAt = new Date().getTime();
  var fo = { on: false, mode: null, saver: false, front: 0, layers: null, timer: null, fails: 0, shownAt: 0, cooldown: 0, ready: null, seq: 0 };
  var beamQ = [], seenShares = {}, firstState = true, qrPath = '', fotoStScript = null, fotoSlScript = null;

  function fotoUrl(p) { return FOTO_BASE + p; }
  function ftr() { return FT[lang] || FT.de; }

  function buildFoto() {
    var scr = $('screen'), el = document.createElement('div'), i, h = '';
    el.id = 'foto';
    for (i = 0; i < 2; i++) { h += '<div class="flayer" id="fl' + i + '"><div class="fbg"></div><img class="fimg contain" alt="" src="' + BLANK + '"></div>'; }
    h += '<div id="fclock"></div><div id="fcap"></div><div id="fqr"></div>';
    el.innerHTML = h;
    scr.appendChild(el);
    fo.layers = [];
    for (i = 0; i < 2; i++) {
      var l = $('fl' + i);
      fo.layers.push({ el: l, bg: l.firstChild, img: l.lastChild, url: '', gen: 0 });
    }
    var q = document.createElement('div');
    q.id = 'qrcard'; q.className = 'card';
    q.innerHTML = '<div id="qrimg"></div><div id="qrtxt"><div id="qt1"></div><div id="qt2"></div></div>';
    $('left').appendChild(q);
    fotoTexts();
  }
  function fotoTexts() {
    var t = ftr();
    if ($('qt1')) { $('qt1').innerHTML = esc(t.qt); $('qt2').innerHTML = esc(t.qs); }
  }
  function setQr(path) {
    if (!path || path === qrPath) { return; }
    qrPath = path;
    var u = 'url(' + fotoUrl(path) + ')';
    $('qrimg').style.backgroundImage = u;
    $('fqr').style.backgroundImage = u;
    addClass($('qrcard'), 'has');
    addClass($('fqr'), 'has');
  }

  function clearLayer(i) {
    var L = fo.layers[i];
    L.gen++;
    L.img.onload = L.img.onerror = null;
    L.img.src = BLANK;
    L.bg.style.backgroundImage = 'none';
    L.url = '';
  }
  function fitLayer(L) {
    var w = L.img.naturalWidth, h = L.img.naturalHeight, r = (w && h) ? w / h : 1.78;
    var fill = (r >= 1.6 && r <= 1.95);          // ~16:9 fills the screen; everything else: contain over a blurred copy
    L.img.className = 'fimg ' + (fill ? 'cover' : 'contain');
    L.bg.style.backgroundImage = fill ? 'none' : 'url("' + L.url + '")';
  }
  function loadInto(i, url, done) {
    var L = fo.layers[i];
    L.gen++;
    L.url = url;
    L.img.onload = function () { L.img.onload = L.img.onerror = null; fitLayer(L); done(true); };
    L.img.onerror = function () { L.img.onload = L.img.onerror = null; done(false); };
    L.img.src = url;
  }
  function flipTo(i) {
    var old = fo.front, oldGen = fo.layers[old].gen;
    fo.layers[i].el.style.zIndex = '2';
    fo.layers[old].el.style.zIndex = '1';
    addClass(fo.layers[i].el, 'on');
    fo.front = i;
    setTimeout(function () {
      if (fo.front !== old && fo.layers[old].gen === oldGen) { removeClass(fo.layers[old].el, 'on'); clearLayer(old); }
    }, 1500);
  }
  function setCaption(txt) {
    $('fcap').innerHTML = txt ? '<span>' + esc(txt) + '</span>' : '';
  }
  function fotoSchedule(ms) {
    if (fo.timer) { clearTimeout(fo.timer); }
    fo.timer = setTimeout(fotoAdvance, ms);
  }
  function openFoto() {
    if (fo.on) { return; }
    var el = $('foto');
    fo.on = true;
    el.style.display = 'block';
    void el.offsetWidth;
    addClass(el, 'show');
  }
  function closeFoto() {
    var el = $('foto');
    if (fo.timer) { clearTimeout(fo.timer); fo.timer = null; }
    fo.seq++;
    fo.on = false; fo.mode = null; fo.saver = false; fo.ready = null;
    beamQ = [];
    removeClass(el, 'show');
    setTimeout(function () {
      if (fo.on) { return; }
      el.style.display = 'none';
      removeClass(fo.layers[0].el, 'on'); removeClass(fo.layers[1].el, 'on');
      clearLayer(0); clearLayer(1);
      setCaption('');
    }, 700);
  }
  function fotoPause() {         // someone arrived (welcome overlay): leave the screensaver, beamed photos stay
    lastKeyAt = new Date().getTime();
    if (fo.on && fo.mode === 'saver') { closeFoto(); }
  }

  function shuffleSlides() {
    var a = [], i, j, t;
    for (i = 0; i < slides.length; i++) { a.push(i); }
    for (i = a.length - 1; i > 0; i--) { j = Math.floor(Math.random() * (i + 1)); t = a[i]; a[i] = a[j]; a[j] = t; }
    slideOrder = a; slidePos = 0;
  }
  function takeSlide() {
    if (!slides.length) { return null; }
    if (slidePos >= slideOrder.length) { shuffleSlides(); }
    return fotoUrl(slides[slideOrder[slidePos++]]);
  }

  function present(i, caption, dwell) {
    flipTo(i);
    fo.fails = 0;
    fo.shownAt = new Date().getTime();
    setCaption(caption);
    fotoSchedule(dwell);
    if (fo.mode === 'saver') {
      var seq = fo.seq;
      setTimeout(function () { prepareNext(seq); }, 1700);
    }
  }
  function prepareNext(seq) {       // preload the next photo into the hidden layer
    if (!fo.on || fo.mode !== 'saver' || seq !== fo.seq) { return; }
    var i = 1 - fo.front, url = takeSlide();
    fo.ready = null;
    if (!url) { return; }
    loadInto(i, url, function (ok) { if (seq === fo.seq) { fo.ready = { idx: i, ok: ok }; } });
  }
  function saverFailed() {
    fo.fails++;
    if (fo.fails >= 3) {            // server gone: back to the normal dashboard, try again in 10 min
      closeFoto();
      fo.cooldown = new Date().getTime() + 600000;
      slides = [];
      return;
    }
    saverStep();
  }
  function saverStep() {
    var i = 1 - fo.front, seq = ++fo.seq, r = fo.ready, url;
    fo.ready = null;
    if (r && r.ok && r.idx === i) { present(i, '', SLIDE_MS); return; }
    if (r && !r.ok) { fo.fails++; }
    url = takeSlide();
    if (!url) { closeFoto(); return; }
    fotoSchedule(15000);            // safety net if the load hangs
    loadInto(i, url, function (ok) {
      if (seq !== fo.seq) { return; }
      if (ok) { present(i, '', SLIDE_MS); } else { saverFailed(); }
    });
  }
  function showBeam(it) {
    var i = 1 - fo.front, seq;
    openFoto();
    fo.mode = 'beam';
    fo.ready = null;
    seq = ++fo.seq;
    fotoSchedule(20000);            // safety net
    loadInto(i, fotoUrl(it.u), function (ok) {
      if (seq !== fo.seq) { return; }
      if (ok) { present(i, it.n ? ftr().from + it.n : '', BEAM_MS); } else { fotoAdvance(); }
    });
  }
  function fotoAdvance() {
    fo.timer = null;
    if (beamQ.length) { showBeam(beamQ.shift()); return; }
    if (fo.mode === 'beam') {
      if (fo.saver && slides.length) { fo.mode = 'saver'; setCaption(''); saverStep(); } else { closeFoto(); }
      return;
    }
    if (fo.mode === 'saver') { saverStep(); }
  }
  function enqueueBeam(it) {
    beamQ.push(it);
    if (fo.on && fo.mode === 'beam') {
      var wait = BEAM_MIN_MS - (new Date().getTime() - fo.shownAt);
      fotoSchedule(wait > 0 ? wait : 0);
    } else {
      fotoAdvance();
    }
  }
  function startSaver() {
    var now = new Date().getTime();
    if (!fState.saver || !slides.length || now < fo.cooldown || welcomeOpen || diagOpen || radarOpen || calmNow()) { return; }
    shuffleSlides();
    fo.saver = true; fo.mode = 'saver'; fo.fails = 0; fo.ready = null;
    openFoto();
    saverStep();
  }
  function fotoTick(hhmm) {
    if (fo.on) { $('fclock').innerHTML = hhmm; return; }
    if (new Date().getTime() - lastKeyAt >= fState.idleMin * 60000) { startSaver(); }
  }

  // JSONP polling (same technique as status.js: works cross-origin without CORS)
  window.TV_FOTO_STATE_CB = function (o) {
    if (!o || typeof o !== 'object') { return; }
    fState.saver = o.saver !== false;
    var m = parseInt(o.idle_min, 10);
    if (m >= 1 && m <= 120) { fState.idleMin = m; }
    setQr(o.qr);
    var sh = o.shares || [], seen = {}, i, id;
    for (i = 0; i < sh.length; i++) {
      id = sh[i].id;
      seen[id] = 1;
      if (!seenShares[id]) {
        seenShares[id] = 1;
        if (!firstState || (o.now - sh[i].t) <= 20) { enqueueBeam(sh[i]); }    // at start-up only replay brand-new photos
      }
    }
    seenShares = seen;
    firstState = false;
    if (o.photos && !slides.length && !slidesBusy && new Date().getTime() - slidesAt > 30000) { fetchSlides(); }
  };
  window.TV_FOTO_SLIDES_CB = function (o) {
    slidesBusy = false;
    if (o && o.items && o.items.length) { slides = o.items; shuffleSlides(); }
  };
  function loadScript(path, prev, cb) {
    var head = document.getElementsByTagName('head')[0];
    if (prev && prev.parentNode) { prev.parentNode.removeChild(prev); }
    var s = document.createElement('script');
    s.src = fotoUrl(path) + '?t=' + new Date().getTime();
    s.onerror = cb;
    head.appendChild(s);
    return s;
  }
  function pollFoto() { fotoStScript = loadScript('/state.js', fotoStScript, function () { }); }
  function fetchSlides() {
    slidesBusy = true; slidesAt = new Date().getTime();
    fotoSlScript = loadScript('/slides.js', fotoSlScript, function () { slidesBusy = false; });
  }

  // ---------- TizenTube (ad-free YouTube) via TizenBrew's local WebSocket API ----------
  var TB_WS = 'ws://127.0.0.1:8081';
  var TT_MISSING = { de: 'TizenTube nicht installiert \u2013 normales YouTube', en: 'TizenTube not installed \u2013 regular YouTube', es: 'TizenTube no instalado \u2013 YouTube normal' };
  // cb(ws, list): list is the module array, or null when the service is unreachable / not ready (ws may be null)
  function tbGetModules(cb) {
    var ws = null, tries = 0, done = false, timer = null;
    function finish(list) {
      if (done) { return; }
      done = true;
      if (timer) { clearTimeout(timer); }
      cb(ws, list);
    }
    function ask() {
      try { ws.send(JSON.stringify({ type: 4, payload: false })); } catch (e) { finish(null); }
    }
    try {
      if (!window.WebSocket) { cb(null, null); return; }
      ws = new WebSocket(TB_WS);
    } catch (e1) { cb(null, null); return; }
    ws.onerror = function () { finish(null); };
    ws.onclose = function () { finish(null); };
    ws.onopen = function () { ask(); };
    ws.onmessage = function (m) {
      var d;
      try { d = JSON.parse(m.data); } catch (e2) { return; }
      if (!d) { return; }
      if (d.type === 8) { finish(null); return; }
      if (d.type === 4) {
        if (d.payload && typeof d.payload.length === 'number') { finish(d.payload); }
        else {                       // null: module cache not ready yet
          tries++;
          if (tries >= 20) { finish(null); } else { timer = setTimeout(ask, 500); }
        }
      }
    };
    setTimeout(function () { finish(null); }, 15000);
  }
  function tbFind(list, test) {
    var i;
    for (i = 0; list && i < list.length; i++) { if (list[i] && test(String(list[i].fullName || ''))) { return list[i]; } }
    return null;
  }
  function launchTizenTube(a) {
    try {
      tbGetModules(function (ws, list) {
        var mod = tbFind(list, function (n) { return n === 'npm/@foxreis/tizentube'; }), i;
        try {
          if (!mod || !mod.appPath) {
            try { if (ws) { ws.close(); } } catch (e0) { }
            toast(TT_MISSING[lang] || TT_MISSING.de);
            callHook(a);
            return;
          }
          if (window.tizen && window.tizen.tvinputdevice && mod.keys) {
            for (i = 0; i < mod.keys.length; i++) { try { window.tizen.tvinputdevice.registerKey(mod.keys[i]); } catch (e1) { } }
          }
          ws.send(JSON.stringify({ type: 5, payload: mod }));
          setTimeout(function () { window.location.href = mod.appPath; }, 300);
        } catch (e2) { toast(TT_MISSING[lang] || TT_MISSING.de); callHook(a); }
      });
    } catch (e3) { callHook(a); }
  }
  // Coming back from TizenTube, TizenBrew's current module is still TizenTube and would inject its script into
  // this page. Re-launching our own module (an "app" package, so it does not navigate) resets that.
  function tbSelfRelaunch() {
    try {
      if (String(window.location.host) !== '127.0.0.1:8081') { return; }
      tbGetModules(function (ws, list) {
        var me = tbFind(list, function (n) { return n.indexOf('tv-dashboard') >= 0; });
        try { if (me && ws) { ws.send(JSON.stringify({ type: 5, payload: me })); } } catch (e) { }
        setTimeout(function () { try { if (ws) { ws.close(); } } catch (e2) { } }, 800);
      });
    } catch (e3) { }
  }

  // ---------- flight radar overlay (green key / "R"; data: radar.js written by tools/flugradar.py) ----------
  var RADAR_POLL_MS = 30000;      // chip refresh while closed
  var RADAR_OPEN_POLL_MS = 15000; // refresh while the overlay is open
  var RADAR_AUTOCLOSE_MS = 300000;
  var RT = {
    de: { title: 'Flugradar', empty: 'Gerade keine Flugzeuge im Umkreis', stale: 'Daten veraltet', unknown: 'Route unbekannt', ground: 'am Boden', mfr: 'Hersteller', mdl: 'Modell', built: 'Baujahr', reg: 'Kennz.', op: 'Betreiber', unk: 'Unbekannt', refimg: 'Vergleichsbild', imgby: 'Bild: ', imglic: ' (Lizenz lt. Quelle)', seats: 'Sitze', sqk: 'Squawk ', mil: 'Milit\u00e4r/Beh\u00f6rde', mpm: ' m/min',
      sqe: { '7500': 'Entf\u00fchrung', '7600': 'Funkausfall', '7700': 'Notfall' },
      eng: { P: 'Kolbenmotor', T: 'Turboprop', J: 'Jet', S: 'Turbine' },
      kat: { A1: 'Leichtflugzeug', A2: 'Kleinflugzeug', A3: 'Verkehrsflugzeug', A4: 'Verkehrsflugzeug', A5: 'Gro\u00dfraumflugzeug', A6: 'Hochleistungsflugzeug', A7: 'Hubschrauber', B1: 'Segelflugzeug', B2: 'Ballon', B4: 'Ultraleichtflugzeug', B6: 'Drohne' },
      count: function (n) { return n + (n === 1 ? ' Flugzeug' : ' Flugzeuge') + ' im Umkreis von 25 km'; }, chip: 'Flugradar: ', hint: 'Beliebige Taste = schließen', n: 'N' },
    en: { title: 'Flight radar', empty: 'No aircraft nearby right now', stale: 'Data outdated', unknown: 'Route unknown', ground: 'on ground', mfr: 'Manufacturer', mdl: 'Model', built: 'Built', reg: 'Reg.', op: 'Operator', unk: 'Unknown', refimg: 'Reference image', imgby: 'Image: ', imglic: ' (license per source)', seats: 'seats', sqk: 'Squawk ', mil: 'Military/Government', mpm: ' m/min',
      sqe: { '7500': 'Hijack', '7600': 'Radio failure', '7700': 'Emergency' },
      eng: { P: 'piston engine', T: 'turboprop', J: 'jet', S: 'turbine' },
      kat: { A1: 'Light aircraft', A2: 'Small aircraft', A3: 'Airliner', A4: 'Airliner', A5: 'Heavy aircraft', A6: 'High performance', A7: 'Helicopter', B1: 'Glider', B2: 'Balloon', B4: 'Ultralight', B6: 'Drone' },
      count: function (n) { return n + ' aircraft within 25 km'; }, chip: 'Flight radar: ', hint: 'Any key = close', n: 'N' },
    es: { title: 'Radar de vuelos', empty: 'Ahora mismo no hay aviones en los alrededores', stale: 'Datos desactualizados', unknown: 'Ruta desconocida', ground: 'en tierra', mfr: 'Fabricante', mdl: 'Modelo', built: 'Año', reg: 'Matr.', op: 'Operador', unk: 'Desconocido', refimg: 'Imagen de referencia', imgby: 'Imagen: ', imglic: ' (licencia seg\u00fan la fuente)', seats: 'plazas', sqk: 'Squawk ', mil: 'Militar/Autoridad', mpm: ' m/min',
      sqe: { '7500': 'Secuestro', '7600': 'Fallo de radio', '7700': 'Emergencia' },
      eng: { P: 'motor de pist\u00f3n', T: 'turbohélice', J: 'reactor', S: 'turbina' },
      kat: { A1: 'Avi\u00f3n ligero', A2: 'Avi\u00f3n peque\u00f1o', A3: 'Avi\u00f3n de l\u00ednea', A4: 'Avi\u00f3n de l\u00ednea', A5: 'Avi\u00f3n grande', A6: 'Alto rendimiento', A7: 'Helic\u00f3ptero', B1: 'Planeador', B2: 'Globo', B4: 'Ultraligero', B6: 'Dron' },
      count: function (n) { return n + (n === 1 ? ' avión' : ' aviones') + ' en 25 km'; }, chip: 'Radar de vuelos: ', hint: 'Cualquier tecla = cerrar', n: 'N' }
  };
  var radarOpen = false, radarBuilt = false, radarData = null, radarScript = null, radarTimer = null, radarCloseTimer = null, radarSig = '';
  var RPATH = 'M0,-10 L2,-3 L10,2 L10,4 L2,2 L2,7 L5,9 L5,10 L0,9 L-5,10 L-5,9 L-2,7 L-2,2 L-10,4 L-10,2 L-2,-3 Z';
  function rtr() { return RT[lang] || RT.de; }
  function radarUrl() {
    if (window.TV_RADAR_URL) { return window.TV_RADAR_URL; }
    return statusUrl().replace(/status\.js/, 'radar.js');
  }
  function radarStale() {
    return !radarData || radarData.veraltet === true || (new Date().getTime() / 1000 - (radarData.epoch || 0)) > 150;
  }
  function radarList() {
    var l = radarData && radarData.flugzeuge;
    return (l && l.length) ? l : [];
  }
  function setRadarChip() {
    var old = $('rchip'), c = $('chips'), n = radarList().length;
    if (old && old.parentNode) { old.parentNode.removeChild(old); }
    if (!c || !n || radarStale()) { return; }
    var s = document.createElement('span');
    s.id = 'rchip';
    s.className = 'chip on';
    s.innerHTML = esc(rtr().chip + n);
    c.appendChild(s);
  }
  window.TV_RADAR_CB = function (o) {
    if (!o || typeof o !== 'object') { return; }
    radarData = o;
    try { setRadarChip(); if (radarOpen) { renderRadar(); } } catch (e) { }
  };
  function pollRadar() {
    var head = document.getElementsByTagName('head')[0];
    if (radarScript && radarScript.parentNode) { radarScript.parentNode.removeChild(radarScript); }
    var s = document.createElement('script'), u = radarUrl();
    s.src = u + (u.indexOf('?') >= 0 ? '&' : '?') + 't=' + new Date().getTime();
    s.onerror = function () { };
    radarScript = s;
    head.appendChild(s);
  }
  function buildRadar() {
    var R = 180, C = 200, rings = '', i, km, r;
    for (i = 1; i <= 5; i++) {
      km = i * 5; r = R * km / 25;
      rings += '<circle cx="' + C + '" cy="' + C + '" r="' + r + '" class="rr"/><text x="' + (C + 4) + '" y="' + (C - r + 12) + '" class="rrl">' + km + ' km</text>';
    }
    var wx = (C - R * Math.sin(0.9)).toFixed(1), wy = (C - R * Math.cos(0.9)).toFixed(1);
    var el = document.createElement('div');
    el.id = 'radar';
    el.innerHTML = '<div id="r-title"></div><div id="r-count"></div><div id="r-stale"></div>' +
      '<div id="r-disc"><svg viewBox="0 0 400 400" width="780" height="780" xmlns="http://www.w3.org/2000/svg">' +
      '<defs><linearGradient id="rsg" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#7CFFA8" stop-opacity="0"/><stop offset="1" stop-color="#7CFFA8" stop-opacity="0.4"/></linearGradient></defs>' +
      '<circle cx="' + C + '" cy="' + C + '" r="' + (R + 6) + '" class="rbg"/>' +
      '<line x1="' + C + '" y1="' + (C - R) + '" x2="' + C + '" y2="' + (C + R) + '" class="rax"/>' +
      '<line x1="' + (C - R) + '" y1="' + C + '" x2="' + (C + R) + '" y2="' + C + '" class="rax"/>' + rings +
      '<g id="r-sweep"><path d="M' + C + ',' + C + ' L' + C + ',' + (C - R) + ' A' + R + ',' + R + ' 0 0 0 ' + wx + ',' + wy + ' Z" fill="url(#rsg)"/>' +
      '<animateTransform attributeName="transform" type="rotate" from="0 ' + C + ' ' + C + '" to="360 ' + C + ' ' + C + '" dur="6s" repeatCount="indefinite"/></g>' +
      '<text x="' + C + '" y="' + (C - R - 9) + '" class="rnorth" id="r-n">N</text>' +
      '<circle cx="' + C + '" cy="' + C + '" r="4" class="rhome"/><g id="r-pl"></g></svg></div>' +
      '<div id="r-list"></div><div id="r-hint"></div>';
    $('screen').appendChild(el);
    radarBuilt = true;
  }
  function radarKv(label, val, t) {
    var has = val !== undefined && val !== null && val !== '';
    return '<div class="rkv"><span class="rkl">' + esc(label) + '</span> ' + (has ? esc(String(val)) : '<span class="rdim">' + esc(t.unk) + '</span>') + '</div>';
  }
  function radarBase() { return radarUrl().replace(/radar\.js.*$/, ''); }
  function radarPic(p) {
    var sil = '<svg class="rsil" viewBox="-12 -12 24 24" width="100" height="100" xmlns="http://www.w3.org/2000/svg"><path d="' + RPATH + '" fill="#2f5a43"/></svg>' +
      '<div class="rsilt">' + esc(p.typ_name || p.typ || '') + '</div>';
    var src = p.bild || p.typ_bild;
    if (!src) { return sil; }
    return sil + '<img src="' + esc(radarBase() + src) + '" width="200" height="133" alt="" onerror="this.style.display=\'none\'">' +
      (p.bild ? '' : '<div class="rrefl">' + esc(rtr().refimg) + '</div>');
  }
  function radarCredit(p, t) {
    if (p.bild) { return p.bild_credit || ''; }
    if (!p.typ_bild) { return ''; }
    return t.imgby + (p.typ_credit ? p.typ_credit + ' / Wikimedia Commons' : 'Wikipedia/Wikimedia' + t.imglic);
  }
  function radarFacts(p, t) {
    var f = [], sq = String(p.sq || ''), n;
    if (t.sqe[sq]) { f.push({ x: t.sqk + sq + ' \u00b7 ' + t.sqe[sq], c: 'rbad' }); }
    if (p.mil) { f.push({ x: t.mil, c: 'rmil' }); }
    if (p.antrieb_n && t.eng[p.antrieb_art]) {
      n = p.sitze ? Number(p.sitze) : 0;
      f.push({ x: p.antrieb_n + '\u00d7 ' + t.eng[p.antrieb_art] + (n ? ' \u00b7 ' + (n > 10 ? '~' : '') + n + ' ' + t.seats : ''), c: '' });
    }
    if (p.baujahr) { f.push({ x: t.built + ' ' + p.baujahr, c: '' }); }
    if (p.vrate_mpm !== undefined && p.vrate_mpm !== '' && p.vrate_mpm !== null) {
      f.push({ x: (p.vrate_mpm > 0 ? '\u2197 +' : '\u2198 ') + p.vrate_mpm + t.mpm, c: '' });
    }
    if (p.kat && t.kat[p.kat]) { f.push({ x: t.kat[p.kat], c: '' }); }
    if (sq && !t.sqe[sq] && sq !== '0000') { f.push({ x: t.sqk + sq, c: 'rdim' }); }
    return f.slice(0, 3);
  }
  function radarFactsHtml(p, t) {
    var f = radarFacts(p, t), i, h = '';
    for (i = 0; i < f.length; i++) { h += '<div class="rfact ' + f[i].c + '">' + esc(f[i].x) + '</div>'; }
    return h;
  }
  function renderRadar() {
    var t = rtr(), list = radarList().slice(0), i, p, h = '', svg = '', R = 180, C = 200;
    list.sort(function (a, b) { return a.dist_km - b.dist_km; });
    var sig = lang + '|' + (radarData ? radarData.epoch : '') + '|' + radarStale();
    if (sig === radarSig) { return; }
    radarSig = sig;
    $('r-title').innerHTML = esc(t.title);
    $('r-n').firstChild.nodeValue = t.n;
    $('r-count').innerHTML = esc(t.count(list.length));
    $('r-hint').innerHTML = esc(t.hint);
    var st = $('r-stale');
    st.innerHTML = esc(t.stale);
    st.style.display = radarStale() ? 'block' : 'none';
    for (i = 0; i < list.length; i++) {
      p = list[i];
      var rr = Math.min(p.dist_km, 25) / 25 * R, b = (p.peilung || 0) * Math.PI / 180;
      var x = C + rr * Math.sin(b), y = C - rr * Math.cos(b);
      var von = p.von || '', nach = p.nach || '';
      var rt = (von && nach) ? von + '→' + nach : '';
      var alt = p.boden ? t.ground : Math.round(p.hoehe_m) + ' m';
      var left = x > 250, tx = left ? -12 : 12, anc = left ? 'end' : 'start';
      var name = p.flugnummer || p.callsign;
      svg += '<g transform="translate(' + x.toFixed(1) + ',' + y.toFixed(1) + ')">' +
        '<path class="rpl' + (p.boden ? ' g' : '') + '" transform="rotate(' + (p.kurs || 0) + ') scale(0.9)" d="' + RPATH + '"/>' +
        '<text class="rlab" x="' + tx + '" y="-1" text-anchor="' + anc + '">' + esc(name) + '</text>' +
        '<text class="rlab2" x="' + tx + '" y="12" text-anchor="' + anc + '">' + esc(rt ? rt + ' · ' + alt : alt) + '</text>' +
        (p.typ ? '<text class="rlab2" x="' + tx + '" y="25" text-anchor="' + anc + '">' + esc(p.typ) + '</text>' : '') + '</g>';
      if (i < 4) {
        var route = (von && nach) ? esc((p.von_stadt || von) + ' \u2192 ' + (p.nach_stadt || nach)) : '';
        var codes = (von && nach) ? esc(von + ' \u2192 ' + nach) : '<span class="rdim">' + esc(t.unknown) + '</span>';
        var tr2 = p.steigt ? ' \u2197' : (p.sinkt ? ' \u2198' : '');
        h += '<div class="rrow' + (t.sqe[String(p.sq || '')] ? ' ralert' : '') + '"><div class="rinfo"><div class="rfn">' + esc(name) + '</div>' +
          '<div class="rdist">' + Number(p.dist_km).toFixed(1) + ' km</div>' +
          '<div class="rcode">' + codes + '</div>' +
          '<div class="rcity">' + route + '</div>' +
          '<div class="rair">' + esc(p.airline || p.betreiber || p.callsign || '') + (p.flugnummer && p.callsign ? ' \u00b7 ' + esc(p.callsign) : '') + '</div>' +
          '<div class="rmeta">' + esc(alt + tr2 + (p.speed_kmh != null ? ' \u00b7 ' + p.speed_kmh + ' km/h' : '')) + '</div></div>' +
          '<div class="rac"><div class="rpic">' + radarPic(p) + '</div>' +
          '<div class="rcred">' + esc(radarCredit(p, t)) + '</div>' +
          '<div class="rtx">' + radarKv(t.mfr, p.hersteller, t) + radarKv(t.mdl, p.modell, t) +
          radarKv(t.reg, p.kennzeichen, t) + radarFactsHtml(p, t) + '</div></div></div>';
      }
    }
    if (!list.length) { h = '<div class="rempty">' + esc(t.empty) + '</div>'; }
    $('r-pl').innerHTML = svg;
    $('r-list').innerHTML = h;
  }
  function closeRadar() {
    radarOpen = false;
    if (radarTimer) { clearInterval(radarTimer); radarTimer = null; }
    if (radarCloseTimer) { clearTimeout(radarCloseTimer); radarCloseTimer = null; }
    var el = $('radar');
    if (el) { removeClass(el, 'show'); }
  }
  function openRadar() {
    try {
      if (!radarBuilt) { buildRadar(); }
      radarOpen = true; radarSig = '';
      renderRadar();
      addClass($('radar'), 'show');
      pollRadar();
      if (radarTimer) { clearInterval(radarTimer); }
      radarTimer = setInterval(pollRadar, RADAR_OPEN_POLL_MS);
      if (radarCloseTimer) { clearTimeout(radarCloseTimer); }
      radarCloseTimer = setTimeout(closeRadar, RADAR_AUTOCLOSE_MS);
    } catch (e) { closeRadar(); }
  }

  // ---------- auto-update: server writes www/tv/version.js; a changed value reloads the page when idle ----------
  var VERSION_POLL_MS = 300000;
  var VERSION_IDLE_MS = 20000;   // no key press for this long before a reload
  var verBase = null, verPending = false, verScript = null;
  window.TV_VERSION_CB = function (v) {
    v = String(v);
    if (verBase === null) { verBase = v; return; }
    if (v !== verBase) { verPending = true; }
  };
  function versionUrl() {
    return statusUrl().replace(/status\.js/, 'version.js');
  }
  function pollVersion() {
    var head = document.getElementsByTagName('head')[0];
    if (verScript && verScript.parentNode) { verScript.parentNode.removeChild(verScript); }
    var s = document.createElement('script'), u = versionUrl();
    s.src = u + (u.indexOf('?') >= 0 ? '&' : '?') + 't=' + new Date().getTime();
    s.onerror = function () { };
    verScript = s;
    head.appendChild(s);
  }
  function maybeReload() {
    if (!verPending) { return; }
    if (radarOpen || welcomeOpen || diagOpen || fo.on) { return; }
    if (new Date().getTime() - lastKeyAt < VERSION_IDLE_MS) { return; }
    verPending = false;
    try { window.location.reload(); } catch (e) { }
  }

  // ---------- keys ----------
  function onKey(e) {
    var k = e.keyCode;
    lastKeyAt = new Date().getTime();
    wakeUntil = lastKeyAt + WAKE_MS;
    applyMode();
    if (fo.on) { closeFoto(); e.preventDefault(); return; }   // any key ends screensaver / beamed photo and is not passed on
    if (radarOpen) { closeRadar(); e.preventDefault(); return; }   // any key closes the flight radar
    if (welcomeOpen) { hideWelcome(); e.preventDefault(); return; }   // any key closes the welcome and is not passed on
    if (diagOpen) {
      if (k === 10009 || k === 27 || k === 8 || k === 13) { closeDiag(); }
      else if (k === 40) { diagTop = Math.min(Math.max(0, diagRows.length - 21), diagTop + 10); renderDiag(); }
      else if (k === 38) { diagTop = Math.max(0, diagTop - 10); renderDiag(); }
      e.preventDefault();
      return;
    }
    if (k === 37) { setFocus(focusIdx - 1); }
    else if (k === 39) { setFocus(focusIdx + 1); }
    else if (k === 38) { setFocus(focusIdx - COLS); }
    else if (k === 40) { setFocus(focusIdx + COLS); }
    else if (k === 13) { launchApp(APPS[focusIdx]); }
    else if (k === 404 || k === 82) { openRadar(); }   // green, "r"
    else if (k === 406 || k === 457 || k === 73) { openDiag(); }   // blue, info, "i"
    else if (k === 10009) {
      // Back: exit when we are a real Tizen app; otherwise let TizenBrew / the browser handle it (go back).
      try { if (window.tizen && window.tizen.application) { window.tizen.application.getCurrentApplication().exit(); e.preventDefault(); return; } } catch (e3) { }
      try { if (window.history && window.history.length > 1) { window.history.back(); e.preventDefault(); } } catch (e4) { }
      return;
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
    buildFoto();
    document.addEventListener('keydown', onKey, false);
    tick();
    setInterval(tick, 1000);
    poll();
    setInterval(poll, POLL_MS);
    pollRadar();
    setInterval(pollRadar, RADAR_POLL_MS);
    pollVersion();
    setInterval(pollVersion, VERSION_POLL_MS);
    pollFoto();
    setInterval(pollFoto, FOTO_STATE_MS);
    fetchSlides();
    setInterval(fetchSlides, SLIDES_MS);
    tbSelfRelaunch();
  }
  try { init(); } catch (eInit) { }
})();
