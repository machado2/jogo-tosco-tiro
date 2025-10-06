// Entity: Player (globals)

class Player extends Entity {
    constructor() {
        super(SCREEN_WIDTH / 2, SCREEN_HEIGHT - 80, 48, 48);
        this.energy = MAX_HEALTH; this.charge = MAX_CHARGE; this.shootTime = 0;
        this.releaseDebris = 80;
        this.mesh = buildPlayerShipMesh();
        fitMeshToPixels(this.mesh, this.width, this.height); this.updateMeshPosition();
        if (highlightLayer) { try { highlightLayer.addMesh(this.mesh, new BABYLON.Color3(0.2, 0.6, 1)); } catch {} }
        gameState.playerAlive = true;
    }
    update() {
        const dx = gameState.cursorX - this.x; const dy = gameState.cursorY - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        if (dist > 20) { this.x += (dx * 20) / dist; this.y += (dy * 20) / dist; } else { this.x = gameState.cursorX; this.y = gameState.cursorY; }
        this.keepOnScreen();
        const vx = this.x - this.prevX; const vy = this.y - this.prevY;
        if (this.mesh) {
            this.mesh.rotation.z = BABYLON.Scalar.Lerp(this.mesh.rotation.z || 0, -vx * 0.03, 0.2);
            this.mesh.rotation.x = BABYLON.Scalar.Lerp(this.mesh.rotation.x || 0, vy * 0.02, 0.2);
        }
        this.prevX = this.x; this.prevY = this.y;
        if (this.charge < MAX_CHARGE) this.charge = Math.min(MAX_CHARGE, this.charge + CHARGE_REFILL_PER_FRAME);
        if (this.shootTime < 1000) this.shootTime++;
        if (this.charge >= 20 && this.shootTime >= 5 && gameState.leftButton) {
            this.shootTime = 0; this.charge -= 10;
            if (gameState.score >= 500) { friendlyEntities.push(new Laser()); audioSystem.playLaser(); }
            else { friendlyEntities.push(new Missile(this.x, this.y - 5, 0, -10, true)); audioSystem.playShoot(); }
        }
        if (gameState.rightButton && this.charge >= MAX_CHARGE && this.shootTime) { this.pulse(); this.charge = 0; this.shootTime = 0; audioSystem.playSpecial(); }
        if (gameState.rightButton && this.charge >= 150 && this.shootTime > 50) { this.pulse(0.3); this.charge -= 50; this.shootTime = 0; audioSystem.playSpecial(); }
        if (this.charge >= MAX_CHARGE && this.energy < MAX_HEALTH && temporizes(10)) this.energy++;
        // Removido efeito de partícula/flame sob a nave
        // if (engineFlamesEnabled && temporizes(2)) debrisEntities.push(new EngineFlame(this.x, this.y + this.height / 2 - 4));
        gameState.playerHealth = this.energy; gameState.playerCharge = this.charge; gameState.playerX = this.x; gameState.playerY = this.y;
        this.updateMeshPosition();
    }
    pulse(inc = 0.05) { for (let a = 0; a < Math.PI * 2; a += inc) friendlyEntities.push(new Missile(this.x, this.y, Math.cos(a) * 10, Math.sin(a) * 10, true)); }
    onDestroy() { gameState.enemyPopulation--; audioSystem.playExplosionBig(); triggerShake(6, 50); gameState.deathSequenceFrames = DEATH_OVERLAY_DELAY_FRAMES; }
    takeDamage(dmg) { try { const el = document.getElementById('damage-overlay'); if (el) { el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 120); } } catch {} if (audioSystem && audioSystem.initialized) { try { audioSystem.playHit(); } catch {} } return super.takeDamage(dmg); }
}