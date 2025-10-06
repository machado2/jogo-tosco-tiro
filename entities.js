// Entities split out of game.js (globals, no modules)
// Requires visuals.js for builders/materials and game.js for globals/state.

class Entity {
    constructor(x, y, width, height) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.mesh = null;
        this.alive = true;
        this.energy = 1;
        this.releaseDebris = 0;
        this.prevX = x;
        this.prevY = y;
    }

    posX() { return this.x - this.width / 2; }
    posY() { return this.y - this.height / 2; }

    isOffScreen() {
        return (this.x - this.width < 0 || this.x + this.width > SCREEN_WIDTH) ||
            (this.y - this.height < 0 || this.y + this.height > SCREEN_HEIGHT);
    }

    keepOnScreen() {
        if (this.x - this.width / 2 < 0) this.x = this.width / 2;
        if (this.y - this.height / 2 < 0) this.y = this.height / 2;
        if (this.x + this.width / 2 > SCREEN_WIDTH) this.x = SCREEN_WIDTH - this.width / 2;
        if (this.y + this.height / 2 > SCREEN_HEIGHT) this.y = SCREEN_HEIGHT - this.height / 2;
    }

    takeDamage(damage) {
        this.energy -= damage;
        if (this.energy < 1) {
            this.onDestroy();
            this.destroy();
            return true;
        } else {
            if (this.mesh) flashMesh(this.mesh);
        }
        return false;
    }

    onDestroy() {}

    destroy() {
        this.alive = false;
        if (this.releaseDebris && !this.isOffScreen()) {
            const available = Math.max(0, MAX_DEBRIS_TOTAL - totalDebrisCount);
            const toEmit = Math.min(this.releaseDebris, MAX_DEBRIS_PER_EVENT, available);
            for (let i = 0; i < toEmit; i++) {
                debrisEntities.push(new Debris(this.x, this.y));
                totalDebrisCount++;
            }
        }
        if (this.mesh) { this.mesh.dispose(); this.mesh = null; }
    }

    update() {}

    updateMeshPosition() {
        if (this.mesh) {
            this.mesh.position.x = this.x - SCREEN_WIDTH / 2;
            this.mesh.position.y = -(this.y - SCREEN_HEIGHT / 2);
        }
    }
}

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
        this.updateMeshPosition();
    }
    update() {
        this.restoX += this.dirX; this.restoY += this.dirY;
        while (this.restoX > 100) { this.restoX -= 100; this.x += this.incX; }
        while (this.restoY > 100) { this.restoY -= 100; this.y += this.incY; }
        this.dist--; if (this.dist < 1) this.destroy();
        this.updateMeshPosition();
    }
    destroy() {
        if (!this.alive) return; this.alive = false;
        if (this.mesh) { this.mesh.dispose(); this.mesh = null; }
        totalDebrisCount = Math.max(0, totalDebrisCount - 1);
    }
}

