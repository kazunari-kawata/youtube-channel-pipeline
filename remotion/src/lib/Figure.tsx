/**
 * イメージ映像用の人物（顔のないシルエット）
 * モデルと動き：Quaternius「Universal Animation Library」（CC0）→ public/figures/mannequin.glb
 * 実在の人物を写実的に再現しない（CLAUDE.md）。連想させるのは体つき・眼鏡・髪型・服の輪郭まで。
 *
 * マネキンは関節ごとに分かれた筋肉質な体なので、服で隠れる部分は描かず、
 * 骨に沿って作った「服」（ジャケット・ズボン・靴）を同じ骨で動かす（F-008）
 *   体つき：服の太さ（下の表）と肩幅で決める。痩せ型
 *   髪：頭の形を少し膨らませた殻。生え際より下は頭の中にしまう
 * 座標はマネキンの静止姿勢（Tポーズ、メートル、+Y が上、+Z が正面、+X が本人の左）
 */
import { useThree } from "@react-three/fiber";
import React, { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { cancelRender, continueRender, delayRender, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { GLTF, GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";

let cache: Promise<GLTF> | null = null;
const loadFigure = () => (cache ??= new GLTFLoader().loadAsync(staticFile("figures/mannequin.glb")));

/* ---------- 体つきと服の設定 ---------- */

export type Build = {
  shoulder: number; // 肩幅（上腕の付け根を肩の内側へ寄せる割合。1 = マネキンのまま）
  width: number; // 胴と手足の太さ（1 = 下の表のまま）
  jacket: string;
  trousers: string;
  shoes: string;
  skin: string;
  hair: string; // "none" で髪を付けない（帽子をかぶる警官など）
  /** スーツの前（白いシャツの襟と V、細いネクタイ、上着の襟の折り返し）。指定しなければ付けない（F-035。003 のクーパー） */
  suit?: { shirt: string; tie?: string; lapel?: string };
  /** スカート（女性の制服。003 の客室乗務員）。指定すると、脚は細くして trousers の色（ストッキング）で描き、腰から膝までスカートをはかせる */
  skirt?: string;
  /** 髪を後ろでまとめる（女性。髪の色は hair） */
  bun?: boolean;
};

// 痩せ型の成人男性、90年代の私服（ジャケットとジーンズ）
export const SLIM_90S: Build = {
  shoulder: 0.82,
  width: 1,
  jacket: "#4a3f33",
  trousers: "#34415a",
  shoes: "#141414",
  skin: "#16110e",
  hair: "#7d6748",
};

// 同じ痩せ型の体つきで、刑務所の中の服（色だけ替える。体の形は SLIM_90S のまま）
export const SLIM_PRISON: Build = { ...SLIM_90S, jacket: "#5d6670", trousers: "#4b535d", shoes: "#18181a" };

// 90年代の警官（紺の制服）。ダーマーより肩幅も胴も太く、並んだときに見分けられるように。記章・文字は付けない。帽子は Figure の hat で
export const OFFICER_90S: Build = { shoulder: 0.96, width: 1.14, jacket: "#222a3a", trousers: "#1d2230", shoes: "#0d0d0e", skin: "#16110e", hair: "none" };

// ジャケットの胴：[高さ, 横幅の半分, 奥行きの半分, 前後の中心, 後ろ側の持ち上げ]
const JACKET_BODY = [
  [0.862, 0.168, 0.13, 0.006, 0], // 裾は少し広げる（脚の付け根が横から出ないように）
  [0.95, 0.16, 0.122, 0.008, 0],
  [1.05, 0.143, 0.113, 0.012, 0],
  [1.15, 0.145, 0.112, 0.008, 0],
  [1.25, 0.154, 0.115, -0.004, 0],
  [1.35, 0.161, 0.116, -0.016, 0],
  [1.42, 0.162, 0.11, -0.026, 0],
  [1.462, 0.146, 0.1, -0.032, 0],
  [1.495, 0.112, 0.087, -0.037, 0],
  [1.518, 0.084, 0.075, -0.04, 0],
  [1.54, 0.072, 0.067, -0.042, 0], // 襟（首は描かないので、あごの下まで立てる）
  [1.578, 0.072, 0.068, -0.048, 0.045], // 後ろは高く立てて、後頭部の下のすき間を隠す
];
// ズボンの腰まわり（ジャケットの下に隠れる）
const TROUSER_SEAT = [
  [1.03, 0.138, 0.108, 0.006],
  [0.95, 0.142, 0.11, 0.004],
  [0.9, 0.125, 0.095, 0.0],
  [0.875, 0.09, 0.065, 0.0],
];
// スカート：[高さ, 横幅の半分, 奥行きの半分, 前後の中心]。膝のすぐ上まで、少しだけ裾を広げる
const SKIRT = [
  [1.0, 0.142, 0.112, 0.006],
  [0.92, 0.156, 0.118, 0.004],
  [0.78, 0.163, 0.12, 0.0],
  [0.6, 0.178, 0.124, 0.0],
];
// ズボンの脚：[高さ, 半径]
const TROUSER_LEG = [
  [0.98, 0.078], [0.93, 0.08], [0.8, 0.075], [0.6, 0.064], [0.5, 0.06], [0.35, 0.057], [0.18, 0.055], [0.084, 0.058],
];
// 袖：[付け根からの距離（m）, 半径]
const SLEEVE = [
  [0, 0.05], [0.05, 0.06], [0.2, 0.054], [0.324, 0.049], [0.47, 0.046], [0.6, 0.043], [0.615, 0.045],
];
// 靴：[前後, 中心の高さ, 高さの半分, 幅の半分]（足首の位置を基準）
const SHOE = [
  [-0.105, 0.04, 0.035, 0.04],
  [-0.09, 0.05, 0.05, 0.05],
  [-0.05, 0.058, 0.058, 0.054],
  [0.0, 0.055, 0.055, 0.056],
  [0.06, 0.045, 0.045, 0.058],
  [0.13, 0.035, 0.035, 0.055],
  [0.19, 0.03, 0.03, 0.048],
  [0.218, 0.026, 0.022, 0.036],
];

/** 表の行を高さなどで線形に補間する */
const lerpTable = (table: number[][], x: number) => {
  const rows = [...table].sort((a, b) => a[0] - b[0]);
  if (x <= rows[0][0]) return rows[0].slice(1);
  for (let i = 1; i < rows.length; i++) {
    if (x <= rows[i][0]) {
      const t = (x - rows[i - 1][0]) / (rows[i][0] - rows[i - 1][0]);
      return rows[i].slice(1).map((v, k) => THREE.MathUtils.lerp(rows[i - 1][k + 1], v, t));
    }
  }
  return rows[rows.length - 1].slice(1);
};

/** 頂点ごとに一番影響の大きい骨の番号 */
const dominantBones = (geo: THREE.BufferGeometry) => {
  const si = geo.getAttribute("skinIndex");
  const sw = geo.getAttribute("skinWeight");
  const out = new Int32Array(si.count);
  for (let v = 0; v < si.count; v++) {
    let best = 0, bw = -1;
    for (let k = 0; k < 4; k++) {
      const w = sw.getComponent(v, k);
      if (w > bw) { bw = w; best = si.getComponent(v, k); }
    }
    out[v] = best;
  }
  return out;
};

/* ---------- 骨に沿った筒（服）を作る ---------- */

type Influence = [number, number][]; // [骨の番号, 重み]
type Ring = { c: THREE.Vector3; u: THREE.Vector3; v: THREE.Vector3; ru: number; rv: number; skin: Influence; lift?: number };

/** 輪を順につないだ筒。exp を大きくすると断面が角ばる（胴や靴） */
const tubeGeometry = (rings: Ring[], o: { radial?: number; exp?: number; capStart?: boolean; capEnd?: boolean } = {}) => {
  const R = o.radial ?? 28;
  const e = o.exp ?? 2;
  const pos: number[] = [], si: number[] = [], sw: number[] = [], idx: number[] = [];
  const pushSkin = (s: Influence) => {
    const merged = new Map<number, number>();
    s.forEach(([b, w]) => merged.set(b, (merged.get(b) ?? 0) + w));
    const top = [...merged.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
    const sum = top.reduce((a, b) => a + b[1], 0) || 1;
    for (let k = 0; k < 4; k++) {
      si.push(top[k]?.[0] ?? 0);
      sw.push(top[k] ? top[k][1] / sum : 0);
    }
  };
  for (const r of rings) {
    for (let j = 0; j < R; j++) {
      const a = (j / R) * Math.PI * 2;
      const ca = Math.cos(a), sa = Math.sin(a);
      const x = Math.sign(ca) * Math.pow(Math.abs(ca), 2 / e);
      const y = Math.sign(sa) * Math.pow(Math.abs(sa), 2 / e);
      const p = r.c.clone().addScaledVector(r.u, r.ru * x).addScaledVector(r.v, r.rv * y);
      if (r.lift) p.y += r.lift * THREE.MathUtils.smoothstep(-x, -0.6, 0.9); // u の反対側（背中側）を持ち上げる
      pos.push(p.x, p.y, p.z);
      pushSkin(r.skin);
    }
  }
  for (let i = 0; i < rings.length - 1; i++) {
    for (let j = 0; j < R; j++) {
      const a = i * R + j, b = i * R + ((j + 1) % R), c = (i + 1) * R + j, d = (i + 1) * R + ((j + 1) % R);
      idx.push(a, c, b, b, c, d);
    }
  }
  const cap = (ri: number) => {
    const r = rings[ri];
    const ci = pos.length / 3;
    pos.push(r.c.x, r.c.y, r.c.z);
    pushSkin(r.skin);
    for (let j = 0; j < R; j++) idx.push(ci, ri * R + j, ri * R + ((j + 1) % R));
  };
  if (o.capStart) cap(0);
  if (o.capEnd) cap(rings.length - 1);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(si, 4));
  g.setAttribute("skinWeight", new THREE.Float32BufferAttribute(sw, 4));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
};

/** 骨の付け根を結んだ折れ線に沿って輪を並べる。関節の前後は2本の骨の重みを混ぜて、曲げてもなめらかにする */
const chainRings = (
  pts: THREE.Vector3[],
  bones: number[], // 区間ごとの骨
  blend: number[], // 関節ごとの混ぜる幅（m）。blend[k] は区間 k-1 と k の境目
  ref: THREE.Vector3, // 断面の向きの基準（脚・腕は正面、靴は上）
  radius: (d: number, p: THREE.Vector3) => [number, number],
  step = 0.015,
) => {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + pts[i].distanceTo(pts[i - 1]));
  const total = cum[cum.length - 1];
  const at = (d: number) => {
    const dd = THREE.MathUtils.clamp(d, 0, total);
    let k = 0;
    while (k < pts.length - 2 && dd > cum[k + 1]) k++;
    const t = (dd - cum[k]) / Math.max(1e-6, cum[k + 1] - cum[k]);
    return { p: pts[k].clone().lerp(pts[k + 1], t), k };
  };
  const n = Math.max(2, Math.ceil(total / step) + 1);
  const rings: Ring[] = [];
  for (let i = 0; i < n; i++) {
    const d = (total * i) / (n - 1);
    const { p, k } = at(d);
    const T = at(d + 0.03).p.sub(at(d - 0.03).p).normalize();
    const u = ref.clone().addScaledVector(T, -ref.dot(T)).normalize();
    const v = new THREE.Vector3().crossVectors(T, u).normalize();
    let skin: Influence = [[bones[k], 1]];
    for (let j = 1; j < pts.length - 1; j++) {
      const w = blend[j] ?? 0;
      if (w > 0 && Math.abs(d - cum[j]) < w) {
        const s = THREE.MathUtils.smoothstep(d, cum[j] - w, cum[j] + w);
        skin = [[bones[j - 1], 1 - s], [bones[j], s]];
      }
    }
    const [ru, rv] = radius(d, p);
    rings.push({ c: p, u, v, ru, rv, skin });
  }
  return rings;
};

/** 高さごとの表から、縦に積んだ輪（胴・腰）を作る。骨の重みは高さで決める */
const stackRings = (table: number[][], joints: [number, number, number, number][], width: number, step = 0.012) => {
  // joints: [境目の高さ, 混ぜる幅, 下の骨, 上の骨]
  const ys = table.map((r) => r[0]);
  const y0 = Math.min(...ys), y1 = Math.max(...ys);
  const n = Math.ceil((y1 - y0) / step) + 1;
  const rings: Ring[] = [];
  const desc = ys[0] > ys[ys.length - 1]; // 表の向き（上から下か）
  for (let i = 0; i < n; i++) {
    const y = desc ? y1 - ((y1 - y0) * i) / (n - 1) : y0 + ((y1 - y0) * i) / (n - 1);
    const [rx, rz, cz, lift = 0] = lerpTable(table, y);
    let skin: Influence = [[joints[0][2], 1]];
    for (const [jy, w, lo, hi] of joints) {
      if (y >= jy + w) skin = [[hi, 1]];
      else if (y > jy - w) skin = [[lo, 1 - THREE.MathUtils.smoothstep(y, jy - w, jy + w)], [hi, THREE.MathUtils.smoothstep(y, jy - w, jy + w)]];
    }
    rings.push({ c: new THREE.Vector3(0, y, cz), u: new THREE.Vector3(0, 0, 1), v: new THREE.Vector3(1, 0, 0), ru: rz * width, rv: rx * width, skin, lift });
  }
  // 太さの変わり目の角を丸める
  for (let it = 0; it < 3; it++) {
    for (let i = 1; i < rings.length - 1; i++) {
      rings[i].ru = (rings[i - 1].ru + 2 * rings[i].ru + rings[i + 1].ru) / 4;
      rings[i].rv = (rings[i - 1].rv + 2 * rings[i].rv + rings[i + 1].rv) / 4;
    }
  }
  return rings;
};

/* ---------- スーツの前（F-035） ----------
 * 上着の胴（stackRings の輪）の前の面に沿って、少し浮かせた板を張る。頂点の骨の重みは同じ高さの胴の輪から取るので、上着と一緒に動く。
 * 胴の襟は首を隠すために立てた筒なので、そのままだとタートルネックに見える。前側をシャツの襟にして、V の中にシャツとネクタイ、両側に襟の折り返しを置く */
const SUIT = { vBottom: 1.315, vTop: 1.5, collarTop: 1.566, vHalf: 0.056 };

const suitFront = (torso: Ring[], build: Build, body: THREE.SkinnedMesh, e = 2.4) => {
  const s = build.suit!;
  const ringAt = (y: number) => {
    let i = 0;
    while (i < torso.length - 2 && torso[i + 1].c.y < y) i++;
    const a = torso[i], b = torso[i + 1];
    const t = THREE.MathUtils.clamp((y - a.c.y) / (b.c.y - a.c.y), 0, 1);
    const skin: Influence = [...a.skin.map(([k, w]): [number, number] => [k, w * (1 - t)]), ...b.skin.map(([k, w]): [number, number] => [k, w * t])];
    return { cz: THREE.MathUtils.lerp(a.c.z, b.c.z, t), ru: THREE.MathUtils.lerp(a.ru, b.ru, t), rv: THREE.MathUtils.lerp(a.rv, b.rv, t), skin };
  };
  // 胴の断面は |z/ru|^e + |x/rv|^e = 1（tubeGeometry と同じ形）。x の位置の前の面に lift だけ浮かせる
  const front = (x: number, y: number, lift: number) => {
    const r = ringAt(y);
    const k = Math.min(0.97, Math.abs(x) / r.rv);
    return { p: new THREE.Vector3(x, y, r.cz + r.ru * Math.pow(1 - Math.pow(k, e), 1 / e) + lift), skin: r.skin, rv: r.rv };
  };
  const panel = (y0: number, y1: number, span: (y: number) => [number, number], lift: number, cols = 9, step = 0.006) => {
    const rows = Math.max(2, Math.ceil((y1 - y0) / step) + 1);
    const pos: number[] = [], si: number[] = [], sw: number[] = [], idx: number[] = [];
    for (let i = 0; i < rows; i++) {
      const y = y0 + ((y1 - y0) * i) / (rows - 1);
      const [l, r] = span(y);
      for (let j = 0; j < cols; j++) {
        const f = front(THREE.MathUtils.lerp(l, r, j / (cols - 1)), y, lift);
        pos.push(f.p.x, f.p.y, f.p.z);
        const merged = new Map<number, number>();
        f.skin.forEach(([b, w]) => merged.set(b, (merged.get(b) ?? 0) + w));
        const top = [...merged.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
        const sum = top.reduce((a, b) => a + b[1], 0) || 1;
        for (let k = 0; k < 4; k++) { si.push(top[k]?.[0] ?? 0); sw.push(top[k] ? top[k][1] / sum : 0); }
      }
    }
    for (let i = 0; i < rows - 1; i++) {
      for (let j = 0; j < cols - 1; j++) {
        const a = i * cols + j, b = a + 1, c = a + cols, d = c + 1;
        idx.push(a, b, c, b, d, c);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(si, 4));
    g.setAttribute("skinWeight", new THREE.Float32BufferAttribute(sw, 4));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  };
  // V の半幅（下の合わせ目で 0、V の上で vHalf）。その上はシャツの襟が首の前を回り込む
  const vHalf = (y: number) => SUIT.vHalf * THREE.MathUtils.clamp((y - SUIT.vBottom) / (SUIT.vTop - SUIT.vBottom), 0, 1);
  const shirtHalf = (y: number) => {
    if (y <= SUIT.vTop) return vHalf(y);
    const collar = 0.86 * ringAt(y).rv;
    return THREE.MathUtils.lerp(SUIT.vHalf, collar, THREE.MathUtils.smoothstep(y, SUIT.vTop, SUIT.vTop + 0.025));
  };
  // 細いネクタイ：結び目は少し太く、下へ広がり、V の中に収める（下は上着の合わせ目に隠れる）
  const tieHalf = (y: number) => {
    const w = y > 1.505 ? THREE.MathUtils.lerp(0.012, 0.018, (y - 1.505) / 0.04) : THREE.MathUtils.lerp(0.02, 0.0095, (y - 1.33) / 0.175);
    return y > SUIT.vTop + 0.004 ? w : Math.min(w, 0.88 * vHalf(y));
  };
  // 襟の折り返しは上着よりわずかに明るく。幅は胸（1.46m）で一番広く、下の合わせ目と首元で細くなる
  const lapel = s.lapel ?? `#${new THREE.Color(build.jacket).lerp(new THREE.Color("#ffffff"), 0.045).getHexString()}`;
  const lapTop = SUIT.vTop + 0.008;
  const lapW = (y: number) => (y < 1.46 ? THREE.MathUtils.lerp(0.008, 0.04, (y - SUIT.vBottom) / (1.46 - SUIT.vBottom)) : THREE.MathUtils.lerp(0.04, 0.02, (y - 1.46) / (lapTop - 1.46)));
  return [
    cloth(panel(SUIT.vBottom, SUIT.collarTop, (y) => [-shirtHalf(y), shirtHalf(y)], 0.003, 13), s.shirt, body, 0.8),
    ...(s.tie ? [cloth(panel(1.33, 1.548, (y) => [-tieHalf(y), tieHalf(y)], 0.0065, 5), s.tie, body, 0.55)] : []),
    cloth(panel(SUIT.vBottom, lapTop, (y) => [vHalf(y), vHalf(y) + lapW(y)], 0.0045, 4), lapel, body, 0.7),
    cloth(panel(SUIT.vBottom, lapTop, (y) => [-vHalf(y) - lapW(y), -vHalf(y)], 0.0045, 4), lapel, body, 0.7),
  ];
};

const cloth = (geo: THREE.BufferGeometry, color: string, body: THREE.SkinnedMesh, roughness = 0.88) => {
  const m = new THREE.SkinnedMesh(geo, new THREE.MeshStandardMaterial({ color, roughness, side: THREE.DoubleSide }));
  m.bind(body.skeleton, body.bindMatrix);
  m.castShadow = true;
  m.frustumCulled = false;
  return m;
};

/** 服を一式作る */
const makeClothes = (body: THREE.SkinnedMesh, build: Build) => {
  const bones = body.skeleton.bones;
  const bi = (name: string) => {
    const i = bones.findIndex((b) => b.name === THREE.PropertyBinding.sanitizeNodeName(name));
    if (i < 0) throw new Error(`骨 ${name} がありません`);
    return i;
  };
  const head = (name: string) => {
    const m = new THREE.Matrix4().copy(body.skeleton.boneInverses[bi(name)]).invert().premultiply(new THREE.Matrix4().copy(body.bindMatrix).invert());
    return new THREE.Vector3().setFromMatrixPosition(m);
  };
  const out: THREE.SkinnedMesh[] = [];
  const W = build.width;
  const F = new THREE.Vector3(0, 0, 1);
  const UP = new THREE.Vector3(0, 1, 0);

  // ジャケットの胴
  const torso = stackRings(JACKET_BODY, [
    [head("DEF-spine.001").y, 0.05, bi("DEF-hips"), bi("DEF-spine.001")],
    [head("DEF-spine.002").y, 0.05, bi("DEF-spine.001"), bi("DEF-spine.002")],
    [head("DEF-spine.003").y, 0.05, bi("DEF-spine.002"), bi("DEF-spine.003")],
    [head("DEF-neck").y + 0.03, 0.03, bi("DEF-spine.003"), bi("DEF-neck")],
  ], W);
  out.push(cloth(tubeGeometry(torso, { exp: 2.4 }), build.jacket, body));
  if (build.suit) out.push(...suitFront(torso, build, body));

  // ズボンの腰（スカートのときはスカートの中に隠れるので描かない）
  if (!build.skirt) {
    const seat = stackRings(TROUSER_SEAT, [[0, 0, bi("DEF-hips"), bi("DEF-hips")]], W);
    out.push(cloth(tubeGeometry(seat, { exp: 2.4, capEnd: true }), build.trousers, body));
  } else {
    // スカート：腰は腰の骨。下へ行くほど、左半分は左の太もも、右半分は右の太ももに付ける（脚を開いても裾から脚が突き抜けない）
    const g = tubeGeometry(stackRings(SKIRT, [[0, 0, bi("DEF-hips"), bi("DEF-hips")]], W), { exp: 2.2 });
    const gp = g.getAttribute("position"), gi = g.getAttribute("skinIndex"), gw = g.getAttribute("skinWeight");
    const [hip, tl, tr] = [bi("DEF-hips"), bi("DEF-thigh.L"), bi("DEF-thigh.R")];
    for (let v = 0; v < gp.count; v++) {
      const k = THREE.MathUtils.smoothstep(gp.getY(v), 0.62, 0.97);
      const sd = THREE.MathUtils.smoothstep(gp.getX(v), -0.07, 0.07); // +x が左（L）
      gi.setXYZW(v, hip, tl, tr, 0);
      gw.setXYZW(v, k, (1 - k) * sd, (1 - k) * (1 - sd), 0);
    }
    out.push(cloth(g, build.skirt, body));
  }

  for (const side of ["L", "R"]) {
    const sx = side === "L" ? 1 : -1;
    // 袖
    const ua = head(`DEF-upper_arm.${side}`), fa = head(`DEF-forearm.${side}`), hd = head(`DEF-hand.${side}`);
    const out_ = new THREE.Vector3(sx, 0, 0);
    // 付け根は肩の骨と混ぜて、腕を下ろしても袖口が肩から飛び出さないようにする
    const sleeve = chainRings(
      [ua.clone().addScaledVector(out_, -0.07), ua, fa, hd.clone().addScaledVector(out_, 0.015)],
      [bi(`DEF-shoulder.${side}`), bi(`DEF-upper_arm.${side}`), bi(`DEF-forearm.${side}`)],
      [0, 0.06, 0.05],
      F,
      (d) => { const [r] = lerpTable(SLEEVE, d - 0.02); return [r * W, r * W]; },
    );
    out.push(cloth(tubeGeometry(sleeve, { capStart: true }), build.jacket, body));

    // ズボンの脚
    const th = head(`DEF-thigh.${side}`), sh = head(`DEF-shin.${side}`), ft = head(`DEF-foot.${side}`);
    const legDir = ft.clone().sub(sh).normalize();
    const leg = chainRings(
      [new THREE.Vector3(th.x * 0.9, 0.98, th.z), th, sh, ft, ft.clone().addScaledVector(legDir, 0.02)],
      [bi("DEF-hips"), bi(`DEF-thigh.${side}`), bi(`DEF-shin.${side}`), bi(`DEF-shin.${side}`)],
      [0, 0.06, 0.05, 0],
      F,
      (_d, p) => {
        const [r] = lerpTable(TROUSER_LEG, p.y);
        // スカートのときは脚を細く。スカートに隠れる上の方（膝より上）はさらに細くして、脚を開いても腰の横から突き抜けないように
        const k = build.skirt ? THREE.MathUtils.lerp(0.72, 0.3, THREE.MathUtils.smoothstep(p.y, 0.6, 0.7)) : 1;
        return [r * W * 0.95 * k, r * W * k];
      },
    );
    out.push(cloth(tubeGeometry(leg), build.trousers, body));

    // 靴（足首を基準に前後へ）
    const shoeRings: Ring[] = [];
    const zs = SHOE.map((r) => r[0]);
    const n = 26;
    for (let i = 0; i < n; i++) {
      const z = zs[0] + ((zs[zs.length - 1] - zs[0]) * i) / (n - 1);
      const [yc, hh, hw] = lerpTable(SHOE, z);
      const s = THREE.MathUtils.smoothstep(z, 0.08, 0.14);
      shoeRings.push({
        c: new THREE.Vector3(ft.x + sx * 0.006, yc, z),
        u: UP.clone(),
        v: new THREE.Vector3(-1, 0, 0),
        ru: hh,
        rv: hw,
        skin: [[bi(`DEF-foot.${side}`), 1 - s], [bi(`DEF-toe.${side}`), s]],
      });
    }
    out.push(cloth(tubeGeometry(shoeRings, { exp: 3, capStart: true, capEnd: true }), build.shoes, body, 0.6));
  }
  return out;
};

/* ---------- マネキンの体：服に隠れる部分を描かない ---------- */

const COVERED = /hips|spine|shoulder|upper_arm|forearm|thigh|shin|foot|toe/;

const hideCovered = (mesh: THREE.SkinnedMesh) => {
  const geo = mesh.geometry;
  const dom = dominantBones(geo);
  const names = mesh.skeleton.bones.map((b) => b.name);
  const pos = geo.getAttribute("position");
  // 首は襟の上に出る部分だけ残す（付け根の広がった部分が襟から飛び出すため）
  const covered = (v: number) => COVERED.test(names[dom[v]]) || (/neck/.test(names[dom[v]]) && pos.getY(v) < 1.572);
  const src = geo.index ? Array.from(geo.index.array) : Array.from({ length: pos.count }, (_, i) => i);
  const keep: number[] = [];
  for (let t = 0; t < src.length; t += 3) {
    const n = Number(covered(src[t])) + Number(covered(src[t + 1])) + Number(covered(src[t + 2]));
    if (n === 0) keep.push(src[t], src[t + 1], src[t + 2]); // 1頂点でも隠れる側なら消す（引き伸ばされた三角形が襟から飛び出すため）
  }
  geo.setIndex(keep);
};

/* ---------- 髪：頭の形に沿った殻 ---------- */

const makeHair = (body: THREE.SkinnedMesh, color: string) => {
  const bones = body.skeleton.bones;
  const headIdx = bones.findIndex((b) => b.name === "DEF-head");
  const src = body.geometry.index ? body.geometry.toNonIndexed() : body.geometry.clone();
  const dom = dominantBones(src);
  const sp = src.getAttribute("position");
  // 頭の三角形だけ。同じ位置の頂点を1つにまとめる
  const key = (i: number) => `${sp.getX(i).toFixed(3)},${sp.getY(i).toFixed(3)},${sp.getZ(i).toFixed(3)}`;
  const map = new Map<string, number>();
  const uniq: THREE.Vector3[] = [];
  const tris: number[] = [];
  for (let t = 0; t < sp.count; t += 3) {
    if (dom[t] !== headIdx || dom[t + 1] !== headIdx || dom[t + 2] !== headIdx) continue;
    for (let k = 0; k < 3; k++) {
      const kk = key(t + k);
      let u = map.get(kk);
      if (u === undefined) { u = uniq.length; uniq.push(new THREE.Vector3().fromBufferAttribute(sp, t + k)); map.set(kk, u); }
      tris.push(u);
    }
  }
  // 頭は粗いので、三角形を4分割×2回してから角をならす（生え際がギザギザにならないように）
  let P = uniq, Tri = tris;
  for (let level = 0; level < 2; level++) {
    const mid = new Map<string, number>();
    const NP = P.map((p) => p.clone());
    const midpoint = (a: number, b: number) => {
      const k = a < b ? `${a}_${b}` : `${b}_${a}`;
      let m = mid.get(k);
      if (m === undefined) { m = NP.length; NP.push(P[a].clone().add(P[b]).multiplyScalar(0.5)); mid.set(k, m); }
      return m;
    };
    const NT: number[] = [];
    for (let t = 0; t < Tri.length; t += 3) {
      const [a, b, c] = [Tri[t], Tri[t + 1], Tri[t + 2]];
      const ab = midpoint(a, b), bc = midpoint(b, c), ca = midpoint(c, a);
      NT.push(a, ab, ca, ab, b, bc, ca, bc, c, ab, bc, ca);
    }
    P = NP; Tri = NT;
  }
  const nb: Set<number>[] = P.map(() => new Set<number>());
  for (let t = 0; t < Tri.length; t += 3) {
    const [a, b, c] = [Tri[t], Tri[t + 1], Tri[t + 2]];
    nb[a].add(b); nb[a].add(c); nb[b].add(a); nb[b].add(c); nb[c].add(a); nb[c].add(b);
  }
  for (let it = 0; it < 6; it++) {
    for (const f of [0.5, -0.53]) { // Taubin：縮ませずにならす
      const avg = P.map((p, i) => {
        const v = new THREE.Vector3();
        nb[i].forEach((j) => v.add(P[j]));
        return nb[i].size ? v.divideScalar(nb[i].size) : p.clone();
      });
      P = P.map((p, i) => p.clone().lerp(avg[i], f));
    }
  }
  const nrm = P.map(() => new THREE.Vector3());
  for (let t = 0; t < Tri.length; t += 3) {
    const a = P[Tri[t]], b = P[Tri[t + 1]], c = P[Tri[t + 2]];
    const fn = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
    nrm[Tri[t]].add(fn); nrm[Tri[t + 1]].add(fn); nrm[Tri[t + 2]].add(fn);
  }
  nrm.forEach((n) => n.normalize());
  const box = new THREE.Box3().setFromPoints(P);
  const c = box.getCenter(new THREE.Vector3());
  const h = box.getSize(new THREE.Vector3()).multiplyScalar(0.5);
  const S = THREE.MathUtils.smoothstep;
  const moved = P.map((p, i) => {
    const nx = (p.x - c.x) / h.x, ny = (p.y - c.y) / h.y, nz = (p.z - c.z) / h.z; // +Z が顔
    // 生え際：横は耳の上、前は額の上（左右どちらかへ流した前髪で少し下がる）、後ろはうなじ
    let line = -0.1;
    line = THREE.MathUtils.lerp(line, 0.4 - 0.2 * S(nx, -0.3, 0.8), S(nz, 0.15, 0.75));
    line = THREE.MathUtils.lerp(line, -0.95, S(-nz, 0.05, 0.6));
    const inHair = S(ny - line, -0.06, 0.06);
    // 厚み：頭頂は厚め、分け目の反対側に少し量を足す
    const thick = 0.011 + 0.013 * S(ny, 0.2, 0.95) + 0.007 * S(nx, 0.0, 0.8) * S(ny, 0.25, 0.9);
    const off = THREE.MathUtils.lerp(-0.012, thick, inHair); // 生え際より下は頭の中へしまう
    return p.clone().addScaledVector(nrm[i], off);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(moved.flatMap((p) => [p.x, p.y, p.z]), 3));
  g.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(moved.flatMap(() => [headIdx, 0, 0, 0]), 4));
  g.setAttribute("skinWeight", new THREE.Float32BufferAttribute(moved.flatMap(() => [1, 0, 0, 0]), 4));
  g.setIndex(Tri);
  g.computeVertexNormals();
  const m = new THREE.SkinnedMesh(g, new THREE.MeshStandardMaterial({ color, roughness: 0.7, side: THREE.DoubleSide }));
  m.bind(body.skeleton, body.bindMatrix);
  m.castShadow = true;
  m.frustumCulled = false;
  return m;
};

const makeGlasses = () => {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: "#3a3a3a", roughness: 0.3, metalness: 0.7 });
  const rim = new THREE.TorusGeometry(0.03, 0.0042, 8, 32); // 90年代の大きめの眼鏡
  for (const x of [-0.034, 0.034]) {
    const r = new THREE.Mesh(rim, mat);
    r.position.set(x * 1.0, 0, 0);
    r.scale.set(1.15, 0.9, 1);
    g.add(r);
  }
  const bridge = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.012, 6), mat);
  bridge.rotation.z = Math.PI / 2;
  g.add(bridge);
  for (const s of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.0025, 0.0025, 0.1, 6), mat);
    arm.rotation.x = Math.PI / 2;
    arm.position.set(s * 0.07, 0, -0.05);
    g.add(arm);
  }
  g.traverse((o) => ((o as THREE.Mesh).castShadow = true));
  return g;
};

