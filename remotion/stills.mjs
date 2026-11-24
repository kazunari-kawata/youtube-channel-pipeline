// 静止画をまとめて書き出す（バンドルは1回だけ）
//   node stills.mjs <出力フォルダ> <フレーム,フレーム,...> [scale] [コンポジションID（既定 Main）]
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import path from "path";
import fs from "fs";

const [outDir, framesArg, scaleArg, compId = "Main"] = process.argv.slice(2);
const frames = framesArg.split(",").map(Number);
const scale = Number(scaleArg ?? 1);
const gl = process.env.REMOTION_GL ?? (process.platform === "linux" ? "swangle" : "angle");
const chrome = process.env.REMOTION_CHROME ?? "/usr/bin/google-chrome";
const browserExecutable = process.platform === "linux" && fs.existsSync(chrome) ? chrome : null;

const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });
const composition = await selectComposition({ serveUrl, id: compId, browserExecutable, chromiumOptions: { gl } });
for (const frame of frames) {
  const output = path.join(outDir, `${compId === "Main" ? "f" : compId + "_"}${String(frame).padStart(5, "0")}.png`);
  await renderStill({
    serveUrl, composition, frame, output, scale, browserExecutable, chromiumOptions: { gl },
    onBrowserLog: (l) => { if (l.type === "error") console.log("[browser]", l.text); },
  });
  console.log(output);
}
