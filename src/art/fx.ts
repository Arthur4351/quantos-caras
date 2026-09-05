import Phaser from 'phaser';
import { GOLD, RED, WHITE, INK, GREEN, PURPLE, ORANGE, CYAN } from './palette';

/**
 * FX DE COMBATE — a "suculencia" do jogo.
 *
 * Uma horda de 200 bichos morrendo pode pedir centenas de particulas no mesmo
 * frame. Por isso TUDO passa por um orcamento de objetos vivos por cena: se o
 * campo ja esta cheio de tinta voando, o pedido novo e simplesmente ignorado.
 * Perder uma faisca no meio de 150 e invisivel; perder 20fps nao e.
 */
const MAX_FX = 150;

const live = new WeakMap<Phaser.Scene, { n: number }>();

function slot(scene: Phaser.Scene): { n: number } {
  let s = live.get(scene);
  if (!s) {
    s = { n: 0 };
    live.set(scene, s);
    // o shutdown destroi os objetos sem rodar os onComplete: zera o contador
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { s!.n = 0; });
  }
  return s;
}

function take(scene: Phaser.Scene, n = 1): boolean {
  const s = slot(scene);
  if (s.n + n > MAX_FX) return false;
  s.n += n;
  return true;
}

function give(scene: Phaser.Scene, n = 1): void {
  const s = slot(scene);
  s.n = Math.max(0, s.n - n);
}

function kill(scene: Phaser.Scene, obj: Phaser.GameObjects.GameObject): void {
  obj.destroy();
  give(scene);
}

function spawn(scene: Phaser.Scene, key: string, x: number, y: number, depth: number): Phaser.GameObjects.Image | null {
  if (!scene.textures.exists(key)) return null;
  if (!take(scene)) return null;
  return scene.add.image(x, y, key).setDepth(depth);
}

/** Estrela de gibi no ponto de contato. O feedback mais importante do combate. */
export function hitSpark(scene: Phaser.Scene, x: number, y: number, scale = 1): void {
  const img = spawn(scene, 'fx_burst', x, y, y + 40);
  if (!img) return;
  img.setScale(0.22 * scale).setAngle(Math.random() * 90);
  scene.tweens.add({
    targets: img, scale: 0.6 * scale, alpha: 0, angle: img.angle + 46,
    duration: 190, ease: 'Quad.easeOut', onComplete: () => kill(scene, img)
  });
}

/**
 * BLOQUEIO — anelzinho seco no peito de quem aparou o golpe.
 *
 * Isto era a palavra "BLOQUEIO" flutuando. Com 21 tanques aparando 25% dos
 * golpes numa horda de 95, tres ou quatro dessas palavras nasciam no mesmo
 * frame quase no mesmo ponto e subiam juntas: virava uma mancha de letras no
 * alto do campo, longe do corpo que bloqueou, e o jogador nao tinha como saber
 * QUEM aparou. Um anel branco no peito e local, cabe no orcamento de FX e le-se
 * a 40% de zoom — a leitura que a palavra prometia e nunca entregou.
 */
export function blockClink(scene: Phaser.Scene, x: number, y: number, scale = 1): void {
  const img = spawn(scene, 'fx_ring', x, y, y + 46);
  if (!img) return;
  const d = 40 * scale;
  img.setDisplaySize(d, d).setTint(WHITE).setAlpha(0.95);
  scene.tweens.add({
    targets: img, displayWidth: d * 2.1, displayHeight: d * 2.1, alpha: 0,
    duration: 220, ease: 'Cubic.easeOut', onComplete: () => kill(scene, img)
  });
}

/** Crescente branco varrendo do punho. Da PESO ao ataque sem animar o boneco. */
export function slashArc(scene: Phaser.Scene, x: number, y: number, dirX: number, scale = 1): void {
  const img = spawn(scene, 'fx_slash', x, y, y + 30);
  if (!img) return;
  img.setOrigin(0.06, 0.5).setFlipX(dirX < 0).setScale(0.6 * scale).setAlpha(0.92).setAngle(-34 * dirX);
  scene.tweens.add({
    targets: img, angle: 34 * dirX, alpha: 0, scale: 0.86 * scale,
    duration: 165, ease: 'Cubic.easeOut', onComplete: () => kill(scene, img)
  });
}

