import Phaser from 'phaser';
import { validateDudes, validateWaves, fallbackDudes } from '../utils/validate';
import dudesData from '../data/dudes.json';
import wavesData from '../data/waves.json';

export class Boot extends Phaser.Scene {
  constructor() { super('Boot'); }
  preload() {
    // Use missing.png as placeholder for all sprites initially
    this.load.image('missing', 'assets/sprites/missing.png');
    // Audio - fail gracefully if files missing (handled via loaderror)
    this.load.audio('bgm', 'assets/audio/bgm.mp3');
    this.load.audio('hit', 'assets/audio/hit.wav');
    this.load.audio('coin', 'assets/audio/coin.wav');
    this.load.audio('meteor', 'assets/audio/meteor.wav');
    this.load.on('loaderror', (file: any) => {
      console.warn('loaderror', file.key, file.src);
    });
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

    // ensure missing texture exists even if load failed
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
