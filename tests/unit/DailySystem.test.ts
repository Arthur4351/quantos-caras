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

  /** O rancho cabe 5 TIPOS: um pool com repetido entrega menos que cinco tipos. */
  it('o pool do dia tem cinco caras DIFERENTES', () => {
    const ds = new DailySystem();
    for (const date of ['2026-08-30', '2026-09-01', '2026-12-25', '2027-01-01', '2026-02-29']) {
      const ids = ds.getDailyDudes(undefined as any, ds.getSeed(date)).map(d => d.id);
      expect(ids).toHaveLength(5);
      expect(new Set(ids).size).toBe(5);
    }
  });

  describe('placar local', () => {
    const ds = new DailySystem();
    it('grava a primeira tentativa', () => {
      const board = ds.recordRun(null, { date: '2026-09-01', wave: 7, victory: false });
      expect(board).toEqual([{ date: '2026-09-01', wave: 7, victory: false }]);
    });
    it('uma linha por dia — fica a melhor', () => {
      let board = ds.recordRun(null, { date: '2026-09-01', wave: 7, victory: false });
      board = ds.recordRun(board, { date: '2026-09-01', wave: 3, victory: false });
      expect(board).toHaveLength(1);
      expect(board[0].wave).toBe(7);
      board = ds.recordRun(board, { date: '2026-09-01', wave: 12, victory: false });
      expect(board[0].wave).toBe(12);
    });
    it('vitoria supera wave maior sem vitoria no mesmo dia', () => {
      let board = ds.recordRun(null, { date: '2026-09-01', wave: 40, victory: false });
      board = ds.recordRun(board, { date: '2026-09-01', wave: 100, victory: true });
      expect(board[0].victory).toBe(true);
    });
    it('ordena vitorias primeiro, depois wave, e respeita o teto', () => {
      let board: any = null;
      for (let d = 1; d <= 20; d++) {
        board = ds.recordRun(board, { date: `2026-09-${String(d).padStart(2, '0')}`, wave: d, victory: d === 5 });
      }
      expect(board).toHaveLength(12);
      expect(board[0]).toEqual({ date: '2026-09-05', wave: 5, victory: true });
      expect(board[1].wave).toBe(20);
      expect(board.map((r: any) => r.wave).slice(1)).toEqual([20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10]);
    });
    it('sobrevive a um placar corrompido no localStorage', () => {
      const board = ds.recordRun([null, { date: 'x' }] as any, { date: '2026-09-01', wave: 4, victory: false });
      expect(board).toEqual([{ date: '2026-09-01', wave: 4, victory: false }]);
    });
  });
});
