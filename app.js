/**
 * ============================================================================
 * Métodos Abiertos - Punto Fijo, Newton-Raphson y Secante
 * Arquitectura modular, concisa y sin redundancias
 * ============================================================================
 */

const DEFAULT_TOLERANCIA = 0.01;
const DEFAULT_MAX_ITERACIONES = 50;
const EPSILON_NUMERICO = 1e-12;

const PROBLEMAS = {
  puntoFijo: {
    id: "punto-fijo",
    numTabla: 1,
    variable: "T",
    unidad: "°C",
    caption: "Tabla 1. Iteraciones del método del punto fijo para \\(f(T) = T - 18 - 8e^{-0.15T} = 0\\)",
    columnas: ["n", "T<sub>n</sub>", "g(T<sub>n</sub>) = T<sub>n+1</sub>", "|T<sub>n+1</sub> − T<sub>n</sub>|", "ε<sub>a</sub> (%)", "f(T<sub>n+1</sub>)"],
    mapearFila: (f) => [f.n, f.xn.toFixed(8), f.siguiente.toFixed(8), formatearCientificoGT(f.difAbs), `${f.error.toFixed(6)}%`, f.funcion.toExponential(4)]
  },
  newton: {
    id: "newton",
    numTabla: 2,
    variable: "t",
    unidad: "ms",
    caption: "Tabla 2. Iteraciones del método de Newton-Raphson para \\(f(t) = t^3 - 7t - 5 = 0\\)",
    columnas: ["n", "t<sub>n</sub>", "f(t<sub>n</sub>)", "f'(t<sub>n</sub>)", "t<sub>n+1</sub>", "|t<sub>n+1</sub> − t<sub>n</sub>|", "ε<sub>a</sub> (%)"],
    mapearFila: (f) => [f.n, f.xn.toFixed(8), f.fxn.toExponential(4), f.dfxn.toFixed(6), f.siguiente.toFixed(8), formatearCientificoGT(f.difAbs), `${f.error.toFixed(6)}%`]
  },
  secante: {
    id: "secante",
    numTabla: 3,
    variable: "x",
    unidad: "",
    caption: "Tabla 3. Iteraciones del método de la secante para \\(f(x) = e^{-x} - x^2 + 0.2 = 0\\)",
    columnas: ["n", "x<sub>n−1</sub>", "x<sub>n</sub>", "f(x<sub>n−1</sub>)", "f(x<sub>n</sub>)", "x<sub>n+1</sub>", "|x<sub>n+1</sub> − x<sub>n</sub>|", "ε<sub>a</sub> (%)"],
    mapearFila: (f) => [f.n, f.xAnt.toFixed(8), f.xAct.toFixed(8), f.fxAnt.toExponential(4), f.fxAct.toExponential(4), f.siguiente.toFixed(8), formatearCientificoGT(f.difAbs), `${f.error.toFixed(6)}%`]
  }
};

const graficos = {};

// ----------------------------------------------------------------------------
// Utilidades
// ----------------------------------------------------------------------------
function calcularError(actual, anterior) {
  return Math.abs(actual) < EPSILON_NUMERICO
    ? Math.abs(actual - anterior) * 100
    : Math.abs((actual - anterior) / actual) * 100;
}

function formatearCientificoGT(val) {
  if (!Number.isFinite(val) || val === 0) return "0.00";
  const [coef, exp] = val.toExponential(2).split("e");
  const superindices = { "-": "⁻", "+": "", "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹" };
  const expFmt = String(parseInt(exp, 10)).split("").map((c) => superindices[c] || c).join("");
  return `${coef}×10${expFmt}`;
}

// ----------------------------------------------------------------------------
// Algoritmos Numéricos
// ----------------------------------------------------------------------------
function resolverPuntoFijo(x0, tol, maxIter) {
  const g = (t) => 18 + 8 * Math.exp(-0.15 * t);
  const f = (t) => t - 18 - 8 * Math.exp(-0.15 * t);
  let actual = x0;
  const historial = [];

  for (let i = 0; i < maxIter; i++) {
    const siguiente = g(actual);
    if (!Number.isFinite(siguiente)) return { exito: false, historial };

    const error = calcularError(siguiente, actual);
    const funcion = f(siguiente);
    historial.push({ n: i, xn: actual, siguiente, difAbs: Math.abs(siguiente - actual), error, funcion });

    if (error <= tol) {
      return { exito: true, raiz: siguiente, valorFuncion: funcion, errorFinal: error, iteraciones: i + 1, historial };
    }
    actual = siguiente;
  }
  return { exito: false, raiz: historial.at(-1)?.siguiente, valorFuncion: historial.at(-1)?.funcion, errorFinal: historial.at(-1)?.error, iteraciones: maxIter, historial };
}

