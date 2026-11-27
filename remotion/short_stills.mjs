// ショートの確認用の静止画：node short_stills.mjs <出力フォルダ> <id> <フレーム,…>（例：/tmp/sh 002a 0,60,360）
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import path from "path";
import fs from "fs";
const [outDir, id, framesArg] = process.argv.slice(2);
const browserExecutable = "/usr/bin/google-chrome";
fs.mkdirSync(outDir, { recursive: true });
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts"), publicDir: path.resolve("public") });
const inputProps = { id };
const composition = await selectComposition({ serveUrl, id: "Short", inputProps, browserExecutable, chromiumOptions: { gl: "swangle" } });
for (const f of framesArg.split(",").map(Number)) {
  const output = path.join(outDir, `f${String(f).padStart(5, "0")}.png`);
  await renderStill({ serveUrl, composition, frame: f, output, inputProps: composition.props, browserExecutable, scale: 1.5, chromiumOptions: { gl: "swangle" } });
  console.log(output);
}
fs.rmSync(serveUrl.replace("file://", ""), { recursive: true, force: true });
