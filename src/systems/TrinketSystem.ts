export interface TrinketData { id: string; name: string; bonusAtk?: number; bonusHp?: number; bonusRange?: number; bonusMove?: number; bonusAS?: number; bonusCrit?: number; description?: string; }

export class TrinketSystem {
  private equipped = new Map<string, TrinketData>();

  equip(dudeId: string, trinket: TrinketData): void {
    this.equipped.set(dudeId, trinket);
  }

  getBonus(dudeId: string): TrinketData {
    return this.equipped.get(dudeId) || ({} as TrinketData);
  }

  unequip(dudeId: string): void {
    this.equipped.delete(dudeId);
  }

  has(dudeId: string): boolean {
    return this.equipped.has(dudeId);
  }

  all(): Map<string, TrinketData> {
    return new Map(this.equipped);
  }

  clear(): void {
    this.equipped.clear();
  }
}
