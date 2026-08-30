import { describe, it, expect } from 'vitest';
import { calculateDamage, BattleSystem } from '../../src/systems/BattleSystem';

describe('calculateDamage', () => {
  it('applies synergy', () => {
    expect(calculateDamage(10, 0.15)).toBeCloseTo(11.5);
  });
  it('no synergy', () => {
    expect(calculateDamage(10, 0)).toBe(10);
  });
  it('clamps not negative', () => {
    expect(calculateDamage(10, -2)).toBe(0);
  });
});

describe('BattleSystem checkWin', () => {
  const bs = new BattleSystem();
  it('win when all enemies dead', () => {
    const dudes = [{ isAlive: () => true } as any];
    const enemies = [{ isAlive: () => false } as any, { isAlive: () => false } as any];
    expect(bs.checkWin(dudes, enemies)).toBe('win');
  });
  it('lose when all dudes dead', () => {
    const dudes = [{ isAlive: () => false } as any];
    const enemies = [{ isAlive: () => true } as any];
    expect(bs.checkWin(dudes, enemies)).toBe('lose');
  });
  it('ongoing otherwise', () => {
    const dudes = [{ isAlive: () => true } as any];
    const enemies = [{ isAlive: () => true } as any];
    expect(bs.checkWin(dudes, enemies)).toBe('ongoing');
  });
});
