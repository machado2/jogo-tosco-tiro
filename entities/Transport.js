class Transport extends Entity {
    constructor() {
        super(0, random(SCREEN_HEIGHT / 2 - 40) + 40, SizesConfig.transport.width, SizesConfig.transport.height);
        this.energy = 500; this.releaseDebris = 40;
        this.mesh = buildBasicEnemyMesh(); fitMeshToPixels(this.mesh, this.width, this.height); this.updateMeshPosition(); this.updateBodyFromEntity();
    }
    update() { if (temporizes(50)) enemyEntities.push(new Metralha(this.x, this.y)); if (temporizes(10)) this.y++; if (++this.x > SCREEN_WIDTH) this.destroy(); this.updateMeshPosition(); this.updateBodyFromEntity(); }
    onDestroy() { try { audioSystem.playExplosionBig(); } catch {} triggerShake(3.0, 20); }
}

window.Transport = Transport;