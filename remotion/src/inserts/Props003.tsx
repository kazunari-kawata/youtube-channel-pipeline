/**
 * 003 D.B.クーパー（1971年、太平洋岸北西部）のイメージ映像の小道具と質感。外部の3Dモデルや画像は使わず、すべて手続きで作る。
 *   旅客機：ボーイング727 の形（後ろに3つのエンジン、T字の尾翼、胴体の下の階段）。航空会社の塗装・ロゴ・文字は入れない
 *   空港・機内・事務所：70年代初めの成形の椅子、木目の壁板、蛍光灯、タイプライター、黒電話、書類箱
 *   自然：ダグラスファーの森、冬の川岸の砂と流木、雲
 * 光るものは、にじみ（ブルーム）のしきい値 1.8 より暗くする（小さく明るいものがにじむと、動きでにじみが揺れてチラつく）。
 * 点滅する灯り（衝突防止灯など）は付けない（明滅はチラつきと判定される）。赤い光を地面に落とさない（CLAUDE.md）。
 */
import React, { useMemo } from "react";
import { random } from "remotion";
import * as THREE from "three";
import { Build } from "../lib/Figure";

type V3 = [number, number, number];

/** 1971年の男：40代半ば、中肉、濃い色のスーツと黒いレインコート、濃い茶色の髪（FBIの人相書き）。眼鏡なし。顔は描かない */
export const COOPER_71: Build = { shoulder: 0.9, width: 1.08, jacket: "#232427", trousers: "#202125", shoes: "#14100c", skin: "#16110e", hair: "#241b15" };
/** 背景の乗客・旅行者（色だけ替える。顔は描かない） */
export const TRAVELER_A: Build = { shoulder: 0.88, width: 1.04, jacket: "#5a4a36", trousers: "#3b3a36", shoes: "#1a1512", skin: "#16110e", hair: "#3a2c20" };
export const TRAVELER_B: Build = { shoulder: 0.84, width: 1.0, jacket: "#3e4a5a", trousers: "#2e3038", shoes: "#141414", skin: "#16110e", hair: "#5c4a36" };

/* ---------- 手続きのテクスチャ ---------- */

const texCache: Record<string, THREE.CanvasTexture> = {};
const canvasTex = (key: string, w: number, h: number, draw: (c: CanvasRenderingContext2D) => void, srgb = true, repeat = false) => {
  if (texCache[key]) return texCache[key];
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  draw(cv.getContext("2d")!);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 8;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  texCache[key] = t;
  return t;
};

/** 柔らかい雲のかたまり（透明な板に貼る）。seed ごとに形を変える */
export const cloudTexture = (seed: number) =>
  canvasTex(`cloud${seed}`, 512, 256, (c) => {
    for (let i = 0; i < 70; i++) {
      const x = 256 + (random(`cx${seed}-${i}`) - 0.5) * 380;
      const y = 140 + (random(`cy${seed}-${i}`) - 0.5) * 110 * (1 - Math.abs(x - 256) / 300);
      const r = 30 + random(`cr${seed}-${i}`) * 70;
      const g = c.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, "rgba(255,255,255,0.20)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      c.fillStyle = g;
      c.fillRect(x - r, y - r, r * 2, r * 2);
    }
  });

/** 雨粒の付いた窓ガラス（静止した粒。流れる筋は別に、ゆっくり動かす） */
export const dropsTexture = () =>
  canvasTex("drops", 1024, 640, (c) => {
    c.clearRect(0, 0, 1024, 640);
    for (let i = 0; i < 900; i++) {
      const x = random(`dx${i}`) * 1024, y = random(`dy${i}`) * 640, r = 1.2 + random(`dr${i}`) ** 3 * 7;
      const g = c.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r);
      g.addColorStop(0, "rgba(255,255,255,0.55)");
      g.addColorStop(0.6, "rgba(200,215,235,0.18)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      c.fillStyle = g;
      c.beginPath();
      c.ellipse(x, y, r * 0.8, r, 0, 0, Math.PI * 2);
      c.fill();
    }
    // 流れたあとの筋（静止）
    for (let i = 0; i < 40; i++) {
      const x = random(`sx${i}`) * 1024, y0 = random(`sy${i}`) * 400, len = 80 + random(`sl${i}`) * 200;
      c.strokeStyle = "rgba(220,230,245,0.10)";
      c.lineWidth = 1.5;
      c.beginPath();
      c.moveTo(x, y0);
      c.bezierCurveTo(x + 4, y0 + len * 0.3, x - 3, y0 + len * 0.7, x + 2, y0 + len);
      c.stroke();
    }
  }, true);

