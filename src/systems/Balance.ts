export function curveHp(base: number, wave: number): number {
  return Math.floor(base * (1 + wave * 0.12 + wave * wave * 0.001));
}
export function curveCount(base: number, wave: number): number {
  return base + Math.floor(wave * 0.8);
}
export function curveGold(base: number, wave: number): number {
  return base + Math.floor(wave * 0.6);
}
export function simulateWinRate(dudes: number, wave: number): number {
  // stub for balance simulation: winrate drops 2% per wave after 10, increases 5% per dude
  const base = 0.9 - Math.max(0, wave - 10) * 0.02 + (dudes - 5) * 0.05;
  return Math.max(0.05, Math.min(0.95, base));
}
