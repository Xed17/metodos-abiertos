/**
 * ============================================================================
 * Métodos Abiertos - Punto Fijo, Newton-Raphson y Secante
 * Arquitectura modular, concisa y sin redundancias (DRY)
 * ============================================================================
 */

const EPSILON = 1e-12;

// Configuraciones y presets de los problemas originales de la guía
const METODOS = {
  puntoFijo: {
    prefix: "p1",
    tabId: "tab-punto-fijo",
    containerId: "resultado-punto-fijo",
    chartId: "chart-punto-fijo",
    nombre: "Punto Fijo",
    variableDefault: "T",
    unidad: "°C",
    preset: { g: "18 + 8 * exp(-0.15 * T)", f: "T - 18 - 8 * exp(-0.15 * T)", x0: 20, tol: 0.01, maxIter: 50 },
    columnas: (v) => ["n", `${v}<sub>n</sub>`, `g(${v}<sub>n</sub>) = ${v}<sub>n+1</sub>`, `|${v}<sub>n+1</sub> − ${v}<sub>n</sub>|`, "ε<sub>a</sub> (%)", `f(${v}<sub>n+1</sub>)`],
    mapearFila: (f) => [f.n, f.xn.toFixed(8), f.siguiente.toFixed(8), formatearCientifico(f.difAbs), `${f.error.toFixed(6)}%`, f.funcion.toExponential(4)]
  },
  newton: {
    prefix: "p2",
    tabId: "tab-newton",
    containerId: "resultado-newton",
    chartId: "chart-newton",
    nombre: "Newton-Raphson",
    variableDefault: "t",
    unidad: "ms",
    preset: { f: "t^3 - 7*t - 5", df: "3*t^2 - 7", x0: 3, tol: 0.01, maxIter: 50 },
    columnas: (v) => ["n", `${v}<sub>n</sub>`, `f(${v}<sub>n</sub>)`, `f'(${v}<sub>n</sub>)`, `${v}<sub>n+1</sub>`, `|${v}<sub>n+1</sub> − ${v}<sub>n</sub>|`, "ε<sub>a</sub> (%)"],
    mapearFila: (f) => [f.n, f.xn.toFixed(8), f.fxn.toExponential(4), f.dfxn.toFixed(6), f.siguiente.toFixed(8), formatearCientifico(f.difAbs), `${f.error.toFixed(6)}%`]
  },
  secante: {
    prefix: "p3",
    tabId: "tab-secante",
    containerId: "resultado-secante",
    chartId: "chart-secante",
    nombre: "Secante",
    variableDefault: "x",
    unidad: "",
    preset: { f: "exp(-x) - x^2 + 0.2", x0: 0, x1: 1, tol: 0.01, maxIter: 50 },
    columnas: (v) => ["n", `${v}<sub>n−1</sub>`, `${v}<sub>n</sub>`, `f(${v}<sub>n−1</sub>)`, `f(${v}<sub>n</sub>)`, `${v}<sub>n+1</sub>`, `|${v}<sub>n+1</sub> − ${v}<sub>n</sub>|`, "ε<sub>a</sub> (%)"],
    mapearFila: (f) => [f.n, f.xAnt.toFixed(8), f.xAct.toFixed(8), f.fxAnt.toExponential(4), f.fxAct.toExponential(4), f.siguiente.toFixed(8), formatearCientifico(f.difAbs), `${f.error.toFixed(6)}%`]
  }
};

const graficos = {};

// ----------------------------------------------------------------------------
// Utilidades Matemáticas y Formateo
// ----------------------------------------------------------------------------

function renderizarKaTeX(elemento = document.body) {
  if (window.renderMathInElement) {
    renderMathInElement(elemento, {
      delimiters: [
        { left: "$$", right: "$$", display: true },
        { left: "\\[", right: "\\]", display: true },
        { left: "$", right: "$", display: false },
        { left: "\\(", right: "\\)", display: false }
      ],
      throwOnError: false
    });
  }
}

function calcularError(actual, anterior) {
  return Math.abs(actual) < EPSILON ? Math.abs(actual - anterior) * 100 : Math.abs((actual - anterior) / actual) * 100;
}

