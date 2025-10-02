class Missile extends Entity {
    constructor(x, y, velX, velY, friendly = true) {
        super(x, y, SizesConfig.missile.width, SizesConfig.missile.height);
        this.velX = velX; this.velY = velY; this.friendly = friendly; this.energy = 1; this.releaseDebris = 4;
        this.mesh = BABYLON.MeshBuilder.CreateSphere("missile", { diameter: 1 }, scene);
        this.mesh.material = createMaterial("missile", new BABYLON.Color3(0, 1, 0)); this.mesh.renderingGroupId = 1;
        fitMeshToPixels(this.mesh, this.width, this.height); if (typeof window !== 'undefined' && typeof window.syncEntityVisual === 'function') { try { window.syncEntityVisual(this); } catch {} } else { this.updateMeshPosition(); this.updateBodyFromEntity(); }
    }
    update() {
        this.x += this.velX; this.y += this.velY;
        if (this.isOffScreen()) this.destroy();
        if (typeof window !== 'undefined' && typeof window.syncEntityVisual === 'function') { try { window.syncEntityVisual(this); } catch {} } else { this.updateMeshPosition(); this.updateBodyFromEntity(); }
    }
}

window.Missile = Missile;