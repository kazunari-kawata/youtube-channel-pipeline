"""自動化（定期実行）の状態を扱う。説明は automation/README.md、1回の実行の手順は automation/RUNNER.md

  python pipeline/auto.py status                          # 自動で進める回の一覧と、止まっている理由
  python pipeline/auto.py next                            # 次にやること（JSON）
  python pipeline/auto.py lock --run RUN                  # ロックを取って push する（取れなければ終了コード 3）
  python pipeline/auto.py unlock --run RUN                # ロックを外す（コミットは呼んだ側の最後のコミットに入れる）
  python pipeline/auto.py start EP STAGE --run RUN
  python pipeline/auto.py progress EP STAGE --note "..."  # 途中まで。次の実行が note を読んで続きから
  python pipeline/auto.py done EP STAGE [--note "..."]
  python pipeline/auto.py ask EP GATE --q "..." [--blocks STAGE]   # 人に決めてほしいこと（blocks を付けるとその工程で止まる）
  python pipeline/auto.py approve EP GATE [--answer "..."]         # 人が決めた（関門を閉じる）。GATE が review なら確認済み
  python pipeline/auto.py new EP --title "..." --series profile [--priority N]
  python pipeline/auto.py record --run RUN --summary "..." [--episode EP --stage S --credits N]
  python pipeline/auto.py save -m "auto: 009 台本 第1章" [パス ...]   # コミットして push（重なったら pull --rebase してやり直す）
  python pipeline/auto.py waiting                          # 人の確認待ち（review）の回を1行ずつ（Windows の仮編集が使う）

自動で進むのは episodes/<id>/state.yaml の mode が auto の回だけ（ない回・manual の回には触らない）。
工程は STAGES の順。review は人の確認の関門で、定期実行は先へ進めない（声・書き出し・公開は人が始める）。
"""
import argparse
import datetime as dt
import json
import subprocess
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
AUTO = ROOT / "automation"
EPISODES = ROOT / "episodes"
LOCK = AUTO / "lock.yaml"
RUNS = AUTO / "runs.jsonl"

STAGES = ["research", "materials", "fetch", "plan", "script", "visuals", "checks", "review"]
STAGE_DOC = {s: f"automation/stages/{s}.md" for s in STAGES}


def now() -> str:
    return dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def parse_time(s: str) -> dt.datetime:
    return dt.datetime.strptime(s, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=dt.timezone.utc)


def config() -> dict:
    return yaml.safe_load((AUTO / "config.yaml").read_text(encoding="utf-8"))


def state_path(ep: str) -> Path:
    return EPISODES / ep / "state.yaml"


def load_state(ep: str) -> dict:
    p = state_path(ep)
    if not p.exists():
        sys.exit(f"{p.relative_to(ROOT)} がありません（自動で進める回ではない）")
    st = yaml.safe_load(p.read_text(encoding="utf-8")) or {}
    st.setdefault("stages", {})
    st.setdefault("gates", [])
    for s in STAGES:
        st["stages"].setdefault(s, {"status": "todo"})
    return st


def save_state(ep: str, st: dict) -> None:
    head = ("# 自動化の状態（pipeline/auto.py が書く。人が直してもよい。説明は automation/README.md）\n"
            "# mode: auto＝定期実行が進める / manual＝人の会話で進める（定期実行は触らない）\n")
    body = yaml.safe_dump(st, allow_unicode=True, sort_keys=False, width=200)
    state_path(ep).write_text(head + body, encoding="utf-8")


def auto_episodes() -> list[str]:
    out = []
    for p in sorted(EPISODES.glob("*/state.yaml")):
        st = yaml.safe_load(p.read_text(encoding="utf-8")) or {}
        if st.get("mode") == "auto":
            out.append(p.parent.name)
    out.sort(key=lambda e: (load_state(e).get("priority", 99), e))
    return out


def open_gates(st: dict, stage: str | None = None) -> list[dict]:
    return [g for g in st["gates"] if g.get("status") != "closed" and (stage is None or g.get("blocks") == stage)]


