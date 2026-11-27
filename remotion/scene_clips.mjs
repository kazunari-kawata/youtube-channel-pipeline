// イメージ映像の場面と角度を、本編のカットと同じ長さの短い動画に書き出す（チラつきの検査用。バンドルは1回だけ）
//   node scene_clips.mjs <出力フォルダ> <場面:角度:フレーム数,...>
//   例：node scene_clips.mjs /tmp/c island_far:a:180,cellhouse:b:120
// カメラの動きはカットの長さで決まる（useInsertDur）ので、本編と同じ長さで書き出す。
// 検査は python episodes/006-alcatraz/check_scenes.py <出力フォルダ>（qa/check_video.py の scan_frames を使う）
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import path from "path";
import fs from "fs";

const [outDir, listArg] = process.argv.slice(2);
const gl = process.env.REMOTION_GL ?? (process.platform === "linux" ? "swangle" : "angle");
const chrome = process.env.REMOTION_CHROME ?? "/usr/bin/google-chrome";
const browserExecutable = process.platform === "linux" && fs.existsSync(chrome) ? chrome : null;
fs.mkdirSync(outDir, { recursive: true });
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });
for (const item of listArg.split(",")) {
  const [scene, variant = "a", n = "240"] = item.split(":");
  const inputProps = { scene, variant };
  const base = await selectComposition({ serveUrl, id: "Scene-Check", inputProps, browserExecutable, chromiumOptions: { gl } });
  const composition = { ...base, durationInFrames: Number(n) };
  const output = path.join(outDir, `${scene}_${variant}.mp4`);
  const t0 = Date.now();
  await renderMedia({ serveUrl, composition, codec: "h264", crf: 16, outputLocation: output, inputProps, browserExecutable, chromiumOptions: { gl }, concurrency: 2 });
  console.log(`${output}（${Math.round((Date.now() - t0) / 1000)}秒）`);
}
fs.rmSync(serveUrl.replace("file://", ""), { recursive: true, force: true });
