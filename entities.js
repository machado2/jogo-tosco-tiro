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
        if (this.mesh) {
            try {
                // If root is a group (TransformNode), dispose its children first
                if (this.mesh.getChildren && !(this.mesh instanceof BABYLON.AbstractMesh)) {
                    this.mesh.getChildren().forEach(ch => { try { ch.dispose(); } catch {} });
                }
                this.mesh.dispose();
            } catch {}
            this.mesh = null;
        }
    }

    update() {}

    updateMeshPosition() {
        if (this.mesh) {
            this.mesh.position.x = this.x - SCREEN_WIDTH / 2;
            this.mesh.position.y = -(this.y - SCREEN_HEIGHT / 2);
            // Sincroniza hitbox com bounding box do mesh para refletir mudanças de escala/tamanho
            try {
                let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
                if (typeof this.mesh.getBoundingInfo === 'function') {
                    try { this.mesh.refreshBoundingInfo && this.mesh.refreshBoundingInfo(true); } catch {}
                    const bb = this.mesh.getBoundingInfo().boundingBox;
                    minX = Math.min(minX, bb.minimumWorld.x);
                    maxX = Math.max(maxX, bb.maximumWorld.x);
                    minY = Math.min(minY, bb.minimumWorld.y);
                    maxY = Math.max(maxY, bb.maximumWorld.y);
                }
                if (this.mesh.getChildren) {
                    const children = this.mesh.getChildren().filter(c => c && typeof c.getBoundingInfo === 'function');
                    children.forEach(ch => {
                        try { ch.refreshBoundingInfo && ch.refreshBoundingInfo(true); } catch {}
                        const bb = ch.getBoundingInfo().boundingBox;
                        minX = Math.min(minX, bb.minimumWorld.x);
                        maxX = Math.max(maxX, bb.maximumWorld.x);
                        minY = Math.min(minY, bb.minimumWorld.y);
                        maxY = Math.max(maxY, bb.maximumWorld.y);
                    });
                }
                const newW = (maxX - minX);
                const newH = (maxY - minY);
                if (isFinite(newW) && isFinite(newH) && newW > 0 && newH > 0) {
                    this.width = newW;
                    this.height = newH;
                }
            } catch {}
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
        super(SCREEN_WIDTH / 2, SCREEN_HEIGHT - 80, SizesConfig.player.width, SizesConfig.player.height);
        this.energy = MAX_HEALTH; this.charge = MAX_CHARGE; this.shootTime = 0;
        this.releaseDebris = 80;
        this.mesh = buildPlayerShipMesh();
        fitMeshToPixels(this.mesh, this.width, this.height); this.updateMeshPosition();
        if (highlightLayer) { 
            try { 
                // Highlight group children ou single mesh, com metadados para restaurar após flash
                const defaultColor = new BABYLON.Color3(0.12, 0.4, 0.8);
                if (this.mesh.getChildren && !(this.mesh instanceof BABYLON.AbstractMesh)) {
                    this.mesh.getChildren().filter(m => m instanceof BABYLON.Mesh).forEach(m => { 
                        try { 
                            m.metadata = m.metadata || {}; 
                            m.metadata.persistHL = true; 
                            m.metadata.defaultHLColor = defaultColor; 
                            highlightLayer.addMesh(m, defaultColor); 
                        } catch {} 
                    });
                } else {
                    this.mesh.metadata = this.mesh.metadata || {};
                    this.mesh.metadata.persistHL = true;
                    this.mesh.metadata.defaultHLColor = defaultColor;
                    highlightLayer.addMesh(this.mesh, defaultColor);
                }
            } catch {} 
        }
        // Guardar referência ao brilho de motor para pulsar com a carga
        this.engineGlow = null;
        try {
            if (this.mesh.getChildren) {
                this.engineGlow = this.mesh.getChildren().find(c => c && c.name === 'engineGlow');
            }
        } catch {}
        // Base rotations (top-down fix): mantenha X fixo em 90° e use Z para inclinar
        this.baseRotX = this.mesh.rotation.x || 0;
        this.baseRotZ = this.mesh.rotation.z || 0;
        gameState.playerAlive = true;
    }
    update() {
        const dx = gameState.cursorX - this.x; const dy = gameState.cursorY - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        if (dist > 20) { this.x += (dx * 20) / dist; this.y += (dy * 20) / dist; } else { this.x = gameState.cursorX; this.y = gameState.cursorY; }
        this.keepOnScreen();
        const vx = this.x - this.prevX; const vy = this.y - this.prevY;
        if (this.mesh) {
            const targetZ = BABYLON.Scalar.Clamp(-vx * 0.11, -1.1, 1.1);
            // Não altere o X-base (top-down). Remova o tilt em X baseado no mouse
            this.mesh.rotation.z = BABYLON.Scalar.Lerp(this.mesh.rotation.z || this.baseRotZ, this.baseRotZ + targetZ, 0.26);
            this.mesh.rotation.x = BABYLON.Scalar.Lerp(this.mesh.rotation.x || this.baseRotX, this.baseRotX, 0.26);
        }
        this.prevX = this.x; this.prevY = this.y;
        if (this.charge < MAX_CHARGE) this.charge = Math.min(MAX_CHARGE, this.charge + CHARGE_REFILL_PER_FRAME);
        if (this.shootTime < 1000) this.shootTime++;
        if (this.charge >= 20 && this.shootTime >= 5 && gameState.leftButton) {
            this.shootTime = 0; this.charge -= 1;
            if (gameState.score >= 500) { friendlyEntities.push(new Laser()); audioSystem.playLaser(); }
            else { friendlyEntities.push(new Missile(this.x, this.y - 5, 0, -10, true)); audioSystem.playShoot(); }
        }
        if (gameState.rightButton && this.charge >= MAX_CHARGE && this.shootTime) { this.pulse(); this.charge = 0; this.shootTime = 0; audioSystem.playSpecial(); }
        if (gameState.rightButton && this.charge >= 150 && this.shootTime > 50) { this.pulse(0.3); this.charge -= 50; this.shootTime = 0; audioSystem.playSpecial(); }
        if (this.charge >= MAX_CHARGE && this.energy < MAX_HEALTH && temporizes(10)) this.energy++;
        if (engineFlamesEnabled && temporizes(2)) debrisEntities.push(new EngineFlame(this.x, this.y + this.height / 2 - 4));
        
        // Brilho sutil e pulsante quando a carga está alta (>= 80% do máximo)
        try {
            if (highlightLayer && this.mesh) {
                const base = new BABYLON.Color3(0.12, 0.4, 0.8);
                let color = base;
                if (this.charge >= MAX_CHARGE * 0.8) {
                    const pulse = 0.75 + 0.25 * Math.sin(gameState.numFrame * 0.15);
                    color = new BABYLON.Color3(base.r * pulse, base.g * pulse, base.b * pulse);
                }
                if (this.mesh.getChildren && !(this.mesh instanceof BABYLON.AbstractMesh)) {
                    this.mesh.getChildren().filter(m => m instanceof BABYLON.Mesh).forEach(m => { try { highlightLayer.addMesh(m, color); } catch {} });
                } else {
                    try { highlightLayer.addMesh(this.mesh, color); } catch {}
                }
            }
            if (this.engineGlow && this.engineGlow.material) {
                const baseColor = new BABYLON.Color3(1.0, 0.5, 0.1);
                const pulseFactor = this.charge >= MAX_CHARGE * 0.8 ? (0.3 + 0.7 * (0.5 + 0.5 * Math.sin(gameState.numFrame * 0.2))) : 0.25;
                try { this.engineGlow.material.emissiveColor = baseColor.scale(pulseFactor); } catch {}
            }
        } catch {}
        
        gameState.playerHealth = this.energy; gameState.playerCharge = this.charge; gameState.playerX = this.x; gameState.playerY = this.y;
        this.updateMeshPosition();
    }
    pulse(inc = 0.05) { for (let a = 0; a < Math.PI * 2; a += inc) friendlyEntities.push(new Missile(this.x, this.y, Math.cos(a) * 10, Math.sin(a) * 10, true)); }
    onDestroy() { gameState.enemyPopulation--; audioSystem.playExplosionBig(); triggerShake(6, 50); gameState.deathSequenceFrames = DEATH_OVERLAY_DELAY_FRAMES; }
    takeDamage(dmg) { try { const el = document.getElementById('damage-overlay'); if (el) { el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 120); } } catch {} if (audioSystem && audioSystem.initialized) { try { audioSystem.playHit(); } catch {} } return super.takeDamage(dmg); }
}

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
        // Use a lit PBR material so lights can affect it
        this.mesh.material = createLitMaterial(friendly ? "friendlyMissileLit" : "enemyMissileLit", color, 0.25);
        this.mesh.renderingGroupId = 1; fitMeshToPixels(this.mesh, this.width, this.height); this.updateMeshPosition();
        registerGlowMesh(this.mesh); // allow missile to contribute to glow a bit
        // Todas as balas emitem luz (teste de performance)
        try {
            const light = new BABYLON.PointLight("missileLight", new BABYLON.Vector3(0, 0, 0), scene);
            light.diffuse = this.friendly ? new BABYLON.Color3(0.35, 0.8, 1.0) : new BABYLON.Color3(1.0, 0.45, 0.25);
            light.specular = new BABYLON.Color3(1, 1, 1);
            light.intensity = this.friendly ? 1.1 : 1.0;
            light.range = 48;
            if (BABYLON.Light && typeof BABYLON.Light.FALLOFF_PHYSICAL !== 'undefined') {
                light.falloffType = BABYLON.Light.FALLOFF_PHYSICAL;
            }
            light.parent = this.mesh;
            // mover levemente a luz para fora do centro do projétil
            light.position = new BABYLON.Vector3(0.4, 0.4, -0.1);
            this.light = light;
        } catch {}
    }
    update() {
        this.restoX += this.dirX; this.restoY += this.dirY;
        while (this.restoX >= 100) { this.restoX -= 100; this.x += this.incX; }
        while (this.restoY >= 100) { this.restoY -= 100; this.y += this.incY; }
        if (this.isOffScreen()) this.destroy(); this.updateMeshPosition();
    }
    destroy() {
        if (!this.alive) return; // avoid double-dispose
        super.destroy();
        if (this.light) { try { this.light.dispose(); } catch {} this.light = null; }
    }
}