def current(st: dict) -> tuple[str | None, str]:
    """(工程, 理由)。工程が None なら、この回は全部終わった"""
    for s in STAGES:
        info = st["stages"][s]
        if info.get("status") == "done":
            continue
        if s == "review":
            return s, "人の確認待ち（Studio で仮編集を見て、approve で閉じる）"
        blocking = open_gates(st, s)
        if blocking:
            return s, "人の判断待ち：" + " / ".join(g["id"] for g in blocking)
        return s, "進められる" + ("（前の実行の続き）" if info.get("status") == "doing" else "")
    return None, "自動の工程は終わり（声・書き出しは人が始める）"


def month_credits() -> int:
    if not RUNS.exists():
        return 0
    m = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m")
    total = 0
    for line in RUNS.read_text(encoding="utf-8").splitlines():
        try:
            r = json.loads(line)
        except json.JSONDecodeError:
            continue
        if str(r.get("at", "")).startswith(m):
            total += int(r.get("credits") or 0)
    return total


def cmd_status(_a) -> None:
    eps = auto_episodes()
    if not eps:
        print("自動で進める回はありません（episodes/<id>/state.yaml の mode: auto）")
    for ep in eps:
        st = load_state(ep)
        s, why = current(st)
        done = sum(1 for x in STAGES if st["stages"][x].get("status") == "done")
        print(f"{ep}  優先{st.get('priority', 99)}  {done}/{len(STAGES)}  いま：{s or '—'}  {why}")
        for g in open_gates(st):
            stop = f"（{g['blocks']} で止まる）" if g.get("blocks") else "（止めずに進め、review でまとめて確認）"
            print(f"    ? {g['id']}{stop}：{g.get('q', '')}")
    cfg = config()
    print(f"vidIQ：今月 自動で使った {month_credits()} / 上限 {cfg['vidiq']['credits_per_month']}")
    if LOCK.exists():
        print("ロック：", yaml.safe_load(LOCK.read_text(encoding="utf-8")))


def cmd_next(_a) -> None:
    cfg = config()
    left = max(0, cfg["vidiq"]["credits_per_month"] - month_credits())
    credits = min(cfg["vidiq"]["credits_per_run"], left)
    waiting, in_flight, blocked = [], [], []
    for ep in auto_episodes():
        st = load_state(ep)
        s, why = current(st)
        if s is None:
            continue
        if s == "review":
            waiting.append(ep)
            continue
        in_flight.append(ep)
        if open_gates(st, s):
            blocked.append(f"{ep}（{why}）")
            continue
        print(json.dumps({"action": "work", "episode": ep, "stage": s, "doc": STAGE_DOC[s],
                          "note": st["stages"][s].get("note", ""), "vidiq_credits": credits,
                          "open_questions": [g["id"] for g in open_gates(st)]}, ensure_ascii=False, indent=1))
        return
    if cfg.get("new_topics") and len(in_flight) < cfg["max_in_flight"] and len(waiting) < cfg["max_waiting_review"]:
        print(json.dumps({"action": "new_topic", "doc": STAGE_DOC["research"], "vidiq_credits": credits,
                          "next_id_number": next_number()}, ensure_ascii=False, indent=1))
        return
    print(json.dumps({"action": "idle", "waiting_review": waiting, "blocked": blocked,
                      "reason": "進められる工程がない（人の確認・判断待ち、または上限）"}, ensure_ascii=False, indent=1))


def next_number() -> int:
    nums = [int(p.name.split("-")[0]) for p in EPISODES.iterdir() if p.is_dir() and p.name[:3].isdigit()]
    return max(nums) + 1


def branch() -> str:
    """定期実行が push する枝（automation/config.yaml の branch。既定 main）"""
    return config().get("branch") or "main"