/** 遠い灯りのぼけ（雨の窓の向こう）。光る色の丸を散らす。明るさは控えめ */
export const bokehTexture = (key: string, colors: string[], n = 40) =>
  canvasTex(`bokeh-${key}`, 1024, 512, (c) => {
    c.fillStyle = "#05070c";
    c.fillRect(0, 0, 1024, 512);
    for (let i = 0; i < n; i++) {
      const x = random(`bx${key}${i}`) * 1024, y = 200 + random(`by${key}${i}`) * 200, r = 6 + random(`br${key}${i}`) * 26;
      const col = colors[Math.floor(random(`bc${key}${i}`) * colors.length)];
      const g = c.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, col);
      g.addColorStop(1, "rgba(0,0,0,0)");
      c.globalAlpha = 0.25 + random(`ba${key}${i}`) * 0.4;
      c.fillStyle = g;
      c.fillRect(x - r, y - r, r * 2, r * 2);
    }
    c.globalAlpha = 1;
  });

/** 70年代の床（テラゾー：石の粒が混じった床）。
 *  奥の床は斜めから見るので、粒の明暗が強いとカメラが動くたびに画素の境目でちらつく（QAで検出）。
 *  粒は薄く、ぼかして描き、目地も太く淡くする */
export const terrazzoTexture = () =>
  canvasTex("terrazzo", 512, 512, (c) => {
    c.fillStyle = "#b5aa95";
    c.fillRect(0, 0, 512, 512);
    c.filter = "blur(1.2px)";
    for (let i = 0; i < 5000; i++) {
      const v = random(`tz${i}`);
      c.fillStyle = v < 0.4 ? "rgba(110,100,88,0.22)" : v < 0.7 ? "rgba(225,218,205,0.22)" : "rgba(150,122,92,0.2)";
      c.fillRect(random(`tx${i}`) * 512, random(`ty${i}`) * 512, 3 + v * 3, 3 + v * 2);
    }
    c.filter = "blur(2px)";
    c.strokeStyle = "rgba(80,74,66,0.22)";
    c.lineWidth = 4;
    for (let k = 0; k <= 512; k += 128) {
      c.beginPath(); c.moveTo(k, 0); c.lineTo(k, 512); c.stroke();
      c.beginPath(); c.moveTo(0, k); c.lineTo(512, k); c.stroke();
    }
    c.filter = "none";
  }, true, true);

/** 機内の床のじゅうたん（70年代の柄） */
export const carpetTexture = () =>
  canvasTex("carpet", 256, 256, (c) => {
    c.fillStyle = "#4a3a2c";
    c.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 4000; i++) {
      c.fillStyle = `rgba(${random(`ca${i}`) < 0.5 ? "120,90,60" : "40,30,22"},0.35)`;
      c.fillRect(random(`cx${i}`) * 256, random(`cy${i}`) * 256, 2, 2);
    }
  }, true, true);

/** 砂（川岸） */
export const sandTexture = () =>
  canvasTex("sand", 512, 512, (c) => {
    c.fillStyle = "#7d766a";
    c.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 20000; i++) {
      const v = random(`sd${i}`);
      c.fillStyle = v < 0.5 ? "rgba(60,56,50,0.35)" : "rgba(160,152,138,0.35)";
      c.fillRect(random(`sx${i}`) * 512, random(`sy${i}`) * 512, 1 + v * 2, 1 + v * 2);
    }
    // 波が残した筋
    c.strokeStyle = "rgba(50,46,40,0.25)";
    for (let k = 0; k < 14; k++) {
      c.lineWidth = 2;
      c.beginPath();
      const y = random(`wl${k}`) * 512;
      c.moveTo(0, y);
      for (let x = 0; x <= 512; x += 32) c.lineTo(x, y + Math.sin(x / 60 + k) * 6);
      c.stroke();
    }
  }, true, true);

