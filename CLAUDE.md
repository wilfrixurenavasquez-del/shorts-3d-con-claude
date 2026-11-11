# Shorts 3D con Claude (plantilla de SOY FRIX)

Este proyecto hace **Shorts verticales en 3D** que explican "¿por qué…?" de cosas del día a día (coches, aviones, aparatos), con three.js + Remotion.
Ejemplo incluido: "¿Por qué vibra tu pedal cuando frenas fuerte?" (ABS) → `src/Abs.tsx` + `src/abs/MundoAbs.tsx`.

## Cómo trabajar con el usuario
- Puede que **no sepa programar**: explica cada paso en español sencillo y dile al final de cada paso **qué hiciste** y **qué tiene que hacer él**.
- **Pide permiso antes de instalar** cualquier cosa (Node.js, ffmpeg, Python, paquetes).
- **Datos comprobados en internet** antes de ponerlos en el guion. Si un dato no se puede comprobar, no se usa. Si las fuentes dan un rango (ej.: 10-15 veces por segundo), di "más de diez".
- No borres ni sobrescribas vídeos anteriores: guarda versiones (`_v1`, `_v2`).

## La fórmula (lo que funcionó: 7.000 visitas en YouTube y 215.000 en Facebook)
1. **Primer fotograma = el momento de peligro** (pie pisando el freno, coche a punto de chocar, avión atravesado por un rayo) **+ la pregunta ya escrita en grande**, con una palabra clave en una caja de color. Sin intro. Si el primer segundo es flojo, casi la mitad de la gente se va.
2. **Duración 15-25 s**, nunca más de 30 s. Vertical 1080x1920, 60 fps.
3. **Guion de 7-8 frases cortas**, en este orden: pregunta → "no es lo que crees" → qué pasa sin ese sistema → cómo funciona (con rayos X) → qué significa para ti → final (o vuelve al primer plano para que el vídeo haga bucle).
4. **3D reconocible al instante.** Primeros planos de piezas pequeñas, bien iluminadas, que llenen la pantalla. El objeto entero lejos y con colores de plastilina parece "de juguete": evitarlo.
5. **Rayos X:** material azul transparente tipo fresnel para enseñar el mecanismo por dentro mientras funciona.
6. **Fondo oscuro** y colores: azul `#3B82F6`, cian, naranja, rojo, verde `#3DDC84`, amarillo `#FFD23A`. Efectos: bloom, desenfoque, viñeta y grano (`@react-three/postprocessing`).
7. **Subtítulos** arriba (`src/plantilla/SubtitulosRef.tsx`): máx. 4 palabras, palabra clave más grande. La frase 1 no lleva subtítulo: va el titular.
8. Nota pequeña abajo: "Recreación 3D".
9. **No funcionan:** noticias, vídeos de más de 30 s, temas de móviles muy vistos.

## Cómo está hecha la plantilla
- Todo el mundo 3D es una **función pura de un `Estado`** calculado a partir del tiempo (no hay animaciones sueltas): mismo tiempo → mismo fotograma.
- La cámara va por **"poses"** que se mezclan suavemente frase a frase.
- Todo se ancla a **palabras de la voz** (`src/tiempos-abs.json`), nunca a segundos escritos a mano. Cada cosa aparece ~0,1 s antes de su palabra.
- Las etiquetas con línea siguen un punto 3D (función `aPantalla`).
- **Sonidos opcionales:** si un archivo no existe en `public/abs/`, no suena y no da error.

## Para hacer un Short nuevo
1. Escribir el guion en `guiones/<nombre>.txt` (una frase por línea; la palabra clave entre `*asteriscos*`). Comprobar cada dato.
2. Copiar `src/Abs.tsx` → `src/<Nombre>.tsx` y `src/abs/MundoAbs.tsx` → `src/<nombre>/Mundo<Nombre>.tsx`, cambiar el mundo 3D y las poses de cámara. Añadirlo a `src/Root.tsx` y los atajos a `package.json` (copiar los de `abs`).
3. Voz: `npm run voz:<nombre>` (voz gratis edge-tts → Whisper → tiempos por palabra).
4. Revisar en `npm run preview`. **No le creas a la primera:** mira fotogramas sueltos del principio, del medio y del final antes de exportar.
5. Exportar con `npm run exportar:<nombre>` (`--gl=angle` es necesario en Windows para el 3D).
6. Volumen final: -14 LUFS, pico ≤ -1,5 dB.

## Consejo que más tiempo ahorra
Cuando algo no se vea bien, no digas solo "se ve feo": di **qué** está mal ("el pedal se ve pequeño", "no se entiende que la rueda patina", "la luz quema el primer plano"). Mejor aún, compara un fotograma con un vídeo que te guste y describe la diferencia.
