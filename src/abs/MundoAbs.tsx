// Mundo 3D del Short "¿Por qué vibra tu pedal cuando frenas fuerte?" (ABS) — three.js vía @remotion/three.
// Dos escenarios que nunca se ven a la vez (prop `escena`):
//  · "calle": carretera de dos carriles, coche azul con la rueda delantera izquierda detallada (llanta de 5 radios,
//    disco perforado, pinza roja con pastillas) y una valla con conos en el carril derecho.
//  · "pedal": el hueco de los pies del conductor, visto de lado: pedal de freno y zapatilla pisándolo.
// Todo es una función pura del estado (lo calcula Abs.tsx a partir del tiempo). Unidades = metros.
// Coche: origen en el suelo, en su centro; mira hacia -z; su izquierda es -x.
import React, { useMemo } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

export type V3 = [number, number, number];

export type EstadoCoche = {
  x: number;
  z: number;
  giro: number; // rumbo (rad, + = hacia la izquierda)
  direccion: number; // ángulo de las ruedas delanteras (rad, + = izquierda)
  vuelta: number; // ángulo girado por las ruedas (rad)
  freno: number; // 0-1 luces de freno
  aprieta: number; // 0-1 cuánto aprietan las pastillas el disco
  presion: number; // 0-1 brillo del latiguillo (pulso del ABS)
  bloqueada: number; // 0-1 anillo rojo "rueda bloqueada"
  fantasma: number; // 0-1 rayos X de la rueda (neumático y pinza transparentes)
  humo: number; // 0-1 humo de las ruedas que patinan
  velocidad: number; // m/s (para el humo)
};

export type EstadoAbs = {
  escena: "calle" | "pedal";
  tiempo: number;
  coche: EstadoCoche;
  marcas: { x: number; z0: number; z1: number }[]; // frenada en el asfalto (rectas)
  ruta: number; // 0-1 opacidad de la ruta "por donde quieres ir"
  rutaColor: string;
  choque: number; // 0-1 conos derribados
  tiembla: number; // 0-1 sacudida de la valla
  pedal: { pisa: number; vibra: number }; // pisa 0-1, vibra = desplazamiento extra (rad)
};

// ---------------------------------------------------------------------
//  Medidas
// ---------------------------------------------------------------------
export const RUEDA_R = 0.32;
export const BATALLA = 1.3; // eje delantero en z=-1.3, trasero en z=+1.3
export const VIA = 0.79; // ruedas en x=±0.79
export const LARGO = 2.12; // medio largo del coche
export const RUEDA_IZQ: V3 = [-VIA, RUEDA_R, -BATALLA];
export const CARRIL = 1.75; // centro del carril derecho (x>0); el izquierdo en -1.75
export const Z_VALLA = -60;
export const Z_CONOS = -57.2;
const ANCHO_CALLE = 7.4;

// Ruta para esquivar: del carril derecho al izquierdo entre z=-44 y z=-55.
export function xRuta(z: number) {
  const p = Math.min(1, Math.max(0, (-44 - z) / 11));
  const s = p * p * (3 - 2 * p);
  return CARRIL - 2 * CARRIL * s;
}

// Punto local del coche → mundo.
export function cocheAMundo(c: Pick<EstadoCoche, "x" | "z" | "giro">, p: V3): V3 {
  const cs = Math.cos(c.giro);
  const sn = Math.sin(c.giro);
  return [c.x + p[0] * cs + p[2] * sn, p[1], c.z - p[0] * sn + p[2] * cs];
}

// Pedal: pivote arriba, brazo hacia abajo y atrás; "pisa" lo gira hacia delante.
export const PIVOTE: V3 = [0, 0.62, -0.2];
const BRAZO: [number, number] = [-0.42, 0.14]; // (y, z) del pivote a la goma
export const TALON: V3 = [0, 0.035, 0.12];
export function anguloPedal(p: EstadoAbs["pedal"]) {
  return 0.05 + 0.22 * p.pisa + p.vibra;
}
export function gomaPedal(p: EstadoAbs["pedal"]): V3 {
  const a = anguloPedal(p);
  const y = BRAZO[0] * Math.cos(a) - BRAZO[1] * Math.sin(a);
  const z = BRAZO[0] * Math.sin(a) + BRAZO[1] * Math.cos(a);
  return [PIVOTE[0], PIVOTE[1] + y, PIVOTE[2] + z];
}

// ---------------------------------------------------------------------
//  Texturas (canvas)
// ---------------------------------------------------------------------
const hayDom = typeof document !== "undefined";
function azar(semilla: number) {
  let s = semilla;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}
function lienzo(w: number, h: number, pintar: (x: CanvasRenderingContext2D) => void, color = true) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  pintar(c.getContext("2d")!);
  const t = new THREE.CanvasTexture(c);
  if (color) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
