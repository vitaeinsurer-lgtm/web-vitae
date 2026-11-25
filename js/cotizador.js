/* VITAE — motor del cotizador
   Reproduce la hoja "Cotizador" de BasesVitae_Cotizador_Interno.xlsm:
   - Tabla de mortalidad CNSF M 2013 (qx, edades 0 a 111), tasa técnica del 6%.
   - Edad de tarificación: edad − 3 si es mujer − 2 si no fuma.
   - PNU fallecimiento = SA · Σ kpx · q(x+k) · v^(k+1)  (k < n; Vitalicio hasta la edad 111).
   - Extraprima por padecimiento sobre la parte de fallecimiento (hoja Ajuste_PNU).
   - Dotal Mixto: + SA · npx · v^n por supervivencia.
   - Conversión a MXN con el tipo de cambio de la hoja Ajuste_PNU.
   La prima anual nivelada sigue la nota técnica (6.1.1 y 6.2): PNU ÷ anualidad anticipada
   de m pagos, ä = Σ kpx · v^k. Son primas netas: no incluyen gastos ni margen. */
(function (root) {
  'use strict';

  var QX = [0.000433,0.000433,0.000434,0.000434,0.000435,0.000436,0.000438,0.00044,0.000443,0.000446,0.000449,0.000453,0.000457,0.000463,0.000468,0.000475,0.000482,0.000489,0.000498,0.000507,0.000517,0.000528,0.00054,0.000553,0.000567,0.000582,0.000598,0.000616,0.000635,0.000656,0.000678,0.000703,0.000729,0.000757,0.000788,0.000821,0.000857,0.000896,0.000938,0.000983,0.001033,0.001087,0.001145,0.001208,0.001278,0.001353,0.001435,0.001525,0.001623,0.00173,0.001848,0.001977,0.002119,0.002274,0.002446,0.002635,0.002844,0.003074,0.003329,0.003612,0.003926,0.004275,0.004664,0.005096,0.005579,0.006119,0.006723,0.0074,0.00816,0.009015,0.009977,0.011061,0.012285,0.013668,0.015235,0.017009,0.019024,0.021312,0.023915,0.026879,0.030257,0.03411,0.038509,0.043533,0.049274,0.055833,0.063329,0.071889,0.08166,0.092798,0.105476,0.119875,0.136184,0.154594,0.175291,0.198441,0.224184,0.252613,0.28376,0.317576,0.353919,0.39254,0.433078,0.475068,0.517949,0.561099,0.603861,0.645589,0.685682,0.72362,0.758991,1];
  var EDAD_LIMITE = 111;
  var TASA = 0.06;

  var EXTRAPRIMAS = {
    ninguno: { nombre: 'Ninguno', extra: 0 },
    E000001: { nombre: 'Hipotiroidismo', extra: 0.25 },
    E000002: { nombre: 'Asma crónica', extra: 0.35 },
    E000003: { nombre: 'Dislipidemia', extra: 0.34 },
    E000004: { nombre: 'Diabetes tipo 2', extra: 0.80 },
    E000005: { nombre: 'Obesidad', extra: 0.40 },
    E000006: { nombre: 'Cardiopatía controlada', extra: 1.00 },
    E000007: { nombre: 'Enfermedad renal crónica', extra: 0.90 },
    E000008: { nombre: 'Hipertensión', extra: 0.30 }
  };

  var TIPO_CAMBIO = {
    MXN: { valor: 1, fuente: 'Moneda base' },
    USD: { valor: 18.1128, fuente: 'FIX Banxico del 8-oct-2026' },
    EUR: { valor: 20.47, fuente: 'Cotización del 5-oct-2026 (aproximada)' }
  };

  /* Límites de contratación observados en la cartera (hoja Cartera, 17,640 pólizas):
     edad de ingreso, edad máxima al terminar el plazo y suma asegurada por moneda.
     Vitalicio: los pagos de prima terminan a más tardar a los 85, igual que el Temporal más largo. */
  var LIMITES = {
    temporal:  { edadMin: 18, edadMax: 70, finMax: 85, suma: { MXN: [100000, 8000000], USD: [10000, 500000], EUR: [10000, 203000] } },
    vitalicio: { edadMin: 18, edadMax: 75, finMax: 85, suma: { MXN: [100000, 8000000], USD: [10000, 500000], EUR: [10000, 300000] } },
    dotal:     { edadMin: 18, edadMax: 60, finMax: 80, suma: { MXN: [100000, 8000000], USD: [10000, 500000], EUR: [20000, 150000] } }
  };
  var PLAZOS = [5, 10, 15, 20, 25, 30, 35, 40];

  /* Plazos (Temporal y Dotal) o años de pago (Vitalicio) que caben antes de la edad máxima */
  function plazosValidos(producto, edad) {
    var L = LIMITES[producto];
    if (!L || edad < L.edadMin || edad > L.edadMax) return [];
    return PLAZOS.filter(function (p) { return edad + p <= L.finMax; });
  }

  function q(age) { return age >= EDAD_LIMITE ? 1 : QX[age]; }

  /* Ajustes de la nota técnica (6.4): mujer −3 años, no fumador −2 años y condición deportiva −1 año.
     El Excel interno no tiene la variable deportiva (la cartera no la registra): sin ella, el cálculo es idéntico al Excel. */
  function edadTarificacion(edad, sexo, fumador, deportista) {
    return edad - (sexo === 'F' ? 3 : 0) - (fumador ? 0 : 2) - (deportista ? 1 : 0);
  }

  /* Años de pago posibles: de 1 hasta el plazo de protección (Temporal y Dotal);
     en Vitalicio, hasta que los pagos terminen a la edad máxima (85). */
  function maxPagos(producto, edad, plazo) {
    if (producto === 'vitalicio') return Math.max(LIMITES.vitalicio.finMax - edad, 0);
    return plazo;
  }

  /* opts: { producto: 'temporal'|'vitalicio'|'dotal', edad, sexo: 'F'|'M', fumador: bool,
             suma, moneda: 'MXN'|'USD'|'EUR', plazo (años, Temporal/Dotal),
             pagos (años de pago de primas, de 1 al plazo; por omisión, todo el plazo o 20 en Vitalicio),
             deportista: bool, padecimiento (clave de EXTRAPRIMAS),
             sinAjusteEdad (solo para pruebas) } */
  function cotizar(opts) {
    var producto = opts.producto;
    var x = opts.sinAjusteEdad ? opts.edad : edadTarificacion(opts.edad, opts.sexo, opts.fumador, opts.deportista);
    var sa = opts.suma;
    var v = 1 / (1 + TASA);
    var ep = (EXTRAPRIMAS[opts.padecimiento] || EXTRAPRIMAS.ninguno).extra;
    var tc = (TIPO_CAMBIO[opts.moneda] || TIPO_CAMBIO.MXN).valor;

    // Años de cobertura que entran en la suma de fallecimiento
    var n = producto === 'vitalicio' ? EDAD_LIMITE - x + 1 : opts.plazo;

    var kpx = 1, muerte = 0, kpxEnN = 1;
    for (var k = 0; k < n; k++) {
      var qk = q(x + k);
      muerte += kpx * qk * Math.pow(v, k + 1);
      kpx *= (1 - qk);
    }
    kpxEnN = kpx;

    var pnuMuerte = sa * muerte * (1 + ep);
    var pnuVida = producto === 'dotal' ? sa * kpxEnN * Math.pow(v, n) : 0;
    var pnu = pnuMuerte + pnuVida;

    // Anualidad anticipada del periodo de pagos (m ≤ n)
    var m = producto === 'vitalicio' ? Math.min(opts.pagos || 20, EDAD_LIMITE - x + 1) : Math.min(opts.pagos || n, n);
    var a = 0, p = 1;
    for (var j = 0; j < m; j++) {
      a += p * Math.pow(v, j);
      p *= (1 - q(x + j));
    }

    return {
      edadTarificacion: x,
      coberturaAnios: producto === 'vitalicio' ? null : n,
      pagos: m,
      extraprima: ep,
      tipoCambio: tc,
      pnu: pnu,
      pnuMuerte: pnuMuerte,
      pnuSupervivencia: pnuVida,
      pnuMXN: pnu * tc,
      anualidad: a,
      primaAnual: pnu / a,
      primaAnualMXN: (pnu / a) * tc
    };
  }

  root.VitaeCotizador = { cotizar: cotizar, EXTRAPRIMAS: EXTRAPRIMAS, TIPO_CAMBIO: TIPO_CAMBIO, TASA: TASA, LIMITES: LIMITES, PLAZOS: PLAZOS, plazosValidos: plazosValidos, maxPagos: maxPagos };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.VitaeCotizador;
})(typeof window !== 'undefined' ? window : globalThis);