def git(*args: str, check: bool = True) -> subprocess.CompletedProcess:
    return subprocess.run(["git", "-c", "user.name=Claude", "-c", "user.email=noreply@anthropic.com", *args],
                          cwd=ROOT, check=check, capture_output=True, text=True)


def cmd_lock(a) -> None:
    cfg = config()
    br = branch()
    for attempt in range(2):
        git("pull", "--rebase", "-q", "origin", br, check=False)
        if LOCK.exists():
            lk = yaml.safe_load(LOCK.read_text(encoding="utf-8")) or {}
            age = (dt.datetime.now(dt.timezone.utc) - parse_time(lk["at"])).total_seconds() / 3600
            if lk.get("run") != a.run and age < cfg["lock_stale_hours"]:
                print(f"ほかの実行（{lk.get('run')}、{age:.1f}時間前）が作業中。今回は何もしない")
                sys.exit(3)
        LOCK.write_text(yaml.safe_dump({"run": a.run, "at": now()}, allow_unicode=True), encoding="utf-8")
        git("add", str(LOCK.relative_to(ROOT)))
        git("commit", "-q", "-m", f"auto: 開始 {a.run}", check=False)
        if git("push", "-q", "origin", f"HEAD:{br}", check=False).returncode == 0:
            print(f"ロックを取りました：{a.run}")
            return
        if git("log", "-1", "--format=%s", check=False).stdout.strip() == f"auto: 開始 {a.run}":
            git("reset", "-q", "--hard", "HEAD~1", check=False)  # 自分のロックのコミットだけ戻して、取り直す
    print("ロックを push できませんでした（ほかの実行と重なった可能性）。今回は何もしない")
    sys.exit(3)


def cmd_save(a) -> None:
    br = branch()
    git("add", *(a.paths or ["-A"]))
    if git("diff", "--cached", "--quiet", check=False).returncode == 0:
        print("変更なし（コミットしない）")
    else:
        git("commit", "-q", "-m", a.message)
    for attempt in range(3):
        if git("push", "-q", "origin", f"HEAD:{br}", check=False).returncode == 0:
            print(f"push しました（{br}）")
            return
        r = git("pull", "--rebase", "-q", "origin", br, check=False)
        if r.returncode != 0:
            git("rebase", "--abort", check=False)
            sys.exit("pull --rebase で衝突しました。自分の変更を確かめて直してから、もう一度 save する：\n" + r.stderr)
    sys.exit("push できませんでした（3回）。次の実行でやり直す")


def cmd_waiting(_a) -> None:
    for ep in auto_episodes():
        s, _ = current(load_state(ep))
        if s == "review":
            print(ep)


def cmd_unlock(a) -> None:
    if LOCK.exists():
        lk = yaml.safe_load(LOCK.read_text(encoding="utf-8")) or {}
        if lk.get("run") not in (a.run, None):
            sys.exit(f"ロックはほかの実行（{lk.get('run')}）のもの。外さない")
        LOCK.unlink()
    print("ロックを外しました（最後のコミットに含めて push する）")


def cmd_start(a) -> None:
    st = load_state(a.episode)
    info = st["stages"][a.stage]
    info.update({"status": "doing", "run": a.run, "started": info.get("started") or now()})
    save_state(a.episode, st)


def cmd_progress(a) -> None:
    st = load_state(a.episode)
    st["stages"][a.stage].update({"status": "doing", "note": a.note, "updated": now()})
    save_state(a.episode, st)


def cmd_done(a) -> None:
    st = load_state(a.episode)
    info = st["stages"][a.stage]
    info.update({"status": "done", "finished": now()})
    if a.note:
        info["note"] = a.note
    save_state(a.episode, st)
    s, why = current(st)
    print(f"{a.episode} {a.stage} 終わり。次：{s or '—'}（{why}）")


def cmd_ask(a) -> None:
    st = load_state(a.episode)
    for g in st["gates"]:
        if g["id"] == a.gate:
            g.update({"q": a.q, "blocks": a.blocks, "status": "open"})
            break
    else:
        st["gates"].append({"id": a.gate, "q": a.q, "blocks": a.blocks, "status": "open", "asked": now()})
    save_state(a.episode, st)


