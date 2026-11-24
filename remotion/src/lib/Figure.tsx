/**
 * イメージ映像用の人物（顔のないシルエット）
 * モデルと動き：Quaternius「Universal Animation Library」（CC0）→ public/figures/mannequin.glb
 * 実在の人物を写実的に再現しない（CLAUDE.md）。眼鏡の輪郭だけで人物を連想させる。
 */
import { useThree } from "@react-three/fiber";
import React, { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { cancelRender, continueRender, delayRender, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { GLTF, GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";

let cache: Promise<GLTF> | null = null;
const loadFigure = () => (cache ??= new GLTFLoader().loadAsync(staticFile("figures/mannequin.glb")));

export type FigureProps = {
  clip: string; // Walk_Loop, Idle_Loop, Sitting_Idle_Loop など
  position?: [number, number, number];
  rotationY?: number;
  /** 人物の位置を時間で動かす（歩く場面）。t は秒 */
  path?: (t: number) => [number, number, number];
  timeOffset?: number;
  glasses?: boolean;
  color?: string;
};

/** 髪（頭頂を覆う半球）。マネキンの丸い頭を、横分けの髪の人物らしい輪郭にする */
const makeHair = (mat: THREE.Material) => {
  const g = new THREE.Mesh(new THREE.SphereGeometry(0.1, 32, 16), mat); // 全球にして縁の段差を出さない
  g.scale.set(1.04, 0.78, 1.1);
  g.castShadow = true;
  return g;
};

const makeGlasses = () => {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: "#2a2a2a", roughness: 0.3, metalness: 0.6 });
  const rim = new THREE.TorusGeometry(0.033, 0.0048, 8, 32); // 90年代の大きめの眼鏡
  for (const x of [-0.034, 0.034]) {
    const r = new THREE.Mesh(rim, mat);
    r.position.set(x * 1.08, 0, 0);
    r.scale.set(1.15, 0.9, 1);
    g.add(r);
  }
  const bridge = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.012, 6), mat);
  bridge.rotation.z = Math.PI / 2;
  g.add(bridge);
  for (const s of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.0025, 0.0025, 0.1, 6), mat);
    arm.rotation.x = Math.PI / 2;
    arm.position.set(s * 0.068, 0, -0.05);
    g.add(arm);
  }
  g.traverse((o) => ((o as THREE.Mesh).castShadow = true));
  return g;
};

export const Figure: React.FC<FigureProps> = ({ clip, position = [0, 0, 0], rotationY = 0, path, timeOffset = 0, glasses = true, color = "#070708" }) => {
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
    // ほぼ黒の影絵。筋肉の凹凸が目立たないよう、つやを抑える
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.95, metalness: 0.0 });
    obj.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.material = mat;
        m.castShadow = true;
        m.receiveShadow = false;
        m.frustumCulled = false;
      }
    });
    const head = obj.getObjectByName("DEF-head");
    if (head) {
      const hair = makeHair(mat);
      hair.position.set(0, 0.118, 0.016); // 頭頂を少しだけ大きく見せる（後ろ寄り）。帽子に見えない位置
      head.add(hair);
    }
    if (glasses) {
      if (head) {
        const gl = makeGlasses();
        // 頭のボーンの座標系：Y が頭頂方向、-Z が顔の正面（静止画で調整した値）
        gl.position.set(0, 0.085, -0.095);
        gl.rotation.set(0, Math.PI, 0);
        head.add(gl);
      }
    }
    const mixer = new THREE.AnimationMixer(obj);
    const anim = gltf.animations.find((a) => a.name === clip);
    if (!anim) cancelRender(new Error(`動き ${clip} がありません`));
    mixer.clipAction(anim!).play();
    return { obj, mixer };
  }, [gltf, clip, color, glasses]);

  useLayoutEffect(() => {
    if (!rig) return;
    const t = frame / fps;
    rig.mixer.setTime(t + timeOffset);
    const p = path ? path(t) : position;
    rig.obj.position.set(p[0], p[1], p[2]);
    rig.obj.rotation.y = rotationY;
    rig.obj.updateMatrixWorld(true);
  }, [rig, frame, fps, path, position, rotationY, timeOffset]);

  useEffect(() => {
    if (!rig) return;
    advance(performance.now());
    continueRender(handle);
  }, [rig, advance, handle]);

  return rig ? <primitive object={rig.obj} /> : null;
};
