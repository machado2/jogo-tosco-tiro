class Laser extends Entity {
    constructor() {
        super(gameState.playerX, gameState.playerY - 10, SizesConfig.laser.width, SizesConfig.laser.height);
        this.energy = 2; this.releaseDebris = 4;
        this.mesh = BABYLON.MeshBuilder.CreateBox("laser", { width: 1, height: 1, depth: 0.3 }, scene);
        this.mesh.material = createLitMaterial("laserLit", new BABYLON.Color3(0, 1, 1), 0.35); this.mesh.renderingGroupId = 1;
        fitMeshToPixels(this.mesh, this.width, this.height); registerGlowMesh(this.mesh); if (typeof window !== 'undefined' && typeof window.syncEntityVisual === 'function') { try { window.syncEntityVisual(this); } catch {} } else { this.updateMeshPosition(); this.updateBodyFromEntity(); }
        this.light = null;
        try {
            const light = new BABYLON.PointLight("laserLight", new BABYLON.Vector3(0, 0, 0), scene);
            light.diffuse = new BABYLON.Color3(0.2, 0.9, 1.0);
            light.specular = new BABYLON.Color3(1, 1, 1);
            light.intensity = 0.9; light.range = 40;
            if (BABYLON.Light && typeof BABYLON.Light.FALLOFF_PHYSICAL !== 'undefined') { light.falloffType = BABYLON.Light.FALLOFF_PHYSICAL; }
            light.parent = this.mesh; light.position = new BABYLON.Vector3(0, 0.4, -0.1); this.light = light;
        } catch {}
    }
    update() { this.y -= 10; this.x = gameState.playerX; if (this.y < 40) this.destroy(); if (typeof window !== 'undefined' && typeof window.syncEntityVisual === 'function') { try { window.syncEntityVisual(this); } catch {} } else { this.updateMeshPosition(); this.updateBodyFromEntity(); } }
    destroy() { if (!this.alive) return; super.destroy(); if (this.light) { try { this.light.dispose(); } catch {} this.light = null; } }
}

window.Laser = Laser;