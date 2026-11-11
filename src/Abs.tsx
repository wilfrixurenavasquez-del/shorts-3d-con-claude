// "¿Por qué vibra tu pedal cuando frenas fuerte?" (ABS) — Short vertical 1080x1920 a 60 fps, 3D (three.js).
// Fórmula del cinturón y el airbag (los Shorts más vistos de SOY FRIX): 1.er fotograma reconocible (pie pisando
// el pedal) + pregunta grande, ~21 s, rayos X de la rueda, comparación sin ABS / con ABS y final en bucle.
// Guion: guiones/abs.txt · Voz: public/abs/voz.wav · Tiempos: src/tiempos-abs.json · Render con --gl=angle.
// Los sonidos son opcionales: si un archivo no está en public/abs/, simplemente no suena (ver LEEME.md).
import React from "react";
import * as THREE from "three";
import { AbsoluteFill, Audio, Sequence, getStaticFiles, interpolate, spring, staticFile, useCurrentFrame } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import { Bloom, DepthOfField, EffectComposer, Noise, Vignette } from "@react-three/postprocessing";
import datosJson from "./tiempos-abs.json";
import type { Datos } from "./tipos";
import { trocear, SubtitulosRef, type AjustesRef } from "./plantilla/SubtitulosRef";
import { Ancla, mezclar, prog, resolverAnclas, suave } from "./plantilla/utiles";
import { BATALLA, CARRIL, cocheAMundo, EstadoAbs, EstadoCoche, gomaPedal, LARGO, MundoAbs, RUEDA_IZQ, RUEDA_R, VIA, xRuta, Z_VALLA, type V3 } from "./abs/MundoAbs";

// =====================================================================
//  AJUSTES FÁCILES DE CAMBIAR
// =====================================================================

export const FPS_ABS = 60;
const FPS = FPS_ABS;
const COLA = 1.2;
const ANCHO = 1080;
const ALTO = 1920;
const FUENTE = 'Inter, "SF Pro Display", Manrope, "Segoe UI Variable Display", "Segoe UI", system-ui, sans-serif';

const SUBTITULOS: AjustesRef = {
  fuente: FUENTE,
  tamano: 76,
  centroX: 470,
  centroY: 335,
  anchoMax: 860,
  colorDicha: "#9AA3AE",
  colorActual: "#FFFFFF",
  maxPalabras: 4,
  maxCaracteres: 24,
  escalaClave: 1.15,
  recuadroBorde: "#3B82F6",
  recuadroFondo: "#0B1B3A",
  anticipo: 0.06,
  tiradores: 4,
};
const COLORES = { azul: "#3B82F6", cian: "#4FC3FF", naranja: "#FF8A1F", rojo: "#FF4A3A", verde: "#3DDC84", amarillo: "#FFD23A" };
const AUDIO = { musica: 0.11, musicaHablando: 0.045, efectos: 0.55 };
const POST = { bloom: 0.45, umbralBloom: 0.9, desenfoque: 1.0, grano: 0.035, vineta: 0.6 };
const COCHE = { v0: 14, vChoque: 3, velVisual: 0.14 }; // m/s; la rueda se dibuja girando más despacio que la real (si no, parpadea)
const ABS_HZ = 12; // pulsos por segundo del ABS (las fuentes dan 10-15)

const ESCENAS = {
  fuerte1: { frase: 1, palabra: "fuerte", desfase: -0.08 },
  vibrar1: { frase: 1, palabra: "vibrar", desfase: -0.08 },
  roto2: { frase: 2, palabra: "roto", desfase: -0.08 },
  salvando2: { frase: 2, palabra: "salvando", desfase: -0.08 },
  sin3: { frase: 3, palabra: "sin", desfase: -0.08 },
  bloquea3: { frase: 3, palabra: "bloquea", desfase: -0.1 },
  patina3: { frase: 3, palabra: "patina", desfase: -0.08 },
  girar4: { frase: 4, palabra: "girar", desfase: -0.1 },
  recto4: { frase: 4, palabra: "recto", desfase: -0.05 },
  abs5: { frase: 5, palabra: "abs", desfase: -0.08 },
  suelta5: { frase: 5, palabra: "suelta", desfase: -0.08 },
  apretar5: { frase: 5, palabra: "apretar", desfase: -0.08 },
  diez5: { frase: 5, palabra: "diez", desfase: -0.1 },
  golpe6: { frase: 6, palabra: "golpe", desfase: -0.08 },
  eso6: { frase: 6, palabra: "eso", desfase: -0.08 },
  girando7: { frase: 7, palabra: "girando", desfase: -0.08 },
  esquivar7: { frase: 7, palabra: "esquivar", desfase: -0.1 },
  sueltes8: { frase: 8, palabra: "sueltes", desfase: -0.08 },
  pisalo8: { frase: 8, palabra: "pisalo", desfase: -0.08 },
} satisfies Record<string, Ancla>;

