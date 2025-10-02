// Jogo Tosco de dar Tiro - Babylon.js Edition
// Converted from C++/SDL2 to JavaScript/Babylon.js

// Constants
const MAX_HEALTH = 1000;
const MAX_CHARGE = 1000;
const ENEMY_HEALTH = 5;
const METEOR_HEALTH = 1;
const MISSILE_HEALTH = 1;
const POINTS_ENEMY = 5;
const POINTS_METEOR = 1;
const POINTS_METRALHA = 20;
const POINTS_CHUVA = 100;
const SCREEN_WIDTH = 640;
const SCREEN_HEIGHT = 480;

// Global game state
let scene, engine, camera;
let gameState = {
    score: 0,
    numFrame: 0,
    playerHealth: MAX_HEALTH,
    playerCharge: MAX_CHARGE,
    gameOver: false,
    playerX: SCREEN_WIDTH / 2,
    playerY: SCREEN_HEIGHT - 80,
    cursorX: SCREEN_WIDTH / 2,
    cursorY: SCREEN_HEIGHT / 2,
    leftButton: false,
    rightButton: false,
    enemyPopulation: 0,
    playerAlive: true
};

// Entity lists
let friendlyEntities = [];
let enemyEntities = [];
let debrisEntities = [];

// Materials cache
let materials = {};

// Utility functions
function random(max) {
    return Math.floor(Math.random() * max);
}

function between(min, max) {
    return random(max - min) + min;
}

function distance(x1, y1, x2, y2) {
    const dx = Math.abs(x1 - x2);
    const dy = Math.abs(y1 - y2);
    return Math.sqrt(dx * dx + dy * dy);
}

function sign(n) {
    if (n < 0) return -1;
    if (n > 0) return 1;
    return 0;
}

function angleDir(x, y) {
    const dist = Math.sqrt(x * x + y * y);
    if (!dist) return 0;
    if (x < 0) return Math.asin(-y / dist) + Math.PI;
    return Math.asin(y / dist);
}

function temporizes(num) {
    return (gameState.numFrame % num) === 0;
}

// Material creation
function createMaterial(name, color) {
    if (materials[name]) return materials[name];
    const mat = new BABYLON.StandardMaterial(name, scene);
    mat.diffuseColor = color;
    mat.emissiveColor = color.scale(0.3);
    mat.specularColor = new BABYLON.Color3(0.2, 0.2, 0.2);
    materials[name] = mat;
    return mat;
}

// Scale a mesh so its bounding box matches desired pixel width/height
function fitMeshToPixels(mesh, targetWidth, targetHeight) {
    // Reset scaling to base
    mesh.scaling = new BABYLON.Vector3(1, 1, 1);
    mesh.refreshBoundingInfo(true);
    const bb = mesh.getBoundingInfo().boundingBox;
    const currentWidth = (bb.maximumWorld.x - bb.minimumWorld.x);
    const currentHeight = (bb.maximumWorld.y - bb.minimumWorld.y);
    const sx = targetWidth / (currentWidth || 1);
    const sy = targetHeight / (currentHeight || 1);
    mesh.scaling = new BABYLON.Vector3(sx, sy, 1);
    mesh.refreshBoundingInfo(true);
}

// Base Entity class
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
        }
        return false;
    }

    onDestroy() {
        // Override in subclasses
    }

    destroy() {
        this.alive = false;
        if (this.releaseDebris && !this.isOffScreen()) {
            for (let i = 0; i < this.releaseDebris; i++) {
                debrisEntities.push(new Debris(this.x, this.y));
            }
        }
        if (this.mesh) {
            this.mesh.dispose();
            this.mesh = null;
        }
    }

    update() {
        // Override in subclasses
    }

    updateMeshPosition() {
        if (this.mesh) {
            this.mesh.position.x = this.x - SCREEN_WIDTH / 2;
            this.mesh.position.y = -(this.y - SCREEN_HEIGHT / 2);
        }
    }
}