def cmd_approve(a) -> None:
    st = load_state(a.episode)
    if a.gate == "review":
        st["stages"]["review"].update({"status": "done", "finished": now(), "note": a.answer or "ユーザーが確認した"})
        st["mode"] = "manual"  # ここから先（声・書き出し・公開）は人の会話で進める
    else:
        for g in st["gates"]:
            if g["id"] == a.gate:
                g.update({"status": "closed", "answer": a.answer or "", "closed": now()})
                break
        else:
            sys.exit(f"{a.episode} に {a.gate} という質問はありません")
    save_state(a.episode, st)
    print(f"{a.episode} {a.gate} を閉じました")


def cmd_new(a) -> None:
    d = EPISODES / a.episode
    if d.exists():
        sys.exit(f"{d.relative_to(ROOT)} はもうあります")
    d.mkdir(parents=True)
    st = {"mode": "auto", "priority": a.priority, "title": a.title, "series": a.series, "created": now(),
          "stages": {s: {"status": "todo"} for s in STAGES}, "gates": []}
    save_state(a.episode, st)
    print(f"作りました：{state_path(a.episode).relative_to(ROOT)}")


def cmd_record(a) -> None:
    RUNS.parent.mkdir(exist_ok=True)
    rec = {"run": a.run, "at": now(), "episode": a.episode, "stage": a.stage, "credits": a.credits, "summary": a.summary}
    with RUNS.open("a", encoding="utf-8") as f:
        f.write(json.dumps(rec, ensure_ascii=False) + "\n")


def main() -> None:
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("status").set_defaults(f=cmd_status)
    sub.add_parser("next").set_defaults(f=cmd_next)
    sub.add_parser("waiting").set_defaults(f=cmd_waiting)
    p = sub.add_parser("save")
    p.add_argument("-m", "--message", required=True); p.add_argument("paths", nargs="*")
    p.set_defaults(f=cmd_save)
    for name, f in (("lock", cmd_lock), ("unlock", cmd_unlock)):
        p = sub.add_parser(name)
        p.add_argument("--run", required=True)
        p.set_defaults(f=f)
    p = sub.add_parser("start")
    p.add_argument("episode"); p.add_argument("stage", choices=STAGES); p.add_argument("--run", required=True)
    p.set_defaults(f=cmd_start)
    p = sub.add_parser("progress")
    p.add_argument("episode"); p.add_argument("stage", choices=STAGES); p.add_argument("--note", required=True)
    p.set_defaults(f=cmd_progress)
    p = sub.add_parser("done")
    p.add_argument("episode"); p.add_argument("stage", choices=STAGES[:-1]); p.add_argument("--note")
    p.set_defaults(f=cmd_done)
    p = sub.add_parser("ask")
    p.add_argument("episode"); p.add_argument("gate"); p.add_argument("--q", required=True)
    p.add_argument("--blocks", choices=STAGES[:-1])
    p.set_defaults(f=cmd_ask)
    p = sub.add_parser("approve")
    p.add_argument("episode"); p.add_argument("gate"); p.add_argument("--answer")
    p.set_defaults(f=cmd_approve)
    p = sub.add_parser("new")
    p.add_argument("episode"); p.add_argument("--title", required=True)
    p.add_argument("--series", required=True, help="CLAUDE.md の「シリーズ」の series（profile、bodycam、florida など）")
    p.add_argument("--priority", type=int, default=9)
    p.set_defaults(f=cmd_new)
    p = sub.add_parser("record")
    p.add_argument("--run", required=True); p.add_argument("--summary", required=True)
    p.add_argument("--episode"); p.add_argument("--stage"); p.add_argument("--credits", type=int, default=0)
    p.set_defaults(f=cmd_record)
    a = ap.parse_args()
    a.f(a)


if __name__ == "__main__":
    main()