class Nuclear extends Missile {
    constructor(x, y, velX, velY, level = 0) {
        super(x, y, velX, velY, true);
        this.level = level; this.angle = angleDir(velX, velY);
        const sizes = SizesConfig.nuclearLevels; this.width = this.height = sizes[level] || SizesConfig.missile.width;
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
        super(gameState.playerX, gameState.playerY - 10, SizesConfig.laser.width, SizesConfig.laser.height); this.energy = 2; this.releaseDebris = 4;
        this.mesh = BABYLON.MeshBuilder.CreateBox("laser", { width: 1, height: 1, depth: 0.3 }, scene);
        this.mesh.material = createLitMaterial("laserLit", new BABYLON.Color3(0, 1, 1), 0.35); this.mesh.renderingGroupId = 1;
        fitMeshToPixels(this.mesh, this.width, this.height); registerGlowMesh(this.mesh); this.updateMeshPosition();
        // Luz acoplada ao laser para teste
        this.light = null;
        try {
            const light = new BABYLON.PointLight("laserLight", new BABYLON.Vector3(0, 0, 0), scene);
            light.diffuse = new BABYLON.Color3(0.2, 0.9, 1.0);
            light.specular = new BABYLON.Color3(1, 1, 1);
            light.intensity = 0.9;
            light.range = 40;
            if (BABYLON.Light && typeof BABYLON.Light.FALLOFF_PHYSICAL !== 'undefined') {
                light.falloffType = BABYLON.Light.FALLOFF_PHYSICAL;
            }
            light.parent = this.mesh;
            light.position = new BABYLON.Vector3(0, 0.4, -0.1);
            this.light = light;
        } catch {}
    }
    update() { this.y -= 10; this.x = gameState.playerX; if (this.y < 40) this.destroy(); this.updateMeshPosition(); }
    destroy() {
        if (!this.alive) return;
        super.destroy();
        if (this.light) { try { this.light.dispose(); } catch {} this.light = null; }
    }
}

