import { describe, it, expect } from 'vitest';
import { RelicSystem } from '../../src/systems/RelicSystem';

describe('RelicSystem', () => {
  it('coinpurse adds 2 gold per relic', () => {
    const rs = new RelicSystem([{ id: 'coinpurse' } as any]);
    expect(rs.goldBonus()).toBe(2);
    const rs2 = new RelicSystem([{ id: 'coinpurse' } as any, { id: 'coinpurse' } as any]);
    expect(rs2.goldBonus()).toBe(4);
  });
  it('revive returns true if has revive', () => {
    const rs = new RelicSystem([{ id: 'revive' } as any]);
    expect(rs.hasRevive()).toBe(true);
  });
  it('revive false without', () => {
    const rs = new RelicSystem([{ id: 'meteor' } as any]);
    expect(rs.hasRevive()).toBe(false);
  });
  it('meteor damage 100 if owned', () => {
    const rs = new RelicSystem([{ id: 'meteor' } as any]);
    expect(rs.meteorDamage()).toBe(100);
    expect(rs.hasMeteor()).toBe(true);
  });
  it('meteor 0 if not owned', () => {
    const rs = new RelicSystem([]);
    expect(rs.meteorDamage()).toBe(0);
  });
  it('add relic', () => {
    const rs = new RelicSystem([]);
    rs.add({ id: 'coinpurse' } as any);
    expect(rs.count()).toBe(1);
  });
  it('sword gives attack bonus', () => {
    const rs = new RelicSystem([{ id: 'sword' } as any]);
    expect(rs.attackBonus()).toBeCloseTo(0.15);
  });
  it('shield gives defense bonus', () => {
    const rs = new RelicSystem([{ id: 'shield' } as any]);
    expect(rs.defenseBonus()).toBeCloseTo(0.20);
  });
  it('bomb damage 50 if owned', () => {
    const rs = new RelicSystem([{ id: 'bomb' } as any]);
    expect(rs.hasBomb()).toBe(true);
    expect(rs.bombDamage()).toBe(50);
  });
  it('reroll cost 0 with magnet, 1 with dice, 2 default', () => {
    expect(new RelicSystem([{ id: 'magnet' } as any]).rerollCost()).toBe(0);
    expect(new RelicSystem([{ id: 'dice' } as any]).rerollCost()).toBe(1);
    expect(new RelicSystem([]).rerollCost()).toBe(2);
  });
  it('crown detection', () => {
    expect(new RelicSystem([{ id: 'crown' } as any]).hasCrown()).toBe(true);
    expect(new RelicSystem([]).hasCrown()).toBe(false);
  });
});
