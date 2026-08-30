import { describe, it, expect } from 'vitest';
import { DailySystem } from '../../src/systems/DailySystem';

describe('DailySystem', () => {
  it('same date same seed', () => {
    const ds = new DailySystem();
    expect(ds.getSeed('2026-08-30')).toBe(ds.getSeed('2026-08-30'));
  });
  it('different date different seed', () => {
    const ds = new DailySystem();
    expect(ds.getSeed('2026-08-30')).not.toBe(ds.getSeed('2026-08-31'));
  });
  it('daily dudes deterministic', () => {
    const ds = new DailySystem();
    const a = ds.getDailyDudes(undefined as any, ds.getSeed('2026-08-30'));
    const b = ds.getDailyDudes(undefined as any, ds.getSeed('2026-08-30'));
    expect(a.map(d => d.id)).toEqual(b.map(d => d.id));
  });
  it('isDailyAvailable', () => {
    const ds = new DailySystem();
    expect(ds.isDailyAvailable('2026-08-29', '2026-08-30')).toBe(true);
    expect(ds.isDailyAvailable('2026-08-30', '2026-08-30')).toBe(false);
  });
});
