export interface LevelInfo {
  level: number;
  nameKey: "levelNovice" | "levelJuniorHustler" | "levelFounder";
  floor: number;
  ceiling: number | null;
}

export const LEVELS: LevelInfo[] = [
  { level: 1, nameKey: "levelNovice", floor: 0, ceiling: 300 },
  { level: 2, nameKey: "levelJuniorHustler", floor: 300, ceiling: 600 },
  { level: 3, nameKey: "levelFounder", floor: 600, ceiling: null },
];

export function getLevelInfo(xp: number): LevelInfo {
  return LEVELS.find((entry) => xp < (entry.ceiling ?? Infinity)) ?? LEVELS[LEVELS.length - 1];
}
