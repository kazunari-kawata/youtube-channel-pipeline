"""narration.json → ElevenLabs で区間ごとに音声合成 → narration.wav と timeline.json

  python pipeline/tts_elevenlabs.py 001-plains            # 生成（同じ文はキャッシュを使い、再課金しない）
  python pipeline/tts_elevenlabs.py 001-plains --only n05 # 1区間だけ作り直す（キャッシュを無視）
  python pipeline/tts_elevenlabs.py 001-plains --dry-run  # 文字数と概算費用だけ表示
  python pipeline/tts_elevenlabs.py 001-plains --max-new 4 # 新しく作るまとまりを4つまでで止める（作業用シェルの時間の上限対策。もう一度回すと続きから）

narration.json の各区間：
  caption  台本の文（概要欄や確認用。画面には出さない）
  tts      合成に渡す文（任意）。読み間違いの言い換えはここに書く。無ければ caption を使う。
           どちらも台本の文のまま渡す。数字をひらがなに直さない（F-018。ひらがなが続くと抑揚が崩れ、不自然になる）
  read     正しい読み（かな）。ASRチェックで、聞き取り結果と比べる基準

出力（episodes/<id>/build/）：
  segments/<id>.wav   区間ごとの音声（ASRチェック用）
  narration.wav       全体（48kHz, モノラル, 目標ラウドネスに調整済み）
  timeline.json       区間の開始・終了（秒とフレーム）
"""
import argparse
import base64
import hashlib
import json
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

import numpy as np
import pyloudnorm as pyln
import soundfile as sf

sys.path.insert(0, str(Path(__file__).parent))
import subprocess  # noqa: E402
import tempfile  # noqa: E402

from common import build_dir, decode_audio, ffmpeg_bin, load_config, load_narration, require_env, write_json  # noqa: E402

API = "https://api.elevenlabs.io/v1"
SR = 48000
USD_PER_1K = 0.08  # 従量課金の目安（Starter超過分 / v3・multilingual_v2）。プラン内なら追加費用なし


def tts_text(s: dict) -> str:
    """合成に渡す文。台本の文のまま（数字も漢字もそのまま。F-018）"""
    return s.get("tts") or s["caption"]


def stitching(t: dict) -> bool:
    """前後の文を渡すつなぎ（request stitching）を使うか。eleven_v3 では使えない（公式ドキュメント）"""
    return bool(t.get("stitch", True)) and not t["model_id"].startswith("eleven_v3")


def _body(text: str, t: dict, prev: str = "", nxt: str = "") -> dict:
    body = {"text": text, "model_id": t["model_id"]}
    if t.get("voice_settings"):
        body["voice_settings"] = t["voice_settings"]
    if t.get("language_code"):
        body["language_code"] = t["language_code"]
    if t.get("seed") is not None:
        body["seed"] = int(t["seed"])
    if stitching(t):
        if prev:
            body["previous_text"] = prev
        if nxt:
            body["next_text"] = nxt
    return body


def _post(path: str, body: dict, key: str, accept: str) -> bytes:
    url = f"{API}{path}"
    data = json.dumps(body).encode("utf-8")
    for attempt in range(5):
        req = urllib.request.Request(url, data=data, method="POST",
                                     headers={"xi-api-key": key, "Content-Type": "application/json", "Accept": accept})
        try:
            with urllib.request.urlopen(req, timeout=300) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            msg = e.read().decode("utf-8", errors="replace")[:500]
            if e.code in (429, 500, 502, 503, 504) and attempt < 4:
                time.sleep(4 * (attempt + 1))
                continue
            sys.exit(f"ElevenLabs API エラー {e.code}: {msg}")
        except urllib.error.URLError:
            if attempt < 4:
                time.sleep(4 * (attempt + 1))
                continue
            raise
    sys.exit("ElevenLabs API に接続できませんでした")


def request_audio(text: str, t: dict, key: str, prev: str, nxt: str) -> bytes:
    fmt = t.get("output_format", "mp3_44100_128")
    return _post(f"/text-to-speech/{t['voice_id']}?output_format={fmt}", _body(text, t, prev, nxt), key, "audio/mpeg")


def request_with_timestamps(text: str, t: dict, key: str) -> dict:
    """音声と、文字ごとの読まれた時刻（alignment）を返す"""
    fmt = t.get("output_format", "mp3_44100_128")
    raw = _post(f"/text-to-speech/{t['voice_id']}/with-timestamps?output_format={fmt}", _body(text, t), key, "application/json")
    return json.loads(raw)


