class EngineFlame extends Entity {
    constructor(x, y) {
        super(x, y, SizesConfig.engineFlame.width, SizesConfig.engineFlame.height);
        this.life = 14; this.velX = (Math.random() - 0.5) * 2; this.velY = 2 + Math.random() * 1.5;
        this.mesh = BABYLON.MeshBuilder.CreateDisc("engineFlame", { radius: 0.5, tessellation: 16 }, scene);
        const mat = createMaterial("engineFlameMat", new BABYLON.Color3(1.0, 0.5, 0.1)); this.mesh.material = mat;
        this.mesh.renderingGroupId = 1; this.mesh.billboardMode = BABYLON.AbstractMesh.BILLBOARDMODE_ALL; this.mesh.material.alpha = 0.8;
        fitMeshToPixels(this.mesh, this.width, this.height); registerGlowMesh(this.mesh); if (typeof window !== 'undefined' && typeof window.syncEntityVisual === 'function') { try { window.syncEntityVisual(this); } catch {} } else { this.updateMeshPosition(); this.updateBodyFromEntity(); }
    }
    update() { this.x += this.velX; this.y += this.velY; if (this.mesh && this.mesh.material) this.mesh.material.alpha *= 0.88; if (--this.life <= 0) this.destroy(); if (typeof window !== 'undefined' && typeof window.syncEntityVisual === 'function') { try { window.syncEntityVisual(this); } catch {} } else { this.updateMeshPosition(); this.updateBodyFromEntity(); } }
}

window.EngineFlame = EngineFlame;