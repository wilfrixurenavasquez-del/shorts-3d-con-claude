// Utilidades comunes para todos los vídeos: matemáticas de animación y anclaje a palabras.
import type { Datos, Palabra } from "../tipos";

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const prog = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));
export const suave = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
export const salidaSuave = (x: number) => 1 - Math.pow(1 - x, 3);
export const rebote = (x: number) => 1 + 2.2 * Math.pow(x - 1, 3) + 1.2 * Math.pow(x - 1, 2);
export const mezclar = (a: number, b: number, p: number) => a + (b - a) * p;

export function aleatorio(semilla: number) {
  return () => {
    semilla |= 0;
    semilla = (semilla + 0x6d2b79f5) | 0;
    let r = Math.imul(semilla ^ (semilla >>> 15), 1 | semilla);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export const normalizar = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\p{L}\p{N}]/gu, "").toLowerCase();

// Un momento del vídeo ANCLADO A UNA PALABRA (nunca a segundos escritos a mano).
//  - desfase: segundos respecto a la palabra (negativo = antes).
//  - cuando: "inicio" o "fin" de la palabra.
//  - n: si la palabra se repite, cuál de ellas (0 = la primera).
//  - frase: (opcional) nº de frase, empezando en 1; busca la palabra solo dentro de esa frase.
export type Ancla = { palabra: string; desfase: number; cuando?: "inicio" | "fin"; n?: number; frase?: number };

export function resolverAnclas<K extends string>(datos: Datos, escenas: Record<K, Ancla>): Record<K, number> {
  const todas: Palabra[] = datos.frases.flatMap((f) => f.palabras);
  const salida = {} as Record<K, number>;
  (Object.keys(escenas) as K[]).forEach((clave) => {
    const a = escenas[clave];
    const palabras: Palabra[] = a.frase ? datos.frases[a.frase - 1].palabras : todas;
    const candidatas = palabras.filter((w) => normalizar(w.texto) === normalizar(a.palabra));
    const p = candidatas[a.n ?? 0];
    if (!p) throw new Error(`La palabra "${a.palabra}" (nº ${a.n ?? 0}) no está en el guion. Revisa ESCENAS.`);
    salida[clave] = p[a.cuando ?? "inicio"] + a.desfase;
  });
  return salida;
}