function texAsfalto() {
  const t = lienzo(512, 512, (x) => {
    x.fillStyle = "#3a3d42";
    x.fillRect(0, 0, 512, 512);
    const r = azar(7);
    for (let i = 0; i < 26000; i++) {
      const v = 40 + r() * 70;
      x.fillStyle = `rgb(${v},${v},${v + 4})`;
      x.fillRect(r() * 512, r() * 512, 1 + r() * 2, 1 + r() * 2);
    }
    for (let i = 0; i < 40; i++) {
      x.fillStyle = `rgba(0,0,0,${0.05 + r() * 0.08})`;
      x.beginPath();
      x.ellipse(r() * 512, r() * 512, 20 + r() * 60, 10 + r() * 30, r() * 3, 0, Math.PI * 2);
      x.fill();
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(2, 120);
  return t;
}
function texHierba() {
  const t = lienzo(256, 256, (x) => {
    x.fillStyle = "#1d2a17";
    x.fillRect(0, 0, 256, 256);
    const r = azar(3);
    for (let i = 0; i < 9000; i++) {
      const g = 30 + r() * 40;
      x.fillStyle = `rgb(${g * 0.6},${g},${g * 0.45})`;
      x.fillRect(r() * 256, r() * 256, 1, 2 + r() * 3);
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(60, 400);
  return t;
}
function texDisco() {
  return lienzo(512, 512, (x) => {
    const g = x.createRadialGradient(256, 256, 60, 256, 256, 256);
    g.addColorStop(0, "#8a9099");
    g.addColorStop(1, "#b9bfc7");
    x.fillStyle = g;
    x.fillRect(0, 0, 512, 512);
    // rayas de pulido concéntricas
    for (let r = 120; r < 256; r += 2) {
      x.strokeStyle = `rgba(${r % 6 ? 255 : 0},${r % 6 ? 255 : 0},${r % 6 ? 255 : 0},0.05)`;
      x.beginPath();
      x.arc(256, 256, r, 0, Math.PI * 2);
      x.stroke();
    }
    // agujeros de refrigeración en espiral
    x.fillStyle = "#15171a";
    for (let k = 0; k < 18; k++) {
      for (let j = 0; j < 3; j++) {
        const a = (k / 18) * Math.PI * 2 + j * 0.09;
        const r = 150 + j * 32;
        x.beginPath();
        x.arc(256 + Math.cos(a) * r, 256 + Math.sin(a) * r, 8, 0, Math.PI * 2);
        x.fill();
      }
    }
    // campana central
    x.fillStyle = "#44484f";
    x.beginPath();
    x.arc(256, 256, 105, 0, Math.PI * 2);
    x.fill();
    x.fillStyle = "#2a2d31";
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      x.beginPath();
      x.arc(256 + Math.cos(a) * 55, 256 + Math.sin(a) * 55, 11, 0, Math.PI * 2);
      x.fill();
    }
  });
}
function texRayas() {
  return lienzo(512, 64, (x) => {
    x.fillStyle = "#f2f2f2";
    x.fillRect(0, 0, 512, 64);
    x.fillStyle = "#d42a1f";
    for (let i = -2; i < 12; i++) {
      x.beginPath();
      x.moveTo(i * 64, 64);
      x.lineTo(i * 64 + 32, 64);
      x.lineTo(i * 64 + 96, 0);
      x.lineTo(i * 64 + 64, 0);
      x.fill();
    }
  });
}
function texMoqueta() {
  const t = lienzo(256, 256, (x) => {
    x.fillStyle = "#1c1d20";
    x.fillRect(0, 0, 256, 256);
    const r = azar(11);
    for (let i = 0; i < 14000; i++) {
      const v = 18 + r() * 26;
      x.fillStyle = `rgb(${v},${v},${v + 2})`;
      x.fillRect(r() * 256, r() * 256, 1, 1);
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(4, 4);
  return t;
}
function texGomaPedal() {
  return lienzo(128, 256, (x) => {
    x.fillStyle = "#1a1a1c";
    x.fillRect(0, 0, 128, 256);
    x.fillStyle = "#0a0a0b";
    for (let y = 18; y < 256; y += 26) x.fillRect(10, y, 108, 10);
  });
}

const texA = hayDom ? texAsfalto() : null;
const texH = hayDom ? texHierba() : null;
const texD = hayDom ? texDisco() : null;
const texR = hayDom ? texRayas() : null;
const texM = hayDom ? texMoqueta() : null;
const texG = hayDom ? texGomaPedal() : null;

// ---------------------------------------------------------------------
//  Materiales
// ---------------------------------------------------------------------
const matPintura = new THREE.MeshPhysicalMaterial({ color: "#1d5fe0", metalness: 0.55, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.08 });
const matCristal = new THREE.MeshPhysicalMaterial({ color: "#0c1118", metalness: 0.9, roughness: 0.06, clearcoat: 1 });
const matNegro = new THREE.MeshStandardMaterial({ color: "#121316", roughness: 0.7 });
const matNeumatico = new THREE.MeshStandardMaterial({ color: "#151517", roughness: 0.92 });
const matLlanta = new THREE.MeshStandardMaterial({ color: "#c9ced6", metalness: 1, roughness: 0.22 });
const matBuje = new THREE.MeshStandardMaterial({ color: "#3a3e45", metalness: 0.8, roughness: 0.35 });
const matDiscoCanto = new THREE.MeshStandardMaterial({ color: "#7d838c", metalness: 1, roughness: 0.3 });
const matDiscoCara = new THREE.MeshStandardMaterial({ map: texD, metalness: 0.95, roughness: 0.28 });
const matPinza = new THREE.MeshPhysicalMaterial({ color: "#e01b14", metalness: 0.1, roughness: 0.4, clearcoat: 0.6, envMapIntensity: 0.4, emissive: "#5a0000", emissiveIntensity: 0.6 });
const matPastilla = new THREE.MeshStandardMaterial({ color: "#3a2a20", roughness: 0.8, emissive: "#ff7a1a", emissiveIntensity: 0 });
const matLatiguillo = new THREE.MeshStandardMaterial({ color: "#151517", roughness: 0.5, emissive: "#4fc3ff", emissiveIntensity: 0 });
const matPilotoAtras = new THREE.MeshStandardMaterial({ color: "#5a0806", emissive: "#ff1a10", emissiveIntensity: 0.4 });
const matFaro = new THREE.MeshStandardMaterial({ color: "#e8eef6", emissive: "#fff6e0", emissiveIntensity: 1.2 });
const matAsfalto = new THREE.MeshStandardMaterial({ map: texA, roughness: 0.92, color: "#9aa0a8" });
const matHierba = new THREE.MeshStandardMaterial({ map: texH, roughness: 1 });
const matRaya = new THREE.MeshStandardMaterial({ color: "#e9ecef", roughness: 0.6, emissive: "#ffffff", emissiveIntensity: 0.08 });
const matCono = new THREE.MeshStandardMaterial({ color: "#ff6a12", roughness: 0.55 });
const matBanda = new THREE.MeshStandardMaterial({ color: "#f2f2f2", roughness: 0.4, emissive: "#ffffff", emissiveIntensity: 0.1 });
const matValla = new THREE.MeshStandardMaterial({ map: texR, roughness: 0.5 });
const matPata = new THREE.MeshStandardMaterial({ color: "#e0e3e8", metalness: 0.6, roughness: 0.4 });
const matMarca = new THREE.MeshBasicMaterial({ color: "#050505", transparent: true, opacity: 0.72, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
const matHumo = new THREE.MeshStandardMaterial({ color: "#c9ccd1", roughness: 1, transparent: true, opacity: 0.3, depthWrite: false });
// Pedal
const matMoqueta = new THREE.MeshStandardMaterial({ map: texM, roughness: 1 });
const matPlasticoInt = new THREE.MeshStandardMaterial({ color: "#222428", roughness: 0.75 });
const matMetalPedal = new THREE.MeshStandardMaterial({ color: "#5d636c", metalness: 0.85, roughness: 0.35 });
const matGomaPedal = new THREE.MeshStandardMaterial({ map: texG, roughness: 0.8 });
const matSuela = new THREE.MeshStandardMaterial({ color: "#eceae4", roughness: 0.7 });
const matZapato = new THREE.MeshStandardMaterial({ color: "#1d5fe0", roughness: 0.6 });
const matDetalle = new THREE.MeshStandardMaterial({ color: "#f4f4f4", roughness: 0.5 });
const matCordon = new THREE.MeshStandardMaterial({ color: "#f4f4f4", roughness: 0.8 });
const matVaquero = new THREE.MeshStandardMaterial({ color: "#2c4466", roughness: 0.9 });
const matCalcetin = new THREE.MeshStandardMaterial({ color: "#e8e8e8", roughness: 0.95 });

function crearRayosX(color: string) {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uFuerza: { value: 0 } },
    vertexShader: `varying vec3 vN; varying vec3 vV;
      void main(){ vec4 mv = modelViewMatrix*vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `uniform vec3 uColor; uniform float uFuerza; varying vec3 vN; varying vec3 vV;
      void main(){ float f = pow(1.0-abs(dot(normalize(vN),normalize(vV))),2.0); gl_FragColor = vec4(uColor*(0.05+1.0*f)*uFuerza,1.0); }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
}
const rxNeumatico = crearRayosX("#4fc3ff");
const rxLlanta = crearRayosX("#4fc3ff");

const useMat = <M,>(crear: () => M) => useMemo(crear, []); // eslint-disable-line react-hooks/exhaustive-deps
function useTransparente(base: THREE.Material, opacidad: number) {
  const m = useMat(() => {
    const c = base.clone();
    c.transparent = true;
    return c;
  });
  m.opacity = opacidad;
  m.depthWrite = opacidad > 0.95;
  m.visible = opacidad > 0.01;
  return m;
}

// ---------------------------------------------------------------------
//  Geometrías del coche
// ---------------------------------------------------------------------
function perfilExtruido(puntos: (s: THREE.Shape) => void, ancho: number, bisel: number) {
  const s = new THREE.Shape();
  puntos(s);
  const g = new THREE.ExtrudeGeometry(s, { depth: ancho - 2 * bisel, bevelEnabled: true, bevelSize: bisel, bevelThickness: bisel, bevelSegments: 5, curveSegments: 24 });
  // forma en (u = hacia delante, y); extrusión a lo ancho → u pasa a -z y la extrusión a x
  g.rotateY(Math.PI / 2);
  g.translate(-(ancho - 2 * bisel) / 2, 0, 0);
  g.computeVertexNormals();
  return g;
}
const R_ARCO = 0.4;
const geoCarroceria = perfilExtruido(
  (s) => {
    s.moveTo(-2.1, 0.3);
    s.lineTo(-2.13, 0.72);
    s.quadraticCurveTo(-2.12, 0.96, -1.95, 0.99);
    s.lineTo(0.85, 1.0);
    s.quadraticCurveTo(1.6, 0.92, 1.98, 0.84);
    s.quadraticCurveTo(2.14, 0.8, 2.13, 0.62);
    s.lineTo(2.1, 0.32);
    s.lineTo(BATALLA + R_ARCO, 0.32);
    s.absarc(BATALLA, 0.32, R_ARCO, 0, Math.PI, false);
    s.lineTo(-BATALLA + R_ARCO, 0.32);
    s.absarc(-BATALLA, 0.32, R_ARCO, 0, Math.PI, false);
    s.lineTo(-2.1, 0.3);
  },
  1.78,
  0.07
);
const geoCabina = perfilExtruido(
  (s) => {
    s.moveTo(-1.92, 0.97);
    s.quadraticCurveTo(-1.85, 1.3, -1.6, 1.42);
    s.lineTo(0.05, 1.46);
    s.quadraticCurveTo(0.35, 1.44, 0.95, 0.99);
    s.lineTo(-1.92, 0.97);
  },
  1.5,
  0.06
);
const geoTecho = perfilExtruido(
  (s) => {
    s.moveTo(-1.55, 1.425);
    s.lineTo(0.0, 1.462);
    s.lineTo(0.0, 1.475);
    s.lineTo(-1.55, 1.44);
  },
  1.34,
  0.04
);

// Neumático: perfil girado (eje = x)
const geoNeumatico = (() => {
  const p: THREE.Vector2[] = [];
  const ri = 0.215;
  const ro = RUEDA_R;
  const h = 0.11;
  p.push(new THREE.Vector2(ri, -h));
  for (let i = 0; i <= 8; i++) {
    const a = -Math.PI / 2 + (i / 8) * (Math.PI / 2);
    p.push(new THREE.Vector2(ro - 0.035 + 0.035 * Math.cos(a), -h + 0.035 + 0.035 * Math.sin(a)));
  }
  for (let i = 0; i <= 8; i++) {
    const a = (i / 8) * (Math.PI / 2);
    p.push(new THREE.Vector2(ro - 0.035 + 0.035 * Math.cos(a), h - 0.035 + 0.035 * Math.sin(a)));
  }
  p.push(new THREE.Vector2(ri, h));
  const g = new THREE.LatheGeometry(p, 64);
  g.rotateZ(Math.PI / 2);
  return g;
})();
const geoBarril = new THREE.CylinderGeometry(0.215, 0.215, 0.2, 48, 1, true).rotateZ(Math.PI / 2);
const geoAroLlanta = new THREE.TorusGeometry(0.205, 0.014, 10, 64).rotateY(Math.PI / 2);
const geoRadio = new RoundedBoxGeometry(0.03, 0.16, 0.05, 2, 0.012);
const geoBujeLlanta = new THREE.CylinderGeometry(0.055, 0.06, 0.04, 32).rotateZ(Math.PI / 2);
const geoDisco = new THREE.CylinderGeometry(0.19, 0.19, 0.024, 64).rotateZ(Math.PI / 2);
const geoPinza = new RoundedBoxGeometry(0.1, 0.1, 0.17, 3, 0.025);
const geoPastilla = new THREE.BoxGeometry(0.012, 0.07, 0.13);
const geoAnillo = new THREE.TorusGeometry(RUEDA_R + 0.04, 0.012, 8, 80).rotateY(Math.PI / 2);
const geoPiloto = new RoundedBoxGeometry(0.04, 0.12, 0.42, 2, 0.015);
const geoFaro = new RoundedBoxGeometry(0.06, 0.1, 0.36, 2, 0.02);
const geoEspejo = new RoundedBoxGeometry(0.12, 0.09, 0.18, 2, 0.02);
const geoHumo = new THREE.IcosahedronGeometry(1, 1);
// Valla y conos
const geoCono = new THREE.ConeGeometry(0.16, 0.5, 24);
const geoBandaCono = new THREE.CylinderGeometry(0.085, 0.11, 0.09, 24, 1, true);
const geoBaseCono = new THREE.BoxGeometry(0.36, 0.03, 0.36);
const geoTablero = new THREE.BoxGeometry(3.3, 0.3, 0.04);
const geoPata = new THREE.CylinderGeometry(0.025, 0.025, 1.0, 10);
const geoPie = new THREE.BoxGeometry(0.06, 0.04, 0.5);

// ---------------------------------------------------------------------
//  Rueda (izquierda; la derecha es la misma con escala x = -1)
// ---------------------------------------------------------------------
const Rueda: React.FC<{ c: EstadoCoche; delantera: boolean; detalle: boolean }> = ({ c, delantera, detalle }) => {
  const fx = detalle ? c.fantasma : 0;
  const neum = useTransparente(matNeumatico, 1 - 0.85 * fx);
  const llanta = useTransparente(matLlanta, 1 - 0.75 * fx);
  const pinza = useTransparente(matPinza, 1 - 0.6 * fx);
  rxNeumatico.uniforms.uFuerza.value = fx;
  rxLlanta.uniforms.uFuerza.value = fx * 0.6;
  const pastillas = useMat(() => matPastilla.clone());
  pastillas.emissiveIntensity = detalle ? 1.4 * c.aprieta * (0.3 + 0.7 * fx) : 0;
  const lat = useMat(() => matLatiguillo.clone());
  lat.emissiveIntensity = detalle ? 2.2 * c.presion : 0;
  const anillo = useMat(() => new THREE.MeshBasicMaterial({ color: "#ff3a2a", transparent: true, depthWrite: false }));
  anillo.opacity = detalle ? c.bloqueada : 0;
  anillo.visible = anillo.opacity > 0.01;
  const hueco = 0.012 * (1 - c.aprieta);
  const latCurva = useMemo(
    () => new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0.03, 0.12, 0.16), new THREE.Vector3(0.09, 0.26, 0.14), new THREE.Vector3(0.2, 0.36, 0.02)]), 20, 0.009, 8),
    []
  );
  return (
    <group rotation={[0, delantera ? c.direccion : 0, 0]}>
      {/* Lo que gira con la rueda */}
      <group rotation={[c.vuelta, 0, 0]}>
        <mesh geometry={geoNeumatico} material={neum} castShadow receiveShadow />
        {detalle && fx > 0.01 && <mesh geometry={geoNeumatico} material={rxNeumatico} />}
        <mesh geometry={geoBarril} material={llanta} />
        <mesh geometry={geoAroLlanta} material={llanta} position={[-0.085, 0, 0]} />
        {[0, 1, 2, 3, 4].map((k) => {
          const a = (k / 5) * Math.PI * 2;
          return (
            <group key={k} rotation={[a, 0, 0]}>
              <mesh geometry={geoRadio} material={llanta} position={[-0.085, 0.13, 0]} castShadow />
              {detalle && fx > 0.01 && <mesh geometry={geoRadio} material={rxLlanta} position={[-0.085, 0.13, 0]} />}
            </group>
          );
        })}
        <mesh geometry={geoBujeLlanta} material={matBuje} position={[-0.09, 0, 0]} />
        <mesh geometry={geoDisco} material={[matDiscoCanto, matDiscoCara, matDiscoCara]} position={[0.03, 0, 0]} />
      </group>
      {/* Pinza fija (no gira con la rueda): detrás del eje, arriba */}
      <group rotation={[Math.PI / 3, 0, 0]}>
        <mesh geometry={geoPinza} material={pinza} position={[0.03, 0.17, 0]} castShadow />
        <mesh geometry={geoPastilla} material={pastillas} position={[0.03 - 0.018 - hueco, 0.165, 0]} />
        <mesh geometry={geoPastilla} material={pastillas} position={[0.03 + 0.018 + hueco, 0.165, 0]} />
      </group>
      {detalle && <mesh geometry={latCurva} material={lat} />}
      <mesh geometry={geoAnillo} material={anillo} position={[-0.12, 0, 0]} />
    </group>
  );
};

// ---------------------------------------------------------------------
//  Coche
// ---------------------------------------------------------------------
const N_HUMO = 90;
const Humo: React.FC<{ c: EstadoCoche; t: number }> = ({ c, t }) => {
  const malla = useMemo(() => {
    const m = new THREE.InstancedMesh(geoHumo, matHumo.clone(), N_HUMO * 2);
    m.frustumCulled = false;
    return m;
  }, []);
  const mat = malla.material as THREE.MeshStandardMaterial;
  mat.opacity = 0.32 * c.humo;
  mat.visible = c.humo > 0.01;
  const o = new THREE.Object3D();
  const r = azar(5);
  let i = 0;
  for (const lado of [-1, 1]) {
    for (let k = 0; k < N_HUMO; k++) {
      const vida = 0.9 + r() * 0.5;
      const edad = (t + k * (vida / N_HUMO) + r()) % vida;
      const jx = (r() - 0.5) * 0.2;
      o.position.set(lado * VIA + jx + lado * edad * 0.4, 0.06 + edad * 0.5, -BATALLA + 0.25 + edad * c.velocidad * 0.85);
      o.scale.setScalar(0.08 + edad * 0.55);
      o.updateMatrix();
      malla.setMatrixAt(i++, o.matrix);
    }
  }
  malla.instanceMatrix.needsUpdate = true;
  return <primitive object={malla} />;
};

// Faros: luz real sobre el asfalto (foco hijo del coche, con su objetivo también dentro del coche).
const Faros: React.FC = () => {
  const { luz, objetivo } = useMemo(() => {
    const l = new THREE.SpotLight("#fff4e0", 22, 30, 0.5, 0.6, 1.3);
    const o = new THREE.Object3D();
    l.target = o;
    l.position.set(0, 0.75, -2.3);
    o.position.set(0, 0, -14);
    return { luz: l, objetivo: o };
  }, []);
  return (
    <>
      <primitive object={luz} />
      <primitive object={objetivo} />
    </>
  );
};

const Coche: React.FC<{ c: EstadoCoche; t: number }> =({ c, t }) => {
  const carroceria = useTransparente(matPintura, 1 - 0.55 * c.fantasma);
  const pilotos = useMat(() => matPilotoAtras.clone());
  pilotos.emissiveIntensity = 0.4 + 3.2 * c.freno;
  return (
    <group position={[c.x, 0, c.z]} rotation={[0, c.giro, 0]}>
      <mesh geometry={geoCarroceria} material={carroceria} castShadow receiveShadow />
      <mesh geometry={geoCabina} material={matCristal} castShadow />
      <mesh geometry={geoTecho} material={carroceria} />
      {/* Bajos y paragolpes oscuros */}
      <mesh position={[0, 0.22, 0]} material={matNegro}>
        <boxGeometry args={[1.6, 0.16, 3.4]} />
      </mesh>
      {[-1, 1].map((l) => (
        <group key={l}>
          <mesh geometry={geoPiloto} material={pilotos} position={[l * 0.62, 0.84, 2.21]} rotation={[0, Math.PI / 2, 0]} />
          <mesh geometry={geoFaro} material={matFaro} position={[l * 0.6, 0.72, -2.19]} rotation={[0, Math.PI / 2, 0]} />
          <mesh geometry={geoEspejo} material={carroceria} position={[l * 0.98, 1.02, -0.62]} />
        </group>
      ))}
      {/* Ruedas: delantera izquierda = la del primer plano */}
      {[
        [-1, -BATALLA, true],
        [1, -BATALLA, true],
        [-1, BATALLA, false],
        [1, BATALLA, false],
      ].map(([l, z, del], k) => (
        <group key={k} position={[(l as number) * VIA, RUEDA_R, z as number]} scale={[-(l as number), 1, 1]}>
          <Rueda c={c} delantera={del as boolean} detalle={k === 0} />
        </group>
      ))}
      <Humo c={c} t={t} />
      <Faros />
    </group>
  );
};

// ---------------------------------------------------------------------
//  Carretera, valla, conos, marcas y ruta
// ---------------------------------------------------------------------
const Carretera: React.FC = () => (
  <>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, -50]} material={matHierba} receiveShadow>
      <planeGeometry args={[300, 700]} />
    </mesh>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -50]} material={matAsfalto} receiveShadow>
      <planeGeometry args={[ANCHO_CALLE, 700]} />
    </mesh>
    {/* Líneas: bordes continuos y central discontinua */}
    {[-1, 1].map((l) => (
      <mesh key={l} rotation={[-Math.PI / 2, 0, 0]} position={[l * (ANCHO_CALLE / 2 - 0.2), 0.004, -50]} material={matRaya}>
        <planeGeometry args={[0.13, 700]} />
      </mesh>
    ))}
    {Array.from({ length: 120 }, (_, i) => (
      <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 290 - i * 6]} material={matRaya}>
        <planeGeometry args={[0.12, 3]} />
      </mesh>
    ))}
  </>
);