// Debris particles
class Debris extends Entity {
    constructor(x, y, angle = -1) {
        super(x, y, 1, 1);
        if (angle === -1) angle = Math.random() * 2 * Math.PI;
        
        this.restoX = 0;
        this.restoY = 0;
        const vel = random(100);
        this.dirX = Math.floor(vel * Math.cos(angle));
        this.dirY = Math.floor(vel * Math.sin(angle));
        this.incX = sign(this.dirX);
        this.incY = sign(this.dirY);
        this.dirX = Math.abs(this.dirX);
        this.dirY = Math.abs(this.dirY);
        this.dist = random(100);
        this.color = new BABYLON.Color3(Math.random(), Math.random(), Math.random());
        
        // Create mesh
        this.mesh = BABYLON.MeshBuilder.CreateBox("debris", { size: 0.5 }, scene);
        const mat = new BABYLON.StandardMaterial("debrisMat" + Math.random(), scene);
        mat.emissiveColor = this.color;
        this.mesh.material = mat;
        this.updateMeshPosition();
    }

    update() {
        this.restoX += this.dirX;
        this.restoY += this.dirY;
        
        while (this.restoX > 100) {
            this.restoX -= 100;
            this.x += this.incX;
        }
        while (this.restoY > 100) {
            this.restoY -= 100;
            this.y += this.incY;
        }
        
        this.dist--;
        if (this.dist < 1) this.destroy();
        this.updateMeshPosition();
    }
}

// Player
class Player extends Entity {
    constructor() {
        super(SCREEN_WIDTH / 2, SCREEN_HEIGHT - 80, 48, 48);
        this.energy = MAX_HEALTH;
        this.charge = MAX_CHARGE;
        this.shootTime = 0;
        this.releaseDebris = 500;
        
        // Create player mesh - spaceship
        const body = BABYLON.MeshBuilder.CreateBox("playerBody", { width: 3, height: 4, depth: 2 }, scene);
        const wing1 = BABYLON.MeshBuilder.CreateBox("wing1", { width: 6, height: 1, depth: 1 }, scene);
        const wing2 = BABYLON.MeshBuilder.CreateBox("wing2", { width: 6, height: 1, depth: 1 }, scene);
        const cockpit = BABYLON.MeshBuilder.CreateSphere("cockpit", { diameter: 1.5 }, scene);
        
        wing1.position.y = -1;
        wing2.position.y = 1;
        cockpit.position.z = 1;
        
        this.mesh = BABYLON.Mesh.MergeMeshes([body, wing1, wing2, cockpit], true, true, undefined, false, true);
        this.mesh.material = createMaterial("player", new BABYLON.Color3(0.2, 0.6, 1));
        fitMeshToPixels(this.mesh, this.width, this.height);
        this.updateMeshPosition();
        
        gameState.playerAlive = true;
    }

    update() {
        const deltaX = gameState.cursorX - this.x;
        const deltaY = gameState.cursorY - this.y;
        const dist = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        
        if (dist > 20) {
            this.x += (deltaX * 20) / dist;
            this.y += (deltaY * 20) / dist;
            this.keepOnScreen();
        } else {
            this.x = gameState.cursorX;
            this.y = gameState.cursorY;
            this.keepOnScreen();
        }

        if (this.charge < MAX_CHARGE) this.charge++;
        if (this.shootTime < 1000) this.shootTime++;

        // Shooting
        if (this.charge >= 20 && this.shootTime >= 5) {
            if (gameState.leftButton) {
                this.shootTime = 0;
                this.charge -= 10;
                
                if (gameState.score >= 500) {
                    friendlyEntities.push(new Laser());
                    audioSystem.playLaser();
                } else {
                    friendlyEntities.push(new Missile(this.x, this.y - 5, 0, -10, true));
                    audioSystem.playShoot();
                }
            }
        }

        // Special attacks
        if (gameState.rightButton && this.charge >= MAX_CHARGE && this.shootTime) {
            this.pulse();
            this.charge = 0;
            this.shootTime = 0;
            audioSystem.playSpecial();
        }
        
        if (gameState.rightButton && this.charge >= 150 && this.shootTime > 50) {
            this.pulse(0.3);
            this.charge -= 50;
            this.shootTime = 0;
            audioSystem.playSpecial();
        }

        // Regenerate health
        if (this.charge === MAX_CHARGE && this.energy < MAX_HEALTH && temporizes(10)) {
            this.energy++;
        }

        gameState.playerHealth = this.energy;
        gameState.playerCharge = this.charge;
        gameState.playerX = this.x;
        gameState.playerY = this.y;
        this.updateMeshPosition();
    }