def level_segments(segs_audio: list[np.ndarray], max_gain_db: float = 6.0) -> list[np.ndarray]:
    """区間ごとの音量のばらつきをそろえる（ElevenLabs は区間によって数dB違う）。中央値に合わせ、±max_gain_db まで"""
    meter = pyln.Meter(SR)
    louds = [meter.integrated_loudness(a) if len(a) > SR // 2 else float("nan") for a in segs_audio]
    ok = [x for x in louds if np.isfinite(x)]
    if not ok:
        return segs_audio
    ref = float(np.median(ok))
    out = []
    for a, l in zip(segs_audio, louds):
        g = 0.0 if not np.isfinite(l) else float(np.clip(ref - l, -max_gain_db, max_gain_db))
        out.append((a * 10 ** (g / 20)).astype(np.float32))
    return out


def limit_peaks(wav: np.ndarray, ceiling: float = 0.89) -> np.ndarray:
    """口の音や破裂音の一瞬のピークだけを抑える（ffmpeg の alimiter）。これが無いと、ピークに合わせて全体が小さくなる"""
    with tempfile.TemporaryDirectory() as d:
        src, dst = Path(d) / "in.wav", Path(d) / "out.wav"
        sf.write(src, wav.astype(np.float32), SR, subtype="FLOAT")
        subprocess.run([ffmpeg_bin(), "-v", "error", "-y", "-i", str(src), "-af",
                        f"alimiter=limit={ceiling}:attack=2:release=50:level=disabled", "-ar", str(SR), str(dst)], check=True)
        out, _ = sf.read(dst, dtype="float32")
    return out[: len(wav)] if len(out) >= len(wav) else np.pad(out, (0, len(wav) - len(out)))


def trim(a: np.ndarray, db: float, pad: float = 0.05) -> np.ndarray:
    """頭と末尾の無音を切りそろえる（区切りの間を設定どおりにするため）"""
    win = int(0.01 * SR)
    n = len(a) // win
    if n == 0:
        return a
    rms = np.sqrt((a[: n * win].reshape(n, win) ** 2).mean(axis=1) + 1e-12)
    on = np.where(20 * np.log10(rms) > db)[0]
    if len(on) == 0:
        return a
    s = max(0, on[0] * win - int(pad * SR))
    e = min(len(a), (on[-1] + 1) * win + int(pad * SR))
    return a[s:e]


def build_segmentwise(segs, t, fps, key, cache, seg_dir, only):
    """区間ごとに生成し、前後の文を渡してつなぐ（multilingual_v2 など、つなぎが使えるモデル）"""
    pieces = [np.zeros(int(t["lead"] * SR), np.float32)]
    pos = t["lead"]
    timeline, billed = [], 0
    for i, s in enumerate(segs):
        if i > 0:
            g = t["chapter_gap"] if s.get("chapter") else t["gap"]
            pieces.append(np.zeros(int(g * SR), np.float32))
            pos += g
        text = tts_text(s)
        # つなぎを使わないときは前後の文をキャッシュの鍵に入れない（1区間を直しても、隣の区間を作り直さずに済む）
        prev = tts_text(segs[i - 1]) if i > 0 and stitching(t) else ""
        nxt = tts_text(segs[i + 1]) if i + 1 < len(segs) and stitching(t) else ""
        sig = json.dumps([text, prev, nxt, t["voice_id"], t["model_id"], t.get("voice_settings"), t.get("seed"),
                          t.get("language_code"), t.get("stitch", True)], ensure_ascii=False, sort_keys=True)
        h = hashlib.sha1(sig.encode("utf-8")).hexdigest()[:16]
        mp3 = cache / f"{s['id']}_{h}.mp3"
        if s["id"] in only or not mp3.exists():
            mp3.write_bytes(request_audio(text, t, key, prev, nxt))
            billed += len(text)
            tag = "生成"
        else:
            tag = "キャッシュ"
        a = trim(decode_audio(mp3, SR), t["trim_silence_db"])
        sf.write(seg_dir / f"{s['id']}.wav", a, SR)
        dur = len(a) / SR
        pieces.append(a)
        timeline.append({**s, "start": round(pos, 3), "end": round(pos + dur, 3),
                         "startFrame": int(round(pos * fps)), "endFrame": int(round((pos + dur) * fps))})
        print(f"{s['id']} {dur:5.2f}s [{tag}] {s['caption'][:28]}")
        pos += dur
    pieces.append(np.zeros(int(t["tail"] * SR), np.float32))
    pos += t["tail"]

    # 区間の音量をそろえる（無音の間は pieces の偶数番目、声は奇数番目）
    voiced = [i for i in range(1, len(pieces) - 1) if i % 2 == 1]
    leveled = level_segments([pieces[i] for i in voiced])
    for i, a in zip(voiced, leveled):
        pieces[i] = a
    return pieces, timeline, billed


# ---------- まとめて生成（eleven_v3 など、前後の文を渡すつなぎが使えないモデル。F-019） ----------
# v3 は1回の生成の終わりで、音が鳴っている途中で打ち切る（語尾の「す」が「スッ」と切れる）。
# そこで、章（長ければ途中の区間の切れ目）ごとに1回で読ませ、うしろに「次の文」を1つ足しておき、
# 文字ごとの時刻（alignment）で足した文の手前の無音を探して切る。区間の境目も同じ無音から求める。
TAIL_LAST = "それでは、また次の動画でお会いしましょう。"  # 最後のまとまりに足す文（切り捨てるので聞こえない）
QUIET_DB = (-50, -45, -40)  # 無音とみなす音量（見つからなければ順にゆるめる）
VOICE_DB = -45              # 声の始まり・終わりとみなす音量


def plan_chunks(segs, limit):
    """章の始まりで分け、limit 字を超える章は区間の切れ目で分ける"""
    chunks, cur, n = [], [], 0
    for s in segs:
        m = len(tts_text(s))
        if cur and (s.get("chapter") or n + m > limit):
            chunks.append(cur)
            cur, n = [], 0
        cur.append(s)
        n += m
    chunks.append(cur)
    return chunks


def _align_index(text: str, chars: list[str]):
    """台本の文字の位置 → alignment の文字の位置（ふつうは同じ。違えば近い位置に寄せる）"""
    al = "".join(chars)
    if al == text:
        return lambda i: i
    import difflib
    sm = difflib.SequenceMatcher(None, text, al, autojunk=False)
    pairs = [(b.a + k, b.b + k) for b in sm.get_matching_blocks() for k in range(b.size)]
    def f(i):
        best = min(pairs, key=lambda p: abs(p[0] - i)) if pairs else (i, i)
        return max(0, min(len(chars) - 1, best[1] + (i - best[0])))
    return f


def _env_db(a: np.ndarray) -> np.ndarray:
    w = int(0.01 * SR)
    n = len(a) // w
    return 20 * np.log10(np.sqrt((a[: n * w].reshape(n, w) ** 2).mean(axis=1)) + 1e-9)


def _quiet_point(env, t0, t1) -> float:
    """t0〜t1 秒の中で、いちばん長く続く無音のまん中（秒）"""
    lo, hi = max(0, int(t0 * 100)), min(len(env), int(t1 * 100))
    for th in QUIET_DB:
        runs, cur = [], []
        for i in range(lo, hi):
            if env[i] < th:
                if cur and i != cur[-1] + 1:
                    runs.append(cur)
                    cur = []
                cur.append(i)
        if cur:
            runs.append(cur)
        if runs:
            r = max(runs, key=len)
            return (r[0] + len(r) / 2) / 100
    return (lo + int(np.argmin(env[lo:hi]))) / 100 if hi > lo else t0


def _onset(env, t0, t1) -> float:
    lo, hi = int(t0 * 100), min(len(env), int(t1 * 100))
    on = [i for i in range(lo, hi) if env[i] >= VOICE_DB]
    return max(t0, on[0] / 100 - 0.04) if on else t0


def _offset(env, t0, t1) -> float:
    lo, hi = int(t0 * 100), min(len(env), int(t1 * 100))
    on = [i for i in range(lo, hi) if env[i] >= VOICE_DB]
    return min(t1, (on[-1] + 1) / 100 + 0.06) if on else t1


def chunk_paths(chunk, tail, t, cache):
    """まとまりのキャッシュの置き場所（文・足す文・声の設定が同じなら同じ名前）"""
    texts = [tts_text(s) for s in chunk]
    sig = json.dumps([texts, tail, t["voice_id"], t["model_id"], t.get("voice_settings"), t.get("seed"),
                      t.get("language_code"), "chunk-v1"], ensure_ascii=False, sort_keys=True)
    h = hashlib.sha1(sig.encode("utf-8")).hexdigest()[:16]
    return cache / f"chunk_{chunk[0]['id']}_{h}.mp3", cache / f"chunk_{chunk[0]['id']}_{h}.json", h


def gen_chunk(chunk, tail, t, key, cache, force):
    """まとまり1つを生成（キャッシュあり）。返り値：音声、区間ごとの（声の始まり, 終わり）秒、課金文字数"""
    texts = [tts_text(s) for s in chunk]
    full = "".join(texts) + tail
    mp3, js, h = chunk_paths(chunk, tail, t, cache)
    billed = 0
    if force or not (mp3.exists() and js.exists()):
        r = request_with_timestamps(full, t, key)
        mp3.write_bytes(base64.b64decode(r["audio_base64"]))
        js.write_text(json.dumps({"text": full, "alignment": r.get("alignment")}, ensure_ascii=False), encoding="utf-8")
        billed = len(full)
    a = decode_audio(mp3, SR)
    al = json.loads(js.read_text(encoding="utf-8"))["alignment"]
    idx = _align_index(full, al["characters"])
    st = al["character_start_times_seconds"]
    env = _env_db(a)
    # 区間 j の始まりの文字の時刻（最後は足した文の始まり）
    heads, p = [], 0
    for x in texts:
        heads.append(p)
        p += len(x)
    heads.append(p)
    cuts = [0.0] + [_quiet_point(env, st[idx(hp)] - 0.8, st[idx(hp)] + 0.3) for hp in heads[1:]]
    spans = []
    for j in range(len(texts)):
        s0 = _onset(env, cuts[j], cuts[j + 1])
        spans.append((s0, max(s0 + 0.1, _offset(env, s0, cuts[j + 1]))))
    return a, spans, cuts[-1], billed, h


def build_chunked(segs, t, fps, key, cache, seg_dir, only, max_new=None):
    chunks = plan_chunks(segs, int(t.get("max_chunk_chars", 450)))
    pieces = [np.zeros(int(t["lead"] * SR), np.float32)]
    pos = t["lead"]
    timeline, billed, audios, metas = [], 0, [], []
    new = 0
    for k, ch in enumerate(chunks):
        tail = tts_text(chunks[k + 1][0]) if k + 1 < len(chunks) else TAIL_LAST
        force = any(s["id"] in only for s in ch)
        mp3, js, _ = chunk_paths(ch, tail, t, cache)
        if force or not (mp3.exists() and js.exists()):
            # 1回の実行で新しく作るまとまりの数を区切る（作業用シェルの時間の上限で、生成の途中で止められると、
            # 課金されたのに音声が残らない。区切って何回かに分けて回し、作ったまとまりはキャッシュから使う）
            if max_new is not None and new >= max_new:
                left = sum(1 for j in range(k, len(chunks)))
                print(f"ここで止めます（新しく作ったまとまり {new}、残り {left}）。もう一度同じコマンドを回すと続きから作ります（作ったまとまりは再課金なし）")
                sys.exit(3)
            new += 1
        a, spans, cut, b, h = gen_chunk(ch, tail, t, key, cache, force)
        billed += b
        # 残すのは最初の声の始まりから、最後の声の終わり＋0.12秒（足した文の手前の無音まで）
        s_keep = spans[0][0]
        e_keep = min(cut, spans[-1][1] + 0.12)
        x = a[int(s_keep * SR): int(e_keep * SR)].copy()
        fi, fo = int(0.005 * SR), int(0.08 * SR)
        x[:fi] *= np.linspace(0, 1, fi, dtype=np.float32)
        x[-fo:] *= np.linspace(1, 0, fo, dtype=np.float32) ** 2
        audios.append(x)
        metas.append((ch, spans, s_keep))
        print(f"まとまり {k + 1}/{len(chunks)}（{ch[0]['id']}〜{ch[-1]['id']}、{sum(len(tts_text(s)) for s in ch)}字）"
              f" {'生成' if b else 'キャッシュ'} {len(x) / SR:.1f}秒")
    audios = level_segments(audios)
    for k, (x, (ch, spans, s_keep)) in enumerate(zip(audios, metas)):
        if k > 0:
            g = t["chapter_gap"] if ch[0].get("chapter") else t["gap"]
            pieces.append(np.zeros(int(g * SR), np.float32))
            pos += g
        for s, (s0, s1) in zip(ch, spans):
            a0, a1 = pos + s0 - s_keep, pos + s1 - s_keep
            sf.write(seg_dir / f"{s['id']}.wav", x[int((s0 - s_keep) * SR): int((s1 - s_keep) * SR)], SR)
            timeline.append({**s, "start": round(a0, 3), "end": round(a1, 3),
                             "startFrame": int(round(a0 * fps)), "endFrame": int(round(a1 * fps))})
        pieces.append(x)
        pos += len(x) / SR
    pieces.append(np.zeros(int(t["tail"] * SR), np.float32))
    return pieces, timeline, billed


def ambiguous_hits(segs: list[dict], table: dict) -> list[str]:
    """読みが2通りある語が、読みの指定（tts）のない区間の文にあるか（F-056）"""
    out = []
    for s in segs:
        if s.get("tts"):
            continue
        for w, r in (table or {}).items():
            if w in s["caption"]:
                out.append(f"{s['id']}「{w}」（{r}）：{s['caption'][:40]}")
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("episode")
    ap.add_argument("--only", help="作り直す区間ID（カンマ区切り）。キャッシュを使わない")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--readings-checked", action="store_true",
                    help="読みが2通りある語（config の tts.ambiguous_readings）を確かめ、台本どおりでよいと決めた（F-056）")
    ap.add_argument("--max-new", type=int, help="1回の実行で新しく作るまとまりの数の上限（まとめて生成のとき）。超えたら止まり、もう一度回すと続きから")
    args = ap.parse_args()

    cfg = load_config(args.episode)
    t, fps = cfg["tts"], cfg["video"]["fps"]
    segs = load_narration(args.episode)
    chars = sum(len(tts_text(s)) for s in segs)
    if not stitching(t):  # まとめて生成：足す「次の文」の分も課金される
        chunks = plan_chunks(segs, int(t.get("max_chunk_chars", 450)))
        chars += sum(len(tts_text(chunks[k + 1][0])) if k + 1 < len(chunks) else len(TAIL_LAST) for k in range(len(chunks)))
        print(f"まとめて生成：{len(chunks)}まとまり（章ごと、{t.get('max_chunk_chars', 450)}字まで）")
    print(f"{len(segs)}区間 / {chars}文字（全区間を新規生成した場合の概算 ${chars / 1000 * USD_PER_1K:.2f}）")
    amb = ambiguous_hits(segs, t.get("ambiguous_readings"))
    if amb:
        print(f"読みが2通りある語 {len(amb)}か所（読みの指定 tts のない区間。F-056）:")
        for a in amb:
            print("  " + a)
    if args.dry_run:
        return
    if amb and not args.readings_checked and not args.only:
        sys.exit("読みが2通りある語を確かめてから作ってください。読みを決めたら、その区間の tts にひらがなで書く。"
                 "台本どおりでよければ --readings-checked を付ける（F-056）")
    if not t.get("voice_id"):
        sys.exit("config/channel.yaml の tts.voice_id が未設定です。tts_voice_samples.py で声を決めてください。")
    key = require_env("ELEVENLABS_API_KEY")

    out = build_dir(args.episode)
    cache = out / "tts_cache"
    seg_dir = out / "segments"
    cache.mkdir(exist_ok=True)
    seg_dir.mkdir(exist_ok=True)
    only = set(args.only.split(",")) if args.only else set()

    if stitching(t):
        pieces, timeline, billed = build_segmentwise(segs, t, fps, key, cache, seg_dir, only)
    else:
        pieces, timeline, billed = build_chunked(segs, t, fps, key, cache, seg_dir, only, args.max_new)
    pos = sum(len(x) for x in pieces) / SR
    wav = np.concatenate(pieces)
    meter = pyln.Meter(SR)
    speech = np.concatenate(pieces[1:-1])
    gain = 10 ** ((cfg["audio"]["narration_lufs"] - meter.integrated_loudness(speech)) / 20)
    wav = limit_peaks(wav * gain)
    after = meter.integrated_loudness(wav[int(t["lead"] * SR): len(wav) - int(t["tail"] * SR)])
    print(f"ナレーションの音量 {after:.1f} LUFS（目標 {cfg['audio']['narration_lufs']}）、ピーク {20 * np.log10(np.abs(wav).max() + 1e-9):.1f} dBFS")
    sf.write(out / "narration.wav", wav.astype(np.float32), SR, subtype="PCM_16")
    write_json(out / "timeline.json", {"fps": fps, "totalSeconds": round(pos, 3),
                                       "totalFrames": int(np.ceil(pos * fps)), "segments": timeline})
    print(f"合計 {pos:.1f}秒 / 今回課金された文字数 {billed}（概算 ${billed / 1000 * USD_PER_1K:.2f}）")
    show_quota(key)


def show_quota(key: str) -> None:
    try:
        req = urllib.request.Request(f"{API}/user/subscription", headers={"xi-api-key": key})
        with urllib.request.urlopen(req, timeout=30) as r:
            sub = json.loads(r.read())
        print(f"今月の使用量: {sub.get('character_count')} / {sub.get('character_limit')} クレジット（プラン {sub.get('tier')}）")
    except Exception:
        pass


if __name__ == "__main__":
    main()
