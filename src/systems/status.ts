/**
 * ESTADOS — o que um traco de assinatura consegue GRUDAR num combatente.
 *
 * Antes disto o unico jeito de um cara afetar outro era somar um numero no dano.
 * Fogo, gelo, raiz, escudo e maldicao nao existiam, e por isso 42 personagens
 * diferentes acabavam todos fazendo a mesma coisa com valores diferentes.
 *
 * O saco de estados e um objeto de campos FIXOS, criado uma vez por combatente e
 * mutado no lugar. Num pico de ~440 unidades no campo, um Map ou um array de
 * efeitos por unidade viraria lixo de GC a 60 passos por segundo.
 *
 * Convencao: todo campo em segundos conta para baixo e para em 0. Campo de
 * potencia (`slowPow`, `vulnPow`) so vale enquanto o tempo do par for > 0.
 */

export interface StatusBag {
  /** QUEIMANDO: dano por segundo enquanto durar. */
  burn: number;
  burnDps: number;
  /** LENTO: -slowPow na velocidade de ataque E de passo. */
  slow: number;
  slowPow: number;
  /** ATORDOADO: nao ataca, nao anda. */
  stun: number;
  /** ENRAIZADO: nao anda, mas continua atacando. */
  root: number;
  /** Pontos de absorcao. Comem o dano antes da vida. */
  shield: number;
  /** VULNERAVEL (marca/maldicao): leva +vulnPow de todo mundo. */
  vuln: number;
  vulnPow: number;
  /** Invulneravel por um instante. */
  immune: number;
  /** Some da mira de quem ataca de longe. */
  evasive: number;
  /** Desvia 1 golpe a cada N que chegam. 0 = nunca. */
  dodgeEvery: number;
  /** Sob controle do outro lado. */
  charm: number;
  /** Fora do campo (abduzido). */
  suspend: number;
  /** Pilhas de gelo: na quarta, congela. */
  frost: number;
  /** Surto de velocidade de ataque (cafe do barista). */
  rush: number;
  rushPow: number;
  /** GUARDA: leva -guardPow de todo dano. Cobertura do robo. */
  guard: number;
  guardPow: number;
  /** Fuma o bafo do dragao / a panela do cozinheiro: so enfeite, conta o tempo. */
  mark: number;
}

export function emptyStatus(): StatusBag {
  return {
    burn: 0, burnDps: 0, slow: 0, slowPow: 0, stun: 0, root: 0, shield: 0,
    vuln: 0, vulnPow: 0, immune: 0, evasive: 0, dodgeEvery: 0, charm: 0,
    suspend: 0, frost: 0, rush: 0, rushPow: 0, guard: 0, guardPow: 0, mark: 0
  };
}

/**
 * A MEMORIA DE UM TRACO DE ASSINATURA, em campos fixos.
 *
 * Cada traco precisa contar alguma coisa: o samurai conta golpes ate o quinto, o
 * fantasma conta golpes recebidos ate a esquiva, o cauboi conta balas ate a
 * recarga. Um `Map<string, number>` por combatente seria o obvio — e seria lixo
 * de GC com 440 corpos em campo. Entao os contadores sao SEMPRE estes, criados
 * uma vez no nascimento e mutados no lugar; cada traco usa os que precisa.
 */
