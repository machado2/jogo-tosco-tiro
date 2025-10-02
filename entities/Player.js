class Player extends Entity {
    constructor() {
        super(SCREEN_WIDTH / 2, SCREEN_HEIGHT - 80, SizesConfig.player.width, SizesConfig.player.height);
        this.energy = MAX_HEALTH; this.charge = MAX_CHARGE; this.shootTime = 0; this.releaseDebris = 80;
        this.mesh = buildPlayerShipMesh();
        fitMeshToPixels(this.mesh, this.width, this.height);
        if (typeof window !== 'undefined' && typeof window.syncEntityVisual === 'function') { try { window.syncEntityVisual(this); } catch {} } else { this.updateMeshPosition(); this.updateBodyFromEntity(); }
        if (highlightLayer) {
            try {
                const defaultColor = new BABYLON.Color3(0.12, 0.4, 0.8);
                if (this.mesh.getChildren && !(this.mesh instanceof BABYLON.AbstractMesh)) {
                    this.mesh.getChildren().filter(m => m instanceof BABYLON.Mesh).forEach(m => {
                        m.metadata = m.metadata || {}; m.metadata.persistHL = true; m.metadata.defaultHLColor = defaultColor; highlightLayer.addMesh(m, defaultColor);
                    });
                } else {
                    this.mesh.metadata = this.mesh.metadata || {}; this.mesh.metadata.persistHL = true; this.mesh.metadata.defaultHLColor = defaultColor; highlightLayer.addMesh(this.mesh, defaultColor);
                }
            } catch {}
        }
        this.engineGlow = null;
        try { if (this.mesh.getChildren) { this.engineGlow = this.mesh.getChildren().find(c => c && c.name === 'engineGlow'); } } catch {}
        this.baseRotX = this.mesh.rotation.x || 0; this.baseRotZ = this.mesh.rotation.z || 0;
        gameState.playerAlive = true;
    }
    update() {
        const dx = gameState.cursorX - this.x; const dy = gameState.cursorY - this.y; const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        if (dist > 20) { this.x += (dx * 20) / dist; this.y += (dy * 20) / dist; } else { this.x = gameState.cursorX; this.y = gameState.cursorY; }
        this.keepOnScreen();
        const vx = this.x - this.prevX; const vy = this.y - this.prevY;
        if (typeof updateBankingRotation === 'function') { updateBankingRotation(this, vx, vy, 1.1, 0.26, 0.11); }
        else if (this.mesh) {
            const targetZ = BABYLON.Scalar.Clamp(-vx * 0.11, -1.1, 1.1);
            this.mesh.rotation.z = BABYLON.Scalar.Lerp(this.mesh.rotation.z || this.baseRotZ, this.baseRotZ + targetZ, 0.26);
            this.mesh.rotation.x = BABYLON.Scalar.Lerp(this.mesh.rotation.x || this.baseRotX, this.baseRotX, 0.26);
        }
        this.prevX = this.x; this.prevY = this.y;
        if (this.charge < MAX_CHARGE) this.charge = Math.min(MAX_CHARGE, this.charge + CHARGE_REFILL_PER_FRAME);
        if (this.shootTime < 1000) this.shootTime++;
        if (this.charge >= 20 && this.shootTime >= 5 && gameState.leftButton) {
            this.shootTime = 0; this.charge -= 1;
            if (gameState.score >= 500) { this.shoot('laser'); } else { this.shoot('missile', { velY: -10, friendly: true }); }
        }
        if (gameState.rightButton && this.charge >= MAX_CHARGE && this.shootTime) { this.pulse(); this.charge = 0; this.shootTime = 0; if (typeof playGameSound === 'function') playGameSound('special'); }
        if (gameState.rightButton && this.charge >= 150 && this.shootTime > 50) { this.pulse(0.3); this.charge -= 50; this.shootTime = 0; if (typeof playGameSound === 'function') playGameSound('special'); }
        if (this.charge >= MAX_CHARGE && this.energy < MAX_HEALTH && temporizes(10)) this.energy++;
        if (engineFlamesEnabled && temporizes(2)) { if (typeof maybeEmitEngineFlame === 'function') maybeEmitEngineFlame(this, -4); else debrisEntities.push(new EngineFlame(this.x, this.y + this.height / 2 - 4)); }
        try {
            if (typeof updatePlayerHighlight === 'function') { updatePlayerHighlight(this); }
            if (typeof updateEngineGlow === 'function') { updateEngineGlow(this); }
        } catch {}
        gameState.playerHealth = this.energy; gameState.playerCharge = this.charge; gameState.playerX = this.x; gameState.playerY = this.y;
        if (typeof window !== 'undefined' && typeof window.syncEntityVisual === 'function') { try { window.syncEntityVisual(this); } catch {} } else { this.updateMeshPosition(); this.updateBodyFromEntity(); }
    }
    pulse(inc = 0.05) { for (let a = 0; a < Math.PI * 2; a += inc) friendlyEntities.push(new Missile(this.x, this.y, Math.cos(a) * 10, Math.sin(a) * 10, true)); }
    onDestroy() { gameState.enemyPopulation--; if (typeof playGameSound === 'function') playGameSound('explosion_big'); triggerShake(6, 50); gameState.deathSequenceFrames = DEATH_OVERLAY_DELAY_FRAMES; }
    takeDamage(dmg) { if (typeof flashDamageOverlay === 'function') { try { flashDamageOverlay(); } catch {} } if (typeof playGameSound === 'function') playGameSound('hit'); return super.takeDamage(dmg); }
}

window.Player = Player;