import Phaser from 'phaser';
import { Fighter } from './Fighter';

/**
 * Projetil dos caras de longo alcance. Era um quadradinho amarelo de 8px; agora
 * e a capsula de tinta `fx_bolt`, com rastro e rotacao na direcao do voo.
 *
 * O TIRO PRECISA SABER QUEM ATIROU. Antes disto ele chamava `target.hurt(dmg)`
 * sem assinatura, e o efeito era silencioso mas grave: quem mata de longe nunca
 * levava credito pelo abate. O vampiro nao engordava com as mortes das proprias
 * flechas, o pistoleiro nao contava tiro, o gelo do lich nao tinha de quem herdar
 * a pilha. Metade dos tracos do jogo se resolve NO instante do impacto, e esse
 * instante mora aqui.
 */
export class Projectile extends Phaser.GameObjects.Image {
  damage: number;
  target: Fighter;
  /** Quem atirou. `undefined` para tiro sem dono (chuva de estrelas, salva). */
  by?: Fighter;
  private speed: number;
  /** Aviso extra no impacto: gelo do lich, marca do elfo, troco do caixa. */
  private onHit?: (target: Fighter, dealt: number) => void;

  constructor(
    scene: Phaser.Scene, x: number, y: number, target: Fighter,
    damage = 10, speed = 900, by?: Fighter,
    onHit?: (target: Fighter, dealt: number) => void
  ) {
    super(scene, x, y, scene.textures.exists('fx_bolt') ? 'fx_bolt' : 'fx_spark');
    this.damage = damage;
    this.target = target;
    this.speed = speed;
    this.by = by;
    this.onHit = onHit;
    scene.add.existing(this);
    this.setDepth(y + 20);
    this.rotation = Phaser.Math.Angle.Between(x, y, target.x, target.y);
  }

  /** Cor da capsula. O gelo do lich voa azul, o bafo do dragao voa laranja. */
  paint(tint: number, scale = 1): this {
    this.setTint(tint).setScale(scale);
    return this;
  }

  /** Chamado pelo update da cena, com o delta em segundos. */
  step(dt: number): void {
    if (!this.active) return;
    if (!this.target || !this.target.active || !this.target.isTargetable()) {
      this.destroy();
      return;
    }
    const ang = Phaser.Math.Angle.Between(this.x, this.y, this.target.x, this.target.y - 20);
    this.rotation = ang;
    const stepLen = this.speed * dt;
    const dist = Phaser.Math.Distance.Between(this.x, this.y, this.target.x, this.target.y - 20);
    if (dist <= stepLen) {
      const dealt = this.target.hurt(this.damage, true, this.by);
      // a ordem importa: o efeito de impacto (gelo, marca) antes do credito de
      // abate, senao um alvo que morre no gelo nunca recebe a pilha que o matou.
      this.onHit?.(this.target, dealt);
      this.by?.onLanded?.(this.target, dealt);
      this.destroy();
      return;
    }
    this.x += Math.cos(ang) * stepLen;
    this.y += Math.sin(ang) * stepLen;
    this.setDepth(this.y + 20);
  }

  /** Compatibilidade com o loop antigo de 16ms. */
  update(): void { this.step(1 / 60); }
}
