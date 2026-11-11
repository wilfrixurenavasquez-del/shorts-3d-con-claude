# 🎁 Shorts 3D con Claude (plantilla gratis de SOY FRIX)

Con esta plantilla hago mis Shorts en 3D **sin saber programar**: "¿Por qué vibra tu pedal cuando frenas fuerte?", el airbag, los frenos del avión…
Viene con un ejemplo completo (el del ABS) y con las reglas que he aprendido, para que Claude haga los tuyos igual.

## Lo que necesitas
- **Claude** (app de escritorio) con un plan que incluya **Claude Code** (el plan gratuito no lo incluye).
- **Node.js** (versión LTS): https://nodejs.org
- Para la voz (opcional): **Python**, **ffmpeg**, `edge-tts` y `faster-whisper`. Si no los tienes, Claude te ayuda a instalarlos (te pedirá permiso).

## Cómo empezar (5 minutos)
1. Descomprime esta carpeta donde quieras.
2. Abre Claude → pestaña **Code** → elige esta carpeta.
3. Pega este mensaje:

> Lee CLAUDE.md y README.md. Yo no sé programar: explícame todo en español sencillo y pídeme permiso antes de instalar nada.
> Primero instala lo necesario y ábreme la vista previa del vídeo del ABS para ver que funciona.
> Después quiero hacer un Short nuevo que explique por qué [TU PREGUNTA]. Comprueba cada dato en internet antes de usarlo.

## Atajos (los usa Claude por ti)
| Qué | Comando |
|---|---|
| Vista previa | `npm run preview` |
| Generar la voz del ABS | `npm run voz:abs` |
| Exportar el vídeo | `npm run exportar:abs` |
| Portada | `npm run portada:abs` |
| Buscar errores | `npm run errores` |

## Sonidos y música (no incluidos)
La plantilla funciona sin sonidos: si falta un archivo, simplemente no suena.
- **Voz:** `npm run voz:abs` la crea gratis (voz `it-IT-GiuseppeMultilingualNeural`, que habla español).
- **Efectos:** pon tus archivos en `public/abs/sfx/` con estos nombres: `pop.wav`, `clic.wav`, `brillo.mp3`, `frenazo.mp3`, `mazo.mp3`, `golpe.wav`. Usa solo sonidos con licencia libre (por ejemplo, CC0 de Wikimedia Commons o Freesound). El "tac-tac" del ABS (`abs.wav`) sí viene incluido: lo genera `scripts/sonido-abs.py`.
- **Música:** guárdala como `public/abs/musica.mp3`. Yo uso "Blip Stream" de Kevin MacLeod (incompetech.com, licencia CC BY 4.0: hay que poner el crédito en la descripción).

## Licencia
El código de esta carpeta es tuyo para usarlo, cambiarlo y hacer tus vídeos, también para monetizarlos. Si lo compartes, menciona a **SOY FRIX**.
Remotion es gratis para personas y empresas pequeñas; las empresas grandes necesitan licencia: https://www.remotion.dev/license

Hecho por **SOY FRIX** · YouTube: SOY FRIX · Instagram: @soy_frix
