// 長い動画を区間（チャンク）に分けて書き出す。途中で止まっても、次に動かすと書き出し済みの区間は飛ばして続きから。
//   node render_chunks.mjs <出力フォルダ> [区間の秒数=20] [使う時間の上限（分）=9] [scale=1]
//   ショート：COMP=Short PROPS='{"id":"003a"}' node render_chunks.mjs <出力フォルダ> 5 100 1.5
// 時間の上限を過ぎたら、新しい区間を始めずに終わる（終了コード 3 ＝まだ残りがある）。全部そろったら終了コード 0。
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import fs from "fs";
import path from "path";

const [outDir, chunkSecArg = "20", budgetArg = "9", scaleArg = "1"] = process.argv.slice(2);
const t0 = Date.now();
const budgetMs = Number(budgetArg) * 60 * 1000;
const gl = process.env.REMOTION_GL ?? (process.platform === "linux" ? "swangle" : "angle");
const chrome = process.env.REMOTION_CHROME ?? "/usr/bin/google-chrome";
const browserExecutable = process.platform === "linux" && fs.existsSync(chrome) ? chrome : null;
fs.mkdirSync(outDir, { recursive: true });

const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });
const inputProps = process.env.PROPS ? JSON.parse(process.env.PROPS) : {};
const composition = await selectComposition({ serveUrl, id: process.env.COMP ?? "Main", inputProps, browserExecutable, chromiumOptions: { gl } });
const per = Math.round(Number(chunkSecArg) * composition.fps);
const n = Math.ceil(composition.durationInFrames / per);
fs.writeFileSync(path.join(outDir, "plan.json"), JSON.stringify({ frames: composition.durationInFrames, per, n }));

let done = 0;
for (let i = 0; i < n; i++) {
  const out = path.join(outDir, `c${String(i).padStart(4, "0")}.mp4`);
  if (fs.existsSync(out)) { done++; continue; }
  if (Date.now() - t0 > budgetMs) break;
  const a = i * per;
  const b = Math.min(composition.durationInFrames - 1, a + per - 1);
  const tmp = out + ".part.mp4";
  const s = Date.now();
  await renderMedia({
    serveUrl, composition, inputProps: composition.props, codec: "h264", crf: 20, outputLocation: tmp, frameRange: [a, b],
    scale: Number(scaleArg), browserExecutable, chromiumOptions: { gl }, muted: true,
    onBrowserLog: (l) => { if (l.type === "error") console.log("[browser]", l.text); },
  });
  fs.renameSync(tmp, out); // 書き終わってから名前を付ける（途中で止まった区間を書き出し済みと見なさない）
  done++;
  console.log(`区間 ${i + 1}/${n}（フレーム ${a}-${b}）${((Date.now() - s) / 1000).toFixed(0)}秒`);
}
console.log(`書き出し済み ${done}/${n}`);
process.exit(done === n ? 0 : 3);