function formatearCientifico(val) {
  if (!Number.isFinite(val) || val === 0) return "0.00";
  const [coef, exp] = val.toExponential(2).split("e");
  const sup = { "-": "⁻", "+": "", "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹" };
  const expFmt = String(parseInt(exp, 10)).split("").map((c) => sup[c] || c).join("");
  return `${coef}×10${expFmt}`;
}

function detectarVariable(exprStr, fallback = "x") {
  if (!window.math || !exprStr?.trim()) return fallback;
  try {
    const node = math.parse(exprStr);
    const ign = new Set(["e", "pi", "i", "E", "PI", "exp", "sin", "cos", "tan", "asin", "acos", "atan", "sinh", "cosh", "tanh", "log", "ln", "log10", "sqrt", "cbrt", "abs"]);
    const sim = [];
    node.traverse((n) => { if (n.isSymbolNode && !ign.has(n.name)) sim.push(n.name); });
    return sim.includes(fallback) ? fallback : (sim[0] || fallback);
  } catch { return fallback; }
}

function compilarExpresion(exprStr, variable) {
  if (!exprStr?.trim()) return null;
  const node = math.parse(exprStr);
  const compiled = node.compile();
  return {
    evaluar: (val) => {
      const res = compiled.evaluate({ [variable]: val, e: Math.E, pi: Math.PI, PI: Math.PI });
      return (typeof res === "object" && res?.re !== undefined) ? (Math.abs(res.im) < EPSILON ? res.re : NaN) : Number(res);
    },
    toTex: () => { try { return node.toTex({ parenthesis: "auto" }); } catch { return exprStr; } }
  };
}

function derivarSimbólica(exprStr, variable) {
  try { return exprStr?.trim() ? math.derivative(exprStr, variable).toString() : ""; }
  catch { return ""; }
}

function mostrarAlerta(id, mensaje = "", tipo = "error") {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = mensaje ? `<div class="alert-box alert-${tipo}"><span>${tipo === "error" ? "❌" : tipo === "warning" ? "⚠️" : "ℹ️"}</span><span>${mensaje}</span></div>` : "";
}

// ----------------------------------------------------------------------------
// Algoritmos Numéricos con Registro Detallado Paso a Paso
// ----------------------------------------------------------------------------

function resolverPuntoFijo(gObj, fObj, x0, tol, maxIter, v) {
  let actual = x0;
  const historial = [], pasos = [];
  const g = gObj.evaluar, f = fObj ? fObj.evaluar : (x) => x - g(x);

  for (let i = 0; i < maxIter; i++) {
    const sig = g(actual);
    if (!Number.isFinite(sig)) return { exito: false, historial, pasos, errorMsg: `Valor no finito en iteración ${i}: ${sig}` };

    const err = calcularError(sig, actual), funcion = f(sig), dif = Math.abs(sig - actual), fin = err <= tol;
    historial.push({ n: i, xn: actual, siguiente: sig, difAbs: dif, error: err, funcion });

    pasos.push({
      n: i + 1, titulo: `Iteración ${i + 1}`, esFin: fin, xSig: sig, error: err, residuo: Math.abs(funcion),
      latex: `\\begin{aligned}
        ${v}_{${i+1}} &= g(${v}_{${i}}) = g(${actual.toFixed(8)}) = \\mathbf{${sig.toFixed(8)}} \\\\[4pt]
        \\varepsilon_a &= \\left|\\frac{${sig.toFixed(8)} - ${actual.toFixed(8)}}{${sig.toFixed(8)}}\\right| \\times 100\\% = \\mathbf{${err.toFixed(6)}\\%} \\\\[4pt]
        |f(${v}_{${i+1}})| &= |f(${sig.toFixed(8)})| = \\mathbf{${Math.abs(funcion).toExponential(4)}}
      \\end{aligned}`
    });

    if (fin) return { exito: true, raiz: sig, valorFuncion: funcion, errorFinal: err, iteraciones: i + 1, historial, pasos };
    actual = sig;
  }
  return { exito: false, raiz: historial.at(-1)?.siguiente, valorFuncion: historial.at(-1)?.funcion, errorFinal: historial.at(-1)?.error, iteraciones: maxIter, historial, pasos, errorMsg: `Se alcanzó el máximo de ${maxIter} iteraciones sin alcanzar la tolerancia.` };
}

