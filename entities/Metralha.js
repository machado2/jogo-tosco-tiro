class Metralha extends Entity {
    constructor(x = null, y = null) {
        if (x === null) { x = random(SCREEN_WIDTH - 96) + 48; y = 48; }
        super(x, y, SizesConfig.metralha.width, SizesConfig.metralha.height);
        this.energy = 10; this.releaseDebris = 100;
        this.mesh = buildBasicEnemyMesh(); fitMeshToPixels(this.mesh, this.width, this.height); this.updateMeshPosition(); this.updateBodyFromEntity();
    }
    update() {
        if (temporizes(25)) {
            const dx = gameState.playerX - this.x; const dy = gameState.playerY - this.y; let dist = Math.sqrt(dx * dx + dy * dy) || 1;
            enemyEntities.push(new Missile(this.x, this.y, (dx * 5) / dist, (dy * 5) / dist, false));
        }
        if (temporizes(10)) { this.y++; if (this.isOffScreen()) this.destroy(); }
        this.updateMeshPosition(); this.updateBodyFromEntity();
    }
    onDestroy() { gameState.score += POINTS_METRALHA; try { audioSystem.playExplosion(); } catch {} triggerShake(1.5, 10); }
}

window.Metralha = Metralha;