import { RelicData } from '../types/RelicData';

export class RelicSystem {
  constructor(private relics: RelicData[] = []) {}

  goldBonus(): number {
    return this.relics.filter(r => r.id === 'coinpurse').length * 2;
  }

  hasRevive(): boolean {
    return this.relics.some(r => r.id === 'revive');
  }

  meteorDamage(): number {
    return this.relics.some(r => r.id === 'meteor') ? 100 : 0;
  }

  hasMeteor(): boolean {
    return this.relics.some(r => r.id === 'meteor');
  }

  attackBonus(): number {
    return this.relics.filter(r => r.id === 'sword').length * 0.15;
  }

  defenseBonus(): number {
    return this.relics.filter(r => r.id === 'shield').length * 0.20;
  }

  hasFreeReroll(): boolean {
    return this.relics.some(r => r.id === 'magnet');
  }

  rerollCost(): number {
    if (this.hasFreeReroll()) return 0;
    return this.relics.some(r => r.id === 'dice') ? 1 : 2;
  }

  costReduction(): number {
    return this.relics.filter(r => r.id === 'anvil').length * 1;
  }

  hasBomb(): boolean {
    return this.relics.some(r => r.id === 'bomb');
  }

  bombDamage(): number {
    return this.hasBomb() ? 50 : 0;
  }

  hasCrown(): boolean {
    return this.relics.some(r => r.id === 'crown');
  }

  add(relic: RelicData): void {
    this.relics.push(relic);
  }

  getAll(): RelicData[] {
    return [...this.relics];
  }

  count(): number {
    return this.relics.length;
  }
}