class Player extends Entity {
    constructor() {
        super(SCREEN_WIDTH / 2, SCREEN_HEIGHT - 80, 48, 48);
        this.energy = MAX_HEALTH; this.charge = MAX_CHARGE; this.shootTime = 0;
        this.releaseDebris = 80;
        this.mesh = buildPlayerShipMesh();
        fitMeshToPixels(this.mesh, this.width, this.height); this.updateMeshPosition();
        if (highlightLayer) { try { highlightLayer.addMesh(this.mesh, new BABYLON.Color3(0.2, 0.6, 1)); } catch {} }
        gameState.playerAlive = true;
    }
    update() {
        const dx = gameState.cursorX - this.x; const dy = gameState.cursorY - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        if (dist > 20) { this.x += (dx * 20) / dist; this.y += (dy * 20) / dist; } else { this.x = gameState.cursorX; this.y = gameState.cursorY; }
        this.keepOnScreen();
        const vx = this.x - this.prevX; const vy = this.y - this.prevY;
        if (this.mesh) {
            this.mesh.rotation.z = BABYLON.Scalar.Lerp(this.mesh.rotation.z || 0, -vx * 0.03, 0.2);
            this.mesh.rotation.x = BABYLON.Scalar.Lerp(this.mesh.rotation.x || 0, vy * 0.02, 0.2);
        }
        this.prevX = this.x; this.prevY = this.y;
        if (this.charge < MAX_CHARGE) this.charge = Math.min(MAX_CHARGE, this.charge + CHARGE_REFILL_PER_FRAME);
        if (this.shootTime < 1000) this.shootTime++;
        if (this.charge >= 20 && this.shootTime >= 5 && gameState.leftButton) {
            this.shootTime = 0; this.charge -= 10;
            if (gameState.score >= 500) { friendlyEntities.push(new Laser()); audioSystem.playLaser(); }
            else { friendlyEntities.push(new Missile(this.x, this.y - 5, 0, -10, true)); audioSystem.playShoot(); }
        }
        if (gameState.rightButton && this.charge >= MAX_CHARGE && this.shootTime) { this.pulse(); this.charge = 0; this.shootTime = 0; audioSystem.playSpecial(); }
        if (gameState.rightButton && this.charge >= 150 && this.shootTime > 50) { this.pulse(0.3); this.charge -= 50; this.shootTime = 0; audioSystem.playSpecial(); }
        if (this.charge >= MAX_CHARGE && this.energy < MAX_HEALTH && temporizes(10)) this.energy++;
        // Removido efeito de partícula/flame sob a nave
        // if (engineFlamesEnabled && temporizes(2)) debrisEntities.push(new EngineFlame(this.x, this.y + this.height / 2 - 4));
        gameState.playerHealth = this.energy; gameState.playerCharge = this.charge; gameState.playerX = this.x; gameState.playerY = this.y;
        this.updateMeshPosition();
    }
    pulse(inc = 0.05) { for (let a = 0; a < Math.PI * 2; a += inc) friendlyEntities.push(new Missile(this.x, this.y, Math.cos(a) * 10, Math.sin(a) * 10, true)); }
    onDestroy() { gameState.enemyPopulation--; audioSystem.playExplosionBig(); triggerShake(6, 50); gameState.deathSequenceFrames = DEATH_OVERLAY_DELAY_FRAMES; }
    takeDamage(dmg) { try { const el = document.getElementById('damage-overlay'); if (el) { el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 120); } } catch {} if (audioSystem && audioSystem.initialized) { try { audioSystem.playHit(); } catch {} } return super.takeDamage(dmg); }
}

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

class Enemy extends Entity {
    constructor() {
        super(random(SCREEN_WIDTH - 60) + 30, 30, 20, 20); this.energy = ENEMY_HEALTH;
        this.movement = random(8); this.distance = random(50); this.shootTime = random(100) + 20; this.releaseDebris = 20;
        this.phase = Math.random() * Math.PI * 2; this.speed = 0.8 + Math.random() * 1.4;
        this.mesh = buildBasicEnemyMesh(); fitMeshToPixels(this.mesh, this.width, this.height); this.updateMeshPosition();
        gameState.enemyPopulation++;
    }
    update() {
        const oldX = this.x, oldY = this.y;
        switch (this.movement) {
            case 0: this.y += this.speed; break; case 1: this.y -= this.speed; break; case 2: this.x -= this.speed; break; case 3: this.x += this.speed; break;
            case 4: this.y += 0.7 * this.speed; this.phase += 0.1; this.x += Math.sin(this.phase) * 1.5; break;
            case 5: this.x += 0.7 * this.speed; this.phase += 0.1; this.y += Math.sin(this.phase) * 1.5; break;
            case 6: this.y += 1.2 * this.speed; this.phase += 0.25; this.x += Math.sin(this.phase) * 2.6; break;
            case 7: { const dx = gameState.playerX - this.x; const dy = gameState.playerY - this.y; const ang = Math.atan2(dy, dx);
                      this.x += Math.cos(ang) * 0.6 * this.speed; this.y += Math.sin(ang) * 0.6 * this.speed; this.x += Math.cos(ang + Math.PI / 2) * 0.8; break; }
        }
        if (this.distance >= 0) { this.distance--; } else { this.distance = random(50) + 20; this.movement = random(8); this.phase = 0; this.speed = 0.8 + Math.random() * 1.6; }
        if (this.y - 20 < 20) { this.movement = 0; this.distance = 10; }
        if (this.y > SCREEN_HEIGHT / 2) { this.movement = 1; this.distance = 10; }
        if (this.x + 20 > SCREEN_WIDTH) { this.movement = 2; this.distance = 10; }
        if (this.x - 20 < 0) { this.movement = 3; this.distance = 10; }
        if (!this.shootTime) { this.shootTime = random(180) + 20; enemyEntities.push(new Missile(this.x - 9, this.y + 20, 0, 3, false)); enemyEntities.push(new Missile(this.x + 9, this.y + 20, 0, 3, false)); } else { this.shootTime--; }
        // Removido efeito de partícula/flame sob a nave inimiga
        // if (engineFlamesEnabled && temporizes(6)) debrisEntities.push(new EngineFlame(this.x, this.y + this.height / 2));
        const vx = this.x - oldX; const vy = this.y - oldY; if (this.mesh) { this.mesh.rotation.z = BABYLON.Scalar.Lerp(this.mesh.rotation.z || 0, -vx * 0.04, 0.15); this.mesh.rotation.x = BABYLON.Scalar.Lerp(this.mesh.rotation.x || 0, vy * 0.03, 0.15); }
        this.updateMeshPosition();
    }
    onDestroy() { gameState.enemyPopulation--; gameState.score += POINTS_ENEMY; audioSystem.playExplosion(); triggerShake(1.2, 8); }
}