// =====================================================================
//  DATOS, TIEMPOS Y UTILIDADES
// =====================================================================

const datos = datosJson as Datos;
const ULTIMA = datos.frases[datos.frases.length - 1].palabras;
const T = resolverAnclas(datos, ESCENAS);
const FIN_VOZ = ULTIMA[ULTIMA.length - 1].fin;
const FIN = FIN_VOZ + COLA;
export const duracionAbs = Math.ceil(FIN * FPS);
// IN[n] = inicio de la frase n (1-8); IN[9] = final del vídeo.
const IN = [0, ...datos.frases.map((f, i) => (i === 0 ? 0 : f.inicio - 0.1)), FIN];
const TROZOS = trocear(datos, SUBTITULOS).filter((tr) => tr.inicio >= IN[2]);
const PALABRAS = datos.frases.flatMap((f) => f.palabras);

const rampa = (t: number, a: number, dur = 0.5) => suave(prog(t, a, a + dur));
const ventana = (t: number, a: number, b: number, dur = 0.3) => rampa(t, a, dur) * (1 - rampa(t, b - dur, dur));
const muelle = (t: number, a: number, rigidez = 200) => (t >= a ? spring({ frame: (t - a) * FPS, fps: FPS, config: { damping: 12, stiffness: rigidez, mass: 0.6 } }) : 0);
const entre = (t: number, a: number, b: number) => t >= a && t < b;
const pico = (t: number, a: number, caida = 6) => (t >= a ? Math.exp(-(t - a) * caida) : 0);
const pulsoAbs = (fase: number) => Math.pow(0.5 + 0.5 * Math.cos(2 * Math.PI * fase), 2); // 1 = aprieta, 0 = suelta

// =====================================================================
//  CARRERA SIN ABS (frases 2-4): rueda bloqueada, sigue recto contra la valla
// =====================================================================

const T_BLOQUEO = T.bloquea3;
const T_CHOQUE = T.recto4 + 0.05;
const S_CHOQUE = T_CHOQUE - T_BLOQUEO;
const DECEL = (COCHE.v0 - COCHE.vChoque) / S_CHOQUE;
const DIST_PATINA = COCHE.v0 * S_CHOQUE - (DECEL * S_CHOQUE * S_CHOQUE) / 2;
const Z_PARA = Z_VALLA + LARGO + 0.15;
const Z_BLOQUEO = Z_PARA + DIST_PATINA;

function zSinAbs(t: number) {
  if (t < T_BLOQUEO) return Z_BLOQUEO + COCHE.v0 * (T_BLOQUEO - t);
  if (t < T_CHOQUE) {
    const s = t - T_BLOQUEO;
    return Z_BLOQUEO - (COCHE.v0 * s - (DECEL * s * s) / 2);
  }
  const s = t - T_CHOQUE;
  return Z_PARA + 0.14 * Math.exp(-5 * s) * Math.sin(11 * s);
}

function cocheSinAbs(t: number): EstadoCoche {
  const z = zSinAbs(t);
  const recorrido = Z_BLOQUEO + COCHE.v0 * (T_BLOQUEO - IN[2]) - Math.max(z, Z_BLOQUEO);
  const patina = entre(t, T_BLOQUEO, T_CHOQUE);
  return {
    x: CARRIL,
    z,
    giro: 0,
    direccion: entre(t, IN[4], IN[5]) ? 0.42 * rampa(t, T.girar4 - 0.55, 0.4) : 0,
    vuelta: (recorrido / RUEDA_R) * COCHE.velVisual,
    freno: t >= T_BLOQUEO ? 1 : 0,
    aprieta: t >= T_BLOQUEO ? 1 : 0,
    presion: t >= T_BLOQUEO ? 0.6 : 0,
    bloqueada: entre(t, IN[3], IN[4]) ? rampa(t, T_BLOQUEO, 0.12) * (0.75 + 0.25 * Math.sin(t * 18)) : 0,
    fantasma: 0,
    humo: patina ? rampa(t, T_BLOQUEO, 0.2) * (1 - rampa(t, T_CHOQUE - 0.3, 0.3)) : 0,
    velocidad: patina ? COCHE.v0 - DECEL * (t - T_BLOQUEO) : 0,
  };
}

// =====================================================================
//  CON ABS (frases 5 y 7): la pinza suelta y aprieta, la rueda sigue girando
// =====================================================================