function resolverNewton(fObj, dfObj, x0, tol, maxIter, v) {
  let actual = x0;
  const historial = [], pasos = [];
  const f = fObj.evaluar, df = dfObj.evaluar;

  for (let i = 0; i < maxIter; i++) {
    const fAct = f(actual), dfAct = df(actual);
    if (Math.abs(dfAct) < EPSILON) return { exito: false, historial, pasos, errorMsg: `Derivada casi nula f'(${actual.toFixed(6)}) ≈ 0 en iteración ${i}. División por cero evitada.` };

    const sig = actual - fAct / dfAct;
    if (!Number.isFinite(sig)) return { exito: false, historial, pasos, errorMsg: `Valor no finito en iteración ${i}: ${sig}` };

    const err = calcularError(sig, actual), funcion = f(sig), dif = Math.abs(sig - actual), fin = err <= tol;
    historial.push({ n: i, xn: actual, fxn: fAct, dfxn: dfAct, siguiente: sig, difAbs: dif, error: err, funcion });

    pasos.push({
      n: i + 1, titulo: `Iteración ${i + 1}`, esFin: fin, xSig: sig, error: err, residuo: Math.abs(funcion),
      latex: `\\begin{aligned}
        f(${v}_{${i}}) &= ${fAct.toExponential(4)}, \\quad f'(${v}_{${i}}) = ${dfAct.toFixed(6)} \\\\[4pt]
        ${v}_{${i+1}} &= ${actual.toFixed(8)} - \\frac{${fAct.toExponential(4)}}{${dfAct.toFixed(6)}} = \\mathbf{${sig.toFixed(8)}} \\\\[4pt]
        \\varepsilon_a &= \\left|\\frac{${sig.toFixed(8)} - ${actual.toFixed(8)}}{${sig.toFixed(8)}}\\right| \\times 100\\% = \\mathbf{${err.toFixed(6)}\\%} \\\\[4pt]
        |f(${v}_{${i+1}})| &= |f(${sig.toFixed(8)})| = \\mathbf{${Math.abs(funcion).toExponential(4)}}
      \\end{aligned}`
    });

    if (fin) return { exito: true, raiz: sig, valorFuncion: funcion, errorFinal: err, iteraciones: i + 1, historial, pasos };
    actual = sig;
  }
  return { exito: false, raiz: historial.at(-1)?.siguiente, valorFuncion: historial.at(-1)?.funcion, errorFinal: historial.at(-1)?.error, iteraciones: maxIter, historial, pasos, errorMsg: `Se alcanzó el máximo de ${maxIter} iteraciones sin alcanzar la tolerancia.` };
}

function resolverSecante(fObj, x0, x1, tol, maxIter, v) {
  let xAnt = x0, xAct = x1;
  const historial = [], pasos = [];
  const f = fObj.evaluar;

  for (let i = 1; i <= maxIter; i++) {
    const fxAnt = f(xAnt), fxAct = f(xAct);
    const den = fxAct - fxAnt;
    if (Math.abs(den) < EPSILON) return { exito: false, historial, pasos, errorMsg: `Diferencia de ordenadas nula f(${xAct.toFixed(6)}) − f(${xAnt.toFixed(6)}) ≈ 0 en iteración ${i}. División por cero evitada.` };

    const sig = xAct - (fxAct * (xAct - xAnt)) / den;
    if (!Number.isFinite(sig)) return { exito: false, historial, pasos, errorMsg: `Valor no finito en iteración ${i}: ${sig}` };

    const err = calcularError(sig, xAct), funcion = f(sig), dif = Math.abs(sig - xAct), fin = err <= tol;
    historial.push({ n: i, xAnt, xAct, fxAnt, fxAct, siguiente: sig, difAbs: dif, error: err, funcion });

    pasos.push({
      n: i, titulo: `Iteración ${i}`, esFin: fin, xSig: sig, error: err, residuo: Math.abs(funcion),
      latex: `\\begin{aligned}
        f(${v}_{${i-1}}) &= ${fxAnt.toExponential(4)}, \\quad f(${v}_{${i}}) = ${fxAct.toExponential(4)} \\\\[4pt]
        ${v}_{${i+1}} &= ${xAct.toFixed(8)} - (${fxAct.toExponential(4)}) \\cdot \\frac{${(xAct - xAnt).toFixed(8)}}{${den.toExponential(4)}} = \\mathbf{${sig.toFixed(8)}} \\\\[4pt]
        \\varepsilon_a &= \\left|\\frac{${sig.toFixed(8)} - ${xAct.toFixed(8)}}{${sig.toFixed(8)}}\\right| \\times 100\\% = \\mathbf{${err.toFixed(6)}\\%} \\\\[4pt]
        |f(${v}_{${i+1}})| &= |f(${sig.toFixed(8)})| = \\mathbf{${Math.abs(funcion).toExponential(4)}}
      \\end{aligned}`
    });

    if (fin) return { exito: true, raiz: sig, valorFuncion: funcion, errorFinal: err, iteraciones: i, historial, pasos };
    xAnt = xAct; xAct = sig;
  }
  return { exito: false, raiz: historial.at(-1)?.siguiente, valorFuncion: historial.at(-1)?.funcion, errorFinal: historial.at(-1)?.error, iteraciones: maxIter, historial, pasos, errorMsg: `Se alcanzó el máximo de ${maxIter} iteraciones sin alcanzar la tolerancia.` };
}