/** 段ボールの書類箱（側面に手書きの番号の代わりの線。読める文字は入れない） */
export const boxTexture = (seed: number) =>
  canvasTex(`box${seed}`, 256, 192, (c) => {
    c.fillStyle = "#b39568";
    c.fillRect(0, 0, 256, 192);
    for (let i = 0; i < 1500; i++) {
      c.fillStyle = `rgba(90,70,45,${random(`bb${seed}-${i}`) * 0.25})`;
      c.fillRect(random(`bx${seed}-${i}`) * 256, random(`by${seed}-${i}`) * 192, 3, 1);
    }
    c.fillStyle = "#efe7d6";
    c.fillRect(70, 60, 116, 46);
    c.strokeStyle = "#2a2a2a";
    c.lineWidth = 3;
    for (let k = 0; k < 2; k++) {
      c.beginPath();
      c.moveTo(80, 74 + k * 18);
      for (let x = 80; x < 170; x += 8) c.lineTo(x, 74 + k * 18 + (random(`hw${seed}-${k}-${x}`) - 0.5) * 5);
      c.stroke();
    }
  });

/** 書類（タイプ打ちの行の代わりの細い線。読める文字は入れない） */
export const paperTexture = (seed: number) =>
  canvasTex(`paper${seed}`, 256, 330, (c) => {
    c.fillStyle = "#ece4d2";
    c.fillRect(0, 0, 256, 330);
    c.fillStyle = "rgba(40,40,40,0.55)";
    for (let y = 30; y < 310; y += 11) {
      const len = 150 + random(`pl${seed}-${y}`) * 60;
      if (random(`pg${seed}-${y}`) < 0.12) continue;
      c.fillRect(24, y, len, 3);
    }
  });

/** 壁のカレンダー（数字は書かず、升目と印だけ） */
export const calendarTexture = () =>
  canvasTex("calendar", 256, 320, (c) => {
    c.fillStyle = "#efe9dc";
    c.fillRect(0, 0, 256, 320);
    c.fillStyle = "#5a6e8a";
    c.fillRect(0, 0, 256, 120);
    c.strokeStyle = "rgba(40,40,40,0.5)";
    c.lineWidth = 2;
    for (let r = 0; r <= 5; r++) { c.beginPath(); c.moveTo(16, 140 + r * 34); c.lineTo(240, 140 + r * 34); c.stroke(); }
    for (let k = 0; k <= 7; k++) { c.beginPath(); c.moveTo(16 + k * 32, 140); c.lineTo(16 + k * 32, 310); c.stroke(); }
    c.strokeStyle = "#a33a2a";
    c.lineWidth = 3;
    c.beginPath();
    c.ellipse(16 + 3 * 32 + 16, 140 + 3 * 34 + 17, 15, 13, 0, 0, Math.PI * 2);
    c.stroke();
  });

/* ---------- 旅客機（ボーイング727 の形。塗装・ロゴ・文字なし） ---------- */