// Frecuencia de los pulsos en la frase 5: arranca a 4 Hz en "suelta" y llega a ABS_HZ en "diez".
function hzAbs5(t: number) {
  if (t < T.suelta5) return 0;
  return mezclar(4, ABS_HZ, suave(prog(t, T.suelta5, T.diez5)));
}
// Integrales numéricas (fase de los pulsos y ángulo de la rueda) desde el inicio de la frase 5.
function integrarAbs5(t: number) {
  const dt = 1 / 240;
  let fase = 0;
  let ang = 0;
  const w0 = (12 / RUEDA_R) * COCHE.velVisual;
  for (let u = IN[5]; u < t; u += dt) {
    fase += hzAbs5(u) * dt;
    const ap = aprietaAbs5(u, fase);
    ang += w0 * (1 - 0.85 * ap) * dt;
  }
  return { fase, ang };
}
function aprietaAbs5(t: number, fase: number) {
  if (t < T.suelta5) return rampa(t, IN[5] + 0.15, 0.25); // aprieta y casi se bloquea...
  return pulsoAbs(fase); // ...y el ABS empieza a soltar y apretar
}

function cocheAbs5(t: number): EstadoCoche {
  const { fase, ang } = integrarAbs5(t);
  const s = t - IN[5];
  const ap = aprietaAbs5(t, fase);
  return {
    x: CARRIL,
    z: 120 - (12 * s - 0.9 * s * s),
    giro: 0,
    direccion: 0,
    vuelta: ang,
    freno: 1,
    aprieta: ap,
    presion: t >= T.suelta5 ? ap : 0.5 * ap,
    bloqueada: 0,
    fantasma: rampa(t, IN[5] + 0.1, 0.4),
    humo: 0,
    velocidad: 12 - 1.8 * s,
  };
}

const B = { z0: -44, v0: 12, dec: 4 };
function cocheAbs7(t: number): EstadoCoche {
  const s = Math.max(0, t - IN[7]);
  const sm = Math.min(s, B.v0 / B.dec);
  const d = B.v0 * sm - (B.dec * sm * sm) / 2;
  const z = B.z0 - d;
  const rumbo = (zz: number) => Math.atan2(-(xRuta(zz - 0.5) - xRuta(zz)), 0.5);
  const giro = rumbo(z);
  const fase = ABS_HZ * s;
  const frenando = sm < B.v0 / B.dec;
  return {
    x: xRuta(z),
    z,
    giro,
    direccion: Math.max(-0.5, Math.min(0.5, (rumbo(z - 2.6) - giro) * 1.8 + giro * 0.2)),
    vuelta: (d / RUEDA_R) * COCHE.velVisual,
    freno: 1,
    aprieta: frenando ? pulsoAbs(fase) : 1,
    presion: 0,
    bloqueada: 0,
    fantasma: 0,
    humo: 0,
    velocidad: B.v0 - B.dec * sm,
  };
}

// =====================================================================
//  PEDAL (frases 1, 6 y 8)
// =====================================================================

const PISA_INICIO = 0.55;
function pedal(t: number): EstadoAbs["pedal"] {
  const vib = (amp: number) => amp * pulsoAbs(ABS_HZ * t) * 0.035;
  if (t < IN[2]) return { pisa: mezclar(PISA_INICIO, 0.85, rampa(t, T.fuerte1 - 0.15, 0.25)), vibra: vib(rampa(t, T.vibrar1, 0.15)) };
  if (t < IN[7]) return { pisa: 0.85, vibra: vib(1) };
  // frase 8: pisa a fondo en "písalo" y al final vuelve a quedarse como en el primer fotograma (bucle)
  const fondo = mezclar(0.85, 1, rampa(t, T.pisalo8 - 0.1, 0.25));
  const vuelve = rampa(t, FIN_VOZ + 0.05, FIN - FIN_VOZ - 0.2);
  return { pisa: mezclar(fondo, PISA_INICIO, vuelve), vibra: vib(1 - vuelve) };
}

// =====================================================================
//  ESTADO DEL MUNDO 3D
// =====================================================================

const QUIETO: EstadoCoche = { x: CARRIL, z: 0, giro: 0, direccion: 0, vuelta: 0, freno: 0, aprieta: 0, presion: 0, bloqueada: 0, fantasma: 0, humo: 0, velocidad: 0 };
const escenaDe = (t: number): EstadoAbs["escena"] => (t < IN[2] || entre(t, IN[6], IN[7]) || t >= IN[8] ? "pedal" : "calle");

