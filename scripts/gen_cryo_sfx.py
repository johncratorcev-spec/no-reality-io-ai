#!/usr/bin/env python3
"""Cryo-Stop SFX (Block 3): три коротких звука в public/sfx (WAV, 44.1к, 16-bit).
  cryo-scan.wav  — лазерный резак / цифровой затвор: резкий чистый хлопок (0.28s)
  cryo-crack.wav — треск айсберга: низкий гул + длинный реверб-хвост (1.9s)
  cryo-coin.wav  — монета падает в воду: металлический блип + «плюх» (0.55s)
Генерация процедурная (numpy), без внешних ассетов."""
import numpy as np
import wave
import os

SR = 44100
OUT = "/home/z/my-project/public/sfx"
os.makedirs(OUT, exist_ok=True)


def save(name, data, gain=0.9):
    data = np.asarray(data, dtype=np.float64)
    peak = np.max(np.abs(data)) or 1.0
    data = data / peak * gain
    pcm = (data * 32767).astype(np.int16)
    path = os.path.join(OUT, name)
    with wave.open(path, "w") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    print(f"{path}: {len(pcm)/SR:.2f}s")


def env_exp(n, decay):
    return np.exp(-np.linspace(0, decay, n))


def env_attack(n, a_ms=3):
    a = min(n, int(SR * a_ms / 1000))
    e = np.ones(n)
    if a:
        e[:a] = np.linspace(0, 1, a)
    return e


rng = np.random.default_rng(41)

# ── SFX_01_Scan: цифровой затвор — свип 5.4кГц→1.3кГц + шумовой транзиент ──
dur = 0.28
n = int(SR * dur)
t = np.linspace(0, dur, n, endpoint=False)
f = np.geomspace(5400, 1300, n)
phase = 2 * np.pi * np.cumsum(f) / SR
tone = np.sin(phase) * env_exp(n, 7) * env_attack(n, 2)
# цифровой щелчок: короткий белый шум с HP-характером (разность соседних сэмплов)
noise = rng.standard_normal(n)
click = (noise - np.roll(noise, 1)) * env_exp(n, 40) * 0.8
sfx_scan = tone * 0.85 + click * 0.55
# суб-хвост для «разрыва временного потока»
sub = np.sin(2 * np.pi * 90 * t) * env_exp(n, 12) * 0.25
sfx_scan += sub
save("cryo-scan.wav", sfx_scan, 0.88)

# ── SFX_02_Ice_Crack: низкий гул трескающегося айсберга + реверб-хвост ──
dur = 1.9
n = int(SR * dur)
t = np.linspace(0, dur, n, endpoint=False)
# тело: суб-бас 52-88Гц с биениями
body = (np.sin(2 * np.pi * 56 * t) * 0.9 + np.sin(2 * np.pi * 84 * t) * 0.55
        + np.sin(2 * np.pi * 33 * t) * 0.7)
body *= env_exp(n, 4.5) * env_attack(n, 6)
# серия тресков: 6 шумовых импульсов с рандомными задержками, каждый с затуханием
cracks = np.zeros(n)
for i in range(6):
    start = int(SR * (0.02 + 0.13 * i + rng.uniform(0, 0.05)))
    ln = int(SR * rng.uniform(0.05, 0.14))
    if start + ln >= n:
        continue
    nz = rng.standard_normal(ln)
    nz = np.convolve(nz, np.ones(6) / 6, "same")  # сглаживание — ледяной характер
    cracks[start:start + ln] += nz * env_exp(ln, 6) * (0.9 - 0.11 * i)
# реверб-хвост: затухающие отражения cracks-серии
tail = np.zeros(n)
delay_ms = (78, 141, 227, 331, 452, 598, 761)
for k, d in enumerate(delay_ms):
    off = int(SR * d / 1000)
    if off >= n:
        continue
    tail[off:] += cracks[:n - off] * (0.55 ** (k + 1))
sfx_crack = body * 0.75 + cracks * 0.5 + tail * 0.8
save("cryo-crack.wav", sfx_crack, 0.92)

# ── SFX_03_Coin: металлический блип (кольцо монеты) + «плюх» воды ──
dur = 0.55
n = int(SR * dur)
t = np.linspace(0, dur, n, endpoint=False)
# кольцо: два несущие с негармоничным отношением (металл), быстрое затухание
ring = (np.sin(2 * np.pi * 2093 * t) * 0.6 + np.sin(2 * np.pi * 3350 * t) * 0.4
        + np.sin(2 * np.pi * 5274 * t) * 0.25)
ring *= env_exp(n, 16) * env_attack(n, 1)
# плюх: свип 900→240Гц чуть позже, мягкая атака
plip = np.zeros(n)
off = int(SR * 0.16)
m = n - off
tp = np.linspace(0, (n - off) / SR, m, endpoint=False)
fp = np.geomspace(900, 240, m)
plip[off:] = np.sin(2 * np.pi * np.cumsum(fp) / SR) * env_exp(m, 9) * env_attack(m, 8)
# пузырёк на самом конце
bub = np.zeros(n)
off2 = int(SR * 0.42)
m2 = n - off2
tb = np.linspace(0, (n - off2) / SR, m2, endpoint=False)
fb = np.geomspace(600, 1400, m2)
bub[off2:] = np.sin(2 * np.pi * np.cumsum(fb) / SR) * env_attack(m2, 4) * env_exp(m2, 10) * 0.5
sfx_coin = ring * 0.6 + plip * 0.8 + bub * 0.45
save("cryo-coin.wav", sfx_coin, 0.85)

# ── SFX_04_Click: сухой электрический щелчок истечения (Block 7) ──
dur = 0.07
n = int(SR * dur)
t = np.linspace(0, dur, n, endpoint=False)
# разряд: прямоугольный блип 2400Гц + искровой шум, мгновенное затухание
sq = np.sign(np.sin(2 * np.pi * 2400 * t)) * env_exp(n, 60) * 0.7
spark = (rng.standard_normal(n) - np.roll(rng.standard_normal(n), 1)) * env_exp(n, 90) * 0.6
sfx_click = sq * 0.8 + spark * 0.5
save("cryo-click.wav", sfx_click, 0.8)

print("done")