/** 長さ約46m を 1 とした縮尺ではなく、メートルで作る。原点は胴体の中心、機首は +x */
export const Jet727: React.FC<{ position?: V3; rotation?: V3; scale?: number; lights?: number; stairs?: boolean; cabin?: number }> = ({
  position = [0, 0, 0], rotation = [0, 0, 0], scale = 1, lights = 0.6, stairs = false, cabin = 0.3,
}) => {
  const skin = useMemo(() => new THREE.MeshStandardMaterial({ color: "#aeb3b8", roughness: 0.45, metalness: 0.35 }), []);
  const dark = useMemo(() => new THREE.MeshStandardMaterial({ color: "#3b3f44", roughness: 0.6, metalness: 0.3 }), []);
  const win = useMemo(() => new THREE.MeshStandardMaterial({ color: "#1a1a1a", emissive: "#ffd9a0", emissiveIntensity: cabin }), [cabin]);
  const wing = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(0, 0); s.lineTo(-5.5, 16); s.lineTo(-7.5, 16); s.lineTo(-6.0, 0); s.closePath();
    return new THREE.ExtrudeGeometry(s, { depth: 0.35, bevelEnabled: false });
  }, []);
  const hstab = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(0, 0); s.lineTo(-3.2, 5.6); s.lineTo(-4.4, 5.6); s.lineTo(-3.4, 0); s.closePath();
    return new THREE.ExtrudeGeometry(s, { depth: 0.18, bevelEnabled: false });
  }, []);
  const fin = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(0, 0); s.lineTo(-7.5, 0); s.lineTo(-9.4, 6.4); s.lineTo(-6.6, 6.4); s.closePath();
    return new THREE.ExtrudeGeometry(s, { depth: 0.3, bevelEnabled: false });
  }, []);
  const R = 1.9;
  return (
    <group position={position} rotation={rotation} scale={scale}>
      {/* 胴体 */}
      <mesh rotation={[0, 0, Math.PI / 2]} material={skin} castShadow>
        <cylinderGeometry args={[R, R, 34, 28]} />
      </mesh>
      {/* 機首 */}
      <mesh position={[17, -0.1, 0]} scale={[3.2, 1, 1]} material={skin} castShadow>
        <sphereGeometry args={[R, 28, 16, 0, Math.PI * 2, 0, Math.PI]} />
      </mesh>
      {/* 操縦室の窓（暗い帯） */}
      <mesh position={[18.6, 0.75, 0]} rotation={[0, 0, -0.5]} material={dark}>
        <boxGeometry args={[1.2, 0.3, 2.2]} />
      </mesh>
      {/* 尾部：細くなって、下に階段の扉 */}
      <mesh position={[-17 - 3.2, 0.35, 0]} rotation={[0, 0, Math.PI / 2]} material={skin} castShadow>
        <cylinderGeometry args={[R, 0.7, 6.4, 28]} />
      </mesh>
      {/* 客室の窓（細い帯。夜は中の明かりがうっすら） */}
      {[-1, 1].map((sd) => (
        <mesh key={sd} position={[0, 0.55, sd * (R + 0.005)]} rotation={[0, sd > 0 ? 0 : Math.PI, 0]} material={win}>
          <planeGeometry args={[28, 0.22]} />
        </mesh>
      ))}
      {/* 主翼 */}
      {[-1, 1].map((sd) => (
        <mesh key={`w${sd}`} geometry={wing} material={skin} position={[3, -1.1 + (sd > 0 ? 0 : 0.35), sd * 1.2]} rotation={[sd * Math.PI / 2, 0, 0]} castShadow />
      ))}
      {/* 後ろのエンジン（左右と、尾翼の付け根） */}
      {[-1, 1].map((sd) => (
        <group key={`e${sd}`} position={[-14.5, 0.9, sd * 2.9]}>
          <mesh rotation={[0, 0, Math.PI / 2]} material={skin} castShadow>
            <cylinderGeometry args={[0.85, 0.8, 5.0, 20]} />
          </mesh>
          <mesh position={[2.55, 0, 0]} rotation={[0, 0, Math.PI / 2]} material={dark}>
            <cylinderGeometry args={[0.7, 0.7, 0.1, 20]} />
          </mesh>
          <mesh position={[0, 0, -sd * 0.9]} material={skin}>
            <boxGeometry args={[1.6, 0.25, 1.2]} />
          </mesh>
        </group>
      ))}
      <mesh position={[-15.2, 2.3, 0]} rotation={[0, 0, Math.PI / 2]} material={skin}>
        <cylinderGeometry args={[0.85, 0.8, 4.6, 20]} />
      </mesh>
      {/* T字の尾翼 */}
      <mesh geometry={fin} material={skin} position={[-12.5, 1.6, -0.15]} castShadow />
      {[-1, 1].map((sd) => (
        <mesh key={`h${sd}`} geometry={hstab} material={skin} position={[-19.2, 8.0 + (sd > 0 ? 0 : 0.18), sd * 0.2]} rotation={[sd * Math.PI / 2, 0, 0]} />
      ))}
      {/* 胴体の下の後ろの階段（閉じた状態か、下ろした状態） */}
      {stairs ? (
        <mesh position={[-21.2, -2.7, 0]} rotation={[0, 0, -0.55]} material={dark}>
          <boxGeometry args={[4.2, 0.18, 0.9]} />
        </mesh>
      ) : (
        <mesh position={[-20.0, -1.55, 0]} material={dark}>
          <boxGeometry args={[3.0, 0.05, 0.9]} />
        </mesh>
      )}
      {/* 主脚（地上のとき） */}
      {/* 航行灯：左の翼端は赤、右は緑、尾は白。点滅させない。明るさはにじみのしきい値より下 */}
      {lights > 0 ? (
        <>
          <mesh position={[-4.2, -1.0, -17.2]}>
            <sphereGeometry args={[0.16, 10, 10]} />
            <meshBasicMaterial color={new THREE.Color("#ff5040").multiplyScalar(lights)} toneMapped={false} />
          </mesh>
          <mesh position={[-4.2, -1.0, 17.2]}>
            <sphereGeometry args={[0.16, 10, 10]} />
            <meshBasicMaterial color={new THREE.Color("#50ff90").multiplyScalar(lights)} toneMapped={false} />
          </mesh>
          <mesh position={[-23.4, 0.6, 0]}>
            <sphereGeometry args={[0.14, 10, 10]} />
            <meshBasicMaterial color={new THREE.Color("#ffffff").multiplyScalar(lights)} toneMapped={false} />
          </mesh>
        </>
      ) : null}
    </group>
  );
};

