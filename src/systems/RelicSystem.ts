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