    pulse(inc = 0.05) {
        for (let angle = 0; angle < Math.PI * 2; angle += inc) {
            friendlyEntities.push(new Missile(this.x, this.y, Math.cos(angle) * 10, Math.sin(angle) * 10, true));
        }
    }

    onDestroy() {
        gameState.playerAlive = false;
        gameState.gameOver = true;
        audioSystem.playExplosion();
        document.getElementById('game-over').classList.add('visible');
    }
}

// Missile/Projectile
class Missile extends Entity {
    constructor(x, y, velX, velY, friendly = false) {
        super(x, y, 10, 10);
        this.energy = MISSILE_HEALTH;
        this.dirX = Math.floor(velX * 100);
        this.dirY = Math.floor(velY * 100);
        this.incX = sign(this.dirX);
        this.incY = sign(this.dirY);
        this.dirX = Math.abs(this.dirX);
        this.dirY = Math.abs(this.dirY);
        this.restoX = 0;
        this.restoY = 0;
        this.releaseDebris = 10;
        this.friendly = friendly;
        
        // Create mesh
        this.mesh = BABYLON.MeshBuilder.CreateSphere("missile", { diameter: 1 }, scene);
        const color = friendly ? new BABYLON.Color3(0, 0.5, 1) : new BABYLON.Color3(1, 0.5, 0);
        this.mesh.material = createMaterial(friendly ? "friendlyMissile" : "enemyMissile", color);
        fitMeshToPixels(this.mesh, this.width, this.height);
        this.updateMeshPosition();
    }

    update() {
        this.restoX += this.dirX;
        this.restoY += this.dirY;
        
        while (this.restoX >= 100) {
            this.restoX -= 100;
            this.x += this.incX;
        }
        while (this.restoY >= 100) {
            this.restoY -= 100;
            this.y += this.incY;
        }
        
        if (this.isOffScreen()) this.destroy();
        this.updateMeshPosition();
    }
}

// Nuclear (splits on destruction)
class Nuclear extends Missile {
    constructor(x, y, velX, velY, level = 0) {
        super(x, y, velX, velY, true);
        this.level = level;
        this.angle = angleDir(velX, velY);
        const sizes = [20, 18, 14, 10];
        this.width = this.height = sizes[level] || 10;
        
        // Larger mesh for bigger nukes
        this.mesh.dispose();
        const size = 1 + level * 0.5;
        this.mesh = BABYLON.MeshBuilder.CreateSphere("nuclear", { diameter: size }, scene);
        this.mesh.material = createMaterial("nuclear", new BABYLON.Color3(1, 0, 0));
        fitMeshToPixels(this.mesh, this.width, this.height);
        this.updateMeshPosition();
    }

    onDestroy() {
        if (this.level >= 3) return;
        
        let newAngle = this.angle > Math.PI ? this.angle - Math.PI : this.angle + Math.PI;
        this.x += Math.cos(newAngle) * 10;
        this.y += Math.sin(newAngle) * 10;
        
        for (let ang = newAngle - 1; ang < newAngle + 1; ang += 0.5) {
            friendlyEntities.push(new Nuclear(
                this.x, this.y,
                Math.cos(ang) * 5, Math.sin(ang) * 5,
                this.level + 1
            ));
        }
    }
}

