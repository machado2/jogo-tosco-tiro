class Star extends Entity {
    constructor() {
        super(random(SCREEN_WIDTH - 80) + 40, 40, SizesConfig.star.width, SizesConfig.star.height);
        this.energy = 10; this.releaseDebris = 500;
        this.mesh = BABYLON.MeshBuilder.CreateDisc("star", { radius: 1, tessellation: 5 }, scene);
        this.mesh.material = createMaterial("star", new BABYLON.Color3(1, 1, 0)); this.mesh.renderingGroupId = 1;
        fitMeshToPixels(this.mesh, this.width, this.height); if (typeof window !== 'undefined' && typeof window.syncEntityVisual === 'function') { try { window.syncEntityVisual(this); } catch {} } else { this.updateMeshPosition(); this.updateBodyFromEntity(); }
    }
    update() { if (temporizes(10)) { if (gameState.score > 5000 && temporizes(50)) this.pulse(); if (++this.y > SCREEN_HEIGHT) this.destroy(); } if (typeof syncEntityVisual === 'function') { syncEntityVisual(this); } else { this.updateMeshPosition(); this.updateBodyFromEntity(); } }
    pulse() { for (let a = 0; a < Math.PI * 2; a += 0.05) enemyEntities.push(new Missile(this.x, this.y, Math.cos(a) * 10, Math.sin(a) * 10, false)); }
    onDestroy() { gameState.score += 100; this.pulse(); if (typeof playGameSound === 'function') playGameSound('powerup'); }
}

window.Star = Star;