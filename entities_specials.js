// Entities: Specials (Meteor, Star, Rain)

class Meteor extends Entity {
    constructor() {
        super(0, 0, 5, 5);
        this.energy = METEOR_HEALTH;
        this.releaseDebris = 5;
        let angle;
        switch (random(4)) {
            case 0:
                this.x = 10; this.y = random(SCREEN_HEIGHT - 10);
                angle = random(90); if (angle > 45) angle += 269; break;
            case 1:
                this.x = SCREEN_WIDTH - 10; this.y = random(SCREEN_HEIGHT - 10);
                angle = between(135, 225); break;
            case 2:
                this.x = random(SCREEN_WIDTH - 10); this.y = 10;
                angle = between(45, 135); break;
            case 3:
                this.x = random(SCREEN_WIDTH - 10); this.y = SCREEN_HEIGHT - 10;
                angle = between(225, 315); break;
        }
        angle *= Math.PI / 180;
        this.dirX = Math.floor(200 * Math.cos(angle));
        this.dirY = Math.floor(200 * Math.sin(angle));
        this.incX = sign(this.dirX); this.incY = sign(this.dirY);
        this.dirX = Math.abs(this.dirX); this.dirY = Math.abs(this.dirY);
        this.restoX = 0; this.restoY = 0;
        this.mesh = buildMeteorMesh();
        fitMeshToPixels(this.mesh, this.width, this.height);
        this.updateMeshPosition();
    }
    update() {
        this.restoX += this.dirX; this.restoY += this.dirY;
        while (this.restoX >= 100) { this.restoX -= 100; this.x += this.incX; }
        while (this.restoY >= 100) { this.restoY -= 100; this.y += this.incY; }
        if (this.isOffScreen()) this.destroy();
        this.updateMeshPosition();
    }
    onDestroy() { gameState.score += POINTS_METEOR; audioSystem.playExplosion(); triggerShake(0.8, 6); }
}

class Star extends Entity {
    constructor() {
        super(random(SCREEN_WIDTH - 80) + 40, 40, 64, 48);
        this.energy = 100;
        this.releaseDebris = 500;
        this.mesh = BABYLON.MeshBuilder.CreateDisc("star", { radius: 1, tessellation: 5 }, scene);
        this.mesh.material = createMaterial("star", new BABYLON.Color3(1, 1, 0));
        this.mesh.renderingGroupId = 1;
        fitMeshToPixels(this.mesh, this.width, this.height);
        this.updateMeshPosition();
    }
    update() {
        if (temporizes(10)) {
            if (gameState.score > 5000 && temporizes(50)) this.pulse();
            if (++this.y > SCREEN_HEIGHT) this.destroy();
        }
        this.updateMeshPosition();
    }
    pulse() {
        for (let a = 0; a < Math.PI * 2; a += 0.05) {
            enemyEntities.push(new Missile(this.x, this.y, Math.cos(a) * 10, Math.sin(a) * 10, false));
        }
    }
    onDestroy() { gameState.score += 100; this.pulse(); audioSystem.playPowerup(); }
}

class Rain extends Entity {
    constructor(x = null, y = null) {
        if (x === null) { x = random(SCREEN_WIDTH - 40) + 20; y = 40; }
        super(x, y, 20, 20);
        this.energy = 100;
        this.radius = 0;
        this.releaseDebris = 15;
        this.mesh = BABYLON.MeshBuilder.CreateTorus("rain", { diameter: 1, thickness: 0.25, tessellation: 16 }, scene);
        this.mesh.material = createMaterial("rain", new BABYLON.Color3(0, 1, 0));
        this.mesh.renderingGroupId = 1;
        fitMeshToPixels(this.mesh, this.width, this.height);
        this.updateMeshPosition();
    }
    update() {
        if (temporizes(10)) {
            this.y++;
            if (++this.radius >= 5) {
                enemyEntities.push(new Guided(this.x, this.y));
                this.radius = 0;
            }
        }
        if (temporizes(100)) {
            for (let i = Math.PI / 4; i <= 3 * Math.PI / 4; i += 0.1) {
                enemyEntities.push(new Missile(this.x, this.y, 2 * Math.cos(i), 2 * Math.sin(i), false));
            }
            if (this.y + 20 > SCREEN_HEIGHT) this.destroy();
        }
        this.updateMeshPosition();
    }
    onDestroy() { gameState.score += POINTS_CHUVA; audioSystem.playExplosionBig(); }
}