const POS_CONOS = [0.35, 1.2, 2.3, 3.15];
const Obstaculo: React.FC<{ e: EstadoAbs }> = ({ e }) => {
  const sac = Math.sin(e.tiempo * 30) * 0.12 * e.tiembla;
  return (
    <>
      <group position={[CARRIL, 0, Z_VALLA]} rotation={[sac, 0, 0]}>
        <mesh geometry={geoTablero} material={matValla} position={[0, 0.85, 0]} castShadow />
        <mesh geometry={geoTablero} material={matValla} position={[0, 0.45, 0]} castShadow />
        {[-1.5, 1.5].map((x) => (
          <group key={x}>
            <mesh geometry={geoPata} material={matPata} position={[x, 0.5, 0]} castShadow />
            <mesh geometry={geoPie} material={matPata} position={[x, 0.02, 0]} />
          </group>
        ))}
      </group>
      {POS_CONOS.map((x, i) => {
        const cae = Math.max(0, Math.min(1, e.choque * 1.6 - i * 0.12));
        const sale = e.choque * (1.6 + i * 0.4);
        return (
          <group key={i} position={[x + (i - 1.5) * 0.5 * e.choque, 0, Z_CONOS - sale]} rotation={[-cae * 1.45, 0, (i - 1.5) * 0.4 * cae]}>
            <mesh geometry={geoBaseCono} material={matCono} position={[0, 0.015, 0]} castShadow />
            <mesh geometry={geoCono} material={matCono} position={[0, 0.28, 0]} castShadow />
            <mesh geometry={geoBandaCono} material={matBanda} position={[0, 0.3, 0]} />
          </group>
        );
      })}
    </>
  );
};

