import Phaser from 'phaser';
import { GOLD, RED, WHITE } from './palette';

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
