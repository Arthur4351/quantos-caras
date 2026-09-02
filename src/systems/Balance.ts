/**
 * AS CURVAS DA HORDA.
 *
 * O exercito do jogador cresce em PACOTE depois que o rancho fecha (ver
 * `copiesFor` em RunState), e exercito grande nao escala de forma linear: com o
 * dobro de caras cada um leva metade das pancadas, entao o poder efetivo sobe ao
 * quadrado. Contagem de inimigos nao acompanha isso — o frame budget nao deixa —
 * logo quem tem que subir forte e o STAT por bicho, principalmente o ATAQUE.
 */
export function curveHp(base: number, wave: number): number {
  return Math.floor(base * (1 + wave * 0.13 + wave * wave * 0.0014));
}

/**
 * Dano por bicho. Sem isto um pirralho de 4 de ataque continuava arranhando um
 * exercito de sessenta caras na wave 40: a horda dobrava de tamanho e o jogador
 * nao sentia nada. Aqui esta a dificuldade REAL do jogo tardio.
 */
export function curveAtk(base: number, wave: number): number {
  return Math.round(base * (1 + wave * 0.1 + wave * wave * 0.0009));
}

export function curveCount(base: number, wave: number): number {
  return base + Math.floor(wave * 0.8);
}

export function curveGold(base: number, wave: number): number {
  return base + Math.floor(wave * 0.6);
}
