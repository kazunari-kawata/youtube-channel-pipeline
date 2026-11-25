import React from "react";
import { Ep001 } from "./ep001-plains";
import { Ep002 } from "./ep002-dahmer";
import { Ep003 } from "./ep003-db-cooper";

/** 回のID（episodes/ のフォルダ名）→ その回の動画。新しい回を作ったらここに1行足す */
export const EPISODES: Record<string, React.FC> = {
  "001-plains": Ep001,
  "002-dahmer": Ep002,
  "003-db-cooper": Ep003,
};