/** 雲の層：透明な雲の板を並べ、ゆっくり流す（drift は 1秒あたりのメートル） */
export const CloudLayer: React.FC<{ t: number; y: number; count?: number; spread?: number; drift?: number; color?: string; opacity?: number; seed?: number; size?: number; facing?: "camera" | "up" }> = ({
  t, y, count = 24, spread = 160, drift = 1.2, color = "#8b94a4", opacity = 0.75, seed = 1, size = 60, facing = "camera",
}) => {
  const items = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        x: (random(`clx${seed}-${i}`) - 0.5) * spread,
        z: (random(`clz${seed}-${i}`) - 0.5) * spread,
        dy: (random(`cly${seed}-${i}`) - 0.5) * 6,
        s: size * (0.6 + random(`cls${seed}-${i}`) * 0.8),
        tex: cloudTexture((seed * 7 + i) % 6),
      })),
    [count, spread, seed, size],
  );
  return (
    <group>
      {items.map((c, i) => {
        const x = ((c.x + t * drift + spread * 1.5) % spread) - spread / 2;
        return (
          <mesh key={i} position={[x, y + c.dy, c.z]} rotation={facing === "up" ? [-Math.PI / 2, 0, 0] : [0, 0, 0]}>
            <planeGeometry args={[c.s, c.s * 0.5]} />
            <meshStandardMaterial map={c.tex} color={color} transparent opacity={opacity} depthWrite={false} side={THREE.DoubleSide} />
          </mesh>
        );
      })}
    </group>
  );
};

/** ダグラスファー（円錐を重ねた針葉樹）。森はこれを並べる */
export const Fir: React.FC<{ position: V3; h: number; color?: string }> = ({ position, h, color = "#1d2a22" }) => (
  <group position={position}>
    <mesh position={[0, h * 0.12, 0]}>
      <cylinderGeometry args={[h * 0.012, h * 0.018, h * 0.24, 6]} />
      <meshStandardMaterial color="#2a2018" roughness={1} />
    </mesh>
    {[0, 1, 2, 3].map((k) => (
      <mesh key={k} position={[0, h * (0.3 + k * 0.17), 0]}>
        <coneGeometry args={[h * (0.14 - k * 0.028), h * 0.34, 7]} />
        <meshStandardMaterial color={color} roughness={1} />
      </mesh>
    ))}
  </group>
);

/** 森（木の位置は決まった乱数で） */
export const Forest: React.FC<{ seed: number; n: number; x: [number, number]; z: [number, number]; h: [number, number]; color?: string; clearZ?: number }> = ({
  seed, n, x, z, h, color, clearZ,
}) => {
  const trees = useMemo(() => {
    const out: { p: V3; h: number; c: string }[] = [];
    for (let i = 0; i < n; i++) {
      const px = x[0] + random(`fx${seed}-${i}`) * (x[1] - x[0]);
      const pz = z[0] + random(`fz${seed}-${i}`) * (z[1] - z[0]);
      if (clearZ !== undefined && Math.abs(pz - clearZ) < 2.2 && Math.abs(px) < 3) continue;
      const v = random(`fc${seed}-${i}`);
      out.push({ p: [px, 0, pz], h: h[0] + random(`fh${seed}-${i}`) * (h[1] - h[0]), c: color ?? (v < 0.5 ? "#1b2820" : v < 0.8 ? "#22301f" : "#18221d") });
    }
    return out;
  }, [seed, n, x, z, h, color, clearZ]);
  return (
    <group>
      {trees.map((t, i) => (
        <Fir key={i} position={t.p} h={t.h} color={t.c} />
      ))}
    </group>
  );
};

/** 流木（皮のはげた灰色の丸太） */
export const Driftwood: React.FC<{ position: V3; len: number; r: number; rotY: number; tilt?: number }> = ({ position, len, r, rotY, tilt = 0 }) => (
  <group position={position} rotation={[0, rotY, tilt]}>
    <mesh rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
      <cylinderGeometry args={[r * 0.8, r, len, 10]} />
      <meshStandardMaterial color="#8c857a" roughness={0.95} />
    </mesh>
    <mesh position={[len * 0.32, r * 0.6, 0]} rotation={[0, 0, 0.9]}>
      <cylinderGeometry args={[r * 0.18, r * 0.25, len * 0.22, 6]} />
      <meshStandardMaterial color="#7f786d" roughness={0.95} />
    </mesh>
  </group>
);

