/* VITAE — motor del cotizador
   Reproduce el cotizador de la dirección (Cotizador_VITAEEE.xlsx, hojas Cotizador y Calculos_Ocultos):
   - Tabla de mortalidad CNSF (qx, edades 0 a 110; después de los 110 se repite q110), tasa de interés del 5%.
   - Edad corregida: edad − 3 si es mujer − 2 si no fuma − 1 si hace deporte.
   - PNU fallecimiento = SA · Σ kpx · q(x+k) · v^(k+1) · (1+g)^k  (k < plazo; Vitalicio, k = 0…110).
   - Dotal Mixto: + SA supervivencia · npx · v^n · (1+g)^n.
   - Pago anual nivelado = PNU ÷ ä, con ä = Σ kpx · v^k durante los años de pago.
   - Prima total = prima pura · (1 + extraprima médica) ÷ (1 − recargo por gastos del producto).
   Además de lo que hace el Excel, la web permite elegir años de pago menores al plazo y la moneda
   (la prima se calcula en la moneda de la suma asegurada; el tipo de cambio solo sirve para mostrar el equivalente en MXN). */
(function (root) {
  'use strict';

  var QX = [0.000433,0.000433,0.000434,0.000434,0.000435,0.000436,0.000438,0.00044,0.000443,0.000446,0.000449,0.000453,0.000457,0.000463,0.000468,0.000475,0.000482,0.000489,0.000498,0.000507,0.000517,0.000528,0.00054,0.000553,0.000567,0.000582,0.000598,0.000616,0.000635,0.000656,0.000678,0.000703,0.000729,0.000757,0.000788,0.000821,0.000857,0.000896,0.000938,0.000983,0.001033,0.001087,0.001145,0.001208,0.001278,0.001353,0.001435,0.001525,0.001623,0.00173,0.001848,0.001977,0.002119,0.002274,0.002446,0.002635,0.002844,0.003074,0.003329,0.003612,0.003926,0.004275,0.004664,0.005096,0.005579,0.006119,0.006723,0.0074,0.00816,0.009015,0.009977,0.011061,0.012285,0.013668,0.015235,0.017009,0.019024,0.021312,0.023915,0.026879,0.030257,0.03411,0.038509,0.043533,0.049274,0.055833,0.063329,0.071889,0.08166,0.092798,0.105476,0.119875,0.136184,0.154594,0.175291,0.198441,0.224184,0.252613,0.28376,0.317576,0.353919,0.39254,0.433078,0.475068,0.517949,0.561099,0.603861,0.645589,0.685682,0.72362,0.758991];
  var EDAD_MAX_TABLA = 110;   // el Excel usa MIN(110, x+k)
  var FILAS = 111;            // k = 0…110 (filas 2 a 112 de Calculos_Ocultos)
  var TASA = 0.05;
  var CRECIMIENTO = 0;        // tasa de crecimiento de la suma asegurada (el Excel la trae en 0)

  /* Recargo por gastos administrativos (celda C23 del Excel) */
  var RECARGO = { temporal: 0.51, vitalicio: 0.40, dotal: 0.54 };

  /* Condiciones médicas y su porcentaje extra (Excel, columnas E y G). Las claves se conservan. */
  var EXTRAPRIMAS = {
    ninguno: { nombre: 'Ninguno', extra: 0 },
    E000001: { nombre: 'Hipertiroidismo', extra: 0.25 },
    E000002: { nombre: 'Asma crónica controlada', extra: 0.35 },
    E000003: { nombre: 'Dislipidemia', extra: 0.34 },
    E000004: { nombre: 'Diabetes tipo II controlada', extra: 0.80 },
    E000005: { nombre: 'Obesidad', extra: 0.40 },
    E000006: { nombre: 'Cardiopatía coronaria estable', extra: 1.00 },
    E000007: { nombre: 'Enfermedad renal crónica', extra: 0.32 },
    E000008: { nombre: 'Hipertensión controlada', extra: 0.30 }
  };

  var TIPO_CAMBIO = {
    MXN: { valor: 1, fuente: 'Moneda base' },
    USD: { valor: 18.1128, fuente: 'FIX Banxico del 8-oct-2026' },
    EUR: { valor: 20.47, fuente: 'Cotización del 5-oct-2026 (aproximada)' }
  };

  /* Límites de contratación observados en la cartera (17,640 pólizas):
     edad de ingreso, edad máxima al terminar el plazo y suma asegurada por moneda.
     Vitalicio: los pagos de prima terminan a más tardar a los 85, igual que el Temporal más largo. */
  var LIMITES = {
    temporal:  { edadMin: 18, edadMax: 70, finMax: 85, suma: { MXN: [100000, 8000000], USD: [10000, 500000], EUR: [10000, 203000] } },
    vitalicio: { edadMin: 18, edadMax: 75, finMax: 85, suma: { MXN: [100000, 8000000], USD: [10000, 500000], EUR: [10000, 300000] } },
    dotal:     { edadMin: 18, edadMax: 60, finMax: 80, suma: { MXN: [100000, 8000000], USD: [10000, 500000], EUR: [20000, 150000] } }
  };
  var PLAZOS = [5, 10, 15, 20, 25, 30, 35, 40];

  /* Plazos (Temporal y Dotal) que caben antes de la edad máxima */
  function plazosValidos(producto, edad) {
    var L = LIMITES[producto];
    if (!L || edad < L.edadMin || edad > L.edadMax) return [];
    return PLAZOS.filter(function (p) { return edad + p <= L.finMax; });
  }

  function q(age) { return QX[Math.max(0, Math.min(EDAD_MAX_TABLA, age))]; }

  /* Edad corregida (celda C7 del Excel) */
  function edadTarificacion(edad, sexo, fumador, deportista) {
    return edad - (sexo === 'F' ? 3 : 0) - (fumador ? 0 : 2) - (deportista ? 1 : 0);
  }

  /* Años de pago posibles: de 1 hasta el plazo de protección (Temporal y Dotal);
     en Vitalicio, hasta que los pagos terminen a la edad máxima (85). */
  function maxPagos(producto, edad, plazo) {
    if (producto === 'vitalicio') return Math.max(LIMITES.vitalicio.finMax - edad, 0);
    return plazo;
  }

  /* opts: { producto: 'temporal'|'vitalicio'|'dotal', edad, sexo: 'F'|'M', fumador: bool, deportista: bool,
             suma, sumaSupervivencia (Dotal; por omisión, igual a suma), moneda: 'MXN'|'USD'|'EUR',
             plazo (años, Temporal/Dotal), pagos (años de pago; por omisión, todo el plazo o de por vida en
             Vitalicio, como el Excel; 'vida' = pagos de por vida), padecimientos (lista de claves de EXTRAPRIMAS:
             sus porcentajes se suman, como el SUMPRODUCT del Excel; también acepta padecimiento con una sola clave),
             crecimiento (tasa de crecimiento de la suma asegurada; por omisión 0) } */
  function extraprimaTotal(lista) {
    var vistos = {}, total = 0;
    (lista || []).forEach(function (k) { if (EXTRAPRIMAS[k] && !vistos[k]) { vistos[k] = true; total += EXTRAPRIMAS[k].extra; } });
    return total;
  }
  function cotizar(opts) {
    var producto = opts.producto;
    var x = edadTarificacion(opts.edad, opts.sexo, opts.fumador, opts.deportista);
    var sa = opts.suma;
    var saf = opts.sumaSupervivencia == null ? sa : opts.sumaSupervivencia;
    var g = opts.crecimiento == null ? CRECIMIENTO : opts.crecimiento;
    var v = 1 / (1 + TASA);
    var ep = extraprimaTotal(opts.padecimientos || (opts.padecimiento ? [opts.padecimiento] : []));
    var recargo = RECARGO[producto];
    var tc = (TIPO_CAMBIO[opts.moneda] || TIPO_CAMBIO.MXN).valor;
    var vida = producto === 'vitalicio';
    var n = vida ? FILAS : opts.plazo;

    // Años de pago: el Excel paga todo el plazo (o toda la tabla en Vitalicio)
    var m;
    if (vida) m = (!opts.pagos || opts.pagos === 'vida') ? FILAS : Math.min(opts.pagos, FILAS);
    else m = Math.min(opts.pagos || n, n);

    // Una pasada por las filas k = 0…110, como la hoja Calculos_Ocultos
    var kpx = 1, muerte = 0, anualidad = 0, npx = 1;
    for (var k = 0; k < FILAS; k++) {
      var qk = q(x + k);
      if (k === n) npx = kpx;
      if (k < n) muerte += kpx * qk * Math.pow(v, k + 1) * Math.pow(1 + g, k);
      if (k < m) anualidad += kpx * Math.pow(v, k);
      kpx *= 1 - qk;
    }

    var pnuMuerte = sa * muerte;
    var pnuVida = producto === 'dotal' ? npx * Math.pow(v, n) * Math.pow(1 + g, n) * saf : 0;
    var pnuPura = pnuMuerte + pnuVida;                       // Prima pura, pago único
    var factor = (1 + ep) / (1 - recargo);                   // (1 + extraprima) ÷ (1 − recargo)
    var anualPura = pnuPura / anualidad;

    return {
      edadTarificacion: x,
      coberturaAnios: vida ? null : n,
      pagos: m,
      pagosDeVida: vida && m === FILAS,
      extraprima: ep,
      recargo: recargo,
      tipoCambio: tc,
      anualidad: anualidad,
      // Prima pura (sin gastos ni extraprima), como "Prima Pura (Base)" del Excel
      pnuPura: pnuPura,
      primaAnualPura: anualPura,
      pnuMuerte: pnuMuerte,
      pnuSupervivencia: pnuVida,
      // Prima total a pagar (con extraprima y gastos), como "PRIMA TOTAL A PAGAR" del Excel
      pnu: pnuPura * factor,
      primaAnual: anualPura * factor,
      pnuMXN: pnuPura * factor * tc,
      primaAnualMXN: anualPura * factor * tc
    };
  }

  root.VitaeCotizador = { cotizar: cotizar, EXTRAPRIMAS: EXTRAPRIMAS, TIPO_CAMBIO: TIPO_CAMBIO, TASA: TASA, RECARGO: RECARGO, LIMITES: LIMITES, PLAZOS: PLAZOS, plazosValidos: plazosValidos, maxPagos: maxPagos, edadTarificacion: edadTarificacion, extraprimaTotal: extraprimaTotal };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.VitaeCotizador;
})(typeof window !== 'undefined' ? window : globalThis);
