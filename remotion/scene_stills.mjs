// イメージ映像の場面と角度を、まとめて静止画にする（バンドルは1回だけ）
//   node scene_stills.mjs <出力フォルダ> <場面:角度,場面:角度,...> [フレーム（既定 90）]
//   例：node scene_stills.mjs /tmp/s night_walk:d,police_car:c 90
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import path from "path";
import fs from "fs";

const [outDir, listArg, frameArg] = process.argv.slice(2);
const frame = Number(frameArg ?? 90);
const gl = process.env.REMOTION_GL ?? (process.platform === "linux" ? "swangle" : "angle");
const chrome = process.env.REMOTION_CHROME ?? "/usr/bin/google-chrome";
const browserExecutable = process.platform === "linux" && fs.existsSync(chrome) ? chrome : null;
fs.mkdirSync(outDir, { recursive: true });
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });
for (const item of listArg.split(",")) {
  const [scene, variant = "a"] = item.split(":");
  const inputProps = { scene, variant };
  const composition = await selectComposition({ serveUrl, id: "Scene-Check", inputProps, browserExecutable, chromiumOptions: { gl } });
  const output = path.join(outDir, `${scene}_${variant}.png`);
  await renderStill({ serveUrl, composition, frame, output, inputProps, browserExecutable, chromiumOptions: { gl },
    onBrowserLog: (l) => { if (l.type === "error") console.log("[browser]", l.text); } });
  console.log(output);
}
fs.rmSync(serveUrl.replace("file://", ""), { recursive: true, force: true }); // クラウドの /tmp が一杯になったので、使い終わったバンドルを消す