/** 70年代の空港の成形の椅子の列（オレンジのシート、金属の脚） */
export const ChairRow: React.FC<{ position: V3; rotationY?: number; n: number; color?: string }> = ({ position, rotationY = 0, n, color = "#b0642c" }) => {
  const seat = useMemo(() => new THREE.MeshStandardMaterial({ color, roughness: 0.45 }), [color]);
  const metal = useMemo(() => new THREE.MeshStandardMaterial({ color: "#6f7276", roughness: 0.5, metalness: 0.6 }), []);
  const pitch = 0.62;
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh position={[(n - 1) * pitch * 0.5, 0.36, 0]} material={metal}>
        <boxGeometry args={[n * pitch, 0.06, 0.08]} />
      </mesh>
      {[0, n - 1].map((k) => (
        <mesh key={k} position={[k * pitch, 0.18, 0]} material={metal}>
          <boxGeometry args={[0.05, 0.36, 0.5]} />
        </mesh>
      ))}
      {Array.from({ length: n }, (_, k) => (
        <group key={k} position={[k * pitch, 0, 0]}>
          <mesh position={[0, 0.43, 0.02]} material={seat} castShadow>
            <boxGeometry args={[0.52, 0.07, 0.48]} />
          </mesh>
          <mesh position={[0, 0.72, -0.24]} rotation={[-0.18, 0, 0]} material={seat} castShadow>
            <boxGeometry args={[0.52, 0.55, 0.06]} />
          </mesh>
        </group>
      ))}
    </group>
  );
};

/** 蛍光灯の照明（天井に光る板。にじまない明るさ） */
export const CeilingLights: React.FC<{ y: number; xs: number[]; zs: number[]; w?: number; d?: number; glow?: number }> = ({ y, xs, zs, w = 0.4, d = 2.4, glow = 1.1 }) => (
  <group>
    {xs.flatMap((x) =>
      zs.map((z) => (
        <mesh key={`${x}-${z}`} position={[x, y, z]} rotation={[Math.PI / 2, 0, 0]}>
          <planeGeometry args={[w, d]} />
          <meshStandardMaterial color="#000" emissive="#f1f6e6" emissiveIntensity={glow} side={THREE.DoubleSide} />
        </mesh>
      )),
    )}
  </group>
);

/** 書類箱（ふた付き） */
export const FileBox: React.FC<{ position: V3; rotY?: number; seed: number; lid?: boolean }> = ({ position, rotY = 0, seed, lid = true }) => {
  const tex = boxTexture(seed % 4);
  return (
    <group position={position} rotation={[0, rotY, 0]}>
      <mesh position={[0, 0.14, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.42, 0.28, 0.32]} />
        <meshStandardMaterial map={tex} roughness={0.9} />
      </mesh>
      {lid ? (
        <mesh position={[0, 0.29, 0]} castShadow>
          <boxGeometry args={[0.44, 0.04, 0.34]} />
          <meshStandardMaterial color="#a68a60" roughness={0.9} />
        </mesh>
      ) : null}
    </group>
  );
};

/** 書類の束（机の上） */
export const PaperStack: React.FC<{ position: V3; rotY?: number; seed: number; n?: number }> = ({ position, rotY = 0, seed, n = 6 }) => (
  <group position={position} rotation={[0, rotY, 0]}>
    {Array.from({ length: n }, (_, k) => (
      <mesh key={k} position={[(random(`ps${seed}-${k}`) - 0.5) * 0.02, 0.004 + k * 0.004, (random(`pz${seed}-${k}`) - 0.5) * 0.02]} rotation={[-Math.PI / 2, 0, (random(`pr${seed}-${k}`) - 0.5) * 0.08]}>
        <planeGeometry args={[0.216, 0.279]} />
        <meshStandardMaterial map={paperTexture((seed + k) % 5)} roughness={0.95} side={THREE.DoubleSide} />
      </mesh>
    ))}
  </group>
);

