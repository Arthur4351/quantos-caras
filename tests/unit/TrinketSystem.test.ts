import { describe, it, expect } from 'vitest';
import { TrinketSystem } from '../../src/systems/TrinketSystem';

describe('TrinketSystem', () => {
  it('equip gives bonus', () => {
    const ts = new TrinketSystem();
    ts.equip('knight', { id: 'gloves', bonusAtk: 5 } as any);
    expect(ts.getBonus('knight').bonusAtk).toBe(5);
  });
  it('has and unequip', () => {
    const ts = new TrinketSystem();
    ts.equip('zombie', { id: 'boots', bonusMove: 20 } as any);
    expect(ts.has('zombie')).toBe(true);
    ts.unequip('zombie');
    expect(ts.has('zombie')).toBe(false);
  });
  it('all returns map', () => {
    const ts = new TrinketSystem();
    ts.equip('a', { id: 'ring', bonusAtk: 8 } as any);
    expect(ts.all().size).toBe(1);
  });
});
