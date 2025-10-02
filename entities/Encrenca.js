class Encrenca extends Entity {
    constructor() {
        super(0, random(SCREEN_HEIGHT / 2 - 40) + 40, SizesConfig.encrenca.width, SizesConfig.encrenca.height);
        this.energy = 500; this.releaseDebris = 200;
        this.mesh = buildBasicEnemyMesh(); fitMeshToPixels(this.mesh, this.width, this.height); this.updateMeshPosition(); this.updateBodyFromEntity();
    }
    update() { if (temporizes(100)) enemyEntities.push(new Rain(this.x, this.y)); if (temporizes(10)) this.y++; if (++this.x > SCREEN_WIDTH) this.destroy(); if (typeof syncEntityVisual === 'function') { syncEntityVisual(this); } else { this.updateMeshPosition(); this.updateBodyFromEntity(); } }
    onDestroy() { if (typeof playGameSound === 'function') playGameSound('explosion_big'); }
}

window.Encrenca = Encrenca;