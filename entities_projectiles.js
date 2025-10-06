// Entities Projectiles (globals)

class Missile extends Entity {
    constructor(x, y, velX, velY, friendly = false) {
        super(x, y, 10, 10);
        this.energy = MISSILE_HEALTH; this.dirX = Math.floor(velX * 100); this.dirY = Math.floor(velY * 100);
        this.incX = sign(this.dirX); this.incY = sign(this.dirY);
        this.dirX = Math.abs(this.dirX); this.dirY = Math.abs(this.dirY);
        this.restoX = 0; this.restoY = 0; this.releaseDebris = 4; this.friendly = friendly;
        this.mesh = BABYLON.MeshBuilder.CreateSphere("missile", { diameter: 1 }, scene);
        const color = friendly ? new BABYLON.Color3(0.0, 0.7, 1.0) : new BABYLON.Color3(1.0, 0.3, 0.1);
        this.mesh.material = createPBRMetalMaterial(friendly ? "friendlyMissile" : "enemyMissile", color, null, 0.03);
        this.mesh.renderingGroupId = 1; fitMeshToPixels(this.mesh, this.width, this.height); this.updateMeshPosition();
    }
    update() {
        this.restoX += this.dirX; this.restoY += this.dirY;
        while (this.restoX >= 100) { this.restoX -= 100; this.x += this.incX; }
        while (this.restoY >= 100) { this.restoY -= 100; this.y += this.incY; }
        if (this.isOffScreen()) this.destroy(); this.updateMeshPosition();
    }
}

class Nuclear extends Missile {
    constructor(x, y, velX, velY, level = 0) {
        super(x, y, velX, velY, true);
        this.level = level; this.angle = angleDir(velX, velY);
        const sizes = [20, 18, 14, 10]; this.width = this.height = sizes[level] || 10;
        this.mesh.dispose(); const size = 1 + level * 0.5;
        this.mesh = BABYLON.MeshBuilder.CreateSphere("nuclear", { diameter: size }, scene);
        this.mesh.material = createMaterial("nuclear", new BABYLON.Color3(1, 0, 0)); this.mesh.renderingGroupId = 1;
        fitMeshToPixels(this.mesh, this.width, this.height); registerGlowMesh(this.mesh); this.updateMeshPosition();
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

class Laser extends Entity {
    constructor() {
        super(gameState.playerX, gameState.playerY - 10, 2, 50); this.energy = 2; this.releaseDebris = 4;
        this.mesh = BABYLON.MeshBuilder.CreateBox("laser", { width: 1, height: 1, depth: 0.3 }, scene);
        this.mesh.material = createMaterial("laser", new BABYLON.Color3(0, 1, 1)); this.mesh.renderingGroupId = 1;
        fitMeshToPixels(this.mesh, this.width, this.height); registerGlowMesh(this.mesh); this.updateMeshPosition();
    }
    update() { this.y -= 10; this.x = gameState.playerX; if (this.y < 40) this.destroy(); this.updateMeshPosition(); }
}

class EngineFlame extends Entity {
    constructor(x, y) {
        super(x, y, 6, 6); this.life = 14; this.velX = (Math.random() - 0.5) * 2; this.velY = 2 + Math.random() * 1.5;
        this.mesh = BABYLON.MeshBuilder.CreateDisc("engineFlame", { radius: 0.5, tessellation: 16 }, scene);
        const mat = createMaterial("engineFlameMat", new BABYLON.Color3(1.0, 0.5, 0.1)); this.mesh.material = mat;
        this.mesh.renderingGroupId = 1; this.mesh.billboardMode = BABYLON.AbstractMesh.BILLBOARDMODE_ALL; this.mesh.material.alpha = 0.8;
        fitMeshToPixels(this.mesh, this.width, this.height); registerGlowMesh(this.mesh); this.updateMeshPosition();
    }
    update() { this.x += this.velX; this.y += this.velY; if (this.mesh && this.mesh.material) this.mesh.material.alpha *= 0.88; if (--this.life <= 0) this.destroy(); this.updateMeshPosition(); }
}

class Guided extends Entity {
    constructor(x, y) {
        super(x, y, 10, 10); this.energy = 1; this.velX = 0; this.velY = 0; this.time = 0; this.releaseDebris = 5;
        this.mesh = BABYLON.MeshBuilder.CreateSphere("guided", { diameter: 1 }, scene);
        this.mesh.material = createMaterial("guided", new BABYLON.Color3(1, 0, 1)); this.mesh.renderingGroupId = 1;
        fitMeshToPixels(this.mesh, this.width, this.height); this.updateMeshPosition();
    }
    update() {
        let dx = this.x - gameState.playerX; let dy = this.y - gameState.playerY; let dist = distance(this.x, this.y, gameState.playerX, gameState.playerY) || 1;
        dx = dx / dist / 5; dy = dy / dist / 5; this.velX = (this.velX - dx) * 0.99; this.velY = (this.velY - dy) * 0.99;
        this.x += this.velX; this.y += this.velY; if (++this.time > 1000) this.destroy(); this.updateMeshPosition();
    }
    onDestroy() { gameState.score++; }
}