/** Estrela dourada de critico. */
export function critStar(scene: Phaser.Scene, x: number, y: number, scale = 1): void {
  const img = spawn(scene, 'fx_star', x, y, y + 44);
  if (!img) return;
  img.setScale(0.3 * scale).setTint(GOLD);
  scene.tweens.add({
    targets: img, scale: 0.85 * scale, y: y - 34, alpha: 0, angle: 180,
    duration: 330, ease: 'Quad.easeOut', onComplete: () => kill(scene, img)
  });
}

/** Anel de choque — impacto de area e o golpe final. */
export function shockRing(scene: Phaser.Scene, x: number, y: number, size = 200, tint = WHITE): void {
  const img = spawn(scene, 'fx_ring', x, y, y + 50);
  if (!img) return;
  img.setDisplaySize(size * 0.35, size * 0.35).setTint(tint).setAlpha(0.95);
  scene.tweens.add({
    targets: img, displayWidth: size, displayHeight: size, alpha: 0,
    duration: 380, ease: 'Cubic.easeOut', onComplete: () => kill(scene, img)
  });
}

/**
 * SANGUE, DE LEVE. Pingos de tinta vermelha saem pra cima, caem e somem — o
 * suficiente para o olho registrar "morreu", longe de gore. So inimigos sangram.
 */
export function bloodBurst(scene: Phaser.Scene, x: number, y: number, scale = 1, count = 5): void {
  if (!scene.textures.exists('fx_blood')) return;
  const n = Math.max(1, Math.round(count));
  if (!take(scene, n)) return;
  for (let i = 0; i < n; i++) {
    const drop = scene.add.image(x, y, 'fx_blood').setDepth(y + 6);
    const s = (0.5 + Math.random() * 0.75) * scale;
    drop.setScale(s).setAngle(Math.random() * 360);
    const dist = (Math.random() - 0.5) * 2 * (34 + Math.random() * 66) * scale;
    const up = (26 + Math.random() * 48) * scale;
    scene.tweens.add({ targets: drop, x: x + dist, angle: drop.angle + 120, duration: 430, ease: 'Quad.easeOut' });
    scene.tweens.add({
      targets: drop, y: y - up, duration: 170, ease: 'Quad.easeOut',
      onComplete: () => scene.tweens.add({
        targets: drop, y: y + 4 + Math.random() * 12, alpha: 0, scale: s * 0.68,
        duration: 300, ease: 'Quad.easeIn', onComplete: () => kill(scene, drop)
      })
    });
  }
}

/** Mancha no chao, sob os pes de todo mundo. Fica um tempo e desbota. */
export function bloodStain(scene: Phaser.Scene, x: number, y: number, scale = 1, life = 2400): void {
  const img = spawn(scene, 'fx_splat', x + (Math.random() - 0.5) * 16, y + 4, y - 2);
  if (!img) return;
  img.setScale(0.12 * scale).setAlpha(0.8).setAngle(Math.random() * 360);
  scene.tweens.add({ targets: img, scale: 0.52 * scale, duration: 190, ease: 'Back.easeOut' });
  scene.tweens.add({ targets: img, alpha: 0, delay: life, duration: 800, onComplete: () => kill(scene, img) });
}

/** Texto que sobe e some (dano grande, "MORTE!", nomes de golpe). */
export function shoutText(scene: Phaser.Scene, x: number, y: number, txt: string, color = RED, size = 40): void {
  if (!take(scene)) return;
  const t = scene.add.text(x, y, txt, {
    fontFamily: '"Baloo 2", system-ui, sans-serif', fontSize: `${size}px`,
    color: `#${color.toString(16).padStart(6, '0')}`, stroke: '#14141c', strokeThickness: Math.max(4, size * 0.16)
  }).setOrigin(0.5).setDepth(y + 120);
  scene.tweens.add({
    targets: t, y: y - 60, alpha: 0, scale: 1.3,
    duration: 620, ease: 'Quad.easeOut', onComplete: () => kill(scene, t)
  });
}

