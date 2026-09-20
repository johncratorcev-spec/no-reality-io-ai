#!/usr/bin/env python3
"""Task 43: remove dead cryo CSS (ring/crystals/locked/verdict/extract/crust/particles),
keep crowd + gold-pulse keyframes. Deletes ranges bottom-up."""
import io

P = "/home/z/my-project/src/app/globals.css"
lines = io.open(P, encoding="utf-8").read().splitlines(keepends=True)

# sanity anchors (1-based)
assert "Кольцо-таймер" in lines[1611], lines[1611]
assert "nr-cryo-bubble {" in lines[1705], lines[1705]
assert "nr-cryo-qwrap" in lines[1712], lines[1712]
assert "nr-cryo-locked" in lines[1744], lines[1744]
assert "nr-cryo-verdict b" in lines[1781], lines[1781]
assert "nr-cryo-crystals" in lines[1784], lines[1784]
assert "nr-cryo-flyout {" in lines[1909], lines[1909]
assert "nr-cryo-extract" in lines[1982], lines[1982]
assert "nr-cryo-crust" in lines[2015], lines[2015]
assert "nr-cryo-particles" in lines[2033], lines[2033]
assert "изоляция внимания" in lines[2042], lines[2042]

# bottom-up ranges [start, end] inclusive (1-based)
ranges = [
    (2033, 2042),  # particles + blank
    (2015, 2032),  # crust + expired + blank
    (1982, 2014),  # extract + local-note + blank
    (1784, 1920),  # crystals … flyout + blank
    (1744, 1783),  # locked + verdict + blank
    (1712, 1743),  # qwrap + duplicate .nr-cryo-q + ch + blank
    (1612, 1711),  # ring family + bubbles + blank
]
for a, b in ranges:
    del lines[a - 1 : b]

# re-insert the kept gold-pulse keyframes + new stake/actions/payerr CSS
# right before the crowd indicator comment
marker = None
for i, l in enumerate(lines):
    if "индикатор толпы" in l:
        marker = i
        break
assert marker is not None
NEW = """/* своя позиция в толпе — золотой маркер (keyframes общие) */
@keyframes nr-cryo-gold-pulse {
  0%, 100% { opacity: 0.55; filter: drop-shadow(0 0 4px rgba(255, 200, 60, 0.5)); }
  50% { opacity: 1; filter: drop-shadow(0 0 12px rgba(255, 200, 60, 0.95)); }
}

/* ── task 43: stake selector — пресеты + своя сумма ── */
.nr-cryo-stake {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 10px;
}
.nr-cryo-stake-cap {
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: rgba(11, 26, 42, 0.52);
  flex: 0 0 auto;
}
.nr-cryo-chips {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  min-width: 0;
}
.nr-cryo-chip {
  border: 1px solid rgba(12, 40, 70, 0.16);
  background: rgba(255, 255, 255, 0.72);
  color: #0b1a2a;
  font-family: ui-monospace, Menlo, monospace;
  font-size: 12px;
  font-weight: 800;
  padding: 5px 10px;
  border-radius: 999px;
  cursor: pointer;
  transition: background 0.18s ease, color 0.18s ease, transform 0.18s ease, box-shadow 0.18s ease;
}
.nr-cryo-chip:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(12, 40, 70, 0.14);
}
.nr-cryo-chip-on {
  background: #0b1a2a;
  border-color: #0b1a2a;
  color: #fff;
  box-shadow: 0 4px 14px rgba(11, 26, 42, 0.35);
}
.nr-cryo-custom {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: 1px solid rgba(12, 40, 70, 0.16);
  background: rgba(255, 255, 255, 0.72);
  border-radius: 999px;
  padding: 3px 10px 3px 12px;
  transition: border-color 0.18s ease, box-shadow 0.18s ease;
}
.nr-cryo-custom:focus-within {
  border-color: rgba(15, 107, 255, 0.65);
  box-shadow: 0 0 0 3px rgba(46, 168, 255, 0.18);
}
.nr-cryo-custom-on { border-color: rgba(15, 107, 255, 0.55); }
.nr-cryo-custom input {
  width: 64px;
  border: 0;
  outline: 0;
  background: transparent;
  font-family: ui-monospace, Menlo, monospace;
  font-size: 12px;
  font-weight: 800;
  color: #0b1a2a;
  padding: 2px 0;
}
.nr-cryo-custom input::placeholder {
  color: rgba(11, 26, 42, 0.35);
  font-weight: 700;
}
.nr-cryo-custom em {
  font-style: normal;
  font-size: 8.5px;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(11, 26, 42, 0.4);
}

/* ── task 43: two big outcomes — один тап фиксирует позицию ── */
.nr-cryo-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-top: 10px;
}
.nr-cryo-action {
  position: relative;
  overflow: hidden;
  border: 0;
  border-radius: 16px;
  padding: 11px 14px 10px;
  cursor: pointer;
  text-align: left;
  display: flex;
  flex-direction: column;
  gap: 1px;
  transition: transform 0.22s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.22s ease, filter 0.22s ease;
}
.nr-cryo-action b {
  font-weight: 900;
  font-size: 19px;
  letter-spacing: 0.03em;
  line-height: 1.1;
}
.nr-cryo-action-odds {
  font-family: ui-monospace, Menlo, monospace;
  font-size: 12.5px;
  font-weight: 800;
}
.nr-cryo-action-note {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  opacity: 0.66;
}
.nr-cryo-action-yes {
  background: linear-gradient(160deg, rgba(255, 255, 255, 0.4), rgba(255, 255, 255, 0.08)) , var(--accent, #2ea8ff);
  background-blend-mode: normal;
  color: #101317;
  box-shadow: 0 10px 24px color-mix(in srgb, var(--accent, #2ea8ff) 42%, transparent), inset 0 1px 0 rgba(255, 255, 255, 0.55);
}
.nr-cryo-action-yes b { text-shadow: 0 1px 0 rgba(255, 255, 255, 0.35); }
.nr-cryo-action-no {
  background: linear-gradient(165deg, #2b3646, #10161d);
  color: #f2f6fa;
  box-shadow: 0 10px 24px rgba(16, 22, 29, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.14);
}
.nr-cryo-action-no .nr-cryo-action-odds { color: #9fd8ff; }
.nr-cryo-action:hover:not(:disabled) {
  transform: translateY(-2px);
  filter: brightness(1.05);
}
.nr-cryo-action:active:not(:disabled) { transform: scale(0.97); }
.nr-cryo-action:disabled { cursor: default; }
.nr-cryo-action-busy {
  animation: nr-cryo-pulse 0.5s ease-in-out infinite;
}
.nr-cryo-payerr {
  margin-top: 8px;
  font-size: 11px;
  font-weight: 700;
  color: #c2410c;
}

"""
lines.insert(marker, NEW)

io.open(P, "w", encoding="utf-8").write("".join(lines))
print("ok — dead cryo CSS removed, minimal panel CSS inserted")