const Marcas: React.FC<{ e: EstadoAbs }> = ({ e }) => (
  <>
    {e.marcas.map((m, i) =>
      m.z0 - m.z1 > 0.05 ? (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[m.x, 0.006, (m.z0 + m.z1) / 2]} material={matMarca}>
          <planeGeometry args={[0.2, m.z0 - m.z1]} />
        </mesh>
      ) : null
    )}
  </>
);

const Ruta: React.FC<{ e: EstadoAbs }> = ({ e }) => {
  const mat = useMat(() => new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false }));
  mat.color.set(e.rutaColor);
  mat.opacity = 0.9 * e.ruta;
  mat.visible = e.ruta > 0.01;
  const trozos = [];
  for (let z = -36; z > -70; z -= 1.3) {
    const x = xRuta(z);
    const ang = Math.atan2(-(xRuta(z - 0.3) - x), 0.3);
    trozos.push(
      <mesh key={z} rotation={[-Math.PI / 2, 0, ang]} position={[x, 0.012, z]} material={mat}>
        <planeGeometry args={[0.28, 0.75]} />
      </mesh>
    );
  }
  return <>{trozos}</>;
};

// ---------------------------------------------------------------------
//  Pedal y pie
// ---------------------------------------------------------------------
// Perfil lateral de la zapatilla en (u = del talón a la punta, y = altura sobre la suela).
const geoSuela = (() => {
  const s = new THREE.Shape();
  s.moveTo(0.0, 0.0);
  s.lineTo(0.24, 0.0);
  s.quadraticCurveTo(0.29, 0.0, 0.295, 0.025);
  s.lineTo(0.29, 0.035);
  s.lineTo(-0.012, 0.035);
  s.quadraticCurveTo(-0.02, 0.0, 0.0, 0.0);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.085, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.008, bevelSegments: 3 });
  g.rotateY(-Math.PI / 2);
  g.translate(0.0425, 0, 0);
  return g; // u → +z local, extrusión → x
})();
const geoEmpeine = (() => {
  const s = new THREE.Shape();
  s.moveTo(-0.008, 0.035);
  s.lineTo(0.27, 0.035);
  s.quadraticCurveTo(0.3, 0.04, 0.29, 0.07);
  s.quadraticCurveTo(0.27, 0.095, 0.2, 0.105);
  s.quadraticCurveTo(0.14, 0.12, 0.1, 0.15);
  s.lineTo(0.085, 0.165);
  s.quadraticCurveTo(0.05, 0.15, 0.02, 0.15);
  s.quadraticCurveTo(-0.025, 0.16, -0.025, 0.13);
  s.quadraticCurveTo(-0.03, 0.07, -0.008, 0.035);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.07, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 4, curveSegments: 16 });
  g.rotateY(-Math.PI / 2);
  g.translate(0.035, 0, 0);
  return g;
})();

