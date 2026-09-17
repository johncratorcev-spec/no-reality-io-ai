#!/bin/bash
# Перебор свежих постов @mmayrday: ищем "Crypto trader cat has a bad night".
CODES="DdUiHweiDKW DdUhkRiiMJe DdUhaspCD0I DdUhVPuCGRk DdUhN2hiC7u DdUehCLCB5y DdUehCRCOms DdUegMLiLOX DdUegKgiICA DdUeElLCDJR DdUeElxCDfE DdUeEkziIH_ DdUeElkCPQZ DdUd2jSiMRd"
for C in $CODES; do
  agent-browser close >/dev/null 2>&1
  sleep 1
  agent-browser open "https://www.threads.com/@mmayrday/post/$C" >/dev/null 2>&1
  agent-browser wait --load networkidle >/dev/null 2>&1
  agent-browser wait 4000 >/dev/null 2>&1
  R=$(agent-browser eval '(() => {
    const vids = Array.from(document.querySelectorAll("video")).map(v => (v.src || (v.querySelector("source") && v.querySelector("source").src) || "")).filter(Boolean);
    return JSON.stringify({t: document.title.slice(0,80), n: vids.length, v: (vids[0]||"").slice(0,120)});
  })()' 2>/dev/null)
  echo "[$C] $R"
  if echo "$R" | grep -qi "crypto trader\|bad night"; then
    if echo "$R" | grep -q '"n": *[1-9]'; then
      echo "HIT_WITH_VIDEO: $C"
      break
    fi
  fi
done
