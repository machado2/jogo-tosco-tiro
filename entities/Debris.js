class Debris extends Entity {
    constructor(x, y, angle = -1) {
        super(x, y, 1, 1);
        if (angle === -1) angle = Math.random() * 2 * Math.PI;
        this.restoX = 0; this.restoY = 0;
        const vel = random(100);
        this.dirX = Math.floor(vel * Math.cos(angle));
        this.dirY = Math.floor(vel * Math.sin(angle));
        this.incX = sign(this.dirX); this.incY = sign(this.dirY);
        this.dirX = Math.abs(this.dirX); this.dirY = Math.abs(this.dirY);
        this.dist = random(60);
        this.mesh = debrisBaseMesh.createInstance("debrisInst");
        this.mesh.setEnabled(true);
        this.updateMeshPosition(); this.updateBodyFromEntity();
    }
    update() {
        this.restoX += this.dirX; this.restoY += this.dirY;
        while (this.restoX > 100) { this.restoX -= 100; this.x += this.incX; }
        while (this.restoY > 100) { this.restoY -= 100; this.y += this.incY; }
        this.dist--; if (this.dist < 1) this.destroy();
        this.updateMeshPosition(); this.updateBodyFromEntity();
    }
    destroy() {
        if (!this.alive) return; this.alive = false;
        if (this.mesh) { this.mesh.dispose(); this.mesh = null; }
        totalDebrisCount = Math.max(0, totalDebrisCount - 1);
    }
}

window.Debris = Debris;