/** 手動のタイプライター（濃い緑がかった灰色） */
export const Typewriter: React.FC<{ position: V3; rotY?: number }> = ({ position, rotY = 0 }) => {
  const body = useMemo(() => new THREE.MeshStandardMaterial({ color: "#3d443f", roughness: 0.4, metalness: 0.2 }), []);
  return (
    <group position={position} rotation={[0, rotY, 0]}>
      <mesh position={[0, 0.06, 0]} material={body} castShadow>
        <boxGeometry args={[0.42, 0.12, 0.36]} />
      </mesh>
      <mesh position={[0, 0.13, -0.08]} rotation={[0.35, 0, 0]} material={body}>
        <boxGeometry args={[0.4, 0.06, 0.18]} />
      </mesh>
      <mesh position={[0, 0.17, -0.14]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.03, 0.03, 0.5, 12]} />
        <meshStandardMaterial color="#151515" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.24, -0.15]} rotation={[-0.25, 0, 0]}>
        <planeGeometry args={[0.216, 0.16]} />
        <meshStandardMaterial map={paperTexture(3)} side={THREE.DoubleSide} />
      </mesh>
      {/* 鍵盤の並び */}
      {[0, 1, 2, 3].map((r) => (
        <mesh key={r} position={[0, 0.125 + r * 0.008, 0.12 - r * 0.035]} rotation={[0.35, 0, 0]}>
          <boxGeometry args={[0.32 - r * 0.02, 0.012, 0.022]} />
          <meshStandardMaterial color="#1c1c1c" roughness={0.5} />
        </mesh>
      ))}
    </group>
  );
};

/** 70年代の黒電話（ダイヤル式） */
export const DeskPhone: React.FC<{ position: V3; rotY?: number }> = ({ position, rotY = 0 }) => (
  <group position={position} rotation={[0, rotY, 0]}>
    <mesh position={[0, 0.045, 0]} castShadow>
      <boxGeometry args={[0.22, 0.09, 0.24]} />
      <meshStandardMaterial color="#141414" roughness={0.35} />
    </mesh>
    <mesh position={[0, 0.092, 0.04]} rotation={[-0.4, 0, 0]}>
      <cylinderGeometry args={[0.055, 0.055, 0.012, 20]} />
      <meshStandardMaterial color="#d8d2c4" roughness={0.6} />
    </mesh>
    <mesh position={[0, 0.115, -0.05]} rotation={[0, 0, Math.PI / 2]}>
      <capsuleGeometry args={[0.022, 0.18, 4, 8]} />
      <meshStandardMaterial color="#141414" roughness={0.35} />
    </mesh>
  </group>
);

/** 木の机（天板と袖の引き出し） */
export const Desk: React.FC<{ position: V3; rotY?: number; w?: number }> = ({ position, rotY = 0, w = 1.5 }) => {
  const wood = useMemo(() => new THREE.MeshStandardMaterial({ color: "#5a3e28", roughness: 0.55 }), []);
  const metal = useMemo(() => new THREE.MeshStandardMaterial({ color: "#5e5f5a", roughness: 0.55, metalness: 0.3 }), []);
  return (
    <group position={position} rotation={[0, rotY, 0]}>
      <mesh position={[0, 0.74, 0]} material={wood} castShadow receiveShadow>
        <boxGeometry args={[w, 0.04, 0.76]} />
      </mesh>
      {[-1, 1].map((sd) => (
        <mesh key={sd} position={[sd * (w / 2 - 0.22), 0.36, 0]} material={metal} castShadow>
          <boxGeometry args={[0.42, 0.72, 0.7]} />
        </mesh>
      ))}
    </group>
  );
};

/** 金属の書類棚（4段の引き出し） */
export const FilingCabinet: React.FC<{ position: V3; rotY?: number; color?: string }> = ({ position, rotY = 0, color = "#6b6e66" }) => (
  <group position={position} rotation={[0, rotY, 0]}>
    <mesh position={[0, 0.66, 0]} castShadow receiveShadow>
      <boxGeometry args={[0.46, 1.32, 0.62]} />
      <meshStandardMaterial color={color} roughness={0.5} metalness={0.35} />
    </mesh>
    {[0, 1, 2, 3].map((k) => (
      <mesh key={k} position={[0, 0.2 + k * 0.32, 0.315]}>
        <boxGeometry args={[0.16, 0.025, 0.02]} />
        <meshStandardMaterial color="#b8bab2" roughness={0.3} metalness={0.8} />
      </mesh>
    ))}
  </group>
);