/** 頭の頂点の範囲（静止姿勢の座標）。帽子を頭の大きさに合わせるため */
const headBox = (body: THREE.SkinnedMesh) => {
  const headIdx = body.skeleton.bones.findIndex((b) => b.name === "DEF-head");
  const dom = dominantBones(body.geometry);
  const p = body.geometry.getAttribute("position");
  const box = new THREE.Box3();
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) if (dom[i] === headIdx) box.expandByPoint(v.fromBufferAttribute(p, i));
  return box;
};

/** 警官の制帽（上の広い山、黒い帯、前のつば）。記章は付けない。原点は頭のてっぺんの真上 */
const makeCap = (head: THREE.Box3, color: string) => {
  const size = head.getSize(new THREE.Vector3());
  const r = (size.x / 2) * 1.02; // 頭の横幅に合わせる（奥行きはあごや首の点を含んで大きく出る）
  const g = new THREE.Group();
  const cloth = new THREE.MeshStandardMaterial({ color, roughness: 0.85 });
  const dark = new THREE.MeshStandardMaterial({ color: "#0c0c0d", roughness: 0.7 }); // つばはつやを抑える（小さく明るい反射はチラつく）
  // 帯が額の高さに来るように深くかぶせる（警官は髪を付けないので、頭にぴったり）
  // 上の山は低く、帯より大きく張り出す（高い筒にすると、正面からはシルクハットに見えた）
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.52, r * 1.16, 0.05, 28), cloth);
  crown.position.y = 0.002;
  const band = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.17, r * 1.17, 0.034, 28), dark);
  band.position.y = -0.04;
  // つば：前半分の薄い円板を、少し下へ傾ける
  const visor = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.5, r * 1.5, 0.007, 24, 1, false, -Math.PI / 2, Math.PI), dark);
  visor.position.set(0, -0.056, 0.012);
  visor.rotation.x = 0.3;
  g.add(crown, band, visor);
  g.traverse((o) => ((o as THREE.Mesh).castShadow = true));
  return g;
};