// ----------------------------------------------------------------------------
// Renderizado de Resultados y Gráficos
// ----------------------------------------------------------------------------

function obtenerInterpretacion(key, res, variable) {
  if (!res.exito && !res.raiz) return `<span style="color: #b91c1c;">⚠️ ${res.errorMsg || "El método no convergió."}</span>`;
  const r = res.raiz.toFixed(6), f = Math.abs(res.valorFuncion).toExponential(3), e = res.errorFinal.toFixed(4), it = res.iteraciones;

  if (res.exito) {
    const descripciones = {
      puntoFijo: `La solución de equilibrio calculada es <strong>\\(${variable} = ${r}\\)</strong>. El residuo funcional es \\(|f(${variable})| = ${f}\\), confirmando convergencia satisfactoria en <strong>${it} iteraciones</strong> (error final \\(\\varepsilon_a = ${e}\\%\\)).`,
      newton: `La raíz aproximada encontrada es <strong>\\(${variable} = ${r}\\)</strong>. El residuo es prácticamente nulo (\\(|f(${variable})| = ${f}\\)), demostrando convergencia cuadrática en <strong>${it} iteraciones</strong> (error final \\(\\varepsilon_a = ${e}\\%\\)).`,
      secante: `La raíz calculada para el modelo es <strong>\\(${variable} = ${r}\\)</strong>. El residuo \\(|f(${variable})| = ${f}\\) valida la solución obtenida sin derivadas analíticas en <strong>${it} iteraciones</strong> (error final \\(\\varepsilon_a = ${e}\\%\\)).`
    };
    return descripciones[key] || `Raíz calculada: <strong>\\(${variable} = ${r}\\)</strong> en <strong>${it} iteraciones</strong>.`;
  }
  return `<span style="color: #b91c1c;">⚠️ No se alcanzó la convergencia deseada: ${res.errorMsg} (Última aproximación: \\(${variable} \\approx ${r}\\), error \\(\\varepsilon_a = ${e}\\%\\)).</span>`;
}