const RODILLA: V3 = [0.02, 0.58, 0.42];
const ARRIBA = new THREE.Vector3(0, 1, 0);
const Palo: React.FC<{ a: V3; b: V3; r: number; mat: THREE.Material }> = ({ a, b, r, mat }) => {
  const va = new THREE.Vector3(...a);
  const vb = new THREE.Vector3(...b);
  const d = vb.clone().sub(va);
  const largo = d.length();
  const q = new THREE.Quaternion().setFromUnitVectors(ARRIBA, d.normalize());
  return (
    <>
      <mesh position={va.clone().add(vb).multiplyScalar(0.5)} quaternion={q} material={mat} castShadow>
        <cylinderGeometry args={[r, r, largo, 24]} />
      </mesh>
      <mesh position={va} material={mat}>
        <sphereGeometry args={[r, 24, 16]} />
      </mesh>
    </>
  );
};

const Pedal: React.FC<{ e: EstadoAbs }> = ({ e }) => {
  const a = anguloPedal(e.pedal);
  const goma = gomaPedal(e.pedal);
  // El pie: talón fijo en la moqueta, la planta (a 0,2 m del talón) apoyada en la goma del pedal.
  const dy = goma[1] + 0.035 - TALON[1];
  const dz = TALON[2] - goma[2];
  const pie = Math.atan2(dy, dz);
  // tobillo: encima del talón, un poco hacia la punta (sistema de la zapatilla: u=0.06, altura 0.13)
  const tobillo: V3 = [0.005, TALON[1] - 0.035 + 0.13 * Math.cos(pie) + 0.06 * Math.sin(pie), TALON[2] - 0.06 * Math.cos(pie) + 0.13 * Math.sin(pie)];
  const largoBrazo = Math.hypot(BRAZO[0], BRAZO[1]);
  return (
    <>
      {/* Suelo, pared delantera y túnel central */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} material={matMoqueta} receiveShadow>
        <planeGeometry args={[2, 2]} />
      </mesh>
      <mesh rotation={[-0.6, 0, 0]} position={[0, 0.35, -0.42]} material={matMoqueta} receiveShadow>
        <planeGeometry args={[2, 1]} />
      </mesh>
      <mesh position={[0.32, 0.12, -0.1]} material={matPlasticoInt} receiveShadow castShadow>
        <boxGeometry args={[0.16, 0.24, 1.2]} />
      </mesh>
      <mesh position={[0, 0.9, -0.3]} material={matPlasticoInt}>
        <boxGeometry args={[1.4, 0.3, 0.4]} />
      </mesh>
      {/* Pedal de freno */}
      <group position={PIVOTE} rotation={[a, 0, 0]}>
        <mesh material={matMetalPedal} position={[0, BRAZO[0] / 2, BRAZO[1] / 2]} rotation={[Math.atan2(BRAZO[1], BRAZO[0]), 0, 0]} castShadow>
          <boxGeometry args={[0.022, largoBrazo, 0.03]} />
        </mesh>
        <group position={[0, BRAZO[0], BRAZO[1]]} rotation={[-0.35, 0, 0]}>
          <mesh material={matMetalPedal} castShadow>
            <boxGeometry args={[0.1, 0.075, 0.016]} />
          </mesh>
          <mesh material={matGomaPedal} position={[0, 0, 0.011]}>
            <boxGeometry args={[0.096, 0.072, 0.008]} />
          </mesh>
        </group>
        <mesh material={matMetalPedal} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.02, 0.02, 0.08, 16]} />
        </mesh>
      </group>
      {/* Acelerador (a la derecha, sin pisar) */}
      <group position={[0.17, 0.2, -0.13]} rotation={[-0.55, 0, 0]}>
        <mesh material={matGomaPedal} castShadow>
          <boxGeometry args={[0.06, 0.2, 0.014]} />
        </mesh>
      </group>
      {/* Zapatilla: talón en TALON, apuntando hacia -z y subiendo hacia el pedal */}
      <group position={[0.005, TALON[1] - 0.035, TALON[2]]} rotation={[pie, Math.PI, 0]}>
        <mesh geometry={geoSuela} material={matSuela} castShadow receiveShadow />
        <mesh geometry={geoEmpeine} material={matZapato} castShadow />
        {/* franja lateral y cordones */}
        {[-1, 1].map((l) => (
          <mesh key={l} material={matDetalle} position={[l * 0.048, 0.075, 0.12]} rotation={[-0.25, 0, 0]}>
            <boxGeometry args={[0.004, 0.02, 0.15]} />
          </mesh>
        ))}
        {[0, 1, 2, 3].map((i) => (
          <mesh key={i} material={matCordon} position={[0, 0.153 - i * 0.013, 0.1 + i * 0.03]} rotation={[0.45, 0, 0]}>
            <boxGeometry args={[0.05, 0.006, 0.008]} />
          </mesh>
        ))}
      </group>
      {/* calcetín y pierna (vaquero), del tobillo a la rodilla (fuera de plano, arriba y atrás) */}
      <Palo a={tobillo} b={[tobillo[0], tobillo[1] + 0.05, tobillo[2] + 0.01]} r={0.043} mat={matCalcetin} />
      <Palo a={[tobillo[0], tobillo[1] + 0.04, tobillo[2] + 0.01]} b={RODILLA} r={0.058} mat={matVaquero} />
    </>
  );
};