export interface TraitState {
  /** O `onSpawn` ja rodou? O motor dispara no primeiro passo, nao no construtor. */
  born: boolean;
  /** Golpes DADOS. "Todo quinto ataque" sai daqui. */
  hits: number;
  /** Golpes RECEBIDOS. A esquiva do fantasma sai daqui. */
  taken: number;
  /** Pilhas (furia do barbaro, calor do ciborgue, sede do vampiro). */
  stacks: number;
  /** Relogio pessoal do traco, em segundos. */
  cd: number;
  /** Segundo relogio (recarga do cauboi, vida do clone, brotar do druida). */
  timer: number;
  /** Gatilho de uma vez por batalha (viking, caveira). */
  used: boolean;
  /** Ultimo alvo visto, por id de objeto — troca de alvo zera rampas. */
  aimId: number;
  /** Acumulador livre (ouro do caixa, rampa do bardo, tamanho do ossudo). */
  acc: number;
  /** Segundo acumulador. Quem escala precisa guardar DOIS numeros de fabrica
   * (o ataque base e a vida base) para recalcular sem acumular erro. */
  acc2: number;
  /**
   * Este corpo ja foi aproveitado pelo necromante? Sem isto ele reergueria o
   * mesmo cadaver a cada 2 segundos e o campo viraria uma fabrica de esqueletos.
   */
  risen: boolean;
}

export function emptyTraitState(): TraitState {
  return {
    born: false, hits: 0, taken: 0, stacks: 0, cd: 0, timer: 0,
    used: false, aimId: 0, acc: 0, acc2: 0, risen: false
  };
}

/** Qualquer coisa que carregue um saco de estados. Evita importar Fighter aqui
 * e criar ciclo entre a entidade e o sistema. */
export interface Statused { st: StatusBag; maxHp: number; }

/**
 * TODO APLICADOR E MAX-VENCE, NUNCA SOMA.
 *
 * Este e o unico motivo pelo qual o jogo sobrevive a um rancho fechado. Ali o
 * jogador empilha ate 160 CORPOS DO MESMO CARA: se lentidao somasse, dois liches
 * paravam a horda no lugar; se escudo somasse, trinta paladinos davam escudo
 * maior que a vida do time inteiro. Somando duracao, o efeito nunca acabaria.
 *
 * Com max-vence, a trigesima copia nao empilha efeito — ela empilha FREQUENCIA
 * (o efeito recomeca mais vezes por segundo), que e o jeito honesto de uma copia
 * extra valer algo sem quebrar o jogo.
 */
export function applyBurn(t: Statused, seconds: number, dps: number): void {
  if (seconds > t.st.burn) t.st.burn = seconds;
  if (dps > t.st.burnDps) t.st.burnDps = dps;
}

export function applySlow(t: Statused, seconds: number, power: number): void {
  if (seconds > t.st.slow) t.st.slow = seconds;
  if (power > t.st.slowPow) t.st.slowPow = Math.min(0.75, power);
}

export function applyStun(t: Statused, seconds: number): void {
  if (seconds > t.st.stun) t.st.stun = seconds;
}

export function applyRoot(t: Statused, seconds: number): void {
  if (seconds > t.st.root) t.st.root = seconds;
}

export function applyVuln(t: Statused, seconds: number, power: number): void {
  if (seconds > t.st.vuln) t.st.vuln = seconds;
  if (power > t.st.vulnPow) t.st.vulnPow = power;
}

export function applyImmune(t: Statused, seconds: number): void {
  if (seconds > t.st.immune) t.st.immune = seconds;
}

export function applyRush(t: Statused, seconds: number, power: number): void {
  if (seconds > t.st.rush) t.st.rush = seconds;
  if (power > t.st.rushPow) t.st.rushPow = power;
}

/** GUARDA: reducao chapada de dano. Teto de 60% — nada vira imortal. */
export function applyGuard(t: Statused, seconds: number, power: number): void {
  if (seconds > t.st.guard) t.st.guard = seconds;
  if (power > t.st.guardPow) t.st.guardPow = Math.min(0.6, power);
}

/** LIMPA: tira tudo que e ruim e deixa o que e bom. O banquete do cozinheiro. */
export function cleanse(t: Statused): boolean {
  const s = t.st;
  const had = s.burn > 0 || s.slow > 0 || s.root > 0 || s.vuln > 0 || s.stun > 0 || s.frost > 0;
  s.burn = 0; s.burnDps = 0;
  s.slow = 0; s.slowPow = 0;
  s.root = 0; s.stun = 0; s.frost = 0;
  s.vuln = 0; s.vulnPow = 0;
  return had;
}

