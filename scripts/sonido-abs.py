"""Genera el sonido del ABS: golpecitos secos y graves a 12 Hz (como el "tac-tac-tac" que se nota en el pedal), 3 s.
Uso: python scripts/sonido-abs.py public/abs/sfx/abs.wav
"""
import sys
import wave

import numpy as np

sr = 48000
dur = 3.0
hz = 12
t = np.arange(int(sr * dur)) / sr
rng = np.random.default_rng(4)
out = np.zeros_like(t)
for k in range(int(dur * hz)):
    t0 = k / hz
    s = t - t0
    m = s >= 0
    e = np.where(m, np.exp(-s * 55), 0)
    golpe = np.sin(2 * np.pi * 95 * s) * e  # cuerpo grave
    clic = rng.standard_normal(len(t)) * np.where(m, np.exp(-s * 400), 0) * 0.35  # chasquido de la válvula
    out += golpe + clic
# zumbido de la bomba por debajo
out += 0.12 * np.sin(2 * np.pi * 140 * t) * (0.6 + 0.4 * np.sin(2 * np.pi * hz * t))
out /= np.max(np.abs(out)) * 1.15
pcm = (out * 32767).astype(np.int16)
with wave.open(sys.argv[1], "wb") as w:
    w.setnchannels(1)
    w.setsampwidth(2)
    w.setframerate(sr)
    w.writeframes(pcm.tobytes())
print(sys.argv[1], f"{dur} s, {hz} Hz")
