class Missile extends Entity {
    constructor(x, y, velX, velY, friendly = false) {
        super(x, y, SizesConfig.missile.width, SizesConfig.missile.height);
        this.energy = MISSILE_HEALTH; this.dirX = Math.floor(velX * 100); this.dirY = Math.floor(velY * 100);
        this.incX = sign(this.dirX); this.incY = sign(this.dirY);
        this.dirX = Math.abs(this.dirX); this.dirY = Math.abs(this.dirY);
        this.restoX = 0; this.restoY = 0; this.releaseDebris = 4; this.friendly = friendly;
        this.light = null;
        this.mesh = BABYLON.MeshBuilder.CreateSphere("missile", { diameter: 1 }, scene);
        const color = friendly ? new BABYLON.Color3(0, 0.6, 1) : new BABYLON.Color3(1, 0.2, 0);
        this.mesh.material = createLitMaterial(friendly ? "friendlyMissileLit" : "enemyMissileLit", color, 0.25);
        this.mesh.renderingGroupId = 1; fitMeshToPixels(this.mesh, this.width, this.height); this.updateMeshPosition(); this.updateBodyFromEntity();
        registerGlowMesh(this.mesh);
        try {
            const light = new BABYLON.PointLight("missileLight", new BABYLON.Vector3(0, 0, 0), scene);
            light.diffuse = this.friendly ? new BABYLON.Color3(0.35, 0.8, 1.0) : new BABYLON.Color3(1.0, 0.45, 0.25);
            light.specular = new BABYLON.Color3(1, 1, 1);
            light.intensity = this.friendly ? 1.1 : 1.0; light.range = 48;
            if (BABYLON.Light && typeof BABYLON.Light.FALLOFF_PHYSICAL !== 'undefined') { light.falloffType = BABYLON.Light.FALLOFF_PHYSICAL; }
            light.parent = this.mesh; light.position = new BABYLON.Vector3(0.4, 0.4, -0.1); this.light = light;
        } catch {}
    }
    update() {
        this.restoX += this.dirX; this.restoY += this.dirY;
        while (this.restoX >= 100) { this.restoX -= 100; this.x += this.incX; }
        while (this.restoY >= 100) { this.restoY -= 100; this.y += this.incY; }
        if (this.isOffScreen()) this.destroy(); this.updateMeshPosition(); this.updateBodyFromEntity();
    }
    destroy() { if (!this.alive) return; super.destroy(); if (this.light) { try { this.light.dispose(); } catch {} this.light = null; } }
}

window.Missile = Missile;