function renderizar(key, res, variable, formulaTex) {
  const cfg = METODOS[key];
  const container = document.getElementById(cfg.containerId);
  if (!container) return;

  const thead = `<tr>${cfg.columnas(variable).map((c) => `<th>${c}</th>`).join("")}</tr>`;
  const tbody = res.historial.map((fila, idx) => {
    const esFin = res.exito && idx === res.historial.length - 1;
    return `<tr class="${esFin ? "fila-convergente" : ""}">${cfg.mapearFila(fila).map((c) => `<td>${c}</td>`).join("")}</tr>`;
  }).join("");

  const pasosHtml = (res.pasos || []).map((p) => `
    <div class="paso-card ${p.esFin ? "paso-convergente" : ""}">
      <div class="paso-header">
        <span class="paso-titulo">${p.titulo}</span>
        <span class="paso-badge ${p.esFin ? "paso-badge-fin" : "paso-badge-calc"}">${p.esFin ? "✓ Convergencia alcanzada" : "Iteración de cálculo"}</span>
      </div>
      <div class="paso-math-block">\\[${p.latex}\\]</div>
      <div class="paso-resumen">
        <span>Nueva aproximación: <strong>${variable} = ${p.xSig.toFixed(8)}</strong></span>
        <span>Error relativo: <strong>${p.error.toFixed(6)}%</strong></span>
        <span>Residuo |f(${variable})|: <strong>${p.residuo.toExponential(4)}</strong></span>
      </div>
    </div>
  `).join("");

  container.innerHTML = `
    <div class="section-block">
      <h3 class="section-heading">Tabla de Iteraciones</h3>
      <div class="table-container">
        <table class="tabla-iteraciones"><thead>${thead}</thead><tbody>${tbody}</tbody></table>
        <p class="table-caption">Iteraciones calculadas para \\(${formulaTex}\\)</p>
      </div>
    </div>
    <div class="chart-container"><div class="chart-wrapper"><canvas id="${cfg.chartId}"></canvas></div></div>
    <hr class="section-divider">
    <div class="section-block">
      <h3 class="section-heading">Interpretación y Verificación</h3>
      <p class="inline-info">${obtenerInterpretacion(key, res, variable)}</p>
    </div>
    <hr class="section-divider">
    <div class="section-block">
      <h3 class="section-heading">Desarrollo Matemático Paso a Paso (Iteración por Iteración)</h3>
      <p class="problem-desc">Desglose analítico completo de cada iteración con valores numéricos sustituidos:</p>
      <div class="pasos-container">${pasosHtml || "<p class='inline-info'>No se generaron pasos para los parámetros indicados.</p>"}</div>
    </div>
  `;

  // Renderizar o actualizar gráfico Chart.js
  if (graficos[cfg.chartId]) graficos[cfg.chartId].destroy();
  const canvas = document.getElementById(cfg.chartId);
  if (canvas && res.historial.length > 0) {
    graficos[cfg.chartId] = new Chart(canvas, {
      type: "line",
      data: {
        labels: res.historial.map((f) => `Iteración ${f.n}`),
        datasets: [{
          label: `Error relativo εa (%)`,
          data: res.historial.map((f) => Math.max(f.error, 1e-10)),
          borderColor: "#6d28d9",
          backgroundColor: "rgba(109, 40, 217, 0.08)",
          borderWidth: 2,
          pointBackgroundColor: "#6d28d9",
          pointRadius: 4,
          fill: true,
          tension: 0.15
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: true, position: "top", labels: { color: "#334155", font: { weight: 600 } } } },
        scales: {
          x: { title: { display: true, text: "Iteración (n)", color: "#64748b" }, grid: { color: "#f1f5f9" } },
          y: { type: "logarithmic", title: { display: true, text: "Error εa (%) - Escala Log", color: "#64748b" }, grid: { color: "#f1f5f9" } }
        }
      }
    });
  }

  renderizarKaTeX(container);
}

// ----------------------------------------------------------------------------
// Controlador Universal de Ejecución y Restauración
// ----------------------------------------------------------------------------

