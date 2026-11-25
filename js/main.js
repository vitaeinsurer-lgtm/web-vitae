/* VITAE Seguros de Vida — interacción del sitio público */
(function () {
  'use strict';

  var WHATSAPP = '525612516526'; // 56 12 51 65 26 con clave de país (52)
  var C = window.VitaeCotizador;

  /* ---------- Movimiento ---------- */
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var canObserve = 'IntersectionObserver' in window;
  var EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)';
  if (!reduceMotion && canObserve) {
    document.documentElement.classList.add('js-motion');
    // Cada grupo (tarjetas, pasos) entra escalonado una sola vez: 0, 60 y 110 ms…
    var STAGGER = [0, 60, 110, 150];
    document.querySelectorAll('.products, .steps').forEach(function (group) {
      group.querySelectorAll('.reveal').forEach(function (el, i) { el.style.setProperty('--d', (STAGGER[i] || 150) + 'ms'); });
    });
    var revealObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('is-in'); revealObs.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -10% 0px' });
    document.querySelectorAll('.reveal').forEach(function (el) { revealObs.observe(el); });
  }

  /* ---------- Altura real del encabezado ---------- */
  var header = document.querySelector('.site-header');
  function syncHeader() { if (header) document.documentElement.style.setProperty('--header-h', header.offsetHeight + 'px'); }
  syncHeader();
  window.addEventListener('resize', syncHeader);

  /* ---------- Menú móvil ---------- */
  var toggle = document.getElementById('nav-toggle');
  var menu = document.getElementById('menu');
  function closeMenu() {
    menu.classList.remove('open');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.querySelector('.sr').textContent = 'Abrir menú';
    document.body.style.overflow = '';
  }
  if (toggle && menu) {
    toggle.addEventListener('click', function () {
      var open = menu.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(open));
      toggle.querySelector('.sr').textContent = open ? 'Cerrar menú' : 'Abrir menú';
      document.body.style.overflow = open ? 'hidden' : '';
    });
    menu.addEventListener('click', function (e) { if (e.target.closest('a')) closeMenu(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && menu.classList.contains('open')) { closeMenu(); toggle.focus(); } });
    window.matchMedia('(min-width: 941px)').addEventListener('change', function (m) { if (m.matches) closeMenu(); });
  }

  /* ---------- Formato ---------- */
  var nf0 = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 });
  var money = function (v, cur) { return '$' + nf0.format(Math.round(v)) + (cur ? ' ' + cur : ''); };
  var NOMBRE = { temporal: 'Vida Temporal', vitalicio: 'Vida Vitalicio', dotal: 'Vida Dotal Mixto' };
  var CORTO = { temporal: 'Temporal', vitalicio: 'Vitalicio', dotal: 'Dotal Mixto' };

  /* ---------- Tarjeta de ejemplo del héroe (calculada con el motor) ---------- */
  if (C) {
    var ej = C.cotizar({ producto: 'temporal', edad: 35, sexo: 'F', fumador: false, suma: 1000000, moneda: 'MXN', plazo: 20, padecimiento: 'ninguno' });
    var sa = document.getElementById('sample-anual');
    var su = document.getElementById('sample-unica');
    if (sa) sa.textContent = money(ej.primaAnual);
    if (su) su.textContent = money(ej.pnu, 'MXN');
  }

  /* ---------- Línea de vida ---------- */
  var NS = 'http://www.w3.org/2000/svg';
  var svg = document.getElementById('ll-svg');
  var edadIn = document.getElementById('ll-edad');
  var plazoIn = document.getElementById('ll-plazo');
  var edadOut = document.getElementById('ll-edad-out');
  var plazoOut = document.getElementById('ll-plazo-out');
  var summary = document.getElementById('ll-summary');
  var AGE_MIN = 18, AGE_MAX = 100, X0 = 16, X1 = 584, BAR_H = 16;
  var sx = function (age) { return X0 + (Math.min(age, AGE_MAX) - AGE_MIN) / (AGE_MAX - AGE_MIN) * (X1 - X0); };
  var ROWS = [
    { key: 'temporal', name: 'Temporal', y: 40 },
    { key: 'vitalicio', name: 'Vitalicio', y: 102 },
    { key: 'dotal', name: 'Dotal Mixto', y: 164 }
  ];
  var parts = {};
  function el(name, attrs, text) {
    var n = document.createElementNS(NS, name);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (text != null) n.textContent = text;
    return n;
  }
  function buildLifeline() {
    ROWS.forEach(function (r) {
      svg.appendChild(el('text', { x: X0, y: r.y - 10, class: 'lbl' }, r.name));
      parts[r.key + 'Sub'] = svg.appendChild(el('text', { x: X1, y: r.y - 10, class: 'sub', 'text-anchor': 'end' }, ''));
      svg.appendChild(el('rect', { x: X0, y: r.y, width: X1 - X0, height: BAR_H, rx: 8, class: 'track' }));
      parts[r.key] = svg.appendChild(el('rect', { x: X0, y: r.y, width: 10, height: BAR_H, rx: 8, class: 'bar b-' + r.key }));
    });
    parts.arrow = svg.appendChild(el('path', { class: 'arrow', d: '' }));
    parts.coin = svg.appendChild(el('circle', { r: 9, cx: 0, cy: ROWS[2].y + BAR_H / 2, class: 'coin' }));
    var axisY = 204;
    svg.appendChild(el('line', { x1: X0, x2: X1, y1: axisY, y2: axisY, class: 'axis' }));
    [20, 30, 40, 50, 60, 70, 80, 90, 100].forEach(function (a) {
      var x = sx(a);
      svg.appendChild(el('line', { x1: x, x2: x, y1: axisY, y2: axisY + 5, class: 'axis' }));
      svg.appendChild(el('text', { x: x, y: axisY + 20, class: 'tick', 'text-anchor': a === 100 ? 'end' : 'middle' }, String(a)));
    });
    parts.now = svg.appendChild(el('line', { y1: 18, y2: axisY, class: 'now' }));
    parts.nowLbl = svg.appendChild(el('text', { y: 14, class: 'now-lbl', 'text-anchor': 'middle' }, 'Hoy'));
  }
  /* Fin de la protección de Temporal y Dotal con los mismos límites del cotizador:
     el plazo más largo que cabe hasta la edad máxima, o nada si la edad no se acepta. */
  function finProducto(p, edad, plazo) {
    if (!C) return edad + plazo;
    var validos = C.plazosValidos(p, edad);
    if (!validos.length) return null;
    return edad + (validos.indexOf(plazo) !== -1 ? plazo : validos[validos.length - 1]);
  }
  function updateLifeline() {
    var edad = +edadIn.value, plazo = +plazoIn.value;
    edadOut.textContent = edad + ' años';
    plazoOut.textContent = plazo + ' años';
    var x = sx(edad);
    var fines = { temporal: finProducto('temporal', edad, plazo), dotal: finProducto('dotal', edad, plazo) };
    ['temporal', 'dotal'].forEach(function (k) {
      var f = fines[k];
      parts[k].style.display = f === null ? 'none' : '';
      if (f !== null) { parts[k].setAttribute('x', x); parts[k].setAttribute('width', Math.max(sx(f) - x, BAR_H)); }
    });
    parts.vitalicio.setAttribute('x', x);
    parts.vitalicio.setAttribute('width', X1 - x);
    var yV = ROWS[1].y;
    parts.arrow.setAttribute('d', 'M' + (X1 - 2) + ' ' + (yV - 3) + 'l10 ' + (BAR_H / 2 + 3) + 'l-10 ' + (BAR_H / 2 + 3) + 'z');
    parts.coin.style.display = fines.dotal === null ? 'none' : '';
    if (fines.dotal !== null) parts.coin.setAttribute('cx', Math.min(sx(fines.dotal), X1 - 9));
    parts.now.setAttribute('x1', x); parts.now.setAttribute('x2', x);
    parts.nowLbl.setAttribute('x', Math.max(x, X0 + 12));
    var tope = function (k) { return fines[k] - edad < plazo ? ' (máximo)' : ''; };
    parts.temporalSub.textContent = fines.temporal === null ? 'no disponible a esta edad' : 'hasta los ' + fines.temporal + ' años' + tope('temporal');
    parts.vitalicioSub.textContent = 'toda la vida';
    parts.dotalSub.textContent = fines.dotal === null ? 'no disponible a esta edad' : 'hasta los ' + fines.dotal + tope('dotal') + ', y te paga al final';
    var t = fines.temporal === null ? 'el <strong>Temporal</strong> ya no se contrata a esta edad; '
      : 'el <strong>Temporal</strong> protege a tu familia hasta tus ' + fines.temporal + ' años' + (tope('temporal') ? ', el máximo para este seguro' : '') + '; ';
    var d = fines.dotal === null ? 'y el <strong>Dotal Mixto</strong> ya no se contrata a esta edad.'
      : 'y el <strong>Dotal Mixto</strong> protege hasta tus ' + fines.dotal + ' y, si llegas, te entrega la suma asegurada.';
    summary.innerHTML = 'Con <strong>' + edad + ' años</strong> y un plazo de <strong>' + plazo + ' años</strong>: ' +
      t + 'el <strong>Vitalicio</strong>, toda tu vida; ' + d;
  }
  if (svg && edadIn && plazoIn) {
    buildLifeline();
    edadIn.addEventListener('input', updateLifeline);
    plazoIn.addEventListener('input', updateLifeline);
    if (!reduceMotion && canObserve) {
      // El texto se llena desde el inicio (si no, al aparecer movería la página);
      // solo las barras empiezan recogidas en la edad actual y se extienden al entrar en pantalla
      updateLifeline();
      ['temporal', 'vitalicio', 'dotal'].forEach(function (k) { parts[k].setAttribute('width', BAR_H); });
      parts.coin.setAttribute('cx', sx(+edadIn.value));
      var llObs = new IntersectionObserver(function (entries) {
        if (!entries[0].isIntersecting) return;
        llObs.disconnect();
        svg.classList.add('ll-intro');
        requestAnimationFrame(function () { requestAnimationFrame(updateLifeline); });
        setTimeout(function () { svg.classList.remove('ll-intro'); }, 1000);
      }, { threshold: 0.4 });
      llObs.observe(svg);
    } else {
      updateLifeline();
    }
  }

  /* ---------- Cotizador ---------- */
  var form = document.getElementById('quote-form');
  if (!form || !C) return;
  var $ = function (id) { return document.getElementById(id); };
  var edadField = $('q-edad'), sumaField = $('q-suma');
  var result = $('result');
  var lastText = '';

  function radio(name) { var r = form.querySelector('input[name="' + name + '"]:checked'); return r ? r.value : null; }
  function parseSuma() { return Number(String(sumaField.value).replace(/[^\d]/g, '')); }

  function showError(input, box, msg) {
    if (msg) { input.setAttribute('aria-invalid', 'true'); box.textContent = msg; box.hidden = false; }
    else { input.removeAttribute('aria-invalid'); box.hidden = true; }
  }

  function readForm() {
    var producto = radio('producto');
    var L = C.LIMITES[producto];
    var edad = Number(edadField.value);
    var suma = parseSuma();
    var moneda = $('q-moneda').value;
    var errEdad = '', errSuma = '';
    if (!edadField.value) errEdad = 'Escribe tu edad.';
    else if (!Number.isInteger(edad) || edad < L.edadMin || edad > L.edadMax) {
      errEdad = 'El seguro ' + NOMBRE[producto] + ' se cotiza de ' + L.edadMin + ' a ' + L.edadMax + ' años.' +
        (edad > L.edadMax && producto !== 'vitalicio' && edad <= C.LIMITES.vitalicio.edadMax ? ' Prueba con Vida Vitalicio.' : '');
    }
    var rango = L.suma[moneda];
    if (!suma) errSuma = 'Escribe la suma asegurada que quieres para tus beneficiarios.';
    else if (suma < rango[0]) errSuma = 'La suma asegurada mínima es de ' + money(rango[0], moneda) + '.';
    else if (suma > rango[1]) errSuma = 'La suma asegurada máxima en ' + moneda + ' es de ' + money(rango[1], moneda) + '.';
    var pagosSel = $('q-pagos').value;
    var pagos = pagosSel === '65' ? 65 - edad : Number(pagosSel);
    return {
      ok: !errEdad && !errSuma, errEdad: errEdad, errSuma: errSuma,
      datos: {
        producto: producto, edad: edad, sexo: radio('sexo'), fumador: radio('fumador') === 'si',
        suma: suma, moneda: moneda, plazo: Number($('q-plazo').value), pagos: pagos,
        pagosHasta65: pagosSel === '65', padecimiento: $('q-padec').value,
        nombre: $('q-nombre').value.trim()
      }
    };
  }

  /* Desactiva los plazos y años de pago que pasarían de la edad máxima del seguro.
     Si la opción elegida deja de caber, toma la más larga que sí cabe y lo explica. */
  function syncFields() {
    var producto = radio('producto');
    var vit = producto === 'vitalicio';
    $('plazo-field').hidden = vit;
    $('pagos-field').hidden = !vit;
    var edad = Number(edadField.value);
    var L = C.LIMITES[producto];
    var edadOk = Number.isInteger(edad) && edad >= L.edadMin && edad <= L.edadMax;
    var validos = edadOk ? C.plazosValidos(producto, edad) : C.PLAZOS;
    var sel = vit ? $('q-pagos') : $('q-plazo');
    var note = vit ? $('n-pagos') : $('n-plazo');
    var ajustado = '';

    [].forEach.call(sel.options, function (o) {
      var años = o.value === '65' ? 65 - edad : Number(o.value);
      var cabe = !edadOk || (o.value === '65' ? años >= 5 && edad + años <= L.finMax : validos.indexOf(años) !== -1);
      o.disabled = !cabe;
      var base = o.value === '65' ? 'Hasta los 65 años' : o.value + ' años';
      o.textContent = cabe ? base : base + ' (no disponible a tu edad)';
    });
    if (sel.selectedOptions[0] && sel.selectedOptions[0].disabled) {
      var ok = [].filter.call(sel.options, function (o) { return !o.disabled && o.value !== '65'; });
      if (ok.length) { sel.value = ok[ok.length - 1].value; ajustado = sel.value; }
    }
    // El aviso de ajuste se queda visible mientras el plazo siga recortado por la edad
    var limite = vit ? 'los pagos terminan' : 'la protección termina';
    var recortado = edadOk && [].some.call(sel.options, function (o) { return o.disabled; });
    note.hidden = !recortado;
    if (recortado) {
      note.textContent = (ajustado ? 'Ajustamos a ' + ajustado + ' años. ' : '') +
        'En ' + NOMBRE[producto] + ' ' + limite + ' a más tardar a los ' + L.finMax + ' años.';
    }
  }
  var pagosTxt = function (n) { return n + (n === 1 ? ' pago' : ' pagos'); };

  function buildMessage(d, r) {
    var lineas = [
      'Hola, VITAE. Les comparto esta cotización de ejemplo del proyecto académico' + (d.nombre ? ' (soy ' + d.nombre + ')' : '') + ':',
      '• Seguro: ' + NOMBRE[d.producto],
      '• Edad: ' + d.edad + ' años · ' + (d.sexo === 'F' ? 'Mujer' : 'Hombre') + ' · ' + (d.fumador ? 'Fumador' : 'No fumador'),
      '• Suma asegurada: ' + money(d.suma, d.moneda),
      d.producto === 'vitalicio'
        ? '• Protección: toda la vida · ' + pagosTxt(r.pagos) + ' anuales'
        : '• Plazo: ' + d.plazo + ' años · ' + pagosTxt(r.pagos) + ' anuales',
      '• Padecimiento: ' + C.EXTRAPRIMAS[d.padecimiento].nombre,
      '• Prima anual estimada: ' + money(r.primaAnual, d.moneda) + (d.moneda !== 'MXN' ? ' (' + money(r.primaAnualMXN, 'MXN') + ')' : ''),
      '• Pago único equivalente: ' + money(r.pnu, d.moneda)
    ];
    return lineas.join('\n');
  }

  function render(animate) {
    syncFields();
    var f = readForm();
    showError(edadField, $('e-edad'), f.errEdad);
    showError(sumaField, $('e-suma'), f.errSuma);
    var Lp = C.LIMITES[f.datos.producto], rg = Lp.suma[f.datos.moneda];
    $('n-edad').textContent = 'De ' + Lp.edadMin + ' a ' + Lp.edadMax + ' años en ' + NOMBRE[f.datos.producto] + '.';
    $('n-suma').textContent = 'De ' + money(rg[0]) + ' a ' + money(rg[1], f.datos.moneda) + '.';
    $('n-edad').hidden = !!f.errEdad; $('n-suma').hidden = !!f.errSuma;
    var wa = $('r-whatsapp');
    if (!f.ok) {
      result.classList.add('is-error');
      $('r-anual').textContent = '—';
      $('peek-price').textContent = 'Revisa tus datos';
      ['r-unica', 'r-pagos', 'r-cobertura'].forEach(function (id) { $(id).textContent = '—'; });
      $('r-anual-mxn').hidden = true; $('r-ahorro-row').hidden = true; $('r-extra-row').hidden = true;
      $('r-compare').innerHTML = '';
      wa.setAttribute('aria-disabled', 'true'); wa.href = 'https://wa.me/' + WHATSAPP;
      lastText = '';
      return;
    }
    result.classList.remove('is-error');
    wa.removeAttribute('aria-disabled');
    var d = f.datos;
    var r = C.cotizar(d);

    var nuevo = money(r.primaAnual);
    if (animate && !reduceMotion && $('r-anual').textContent !== nuevo && $('r-anual').animate) {
      // Cambio de estado: desenfoque breve, interrumpible, solo al cambiar una opción
      $('r-anual').animate([{ opacity: 0.35, filter: 'blur(3px)' }, { opacity: 1, filter: 'blur(0)' }], { duration: 180, easing: EASE_OUT });
    }
    $('r-anual').textContent = nuevo;
    $('peek-price').textContent = nuevo + ' ' + d.moneda;
    $('r-anual-cur').textContent = d.moneda + ' al año';
    var mx = $('r-anual-mxn');
    mx.hidden = d.moneda === 'MXN';
    if (!mx.hidden) mx.textContent = 'Equivale a ' + money(r.primaAnualMXN, 'MXN') + ' al año (tipo de cambio ' + C.TIPO_CAMBIO[d.moneda].valor + ').';
    $('r-unica').textContent = money(r.pnu, d.moneda);
    $('r-pagos').textContent = r.pagos + (d.pagosHasta65 ? ' (hasta los 65)' : '');
    $('r-cobertura').textContent = d.producto === 'vitalicio' ? 'Toda la vida' : 'Hasta los ' + (d.edad + d.plazo) + ' años';
    $('r-ahorro-row').hidden = d.producto !== 'dotal';
    $('r-ahorro').textContent = money(d.suma, d.moneda);
    $('r-extra-row').hidden = !r.extraprima;
    $('r-extra').textContent = '+' + Math.round(r.extraprima * 100) + '% sobre la cobertura';

    var cmp = $('r-compare');
    cmp.innerHTML = '';
    ['temporal', 'vitalicio', 'dotal'].forEach(function (p) {
      var L = C.LIMITES[p];
      var li = document.createElement('li');
      if (p === d.producto) li.className = 'is-current';
      // Cada seguro se compara con el plazo elegido o, si no cabe por edad, con el más largo que sí cabe
      var validos = C.plazosValidos(p, d.edad);
      var rango = L.suma[d.moneda];
      var motivo = !validos.length ? 'no disponible a tu edad'
        : (d.suma < rango[0] || d.suma > rango[1]) ? 'no disponible con esta suma' : '';
      if (motivo) {
        li.classList.add('is-off');
        li.innerHTML = '<span class="dot dot-' + p + '"></span><span>' + CORTO[p] + '</span><b>' + motivo + '</b>';
      } else {
        var o = Object.assign({}, d, { producto: p });
        if (p === 'vitalicio') { if (p !== d.producto) o.pagos = Math.min(20, validos[validos.length - 1]); }
        else if (validos.indexOf(d.plazo) === -1) o.plazo = validos[validos.length - 1];
        var rr = C.cotizar(o);
        var base = p === 'vitalicio' ? pagosTxt(rr.pagos) : o.plazo + ' años';
        li.innerHTML = '<span class="dot dot-' + p + '"></span><span>' + CORTO[p] + ' <small>· ' + base + '</small></span><b>' + money(rr.primaAnual, d.moneda) + '/año</b>';
      }
      cmp.appendChild(li);
    });

    lastText = buildMessage(d, r);
    wa.href = 'https://wa.me/' + WHATSAPP + '?text=' + encodeURIComponent(lastText);

  }

  form.addEventListener('input', function (e) {
    if (e.target === sumaField) {
      var digits = sumaField.value.replace(/\D/g, '').slice(0, 9);
      sumaField.value = digits ? nf0.format(Number(digits)) : '';
    }
    render(false);
  });
  form.addEventListener('change', function () { render(true); });
  form.addEventListener('submit', function (e) { e.preventDefault(); });

  $('r-whatsapp').addEventListener('click', function (e) {
    if (this.getAttribute('aria-disabled') === 'true') { e.preventDefault(); (edadField.getAttribute('aria-invalid') ? edadField : sumaField).focus(); }
  });

  var copyBtn = $('r-copy');
  copyBtn.addEventListener('click', function () {
    if (!lastText) return;
    var done = function () { copyBtn.textContent = 'Cotización copiada'; setTimeout(function () { copyBtn.textContent = 'Copiar cotización'; }, 2200); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(lastText).then(done, fallback);
    else fallback();
    function fallback() {
      var t = document.createElement('textarea'); t.value = lastText; t.setAttribute('readonly', ''); t.style.position = 'fixed'; t.style.opacity = '0';
      document.body.appendChild(t); t.select();
      try { document.execCommand('copy'); done(); } catch (err) { copyBtn.textContent = 'No se pudo copiar'; }
      document.body.removeChild(t);
    }
  });

  // Los enlaces "Cotizar ..." preseleccionan el seguro
  document.querySelectorAll('[data-producto]').forEach(function (a) {
    a.addEventListener('click', function () {
      var r = $('q-' + a.getAttribute('data-producto'));
      if (r) { r.checked = true; render(false); }
    });
  });

  render(false);

  /* Celular: muestra la prima abajo mientras el formulario está a la vista y el resultado no */
  var peek = $('peek');
  if (peek && canObserve) {
    var formVisible = false, resultVisible = false;
    var mq = window.matchMedia('(max-width: 1020px)');
    var syncPeek = function () { peek.classList.toggle('is-shown', mq.matches && formVisible && !resultVisible); };
    new IntersectionObserver(function (es) { es.forEach(function (e) {
      if (e.target === form) formVisible = e.isIntersecting; else resultVisible = e.isIntersecting;
    }); syncPeek(); }, { threshold: 0.15 }).observe(form);
    new IntersectionObserver(function (es) { resultVisible = es[0].isIntersecting; syncPeek(); }, { threshold: 0.15 }).observe(result);
    mq.addEventListener('change', syncPeek);
  }

  var year = $('year');
  if (year) year.textContent = new Date().getFullYear();
})();
