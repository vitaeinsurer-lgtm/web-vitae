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
    // Cada grupo (tarjetas, pasos, coberturas) entra escalonado: 0, 60, 110 ms…
    var STAGGER = [0, 60, 110, 150, 185];
    document.querySelectorAll('.products, .steps, .extras-list').forEach(function (group) {
      group.querySelectorAll('.reveal').forEach(function (el, i) { el.style.setProperty('--d', (STAGGER[i] || 150) + 'ms'); });
    });
    // Entra cuando ya se ve al menos un 15%; se rearma solo cuando salió por completo de la pantalla,
    // así se repite al volver (bajando o subiendo) sin desaparecer nunca mientras está a la vista.
    var revealObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting && e.intersectionRatio >= 0.15) e.target.classList.add('is-in');
        else if (!e.isIntersecting) e.target.classList.remove('is-in');
      });
    }, { threshold: [0, 0.15] });
    document.querySelectorAll('.reveal, .section-head').forEach(function (el) { revealObs.observe(el); });

    // Cifras del inicio: suben desde cero (900 ms, desaceleración) cada vez que vuelven a la vista
    document.querySelectorAll('[data-count]').forEach(function (el) {
      var final = Number(el.getAttribute('data-count')), dec = Number(el.getAttribute('data-decimals') || 0);
      var pre = el.getAttribute('data-prefix') || '', suf = el.getAttribute('data-suffix') || '';
      var fmt = new Intl.NumberFormat('es-MX', { minimumFractionDigits: dec, maximumFractionDigits: dec });
      var DUR = 900, raf = 0, armado = true;
      el.style.fontVariantNumeric = 'tabular-nums';
      var show = function (v) { el.textContent = pre + fmt.format(v) + suf; };
      show(0);
      function run() {
        var t0 = null;
        cancelAnimationFrame(raf);
        function step(t) {
          if (t0 === null) t0 = t;
          var p = Math.min((t - t0) / DUR, 1), e = 1 - Math.pow(1 - p, 4);
          show(final * e);
          if (p < 1) raf = requestAnimationFrame(step);
        }
        raf = requestAnimationFrame(step);
      }
      new IntersectionObserver(function (entries) {
        var e = entries[0];
        if (e.isIntersecting && e.intersectionRatio >= 0.5 && armado) { armado = false; setTimeout(run, 150); }
        else if (!e.isIntersecting) { armado = true; cancelAnimationFrame(raf); show(0); }
      }, { threshold: [0, 0.5] }).observe(el);
    });
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
  var NOMBRE = { temporal: 'VITAE Protege', vitalicio: 'VITAE Siempre', dotal: 'VITAE Tranquilidad' };
  var CORTO = { temporal: 'Protege', vitalicio: 'Siempre', dotal: 'Tranquilidad' };

  /* ---------- Tarjeta de ejemplo del héroe (calculada con el motor) ---------- */
  if (C) {
    var ej = C.cotizar({ producto: 'temporal', edad: 34, sexo: 'F', fumador: false, deportista: true, suma: 1500000, moneda: 'MXN', plazo: 20, pagos: 20, padecimientos: ['E000001'] });
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
    { key: 'temporal', name: 'VITAE Protege', y: 40 },
    { key: 'vitalicio', name: 'VITAE Siempre', y: 102 },
    { key: 'dotal', name: 'VITAE Tranquilidad', y: 164 }
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
  /* Fin de la protección de VITAE Protege y VITAE Tranquilidad con los mismos límites del cotizador:
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
    var t = fines.temporal === null ? '<strong>VITAE Protege</strong> ya no se contrata a esta edad; '
      : '<strong>VITAE Protege</strong> protege a tu familia hasta tus ' + fines.temporal + ' años' + (tope('temporal') ? ', el máximo para este seguro' : '') + '; ';
    var d = fines.dotal === null ? 'y <strong>VITAE Tranquilidad</strong> ya no se contrata a esta edad.'
      : 'y <strong>VITAE Tranquilidad</strong> protege hasta tus ' + fines.dotal + ' y, si llegas, te entrega la suma asegurada.';
    summary.innerHTML = 'Con <strong>' + edad + ' años</strong> y un plazo de <strong>' + plazo + ' años</strong>: ' +
      t + '<strong>VITAE Siempre</strong>, toda tu vida; ' + d;
  }
  if (svg && edadIn && plazoIn) {
    buildLifeline();
    edadIn.addEventListener('input', updateLifeline);
    plazoIn.addEventListener('input', updateLifeline);
    if (!reduceMotion && canObserve) {
      // El texto se llena desde el inicio (si no, al aparecer movería la página);
      // las barras se recogen fuera de pantalla y se dibujan cada vez que la gráfica vuelve a la vista
      updateLifeline();
      var recoger = function () {
        svg.classList.remove('ll-intro');
        svg.classList.add('ll-reset'); // sin transición: el cambio ocurre fuera de la vista
        ['temporal', 'vitalicio', 'dotal'].forEach(function (k) { parts[k].setAttribute('width', BAR_H); });
        parts.coin.setAttribute('cx', sx(+edadIn.value));
        svg.getBoundingClientRect();
        svg.classList.remove('ll-reset');
      };
      var llArmado = true, llTimer = 0;
      recoger();
      new IntersectionObserver(function (entries) {
        var e = entries[0];
        if (e.isIntersecting && e.intersectionRatio >= 0.4 && llArmado) {
          llArmado = false;
          svg.classList.add('ll-intro');
          requestAnimationFrame(function () { requestAnimationFrame(updateLifeline); });
          clearTimeout(llTimer);
          llTimer = setTimeout(function () { svg.classList.remove('ll-intro'); }, 1000);
        } else if (!e.isIntersecting) {
          llArmado = true;
          clearTimeout(llTimer);
          recoger();
        }
      }, { threshold: [0, 0.4] }).observe(svg);
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

  var pagosField = $('q-pagos');
  var pagosTocados = false;   // el visitante escribió sus propios años de pago
  var pagosAjuste = '';       // máximo al que se recortaron los años de pago por un cambio de plazo o edad

  function readForm() {
    var producto = radio('producto');
    var L = C.LIMITES[producto];
    var edad = Number(edadField.value);
    var suma = parseSuma();
    var moneda = $('q-moneda').value;
    var errEdad = '', errSuma = '', errPagos = '';
    if (!edadField.value) errEdad = 'Escribe tu edad.';
    else if (!Number.isInteger(edad) || edad < L.edadMin || edad > L.edadMax) {
      errEdad = 'El seguro ' + NOMBRE[producto] + ' se cotiza de ' + L.edadMin + ' a ' + L.edadMax + ' años.' +
        (edad > L.edadMax && producto !== 'vitalicio' && edad <= C.LIMITES.vitalicio.edadMax ? ' Prueba con VITAE Siempre.' : '');
    }
    var rango = L.suma[moneda];
    if (!suma) errSuma = 'Escribe la suma asegurada que quieres para tus beneficiarios.';
    else if (suma < rango[0]) errSuma = 'La suma asegurada mínima es de ' + money(rango[0], moneda) + '.';
    else if (suma > rango[1]) errSuma = 'La suma asegurada máxima en ' + moneda + ' es de ' + money(rango[1], moneda) + '.';
    var deVida = producto === 'vitalicio' && radio('pagosmodo') === 'vida';
    var pagos = deVida ? 'vida' : Number(pagosField.value), maxP = Number(pagosField.max);
    if (!errEdad && !deVida) {
      if (pagosField.value === '') errPagos = 'Escribe en cuántos años quieres pagar.';
      else if (!Number.isInteger(pagos) || pagos < 1) errPagos = 'Escribe un número entero de años, desde 1.';
      else if (pagos > maxP) {
        errPagos = producto === 'vitalicio'
          ? 'En VITAE Siempre los pagos terminan a más tardar a los ' + L.finMax + ' años: máximo ' + maxP + ' años de pago.'
          : 'Los años de pago no pueden pasar del plazo de protección (' + maxP + ' años).';
      }
    }
    return {
      ok: !errEdad && !errSuma && !errPagos, errEdad: errEdad, errSuma: errSuma, errPagos: errPagos,
      datos: {
        producto: producto, edad: edad, sexo: radio('sexo'), fumador: radio('fumador') === 'si',
        deportista: radio('deportista') === 'si',
        suma: suma, moneda: moneda, plazo: Number($('q-plazo').value), pagos: pagos,
        padecimientos: [].map.call(form.querySelectorAll('input[name="padecimiento"]:checked'), function (c) { return c.value; }),
        nombre: $('q-nombre').value.trim()
      }
    };
  }

  /* Plazo: desactiva los que pasarían de la edad máxima del seguro y, si el elegido deja de caber,
     toma el más largo posible. Años de pago: de 1 al plazo (o hasta los 85 en VITAE Siempre). */
  function syncFields(source) {
    var producto = radio('producto');
    var vit = producto === 'vitalicio';
    $('plazo-field').hidden = vit;
    var edad = Number(edadField.value);
    var L = C.LIMITES[producto];
    var edadOk = Number.isInteger(edad) && edad >= L.edadMin && edad <= L.edadMax;
    var validos = edadOk ? C.plazosValidos(producto, edad) : C.PLAZOS;
    var sel = $('q-plazo'), note = $('n-plazo'), ajustado = '';

    [].forEach.call(sel.options, function (o) {
      var cabe = vit || !edadOk || validos.indexOf(Number(o.value)) !== -1;
      o.disabled = !cabe;
      o.textContent = o.value + ' años' + (cabe ? '' : ' (no disponible a tu edad)');
    });
    if (!vit && sel.selectedOptions[0] && sel.selectedOptions[0].disabled) {
      var ok = [].filter.call(sel.options, function (o) { return !o.disabled; });
      if (ok.length) { sel.value = ok[ok.length - 1].value; ajustado = sel.value; }
    }
    var recortado = !vit && edadOk && [].some.call(sel.options, function (o) { return o.disabled; });
    note.hidden = !recortado;
    if (recortado) {
      note.textContent = (ajustado ? 'Ajustamos a ' + ajustado + ' años. ' : '') +
        'En ' + NOMBRE[producto] + ' la protección termina a más tardar a los ' + L.finMax + ' años.';
    }

    // Años de pago (VITAE Siempre: de por vida, como el Excel, o un número de años)
    var deVida = vit && radio('pagosmodo') === 'vida';
    $('pagos-modo').hidden = !vit;
    $('pagos-stepper').hidden = deVida;
    $('l-pagos').textContent = vit ? 'Pago de primas' : 'Años de pago de primas';
    var plazo = Number(sel.value);
    var maxP = vit ? (edadOk ? C.maxPagos('vitalicio', edad) : 20) : plazo;
    maxP = Math.max(maxP, 1);
    pagosField.max = String(maxP);
    if (pagosAjuste && Number(pagosAjuste) !== maxP) pagosAjuste = ''; // el aviso solo vale mientras siga ese límite
    if (!pagosTocados) {
      pagosField.value = String(vit ? Math.min(20, maxP) : maxP);
    } else if (source !== pagosField && Number(pagosField.value) > maxP) {
      pagosField.value = String(maxP);
      pagosAjuste = String(maxP);
    }
    $('n-pagos').textContent = deVida ? 'Pagas tu prima cada año mientras tengas la póliza.'
      : (pagosAjuste ? 'Ajustamos a ' + pagosAjuste + ' años. ' : '') + (vit
        ? 'De 1 a ' + maxP + ' años: los pagos terminan a más tardar a los ' + L.finMax + '.'
        : 'De 1 a ' + maxP + ' años: no puede pasar del plazo de protección.');
  }
  var pagosTxt = function (n) { return n + (n === 1 ? ' pago' : ' pagos'); };
  var pagosDe = function (r) { return r.pagosDeVida ? 'pagos de por vida' : pagosTxt(r.pagos); };
  var condiciones = function (lista) {
    return lista.length ? lista.map(function (k) { return C.EXTRAPRIMAS[k].nombre; }).join(', ') : 'Ninguna';
  };

  function buildMessage(d, r) {
    var lineas = [
      'Hola, VITAE. Les comparto esta cotización de seguro de vida' + (d.nombre ? ' (soy ' + d.nombre + ')' : '') + ':',
      '• Seguro: ' + NOMBRE[d.producto],
      '• Edad: ' + d.edad + ' años · ' + (d.sexo === 'F' ? 'Mujer' : 'Hombre') + ' · ' + (d.fumador ? 'Fumador' : 'No fumador') + ' · ' + (d.deportista ? 'Hace deporte' : 'No hace deporte'),
      '• Suma asegurada: ' + money(d.suma, d.moneda),
      d.producto === 'vitalicio'
        ? '• Protección: toda la vida · ' + (r.pagosDeVida ? 'pagos anuales de por vida' : pagosTxt(r.pagos) + ' anuales')
        : '• Plazo: ' + d.plazo + ' años · ' + pagosTxt(r.pagos) + ' anuales',
      '• Condiciones médicas: ' + condiciones(d.padecimientos),
      '• Prima anual estimada: ' + money(r.primaAnual, d.moneda) + (d.moneda !== 'MXN' ? ' (' + money(r.primaAnualMXN, 'MXN') + ')' : ''),
      '• Pago único equivalente: ' + money(r.pnu, d.moneda)
    ];
    return lineas.join('\n');
  }

  function render(animate, source) {
    syncFields(source);
    var f = readForm();
    showError(edadField, $('e-edad'), f.errEdad);
    showError(sumaField, $('e-suma'), f.errSuma);
    showError(pagosField, $('e-pagos'), f.errPagos);
    $('n-pagos').hidden = !!f.errPagos;
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
      $('r-anual-mxn').hidden = true; $('r-ahorro-row').hidden = true; $('r-extra-row').hidden = true; $('r-incl').textContent = '';
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
    $('r-pagos').textContent = r.pagosDeVida ? 'De por vida' : r.pagos;
    $('r-incl').textContent = 'Incluye ' + Math.round(r.recargo * 100) + '% de gastos administrativos. Prima pura: ' + money(r.primaAnualPura, d.moneda) + ' al año.';
    $('r-cobertura').textContent = d.producto === 'vitalicio' ? 'Toda la vida' : 'Hasta los ' + (d.edad + d.plazo) + ' años';
    $('r-ahorro-row').hidden = d.producto !== 'dotal';
    $('r-ahorro').textContent = money(d.suma, d.moneda);
    $('r-extra-row').hidden = !r.extraprima;
    $('r-extra').textContent = '+' + Math.round(r.extraprima * 100) + '% por condiciones médicas';

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
        if (p !== 'vitalicio' && validos.indexOf(d.plazo) === -1) o.plazo = validos[validos.length - 1];
        // Mismos años de pago, sin pasar del máximo de cada seguro
        if (d.pagos === 'vida') o.pagos = p === 'vitalicio' ? 'vida' : o.plazo;
        // Si no se tocaron los años de pago, VITAE Siempre se compara con su forma por omisión: de por vida, como el Excel
        else if (p === 'vitalicio' && d.producto !== 'vitalicio' && !pagosTocados) o.pagos = 'vida';
        else o.pagos = Math.min(d.pagos, C.maxPagos(p, d.edad, o.plazo));
        var rr = C.cotizar(o);
        var base = p === 'vitalicio' ? pagosDe(rr)
          : o.plazo + ' años' + (rr.pagos !== o.plazo ? ', ' + pagosTxt(rr.pagos) : '');
        li.innerHTML = '<span class="dot dot-' + p + '"></span><span>' + CORTO[p] + ' <small>· ' + base + '</small></span><b>' + money(rr.primaAnual, d.moneda) + '/año</b>';
      }
      cmp.appendChild(li);
      if (p === 'dotal') $('r-compare-note').hidden = !!motivo;
    });

    lastText = buildMessage(d, r);
    wa.href = 'https://wa.me/' + WHATSAPP + '?text=' + encodeURIComponent(lastText);

  }

  form.addEventListener('input', function (e) {
    if (e.target === sumaField) {
      var digits = sumaField.value.replace(/\D/g, '').slice(0, 9);
      sumaField.value = digits ? nf0.format(Number(digits)) : '';
    }
    if (e.target === pagosField) { pagosTocados = true; pagosAjuste = ''; }
    render(false, e.target);
  });
  form.addEventListener('change', function (e) {
    // Al cambiar de seguro, los años de pago vuelven a su valor natural (todo el plazo, o 20 en VITAE Siempre)
    if (e.target.name === 'producto') { pagosTocados = false; pagosAjuste = ''; $('q-pv-vida').checked = true; }
    render(true, e.target);
  });
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

  // Botones − / + de los años de pago: un año a la vez, dentro del rango permitido
  document.querySelectorAll('.step-btn').forEach(function (b) {
    b.addEventListener('click', function () {
      var max = Number(pagosField.max) || 1;
      var v = Math.min(Math.max((Number(pagosField.value) || 0) + Number(b.getAttribute('data-step')), 1), max);
      pagosField.value = String(v);
      pagosField.dispatchEvent(new Event('input', { bubbles: true }));
    });
  });
  function syncSteppers() {
    var v = Number(pagosField.value) || 0, max = Number(pagosField.max) || 1;
    document.querySelector('.step-btn[data-step="-1"]').disabled = v <= 1;
    document.querySelector('.step-btn[data-step="1"]').disabled = v >= max;
  }
  form.addEventListener('input', syncSteppers);
  form.addEventListener('change', syncSteppers);

  // Los enlaces "Cotizar ..." preseleccionan el seguro
  document.querySelectorAll('[data-producto]').forEach(function (a) {
    a.addEventListener('click', function () {
      var r = $('q-' + a.getAttribute('data-producto'));
      if (r) { r.checked = true; pagosTocados = false; pagosAjuste = ''; $('q-pv-vida').checked = true; render(false); }
    });
  });

  render(false);
  syncSteppers();

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