/* ==========================================================================
 * FX DOS TRACOS DE ASSINATURA
 *
 * Cada um dos 42 caras faz uma coisa diferente, e o jogador so vai acreditar
 * nisso se cada coisa TIVER CARA PROPRIA na tela. Um numero vermelho subindo
 * serve para "levou dano"; nao serve para distinguir o cone do dragao do
 * meteoro do mago do dash do atleta.
 *
 * Todos gastam do MESMO orcamento (`MAX_FX`) das faiscas de combate: numa horda
 * de 200 os efeitos de traco simplesmente nao nascem quando a tela ja esta
 * cheia. Os que carregam GOLPE (`arcShell`, `beamDown`, `starFall`) chamam o
 * `onLand` de qualquer jeito — dano nunca depende de sobrar espaco no orcamento.
 * ======================================================================== */

/** Lambida de fogo subindo do corpo. Queimadura, bafo, panela quente. */
export function flameLick(scene: Phaser.Scene, x: number, y: number, scale = 1): void {
  const img = spawn(scene, 'fx_flame', x + (Math.random() - 0.5) * 22, y, y + 52);
  if (!img) return;
  img.setOrigin(0.5, 1).setScale(0.5 * scale).setAlpha(0.95);
  scene.tweens.add({
    targets: img, y: y - 54 * scale, scale: 0.16 * scale, alpha: 0,
    duration: 400, ease: 'Quad.easeOut', onComplete: () => kill(scene, img)
  });
}

/** Estilhaco de gelo girando. Uma pilha de frost = um estilhaco. */
export function frostShard(scene: Phaser.Scene, x: number, y: number, scale = 1): void {
  const img = spawn(scene, 'fx_ice', x + (Math.random() - 0.5) * 30, y, y + 54);
  if (!img) return;
  img.setScale(0.28 * scale).setAngle(Math.random() * 360).setAlpha(0.95);
  scene.tweens.add({
    targets: img, y: y - 40, scale: 0.62 * scale, angle: img.angle + 150, alpha: 0,
    duration: 460, ease: 'Quad.easeOut', onComplete: () => kill(scene, img)
  });
}

/** CONGELOU: cristal grande que estoura no corpo e um anel azul de frio. */
export function freezeBlock(scene: Phaser.Scene, x: number, y: number, scale = 1): void {
  shockRing(scene, x, y, 150 * scale, 0x9fd8ff);
  const img = spawn(scene, 'fx_ice', x, y, y + 60);
  if (!img) return;
  img.setScale(0.2 * scale).setAlpha(1);
  scene.tweens.add({ targets: img, scale: 1.15 * scale, duration: 170, ease: 'Back.easeOut' });
  scene.tweens.add({
    targets: img, alpha: 0, angle: 40, delay: 240,
    duration: 460, ease: 'Quad.easeIn', onComplete: () => kill(scene, img)
  });
}

/** ESCUDO GANHO: broquel que infla no peito e desbota. */
export function aegisFlare(scene: Phaser.Scene, x: number, y: number, scale = 1): void {
  const img = spawn(scene, 'fx_shield', x, y, y + 58);
  if (!img) return;
  img.setScale(0.2 * scale).setAlpha(0.98);
  scene.tweens.add({ targets: img, scale: 0.8 * scale, duration: 200, ease: 'Back.easeOut' });
  scene.tweens.add({
    targets: img, alpha: 0, y: y - 22, delay: 300,
    duration: 420, onComplete: () => kill(scene, img)
  });
}

/** ESCUDO QUEBROU: o broquel racha para os lados. Le-se "a absorcao acabou". */
export function aegisCrack(scene: Phaser.Scene, x: number, y: number, scale = 1): void {
  if (!scene.textures.exists('fx_shield')) return;
  if (!take(scene, 2)) return;
  for (const dir of [-1, 1]) {
    const half = scene.add.image(x, y, 'fx_shield').setDepth(y + 58);
    half.setScale(0.62 * scale).setAlpha(0.95).setCrop(dir < 0 ? 0 : 26, 0, 26, 56);
    scene.tweens.add({
      targets: half, x: x + dir * 46 * scale, y: y - 14, angle: dir * 60, alpha: 0,
      duration: 380, ease: 'Quad.easeOut', onComplete: () => kill(scene, half)
    });
  }
}

