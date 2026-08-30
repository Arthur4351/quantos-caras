import Phaser from 'phaser';
export class Shop extends Phaser.Scene {
  constructor(){ super('Shop'); }
  create(){ this.add.text(960,540,'Shop',{fontSize:'32px', color:'#fff'}).setOrigin(0.5); }
}
