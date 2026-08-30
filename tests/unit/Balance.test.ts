import { describe, it, expect } from 'vitest';
import { curveHp, curveCount } from '../../src/systems/Balance';

describe('Balance curve', () => {
  it('wave 1 hp = base*1.12', () => {
    expect(curveHp(20, 1)).toBeCloseTo(Math.floor(20 * (1 + 1 * 0.12 + 1 * 0.001)));
  });
  it('wave 10 gorilla scaling', () => {
    expect(curveHp(800, 10)).toBeGreaterThan(1500);
    expect(curveHp(800, 10)).toBe(Math.floor(800 * (1 + 10 * 0.12 + 100 * 0.001)));
  });
  it('wave 100 god huge', () => {
    expect(curveHp(5000, 100)).toBeGreaterThan(50000);
  });
  it('count scales', () => {
    expect(curveCount(8, 10)).toBe(16);
    expect(curveCount(8, 50)).toBeGreaterThan(40);
  });
});
