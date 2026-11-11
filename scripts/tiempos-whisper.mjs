// Junta el texto del guion con los tiempos por palabra de Whisper → src/tiempos-<n>.json (formato Datos de src/tipos.ts).
// El texto sale SIEMPRE del guion (Whisper se equivoca a veces); de Whisper solo se toman los tiempos.
// Uso: node scripts/tiempos-whisper.mjs guiones/<n>.txt <whisper.json> --audio=<ruta en public/> [--salida=src/tiempos-<n>.json]
import fs from "node:fs";
import path from "node:path";

const RAIZ = path.resolve(import.meta.dirname, "..");
const args = Object.fromEntries(process.argv.slice(2).filter((x) => x.startsWith("--")).map((x) => x.slice(2).split("=")));
const [guion, whisper] = process.argv.slice(2).filter((x) => !x.startsWith("--"));
const nombre = path.parse(guion).name;
const salida = path.resolve(RAIZ, args.salida ?? `src/tiempos-${nombre}.json`);
const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\p{L}\p{N}]/gu, "").toLowerCase();

// 1) Palabras del guion, con su grupo de clave (*varias palabras* = un grupo).
let grupo = 0;
const frases = fs.readFileSync(path.resolve(RAIZ, guion), "utf8").split(/\r?\n/)
  .map((l) => l.trim()).filter((l) => l && !l.startsWith("#"))
  .map((linea) => {
    const palabras = [];
    let dentro = false;
    for (const trozo of linea.split(/\s+/)) {
      const abre = trozo.startsWith("*") || /^[¿¡]\*/.test(trozo);
      if (abre && !dentro) { dentro = true; grupo++; }
      const texto = trozo.replaceAll("*", "");
      palabras.push({ texto, inicio: 0, fin: 0, ...(dentro ? { clave: grupo } : {}) });
      if (/\*[.,:;?!…]*$/.test(trozo)) dentro = false;
    }
    return { texto: linea.replaceAll("*", ""), palabras };
  });
const g = frases.flatMap((f) => f.palabras);
const w = JSON.parse(fs.readFileSync(path.resolve(RAIZ, whisper), "utf8")).palabras;

// 2) Alineación palabra a palabra (distancia de edición: igual = 0, distinta = 1, saltar = 1).
const n = g.length, m = w.length;
const D = Array.from({ length: n + 1 }, (_, i) => Array.from({ length: m + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
for (let i = 1; i <= n; i++)
  for (let j = 1; j <= m; j++)
    D[i][j] = Math.min(D[i - 1][j - 1] + (norm(g[i - 1].texto) === norm(w[j - 1].texto) ? 0 : 1), D[i - 1][j] + 1, D[i][j - 1] + 1);
const pareja = new Array(n).fill(null);
for (let i = n, j = m; i > 0 && j > 0;) {
  if (D[i][j] === D[i - 1][j - 1] + (norm(g[i - 1].texto) === norm(w[j - 1].texto) ? 0 : 1)) { pareja[i - 1] = j - 1; i--; j--; }
  else if (D[i][j] === D[i - 1][j] + 1) i--;
  else j--;
}

// 3) Tiempos; las palabras sin pareja se reparten entre sus vecinas.
g.forEach((p, i) => { if (pareja[i] !== null) { p.inicio = w[pareja[i]].inicio; p.fin = w[pareja[i]].fin; } });
for (let i = 0; i < n; i++) {
  if (pareja[i] !== null) continue;
  let k = i;
  while (k < n && pareja[k] === null) k++;
  const a = i > 0 ? g[i - 1].fin : 0, b = k < n ? g[k].inicio : a + 0.3 * (k - i);
  for (let x = i; x < k; x++) { g[x].inicio = +(a + ((b - a) * (x - i)) / (k - i)).toFixed(3); g[x].fin = +(a + ((b - a) * (x - i + 1)) / (k - i)).toFixed(3); }
  console.log(`Sin pareja en Whisper (tiempo repartido): ${g.slice(i, k).map((p) => p.texto).join(" ")}`);
  i = k - 1;
}

const datos = {
  audio: args.audio ?? null,
  duracion: g[n - 1].fin,
  frases: frases.map((f) => {
    const ic = Math.max(0, f.palabras.findIndex((p) => p.clave));
    return { texto: f.texto, dibujo: null, palabraClave: f.palabras[ic].texto, indiceClave: ic, inicioClave: f.palabras[ic].inicio, inicio: f.palabras[0].inicio, fin: f.palabras[f.palabras.length - 1].fin, palabras: f.palabras };
  }),
};
fs.writeFileSync(salida, JSON.stringify(datos, null, 1), "utf8");
console.log(`${path.relative(RAIZ, salida)}: ${frases.length} frases, ${n} palabras, ${datos.duracion.toFixed(2)} s`);