/** RAIZ: espinhos brotam nos pes e ficam presos enquanto o alvo esta plantado. */
export function rootSnare(scene: Phaser.Scene, x: number, y: number, ms = 900, scale = 1): void {
  const img = spawn(scene, 'fx_root', x, y + 6, y + 2);
  if (!img) return;
  img.setOrigin(0.5, 0.82).setScale(0.3 * scale, 0.1 * scale).setAlpha(0.95);
  scene.tweens.add({ targets: img, scaleX: 0.72 * scale, scaleY: 0.72 * scale, duration: 190, ease: 'Back.easeOut' });
  scene.tweens.add({
    targets: img, alpha: 0, scaleY: 0.1 * scale, delay: ms,
    duration: 260, onComplete: () => kill(scene, img)
  });
}

/**
 * MALDICAO: caveirinha roxa pairando sobre a cabeca do marcado.
 *
 * Nasce OPACA e o pop e so de escala — o mesmo padrao do `healPlus` e do
 * `freezeBlock`, e a licao que a nota do bardo custou (ver `noteFloat`): dois
 * tweens disputando o mesmo alpha e sempre bug esperando o dia em que um deles
 * perder o `delay`.
 */
export function curseGlyph(scene: Phaser.Scene, x: number, y: number, scale = 1): void {
  const img = spawn(scene, 'fx_skull', x, y, y + 62);
  if (!img) return;
  img.setScale(0.3 * scale).setAlpha(0.95);
  scene.tweens.add({ targets: img, scale: 0.66 * scale, duration: 200, ease: 'Back.easeOut' });
  scene.tweens.add({
    targets: img, y: y - 42, alpha: 0, delay: 320,
    duration: 520, ease: 'Quad.easeOut', onComplete: () => kill(scene, img)
  });
}

/** CURA: cruz verde subindo. O unico verde que sobe — nunca confunde com dano. */
export function healPlus(scene: Phaser.Scene, x: number, y: number, scale = 1): void {
  const img = spawn(scene, 'fx_plus', x + (Math.random() - 0.5) * 24, y, y + 64);
  if (!img) return;
  img.setScale(0.22 * scale).setAlpha(1);
  scene.tweens.add({ targets: img, scale: 0.56 * scale, duration: 180, ease: 'Back.easeOut' });
  scene.tweens.add({
    targets: img, y: y - 62, alpha: 0, delay: 160,
    duration: 520, ease: 'Quad.easeOut', onComplete: () => kill(scene, img)
  });
}

/**
 * BUFF MUSICAL: nota dourada gingando para cima. Bardo, barista, comandante.
 *
 * A NOTA ERA INVISIVEL. Nascia com `setAlpha(0)` e DOIS tweens simultaneos
 * disputavam o mesmo alpha: um subindo 0→1 em 170ms, outro caindo →0 em 640ms.
 * O segundo capturava o valor inicial no mesmo frame — zero — entao interpolava
 * de 0 a 0 e, rodando depois do primeiro na ordem de criacao, reescrevia alpha=0
 * a cada frame. O refrao do bardo, o cafe do barista e a ordem do comandante
 * gritavam no vazio: o traco funcionava, a nota nunca aparecia.
 *
 * Agora nasce OPACA (arte de tinta chapada nao precisa de fade-in), o pop e so
 * de escala, e um unico tween mexe no alpha — com `delay`, como o `healPlus`.
 */
export function noteFloat(scene: Phaser.Scene, x: number, y: number, scale = 1): void {
  const img = spawn(scene, 'fx_note', x, y, y + 64);
  if (!img) return;
  const side = Math.random() < 0.5 ? -1 : 1;
  img.setScale(0.24 * scale).setAlpha(1).setAngle(-12 * side);
  scene.tweens.add({ targets: img, scale: 0.5 * scale, duration: 170, ease: 'Back.easeOut' });
  scene.tweens.add({
    targets: img, x: x + side * 34, y: y - 74, angle: 14 * side, alpha: 0, delay: 150,
    duration: 640, ease: 'Sine.easeOut', onComplete: () => kill(scene, img)
  });
}

/**
 * ARCO ELETRICO entre dois pontos — o zigue-zague ESTICADO de A a B.
 *
 * Nao e um raio decorativo: e a linha que prova a ligacao. O hacker precisa
 * mostrar de QUEM para QUEM o virus foi; a ordem do comandante precisa mostrar
 * que saiu dele e chegou no aliado. Uma nuvem no meio do campo nao diria isso.
 */
