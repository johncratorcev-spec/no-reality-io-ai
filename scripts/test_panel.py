#!/usr/bin/env python3
"""Тест панели добавления (Task 21): POST + поллинг статуса джобы.
Usage: test_panel.py <url> <badge> [title]"""
import json, sys, time, urllib.request

BASE = "http://localhost:3000/f0ff36544bd3574e9aac5ea4997e0d56b1526c80/add"

def post(payload):
    req = urllib.request.Request(
        BASE, data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json"}, method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())

def get_job(jid):
    with urllib.request.urlopen(f"{BASE}?job={jid}", timeout=30) as r:
        return json.loads(r.read())

def main():
    url, badge = sys.argv[1], sys.argv[2]
    title = sys.argv[3] if len(sys.argv) > 3 else ""
    res = post({"url": url, "badge": badge, "title": title})
    print("POST:", json.dumps(res, ensure_ascii=False))
    if "jobId" not in res:
        sys.exit(1)
    jid, t0 = res["jobId"], time.time()
    while time.time() - t0 < 240:
        time.sleep(2)
        st = get_job(jid)
        state = st.get("state")
        logs = st.get("log") or []
        print(f"[{int(time.time()-t0)}s] {state} | {logs[-1] if logs else '-'}")
        if state in ("done", "error"):
            print(json.dumps(st, ensure_ascii=False, indent=1))
            sys.exit(0 if state == "done" else 2)
    print("TIMEOUT")
    sys.exit(3)

if __name__ == "__main__":
    main()
