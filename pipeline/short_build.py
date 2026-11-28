"""ショート動画の声・BGM・効果音と、画面と字幕の時刻を作る（CLAUDE.md「ショート動画」、F-058）

  python pipeline/short_build.py 002-dahmer a

入力：episodes/<回>/shorts/<名前>.json（使う区間・絵・字幕の区切り）、build/segments/<区間>.wav（本編の声）、
      build/tts_cache/chunk_*.json と .mp3（声を作ったときの文字ごとの時刻）、assets/bgm・assets/sfx
出力：remotion/public/shorts/<回の番号><名前>/audio.wav（声・BGM・効果音を混ぜて -1dBFS のリミッター）、
      remotion/public/shorts/<回の番号><名前>/data.json（Remotion の Short が読む。本編の current.json とは別なので Studio の Main は変わらない）
書き出し：cd remotion && npx remotion render src/index.ts Short out.mp4 --props='{"id":"002a"}' --scale=1.5

台本で使える指定（F-059。002 のショートAは「視聴された」20.2%で、最初の1秒で離れられていた）：
  speed      声の速さ（1.2 なら1.2倍。高さは変えない。ffmpeg の atempo）
  max_pause  区間の中の声の切れ目（読点の間など）を、この秒数まで詰める
  hook       最初の区間のあいだ、画面に大きく出す一言（{"tag", "lines", "hl"}）。0秒から出し、動く絵の上に重ねる
  thumb      止まったサムネイルを最初に出すときだけ書く（hook と同時には使わない）
  max_shot_sec  1つの絵の長さの上限（既定3秒。F-062。QA が検査）
区間ごと：skip（文頭の数文字を落とす。例 "中の"）、cut（1つ、またはリスト）、captions_off、visual "same"（前の区間の絵を続ける）、
          notes（字幕の上に小さく足す説明。{"20万ドル": "今の価値で約2.6億円"} のように、字幕の区切りに含まれる語で引く）
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

import numpy as np
import pyloudnorm as pyln
import soundfile as sf

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import PUBLIC, ROOT, build_dir, decode_audio, episode_dir, ffmpeg_bin, load_config  # noqa: E402

SR = 48000
FPS = 30
XF = 8  # Short.tsx のカットの切り替え（クロスフェード）のフレーム数
SFX_REF_DB = -18.0  # stage.py と同じ（fetch_sfx.py がそろえた効果音の音量）
PUNCT = re.compile(r"[、。,.・「」『』（）()\s　]")


def strip(s: str) -> str:
    return PUNCT.sub("", s)


def speech_bounds(a: np.ndarray, thr_db: float = -45.0) -> tuple[int, int]:
    """10ms ごとの RMS で、声のある最初と最後のサンプル"""
    w = SR // 100
    n = len(a) // w
    rms = np.sqrt(np.mean(a[: n * w].reshape(n, w) ** 2, axis=1) + 1e-12)
    on = np.nonzero(20 * np.log10(rms) > thr_db)[0]
    return int(on[0] * w), int((on[-1] + 1) * w)


def find_offset(seg: np.ndarray, chunk: np.ndarray) -> float:
    """区間の声が、章ごとに作った声のどこから切り出されたか（秒）。相互相関で探す"""
    probe = seg[: min(len(seg), 3 * SR)]
    n = 1 << int(np.ceil(np.log2(len(chunk) + len(probe))))
    cc = np.fft.irfft(np.fft.rfft(chunk, n) * np.conj(np.fft.rfft(probe, n)), n)[: len(chunk)]
    return float(np.argmax(cc)) / SR


def load_alignment(build: Path) -> list[dict]:
    out = []
    for js in sorted((build / "tts_cache").glob("chunk_*.json")):
        d = json.loads(js.read_text(encoding="utf-8"))
        mp3 = js.with_suffix(".mp3")
        if not mp3.exists() or not d.get("alignment"):
            continue
        out.append({"text": d["text"], "al": d["alignment"], "audio": decode_audio(mp3, SR)})
    if not out:
        sys.exit("build/tts_cache に文字ごとの時刻（chunk_*.json と .mp3）がありません")
    return out


def char_times(caption: str, seg_audio: np.ndarray, chunks: list[dict]) -> tuple[list[float], list[float]]:
    """区間の台本の1文字ごとの、区間の音声の中での開始・終了の時刻（秒）"""
    for c in chunks:
        i = c["text"].find(caption)
        if i < 0:
            continue
        off = find_offset(seg_audio, c["audio"])
        st = c["al"]["character_start_times_seconds"][i : i + len(caption)]
        en = c["al"]["character_end_times_seconds"][i : i + len(caption)]
        if len(st) == len(caption):
            return [t - off for t in st], [t - off for t in en]
    sys.exit(f"文字ごとの時刻が見つかりません：{caption[:20]}…")


def voiced_runs(a: np.ndarray, thr_db: float = -42.0, min_gap: float = 0.09) -> list[tuple[float, float]]:
    """声のある区間（秒）。min_gap 未満の切れ目はつなぐ"""
    w = SR // 100
    n = len(a) // w
    db = 20 * np.log10(np.sqrt(np.mean(a[: n * w].reshape(n, w) ** 2, axis=1) + 1e-12))
    on = db > thr_db
    runs, i = [], 0
    while i < n:
        if on[i]:
            j = i
            while j < n and on[j]:
                j += 1
            runs.append([i / 100, j / 100])
            i = j
        else:
            i += 1
    merged = []
    for r in runs:
        if merged and r[0] - merged[-1][1] < min_gap:
            merged[-1][1] = r[1]
        else:
            merged.append(r)
    return [tuple(r) for r in merged]


def fix_times(caption: str, a: np.ndarray, st: list[float], en: list[float]) -> list[float]:
    """文字ごとの時刻（v3 の alignment）は1秒近くずれることがある（002 の s007 は 0.75秒早かった）。
    句読点の所は実際の声の切れ目に合わせ、句読点の間は alignment の比率で割り振る"""
    runs = voiced_runs(a)
    s0, s1 = runs[0][0], runs[-1][1]
    a0, a1 = st[0], en[len(caption) - 1 - (1 if caption.endswith("。") else 0)]
    lin = lambda t: s0 + (t - a0) / max(1e-6, a1 - a0) * (s1 - s0)  # noqa: E731
    gaps = [(runs[k][1], runs[k + 1][0]) for k in range(len(runs) - 1)]
    # 句読点ごとに、予想した時刻にいちばん近い切れ目（0.6秒以内）へ寄せる
    anchors = [(0, s0)]
    used = set()
    for k, ch in enumerate(caption):
        if PUNCT.match(ch) and k + 1 < len(caption) and not PUNCT.match(caption[k + 1]):
            guess = lin(st[k + 1])
            best = None
            for gi, (g0, g1) in enumerate(gaps):
                if gi in used:
                    continue
                d = abs(g1 - guess)
                if d < 0.6 and (best is None or d < best[0]):
                    best = (d, gi, g1)
            if best:
                used.add(best[1])
                anchors.append((k + 1, best[2]))
    anchors.append((len(caption), s1))
    out = [0.0] * len(caption)
    for (i0, t0), (i1, t1) in zip(anchors, anchors[1:]):
        b0, b1 = st[i0], (st[i1] if i1 < len(caption) else en[-1])
        for k in range(i0, i1):
            out[k] = t0 + (st[k] - b0) / max(1e-6, b1 - b0) * (t1 - t0)
    return out


def tighten(clip: np.ndarray, max_pause: float | None) -> tuple[np.ndarray, list[tuple[float, float]]]:
    """区間の中の声の切れ目（読点の間など）を max_pause 秒まで詰める。
    返り値：詰めた声と、元の時刻→新しい時刻の対応（折れ線の点の列）"""
    n = len(clip) / SR
    if not max_pause:
        return clip, [(0.0, 0.0), (n, n)]
    runs = voiced_runs(clip)
    keep = []  # 残す区間（秒）
    for k, (r0, r1) in enumerate(runs):
        s0 = 0.0 if k == 0 else r0 - max_pause / 2
        s1 = n if k == len(runs) - 1 else r1 + max_pause / 2
        if keep and s0 <= keep[-1][1]:
            keep[-1][1] = max(keep[-1][1], s1)
        else:
            keep.append([max(0.0, s0), min(n, s1)])
    out, pts, t = [], [], 0.0
    xf = int(0.012 * SR)
    for s0, s1 in keep:
        seg = clip[int(s0 * SR) : int(s1 * SR)].copy()
        if out and len(seg) > 2 * xf:
            seg[:xf] *= np.linspace(0, 1, xf, dtype=np.float32)
            out[-1][-xf:] *= np.linspace(1, 0, xf, dtype=np.float32)
        pts += [(s0, t), (s1, t + (s1 - s0))]
        t += s1 - s0
        out.append(seg)
    return np.concatenate(out), pts


def stretch(clip: np.ndarray, speed: float) -> np.ndarray:
    """高さを変えずに速さだけ変える（ffmpeg の atempo）"""
    if abs(speed - 1.0) < 1e-3:
        return clip
    r = subprocess.run([ffmpeg_bin(), "-v", "error", "-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", "pipe:0",
                        "-af", f"atempo={speed}", "-f", "f32le", "-ar", str(SR), "-ac", "1", "pipe:1"],
                       input=clip.astype(np.float32).tobytes(), capture_output=True, check=True)
    return np.frombuffer(r.stdout, np.float32).copy()


def remap(t: float, pts: list[tuple[float, float]], ratio: float) -> float:
    """元の時刻 t（秒）を、間を詰めて速さを変えたあとの時刻に直す"""
    xs, ys = [p[0] for p in pts], [p[1] for p in pts]
    return float(np.interp(t, xs, ys)) * ratio


_WHISPER = None


def asr_times(caption: str, a: np.ndarray, rough: list[float]) -> list[float]:
    """字幕の切り替えは、実際の声を音声認識（faster-whisper、単語ごとの時刻）で聞き取った時刻に合わせる。
    台本の文字と聞き取った文字を突き合わせ、合った文字は聞き取りの時刻、合わない文字は rough（fix_times）を前後の差で補う。
    faster-whisper が無ければ rough をそのまま返す"""
    global _WHISPER
    try:
        from difflib import SequenceMatcher

        from faster_whisper import WhisperModel
        from scipy.signal import resample_poly
    except ImportError:
        return rough
    if _WHISPER is None:
        _WHISPER = WhisperModel("small", device="cpu", compute_type="int8")
    segs, _ = _WHISPER.transcribe(resample_poly(a, 1, 3).astype(np.float32), language="ja", word_timestamps=True)
    chars, times = [], []
    for sg in segs:
        for w in sg.words:
            txt = strip(w.word)
            for k, ch in enumerate(txt):
                chars.append(ch)
                times.append(w.start + (w.end - w.start) * k / max(1, len(txt)))
    idx = [k for k, ch in enumerate(caption) if not PUNCT.match(ch)]
    flat = "".join(caption[k] for k in idx)
    out = list(rough)
    hit = {}
    for m in SequenceMatcher(None, flat, "".join(chars), autojunk=False).get_matching_blocks():
        for d in range(m.size):
            hit[m.a + d] = times[m.b + d]
    onset = voiced_runs(a)[0][0]
    for j, k in enumerate(idx):
        if j in hit:
            out[k] = max(onset, hit[j])
        else:
            # 聞き取れなかった文字（「逮捕」→「台北」など）：近くの合った文字との差を rough に足す
            near = min(hit, key=lambda q: abs(q - j), default=None)
            if near is not None:
                out[k] = max(onset, rough[k] + (hit[near] - rough[idx[near]]))
    return out


def chunk_starts(caption: str, parts: list[str], start: int = 0) -> list[int]:
    """字幕の区切り（句読点なし）が、台本の何文字目から始まるか（start：skip で落とした文字数）"""
    idx = [k for k, ch in enumerate(caption) if not PUNCT.match(ch) and k >= start]
    flat = "".join(caption[k] for k in idx)
    joined = "".join(strip(p) for p in parts)
    if not flat.startswith(joined):
        sys.exit(f"字幕の区切りが台本と合いません：\n  台本 {flat}\n  字幕 {joined}")
    res, pos = [], 0
    for p in parts:
        res.append(idx[pos])
        pos += len(strip(p))
    return res


def bgm_bed(track: Path, seconds: float, lufs: float) -> np.ndarray:
    a = decode_audio(track, SR, 2)
    a = a * 10 ** ((lufs - pyln.Meter(SR).integrated_loudness(a)) / 20)
    need = int(seconds * SR)
    while len(a) < need:
        a = np.concatenate([a, a])
    return a[:need].astype(np.float32)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("episode")
    ap.add_argument("name")
    args = ap.parse_args()
    cfg = load_config(args.episode)
    epd = episode_dir(args.episode)
    build = build_dir(args.episode)
    spec = json.loads((epd / "shorts" / f"{args.name}.json").read_text(encoding="utf-8"))
    narr = {s["id"]: s for s in json.loads((epd / "narration.json").read_text(encoding="utf-8"))}
    sid = args.episode.split("-")[0] + args.name
    chunks = load_alignment(build)
    gap, lead = spec.get("gap_sec", 0.18), spec.get("lead_sec", 0.2)
    speed, max_pause = spec.get("speed", 1.0), spec.get("max_pause")

    # 1) 声：区間ごとに声のある所だけを取り、間を詰めてつなぐ
    pieces, segs, t = [], [], 0.0
    for i, s in enumerate(spec["segments"]):
        cap = narr[s["id"]]["caption"]
        a = sf.read(build / "segments" / f"{s['id']}.wav", dtype="float32")[0]
        if a.ndim > 1:
            a = a.mean(axis=1)
        st, en = char_times(cap, a, chunks)
        b0, b1 = speech_bounds(a)
        ct = asr_times(cap, a, fix_times(cap, a, st, en))
        if s.get("sentences"):
            # 頭から n 文だけ使う（「。」の手前の文字が読み終わる所 ＋ 少しの余韻で切る）
            ends = [k for k, ch in enumerate(cap) if ch == "。"]
            k = ends[s["sentences"] - 1]
            nxt = [g for g in voiced_runs(a) if g[0] >= ct[k + 1] - 0.05]
            prev = [g for g in voiced_runs(a) if g[1] <= ct[k + 1] + 0.05]
            b1 = min(b1, int((prev[-1][1] if prev else ct[k + 1]) * SR))
        k0 = 0
        if s.get("skip"):
            # 文頭の数文字（例「中の」）を落とす。落とした次の文字の声が始まる少し手前から使う
            if not cap.startswith(s["skip"]):
                sys.exit(f"{s['id']} の skip「{s['skip']}」が台本の文頭と合いません")
            k0 = len(s["skip"])
            b0 = max(b0, int((ct[k0] - 0.03) * SR))
        a0, a1 = max(0, b0 - int(0.04 * SR)), min(len(a), b1 + int(0.12 * SR))
        clip = a[a0:a1].copy()
        fade = int(0.015 * SR)
        clip[:fade] *= np.linspace(0, 1, fade, dtype=np.float32)
        clip[-fade:] *= np.linspace(1, 0, fade, dtype=np.float32)
        # 区間の中の間を詰め、速さを変える（字幕の時刻も同じだけ動かす）
        tight, pts = tighten(clip, max_pause)
        fast = stretch(tight, speed)
        ratio = len(fast) / max(1, len(tight))
        pieces.append((t, fast))
        tstart = t
        dur = len(fast) / SR
        # 字幕の時刻
        caps = []
        starts = chunk_starts(cap, s["captions"], k0)
        for j, (txt, ci) in enumerate(zip(s["captions"], starts)):
            c0 = tstart + remap(ct[ci] - a0 / SR, pts, ratio)
            c1 = tstart + (remap(ct[starts[j + 1]] - a0 / SR, pts, ratio) if j + 1 < len(starts) else dur)
            caps.append({"from": max(0, int(round(c0 * FPS))), "to": int(round(c1 * FPS)), "text": txt,
                         "hl": [h for h in s.get("hl", []) if h in txt]})
        # 字幕の上に小さく足す説明（例：「20万ドル」に「今の価値で約2.6億円」）。その語が出た字幕から、区間の終わりまで出したままにする
        # （語の字幕だけに付けると0.7秒で消え、読めなかった）
        for key, note in s.get("notes", {}).items():
            hit = next((j for j, c in enumerate(caps) if key in c["text"]), None)
            for c in caps[hit:] if hit is not None else []:
                c["note"] = note
        segs.append({"id": s["id"], "t0": tstart, "t1": tstart + dur, "spec": s, "caps": caps})
        t = tstart + dur + gap
    speech_end = segs[-1]["t1"]
    end_from = speech_end + 0.3
    total = end_from + spec["end"]["sec"]
    n_total = int(round(total * FPS))

    # 2) 画面：区間の頭（少し前）で替え、cut.at（声の長さに対する割合）で途中で替える。1フレーム目からはサムネイル
    thumb_f = int(round((spec.get("thumb") or {}).get("sec", 0) * FPS))
    shots = []
    for k, g in enumerate(segs):
        s = g["spec"]
        f0 = thumb_f if k == 0 else int(round((g["t0"] - lead) * FPS))
        f_end = int(round((segs[k + 1]["t0"] - lead) * FPS)) if k + 1 < len(segs) else int(round(end_from * FPS))
        raw = s.get("cut")
        cuts = sorted(raw if isinstance(raw, list) else ([raw] if raw else []), key=lambda c: c["at"])
        bounds = [f0] + [int(round((g["t0"] + c["at"] * (g["t1"] - g["t0"])) * FPS)) for c in cuts] + [f_end]
        vis = [(s["visual"], s.get("sfx", []))] + [(c["visual"], c.get("sfx", [])) for c in cuts]
        for i_, ((v, sx), b0_, b1_) in enumerate(zip(vis, bounds, bounds[1:])):
            if i_ == 0 and v == "same" and shots:
                # 前の区間の最後の絵を、この区間の最初の切り替えまで続ける（区間の境目で同じ絵を出し直さない）
                shots[-1]["to"] = b1_
                continue
            shots.append({"from": b0_, "to": b1_, "visual": v, "sfx": sx})
    caps = [c for g in segs if not g["spec"].get("captions_off") for c in g["caps"]]
    for c in caps:
        c["from"] = max(c["from"], thumb_f)  # サムネイルのフレームには字幕を重ねない
    # 字幕の切り替えを、画面の切り替え（XF フレームのクロスフェード）の途中に置かない。
    # 途中で字幕が消えて出ると、文字の所の明るさが下がって上がり、チラつきと判定された（ショートA の最初の書き出し）
    fades = [(sh["from"], sh["from"] + XF) for sh in shots[1:]]
    # クロスフェードの直前・直後の1フレームも避ける（フェードの最後の1段と字幕の切り替えが続くと、文字の所が上がって下がる：2回目の書き出しで1件）
    for c in caps:
        for w0, w1 in fades:
            if w0 - 2 < c["from"] < w1 + 2:
                c["from"] = w1 + 2
    for c in caps:
        for w0, w1 in fades:
            if w0 - 2 < c["to"] < w1 + 2:
                c["to"] = w0 - 2
    # 区間の間の短い切れ目（声の間）では前の字幕を出したままにする（消えてすぐ出る「点滅」にしない）
    for a_, b_ in zip(caps, caps[1:]):
        if b_["from"] - a_["to"] < 15:
            a_["to"] = b_["from"]
    caps = [c for c in caps if c["to"] > c["from"]]

    # 3) 音を混ぜる：声、BGM（話している間は下げる）、効果音
    a = cfg["audio"]
    n = int(total * SR)
    voice = np.zeros(n, np.float32)
    for t0, clip in pieces:
        i0 = int(t0 * SR)
        voice[i0 : i0 + len(clip)] += clip[: n - i0]
    meter = pyln.Meter(SR)
    voice *= 10 ** ((a["narration_lufs"] - meter.integrated_loudness(voice)) / 20)
    # 声の始まりと、声の途切れ（F-064：最初の3秒に前置きの無音を作らない。維持率が落ちる所で声が途切れていないか）。
    # 10ミリ秒ごとの音量で、いちばん大きい所から40dB下までを「声あり」とみなす
    hop = SR // 100
    rms = np.sqrt(np.mean(voice[: len(voice) // hop * hop].reshape(-1, hop) ** 2, axis=1) + 1e-12)
    on = 20 * np.log10(rms) > 20 * np.log10(rms.max()) - 40
    idx = np.nonzero(on)[0]
    v_gaps, run = [], 0
    for i_ in range(idx[0], idx[-1] + 1):
        if on[i_]:
            if run * 0.01 >= 0.2:
                v_gaps.append([round((i_ - run) * 0.01, 2), round(run * 0.01, 2)])
            run = 0
        else:
            run += 1
    voice_info = {"start": round(idx[0] * 0.01, 2), "end": round((idx[-1] + 1) * 0.01, 2), "gaps": v_gaps}
    gain = np.full(n, a["bgm_gain_gap"], np.float32)
    for g in segs:
        gain[int(g["t0"] * SR) : int(g["t1"] * SR)] = a["bgm_gain_speech"]
    k = int(a["bgm_duck_frames"] / FPS * SR)
    gain = np.convolve(gain, np.ones(k, np.float32) / k, mode="same")
    bed = bgm_bed(ROOT / spec["bgm"], total, a["bgm_lufs"]) * gain[:, None]
    fo = int(1.2 * SR)
    bed[-fo:] *= np.linspace(1, 0, fo, dtype=np.float32)[:, None]
    mix = np.repeat(voice[:, None], 2, axis=1) + bed
    below = cfg["sfx"]["db_below_voice"]
    cues = []
    for sh in shots:
        for x in sh["sfx"]:
            w = decode_audio(ROOT / "assets" / "sfx" / x["file"], SR, 2)
            g = 10 ** ((a["narration_lufs"] - below[x["level"]] - SFX_REF_DB) / 20)
            t0 = sh["from"] / FPS + x.get("at", 0.0)
            if x["level"] == "bed":
                ln = int((sh["to"] - sh["from"]) / FPS * SR)
                w = np.resize(w, (ln, 2))
                r = int(0.4 * SR)
                env = np.ones(ln, np.float32)
                env[:r] = np.linspace(0, 1, r)
                env[-r:] = np.linspace(1, 0, r)
                w = w * env[:, None]
            i0 = int(t0 * SR)
            m = min(len(w), n - i0)
            mix[i0 : i0 + m] += w[:m] * g
            cues.append({"t": round(t0, 2), "file": x["file"], "level": x["level"]})
    # 声は左右に同じ音が入るので、ステレオで測ると約3dB大きく出る。混ぜたあとで全体を本編と同じ音量にそろえる
    mix *= 10 ** ((a["narration_lufs"] - meter.integrated_loudness(mix)) / 20)
    out_dir = PUBLIC / "shorts" / sid
    out_dir.mkdir(parents=True, exist_ok=True)
    tmp = out_dir / "audio.raw.wav"
    sf.write(tmp, mix, SR, subtype="FLOAT")
    # 音割れ防止：本編と同じ -1dBFS のリミッター
    subprocess.run([ffmpeg_bin(), "-v", "error", "-y", "-i", str(tmp), "-af", "alimiter=limit=0.89:attack=2:release=50:level=disabled",
                    "-c:a", "pcm_s16le", str(out_dir / "audio.wav")], check=True)
    tmp.unlink()

    hook = None
    if spec.get("hook"):
        # 最初の区間の声が終わるまで（次の画面に替わる所まで）出す
        hook = {**spec["hook"], "from": 0, "to": int(round((segs[0]["t1"] + 0.05) * FPS))}
    data = {
        "id": sid, "episode": args.episode, "dir": args.episode.split("-")[0], "fps": FPS, "durationInFrames": n_total,
        "audio": f"shorts/{sid}/audio.wav", "thumb": {**(spec.get("thumb") or {}), "frames": thumb_f}, "hook": hook,
        "max_shot_sec": spec.get("max_shot_sec", 3.0), "voice": voice_info,
        "end": {"from": int(round(end_from * FPS)), "text": spec["end"]["text"]},
        "shots": [{k: v for k, v in sh.items() if k != "sfx"} for sh in shots], "captions": caps,
    }
    (out_dir / "data.json").write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
    (build / f"short_{args.name}_cues.json").write_text(json.dumps({"cues": cues, "segments": [{k: g[k] for k in ("id", "t0", "t1")} for g in segs]}, ensure_ascii=False, indent=1), encoding="utf-8")
    loud = meter.integrated_loudness(sf.read(out_dir / "audio.wav", dtype="float32")[0])
    print(f"ショート {sid}：{total:.1f}秒（{n_total}フレーム）、画面 {len(shots)}、字幕 {len(caps)}、効果音 {len(cues)}、音量 {loud:.1f} LUFS")
    # 画面1つあたりの長さ（F-059：絵の切り替えの間隔を見る）
    lens = [(sh["to"] - sh["from"]) / FPS for sh in shots]
    print(f"画面の長さ：平均 {np.mean(lens):.1f}秒、最長 {max(lens):.1f}秒、最短 {min(lens):.1f}秒")
    g_max = max([g[1] for g in v_gaps], default=0.0)
    print(f"声：{voice_info['start']:.2f}秒から、途切れ（0.2秒以上）{len(v_gaps)}か所、最長 {g_max:.2f}秒")


if __name__ == "__main__":
    main()
