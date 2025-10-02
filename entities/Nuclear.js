class Nuclear extends Missile {
    constructor(x, y, velX, velY, level = 0) {
        super(x, y, velX, velY, true);
        this.level = level; this.angle = angleDir(velX, velY);
        const sizes = SizesConfig.nuclearLevels; this.width = this.height = sizes[level] || SizesConfig.missile.width;
        this.mesh.dispose(); const size = 1 + level * 0.5;
        this.mesh = BABYLON.MeshBuilder.CreateSphere("nuclear", { diameter: size }, scene);
        this.mesh.material = createMaterial("nuclear", new BABYLON.Color3(1, 0, 0)); this.mesh.renderingGroupId = 1;
        fitMeshToPixels(this.mesh, this.width, this.height); registerGlowMesh(this.mesh); if (typeof window !== 'undefined' && typeof window.syncEntityVisual === 'function') { try { window.syncEntityVisual(this); } catch {} } else { this.updateMeshPosition(); this.updateBodyFromEntity(); }
    }
    onDestroy() {
        if (this.level >= 3) return;
        let newAngle = this.angle > Math.PI ? this.angle - Math.PI : this.angle + Math.PI;
        this.x += Math.cos(newAngle) * 10; this.y += Math.sin(newAngle) * 10;
        for (let ang = newAngle - 1; ang < newAngle + 1; ang += 0.5) {
            friendlyEntities.push(new Nuclear(this.x, this.y, Math.cos(ang) * 5, Math.sin(ang) * 5, this.level + 1));
        }
    }
}

window.Nuclear = Nuclear;