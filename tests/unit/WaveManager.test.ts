import { describe, it, expect } from 'vitest';
import { WaveManager } from '../../src/systems/WaveManager';
import waves from '../../src/data/waves.json';

describe('WaveManager', () => {
  it('wave 1 has 8 toddlers', () => {
    const wm = new WaveManager(waves as any);
    expect(wm.getWave(1).enemies[0].count).toBe(8);
  });
  it('wave 10 is gorilla boss', () => {
    const wm = new WaveManager(waves as any);
    expect(wm.getWave(10).enemies[0].type).toBe('gorilla');
  });
  it('scales hp wave 10 > wave 1', () => {
    const wm = new WaveManager(waves as any);
    expect(wm.getWave(10).enemies[0].hp).toBeGreaterThan(wm.getWave(1).enemies[0].hp);
  });
  it('getWave fallback', () => {
    const wm = new WaveManager(waves as any);
    expect(wm.getWave(99).wave).toBe(1);
  });
});
