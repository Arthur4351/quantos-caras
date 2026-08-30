export interface WaveData {
  wave: number;
  enemies: { type: string; count: number; hp: number; atk: number }[];
  rewardGold: number;
}