// Laser beam
class Laser extends Entity {
    constructor() {
        super(gameState.playerX, gameState.playerY - 10, 2, 50);
        this.energy = 2;
        this.releaseDebris = 10;
        
        this.mesh = BABYLON.MeshBuilder.CreateBox("laser", { width: 1, height: 1, depth: 0.3 }, scene);
        this.mesh.material = createMaterial("laser", new BABYLON.Color3(0, 1, 1));
        fitMeshToPixels(this.mesh, this.width, this.height);
        this.updateMeshPosition();
    }

    update() {
        this.y -= 10;
        this.x = gameState.playerX;
        if (this.y < 40) this.destroy();
        this.updateMeshPosition();
    }
}

// Enemy
class Enemy extends Entity {
    constructor() {
        super(random(SCREEN_WIDTH - 60) + 30, 30, 20, 20);
        this.energy = ENEMY_HEALTH;
        this.movement = random(4); // 0=down, 1=up, 2=left, 3=right
        this.distance = random(50);
        this.shootTime = random(100) + 20;
        this.releaseDebris = 50;
        
        // Create enemy mesh
        const body = BABYLON.MeshBuilder.CreateBox("enemyBody", { size: 2 }, scene);
        const spike1 = BABYLON.MeshBuilder.CreateCylinder("spike1", { height: 1, diameter: 0.5 }, scene);
        const spike2 = BABYLON.MeshBuilder.CreateCylinder("spike2", { height: 1, diameter: 0.5 }, scene);
        
        spike1.position.x = -1;
        spike1.rotation.z = Math.PI / 2;
        spike2.position.x = 1;
        spike2.rotation.z = Math.PI / 2;
        
        this.mesh = BABYLON.Mesh.MergeMeshes([body, spike1, spike2], true, true, undefined, false, true);
        const gray = 0.5 + Math.random() * 0.3;
        this.mesh.material = createMaterial("enemy" + Math.random(), new BABYLON.Color3(gray, gray, gray));
        fitMeshToPixels(this.mesh, this.width, this.height);
        this.updateMeshPosition();
        
        gameState.enemyPopulation++;
    }

    update() {
        // Movement
        switch (this.movement) {
            case 0: this.y++; break;
            case 1: this.y--; break;
            case 2: this.x--; break;
            case 3: this.x++; break;
        }
        
        if (this.distance >= 0) {
            this.distance--;
        } else {
            this.distance = random(50);
            this.movement = random(5);
        }
        
        // Boundary checks
        if (this.y - 20 < 20) { this.movement = 0; this.distance = 10; }
        if (this.y > SCREEN_HEIGHT / 2) { this.movement = 1; this.distance = 10; }
        if (this.x + 20 > SCREEN_WIDTH) { this.movement = 2; this.distance = 10; }
        if (this.x - 20 < 0) { this.movement = 3; this.distance = 10; }
        
        // Shooting
        if (!this.shootTime) {
            this.shootTime = random(180) + 20;
            enemyEntities.push(new Missile(this.x - 9, this.y + 20, 0, 3, false));
            enemyEntities.push(new Missile(this.x + 9, this.y + 20, 0, 3, false));
        } else {
            this.shootTime--;
        }
        
        this.updateMeshPosition();
    }

    onDestroy() {
        gameState.enemyPopulation--;
        gameState.score += POINTS_ENEMY;
        audioSystem.playHit();
    }
}