// ---------------------------------------------------------------------
//  Luz y entorno
// ---------------------------------------------------------------------
const Entorno: React.FC<{ fondo: string }> = ({ fondo }) => {
  const { gl, scene } = useThree();
  useMemo(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.55;
  }, [gl, scene]);
  scene.background = new THREE.Color(fondo);
  scene.fog = fondo === "#0b0f17" ? new THREE.Fog(fondo, 45, 130) : null;
  return null;
};

const Sol: React.FC<{ centro: V3 }> = ({ centro }) => {
  const { luz, objetivo } = useMemo(() => {
    const l = new THREE.DirectionalLight("#ffe2c0", 2.2);
    l.castShadow = true;
    l.shadow.mapSize.set(2048, 2048);
    l.shadow.bias = -0.0004;
    l.shadow.camera.left = -9;
    l.shadow.camera.right = 9;
    l.shadow.camera.top = 9;
    l.shadow.camera.bottom = -9;
    l.shadow.camera.near = 1;
    l.shadow.camera.far = 60;
    const o = new THREE.Object3D();
    l.target = o;
    return { luz: l, objetivo: o };
  }, []);
  luz.position.set(centro[0] - 8, 14, centro[2] - 10);
  objetivo.position.set(...centro);
  return (
    <>
      <primitive object={luz} />
      <primitive object={objetivo} />
    </>
  );
};