function estado(t: number): EstadoAbs {
  const esc = escenaDe(t);
  const base: EstadoAbs = { escena: esc, tiempo: t, coche: QUIETO, marcas: [], ruta: 0, rutaColor: COLORES.azul, choque: 0, tiembla: 0, pedal: pedal(t) };
  if (esc === "pedal") return base;
  if (t < IN[5]) {
    const c = cocheSinAbs(t);
    const marcas =
      t >= T_BLOQUEO
        ? [-1, 1].flatMap((l) => [
            { x: CARRIL + l * VIA, z0: Z_BLOQUEO - BATALLA, z1: Math.min(c.z, Z_BLOQUEO) - BATALLA },
            { x: CARRIL + l * VIA, z0: Z_BLOQUEO + BATALLA, z1: Math.min(c.z, Z_BLOQUEO) + BATALLA },
          ])
        : [];
    const morro = c.z - LARGO;
    return {
      ...base,
      coche: c,
      marcas,
      ruta: entre(t, IN[4], IN[5]) ? rampa(t, T.girar4 - 0.3, 0.3) : 0,
      rutaColor: COLORES.cian,
      choque: suave(prog(-morro, 59.0, 59.85)),
      tiembla: pico(t, T_CHOQUE, 3),
    };
  }
  if (t < IN[6]) return { ...base, coche: cocheAbs5(t) };
  return { ...base, coche: cocheAbs7(t), ruta: rampa(t, IN[7], 0.3) * (1 - rampa(t, T.esquivar7 + 0.4, 0.4)), rutaColor: COLORES.verde };
}

// =====================================================================
//  CÁMARA
// =====================================================================

type Pose = { p: V3; o: V3; fov: number };
const m3 = (a: V3, b: V3, k: number) => a.map((x, j) => mezclar(x, b[j], k)) as V3;
const mezclaPose = (a: Pose, b: Pose, k: number): Pose => ({ p: m3(a.p, b.p, k), o: m3(a.o, b.o, k), fov: mezclar(a.fov, b.fov, k) });
const local = (c: EstadoCoche, pose: Pose): Pose => ({ p: cocheAMundo(c, pose.p), o: cocheAMundo(c, pose.o), fov: pose.fov });

// Pedal visto de lado desde la izquierda del conductor.
const PEDAL_A: Pose = { p: [-1.55, 0.42, 0.12], o: [0, 0.25, 0.02], fov: 34 };
const PEDAL_B: Pose = { p: [-1.38, 0.38, 0.08], o: [0, 0.24, 0.0], fov: 34 };
const PEDAL_C: Pose = { p: [-1.05, 0.3, 0.0], o: [0, 0.2, -0.05], fov: 34 };
// Rueda delantera izquierda (sistema del coche).
const RUEDA_A: Pose = { p: [-3.1, 0.62, -0.75], o: [RUEDA_IZQ[0], 0.36, RUEDA_IZQ[2]], fov: 34 };
const RUEDA_B: Pose = { p: [-2.35, 0.5, -1.05], o: [RUEDA_IZQ[0], 0.33, RUEDA_IZQ[2]], fov: 34 };
const RUEDA_C: Pose = { p: [-2.9, 0.85, -0.3], o: [RUEDA_IZQ[0], 0.36, RUEDA_IZQ[2]], fov: 34 };
const RUEDA_D: Pose = { p: [-2.0, 0.48, -1.0], o: [RUEDA_IZQ[0], 0.32, RUEDA_IZQ[2] + 0.05], fov: 34 };
// Desde arriba y detrás, siguiendo al coche (igual sin ABS y con ABS, para comparar).
const alto = (z: number): Pose => ({ p: [2.2, 10.5, z + 13], o: [0.1, 0, z - 6.5], fov: 42 });

function camaraBase(t: number): Pose {
  const k = (a: number, b: number) => suave(prog(t, a, b));
  if (t < IN[2]) return mezclaPose(PEDAL_A, PEDAL_B, k(0, IN[2]));
  if (t < IN[3]) {
    const c = cocheSinAbs(t);
    const cerca: Pose = { p: [c.x + 3.0, 1.3, c.z + 5.6], o: [c.x - 0.05, 0.7, c.z - 3], fov: 40 };
    const lejos: Pose = { p: [c.x + 2.3, 2.4, c.z + 8.0], o: [c.x - 0.3, 0.6, c.z - 9], fov: 40 };
    return mezclaPose(cerca, lejos, k(IN[2], IN[3]));
  }
  if (t < IN[4]) return local(cocheSinAbs(t), mezclaPose(RUEDA_A, RUEDA_B, k(IN[3], T.patina3)));
  if (t < IN[5]) return alto(Math.max(zSinAbs(t), Z_PARA));
  if (t < IN[6]) return local(cocheAbs5(t), mezclaPose(RUEDA_C, RUEDA_D, k(IN[5], T.diez5)));
  if (t < IN[7]) return mezclaPose(PEDAL_B, PEDAL_C, k(IN[6], IN[7]));
  if (t < IN[8]) return alto(cocheAbs7(t).z + 1.5);
  // frase 8: se acerca en "písalo" y vuelve al plano del primer fotograma
  const acerca = mezclaPose(PEDAL_B, PEDAL_C, k(T.pisalo8 - 0.2, T.pisalo8 + 0.3));
  return mezclaPose(acerca, PEDAL_A, k(FIN_VOZ, FIN - 0.1));
}

