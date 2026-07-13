export interface LevelInfo {
  level: number;
  name: string;
  floor: number;
  ceiling: number | null;
}

export const LEVELS: LevelInfo[] = [
  { level: 1, name: "Новичок", floor: 0, ceiling: 300 },
  { level: 2, name: "Младший Хастлер", floor: 300, ceiling: 600 },
  { level: 3, name: "Основатель", floor: 600, ceiling: null },
];

export function getLevelInfo(xp: number): LevelInfo {
  return LEVELS.find((entry) => xp < (entry.ceiling ?? Infinity)) ?? LEVELS[LEVELS.length - 1];
}