export function zapArc(scene: Phaser.Scene, x1: number, y1: number, x2: number, y2: number, tint = CYAN): void {
  const img = spawn(scene, 'fx_zap', x1, y1, Math.max(y1, y2) + 70);
  if (!img) return;
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.max(24, Math.hypot(dx, dy));
  img.setOrigin(0.5, 1).setDisplaySize(30, len).setTint(tint).setAlpha(0.95);
  // nasce vertical (40x64) com o pe no ALVO: girar atan2-90 deita o corpo de
  // volta na direcao de quem lancou, e o raio aponta de A para B.
  img.setAngle(Phaser.Math.RadToDeg(Math.atan2(dy, dx)) - 90);
  img.setPosition(x2, y2);
  scene.tweens.add({
    targets: img, alpha: 0, displayWidth: 62,
    duration: 220, ease: 'Quad.easeOut', onComplete: () => kill(scene, img)
  });
}

/**
 * CORTE EM LINHA — o crescente de `slashArc` esticado numa faixa horizontal.
 *
 * O iai do samurai acerta TODO MUNDO na linha, ate 260px. Se o feedback fosse o
 * mesmo crescentezinho de sempre, o jogador veria quatro inimigos caindo juntos
 * sem entender por que. A faixa longa mostra exatamente a area que foi cortada.
 */
export function lineSlash(scene: Phaser.Scene, x: number, y: number, len: number, dirX: number, tint = WHITE): void {
  const img = spawn(scene, 'fx_slash', x, y, y + 70);
  if (!img) return;
  img.setOrigin(0.04, 0.5).setFlipX(dirX < 0).setTint(tint);
  img.setDisplaySize(len, 74).setAlpha(1).setAngle(0);
  scene.tweens.add({
    targets: img, alpha: 0, displayHeight: 128,
    duration: 260, ease: 'Cubic.easeOut', onComplete: () => kill(scene, img)
  });
}

/**
 * TIRO INDIRETO — a bala que SOBE, cruza a linha de frente e cai atras dela.
 *
 * Isto e o que separa o canhao de bordo do pirata de um dardo qualquer: o
 * projetil reto do `Projectile` bate no primeiro corpo do caminho, entao nunca
 * conseguiria alcancar a retaguarda. Aqui nao existe colisao — existe uma
 * parabola e um `onLand` no fim dela.
 *
 * `onLand` roda de qualquer jeito, mesmo sem orcamento de FX: o dano nao pode
 * depender de sobrar espaco na tela.
 */
export function arcShell(
  scene: Phaser.Scene, x0: number, y0: number, x1: number, y1: number,
  onLand: () => void, tint = INK, ms = 620
): void {
  const img = spawn(scene, 'fx_bolt', x0, y0, 9000);
  if (!img) { scene.time.delayedCall(ms, onLand); return; }
  const peak = Math.min(y0, y1) - 210 - Math.random() * 70;
  const lift = y0 - peak;
  img.setScale(0.9).setTint(tint);
  let px = x0, py = y0;
  scene.tweens.add({
    targets: img, x: x1, duration: ms, ease: 'Linear',
    onUpdate: tw => {
      const p = tw.progress;
      img.y = y0 + (y1 - y0) * p - Math.sin(Math.PI * p) * lift;
      img.setAngle(Phaser.Math.RadToDeg(Math.atan2(img.y - py, img.x - px)));
      px = img.x; py = img.y;
    },
    onComplete: () => { kill(scene, img); onLand(); }
  });
}

/**
 * QUEDA DO CEU — meteoro, estrela, feixe abduzindo. Vem de fora do campo.
 *
 * O corpo desce de -260px ate o ponto, entao a ameaca e legivel ANTES de bater
 * e o jogador tem tempo de olhar para onde vai cair. Como `arcShell`, o `onLand`
 * e garantido.
 */
export function starFall(
  scene: Phaser.Scene, x: number, y: number, onLand: () => void,
  key = 'fx_star', tint = GOLD, ms = 420, size = 1
): void {
  const img = spawn(scene, key, x + 40, y - 300, 9000);
  if (!img) { scene.time.delayedCall(ms, onLand); return; }
  img.setScale(0.34 * size).setTint(tint).setAlpha(0.98);
  scene.tweens.add({ targets: img, angle: 300, duration: ms, ease: 'Linear' });
  scene.tweens.add({
    targets: img, x, y, duration: ms, ease: 'Quad.easeIn',
    onComplete: () => { kill(scene, img); onLand(); }
  });
}

