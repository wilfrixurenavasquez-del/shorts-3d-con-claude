// Subtítulos estilo referencia: solo arriba, 1-4 palabras a la vez.
//  - palabras ya dichas: gris, peso normal · palabra actual: blanca y negrita
//  - palabras clave (*asteriscos* del guion): blancas, negrita, 1,15x, con recuadro de selección azul tipo Figma
//    (borde azul, fondo azul muy oscuro, dos manejadores circulares) que aparece con un pop (spring).
import React from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { Datos, Palabra } from "../tipos";
import { clamp01 } from "./utiles";

export type AjustesRef = {
  fuente: string;
  tamano: number;
  centroX: number;
  centroY: number;
  anchoMax: number;
  colorDicha: string;
  colorActual: string;
  maxPalabras: number;
  maxCaracteres: number;
  escalaClave: number;
  recuadroBorde: string;
  recuadroFondo: string;
  anticipo: number; // el recuadro empieza un poco antes de la palabra
  tiradores?: 2 | 4; // manejadores circulares del recuadro (2 por defecto, en esquinas opuestas)
};

type Unidad = { palabras: Palabra[]; clave: number | null };
type Trozo = { unidades: Unidad[]; inicio: number; visibleHasta: number };

const PUNTO = /[.,:;?!…]$/;

export function trocear(datos: Datos, a: AjustesRef): Trozo[] {
  const trozos: Trozo[] = [];
  datos.frases.forEach((frase) => {
    // unidades: una palabra suelta o un grupo de palabras clave seguidas
    const unidades: Unidad[] = [];
    frase.palabras.forEach((p) => {
      const ult = unidades[unidades.length - 1];
      if (p.clave && ult && ult.clave === p.clave) ult.palabras.push(p);
      else unidades.push({ palabras: [p], clave: p.clave ?? null });
    });
    const propios: Trozo[] = [];
    let actual: Unidad[] = [];
    const cuenta = (us: Unidad[]) => us.reduce((n, u) => n + u.palabras.length, 0);
    const letras = (us: Unidad[]) => us.flatMap((u) => u.palabras.map((w) => w.texto)).join(" ").length;
    const cierra = () => {
      if (actual.length) propios.push({ unidades: actual, inicio: actual[0].palabras[0].inicio, visibleHasta: 0 });
      actual = [];
    };
    unidades.forEach((u, i) => {
      if (actual.length && (cuenta(actual) + u.palabras.length > a.maxPalabras || letras([...actual, u]) > a.maxCaracteres)) cierra();
      actual.push(u);
      const ultimaPalabra = u.palabras[u.palabras.length - 1].texto;
      if (PUNTO.test(ultimaPalabra) && i < unidades.length - 1) cierra();
    });
    cierra();
    propios.forEach((tr, i) => {
      tr.visibleHasta = i < propios.length - 1 ? propios[i + 1].inicio : frase.fin + 0.35;
    });
    trozos.push(...propios);
  });
  return trozos;
}

// claro (opcional, 0-1): sobre fondo blanco las palabras fuertes pasan a casi negro y el recuadro a azul claro.
export const SubtitulosRef: React.FC<{ trozos: Trozo[]; ajustes: AjustesRef; claro?: number }> = ({ trozos, ajustes: a, claro = 0 }) => {
  const fuerteColor = claro > 0.5 ? "#111418" : "#ffffff";
  const fondoRecuadro = claro > 0.5 ? "#E3ECFF" : a.recuadroFondo;
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const trozo = trozos.find((tr) => t >= tr.inicio - 0.02 && t < tr.visibleHasta);
  if (!trozo) return null;

  const todas = trozo.unidades.flatMap((u) => u.palabras);
  const estado = (p: Palabra) => {
    const i = todas.indexOf(p);
    const sig = todas[i + 1];
    const actual = t >= p.inicio && (sig ? t < sig.inicio : t < p.fin + 0.3);
    return { dicha: t >= p.inicio - 0.02, actual };
  };

  const palabra = (p: Palabra, clave: boolean) => {
    const { dicha, actual } = estado(p);
    const entra = clamp01((t - p.inicio) * fps / 3 + 0.3);
    const fuerte = clave || actual;
    return (
      <span
        key={p.inicio}
        style={{
          display: "inline-block",
          opacity: dicha ? entra : 0,
          color: fuerte ? fuerteColor : a.colorDicha,
          fontWeight: fuerte ? 800 : 400,
          fontSize: clave ? a.tamano * a.escalaClave : a.tamano,
          margin: "0 0.13em",
        }}
      >
        {p.texto}
      </span>
    );
  };

  return (
    <div
      style={{
        position: "absolute",
        left: a.centroX - a.anchoMax / 2,
        width: a.anchoMax,
        top: a.centroY - a.tamano * 1.45,
        height: a.tamano * 2.9,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        fontFamily: a.fuente,
        fontSize: a.tamano,
        lineHeight: 1.18,
        letterSpacing: -0.5,
      }}
    >
      <div>
        {trozo.unidades.map((u, i) => {
          if (u.clave === null) return palabra(u.palabras[0], false);
          const t0 = u.palabras[0].inicio - a.anticipo;
          const f = Math.max(0, (t - t0) * fps);
          const pop = t >= t0 ? spring({ frame: f, fps, config: { damping: 11, stiffness: 240, mass: 0.5 } }) : 0;
          const visible = t >= t0;
          return (
            <span
              key={i}
              style={{
                position: "relative",
                display: "inline-block",
                padding: "0.02em 0.16em",
                margin: "0 0.1em",
              }}
            >
              <span
                style={{
                  position: "absolute",
                  inset: 0,
                  border: `3px solid ${a.recuadroBorde}`,
                  background: fondoRecuadro,
                  opacity: visible ? Math.min(1, f / 2) : 0,
                  transform: `scale(${0.7 + 0.3 * pop})`,
                  boxShadow: `0 0 18px ${a.recuadroBorde}55`,
                }}
              >
                {(a.tiradores === 4 ? ["lt", "rt", "lb", "rb"] : ["lt", "rb"]).map((esq) => (
                  <span
                    key={esq}
                    style={{
                      position: "absolute",
                      ...(esq[0] === "l" ? { left: -8 } : { right: -8 }),
                      ...(esq[1] === "t" ? { top: -8 } : { bottom: -8 }),
                      width: 14,
                      height: 14,
                      borderRadius: "50%",
                      background: claro > 0.5 ? "#ffffff" : "#0B1B3A",
                      border: `2.5px solid ${a.recuadroBorde}`,
                      boxSizing: "border-box",
                    }}
                  />
                ))}
              </span>
              <span style={{ position: "relative" }}>{u.palabras.map((p) => palabra(p, true))}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
};
