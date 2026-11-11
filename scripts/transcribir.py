"""Transcribe un audio con marcas de tiempo por palabra (faster-whisper, local).
Uso: python scripts/transcribir.py input/gancho.mp3 input/gancho.transcripcion.json [modelo] [idioma, por defecto es]
"""
import json
import sys

from faster_whisper import WhisperModel

entrada, salida = sys.argv[1], sys.argv[2]
modelo = sys.argv[3] if len(sys.argv) > 3 else "small"
idioma = sys.argv[4] if len(sys.argv) > 4 else "es"

m = WhisperModel(modelo, device="cpu", compute_type="int8")
segs, info = m.transcribe(entrada, language=idioma, word_timestamps=True, vad_filter=False, beam_size=5)
palabras = []
for s in segs:
    for w in s.words:
        palabras.append({"texto": w.word.strip(), "inicio": round(w.start, 3), "fin": round(w.end, 3)})
json.dump({"duracion": round(info.duration, 3), "palabras": palabras}, open(salida, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(len(palabras), "palabras;", " ".join(p["texto"] for p in palabras))