/**
 * FEIXE VERTICAL — a coluna que desce do teto do campo ate os pes do alvo.
 *
 * A abducao do alien e a chuva do starlord precisam dizer "isto veio de CIMA,
 * ninguem podia bloquear". Uma nuvem no chao diria o contrario.
 */
export function beamDown(scene: Phaser.Scene, x: number, y: number, tint = CYAN, ms = 340): void {
  const img = spawn(scene, 'fx_zap', x, y, y + 76);
  if (!img) return;
  const h = Math.max(120, y - 180);
  img.setOrigin(0.5, 1).setDisplaySize(56, h).setTint(tint).setAlpha(0.9);
  scene.tweens.add({
    targets: img, alpha: 0, displayWidth: 120,
    duration: ms, ease: 'Quad.easeOut', onComplete: () => kill(scene, img)
  });
}

/** RASTRO DE INVESTIDA: a faixa que mostra por onde o atleta passou. */
export function dashStreak(scene: Phaser.Scene, x0: number, y0: number, x1: number, y1: number, tint = WHITE): void {
  const img = spawn(scene, 'fx_slash', x0, y0, Math.max(y0, y1) + 66);
  if (!img) return;
  const dx = x1 - x0, dy = y1 - y0;
  const len = Math.max(40, Math.hypot(dx, dy));
  img.setOrigin(0.04, 0.5).setDisplaySize(len, 56).setTint(tint).setAlpha(0.85);
  img.setAngle(Phaser.Math.RadToDeg(Math.atan2(dy, dx)));
  scene.tweens.add({
    targets: img, alpha: 0, displayHeight: 100,
    duration: 300, ease: 'Cubic.easeOut', onComplete: () => kill(scene, img)
  });
}

/**
 * CONE DE BAFO — um leque de chamas, nao um circulo.
 *
 * O dragao acerta um setor de 90 graus a frente. Um `shockRing` diria "acertou
 * em volta", que e a mentira oposta: quem esta atras dele nao levou nada.
 */
export function breathCone(scene: Phaser.Scene, x: number, y: number, dirX: number, reach: number, tint = ORANGE): void {
  const n = 6;
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const ang = (-0.42 + 0.84 * t) * Math.PI * 0.5;
    const d = reach * (0.34 + Math.random() * 0.62);
    const px = x + Math.cos(ang) * d * dirX;
    const py = y - Math.sin(ang) * d * 0.42;
    const img = spawn(scene, 'fx_flame', px, py, py + 56);
    if (!img) return;
    img.setOrigin(0.5, 1).setScale(0.24).setTint(tint).setAlpha(0.95).setAngle(-dirX * 18);
    scene.tweens.add({
      targets: img, scale: 0.9 + Math.random() * 0.35, alpha: 0, y: py - 26,
      duration: 300 + i * 26, ease: 'Quad.easeOut', onComplete: () => kill(scene, img)
    });
  }
}

/** ATORDOADO: duas estrelinhas girando sobre a cabeca. Linguagem de gibi. */
export function stunSpin(scene: Phaser.Scene, x: number, y: number, ms = 900): void {
  if (!scene.textures.exists('fx_star')) return;
  if (!take(scene, 2)) return;
  for (const phase of [0, Math.PI]) {
    const s = scene.add.image(x, y, 'fx_star').setDepth(y + 80);
    s.setScale(0.2).setTint(GOLD);
    const spin = { a: phase };
    scene.tweens.add({
      targets: spin, a: phase + Math.PI * 4, duration: ms, ease: 'Linear',
      onUpdate: () => { s.x = x + Math.cos(spin.a) * 34; s.y = y - 6 + Math.sin(spin.a) * 10; }
    });
    scene.tweens.add({ targets: s, alpha: 0, delay: ms - 220, duration: 220, onComplete: () => kill(scene, s) });
  }
}

