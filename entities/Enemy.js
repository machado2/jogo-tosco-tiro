class Enemy extends Entity {
  constructor() {
    // Random spawn near top, logical size per config
    super(random(SCREEN_WIDTH - 60) + 30, 30, SizesConfig.enemy.width, SizesConfig.enemy.height);
    this.energy = ENEMY_HEALTH;
    this.movement = random(8);
    this.distance = random(50);
    this.shootTime = random(100) + 20;
    this.releaseDebris = 20;
    this.phase = Math.random() * Math.PI * 2;
    this.speed = 0.8 + Math.random() * 1.4;

    // Visual
    this.mesh = buildBasicEnemyMesh();
    fitMeshToPixels(this.mesh, this.width, this.height);
    this.updateMeshPosition();
    this.updateBodyFromEntity();

    // Preserve base top-down orientation
    this.baseRotX = this.mesh.rotation.x || 0;
    this.baseRotZ = this.mesh.rotation.z || 0;

    gameState.enemyPopulation++;
  }

  update() {
    const oldX = this.x, oldY = this.y;

    // Movement patterns
    switch (this.movement) {
      case 0: this.y += this.speed; break;
      case 1: this.y -= this.speed; break;
      case 2: this.x -= this.speed; break;
      case 3: this.x += this.speed; break;
      case 4: this.y += 0.7 * this.speed; this.phase += 0.1; this.x += Math.sin(this.phase) * 1.5; break;
      case 5: this.x += 0.7 * this.speed; this.phase += 0.1; this.y += Math.sin(this.phase) * 1.5; break;
      case 6: this.y += 1.2 * this.speed; this.phase += 0.25; this.x += Math.sin(this.phase) * 2.6; break;
      case 7: {
        const dx = gameState.playerX - this.x; const dy = gameState.playerY - this.y; const ang = Math.atan2(dy, dx);
        this.x += Math.cos(ang) * 0.6 * this.speed; this.y += Math.sin(ang) * 0.6 * this.speed; this.x += Math.cos(ang + Math.PI / 2) * 0.8;
        break;
      }
    }

    // Change pattern occasionally
    if (this.distance >= 0) {
      this.distance--;
    } else {
      this.distance = random(50) + 20; this.movement = random(8); this.phase = 0; this.speed = 0.8 + Math.random() * 1.6;
    }

    // Screen bounds steering
    if (this.y - 20 < 20) { this.movement = 0; this.distance = 10; }
    if (this.y > SCREEN_HEIGHT / 2) { this.movement = 1; this.distance = 10; }
    if (this.x + 20 > SCREEN_WIDTH) { this.movement = 2; this.distance = 10; }
    if (this.x - 20 < 0) { this.movement = 3; this.distance = 10; }

    // Shooting cadence
    if (!this.shootTime) {
      this.shootTime = random(180) + 20;
      enemyEntities.push(new Missile(this.x - 9, this.y + 20, 0, 3, false));
      enemyEntities.push(new Missile(this.x + 9, this.y + 20, 0, 3, false));
    } else {
      this.shootTime--;
    }

    // Engine trail (via helper)
    if (engineFlamesEnabled && temporizes(6)) {
      if (typeof maybeEmitEngineFlame === 'function') { maybeEmitEngineFlame(this); }
      else { debrisEntities.push(new EngineFlame(this.x, this.y + this.height / 2)); }
    }

    // Banking rotation based on movement
    const vx = this.x - oldX; const vy = this.y - oldY;
    if (typeof updateBankingRotation === 'function') { updateBankingRotation(this, vx, vy); }
    else if (this.mesh) {
      const targetZ = BABYLON.Scalar.Clamp(-vx * 0.12, -1.1, 1.1);
      this.mesh.rotation.z = BABYLON.Scalar.Lerp(this.mesh.rotation.z || this.baseRotZ, this.baseRotZ + targetZ, 0.24);
      this.mesh.rotation.x = BABYLON.Scalar.Lerp(this.mesh.rotation.x || this.baseRotX, this.baseRotX, 0.24);
    }

    if (typeof syncEntityVisual === 'function') { syncEntityVisual(this); }
    else { this.updateMeshPosition(); this.updateBodyFromEntity(); }
  }

  onDestroy() {
    gameState.enemyPopulation--;
    gameState.score += POINTS_ENEMY;
    // Optionally sync visuals one last time if helper exists
    if (typeof syncEntityVisual === 'function') { try { syncEntityVisual(this); } catch {} }
    triggerShake(1.2, 8);
    // Centralized explosion sound with helper
    if (typeof playGameSound === 'function') { try { playGameSound('explosion'); } catch {} }
  }
}

window.Enemy = Enemy;