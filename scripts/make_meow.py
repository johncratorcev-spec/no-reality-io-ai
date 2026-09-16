#!/usr/bin/env python3
"""Task 30: синтез мягкого мультяшного «мяу» (formant-ish синтез, numpy).
out: public/sfx/meow.mp3 (ffmpeg) или public/sfx/meow.wav (fallback)."""
import os
import subprocess
import wave

import numpy as np

SR = 44100
DUR = 0.85

t = np.linspace(0, DUR, int(SR * DUR), endpoint=False)

# --- Pitch-контур мяу: подъём ~430→760 Hz, спад к ~330 Hz (мягкая дуга)
rise = (t / 0.28).clip(0, 1) ** 0.8
fall = ((t - 0.28) / (DUR - 0.28)).clip(0, 1) ** 1.35
f0 = np.where(t < 0.28, 430 + (760 - 430) * rise, 760 - (760 - 330) * fall)
# лёгкое вибрато 5.5 Hz, глубина 1.2% — живость без пестроты
f0 *= 1 + 0.012 * np.sin(2 * np.pi * 5.5 * t)
phase = 2 * np.pi * np.cumsum(f0) / SR

# --- Гармонический ряд с наклоном (тихие верха = мягкость)
sig = (np.sin(phase) * 1.0
       + 0.42 * np.sin(2 * phase)
       + 0.18 * np.sin(3 * phase)
       + 0.07 * np.sin(4 * phase))

# --- Формантный намёк: амплитудная огибающая «ау» — открыто в начале, узко в конце
openness = np.clip(1.0 - 0.55 * (t / DUR) ** 1.2, 0.35, 1.0)
sig *= openness

# --- Дыхание-шум в первые 90 мс (шёпот «м»)
n = int(0.09 * SR)
breath = np.zeros_like(t)
breath[:n] = np.random.uniform(-1, 1, n) * 0.06
breath[:n] *= np.exp(-np.linspace(0, 6, n))

# --- ADSR: мягкая атака 70 мс, плавный релиз 260 мс
a = int(0.07 * SR)
r = int(0.26 * SR)
env = np.ones_like(t)
env[:a] = np.linspace(0, 1, a) ** 1.6
env[-r:] *= np.linspace(1, 0, r) ** 1.25

sig = (sig + breath) * env

# --- Мягкий low-pass (однополюсный) — срезать резкость
alpha = 0.32
out = np.empty_like(sig)
acc = 0.0
for i, x in enumerate(sig):
    acc += alpha * (x - acc)
    out[i] = acc

# --- Нормировка до -3.5 dBFS, фейд-хвост
out = out / (np.max(np.abs(out)) + 1e-9) * (10 ** (-3.5 / 20))
out8 = (out * 32767).astype(np.int16)

os.makedirs('public/sfx', exist_ok=True)
wav_path = 'public/sfx/meow.wav'
with wave.open(wav_path, 'wb') as w:
    w.setnchannels(1)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(out8.tobytes())
print('wav:', os.path.getsize(wav_path), 'bytes')

if subprocess.run(['which', 'ffmpeg'], capture_output=True).returncode == 0:
    mp3 = 'public/sfx/meow.mp3'
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', wav_path,
                    '-codec:a', 'libmp3lame', '-qscale:a', '6', mp3], check=True)
    os.remove(wav_path)
    print('mp3:', os.path.getsize(mp3), 'bytes')
