// Forma del archivo src/tiempos.json (lo crea scripts/generar-voz.mjs).
// clave: número de grupo si la palabra va entre *asteriscos* en el guion (las del mismo grupo comparten recuadro).
export type Palabra = { texto: string; inicio: number; fin: number; clave?: number };

export type Frase = {
  texto: string;
  dibujo: string | null;
  palabraClave: string;
  indiceClave: number;
  inicioClave: number;
  inicio: number;
  fin: number;
  palabras: Palabra[];
};

export type Datos = { audio: string | null; duracion: number; claves?: string[]; frases: Frase[] };

// Colores de acento: uno por frase, en bucle.
export const COLORES = ["#38bdf8", "#facc15", "#f472b6", "#4ade80", "#a78bfa", "#fb923c"];

export const FONDO = "#0a0d16";
export const RESALTE = "#facc15";