/* ---------- 人物 ---------- */

export type FigureProps = {
  clip: string; // Walk_Loop, Idle_Loop, Sitting_Idle_Loop など
  position?: [number, number, number];
  rotationY?: number;
  /** 人物の位置を時間で動かす（歩く場面）。t は秒 */
  path?: (t: number) => [number, number, number];
  timeOffset?: number;
  glasses?: boolean;
  build?: Build;
  /** 動きを止める位置（秒）。"end" は動きの最後の姿勢（倒れた姿勢など）で止める */
  freeze?: number | "end";
  /** 体全体を倒す角度（x, z。ラジアン）。先に倒してから rotationY で向きを変える。横向きに寝かせるときなど */
  tilt?: [number, number];
  /** 骨ごとに足す回転（骨の名前 → [x, y, z] ラジアン）。止めた姿勢の膝や腕を曲げるとき。名前は "DEF-thighL" のように "." を除く */
  pose?: Record<string, [number, number, number]>;
  /** 制帽の色（警官）。指定しなければかぶらない */
  hat?: string;
};

export const Figure: React.FC<FigureProps> = ({ clip, position = [0, 0, 0], rotationY = 0, path, timeOffset = 0, glasses = true, build = SLIM_90S, freeze, tilt, pose, hat }) => {
  const { advance } = useThree();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const [handle] = useState(() => delayRender("figure: mannequin.glb"));
  const [gltf, setGltf] = useState<GLTF | null>(null);

  useEffect(() => {
    loadFigure().then(setGltf).catch((e) => cancelRender(e));
  }, []);

  const rig = useMemo(() => {
    if (!gltf) return null;
    const obj = cloneSkinned(gltf.scene) as THREE.Object3D;
    const skin = new THREE.MeshStandardMaterial({ color: build.skin, roughness: 0.95 });
    const bodies: THREE.SkinnedMesh[] = [];
    obj.traverse((o) => {
      const m = o as THREE.SkinnedMesh;
      if (m.isSkinnedMesh) bodies.push(m);
    });
    for (const m of bodies) {
      m.geometry = m.geometry.clone(); // 読み込んだ形を共有しているので、変える前に複製
      m.material = skin;
      m.castShadow = true;
      m.frustumCulled = false;
    }
    // 頭の頂点が一番多いメッシュを本体とする（もう1つは関節の球）
    const headCount = (m: THREE.SkinnedMesh) => {
      const hi = m.skeleton.bones.findIndex((b) => b.name === "DEF-head");
      return Array.from(dominantBones(m.geometry)).filter((d) => d === hi).length;
    };
    const main = [...bodies].sort((a, b) => headCount(b) - headCount(a))[0];
    const hair = build.hair === "none" ? null : makeHair(main, build.hair); // 体を削る前に頭の形を取る
    const hbox = headBox(main);
    for (const m of bodies) hideCovered(m);
    for (const c of makeClothes(main, build)) main.parent!.add(c);
    if (hair) main.parent!.add(hair);
    const head = obj.getObjectByName("DEF-head");
    if (head && build.bun && build.hair !== "none") {
      // まとめ髪：後頭部の下寄りに小さな丸。頭の骨の子にして一緒に動かす
      const hi = main.skeleton.bones.findIndex((b) => b.name === "DEF-head");
      const c = hbox.getCenter(new THREE.Vector3());
      const size = hbox.getSize(new THREE.Vector3());
      const local = new THREE.Matrix4().copy(main.skeleton.boneInverses[hi]).multiply(new THREE.Matrix4().makeTranslation(c.x, c.y + size.y * 0.08, hbox.min.z + 0.012));
      const bun = new THREE.Mesh(new THREE.SphereGeometry(size.x * 0.27, 16, 12), new THREE.MeshStandardMaterial({ color: build.hair, roughness: 0.9 }));
      bun.scale.set(1.1, 0.9, 0.85);
      bun.castShadow = true;
      local.decompose(bun.position, bun.quaternion, bun.scale.clone());
      bun.scale.set(1.1, 0.9, 0.85);
      head.add(bun);
    }
    if (head && glasses) {
      // 眼鏡は静止姿勢の座標で目の高さ・顔の前に置き、頭の骨の子にして一緒に動かす
      const hi = main.skeleton.bones.findIndex((b) => b.name === "DEF-head");
      const local = new THREE.Matrix4().copy(main.skeleton.boneInverses[hi]).multiply(new THREE.Matrix4().makeTranslation(0, 1.692, 0.106));
      const gl = makeGlasses();
      local.decompose(gl.position, gl.quaternion, gl.scale);
      head.add(gl);
    }
    if (head && hat) {
      // 帽子も同じように、静止姿勢の頭のてっぺんに置いて頭の骨の子にする
      const hi = main.skeleton.bones.findIndex((b) => b.name === "DEF-head");
      const c = hbox.getCenter(new THREE.Vector3());
      const local = new THREE.Matrix4().copy(main.skeleton.boneInverses[hi]).multiply(new THREE.Matrix4().makeTranslation(c.x, hbox.max.y - 0.026, c.z + 0.002));
      const cap = makeCap(hbox, hat);
      local.decompose(cap.position, cap.quaternion, cap.scale);
      head.add(cap);
    }
    // 骨の名前は読み込み時に "." が消える（DEF-upper_arm.L → DEF-upper_armL）
    const arms: THREE.Object3D[] = [];
    obj.traverse((o) => { if (/^DEF-upper_arm[LR]$/.test(o.name)) arms.push(o); });
    const mixer = new THREE.AnimationMixer(obj);
    const anim = gltf.animations.find((a) => a.name === clip);
    if (!anim) cancelRender(new Error(`動き ${clip} がありません`));
    mixer.clipAction(anim!).play();
    const bones: Record<string, THREE.Object3D> = {};
    obj.traverse((o) => { if (o.name.startsWith("DEF-")) bones[o.name] = o; });
    // 前のフレームで足した変更（肩幅・pose）。次のフレームの頭で取り消す（下のコメント）
    const applied = { done: false, pose: [] as [THREE.Object3D, THREE.Quaternion][] };
    return { obj, mixer, arms, bones, duration: anim!.duration, applied };
  }, [gltf, clip, build, glasses, hat]);

  useLayoutEffect(() => {
    if (!rig) return;
    const t = frame / fps;
    // three.js の AnimationMixer は、骨の値が前のフレームと同じだと骨に書き戻さない。
    // 動きを止めた人物（freeze）では骨が書き戻されず、肩幅や pose の変更がフレームごとに積み重なって手足が回り続ける（F-028）。
    // そこで、前のフレームで足した変更を先に取り消してから時刻を合わせ、もう一度足す
    const ap = rig.applied;
    if (ap.done) {
      for (const a of rig.arms) a.position.divideScalar(build.shoulder);
      for (const [b, q] of ap.pose) b.quaternion.multiply(q.clone().invert());
    }
    rig.mixer.setTime(freeze === "end" ? rig.duration - 0.001 : freeze !== undefined ? freeze : t + timeOffset);
    // 肩幅を狭める（動きが骨の位置を書き戻したあとで掛ける）
    for (const a of rig.arms) a.position.multiplyScalar(build.shoulder);
    ap.pose = [];
    if (pose) {
      for (const [name, e] of Object.entries(pose)) {
        const b = rig.bones[name];
        if (!b) continue;
        const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(e[0], e[1], e[2]));
        b.quaternion.multiply(q);
        ap.pose.push([b, q]);
      }
    }
    ap.done = true;
    const p = path ? path(t) : position;
    rig.obj.position.set(p[0], p[1], p[2]);
    rig.obj.rotation.order = "YXZ"; // 先に x・z で倒し、そのあと y で向きを変える
    rig.obj.rotation.set(tilt?.[0] ?? 0, rotationY, tilt?.[1] ?? 0);
    rig.obj.updateMatrixWorld(true);
  }, [rig, frame, fps, path, position, rotationY, timeOffset, build, freeze, tilt, pose]);

  useEffect(() => {
    if (!rig) return;
    advance(performance.now());
    continueRender(handle);
  }, [rig, advance, handle]);

  return rig ? <primitive object={rig.obj} /> : null;
};