// Sacudidas: el golpe contra la valla y la vibración del pedal.
function pose(t: number): Pose {
  const c = camaraBase(t);
  const dist = Math.hypot(c.p[0] - c.o[0], c.p[1] - c.o[1], c.p[2] - c.o[2]);
  const vib = escenaDe(t) === "pedal" ? pedal(t).vibra * 0.5 : 0;
  const golpe = pico(t, T_CHOQUE, 7) * (entre(t, IN[4], IN[5]) ? 1 : 0) + pico(t, T_BLOQUEO, 8) * 0.4 * (entre(t, IN[3], IN[4]) ? 1 : 0);
  const a = dist * 0.02 * golpe + dist * vib;
  return {
    p: [c.p[0] + Math.sin(t * 37) * a, c.p[1] + Math.sin(t * 1.3) * dist * 0.003 + Math.sin(t * 41 + 2) * a, c.p[2]],
    o: [c.o[0] + Math.sin(t * 43 + 1) * a, c.o[1], c.o[2]],
    fov: c.fov,
  };
}

const CamaraTres: React.FC<{ t: number }> = ({ t }) => {
  const cam = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const q = pose(t);
  cam.position.set(...q.p);
  cam.fov = q.fov;
  cam.near = 0.01;
  cam.far = 300;
  cam.lookAt(...q.o);
  cam.updateProjectionMatrix();
  return null;
};

const camAux = new THREE.PerspectiveCamera(40, ANCHO / ALTO, 0.01, 300);
function aPantalla(t: number, punto: V3): [number, number] {
  const q = pose(t);
  camAux.position.set(...q.p);
  camAux.fov = q.fov;
  camAux.lookAt(...q.o);
  camAux.updateProjectionMatrix();
  camAux.updateMatrixWorld();
  const v = new THREE.Vector3(...punto).project(camAux);
  return [((v.x + 1) / 2) * ANCHO, ((1 - v.y) / 2) * ALTO];
}

const Post: React.FC<{ t: number }> = ({ t }) => {
  const q = pose(t);
  return (
    <EffectComposer multisampling={4}>
      <Bloom intensity={POST.bloom} luminanceThreshold={POST.umbralBloom} luminanceSmoothing={0.2} mipmapBlur />
      <DepthOfField target={q.o} focalLength={0.02} bokehScale={POST.desenfoque} />
      <Vignette darkness={POST.vineta} offset={0.3} />
      <Noise opacity={POST.grano} />
    </EffectComposer>
  );
};

const Escena3D: React.FC<{ t: number }> = ({ t }) => (
  <ThreeCanvas width={ANCHO} height={ALTO} shadows gl={{ antialias: true, preserveDrawingBuffer: true }} camera={{ fov: 45, near: 0.01, far: 300, position: [1, 0.5, 0.2] }}>
    <CamaraTres t={t} />
    <MundoAbs e={estado(t)} />
    <Post t={t} />
  </ThreeCanvas>
);

// =====================================================================
//  CAPAS 2D
// =====================================================================

const TextoTitular: React.FC<{ t: number }> = ({ t }) => {
  const tiembla = t >= T.vibrar1 ? Math.sin(t * 90) * 5 * (0.6 + 0.4 * pulsoAbs(ABS_HZ * t)) : 0;
  return (
    <>
      ¿Por qué{" "}
      <span style={{ display: "inline-block", padding: "0 0.12em", border: "6px solid #FF4A3A", background: "#2a0b08", boxShadow: "0 0 34px #FF4A3A66", transform: `translateX(${tiembla}px)` }}>VIBRA</span> tu pedal al frenar?
    </>
  );
};

const Titular: React.FC<{ t: number }> = ({ t }) => {
  const op = 1 - rampa(t, IN[2] - 0.15, 0.15);
  if (op <= 0) return null;
  return (
    <div style={{ position: "absolute", left: 60, width: 880, top: 200, textAlign: "center", fontFamily: FUENTE, fontWeight: 900, fontSize: 108, lineHeight: 1.04, letterSpacing: -3, color: "#fff", opacity: op, textShadow: "0 8px 36px rgba(0,0,0,0.85)" }}>
      <TextoTitular t={t} />
    </div>
  );
};

