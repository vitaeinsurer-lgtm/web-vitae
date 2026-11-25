/* VITAE — asistente con IA (Claude Opus 5.5 a través del intermediario en Cloudflare).
   Mientras CHAT_ENDPOINT esté vacío, el asistente no aparece en la página. */
(function () {
  'use strict';

  // Dirección del Worker desplegado, por ejemplo: 'https://vitae-chatbot.TU-CUENTA.workers.dev/chat'
  var CHAT_ENDPOINT = 'https://vitae-chatbot.vitae-chatbot.workers.dev/chat';
  var endpoint = window.VITAE_CHAT_ENDPOINT || CHAT_ENDPOINT;
  if (!endpoint) return;

  var SUGERENCIAS = [
    '¿Qué seguro me conviene si tengo hijos pequeños?',
    'Cotiza VITAE Protege: mujer de 40 años, no fuma, $1,500,000 a 20 años',
    '¿En qué se diferencia VITAE Tranquilidad de VITAE Siempre?',
    '¿Puedo asegurarme si tengo diabetes?'
  ];
  var BIENVENIDA = 'Hola, soy el asistente de VITAE. Te ayudo a entender nuestros seguros de vida y a calcular una prima. ¿Qué quieres saber?';
  var MAX_CHARS = 1200;

  var history = []; // [{ role, content }] solo texto visible
  var busy = false;

  /* ---------- Estructura ---------- */
  var fab = document.createElement('button');
  fab.className = 'chat-fab';
  fab.type = 'button';
  fab.setAttribute('aria-expanded', 'false');
  fab.setAttribute('aria-controls', 'chat-panel');
  fab.innerHTML =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.2 3.6c-.5.4-1.3.1-1.3-.6V16A2.5 2.5 0 0 1 4 13.5z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M8.5 9.5h7M8.5 12.5h4.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>' +
    '<span class="chat-fab-label">Pregúntale a VITAE</span>';

  var panel = document.createElement('section');
  panel.className = 'chat-panel';
  panel.id = 'chat-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'false');
  panel.setAttribute('aria-labelledby', 'chat-title');
  panel.hidden = true;
  panel.innerHTML =
    '<header class="chat-head">' +
      '<img src="img/vitae-v.png" alt="" width="200" height="175">' +
      '<div><h2 id="chat-title">Asistente VITAE</h2><p>Con IA · proyecto académico</p></div>' +
      '<button type="button" class="chat-close" aria-label="Cerrar el asistente">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>' +
      '</button>' +
    '</header>' +
    '<div class="chat-log" id="chat-log" aria-live="polite"></div>' +
    '<div class="chat-suggest" id="chat-suggest"></div>' +
    '<form class="chat-form" id="chat-form">' +
      '<label class="sr" for="chat-input">Escribe tu pregunta</label>' +
      '<textarea id="chat-input" rows="1" maxlength="' + MAX_CHARS + '" placeholder="Escribe tu pregunta…" autocomplete="off"></textarea>' +
      '<button type="submit" class="chat-send" aria-label="Enviar pregunta">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
      '</button>' +
    '</form>' +
    '<p class="chat-note">Respuestas generadas con IA (Claude, de Anthropic). Pueden contener errores y las primas son ilustrativas. No compartas datos personales.</p>';

  document.body.appendChild(fab);
  document.body.appendChild(panel);

  var log = panel.querySelector('#chat-log');
  var form = panel.querySelector('#chat-form');
  var input = panel.querySelector('#chat-input');
  var sendBtn = panel.querySelector('.chat-send');
  var suggest = panel.querySelector('#chat-suggest');

  /* ---------- Texto seguro con formato mínimo (**negritas** y listas "- ") ---------- */
  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  function format(text) {
    var lines = escapeHtml(text).split(/\n/);
    var html = '', inList = false;
    lines.forEach(function (raw) {
      var line = raw.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      var m = /^\s*[-•]\s+(.*)$/.exec(line) || /^\s*\d+\.\s+(.*)$/.exec(line);
      if (m) { if (!inList) { html += '<ul>'; inList = true; } html += '<li>' + m[1] + '</li>'; return; }
      if (inList) { html += '</ul>'; inList = false; }
      if (line.trim()) html += '<p>' + line + '</p>';
    });
    if (inList) html += '</ul>';
    return html;
  }

  function addMessage(role, text, extraClass) {
    var el = document.createElement('div');
    el.className = 'chat-msg chat-' + role + (extraClass ? ' ' + extraClass : '');
    el.innerHTML = role === 'user' ? '<p>' + escapeHtml(text) + '</p>' : format(text);
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
    return el;
  }

  function showSuggestions(show) {
    suggest.innerHTML = '';
    suggest.hidden = !show;
    if (!show) return;
    SUGERENCIAS.forEach(function (s) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'chat-chip'; b.textContent = s;
      b.addEventListener('click', function () { send(s); });
      suggest.appendChild(b);
    });
  }

  /* ---------- Abrir y cerrar ---------- */
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function open() {
    panel.hidden = false;
    // Doble frame: el estado inicial se pinta antes de la transición de entrada
    requestAnimationFrame(function () { requestAnimationFrame(function () { panel.classList.add('is-open'); }); });
    fab.setAttribute('aria-expanded', 'true');
    document.documentElement.classList.add('chat-is-open');
    if (!log.children.length) { addMessage('assistant', BIENVENIDA); showSuggestions(true); }
    setTimeout(function () { input.focus(); }, reduceMotion ? 0 : 120);
  }
  function close() {
    panel.classList.remove('is-open');
    fab.setAttribute('aria-expanded', 'false');
    document.documentElement.classList.remove('chat-is-open');
    setTimeout(function () { if (!panel.classList.contains('is-open')) panel.hidden = true; }, reduceMotion ? 0 : 160);
    fab.focus();
  }
  fab.addEventListener('click', function () { panel.classList.contains('is-open') ? close() : open(); });
  panel.querySelector('.chat-close').addEventListener('click', close);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && panel.classList.contains('is-open')) close(); });

  /* ---------- Enviar ---------- */
  function setBusy(b) {
    busy = b;
    sendBtn.disabled = b;
    input.setAttribute('aria-busy', String(b));
  }
  function autoGrow() {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 120) + 'px';
    input.style.overflowY = input.scrollHeight > 120 ? 'auto' : 'hidden'; // barra solo si el texto no cabe
  }
  input.addEventListener('input', autoGrow);
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit ? form.requestSubmit() : send(input.value); }
  });
  form.addEventListener('submit', function (e) { e.preventDefault(); send(input.value); });

  function send(text) {
    text = String(text || '').trim();
    if (!text || busy) return;
    if (text.length > MAX_CHARS) text = text.slice(0, MAX_CHARS);
    showSuggestions(false);
    addMessage('user', text);
    history.push({ role: 'user', content: text });
    input.value = ''; autoGrow();
    setBusy(true);
    var typing = addMessage('assistant', '', 'chat-typing');
    typing.innerHTML = '<span></span><span></span><span></span>';
    typing.setAttribute('aria-label', 'El asistente está escribiendo');

    var ctrl = 'AbortController' in window ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 45000);
    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: history.slice(-20) }),
      signal: ctrl ? ctrl.signal : undefined
    })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (data) { return { ok: r.ok, data: data }; }); })
      .then(function (res) {
        typing.remove();
        if (res.ok && res.data.reply) {
          history.push({ role: 'assistant', content: res.data.reply });
          addMessage('assistant', res.data.reply);
        } else {
          history.pop(); // la pregunta sin respuesta no se manda otra vez como historial
          addMessage('assistant', res.data.error || 'No pude responder en este momento. Intenta de nuevo.', 'chat-error');
        }
      })
      .catch(function () {
        typing.remove();
        history.pop();
        addMessage('assistant', 'No pude conectarme con el asistente. Revisa tu conexión e intenta de nuevo.', 'chat-error');
      })
      .then(function () { clearTimeout(timer); setBusy(false); input.focus(); });
  }
})();
