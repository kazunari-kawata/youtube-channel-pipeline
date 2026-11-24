"""声を作る前の「仮の尺」：narration.json の読み（read）の文字数から区間の長さを見積もり、timeline.json を作る

  python pipeline/estimate_timeline.py 002-dahmer

本番は tts_elevenlabs.py が実際の声の長さで timeline.json を作り直す（この見積もりは上書きされる）。
見積もりの速さは config/channel.yaml の estimate.chars_per_sec（読みの文字数／秒。読点も1文字に数える）。
"""
import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from common import build_dir, load_config, load_narration, write_json  # noqa: E402


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("episode")
    a = ap.parse_args()
    cfg = load_config(a.episode)
    t, fps = cfg["tts"], cfg["video"]["fps"]
    cps = (cfg.get("estimate") or {}).get("chars_per_sec", 6.0)
    segs = load_narration(a.episode)
    pos = t["lead"]
    out = []
    for i, s in enumerate(segs):
        if i > 0:
            pos += t["chapter_gap"] if s.get("chapter") else t["gap"]
        text = s.get("tts") or s.get("read") or s["caption"]
        dur = max(1.2, len(text) / cps)
        out.append({**s, "start": round(pos, 3), "end": round(pos + dur, 3),
                    "startFrame": int(round(pos * fps)), "endFrame": int(round((pos + dur) * fps))})
        pos += dur
    pos += t["tail"]
    d = build_dir(a.episode)
    write_json(d / "timeline.json", {"fps": fps, "totalSeconds": round(pos, 3), "totalFrames": int(round(pos * fps)),
                                     "estimated": True, "segments": out})
    print(f"仮の尺：{len(out)}区間、{pos / 60:.1f}分（{cps}文字/秒で見積もり）→ {d / 'timeline.json'}")


if __name__ == "__main__":
    main()