const Chip: React.FC<{ t: number; a: number; b: number; texto: string; x?: number; y: number; color?: string; tinta?: string; giro?: number; grande?: boolean }> = ({ t, a, b, texto, x = 470, y, color = COLORES.azul, tinta = "#fff", giro = 0, grande = false }) => {
  const op = ventana(t, a, b, 0.12);
  if (op <= 0.01) return null;
  const s = 0.5 + 0.5 * muelle(t, a, 260);
  return (
    <div style={{ position: "absolute", left: x, top: y, transform: `translate(-50%, -50%) scale(${s}) rotate(${giro}deg)`, opacity: op, background: color, color: tinta, fontFamily: FUENTE, fontWeight: 900, fontSize: grande ? 84 : 46, letterSpacing: 2, padding: grande ? "18px 40px" : "12px 28px", borderRadius: 20, whiteSpace: "nowrap", boxShadow: "0 16px 40px rgba(0,0,0,0.55)", textAlign: "center", lineHeight: 1.05 }}>
      {texto}
    </div>
  );
};

const Etiqueta: React.FC<{ t: number; a: number; b: number; punto: (t: number) => V3; texto: string; dx?: number; dy?: number; color?: string }> = ({ t, a, b, punto, texto, dx = 140, dy = -160, color = COLORES.cian }) => {
  const op = ventana(t, a, b, 0.18);
  if (op <= 0.01) return null;
  const [x, y] = aPantalla(t, punto(t));
  const anchoCaja = texto.length * 24 + 44;
  const lx = dx >= 0 ? Math.min(900 - anchoCaja, Math.max(40, x + dx)) : Math.max(40 + anchoCaja, Math.min(900, x + dx));
  const ly = Math.max(500, Math.min(1560, y + dy));
  const dibuja = prog(t, a, a + 0.15);
  const ex = mezclar(x, lx, dibuja);
  const ey = mezclar(y, ly, Math.min(1, dibuja * 2));
  return (
    <svg width={ANCHO} height={ALTO} style={{ position: "absolute", left: 0, top: 0, opacity: op }}>
      <polyline points={`${x},${y} ${x},${ey} ${ex},${ey}`} fill="none" stroke={color} strokeWidth={4} />
      <circle cx={x} cy={y} r={11} fill={color} />
      <circle cx={x} cy={y} r={20 + 6 * Math.sin(t * 8)} fill="none" stroke={color} strokeWidth={3} opacity={0.6} />
      {dibuja > 0.6 && (
        <g transform={`translate(${lx} ${ly})`}>
          <rect x={dx >= 0 ? 0 : -anchoCaja} y={-36} width={anchoCaja} height={72} rx={36} fill="#0F1420" stroke={color} strokeWidth={3} />
          <text x={dx >= 0 ? 22 : -22} y={12} textAnchor={dx >= 0 ? "start" : "end"} fontFamily={FUENTE} fontSize={34} fontWeight={800} letterSpacing={2} fill="#fff">
            {texto}
          </text>
        </g>
      )}
    </svg>
  );
};

// Ondas que salen del pedal en cada golpe del ABS (frases 1, 6 y 8).
const Ondas: React.FC<{ t: number }> = ({ t }) => {
  if (escenaDe(t) !== "pedal") return null;
  const fuerza = pedal(t).vibra > 0 ? Math.min(1, t < IN[2] ? rampa(t, T.vibrar1, 0.2) : 1) * (t > FIN_VOZ ? 1 - rampa(t, FIN_VOZ, 0.5) : 1) : 0;
  if (fuerza <= 0.01) return null;
  const [x, y] = aPantalla(t, gomaPedal(pedal(t)));
  const anillos = [];
  const fase = ABS_HZ * t;
  for (let k = 0; k < 3; k++) {
    const u = (fase + k / 3) % 1;
    anillos.push(<circle key={k} cx={x} cy={y} r={50 + u * 230} fill="none" stroke={COLORES.amarillo} strokeWidth={8 * (1 - u)} opacity={(1 - u) * 0.8 * fuerza} />);
  }
  return (
    <svg width={ANCHO} height={ALTO} style={{ position: "absolute", left: 0, top: 0 }}>
      {anillos}
    </svg>
  );
};

// "SUELTA" / "APRIETA" que cambia con cada pulso de la pinza (frase 5, antes de "diez").
const SueltaAprieta: React.FC<{ t: number }> = ({ t }) => {
  const op = ventana(t, T.suelta5, T.diez5, 0.1);
  if (op <= 0.01) return null;
  const { fase } = integrarAbs5(t);
  const ap = pulsoAbs(fase) > 0.5;
  return (
    <div style={{ position: "absolute", left: 470, top: 1420, transform: "translate(-50%, -50%) rotate(-2deg)", opacity: op, display: "flex", gap: 18, fontFamily: FUENTE, fontWeight: 900, fontSize: 52 }}>
      <span style={{ padding: "12px 26px", borderRadius: 18, background: ap ? "#22262e" : COLORES.verde, color: ap ? "#6b7380" : "#03140a" }}>SUELTA</span>
      <span style={{ padding: "12px 26px", borderRadius: 18, background: ap ? COLORES.rojo : "#22262e", color: ap ? "#fff" : "#6b7380" }}>APRIETA</span>
    </div>
  );
};

