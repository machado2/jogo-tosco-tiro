class Guided extends Entity {
    constructor(x, y) {
        super(x, y, SizesConfig.guided.width, SizesConfig.guided.height);
        this.energy = 1; this.velX = 0; this.velY = 0; this.time = 0; this.releaseDebris = 5;
        this.mesh = BABYLON.MeshBuilder.CreateSphere("guided", { diameter: 1 }, scene);
        this.mesh.material = createMaterial("guided", new BABYLON.Color3(1, 0, 1)); this.mesh.renderingGroupId = 1;
        fitMeshToPixels(this.mesh, this.width, this.height); if (typeof window !== 'undefined' && typeof window.syncEntityVisual === 'function') { try { window.syncEntityVisual(this); } catch {} } else { this.updateMeshPosition(); this.updateBodyFromEntity(); }
    }
    update() {
        let dx = this.x - gameState.playerX; let dy = this.y - gameState.playerY; let dist = distance(this.x, this.y, gameState.playerX, gameState.playerY) || 1;
        dx = dx / dist / 5; dy = dy / dist / 5; this.velX = (this.velX - dx) * 0.99; this.velY = (this.velY - dy) * 0.99;
        this.x += this.velX; this.y += this.velY; if (++this.time > 1000) this.destroy(); if (typeof window !== 'undefined' && typeof window.syncEntityVisual === 'function') { try { window.syncEntityVisual(this); } catch {} } else { this.updateMeshPosition(); this.updateBodyFromEntity(); }
    }
    onDestroy() { gameState.score++; }
}

window.Guided = Guided;