function resolverNewton(x0, tol, maxIter) {
  const f = (t) => Math.pow(t, 3) - 7 * t - 5;
  const df = (t) => 3 * Math.pow(t, 2) - 7;
  let actual = x0;
  const historial = [];

  for (let i = 0; i < maxIter; i++) {
    const fAct = f(actual), dfAct = df(actual);
    if (Math.abs(dfAct) < EPSILON_NUMERICO) return { exito: false, historial };

    const siguiente = actual - fAct / dfAct;
    if (!Number.isFinite(siguiente)) return { exito: false, historial };

    const error = calcularError(siguiente, actual);
    const funcion = f(siguiente);
    historial.push({ n: i, xn: actual, fxn: fAct, dfxn: dfAct, siguiente, difAbs: Math.abs(siguiente - actual), error, funcion });

    if (error <= tol) {
      return { exito: true, raiz: siguiente, valorFuncion: funcion, errorFinal: error, iteraciones: i + 1, historial };
    }
    actual = siguiente;
  }
  return { exito: false, raiz: historial.at(-1)?.siguiente, valorFuncion: historial.at(-1)?.funcion, errorFinal: historial.at(-1)?.error, iteraciones: maxIter, historial };
}

function resolverSecante(x0, x1, tol, maxIter) {
  const f = (x) => Math.exp(-x) - Math.pow(x, 2) + 0.2;
  let xAnt = x0, xAct = x1;
  const historial = [];

  for (let i = 1; i <= maxIter; i++) {
    const fxAnt = f(xAnt), fxAct = f(xAct);
    const den = fxAct - fxAnt;
    if (Math.abs(den) < EPSILON_NUMERICO) return { exito: false, historial };

    const siguiente = xAct - (fxAct * (xAct - xAnt)) / den;
    if (!Number.isFinite(siguiente)) return { exito: false, historial };

    const error = calcularError(siguiente, xAct);
    const funcion = f(siguiente);
    historial.push({ n: i, xAnt, xAct, fxAnt, fxAct, siguiente, difAbs: Math.abs(siguiente - xAct), error, funcion });

    if (error <= tol) {
      return { exito: true, raiz: siguiente, valorFuncion: funcion, errorFinal: error, iteraciones: i, historial };
    }
    xAnt = xAct;
    xAct = siguiente;
  }
  return { exito: false, raiz: historial.at(-1)?.siguiente, valorFuncion: historial.at(-1)?.funcion, errorFinal: historial.at(-1)?.error, iteraciones: maxIter, historial };
}

// ----------------------------------------------------------------------------
// Textos de Interpretación de Ingeniería
// ----------------------------------------------------------------------------
function obtenerInterpretacion(key, res) {
  if (!res.exito && !res.raiz) return "El algoritmo no convergió con los parámetros dados.";
  const r = res.raiz.toFixed(6), f = Math.abs(res.valorFuncion).toExponential(3), e = res.errorFinal.toFixed(4), it = res.iteraciones;

  switch (key) {
    case "puntoFijo":
      return `La temperatura de equilibrio térmico calculada en el reactor es de <strong>${r} °C</strong>. El residuo del modelo es \\(|f(T)| = ${f}\\), confirmando que el balance térmico se satisface con precisión en <strong>${it} iteraciones</strong> (error \\(\\varepsilon_a = ${e}\\%\\)).`;
    case "newton":
      return `El tiempo óptimo de respuesta de la controladora SSD es de <strong>${r} ms</strong>. El valor residual es prácticamente nulo (\\(|f(t)| = ${f}\\)), demostrando convergencia cuadrática en <strong>${it} iteraciones</strong> (error \\(\\varepsilon_a = ${e}\\%\\)).`;
    case "secante":
      return `La fracción de carga operativa del servidor es <strong>${r}</strong>. El residuo \\(|f(x)| = ${f}\\) valida la estabilidad del clúster sin haber requerido derivadas explícitas, convergiendo en <strong>${it} iteraciones</strong> (error \\(\\varepsilon_a = ${e}\\%\\)).`;
    default:
      return "";
  }
}

