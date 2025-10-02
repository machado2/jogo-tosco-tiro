class Rain extends Entity {
    constructor(x = null, y = null) {
        if (x === null) { x = random(SCREEN_WIDTH - 40) + 20; y = 40; }
        super(x, y, SizesConfig.rain.width, SizesConfig.rain.height);
        this.energy = 100; this.radius = 0; this.releaseDebris = 15;
        this.mesh = buildBasicEnemyMesh(); this.mesh.renderingGroupId = 1;
        fitMeshToPixels(this.mesh, this.width, this.height); this.updateMeshPosition(); this.updateBodyFromEntity();
    }
    update() {
        if (temporizes(10)) { this.y++; if (++this.radius >= 5) { enemyEntities.push(new Guided(this.x, this.y)); this.radius = 0; } }
        if (temporizes(100)) { for (let i = Math.PI / 4; i <= 3 * Math.PI / 4; i += 0.1) enemyEntities.push(new Missile(this.x, this.y, 2 * Math.cos(i), 2 * Math.sin(i), false)); if (this.y + 20 > SCREEN_HEIGHT) this.destroy(); }
        this.updateMeshPosition(); this.updateBodyFromEntity();
    }
    onDestroy() { gameState.score += POINTS_CHUVA; try { audioSystem.playExplosionBig(); } catch {} }
}

window.Rain = Rain;