// Meteor
class Meteor extends Entity {
    constructor() {
        super(0, 0, 5, 5);
        this.energy = METEOR_HEALTH;
        this.releaseDebris = 10;
        
        // Random entry point
        let angle;
        switch (random(4)) {
            case 0:
                this.x = 10;
                this.y = random(SCREEN_HEIGHT - 10);
                angle = random(90);
                if (angle > 45) angle += 269;
                break;
            case 1:
                this.x = SCREEN_WIDTH - 10;
                this.y = random(SCREEN_HEIGHT - 10);
                angle = between(135, 225);
                break;
            case 2:
                this.x = random(SCREEN_WIDTH - 10);
                this.y = 10;
                angle = between(45, 135);
                break;
            case 3:
                this.x = random(SCREEN_WIDTH - 10);
                this.y = SCREEN_HEIGHT - 10;
                angle = between(225, 315);
                break;
        }
        
        angle *= Math.PI / 180;
        this.dirX = Math.floor(200 * Math.cos(angle));
        this.dirY = Math.floor(200 * Math.sin(angle));
        this.incX = sign(this.dirX);
        this.incY = sign(this.dirY);
        this.dirX = Math.abs(this.dirX);
        this.dirY = Math.abs(this.dirY);
        this.restoX = 0;
        this.restoY = 0;
        
        this.mesh = BABYLON.MeshBuilder.CreatePolyhedron("meteor", { type: 1, size: 1 }, scene);
        this.mesh.material = createMaterial("meteor", new BABYLON.Color3(0.4, 0.3, 0.2));
        fitMeshToPixels(this.mesh, this.width, this.height);
        this.updateMeshPosition();
    }

    update() {
        this.restoX += this.dirX;
        this.restoY += this.dirY;
        
        while (this.restoX >= 100) {
            this.restoX -= 100;
            this.x += this.incX;
        }
        while (this.restoY >= 100) {
            this.restoY -= 100;
            this.y += this.incY;
        }
        
        if (this.isOffScreen()) this.destroy();
        this.updateMeshPosition();
    }

    onDestroy() {
        gameState.score += POINTS_METEOR;
    }
}

// Guided missile (homes in on player)
class Guided extends Entity {
    constructor(x, y) {
        super(x, y, 10, 10);
        this.energy = 1;
        this.velX = 0;
        this.velY = 0;
        this.time = 0;
        this.releaseDebris = 10;
        
        this.mesh = BABYLON.MeshBuilder.CreateSphere("guided", { diameter: 1 }, scene);
        this.mesh.material = createMaterial("guided", new BABYLON.Color3(1, 0, 1));
        fitMeshToPixels(this.mesh, this.width, this.height);
        this.updateMeshPosition();
    }

    update() {
        let deltaX = this.x - gameState.playerX;
        let deltaY = this.y - gameState.playerY;
        let dist = distance(this.x, this.y, gameState.playerX, gameState.playerY);
        if (!dist) dist = 1;
        
        deltaX = deltaX / dist / 5;
        deltaY = deltaY / dist / 5;
        this.velX = (this.velX - deltaX) * 0.99;
        this.velY = (this.velY - deltaY) * 0.99;
        
        this.x += this.velX;
        this.y += this.velY;
        
        if (++this.time > 1000) this.destroy();
        this.updateMeshPosition();
    }

    onDestroy() {
        gameState.score++;
    }
}

// Star powerup (shoots pulse)
class Star extends Entity {
    constructor() {
        super(random(SCREEN_WIDTH - 80) + 40, 40, 64, 48);
        this.energy = 100;
        this.releaseDebris = 500;
        
        // Star shape
        this.mesh = BABYLON.MeshBuilder.CreateDisc("star", { radius: 1, tessellation: 5 }, scene);
        this.mesh.material = createMaterial("star", new BABYLON.Color3(1, 1, 0));
        fitMeshToPixels(this.mesh, this.width, this.height);
        this.updateMeshPosition();
    }

    update() {
        if (temporizes(10)) {
            if (gameState.score > 5000 && temporizes(50)) {
                this.pulse();
            }
            if (++this.y > SCREEN_HEIGHT) this.destroy();
        }
        this.updateMeshPosition();
    }

    pulse() {
        for (let angle = 0; angle < Math.PI * 2; angle += 0.05) {
            enemyEntities.push(new Missile(this.x, this.y, Math.cos(angle) * 10, Math.sin(angle) * 10, false));
        }
    }

    onDestroy() {
        gameState.score += 100;
        this.pulse();
        audioSystem.playPowerup();
    }
}