class Meteor extends Entity {
    constructor() {
        super(0, 0, 5, 5); this.energy = METEOR_HEALTH; this.releaseDebris = 5;
        let angle; switch (random(4)) { case 0: this.x = 10; this.y = random(SCREEN_HEIGHT - 10); angle = random(90); if (angle > 45) angle += 269; break;
            case 1: this.x = SCREEN_WIDTH - 10; this.y = random(SCREEN_HEIGHT - 10); angle = between(135, 225); break;
            case 2: this.x = random(SCREEN_WIDTH - 10); this.y = 10; angle = between(45, 135); break;
            case 3: this.x = random(SCREEN_WIDTH - 10); this.y = SCREEN_HEIGHT - 10; angle = between(225, 315); break; }
        angle *= Math.PI / 180; this.dirX = Math.floor(200 * Math.cos(angle)); this.dirY = Math.floor(200 * Math.sin(angle)); this.incX = sign(this.dirX); this.incY = sign(this.dirY);
        this.dirX = Math.abs(this.dirX); this.dirY = Math.abs(this.dirY); this.restoX = 0; this.restoY = 0;
        this.mesh = buildMeteorMesh(); fitMeshToPixels(this.mesh, this.width, this.height); this.updateMeshPosition();
    }
    update() {
        this.restoX += this.dirX; this.restoY += this.dirY;
        while (this.restoX >= 100) { this.restoX -= 100; this.x += this.incX; }
        while (this.restoY >= 100) { this.restoY -= 100; this.y += this.incY; }
        if (this.isOffScreen()) this.destroy(); this.updateMeshPosition();
    }
    onDestroy() { gameState.score += POINTS_METEOR; audioSystem.playExplosion(); triggerShake(0.8, 6); }
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

class Star extends Entity {
    constructor() {
        super(random(SCREEN_WIDTH - 80) + 40, 40, 64, 48); this.energy = 100; this.releaseDebris = 500;
        this.mesh = BABYLON.MeshBuilder.CreateDisc("star", { radius: 1, tessellation: 5 }, scene);
        this.mesh.material = createMaterial("star", new BABYLON.Color3(1, 1, 0)); this.mesh.renderingGroupId = 1;
        fitMeshToPixels(this.mesh, this.width, this.height); this.updateMeshPosition();
    }
    update() { if (temporizes(10)) { if (gameState.score > 5000 && temporizes(50)) this.pulse(); if (++this.y > SCREEN_HEIGHT) this.destroy(); } this.updateMeshPosition(); }
    pulse() { for (let a = 0; a < Math.PI * 2; a += 0.05) enemyEntities.push(new Missile(this.x, this.y, Math.cos(a) * 10, Math.sin(a) * 10, false)); }
    onDestroy() { gameState.score += 100; this.pulse(); audioSystem.playPowerup(); }
}

class Rain extends Entity {
    constructor(x = null, y = null) {
        if (x === null) { x = random(SCREEN_WIDTH - 40) + 20; y = 40; }
        super(x, y, 20, 20); this.energy = 100; this.radius = 0; this.releaseDebris = 15;
        this.mesh = BABYLON.MeshBuilder.CreateTorus("rain", { diameter: 1, thickness: 0.25, tessellation: 16 }, scene);
        this.mesh.material = createMaterial("rain", new BABYLON.Color3(0, 1, 0)); this.mesh.renderingGroupId = 1;
        fitMeshToPixels(this.mesh, this.width, this.height); this.updateMeshPosition();
    }
    update() {
        if (temporizes(10)) { this.y++; if (++this.radius >= 5) { enemyEntities.push(new Guided(this.x, this.y)); this.radius = 0; } }
        if (temporizes(100)) { for (let i = Math.PI / 4; i <= 3 * Math.PI / 4; i += 0.1) enemyEntities.push(new Missile(this.x, this.y, 2 * Math.cos(i), 2 * Math.sin(i), false)); if (this.y + 20 > SCREEN_HEIGHT) this.destroy(); }
        this.updateMeshPosition();
    }
    onDestroy() { gameState.score += POINTS_CHUVA; audioSystem.playExplosionBig(); }
}

class Metralha extends Entity {
    constructor(x = null, y = null) {
        if (x === null) { x = random(SCREEN_WIDTH - 96) + 48; y = 48; }
        super(x, y, 48, 48); this.energy = 10; this.releaseDebris = 100;
        this.mesh = buildTurretMesh(); fitMeshToPixels(this.mesh, this.width, this.height); this.updateMeshPosition();
    }
    update() {
        if (temporizes(25)) {
            const dx = gameState.playerX - this.x; const dy = gameState.playerY - this.y; let dist = Math.sqrt(dx * dx + dy * dy) || 1;
            enemyEntities.push(new Missile(this.x, this.y, (dx * 5) / dist, (dy * 5) / dist, false));
        }
        if (temporizes(10)) { this.y++; if (this.isOffScreen()) this.destroy(); }
        this.updateMeshPosition();
    }
    onDestroy() { gameState.score += POINTS_METRALHA; audioSystem.playExplosion(); triggerShake(1.5, 10); }
}

class Transport extends Entity {
    constructor() {
        super(0, random(SCREEN_HEIGHT / 2 - 40) + 40, 100, 20); this.energy = 500; this.releaseDebris = 40;
        this.mesh = buildTransportMesh(new BABYLON.Color3(0.4, 0.3, 0.3)); fitMeshToPixels(this.mesh, this.width, this.height); this.updateMeshPosition();
    }
    update() { if (temporizes(50)) enemyEntities.push(new Metralha(this.x, this.y)); if (temporizes(10)) this.y++; if (++this.x > SCREEN_WIDTH) this.destroy(); this.updateMeshPosition(); }
    onDestroy() { audioSystem.playExplosionBig(); triggerShake(3.0, 20); }
}

class Encrenca extends Entity {
    constructor() {
        super(0, random(SCREEN_HEIGHT / 2 - 40) + 40, 100, 20); this.energy = 500; this.releaseDebris = 200;
        this.mesh = buildTransportMesh(new BABYLON.Color3(0.3, 0.3, 0.3)); fitMeshToPixels(this.mesh, this.width, this.height); this.updateMeshPosition();
    }
    update() { if (temporizes(100)) enemyEntities.push(new Rain(this.x, this.y)); if (temporizes(10)) this.y++; if (++this.x > SCREEN_WIDTH) this.destroy(); this.updateMeshPosition(); }
    onDestroy() { audioSystem.playExplosionBig(); }
}