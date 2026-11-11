// Voz IA gratis por defecto de la fábrica (edge-tts, sin clave) → WAV 48 kHz a -14 LUFS con las pausas largas acortadas.
// La voz y sus ajustes están en assets/voces/voz-por-defecto.json (hoy: it-IT-GiuseppeMultilingualNeural a +8 %).
// Uso: node scripts/voz-gratis.mjs guiones/<n>.txt [--salida=audio/<n>.wav] [--voz=...] [--velocidad=+5%] [--pausas=0.35]
//   El guion puede llevar "[SECCION] texto" por línea y palabras clave entre *asteriscos*: no se leen.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const RAIZ = path.resolve(import.meta.dirname, "..");
const cfg = JSON.parse(fs.readFileSync(path.join(RAIZ, "assets", "voces", "voz-por-defecto.json"), "utf8"));
const args = Object.fromEntries(process.argv.slice(2).filter((x) => x.startsWith("--")).map((x) => x.slice(2).split("=")));
const guion = process.argv.slice(2).find((x) => !x.startsWith("--"));
if (!guion) throw new Error("Falta el guion: node scripts/voz-gratis.mjs guiones/<n>.txt");
const voz = args.voz ?? cfg.voz;
const velocidad = args.velocidad ?? cfg.velocidad;
const pausa = parseFloat(args.pausas ?? cfg.pausaMaxima);
const salida = path.resolve(RAIZ, args.salida ?? path.join("audio", `${path.parse(guion).name}.wav`));

const ejecutar = (cmd, a) => {
  const r = spawnSync(cmd, a, { cwd: RAIZ, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`Falló: ${cmd} ${a.join(" ")}\n${(r.stderr || "").slice(-2000)}`);
  return r;
};
const duracion = (f) => parseFloat(ejecutar("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).stdout);
const lufs = (f) => {
  const e = ejecutar("ffmpeg", ["-hide_banner", "-nostats", "-i", f, "-af", "ebur128=peak=true", "-f", "null", "-"]).stderr;
  const t = e.slice(e.lastIndexOf("Summary:"));
  return { i: parseFloat(t.match(/I:\s*(-?[\d.]+) LUFS/)[1]), pico: parseFloat(t.match(/Peak:\s*(-?[\d.]+)/)?.[1] ?? "-99") };
};

// 1) Texto limpio y voz.
const texto = fs.readFileSync(path.resolve(RAIZ, guion), "utf8").split(/\r?\n/)
  .filter((l) => !l.trim().startsWith("#")) // comentarios del guion: no se leen
  .map((l) => l.replace(/^\s*\[[^\]]+\]\s*/, "").replaceAll("*", "").trim()).filter(Boolean).join("\n");
fs.mkdirSync(path.dirname(salida), { recursive: true });
const base = salida.replace(/\.wav$/i, "");
fs.writeFileSync(`${base}_texto.txt`, texto, "utf8");
console.log(`Generando voz ${voz} (${velocidad})...`);
ejecutar("python", ["-m", "edge_tts", "--voice", voz, `--rate=${velocidad}`, "-f", `${base}_texto.txt`, "--write-media", `${base}_edge.mp3`]);

// 2) Pausas largas entre frases → `pausa` s (40 % antes, 60 % después).
const total = duracion(`${base}_edge.mp3`);
const sd = ejecutar("ffmpeg", ["-hide_banner", "-nostats", "-i", `${base}_edge.mp3`, "-af", `silencedetect=noise=-40dB:d=${pausa + 0.05}`, "-f", "null", "-"]).stderr;
const ini = [...sd.matchAll(/silence_start: (-?[\d.]+)/g)].map((m) => Math.max(0, +m[1]));
const fin = [...sd.matchAll(/silence_end: ([\d.]+)/g)].map((m) => +m[1]);
const tramos = [];
let desde = 0;
ini.forEach((s, i) => {
  if (fin[i] === undefined || desde === null) return;
  if (s <= 0.01) { desde = Math.max(0, fin[i] - 0.08); return; }
  if (fin[i] >= total - 0.02) { tramos.push([desde, Math.min(total, s + 0.25)]); desde = null; return; }
  tramos.push([desde, s + pausa * 0.4]);
  desde = fin[i] - pausa * 0.6;
});
if (desde !== null) tramos.push([desde, total]);
const grafo = tramos.map(([a, b], i) => `[0:a]atrim=${a.toFixed(4)}:${b.toFixed(4)},asetpts=PTS-STARTPTS[t${i}]`).join(";") +
  `;${tramos.map((_, i) => `[t${i}]`).join("")}concat=n=${tramos.length}:v=0:a=1[s]`;
ejecutar("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", `${base}_edge.mp3`, "-filter_complex", grafo, "-map", "[s]", "-ar", "48000", "-ac", "2", "-c:a", "pcm_s24le", `${base}_corto.wav`]);

// 3) Sonoridad -14 LUFS (ganancia exacta; limitador suave solo si el pico pasara de -1,5 dBTP).
const m = lufs(`${base}_corto.wav`);
const g = cfg.lufs - m.i;
const filtro = m.pico + g > -1.5 ? `volume=${g.toFixed(2)}dB,alimiter=limit=0.79:level=false` : `volume=${g.toFixed(2)}dB`;
ejecutar("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", `${base}_corto.wav`, "-af", filtro, "-ar", "48000", "-c:a", "pcm_s16le", salida]);
for (const f of [`${base}_texto.txt`, `${base}_edge.mp3`, `${base}_corto.wav`]) fs.rmSync(f, { force: true });
const r = lufs(salida);
console.log(`${path.relative(RAIZ, salida)}: ${duracion(salida).toFixed(2)} s (antes ${total.toFixed(2)} s), ${r.i} LUFS, pico ${r.pico} dBTP`);
