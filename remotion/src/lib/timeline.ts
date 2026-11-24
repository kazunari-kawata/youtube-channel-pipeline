import timeline from "../data/timeline.json";

/** narration.json の1区間（tts_elevenlabs.py が時刻を付けたもの） */
export type Seg = {
  id: string;
  scene?: string;
  caption: string;
  read?: string;
  tts?: string;
  chapter?: string;
  stat?: { big: string; source: string };
  start: number;
  end: number;
  startFrame: number;
  endFrame: number;
};

export const TL = timeline as unknown as { fps: number; totalSeconds: number; totalFrames: number; segments: Seg[] };
export const segs: Seg[] = TL.segments;

export const seg = (id: string): Seg => {
  const s = segs.find((x) => x.id === id);
  if (!s) throw new Error(`区間 ${id} が timeline.json にありません（narration.json と動画の定義がずれています）`);
  return s;
};
