import Phaser from 'phaser';
import { OUTLINE } from './ink';

type G = Phaser.GameObjects.Graphics;

/**
 * Padaria de texturas. Regra de arquitetura desta direcao de arte:
 * NENHUM Graphics estatico fica vivo no display list. Toda forma chapada
 * (painel, pilula, botao, cenario) e assada UMA vez numa textura e reusada
 * como Image. O Phaser re-tesselaria cada roundedRect a cada frame — com a
 * densidade de UI que este jogo pede isso derruba o framerate.
 */

const PAD = OUTLINE + 16;

/**
 * Cria a textura `key` se ainda nao existir e devolve a key.
 * Por padrao a origem do desenho e o CENTRO da textura.
 */
export function shapeTexture(
  scene: Phaser.Scene, key: string, w: number, h: number,
  draw: (g: G) => void, centered = true
): string {
  if (scene.textures.exists(key)) return key;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  if (centered) g.translateCanvas(w / 2, h / 2);
  draw(g);
  g.generateTexture(key, Math.ceil(w), Math.ceil(h));
  g.destroy();
  return key;
}

/** Assa uma forma centrada e devolve a Image ja posicionada. */
export function shapeImage(
  scene: Phaser.Scene, x: number, y: number, key: string,
  w: number, h: number, draw: (g: G) => void
): Phaser.GameObjects.Image {
  shapeTexture(scene, key, w + PAD * 2, h + PAD * 2, draw);
  return scene.add.image(x, y, key);
}

export { PAD as SHAPE_PAD };
