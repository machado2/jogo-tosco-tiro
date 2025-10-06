// Entities Enemies (globals)

class Enemy extends Entity {
    constructor() {
        super(random(SCREEN_WIDTH - 60) + 30, 30, 20, 20);
        this.energy = ENEMY_HEALTH;
        this.movement = random(8);
        this.distance = random(50);
        this.shootTime = random(100) + 20;
        this.releaseDebris = 20;
        this.phase = Math.random() * Math.PI * 2;
        this.speed = 0.8 + Math.random() * 1.4;
        this.mesh = buildBasicEnemyMesh();
        fitMeshToPixels(this.mesh, this.width, this.height);
        this.updateMeshPosition();
        gameState.enemyPopulation++;
    }
    update() {
        const oldX = this.x, oldY = this.y;
        switch (this.movement) {
            case 0: this.y += this.speed; break;
            case 1: this.y -= this.speed; break;
            case 2: this.x -= this.speed; break;
            case 3: this.x += this.speed; break;
            case 4: this.y += 0.7 * this.speed; this.phase += 0.1; this.x += Math.sin(this.phase) * 1.5; break;
            case 5: this.x += 0.7 * this.speed; this.phase += 0.1; this.y += Math.sin(this.phase) * 1.5; break;
            case 6: this.y += 1.2 * this.speed; this.phase += 0.25; this.x += Math.sin(this.phase) * 2.6; break;
            case 7: {
                const dx = gameState.playerX - this.x;
                const dy = gameState.playerY - this.y;
                const ang = Math.atan2(dy, dx);
                this.x += Math.cos(ang) * 0.6 * this.speed;
                this.y += Math.sin(ang) * 0.6 * this.speed;
                this.x += Math.cos(ang + Math.PI / 2) * 0.8;
                break;
            }
        }
        if (this.distance >= 0) { this.distance--; }
        else { this.distance = random(50) + 20; this.movement = random(8); this.phase = 0; this.speed = 0.8 + Math.random() * 1.6; }
        if (this.y - 20 < 20) { this.movement = 0; this.distance = 10; }
        if (this.y > SCREEN_HEIGHT / 2) { this.movement = 1; this.distance = 10; }
        if (this.x + 20 > SCREEN_WIDTH) { this.movement = 2; this.distance = 10; }
        if (this.x - 20 < 0) { this.movement = 3; this.distance = 10; }
        if (!this.shootTime) {
            this.shootTime = random(180) + 20;
            enemyEntities.push(new Missile(this.x - 9, this.y + 20, 0, 3, false));
            enemyEntities.push(new Missile(this.x + 9, this.y + 20, 0, 3, false));
        } else { this.shootTime--; }
        const vx = this.x - oldX; const vy = this.y - oldY;
        if (this.mesh) {
            this.mesh.rotation.z = BABYLON.Scalar.Lerp(this.mesh.rotation.z || 0, -vx * 0.04, 0.15);
            this.mesh.rotation.x = BABYLON.Scalar.Lerp(this.mesh.rotation.x || 0, vy * 0.03, 0.15);
        }
        this.updateMeshPosition();
    }
    onDestroy() { gameState.enemyPopulation--; gameState.score += POINTS_ENEMY; audioSystem.playExplosion(); triggerShake(1.2, 8); }
}

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

class Metralha extends Entity {
    constructor(x = null, y = null) {
        if (x === null) { x = random(SCREEN_WIDTH - 96) + 48; y = 48; }
        super(x, y, 48, 48);
        this.energy = 10;
        this.releaseDebris = 100;
        this.mesh = buildTurretMesh();
        fitMeshToPixels(this.mesh, this.width, this.height);
        this.updateMeshPosition();
    }
    update() {
        if (temporizes(25)) {
            const dx = gameState.playerX - this.x;
            const dy = gameState.playerY - this.y;
            let dist = Math.sqrt(dx * dx + dy * dy) || 1;
            enemyEntities.push(new Missile(this.x, this.y, (dx * 5) / dist, (dy * 5) / dist, false));
        }
        if (temporizes(10)) { this.y++; if (this.isOffScreen()) this.destroy(); }
        this.updateMeshPosition();
    }
    onDestroy() { gameState.score += POINTS_METRALHA; audioSystem.playExplosion(); triggerShake(1.5, 10); }
}

class Transport extends Entity {
    constructor() {
        super(0, random(SCREEN_HEIGHT / 2 - 40) + 40, 100, 20);
        this.energy = 500;
        this.releaseDebris = 40;
        this.mesh = buildTransportMesh(new BABYLON.Color3(0.4, 0.3, 0.3));
        fitMeshToPixels(this.mesh, this.width, this.height);
        this.updateMeshPosition();
    }
    update() {
        if (temporizes(50)) enemyEntities.push(new Metralha(this.x, this.y));
        if (temporizes(10)) this.y++;
        if (++this.x > SCREEN_WIDTH) this.destroy();
        this.updateMeshPosition();
    }
    onDestroy() { audioSystem.playExplosionBig(); triggerShake(3.0, 20); }
}

class Encrenca extends Entity {
    constructor() {
        super(0, random(SCREEN_HEIGHT / 2 - 40) + 40, 100, 20);
        this.energy = 500;
        this.releaseDebris = 200;
        this.mesh = buildTransportMesh(new BABYLON.Color3(0.3, 0.3, 0.3));
        fitMeshToPixels(this.mesh, this.width, this.height);
        this.updateMeshPosition();
    }
    update() {
        if (temporizes(100)) enemyEntities.push(new Rain(this.x, this.y));
        if (temporizes(10)) this.y++;
        if (++this.x > SCREEN_WIDTH) this.destroy();
        this.updateMeshPosition();
    }
    onDestroy() { audioSystem.playExplosionBig(); }
}