/** MOEDA DE VERDADE caindo no meio da briga. O troco do caixa. */
export function coinPop(scene: Phaser.Scene, x: number, y: number): void {
  const img = spawn(scene, 'fx_coin', x, y, y + 84);
  if (!img) return;
  img.setScale(0.34).setAlpha(1);
  const side = (Math.random() - 0.5) * 90;
  scene.tweens.add({ targets: img, x: x + side, duration: 620, ease: 'Quad.easeOut' });
  scene.tweens.add({ targets: img, scaleX: 0.06, duration: 155, yoyo: true, repeat: 2 });
  scene.tweens.add({
    targets: img, y: y - 96, duration: 340, ease: 'Quad.easeOut',
    onComplete: () => scene.tweens.add({
      targets: img, y: y - 40, alpha: 0, duration: 280, ease: 'Quad.easeIn',
      onComplete: () => kill(scene, img)
    })
  });
}

/** FUMACA: clone do ninja, sumico do espiao, chegada do entregador. */
export function smokePop(scene: Phaser.Scene, x: number, y: number, scale = 1, tint = WHITE): void {
  const img = spawn(scene, 'fx_puff', x, y, y + 10);
  if (!img) return;
  img.setOrigin(0.5, 0.8).setScale(0.3 * scale).setTint(tint).setAlpha(0.9);
  scene.tweens.add({
    targets: img, scale: 1.05 * scale, alpha: 0, y: y - 30 * scale,
    duration: 420, ease: 'Quad.easeOut', onComplete: () => kill(scene, img)
  });
}

/**
 * POEIRA DO TOMBO — o unico FX do jogo que nao tinha teto.
 *
 * Morava em `DudeSprite` e chamava `scene.add.image` direto, fora do orcamento.
 * Passava desapercebido enquanto morria um bicho de cada vez; numa wave 25, com
 * 200 corpos caindo em dois segundos, eram 200 imagens de 85px e 200 tweens no
 * mesmo lugar — e a foto do campo virava NEVOEIRO: o chao inteiro branco, com a
 * horda desenhada por cima de uma nuvem que nao acabava.
 *
 * Agora paga pedagio como todo mundo (perder um puff no meio de cem e invisivel)
 * e nasce mais transparente, entao dez sobrepostos ainda sao poeira e nao parede.
 * Depth negativo de proposito: poeira e coisa de CHAO, passa debaixo dos corpos.
 */
export function dustPuff(scene: Phaser.Scene, x: number, y: number, scale = 1): void {
  const img = spawn(scene, 'fx_puff', x, y, -2);
  if (!img) return;
  img.setScale(scale * 0.5).setAlpha(0.5);
  scene.tweens.add({
    targets: img, scale: scale * 1.1, alpha: 0, y: y - 12,
    duration: 420, ease: 'Quad.easeOut', onComplete: () => kill(scene, img)
  });
}

/**
 * O NOME DO GOLPE, curto e no alto do corpo.
 *
 * `shoutText` serve para numeros e palavras soltas. Aqui a assinatura e outra:
 * caixa alta, dourado com contorno de tinta, e SOBE MENOS — porque quando dez
 * caras diferentes estouram no mesmo segundo, texto que sobe 60px vira cortina.
 * Cabe no orcamento igual a todo o resto, entao numa horda ele simplesmente nao
 * nasce, e isso e melhor do que a tela virar legenda.
 */
export function traitCall(scene: Phaser.Scene, x: number, y: number, txt: string, color = GOLD): void {
  if (!take(scene)) return;
  const t = scene.add.text(x, y, txt, {
    fontFamily: '"Baloo 2", system-ui, sans-serif', fontSize: '26px',
    color: `#${color.toString(16).padStart(6, '0')}`, stroke: '#14141c', strokeThickness: 6
  }).setOrigin(0.5).setDepth(y + 200).setScale(0.6);
  scene.tweens.add({ targets: t, scale: 1, duration: 150, ease: 'Back.easeOut' });
  scene.tweens.add({
    targets: t, y: y - 34, alpha: 0, delay: 260,
    duration: 480, ease: 'Quad.easeOut', onComplete: () => kill(scene, t)
  });
}

/** Aliases de leitura, para o traco dizer a INTENCAO e nao a textura usada. */
export const plagueBurst = (scene: Phaser.Scene, x: number, y: number, r = 220): void => {
  shockRing(scene, x, y, r, GREEN);
  smokePop(scene, x, y, 1.4, 0x8fd46a);
};

export const soulBurst = (scene: Phaser.Scene, x: number, y: number, r = 200): void => {
  shockRing(scene, x, y, r, PURPLE);
  curseGlyph(scene, x, y - 40, 1.1);
};







