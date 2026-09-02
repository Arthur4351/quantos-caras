import Phaser from 'phaser';
import { validateDudes, validateWaves, fallbackDudes } from '../utils/validate';
import { buildAllTextures } from '../art/textures';
import dudesData from '../data/dudes.json';
import wavesData from '../data/waves.json';

export class Boot extends Phaser.Scene {
  constructor() { super('Boot'); }
  preload() {
    /**
     * SEM AUDIO — E DE PROPOSITO, NAO ESQUECIMENTO.
     *
     * `public/assets/audio/` tinha quatro arquivos de 44 bytes: cabecalho WAV vazio,
     * zero amostras (e o `bgm.mp3` era um WAV com extensao errada). O navegador
     * baixava os quatro, falhava em decodificar os quatro, e o console do jogo
     * abria com OITO erros vermelhos mais quatro promessas rejeitadas — em toda
     * carga, para tocar silencio. Todo `sound.play` do projeto ja passa por
     * `cache.audio.exists`, entao nao carregar nada nao muda uma virgula do jogo:
     * so cala o boot. Quando existir som de verdade, os `load.audio` voltam aqui.
     */
  }
  create() {
    try {
      validateDudes(dudesData);
      validateWaves(wavesData);
      this.cache.json.add('dudes', dudesData as any);
      this.cache.json.add('waves', wavesData as any);
    } catch (e) {
      console.error('Validation failed, using fallback', e);
      this.cache.json.add('dudes', fallbackDudes as any);
      this.cache.json.add('waves', wavesData as any);
    }

    // Toda a arte e gerada por codigo: 42 dudes + inimigos + FX + backdrop.
    buildAllTextures(this);

    // Fallback de ultima instancia caso a geracao falhe.
    if (!this.textures.exists('missing')) {
      const g = this.add.graphics();
      g.fillStyle(0xff00ff, 1);
      g.fillRect(0, 0, 64, 64);
      g.generateTexture('missing', 64, 64);
      g.destroy();
    }

    // Audio setup - try to play BGM if loaded, otherwise silent
    try {
      if (this.cache.audio.exists('bgm')) {
        const music = this.sound.add('bgm', { loop: true, volume: 0.35 });
        if (!this.sound.locked) {
          music.play();
        } else {
          this.sound.once(Phaser.Sound.Events.UNLOCKED, () => music.play());
        }
        // mute toggle is handled per-scene via M key
      }
    } catch (e) {
      console.warn('Audio init failed', e);
    }

    this.scene.start('Menu');
  }
}
