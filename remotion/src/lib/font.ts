import { cancelRender, continueRender, delayRender, staticFile } from "remotion";

// どのPCで書き出しても同じ見た目にするため、フォントは public/fonts の Noto Sans JP に固定する。
// 読み込めないときは別のフォントで黙って書き出さず、止める。
export const FONT = '"Noto Sans JP", sans-serif';

const handle = delayRender("font: Noto Sans JP");
const face = new FontFace("Noto Sans JP", `url(${staticFile("fonts/NotoSansJP.ttf")}) format("truetype")`, { weight: "100 900" });
/** フォントの読み込み完了。canvas に文字を描く部品（ネオンサインなど）は、これを待ってから描く */
export const FONT_READY: Promise<void> = face
  .load()
  .then(() => {
    document.fonts.add(face);
    continueRender(handle);
  })
  .catch((e) => cancelRender(new Error(`フォントを読み込めません。pipeline/fetch_data.py を実行してください: ${e}`)));