// ----------------------------------------------------------------------------
// Renderizado DOM Generico
// ----------------------------------------------------------------------------
function renderizar(key, res) {
  const cfg = PROBLEMAS[key];
  const container = document.getElementById(`resultado-${cfg.id}`);
  if (!container) return;

  const canvasId = `chart-${cfg.id}`;
  const thead = `<tr>${cfg.columnas.map((c) => `<th>${c}</th>`).join("")}</tr>`;
  const tbody = res.historial.map((fila, idx) => {
    const esFin = res.exito && idx === res.historial.length - 1;
    const celdas = cfg.mapearFila(fila);
    return `<tr class="${esFin ? "fila-convergente" : ""}">${celdas.map((c) => `<td>${c}</td>`).join("")}</tr>`;
  }).join("");

  container.innerHTML = `
    <div class="section-block">
      <h3 class="section-heading">Tabla de Iteraciones</h3>
      <div class="table-container">
        <table class="tabla-iteraciones">
          <thead>${thead}</thead>
          <tbody>${tbody}</tbody>
        </table>
        <p class="table-caption">${cfg.caption}</p>
      </div>
    </div>

    <div class="chart-container">
      <div class="chart-wrapper">
        <canvas id="${canvasId}"></canvas>
      </div>
    </div>

    <hr class="section-divider">

    <div class="section-block">
      <h3 class="section-heading">Interpretación de Ingeniería</h3>
      <p class="inline-info">${obtenerInterpretacion(key, res)}</p>
    </div>
  `;

  // Render Chart.js
  if (graficos[canvasId]) graficos[canvasId].destroy();
  const canvas = document.getElementById(canvasId);
  if (canvas) {
    graficos[canvasId] = new Chart(canvas, {
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
        plugins: {
          legend: { display: true, position: "top", labels: { color: "#334155", font: { weight: 600 } } }
        },
        scales: {
          x: { title: { display: true, text: "Iteración (n)", color: "#64748b" }, grid: { color: "#f1f5f9" } },
          y: { type: "logarithmic", title: { display: true, text: "Error εa (%) - Escala Log", color: "#64748b" }, grid: { color: "#f1f5f9" } }
        }
      }
    });
  }

  if (window.renderMathInElement) {
    renderMathInElement(container, {
      delimiters: [{ left: "$$", right: "$$", display: true }, { left: "\\[", right: "\\]", display: true }, { left: "$", right: "$", display: false }, { left: "\\(", right: "\\)", display: false }],
      throwOnError: false
    });
  }
}

// ----------------------------------------------------------------------------
// Ejecución y Tabs
// ----------------------------------------------------------------------------
function ejecutarP1() {
  const x0 = parseFloat(document.getElementById("p1-x0").value);
  const tol = parseFloat(document.getElementById("p1-tol").value);
  const max = parseInt(document.getElementById("p1-max-iter").value, 10);
  renderizar("puntoFijo", resolverPuntoFijo(x0, tol, max));
}

function ejecutarP2() {
  const x0 = parseFloat(document.getElementById("p2-x0").value);
  const tol = parseFloat(document.getElementById("p2-tol").value);
  const max = parseInt(document.getElementById("p2-max-iter").value, 10);
  renderizar("newton", resolverNewton(x0, tol, max));
}

function ejecutarP3() {
  const x0 = parseFloat(document.getElementById("p3-x0").value);
  const x1 = parseFloat(document.getElementById("p3-x1").value);
  const tol = parseFloat(document.getElementById("p3-tol").value);
  const max = parseInt(document.getElementById("p3-max-iter").value, 10);
  renderizar("secante", resolverSecante(x0, x1, tol, max));
}

document.addEventListener("DOMContentLoaded", () => {
  // Tabs
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach((b) => { b.classList.remove("active"); b.setAttribute("aria-selected", "false"); });
      document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
      btn.classList.add("active");
      btn.setAttribute("aria-selected", "true");
      document.getElementById(btn.getAttribute("data-tab"))?.classList.add("active");
    });
  });

  document.getElementById("btn-resolver-p1")?.addEventListener("click", ejecutarP1);
  document.getElementById("btn-resolver-p2")?.addEventListener("click", ejecutarP2);
  document.getElementById("btn-resolver-p3")?.addEventListener("click", ejecutarP3);

  // Ejecución inicial automática
  ejecutarP1();
  ejecutarP2();
  ejecutarP3();

  if (window.renderMathInElement) {
    renderMathInElement(document.body, {
      delimiters: [{ left: "$$", right: "$$", display: true }, { left: "\\[", right: "\\]", display: true }, { left: "$", right: "$", display: false }, { left: "\\(", right: "\\)", display: false }],
      throwOnError: false
    });
  }
});