/** Escudo tambem e max-vence, e o teto e uma fracao da vida maxima do alvo. */
export function addShield(t: Statused, points: number): void {
  const cap = Math.max(20, t.maxHp * 0.6);
  const want = Math.min(points, cap);
  if (want > t.st.shield) t.st.shield = want;
}
/**
 * GELO: pilha em cima do alvo e CONGELA na quarta. As pilhas somam de proposito
 * — e a unica coisa aqui que soma, porque a graca do gelo negro e ver a horda
 * travando aos poucos. O congelamento em si e um `stun`, que e max-vence.
 */
export function addFrost(t: Statused, seconds = 1.2): boolean {
  t.st.frost = Math.min(4, t.st.frost + 1);
  if (t.st.frost < 4) return false;
  t.st.frost = 0;
  applyStun(t, seconds);
  return true;
}

/** Desconta um passo de todos os relogios. Chamado uma vez por combatente por passo. */
export function tickStatus(t: Statused, dt: number): void {
  const s = t.st;
  if (s.burn > 0 && (s.burn -= dt) <= 0) { s.burn = 0; s.burnDps = 0; }
  if (s.slow > 0 && (s.slow -= dt) <= 0) { s.slow = 0; s.slowPow = 0; }
  if (s.vuln > 0 && (s.vuln -= dt) <= 0) { s.vuln = 0; s.vulnPow = 0; }
  if (s.rush > 0 && (s.rush -= dt) <= 0) { s.rush = 0; s.rushPow = 0; }
  if (s.guard > 0 && (s.guard -= dt) <= 0) { s.guard = 0; s.guardPow = 0; }
  if (s.mark > 0 && (s.mark -= dt) < 0) s.mark = 0;
  if (s.stun > 0 && (s.stun -= dt) < 0) s.stun = 0;
  if (s.root > 0 && (s.root -= dt) < 0) s.root = 0;
  if (s.immune > 0 && (s.immune -= dt) < 0) s.immune = 0;
  if (s.evasive > 0 && (s.evasive -= dt) < 0) s.evasive = 0;
  if (s.charm > 0 && (s.charm -= dt) < 0) s.charm = 0;
  if (s.suspend > 0 && (s.suspend -= dt) < 0) s.suspend = 0;
  // pilha de gelo esfria sozinha se o alvo escapar
  if (s.frost > 0) {
    s.frost -= dt * 0.5;
    if (s.frost < 0) s.frost = 0;
  }
}

/** Multiplicador de velocidade (ataque e passo) vindo dos estados. */
export function statusSpeed(s: StatusBag): number {
  let m = 1;
  if (s.slow > 0) m *= 1 - s.slowPow;
  if (s.rush > 0) m *= 1 + s.rushPow;
  return m;
}

export function canAct(s: StatusBag): boolean { return s.stun <= 0 && s.suspend <= 0; }
export function canMove(s: StatusBag): boolean { return s.stun <= 0 && s.root <= 0 && s.suspend <= 0; }

/**
 * A COR DO ESTADO — a unica forma de ler 200 corpos de uma vez.
 *
 * Um icone flutuando sobre cada cabeca custaria um sprite por estado por unidade
 * e viraria uma sopa de simbolos na horda. O CORPO INTEIRO mudar de cor le-se de
 * relance mesmo a 40% de zoom: azul-claro travou, laranja pega fogo, rosa virou
 * a casaca. Devolve 0 quando nao ha nada a dizer.
 */
export function statusTint(s: StatusBag): number {
  if (s.stun > 0) return 0x9fd8ff;
  if (s.charm > 0) return 0xff8fd0;
  if (s.burn > 0) return 0xff9a3c;
  if (s.root > 0) return 0x8fd46a;
  if (s.vuln > 0) return 0xd9a3ff;
  if (s.slow > 0) return 0xaec4ff;
  if (s.shield > 0) return 0xc9f0ff;
  return 0;
}