class EngineFlame extends Entity {
    constructor(x, y) {
        super(x, y, SizesConfig.engineFlame.width, SizesConfig.engineFlame.height); this.life = 14; this.velX = (Math.random() - 0.5) * 2; this.velY = 2 + Math.random() * 1.5;
        this.mesh = BABYLON.MeshBuilder.CreateDisc("engineFlame", { radius: 0.5, tessellation: 16 }, scene);
        const mat = createMaterial("engineFlameMat", new BABYLON.Color3(1.0, 0.5, 0.1)); this.mesh.material = mat;
        this.mesh.renderingGroupId = 1; this.mesh.billboardMode = BABYLON.AbstractMesh.BILLBOARDMODE_ALL; this.mesh.material.alpha = 0.8;
        fitMeshToPixels(this.mesh, this.width, this.height); registerGlowMesh(this.mesh); this.updateMeshPosition();
    }
    update() { this.x += this.velX; this.y += this.velY; if (this.mesh && this.mesh.material) this.mesh.material.alpha *= 0.88; if (--this.life <= 0) this.destroy(); this.updateMeshPosition(); }
}

class Enemy extends Entity {
    constructor() {
        // Increase logical size so imported models scale larger
        super(random(SCREEN_WIDTH - 60) + 30, 30, SizesConfig.enemy.width, SizesConfig.enemy.height);
        this.energy = ENEMY_HEALTH;
        this.movement = random(8); this.distance = random(50); this.shootTime = random(100) + 20; this.releaseDebris = 20;
        this.phase = Math.random() * Math.PI * 2; this.speed = 0.8 + Math.random() * 1.4;
        this.mesh = buildBasicEnemyMesh();
        fitMeshToPixels(this.mesh, this.width, this.height);
        this.updateMeshPosition();
        // Preserve base orientation para top-down
        this.baseRotX = this.mesh.rotation.x || 0;
        this.baseRotZ = this.mesh.rotation.z || 0;
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
        if (engineFlamesEnabled && temporizes(6)) debrisEntities.push(new EngineFlame(this.x, this.y + this.height / 2));
const vx = this.x - oldX; const vy = this.y - oldY; if (this.mesh) {
            const targetZ = BABYLON.Scalar.Clamp(-vx * 0.12, -1.1, 1.1);
            // Enemies devem manter X-base e apenas inclinar em Z (banking)
            this.mesh.rotation.z = BABYLON.Scalar.Lerp(this.mesh.rotation.z || this.baseRotZ, this.baseRotZ + targetZ, 0.24);
            this.mesh.rotation.x = BABYLON.Scalar.Lerp(this.mesh.rotation.x || this.baseRotX, this.baseRotX, 0.24);
        }
        this.updateMeshPosition();
    }
    onDestroy() { gameState.enemyPopulation--; gameState.score += POINTS_ENEMY; audioSystem.playExplosion(); triggerShake(1.2, 8); }
}

class Meteor extends Entity {
    constructor() {
        super(0, 0, SizesConfig.meteor.width, SizesConfig.meteor.height); this.energy = METEOR_HEALTH; this.releaseDebris = 5;
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

// Entities moved to individual files in entities/ directory.