function ejecutar(key) {
  const cfg = METODOS[key];
  const pfx = cfg.prefix;
  mostrarAlerta(`${pfx}-alert`, "");

  const tol = parseFloat(document.getElementById(`${pfx}-tol`).value);
  const max = parseInt(document.getElementById(`${pfx}-max-iter`).value, 10);
  if (isNaN(tol) || isNaN(max) || tol <= 0 || max <= 0) {
    return mostrarAlerta(`${pfx}-alert`, "Por favor ingresa parámetros válidos de tolerancia y máximo de iteraciones.");
  }

  let res, variable, formulaTex;

  if (key === "puntoFijo") {
    const gRaw = document.getElementById(`${pfx}-eq-g`).value;
    const fRaw = document.getElementById(`${pfx}-eq-f`).value;
    variable = detectarVariable(gRaw, cfg.variableDefault);
    const x0 = parseFloat(document.getElementById(`${pfx}-x0`).value);
    if (isNaN(x0)) return mostrarAlerta(`${pfx}-alert`, "Ingresa un punto inicial válido.");

    let gObj, fObj;
    try { gObj = compilarExpresion(gRaw, variable); } catch (e) { return mostrarAlerta(`${pfx}-alert`, `Error en g(${variable}): ${e.message}`); }
    try { if (fRaw.trim()) fObj = compilarExpresion(fRaw, variable); } catch (e) { mostrarAlerta(`${pfx}-alert`, `Error en f(${variable}): ${e.message}`, "warning"); }

    document.getElementById(`${pfx}-lbl-x0`).innerHTML = `\\(${variable}_0\\):`;
    const gTex = gObj.toTex(), fTex = fObj ? fObj.toTex() : (fRaw || `${variable} - (${gTex})`);
    document.getElementById(`${pfx}-eq-preview`).innerHTML = `\\[ ${variable} = g(${variable}) = ${gTex} \\qquad \\Longleftrightarrow \\qquad f(${variable}) = ${fTex} = 0 \\]`;

    const dgStr = derivarSimbólica(gRaw, variable);
    if (dgStr) {
      try {
        const dgVal = compilarExpresion(dgStr, variable).evaluar(x0);
        const cv = Math.abs(dgVal) < 1;
        document.getElementById(`${pfx}-info-teorica`).innerHTML = `<strong>Condición de convergencia local:</strong> \\(|g'(${x0})| = |${dgVal.toFixed(6)}| = \\mathbf{${Math.abs(dgVal).toFixed(6)}} ${cv ? "< 1" : "\\ge 1"}\\) ${cv ? "<span style='color: #16a34a; font-weight: 600;'> (✓ Convergencia garantizada)</span>" : "<span style='color: #dc2626; font-weight: 600;'> (⚠️ Riesgo de divergencia)</span>"}`;
      } catch {}
    }

    res = resolverPuntoFijo(gObj, fObj, x0, tol, max, variable);
    formulaTex = `${variable} = ${gTex}`;

  } else if (key === "newton") {
    const fRaw = document.getElementById(`${pfx}-eq-f`).value;
    const dfRaw = document.getElementById(`${pfx}-eq-df`).value;
    variable = detectarVariable(fRaw, cfg.variableDefault);
    const x0 = parseFloat(document.getElementById(`${pfx}-x0`).value);
    if (isNaN(x0)) return mostrarAlerta(`${pfx}-alert`, "Ingresa un punto inicial válido.");

    let fObj, dfObj;
    try { fObj = compilarExpresion(fRaw, variable); } catch (e) { return mostrarAlerta(`${pfx}-alert`, `Error en f(${variable}): ${e.message}`); }
    try { dfObj = compilarExpresion(dfRaw, variable); } catch (e) { return mostrarAlerta(`${pfx}-alert`, `Error en f'(${variable}): ${e.message}`); }

    document.getElementById(`${pfx}-lbl-x0`).innerHTML = `\\(${variable}_0\\):`;
    const fTex = fObj.toTex(), dfTex = dfObj.toTex();
    document.getElementById(`${pfx}-eq-preview`).innerHTML = `\\[ f(${variable}) = ${fTex} = 0 \\qquad \\text{con} \\qquad f'(${variable}) = ${dfTex} \\]`;

    try {
      const fx0 = fObj.evaluar(x0), dfx0 = dfObj.evaluar(x0);
      document.getElementById(`${pfx}-info-teorica`).innerHTML = `<strong>Evaluación en punto inicial:</strong> \\(f(${x0}) = \\mathbf{${fx0.toFixed(6)}}, \\quad f'(${x0}) = \\mathbf{${dfx0.toFixed(6)}}\\) ${Math.abs(dfx0) < EPSILON ? "<span style='color: #dc2626; font-weight: 600;'> (⚠️ Derivada cercana a cero)</span>" : "<span style='color: #16a34a; font-weight: 600;'> (✓ Derivada no nula)</span>"}`;
    } catch {}

    res = resolverNewton(fObj, dfObj, x0, tol, max, variable);
    formulaTex = `f(${variable}) = ${fTex}`;

  } else if (key === "secante") {
    const fRaw = document.getElementById(`${pfx}-eq-f`).value;
    variable = detectarVariable(fRaw, cfg.variableDefault);
    const x0 = parseFloat(document.getElementById(`${pfx}-x0`).value);
    const x1 = parseFloat(document.getElementById(`${pfx}-x1`).value);
    if (isNaN(x0) || isNaN(x1)) return mostrarAlerta(`${pfx}-alert`, "Ingresa puntos iniciales válidos.");

    let fObj;
    try { fObj = compilarExpresion(fRaw, variable); } catch (e) { return mostrarAlerta(`${pfx}-alert`, `Error en f(${variable}): ${e.message}`); }

    document.getElementById(`${pfx}-lbl-x0`).innerHTML = `\\(${variable}_0\\):`;
    document.getElementById(`${pfx}-lbl-x1`).innerHTML = `\\(${variable}_1\\):`;
    const fTex = fObj.toTex();
    document.getElementById(`${pfx}-eq-preview`).innerHTML = `\\[ f(${variable}) = ${fTex} = 0 \\]`;

    try {
      const fx0 = fObj.evaluar(x0), fx1 = fObj.evaluar(x1), cs = fx0 * fx1 < 0;
      document.getElementById(`${pfx}-info-teorica`).innerHTML = `<strong>Evaluación en puntos iniciales:</strong> \\(f(${x0}) = \\mathbf{${fx0.toFixed(6)}}, \\quad f(${x1}) = \\mathbf{${fx1.toFixed(6)}}\\) ${cs ? "<span style='color: #16a34a; font-weight: 600;'> (✓ Cambio de signo detectado en el intervalo)</span>" : "<span style='color: #d97706; font-weight: 600;'> (ℹ️ Mismo signo en extremos)</span>"}`;
    } catch {}

    res = resolverSecante(fObj, x0, x1, tol, max, variable);
    formulaTex = `f(${variable}) = ${fTex}`;
  }

  renderizar(key, res, variable, formulaTex);
  renderizarKaTeX(document.getElementById(cfg.tabId));
}

