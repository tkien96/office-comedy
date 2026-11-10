import type { CharacterDesign, CharacterId } from "./types";

// One fixed design per character, reused in every scene and every episode.

export const NAM: CharacterDesign = {
  id: "nam",
  displayName: "Nam",
  skin: "#f6c9a0",
  skinShade: "#e3ab7d",
  hair: "#22201f",
  hairShade: "#3a3532",
  hairStyle: "namShort",
  shirt: "#3b82f6",
  shirtShade: "#2563eb",
  collar: "#dbeafe",
  pants: "#334155",
  shoes: "#1f2937",
  bodyWidth: 1,
  scale: 1,
  glasses: false,
  tie: null,
  lanyard: "#1d4ed8",
  hairClip: null,
};

export const LINH: CharacterDesign = {
  id: "linh",
  displayName: "Linh",
  skin: "#f8d2b0",
  skinShade: "#e8b48b",
  hair: "#3b2418",
  hairShade: "#55352a",
  hairStyle: "linhLong",
  shirt: "#f97316",
  shirtShade: "#ea580c",
  collar: "#ffedd5",
  pants: "#3f3f46",
  shoes: "#7c2d12",
  bodyWidth: 0.92,
  scale: 0.96,
  glasses: false,
  tie: null,
  lanyard: null,
  hairClip: "#fde047",
};

export const SEP: CharacterDesign = {
  id: "sep",
  displayName: "Sếp",
  skin: "#efc095",
  skinShade: "#d9a273",
  hair: "#4b4b4b",
  hairShade: "#9ca3af",
  hairStyle: "sepReceding",
  shirt: "#eef2f7",
  shirtShade: "#cfd8e3",
  collar: "#ffffff",
  pants: "#1e293b",
  shoes: "#111827",
  bodyWidth: 1.14,
  scale: 1.02,
  glasses: true,
  tie: "#1e3a8a",
  lanyard: null,
  hairClip: null,
};

export const CHARACTERS: Record<CharacterId, CharacterDesign> = {
  nam: NAM,
  linh: LINH,
  sep: SEP,
};

export const CHARACTER_BIOS: Record<CharacterId, string> = {
  nam: "~30 tuổi · áo xanh · cả nể, muốn làm hiệu quả nhưng hay tự đưa mình vào thế khó",
  linh: "~28 tuổi · áo cam · nhanh trí, thực tế, lúc giúp Nam lúc vì lợi ích riêng",
  sep: "45–50 tuổi · sơ mi sáng · mê số liệu và quy trình, không mặc định là người xấu",
};