const FocoPedal: React.FC = () => {
  const { luz, objetivo } = useMemo(() => {
    const l = new THREE.SpotLight("#fff1dc", 6, 3, 0.9, 0.7, 1.5);
    l.castShadow = true;
    l.shadow.mapSize.set(2048, 2048);
    l.shadow.bias = -0.0003;
    const o = new THREE.Object3D();
    l.target = o;
    return { luz: l, objetivo: o };
  }, []);
  luz.position.set(-0.7, 0.9, 0.5);
  objetivo.position.set(0, 0.15, -0.05);
  return (
    <>
      <primitive object={luz} />
      <primitive object={objetivo} />
    </>
  );
};

export const MundoAbs: React.FC<{ e: EstadoAbs }> = ({ e }) => {
  if (e.escena === "pedal") {
    return (
      <>
        <Entorno fondo="#07090c" />
        <hemisphereLight args={["#c9d8ff", "#1a140c", 0.35]} />
        <FocoPedal />
        <pointLight position={[0.4, 0.3, 0.4]} intensity={0.6} distance={2} color="#9fc3ff" decay={1.4} />
        <Pedal e={e} />
      </>
    );
  }
  const c = e.coche;
  return (
    <>
      <Entorno fondo="#0b0f17" />
      <hemisphereLight args={["#b9cdf5", "#1c160e", 0.75]} />
      <Sol centro={[c.x, 0, c.z]} />
      {/* luz de relleno para el primer plano de la rueda */}
      <pointLight position={cocheAMundo(c, [-1.6, 0.6, -0.8])} intensity={1.6 * (0.4 + c.fantasma)} distance={3} color="#cfe2ff" decay={1.5} />
      <Carretera />
      <Obstaculo e={e} />
      <Marcas e={e} />
      <Ruta e={e} />
      <Coche c={c} t={e.tiempo} />
    </>
  );
};
