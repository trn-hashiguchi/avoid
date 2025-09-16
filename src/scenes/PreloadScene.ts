import Phaser from 'phaser';

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('Preload');
  }

  preload() {
    // ここでは画像ファイルを使わず、すべて "生成テクスチャ" でまかなう
  }

  create() {
    this.createGeneratedTextures();
    this.scene.start('Game');
  }

  private createGeneratedTextures() {
    const g = this.add.graphics();

    // 背景グリッド（64x64）
    g.clear();
    g.fillStyle(0x0b0e14, 1);
    g.fillRect(0, 0, 64, 64);
    g.lineStyle(1, 0x101623, 1);
    g.strokeRect(0.5, 0.5, 63, 63);
    g.lineStyle(1, 0x142033, 1);
    g.beginPath();
    g.moveTo(32, 0);
    g.lineTo(32, 64);
    g.moveTo(0, 32);
    g.lineTo(64, 32);
    g.strokePath();
    g.generateTexture('grid-64', 64, 64);

    // プレイヤー（ダイヤ型＋ネオン外枠）
    g.clear();
    g.fillStyle(0x0f1322, 1);
    g.lineStyle(4, 0x00e5ff, 1);
    g.beginPath();
    g.moveTo(24, 0);
    g.lineTo(48, 24);
    g.lineTo(24, 48);
    g.lineTo(0, 24);
    g.closePath();
    g.fillPath();
    g.strokePath();
    g.generateTexture('player', 48, 48);

    // 障害物（バー）
    g.clear();
    g.fillStyle(0xff2d7a, 1);
    g.fillRoundedRect(0, 0, 24, 64, 6);
    g.generateTexture('ob-rect', 24, 64);

    // 障害物（ドット）
    g.clear();
    g.fillStyle(0xff2d7a, 1);
    g.fillCircle(10, 10, 10);
    g.generateTexture('ob-dot', 20, 20);

    // ライフアイテム（＋）
    g.clear();
    g.fillStyle(0xa0ff1a, 1);
    g.fillCircle(14, 14, 14);
    g.fillStyle(0x0b0e14, 1);
    g.fillRect(12, 5, 4, 18);
    g.fillRect(5, 12, 18, 4);
    g.generateTexture('life', 28, 28);

    g.destroy();
  }
}
