import React, { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { continueRender, delayRender, staticFile } from "remotion";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import meta from "../data/meta.json";
import { Cam, EXAG, FOV, Region, world } from "./geo";

type Loaded = { geom: THREE.BufferGeometry; day: THREE.Texture; night: THREE.Texture; h8: THREE.Texture };
const cache = new Map<Region, Promise<Loaded>>();

const loadTex = (url: string) =>
  new Promise<THREE.Texture>((res, rej) => {
    new THREE.TextureLoader().load(url, (t) => {
      t.colorSpace = THREE.NoColorSpace; // 色はシェーダーでそのまま使う
      t.minFilter = THREE.LinearMipmapLinearFilter;
      t.magFilter = THREE.LinearFilter;
      t.anisotropy = 4;
      res(t);
    }, undefined, rej);
  });

/** 標高データ(Float32)から地形メッシュを作る。海は少し沈める */
const load = (region: Region): Promise<Loaded> => {
  if (!cache.has(region)) {
    cache.set(region, (async () => {
      const m = (meta as any)[region];
      const buf = await (await fetch(staticFile(`${region}_mesh.bin`))).arrayBuffer();
      const h = new Float32Array(buf);
      const geom = new THREE.PlaneGeometry(m.km_x, m.km_y, m.mesh_w - 1, m.mesh_h - 1);
      const pos = geom.attributes.position as THREE.BufferAttribute;
      const ex = EXAG[region];
      for (let i = 0; i < pos.count; i++) {
        const v = h[i];
        pos.setZ(i, v > -9000 && v > 0 ? (v / 1000) * ex : region === "japan" ? -0.6 : -0.15);
      }
      geom.rotateX(-Math.PI / 2); // 北を奥(-z)、高さを上(+y)に
      geom.computeVertexNormals();
      const [day, night, h8] = await Promise.all([
        loadTex(staticFile(`${region}_day.png`)), loadTex(staticFile(`${region}_night.png`)), loadTex(staticFile(`${region}_h8.png`)),
      ]);
      h8.minFilter = THREE.LinearFilter; h8.generateMipmaps = false; // 高さの符号化が崩れないようミップマップなし
      return { geom, day, night, h8 };
    })());
  }
  return cache.get(region)!;
};

const vert = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

const frag = /* glsl */ `
uniform sampler2D dayTex; uniform sampler2D nightTex; uniform sampler2D hTex;
uniform float uNight; uniform float uSea; uniform float uLow; uniform float uLowThresh; uniform float uDesat; uniform float uBright;
varying vec2 vUv;
void main() {
  vec3 day = texture2D(dayTex, vUv).rgb;
  vec3 night = texture2D(nightTex, vUv).rgb;
  vec3 h = texture2D(hTex, vUv).rgb;
  float elev = h.r * 255.0 + h.g - 10.0;   // R=整数m+10, G=小数
  float jp = step(0.5, h.b);               // 日本の陸地
  vec3 col = mix(day, night, uNight);
  // 標高しきい値未満の低地を塗る
  float low = jp * step(elev, uLowThresh);
  col = mix(col, vec3(1.0, 0.78, 0.28), 0.72 * uLow * low);
  // 海面を上げた目安（現在の地形のまま）
  float on = step(0.05, uSea);
  float flooded = jp * step(elev, uSea) * on;
  col = mix(col, vec3(0.12, 0.38, 0.66), 0.82 * flooded);
  float edge = jp * (1.0 - smoothstep(0.0, 0.7, abs(elev - uSea))) * on;
  col = mix(col, vec3(0.62, 0.88, 1.0), 0.55 * edge);
  float g = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(col, vec3(g), uDesat);
  // 板の端を海の色に溶かして、四角い切れ目を見せない
  float ed = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y));
  vec3 seaC = mix(vec3(0.055, 0.133, 0.227), vec3(0.024, 0.031, 0.07), uNight);
  col = mix(seaC, col, smoothstep(0.0, 0.03, ed));
  gl_FragColor = vec4(col * uBright, 1.0);
}`;

const oceanFrag = /* glsl */ `
uniform float uNight; uniform float uBright;
void main() {
  vec3 seaC = mix(vec3(0.055, 0.133, 0.227), vec3(0.024, 0.031, 0.07), uNight);
  gl_FragColor = vec4(seaC * uBright, 1.0);
}`;
const oceanVert = /* glsl */ `void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

export type TerrainParams = { night: number; sea: number; low: number; desat: number; bright: number };

const CameraRig: React.FC<{ cam: Cam }> = ({ cam }) => {
  const { camera } = useThree();
  useLayoutEffect(() => {
    const c = camera as THREE.PerspectiveCamera;
    // 近クリップ面をカメラ距離に合わせて決め、深度の精度を保つ（F-001 チラつき対策）
    const dist = cam.pos.distanceTo(cam.target);
    c.fov = FOV; c.near = Math.max(1, dist * 0.05); c.far = dist * 6 + 2000;
    c.position.copy(cam.pos);
    c.lookAt(cam.target);
    c.updateProjectionMatrix();
  }, [camera, cam.pos.x, cam.pos.y, cam.pos.z, cam.target.x, cam.target.y, cam.target.z]);
  return null;
};

export const Terrain: React.FC<{ region: Region; cam: Cam; p: TerrainParams; rivers?: React.ReactNode; yScale?: number }> = ({ region, cam, p, rivers, yScale = 1 }) => {
  const [data, setData] = useState<Loaded | null>(null);
  const [handle] = useState(() => delayRender(`terrain-${region}`, { timeoutInMilliseconds: 120000 }));
  const { advance } = useThree();
  useEffect(() => { load(region).then((d) => setData(d)); }, [region]);
  // メッシュが画面に載ってから1回描画し、それから撮影を許可する
  useEffect(() => {
    if (!data) return;
    advance(performance.now());
    continueRender(handle);
  }, [data, advance, handle]);

  const mat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: vert, fragmentShader: frag,
    uniforms: {
      dayTex: { value: null }, nightTex: { value: null }, hTex: { value: null },
      uNight: { value: 0 }, uSea: { value: 0 }, uLow: { value: 0 }, uLowThresh: { value: 100 }, uDesat: { value: 0 }, uBright: { value: 1 },
    },
  }), []);
  if (data) {
    mat.uniforms.dayTex.value = data.day; mat.uniforms.nightTex.value = data.night; mat.uniforms.hTex.value = data.h8;
  }
  mat.uniforms.uNight.value = p.night; mat.uniforms.uSea.value = p.sea; mat.uniforms.uLow.value = p.low;
  mat.uniforms.uDesat.value = p.desat; mat.uniforms.uBright.value = p.bright;
  // チラつき対策（F-001）：海の板は深度を書かず・比べず、常に一番奥に描く。
  // 地形と同じ深さで重なると、フレームごとに勝ち負けが入れ替わって黒い影がチラつく（Zファイティング）
  const ocean = useMemo(() => new THREE.ShaderMaterial({ vertexShader: oceanVert, fragmentShader: oceanFrag,
    uniforms: { uNight: { value: 0 }, uBright: { value: 1 } }, depthWrite: false, depthTest: false }), []);
  ocean.uniforms.uNight.value = p.night; ocean.uniforms.uBright.value = p.bright;
  const oceanGeom = useMemo(() => new THREE.PlaneGeometry(40000, 40000).rotateX(-Math.PI / 2), []);

  return (
    <>
      <color attach="background" args={[p.night > 0.5 ? "#03050a" : "#0b1a2e"]} />
      <CameraRig cam={cam} />
      <mesh geometry={oceanGeom} material={ocean} position={[0, region === "japan" ? -0.9 : -0.3, 0]} renderOrder={-1} />
      {data ? <mesh geometry={data.geom} material={mat} scale={[1, yScale, 1]} /> : null}
      {rivers}
    </>
  );
};

/** 地図上に描く線（川の模式図）。progress で描き進める */
export const RiverLine: React.FC<{ region: Region; pts: [number, number][]; progress: number; color: string; opacity: number; y?: number; radius?: number }> =
  ({ region, pts, progress, color, opacity, y = 1.0, radius = 0.7 }) => {
    const geom = useMemo(() => {
      const curve = new THREE.CatmullRomCurve3(pts.map(([lo, la]) => world(region, lo, la, y)));
      return new THREE.TubeGeometry(curve, 400, radius, 8, false);
    }, [region, pts, y, radius]);
    const total = geom.index!.count;
    const n = Math.floor((total * Math.max(0, Math.min(1, progress))) / 3) * 3;
    geom.setDrawRange(0, n);
    return (
      <mesh geometry={geom}>
        <meshBasicMaterial color={color} transparent opacity={opacity} depthTest={false} />
      </mesh>
    );
  };
