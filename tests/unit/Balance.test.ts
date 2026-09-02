import { describe, it, expect } from 'vitest';
import { curveAtk, curveCount, curveGold, curveHp } from '../../src/systems/Balance';

/**
 * Nada aqui repete a formula: um teste que reescreve `1 + wave*0.13` do lado de
 * fora nao testa nada, so proibe o ajuste de balanceamento. O que importa e a
 * FORMA da curva — cresce sempre, cresce mais que linear, e nunca devolve
 * fracao de ponto de vida.
 */
describe('Balance / curva de vida', () => {
  it('a wave 1 ja e mais dura que o stat base', () => {
    expect(curveHp(20, 1)).toBeGreaterThan(20);
  });
  it('cresce sem nenhum degrau para tras', () => {
    for (let w = 1; w < 100; w++) {
      expect(curveHp(20, w + 1)).toBeGreaterThan(curveHp(20, w));
    }
  });
  it('acelera: o pulo de 40 para 41 e maior que o de 5 para 6', () => {
    expect(curveHp(20, 41) - curveHp(20, 40)).toBeGreaterThan(curveHp(20, 6) - curveHp(20, 5));
  });
  it('o chefe da wave 10 dobra de tamanho e o deus da 100 e absurdo', () => {
    expect(curveHp(800, 10)).toBeGreaterThan(1600);
    expect(curveHp(5000, 100)).toBeGreaterThan(50000);
  });
  it('sempre inteiro', () => {
    for (const w of [1, 7, 23, 64, 100]) expect(curveHp(18, w) % 1).toBe(0);
  });
});

/**
 * O ATAQUE e a dificuldade do jogo tardio: o exercito empilha copias, e horda
 * grande sem dano nenhum e cenario, nao ameaca.
 */
describe('Balance / curva de ataque', () => {
  it('cresce sempre e sem fracao', () => {
    for (let w = 1; w < 100; w++) {
      expect(curveAtk(4, w + 1)).toBeGreaterThanOrEqual(curveAtk(4, w));
      expect(curveAtk(4, w) % 1).toBe(0);
    }
  });
  it('o pirralho da wave 40 machuca de verdade', () => {
    expect(curveAtk(4, 40)).toBeGreaterThan(curveAtk(4, 1) * 4);
  });
  it('sobe menos que a vida — o combate nao pode virar one-shot', () => {
    expect(curveAtk(1, 60)).toBeLessThan(curveHp(1, 60));
  });
});

describe('Balance / contagem e ouro', () => {
  it('count scales', () => {
    expect(curveCount(8, 10)).toBe(16);
    expect(curveCount(8, 50)).toBeGreaterThan(40);
  });
  it('a recompensa acompanha a wave', () => {
    expect(curveGold(5, 20)).toBeGreaterThan(curveGold(5, 1));
  });
});