// Rain powerup (spawns guided missiles)
class Rain extends Entity {
    constructor(x = null, y = null) {
        if (x === null) {
            x = random(SCREEN_WIDTH - 40) + 20;
            y = 40;
        }
        super(x, y, 20, 20);
        this.energy = 100;
        this.radius = 0;
        this.releaseDebris = 100;
        
        this.mesh = BABYLON.MeshBuilder.CreateTorus("rain", { diameter: 1, thickness: 0.25, tessellation: 16 }, scene);
        this.mesh.material = createMaterial("rain", new BABYLON.Color3(0, 1, 0));
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

    onDestroy() {
        gameState.score += POINTS_CHUVA;
        audioSystem.playPowerup();
    }
}

// Metralha (shoots at player)
class Metralha extends Entity {
    constructor(x = null, y = null) {
        if (x === null) {
            x = random(SCREEN_WIDTH - 96) + 48;
            y = 48;
        }
        super(x, y, 48, 48);
        this.energy = 10;
        this.releaseDebris = 100;
        
        // Complex shape
        const box = BABYLON.MeshBuilder.CreateBox("metralhaBox", { size: 3 }, scene);
        const cyl = BABYLON.MeshBuilder.CreateCylinder("metralhaCyl", { height: 2, diameter: 1 }, scene);
        cyl.position.y = 2;
        
        this.mesh = BABYLON.Mesh.MergeMeshes([box, cyl], true, true, undefined, false, true);
        this.mesh.material = createMaterial("metralha", new BABYLON.Color3(0, 0.8, 0.4));
        fitMeshToPixels(this.mesh, this.width, this.height);
        this.updateMeshPosition();
    }

    update() {
        if (temporizes(25)) {
            const dx = gameState.playerX - this.x;
            const dy = gameState.playerY - this.y;
            let dist = Math.sqrt(dx * dx + dy * dy);
            if (!dist) dist = 1;
            
            enemyEntities.push(new Missile(
                this.x, this.y,
                (dx * 5) / dist, (dy * 5) / dist,
                false
            ));
        }
        
        if (temporizes(10)) {
            this.y++;
            if (this.isOffScreen()) this.destroy();
        }
        
        this.updateMeshPosition();
    }

    onDestroy() {
        gameState.score += POINTS_METRALHA;
        audioSystem.playPowerup();
    }
}

// Transport (spawns Metralha)
class Transport extends Entity {
    constructor() {
        super(0, random(SCREEN_HEIGHT / 2 - 40) + 40, 100, 20);
        this.energy = 500;
        this.releaseDebris = 200;
        
        this.mesh = BABYLON.MeshBuilder.CreateBox("transport", { width: 1, height: 1, depth: 2 }, scene);
        this.mesh.material = createMaterial("transport", new BABYLON.Color3(0.4, 0.3, 0.3));
        fitMeshToPixels(this.mesh, this.width, this.height);
        this.updateMeshPosition();
    }

    update() {
        if (temporizes(50)) {
            enemyEntities.push(new Metralha(this.x, this.y));
        }
        if (temporizes(10)) this.y++;
        if (++this.x > SCREEN_WIDTH) this.destroy();
        this.updateMeshPosition();
    }
}

// Encrenca (spawns Rain)
class Encrenca extends Entity {
    constructor() {
        super(0, random(SCREEN_HEIGHT / 2 - 40) + 40, 100, 20);
        this.energy = 500;
        this.releaseDebris = 200;
        
        this.mesh = BABYLON.MeshBuilder.CreateBox("encrenca", { width: 1, height: 1, depth: 2 }, scene);
        this.mesh.material = createMaterial("encrenca", new BABYLON.Color3(0.3, 0.3, 0.3));
        fitMeshToPixels(this.mesh, this.width, this.height);
        this.updateMeshPosition();
    }

