import Phaser from 'phaser';

type ObKind = 'drop' | 'diag' | 'sine';

export class GameScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keyA!: Phaser.Input.Keyboard.Key;
  private keyD!: Phaser.Input.Keyboard.Key;
  private leftTouch = false;
  private rightTouch = false;

  private obstacles!: Phaser.Physics.Arcade.Group;
  private items!: Phaser.Physics.Arcade.Group;

  private grid!: Phaser.GameObjects.TileSprite;

  private lives = 1;
  private maxLives = 3;
  private invincibleUntil = 0;

  private startAt = 0;
  private elapsedMs = 0;
  private bestMs = 0;

  private running = false;
  private spawnTimer?: Phaser.Time.TimerEvent;

  // 難易度カーブ（平均45秒狙い。調整用）
  private readonly BASE_SPEED = 180;       // 初期落下px/s
  private readonly SPEED_PER_SEC = 4.5;    // 秒あたり加速
  private readonly BASE_SPAWN_MS = 900;    // 初期出現間隔ms
  private readonly MIN_SPAWN_MS = 260;     // 最小間隔ms
  private readonly SPAWN_EASE = 11;        // 毎秒で短縮するms（大きいとキツい）
  private readonly RARE_ITEM_PROB = 0.005; // 0.5% 程度（極稀）

  constructor() {
    super('Game');
  }

  create() {
    const { width, height } = this.scale;

    // 背景グリッド（パララックス）
    this.grid = this.add.tileSprite(0, 0, width, height, 'grid-64')
      .setOrigin(0)
      .setAlpha(0.6);

    // プレイヤー
    this.player = this.physics.add.sprite(width / 2, height - 80, 'player');
    this.player.setCollideWorldBounds(true);
    this.player.setCircle(16, 8, 8); // おおざっぱな当たり判定（丸）
    this.player.setDepth(10);

    // グループ
    this.obstacles = this.physics.add.group({ runChildUpdate: false });
    this.items = this.physics.add.group({ runChildUpdate: false });

    // 入力
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keyA = this.input.keyboard.addKey('A');
    this.keyD = this.input.keyboard.addKey('D');

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      const left = p.x < this.cameras.main.width / 2;
      this.leftTouch = left;
      this.rightTouch = !left;
    });
    this.input.on('pointerup', () => {
      this.leftTouch = this.rightTouch = false;
    });

    // 衝突
    this.physics.add.overlap(this.player, this.obstacles, this.onHit, undefined, this);
    this.physics.add.overlap(this.player, this.items, this.onGetLife, undefined, this);

    // HUD
    this.addHUD();

    // スタート待ち
    this.bestMs = Number(localStorage.getItem('yokerudake.best') || 0);
    this.showTitle();
  }

  update(time: number, delta: number) {
    // 背景のゆっくりスクロール
    this.grid.tilePositionY += delta * 0.03;

    if (!this.running) return;

    this.elapsedMs = time - this.startAt;

    // プレイヤー移動
    const spd = 340;
    let vx = 0;
    if (this.cursors.left?.isDown || this.keyA.isDown || this.leftTouch) vx = -spd;
    else if (this.cursors.right?.isDown || this.keyD.isDown || this.rightTouch) vx = spd;
    this.player.setVelocityX(vx);

    // 障害物の挙動更新（sine）
    this.obstacles.children.iterate((obj: Phaser.GameObjects.GameObject | undefined) => {
      const s = obj as Phaser.Physics.Arcade.Sprite;
      if (!s?.active) return;
      const kind = s.getData('kind') as ObKind | undefined;

      if (kind === 'sine') {
        const t0 = s.getData('t0') as number;
        const amp = s.getData('amp') as number;
        const freq = s.getData('freq') as number;
        const t = (this.time.now - t0) / 1000;
        s.setVelocityX(Math.sin(t * Math.PI * 2 * freq) * amp);
      }

      // 画面外で掃除
      const w = this.scale.width, h = this.scale.height;
      if (s.y > h + 80 || s.x < -80 || s.x > w + 80) {
        s.destroy();
      }
    });

    // HUD 更新
    this.events.emit('hud:update', this.elapsedMs, this.lives);
  }

  // ===== ゲーム開始 / 終了 =====
  private startGame = () => {
    this.running = true;
    this.lives = 1;
    this.invincibleUntil = 0;
    this.player.setPosition(this.scale.width / 2, this.scale.height - 80);
    this.player.setVelocity(0, 0);

    // 既存の敵/アイテムを掃除
    this.obstacles.clear(true, true);
    this.items.clear(true, true);

    this.startAt = this.time.now;
    this.elapsedMs = 0;

    this.scheduleNextSpawn();
  };

  private gameOver() {
    this.running = false;
    if (this.spawnTimer) this.spawnTimer.remove(false);

    const final = this.elapsedMs;
    if (final > this.bestMs) {
      this.bestMs = final;
      localStorage.setItem('yokerudake.best', String(this.bestMs));
    }

    this.showGameOver(final, this.bestMs);
  }

  // ===== スポーン =====
  private scheduleNextSpawn() {
    const t = this.elapsedMs / 1000;
    const interval = Math.max(this.MIN_SPAWN_MS, this.BASE_SPAWN_MS - t * this.SPAWN_EASE);
    this.spawnTimer = this.time.delayedCall(interval, () => {
      this.spawnWave(t);
      this.scheduleNextSpawn();
    });
  }

  private spawnWave(t: number) {
    // スピード・強さ
    const vy = this.BASE_SPEED + this.SPEED_PER_SEC * t;

    // 1〜3体スポーン
    const n = Phaser.Math.Between(1, 1 + Math.min(2, Math.floor(t / 12)));
    for (let i = 0; i < n; i++) {
      const kind: ObKind = this.pickKind(t);
      this.spawnObstacle(kind, vy);
    }

    // 極稀アイテム
    if (Math.random() < this.RARE_ITEM_PROB) {
      this.spawnLife(vy * 0.8);
    }
  }

  private pickKind(t: number): ObKind {
    // 時間が経つほど s i n e / diag が増える
    const pSine = Phaser.Math.Clamp(0.1 + t * 0.02, 0.1, 0.55);
    const pDiag = Phaser.Math.Clamp(0.15 + t * 0.02, 0.15, 0.55);
    const r = Math.random();
    if (r < pSine) return 'sine';
    if (r < pSine + pDiag) return 'diag';
    return 'drop';
  }

  private spawnObstacle(kind: ObKind, vy: number) {
    const w = this.scale.width, h = this.scale.height;

    if (kind === 'drop') {
      const x = Phaser.Math.Between(24, w - 24);
      const s = this.obstacles.create(x, -40, 'ob-rect') as Phaser.Physics.Arcade.Sprite;
      s.setVelocity(0, vy);
      s.setData('kind', 'drop');
      s.setCircle(10, 2, 22);
      s.setRotation(Math.PI * 0.5 * (Math.random() > 0.5 ? 1 : -1));
      return;
    }

    if (kind === 'diag') {
      const fromLeft = Math.random() < 0.5;
      const x = fromLeft ? -30 : w + 30;
      const y = Phaser.Math.Between(40, h * 0.5);
      const s = this.obstacles.create(x, y, 'ob-rect') as Phaser.Physics.Arcade.Sprite;
      const vx = (fromLeft ? 1 : -1) * (vy * (0.5 + Math.random() * 0.4));
      s.setVelocity(vx, vy * (0.6 + Math.random() * 0.3));
      s.setData('kind', 'diag');
      s.setCircle(10, 2, 22);
      s.setAngle(fromLeft ? 25 : -25);
      return;
    }

    // sine（左右に振れながら降下）
    const x = Phaser.Math.Between(24, w - 24);
    const s = this.obstacles.create(x, -30, 'ob-dot') as Phaser.Physics.Arcade.Sprite;
    s.setVelocity(0, vy * (0.8 + Math.random() * 0.2));
    s.setData('kind', 'sine');
    s.setData('t0', this.time.now);
    s.setData('amp', Phaser.Math.Between(120, 220));
    s.setData('freq', Phaser.Math.FloatBetween(0.6, 1.3));
    s.setCircle(10, 0, 0);
  }

  private spawnLife(vy: number) {
    const w = this.scale.width;
    const x = Phaser.Math.Between(20, w - 20);
    const s = this.items.create(x, -20, 'life') as Phaser.Physics.Arcade.Sprite;
    s.setVelocity(0, vy);
    s.setCircle(12, 2, 2);
    s.setAlpha(0.95);
    this.tweens.add({ targets: s, y: s.y + 6, duration: 400, yoyo: true, repeat: -1 });
  }

  // ===== 衝突処理 =====
  private onHit = (player: Phaser.GameObjects.GameObject, ob: Phaser.GameObjects.GameObject) => {
    if (!this.running) return;
    if (this.time.now < this.invincibleUntil) return;

    this.lives -= 1;

    // ダメージ演出＋無敵
    this.invincibleUntil = this.time.now + 1000;
    this.tweens.add({
      targets: this.player,
      alpha: 0.2,
      duration: 80,
      yoyo: true,
      repeat: 8
    });

    if (this.lives <= 0) {
      this.gameOver();
    }
  };

  private onGetLife = (_player: Phaser.GameObjects.GameObject, item: Phaser.GameObjects.GameObject) => {
    item.destroy();
    if (this.lives < this.maxLives) this.lives += 1;
    this.addSparkle(this.player.x, this.player.y, 0xa0ff1a);
  };

  private addSparkle(x: number, y: number, color: number) {
    const p = this.add.particles(0, 0, 'ob-dot', {
      x, y, tint: color, speed: 80, lifespan: 450, scale: { start: 1, end: 0 }, quantity: 12
    });
    this.time.delayedCall(500, () => p.destroy());
  }

  // ===== HUD / タイトル / リザルト =====
  private addHUD() {
    const w = this.scale.width;
    const tTime = this.add.text(16, 12, '00.00', { fontFamily: 'Orbitron, sans-serif', fontSize: '28px', color: '#e9f1ff' }).setDepth(20);
    const tLife = this.add.text(w - 16, 12, 'LIFE: 1', { fontFamily: 'Orbitron, sans-serif', fontSize: '20px', color: '#a0ff1a' }).setOrigin(1, 0).setDepth(20);

    this.events.on('hud:update', (ms: number, lives: number) => {
      tTime.setText((ms / 1000).toFixed(2) + 's');
      tLife.setText('LIFE: ' + lives);
    });
  }

  private showTitle() {
    const { width: w, height: h } = this.scale;
    const overlay = this.add.rectangle(0, 0, w, h, 0x000000, 0.35).setOrigin(0).setDepth(30);
    const title = this.add.text(w / 2, h * 0.34, '避けるだけ.com', {
      fontFamily: 'Orbitron, sans-serif',
      fontSize: '48px',
      color: '#00e5ff'
    }).setOrigin(0.5).setDepth(30);
    const sub = this.add.text(w / 2, h * 0.46, '左右で避けろ。生き延びろ。', {
      fontFamily: 'Orbitron, sans-serif', fontSize: '18px', color: '#e9f1ff'
    }).setOrigin(0.5).setDepth(30);
    const how = this.add.text(w / 2, h * 0.58, '← → / A D / 画面タップ', {
      fontFamily: 'Orbitron, sans-serif', fontSize: '16px', color: '#a0ff1a'
    }).setOrigin(0.5).setDepth(30);
    const press = this.add.text(w / 2, h * 0.70, 'クリック / タップ / スペース で開始', {
      fontFamily: 'Orbitron, sans-serif', fontSize: '20px', color: '#ff2d7a'
    }).setOrigin(0.5).setDepth(30);

    const start = () => {
      [overlay, title, sub, how, press].forEach(o => o.destroy());
      this.startGame();
      this.input.keyboard.off('keydown-SPACE', start);
      this.input.off('pointerdown', start);
    };

    this.input.keyboard.once('keydown-SPACE', start);
    this.input.once('pointerdown', start);
  }

  private showGameOver(finalMs: number, bestMs: number) {
    const { width: w, height: h } = this.scale;

    const overlay = this.add.rectangle(0, 0, w, h, 0x000000, 0.5).setOrigin(0).setDepth(40);
    const title = this.add.text(w / 2, h * 0.38, 'GAME OVER', {
      fontFamily: 'Orbitron, sans-serif',
      fontSize: '48px',
      color: '#ff2d7a'
    }).setOrigin(0.5).setDepth(40);

    const score = this.add.text(w / 2, h * 0.50,
      `TIME  ${ (finalMs/1000).toFixed(2) }s\nBEST  ${ (bestMs/1000).toFixed(2) }s`,
      { fontFamily: 'Orbitron, sans-serif', fontSize: '22px', color: '#e9f1ff', align: 'center' }
    ).setOrigin(0.5).setDepth(40);

    const retry = this.add.text(w / 2, h * 0.64, 'もう一度（R / クリック / タップ）', {
      fontFamily: 'Orbitron, sans-serif', fontSize: '20px', color: '#00e5ff'
    }).setOrigin(0.5).setDepth(40);

    const restart = () => {
      [overlay, title, score, retry].forEach(o => o.destroy());
      this.startGame();
      this.input.keyboard.off('keydown-R', restart);
      this.input.off('pointerdown', restart);
    };

    this.input.keyboard.once('keydown-R', restart);
    this.input.once('pointerdown', restart);
  }
}