const NOTAS = [
  { texto: "Recreación 3D", desde: 0.3, hasta: IN[3] },
  { texto: "Rueda delantera · freno de disco", desde: IN[3] + 0.2, hasta: IN[4] },
  { texto: "Sin ABS", desde: IN[4] + 0.2, hasta: IN[5] },
  { texto: "Rueda delantera · rayos X de la pinza", desde: IN[5] + 0.3, hasta: IN[6] },
  { texto: "Con ABS", desde: IN[7] + 0.2, hasta: IN[8] },
];
const Notas: React.FC<{ t: number }> = ({ t }) => {
  const n = NOTAS.find((x) => t >= x.desde - 0.1 && t < x.hasta + 0.1);
  if (!n) return null;
  const op = rampa(t, n.desde, 0.3) * (1 - rampa(t, n.hasta - 0.1, 0.3));
  return <div style={{ position: "absolute", left: 40, top: 1598, fontFamily: FUENTE, fontSize: 24, color: "#8A93A0", opacity: op, textShadow: "0 2px 6px #000" }}>{n.texto}</div>;
};

const ruedaSinAbs = (t: number) => cocheAMundo(cocheSinAbs(t), RUEDA_IZQ);
const pinzaAbs = (t: number) => cocheAMundo(cocheAbs5(t), [RUEDA_IZQ[0] + 0.03, RUEDA_IZQ[1] + 0.085, RUEDA_IZQ[2] + 0.15]);

const Capa2D: React.FC<{ t: number }> = ({ t }) => (
  <>
    <Ondas t={t} />
    <Chip t={t} a={T.roto2} b={T.salvando2 - 0.02} texto="NO ESTÁ ROTO" y={1400} color="#ffffff" tinta="#111" giro={-2} grande />
    <Chip t={t} a={T.salvando2} b={IN[3]} texto="TE SALVA ✓" y={1400} color={COLORES.verde} tinta="#03140a" giro={-2} grande />
    <Chip t={t} a={T.sin3} b={T.bloquea3 - 0.02} texto="SIN ABS" y={1400} color={COLORES.rojo} giro={-3} grande />
    <Etiqueta t={t} a={T.bloquea3} b={IN[4]} punto={ruedaSinAbs} texto="¡BLOQUEADA!" dx={60} dy={-330} color={COLORES.rojo} />
    <Chip t={t} a={T.patina3} b={IN[4]} texto="PATINA" y={1420} color="#ffffff" tinta="#111" giro={-2} />
    <Chip t={t} a={T.girar4 - 0.1} b={T.recto4 - 0.02} texto="GIRAS EL VOLANTE…" y={1400} color={COLORES.cian} tinta="#04121c" giro={-2} />
    <Chip t={t} a={T.recto4} b={IN[5]} texto="…Y SIGUE RECTO ✗" y={1400} color={COLORES.rojo} giro={-3} grande />
    <Chip t={t} a={T.abs5} b={T.suelta5 - 0.02} texto="CON ABS" y={1400} color={COLORES.verde} tinta="#03140a" giro={-3} grande />
    <Etiqueta t={t} a={T.abs5 + 0.1} b={T.diez5 - 0.05} punto={pinzaAbs} texto="PINZA" dx={-40} dy={-360} color={COLORES.naranja} />
    <SueltaAprieta t={t} />
    <Chip t={t} a={T.diez5} b={IN[6]} texto="+10 / SEGUNDO" y={1400} color={COLORES.amarillo} tinta="#1a1400" giro={-2} grande />
    <Chip t={t} a={T.golpe6} b={T.eso6 - 0.02} texto="TAC-TAC-TAC" y={1420} color="#ffffff" tinta="#111" giro={-2} />
    <Chip t={t} a={T.eso6} b={IN[7]} texto="= EL ABS" y={1400} color={COLORES.amarillo} tinta="#1a1400" giro={-2} grande />
    <Chip t={t} a={IN[7] + 0.05} b={T.esquivar7 - 0.02} texto="CON ABS" y={1400} color={COLORES.verde} tinta="#03140a" giro={-3} grande />
    <Chip t={t} a={T.esquivar7} b={IN[8]} texto="¡ESQUIVAS! ✓" y={1400} color={COLORES.verde} tinta="#03140a" giro={-3} grande />
    <Chip t={t} a={T.sueltes8} b={T.pisalo8 - 0.02} texto="NO LO SUELTES" y={1400} color={COLORES.rojo} giro={-3} grande />
    <Chip t={t} a={T.pisalo8} b={FIN_VOZ + 0.5} texto="PÍSALO A FONDO" y={1400} color={COLORES.verde} tinta="#03140a" giro={-3} grande />
    <Notas t={t} />
  </>
);