function restaurar(key) {
  const cfg = METODOS[key];
  const pfx = cfg.prefix;
  Object.entries(cfg.preset).forEach(([campo, val]) => {
    const input = document.getElementById(`${pfx}-${campo === "g" || campo === "f" || campo === "df" ? "eq-" + campo : campo}`);
    if (input) input.value = val;
  });
  ejecutar(key);
}

function autoDerivarNewton() {
  const fRaw = document.getElementById("p2-eq-f").value;
  const der = derivarSimbólica(fRaw, detectarVariable(fRaw, "t"));
  if (der) {
    document.getElementById("p2-eq-df").value = der;
    ejecutar("newton");
  } else {
    mostrarAlerta("p2-alert", "No se pudo derivar simbólicamente la función. Ingrésala manualmente.", "warning");
  }
}

// ----------------------------------------------------------------------------
// Inicialización y Eventos
// ----------------------------------------------------------------------------

document.addEventListener("DOMContentLoaded", () => {
  // Pestañas
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach((b) => { b.classList.remove("active"); b.setAttribute("aria-selected", "false"); });
      document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
      btn.classList.add("active");
      btn.setAttribute("aria-selected", "true");
      document.getElementById(btn.dataset.tab)?.classList.add("active");
    });
  });

  // Event listeners por método
  Object.keys(METODOS).forEach((key) => {
    const pfx = METODOS[key].prefix;
    document.getElementById(`btn-resolver-${pfx}`)?.addEventListener("click", () => ejecutar(key));
    document.getElementById(`${pfx}-btn-restaurar`)?.addEventListener("click", () => restaurar(key));
  });

  // Auto-derivar en Newton
  document.getElementById("p2-btn-derivar")?.addEventListener("click", autoDerivarNewton);
  document.getElementById("p2-eq-f")?.addEventListener("change", () => {
    const fRaw = document.getElementById("p2-eq-f").value;
    const der = derivarSimbólica(fRaw, detectarVariable(fRaw, "t"));
    if (der) document.getElementById("p2-eq-df").value = der;
  });

  // Ejecución con tecla Enter en cualquier input
  document.querySelectorAll("input").forEach((input) => {
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        const panelId = input.closest(".tab-panel")?.id;
        const key = Object.keys(METODOS).find((k) => METODOS[k].tabId === panelId);
        if (key) ejecutar(key);
      }
    });
  });

  // Ejecución inicial automática
  Object.keys(METODOS).forEach((key) => ejecutar(key));
  renderizarKaTeX(document.body);
});
