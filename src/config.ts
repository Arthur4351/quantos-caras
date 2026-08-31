import Phaser from 'phaser';
import { Boot } from './scenes/Boot';
import { Menu } from './scenes/Menu';
import { Shop } from './scenes/Shop';
import { Battle } from './scenes/Battle';
import { Reward } from './scenes/Reward';
import { GameOver } from './scenes/GameOver';
import { DailyDude } from './scenes/DailyDude';

export const phaserConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 1920,
  height: 1080,
  parent: 'game',
  backgroundColor: '#7ed1f5',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  render: { pixelArt: false, antialias: true, roundPixels: false },
  physics: { default: 'arcade', arcade: { debug: false } },
  scene: [Boot, Menu, Shop, Battle, Reward, GameOver, DailyDude]
};