// =====================================================================
//  SONIDO
// =====================================================================

const hablando = (t: number) => PALABRAS.some((w) => t >= w.inicio - 0.1 && t <= w.fin + 0.15);
function volumenMusica(f: number) {
  const t = f / FPS;
  let s = 0;
  for (let k = -3; k <= 3; k++) s += hablando(t + k * 0.05) ? 1 : 0;
  return mezclar(AUDIO.musica, AUDIO.musicaHablando, s / 7) * interpolate(t, [0, 0.4, FIN - 1.2, FIN], [0.6, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
}

// "abs.wav" = 3 s de golpecitos a 12 Hz (lo genera scripts/sonido-abs.py).
const EFECTOS: { en: number; src: string; vol?: number; hasta?: number }[] = [
  { en: T.vibrar1, src: "abs.wav", vol: 0.8, hasta: IN[2] },
  { en: T.roto2, src: "pop.wav" },
  { en: T.salvando2, src: "pop.wav" },
  { en: T.sin3, src: "clic.wav" },
  { en: T_BLOQUEO, src: "frenazo.mp3", vol: 1, hasta: IN[4] + 1.5 },
  { en: T.patina3, src: "pop.wav", vol: 0.6 },
  { en: T.girar4 - 0.1, src: "clic.wav" },
  { en: T_CHOQUE, src: "mazo.mp3", vol: 1 },
  { en: T_CHOQUE, src: "golpe.wav", vol: 0.8 },
  { en: T.abs5, src: "pop.wav" },
  { en: T.suelta5, src: "abs.wav", vol: 0.9, hasta: IN[6] },
  { en: T.diez5, src: "pop.wav" },
  { en: IN[6], src: "abs.wav", vol: 0.9, hasta: IN[7] },
  { en: T.eso6, src: "pop.wav" },
  { en: IN[7] + 0.05, src: "abs.wav", vol: 0.5, hasta: IN[7] + 3 },
  { en: T.esquivar7, src: "brillo.mp3", vol: 0.6 },
  { en: T.sueltes8, src: "clic.wav" },
  { en: IN[8], src: "abs.wav", vol: 0.8, hasta: FIN_VOZ + 0.3 },
  { en: T.pisalo8, src: "pop.wav" },
];

// =====================================================================
//  COMPOSICIÓN
// =====================================================================

// Solo se usan los audios que existen de verdad en la carpeta public/.
const existe = (ruta: string) => getStaticFiles().some((f) => f.name === ruta);

export const Abs: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  return (
    <AbsoluteFill style={{ background: "#07090c" }}>
      {datos.audio && existe(datos.audio) && <Audio src={staticFile(datos.audio)} />}
      {existe("abs/musica.mp3") && <Audio src={staticFile("abs/musica.mp3")} volume={volumenMusica} />}
      {EFECTOS.filter((x) => existe(`abs/sfx/${x.src}`)).map((x, i) => (
        <Sequence key={i} from={Math.max(0, Math.round(x.en * FPS))} durationInFrames={x.hasta ? Math.max(1, Math.round((x.hasta - x.en) * FPS)) : undefined} layout="none">
          <Audio src={staticFile(`abs/sfx/${x.src}`)} volume={(x.vol ?? 1) * AUDIO.efectos} loop={x.src === "abs.wav"} />
        </Sequence>
      ))}
      <Escena3D t={t} />
      <AbsoluteFill style={{ background: "linear-gradient(rgba(5,7,11,0.75) 0%, rgba(5,7,11,0.4) 20%, transparent 32%)" }} />
      <Capa2D t={t} />
      <Titular t={t} />
      <SubtitulosRef trozos={TROZOS} ajustes={SUBTITULOS} />
    </AbsoluteFill>
  );
};

export const PortadaAbs: React.FC = () => (
  <AbsoluteFill style={{ background: "#07090c" }}>
    <Escena3D t={T.vibrar1 + 0.3} />
    <AbsoluteFill style={{ background: "linear-gradient(rgba(5,7,11,0.85) 0%, rgba(5,7,11,0.4) 28%, transparent 42%)" }} />
    <div style={{ position: "absolute", left: 60, width: 880, top: 200, textAlign: "center", fontFamily: FUENTE, fontWeight: 900, fontSize: 108, lineHeight: 1.04, letterSpacing: -3, color: "#fff", textShadow: "0 8px 36px rgba(0,0,0,0.85)" }}>
      <TextoTitular t={0} />
    </div>
  </AbsoluteFill>
);