    update() {
        if (temporizes(100)) {
            enemyEntities.push(new Rain(this.x, this.y));
        }
        if (temporizes(10)) this.y++;
        if (++this.x > SCREEN_WIDTH) this.destroy();
        this.updateMeshPosition();
    }
}

// Collision detection
function collides(a, b) {
    const deltaX = Math.abs(a.x - b.x) - (a.width / 2) - (b.width / 2);
    const deltaY = Math.abs(a.y - b.y) - (a.height / 2) - (b.height / 2);
    return (deltaX <= 0) && (deltaY <= 0);
}

function testCollision(a, b) {
    if (collides(a, b)) {
        const ea = a.energy;
        a.takeDamage(b.energy);
        b.takeDamage(ea);
    }
}

function distributeHits(list1, list2) {
    for (let i = 0; i < list1.length; i++) {
        if (!list1[i].alive) continue;
        for (let j = 0; j < list2.length; j++) {
            if (!list2[j].alive) continue;
            testCollision(list1[i], list2[j]);
        }
    }
}

// Enemy spawning
function possib(offset, prob) {
    return ((gameState.numFrame + offset) % 500 === 0) && (random(100) < prob);
}

function spawnEnemies() {
    if (possib(0, 30)) {
        if (gameState.score >= 500) {
            enemyEntities.push(new Transport());
        } else {
            enemyEntities.push(new Metralha());
        }
    }
    
    if (possib(100, 30)) {
        if (gameState.score >= 500) {
            if (gameState.score >= 5000) {
                enemyEntities.push(new Encrenca());
            } else {
                enemyEntities.push(new Rain());
            }
        } else {
            enemyEntities.push(new Star());
        }
    }
    
    if (possib(200, 30)) {
        for (let j = 0; j < 50; j++) {
            enemyEntities.push(new Meteor());
        }
    }
    
    if (possib(300, 30)) {
        enemyEntities.push(new Star());
    }
    
    if (gameState.enemyPopulation < 25 && possib(400, 30)) {
        for (let i = 0; i < 3; i++) {
            enemyEntities.push(new Enemy());
        }
    }
}

// Update HUD
function updateHUD() {
    document.getElementById('score').textContent = `Score: ${gameState.score}`;
    document.getElementById('health-bar').style.width = `${(gameState.playerHealth / MAX_HEALTH) * 100}%`;
    document.getElementById('charge-bar').style.width = `${(gameState.playerCharge / MAX_CHARGE) * 100}%`;
    gameState.playerCharge = Math.min(MAX_CHARGE, gameState.playerCharge);
}

// Clean up dead entities
function cleanupEntities() {
    friendlyEntities = friendlyEntities.filter(e => e.alive);
    enemyEntities = enemyEntities.filter(e => e.alive);
    debrisEntities = debrisEntities.filter(e => e.alive);
}

// Main game loop
function gameLoop() {
    if (gameState.gameOver) return;
    
    // Ensure player exists
    if (!gameState.playerAlive) {
        friendlyEntities.push(new Player());
    }
    
    // Update all entities
    friendlyEntities.forEach(e => e.update());
    enemyEntities.forEach(e => e.update());
    debrisEntities.forEach(e => e.update());
    
    // Collision detection
    distributeHits(friendlyEntities, enemyEntities);
    
    // Spawn enemies
    if (gameState.playerAlive) {
        spawnEnemies();
    }
    
    // Cleanup
    cleanupEntities();
    
    // Update HUD
    updateHUD();
    
    gameState.numFrame++;
}

// Initialize Babylon.js
function createScene() {
    const canvas = document.getElementById('renderCanvas');
    engine = new BABYLON.Engine(canvas, true);
    scene = new BABYLON.Scene(engine);
    scene.clearColor = new BABYLON.Color3(0, 0, 0);
    
    // Orthographic camera for 2D gameplay
    camera = new BABYLON.FreeCamera("camera", new BABYLON.Vector3(0, 0, -50), scene);
    camera.mode = BABYLON.Camera.ORTHOGRAPHIC_CAMERA;
    camera.orthoLeft = -SCREEN_WIDTH / 2;
    camera.orthoRight = SCREEN_WIDTH / 2;
    camera.orthoTop = SCREEN_HEIGHT / 2;
    camera.orthoBottom = -SCREEN_HEIGHT / 2;
    
    // Ambient light
    const light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), scene);
    light.intensity = 0.8;
    
    // Point light for dramatic effect
    const pointLight = new BABYLON.PointLight("pointLight", new BABYLON.Vector3(0, 0, -30), scene);
    pointLight.intensity = 0.5;
    
    // Create initial player
    friendlyEntities.push(new Player());
    
    // Input handling (mouse + pointer)
    const updateCursor = (clientX, clientY) => {
        const rect = canvas.getBoundingClientRect();
        const scaleX = SCREEN_WIDTH / rect.width;
        const scaleY = SCREEN_HEIGHT / rect.height;
        gameState.cursorX = (clientX - rect.left) * scaleX;
        gameState.cursorY = (clientY - rect.top) * scaleY;
    };

    canvas.addEventListener('mousemove', (e) => {
        updateCursor(e.clientX, e.clientY);
    }, { passive: true });

    // Pointer events are more robust across devices
    canvas.addEventListener('pointerdown', (e) => {
        audioSystem.init(); // Initialize/resume audio on first interaction
        updateCursor(e.clientX, e.clientY);
        if (e.button === 0) gameState.leftButton = true;
        if (e.button === 2) gameState.rightButton = true;
        try { canvas.setPointerCapture(e.pointerId); } catch {}
        e.preventDefault();
    }, { passive: false });

    canvas.addEventListener('pointerup', (e) => {
        if (e.button === 0) gameState.leftButton = false;
        if (e.button === 2) gameState.rightButton = false;
        try { canvas.releasePointerCapture(e.pointerId); } catch {}
        e.preventDefault();
    }, { passive: false });

    canvas.addEventListener('mouseleave', () => {
        gameState.leftButton = false;
        gameState.rightButton = false;
    });

    // Fallback mouse events
    canvas.addEventListener('mousedown', (e) => {
        audioSystem.init();
        updateCursor(e.clientX, e.clientY);
        if (e.button === 0) gameState.leftButton = true;
        if (e.button === 2) gameState.rightButton = true;
        e.preventDefault();
    }, { passive: false });

    canvas.addEventListener('mouseup', (e) => {
        if (e.button === 0) gameState.leftButton = false;
        if (e.button === 2) gameState.rightButton = false;
        e.preventDefault();
    }, { passive: false });

    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    
    // Touch support
    canvas.addEventListener('touchstart', (e) => {
        audioSystem.init();
        if (e.touches.length > 0) {
            const rect = canvas.getBoundingClientRect();
            const scaleX = SCREEN_WIDTH / rect.width;
            const scaleY = SCREEN_HEIGHT / rect.height;
            gameState.cursorX = (e.touches[0].clientX - rect.left) * scaleX;
            gameState.cursorY = (e.touches[0].clientY - rect.top) * scaleY;
            gameState.leftButton = true;
        }
        e.preventDefault();
    }, { passive: false });
    
    canvas.addEventListener('touchmove', (e) => {
        if (e.touches.length > 0) {
            const rect = canvas.getBoundingClientRect();
            const scaleX = SCREEN_WIDTH / rect.width;
            const scaleY = SCREEN_HEIGHT / rect.height;
            gameState.cursorX = (e.touches[0].clientX - rect.left) * scaleX;
            gameState.cursorY = (e.touches[0].clientY - rect.top) * scaleY;
        }
        e.preventDefault();
    }, { passive: false });
    
    canvas.addEventListener('touchend', () => {
        gameState.leftButton = false;
        gameState.rightButton = false;
    });
    
    // Game over restart
    document.addEventListener('click', () => {
        if (gameState.gameOver) {
            location.reload();
        }
    });
    
    // Run game loop
    scene.registerBeforeRender(gameLoop);
    
    // Render loop
    engine.runRenderLoop(() => {
        scene.render();
    });
    
    // Resize handling
    window.addEventListener('resize', () => {
        engine.resize();
    });
}

// Start the game
window.addEventListener('DOMContentLoaded', createScene);
