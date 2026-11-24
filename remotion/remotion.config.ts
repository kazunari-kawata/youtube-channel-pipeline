import { Config } from "@remotion/cli/config";
import fs from "fs";

// GPU：Windows/Mac は ANGLE（GPUで描画）、GPUのない Linux クラウドは SwANGLE（CPU）。
// pipeline/render.py は REMOTION_GL を渡し、--gl でも指定する。
const gl = (process.env.REMOTION_GL ?? (process.platform === "linux" ? "swangle" : "angle")) as "angle" | "swangle";
Config.setChromiumOpenGlRenderer(gl);

// クラウドではインストール済みの Chrome を使う（Windows/Mac は Remotion が自動で用意する）
const chrome = process.env.REMOTION_CHROME ?? "/usr/bin/google-chrome";
if (process.platform === "linux" && fs.existsSync(chrome)) Config.setBrowserExecutable(chrome);
if (process.platform === "linux") Config.setConcurrency(2);

Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(92);
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
Config.setCrf(18);
