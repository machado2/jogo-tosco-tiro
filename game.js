// Jogo Tosco de dar Tiro - Babylon.js Edition
// Converted from C++/SDL2 to JavaScript/Babylon.js

// Constants
const MAX_HEALTH = 100;
const MAX_CHARGE = 1000;
const CHARGE_REFILL_PER_FRAME = 0.3;
const ENEMY_HEALTH = 5;
const METEOR_HEALTH = 1;
const MISSILE_HEALTH = 1;
const POINTS_ENEMY = 5;
const POINTS_METEOR = 1;
const POINTS_METRALHA = 20;
const POINTS_CHUVA = 100;
const SCREEN_WIDTH = 640;
const SCREEN_HEIGHT = 480;
const MAX_DEBRIS_TOTAL = 600;
const MAX_DEBRIS_PER_EVENT = 80;
const DEATH_OVERLAY_DELAY_FRAMES = 90; // ~1.5s at 60fps

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
    playerAlive: true,
    deathSequenceFrames: 0
};

// Entity lists
let friendlyEntities = [];
let enemyEntities = [];
let debrisEntities = [];

// Materials cache
let materials = {};

// Debris pool
let debrisBaseMesh = null;
let debrisMaterial = null;
let totalDebrisCount = 0;

// Post FX and background
let glowLayer = null;
let renderingPipeline = null;
let highlightLayer = null;
let starfield = null;

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
    // Go for a crisp neon look
    mat.diffuseColor = color;
    mat.emissiveColor = color.scale(0.9);
    mat.specularColor = new BABYLON.Color3(0, 0, 0);
    mat.disableLighting = true; // 2D arcade vibe
    materials[name] = mat;
    return mat;
}

function initDebrisPool() {
    if (debrisBaseMesh) return;
    debrisBaseMesh = BABYLON.MeshBuilder.CreateBox("debrisBase", { size: 0.5 }, scene);
    debrisMaterial = new BABYLON.StandardMaterial("debrisMat", scene);
    debrisMaterial.emissiveColor = new BABYLON.Color3(1, 1, 1);
    debrisMaterial.disableLighting = true;
    debrisBaseMesh.material = debrisMaterial;
    debrisBaseMesh.renderingGroupId = 1; // above background
    debrisBaseMesh.setEnabled(false);
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

// ---------- Visual helpers: environment, procedural textures, and mesh builders ----------
function ensureEnvironment() {
    // Use a hosted prefiltered env map for nicer PBR reflections
    if (!scene.environmentTexture) {
        try {
            scene.environmentTexture = BABYLON.CubeTexture.CreateFromPrefilteredData(
                "https://assets.babylonjs.com/environments/environmentSpecular.env",
                scene
            );
        } catch {}
    }
}

function registerGlowMesh(mesh) {
    if (glowLayer && glowLayer.addIncludedOnlyMesh) {
        try { glowLayer.addIncludedOnlyMesh(mesh); } catch {}
    }
}

function colorToCSS(c) {
    return `rgb(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)})`;
}

function scaleColor(c, s) {
    return new BABYLON.Color3(
        Math.min(1, c.r * s),
        Math.min(1, c.g * s),
        Math.min(1, c.b * s)
    );
}

// Simple panel-line dynamic texture
function createPanelTexture(name, baseColor) {
    const size = 256;
    const dt = new BABYLON.DynamicTexture(name, { width: size, height: size }, scene, false);
    const ctx = dt.getContext();
    const cTop = colorToCSS(scaleColor(baseColor, 1.05));
    const cBot = colorToCSS(scaleColor(baseColor, 0.85));
    const grad = ctx.createLinearGradient(0, 0, 0, size);
    grad.addColorStop(0, cTop);
    grad.addColorStop(1, cBot);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    // Grid/panel lines
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = 1;
    for (let i = 32; i < size; i += 32) {
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(size, i); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, size); ctx.stroke();
    }
    // Few diagonal accent lines
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    for (let i = -size; i < size; i += 64) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + size, size); ctx.stroke();
    }
    dt.update(false);
    return dt;
}

function createPBRMetalMaterial(name, baseColor, panelTexture = null, emissiveFactor = 0.08) {
    ensureEnvironment();
    const mat = new BABYLON.PBRMaterial(name, scene);
    mat.metallic = 1.0;
    mat.roughness = 0.35;
    mat.environmentIntensity = 0.8;
    mat.albedoColor = baseColor;
    if (panelTexture) mat.albedoTexture = panelTexture;
    mat.emissiveColor = baseColor.scale(emissiveFactor);
    return mat;
}

// Build an improved player ship (lathe fuselage + wings + canopy)
function buildPlayerShipMesh() {
    const bodyColor = new BABYLON.Color3(0.18, 0.55, 1);
    const panelTex = createPanelTexture("playerPanelTex", bodyColor);
    const hullMat = createPBRMetalMaterial("playerHull", bodyColor, panelTex, 0.05);

    const profile = [
        new BABYLON.Vector3(0.00, 1.20, 0),
        new BABYLON.Vector3(0.45, 0.90, 0),
        new BABYLON.Vector3(0.60, 0.30, 0),
        new BABYLON.Vector3(0.38, -0.40, 0),
        new BABYLON.Vector3(0.20, -0.95, 0),
        new BABYLON.Vector3(0.00, -1.30, 0)
    ];
    const fuselage = BABYLON.MeshBuilder.CreateLathe("playerFuselage", {
        shape: profile,
        sideOrientation: BABYLON.Mesh.DOUBLESIDE,
        tessellation: 24
    }, scene);
    fuselage.material = hullMat;

    const wingL = BABYLON.MeshBuilder.CreateBox("wingL", { width: 2.4, height: 0.12, depth: 0.7 }, scene);
    wingL.position.x = -1.0; wingL.position.y = 0.1; wingL.rotation.z = 0.12; wingL.material = hullMat;
    const wingR = wingL.clone("wingR"); wingR.position.x = 1.0; wingR.rotation.z = -0.12;

    const fin = BABYLON.MeshBuilder.CreateBox("fin", { width: 0.25, height: 0.9, depth: 0.4 }, scene);
    fin.position.y = -0.5; fin.material = hullMat;

    const glass = new BABYLON.PBRMaterial("cockpitGlass", scene);
    ensureEnvironment();
    glass.metallic = 0.0; glass.roughness = 0.05; glass.alpha = 0.8;
    glass.albedoColor = new BABYLON.Color3(0.5, 0.8, 1);
    const canopy = BABYLON.MeshBuilder.CreateSphere("canopy", { diameter: 0.7 }, scene);
    canopy.position.y = 0.25; canopy.position.z = 0.25; canopy.material = glass;

const engine = BABYLON.MeshBuilder.CreatePlane("engineGlow", { size: 0.7 }, scene);
    engine.billboardMode = BABYLON.AbstractMesh.BILLBOARDMODE_ALL;
    engine.position.y = -1.25; engine.position.z = -0.1;
    const engineMat = createMaterial("engineGlowMat", new BABYLON.Color3(1.0, 0.5, 0.1));
    engine.material = engineMat;

    const merged = BABYLON.Mesh.MergeMeshes([fuselage, wingL, wingR, fin, canopy], true, true, undefined, false, true);
    merged.renderingGroupId = 1;
    engine.parent = merged;
    engine.renderingGroupId = 1;
    registerGlowMesh(engine);
    return merged;
}

function buildBasicEnemyMesh() {
    const bodyColor = new BABYLON.Color3(0.6, 0.6, 0.65);
    const tex = createPanelTexture("enemyPanelTex", bodyColor);
    const mat = createPBRMetalMaterial("enemyHull", bodyColor, tex, 0.03);

    const body = BABYLON.MeshBuilder.CreatePolyhedron("enemyBody", { type: 2, size: 1.0 }, scene); // octa-like
    body.material = mat;
    const armL = BABYLON.MeshBuilder.CreateBox("armL", { width: 1.6, height: 0.12, depth: 0.4 }, scene);
    armL.position.x = -1.1; armL.material = mat;
    const armR = armL.clone("armR"); armR.position.x = 1.1;
    const spike = BABYLON.MeshBuilder.CreateCylinder("spike", { height: 0.8, diameterTop: 0.0, diameterBottom: 0.35 }, scene);
    spike.position.y = -0.9; spike.material = mat;

    const merged = BABYLON.Mesh.MergeMeshes([body, armL, armR, spike], true, true, undefined, false, true);
    merged.renderingGroupId = 1;
    return merged;
}

function buildTurretMesh() {
    const baseColor = new BABYLON.Color3(0.0, 0.8, 0.4);
    const tex = createPanelTexture("turretPanelTex", baseColor);
    const mat = createPBRMetalMaterial("turretHull", baseColor, tex, 0.04);

    const base = BABYLON.MeshBuilder.CreateCylinder("turBase", { height: 0.6, diameter: 1.4, tessellation: 24 }, scene);
    base.material = mat;
    const ring = BABYLON.MeshBuilder.CreateTorus("turRing", { diameter: 1.6, thickness: 0.12 }, scene);
    ring.rotation.x = Math.PI / 2; ring.material = mat;
    const barrel = BABYLON.MeshBuilder.CreateCylinder("turBarrel", { height: 1.8, diameter: 0.25 }, scene);
    barrel.rotation.x = Math.PI / 2; barrel.position.y = 0.5; barrel.position.z = 0.8; barrel.material = mat;

    const merged = BABYLON.Mesh.MergeMeshes([base, ring, barrel], true, true, undefined, false, true);
    merged.renderingGroupId = 1;
    return merged;
}

function buildTransportMesh(color = new BABYLON.Color3(0.4, 0.3, 0.3)) {
    const tex = createPanelTexture("transportPanelTex", color);
    const mat = createPBRMetalMaterial("transportHull", color, tex, 0.02);
    const hull = BABYLON.MeshBuilder.CreateBox("transHull", { width: 5, height: 1.2, depth: 1.2 }, scene);
    hull.material = mat;
    const ribs = [];
    for (let i = -2; i <= 2; i++) {
        const rib = BABYLON.MeshBuilder.CreateBox("rib" + i, { width: 0.2, height: 1.3, depth: 1.25 }, scene);
        rib.position.x = i * 0.9;
        rib.material = mat;
        ribs.push(rib);
    }
    const merged = BABYLON.Mesh.MergeMeshes([hull, ...ribs], true, true, undefined, false, true);
    merged.renderingGroupId = 1;
    return merged;
}

function buildMeteorMesh() {
    // Start from an ico sphere and perturb vertices for a rocky look
    const rock = BABYLON.MeshBuilder.CreateIcoSphere("meteor", { radius: 1, subdivisions: 2 }, scene);
    const positions = rock.getVerticesData(BABYLON.VertexBuffer.PositionKind);
    for (let i = 0; i < positions.length; i += 3) {
        const nx = (Math.random() - 0.5) * 0.25;
        const ny = (Math.random() - 0.5) * 0.25;
        const nz = (Math.random() - 0.5) * 0.25;
        positions[i] += nx; positions[i + 1] += ny; positions[i + 2] += nz;
    }
    rock.updateVerticesData(BABYLON.VertexBuffer.PositionKind, positions);
    const mat = new BABYLON.StandardMaterial("meteorMat", scene);
    mat.diffuseColor = new BABYLON.Color3(0.45, 0.35, 0.25);
    mat.emissiveColor = new BABYLON.Color3(0.1, 0.08, 0.06);
    mat.specularColor = new BABYLON.Color3(0.05, 0.05, 0.05);
    rock.material = mat;
    rock.renderingGroupId = 1;
    return rock;
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
        }
        return false;
    }

    onDestroy() {
        // Override in subclasses
    }

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
        this.dist = random(60);
        
        // Use instanced mesh from pool
        this.mesh = debrisBaseMesh.createInstance("debrisInst");
        this.mesh.setEnabled(true);
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

    destroy() {
        if (!this.alive) return;
        this.alive = false;
        if (this.mesh) {
            this.mesh.dispose();
            this.mesh = null;
        }
        totalDebrisCount = Math.max(0, totalDebrisCount - 1);
    }
}

// Player
class Player extends Entity {
    constructor() {
        super(SCREEN_WIDTH / 2, SCREEN_HEIGHT - 80, 48, 48);
        this.energy = MAX_HEALTH;
        this.charge = MAX_CHARGE;
        this.shootTime = 0;
        this.releaseDebris = 80;
        
        // Create improved player mesh
        this.mesh = buildPlayerShipMesh();
        fitMeshToPixels(this.mesh, this.width, this.height);
        this.updateMeshPosition();
        
        // Subtle outline for the hero
        if (highlightLayer) {
            try { highlightLayer.addMesh(this.mesh, new BABYLON.Color3(0.2, 0.6, 1)); } catch {}
        }
        
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

        // Tilt the ship based on motion (bank and a touch of pitch)
        const vx = this.x - this.prevX;
        const vy = this.y - this.prevY;
        if (this.mesh) {
            const targetBank = -vx * 0.03; // left/right
            const targetPitch = vy * 0.02; // up/down
            this.mesh.rotation.z = BABYLON.Scalar.Lerp(this.mesh.rotation.z || 0, targetBank, 0.2);
            this.mesh.rotation.x = BABYLON.Scalar.Lerp(this.mesh.rotation.x || 0, targetPitch, 0.2);
        }
        this.prevX = this.x;
        this.prevY = this.y;

        if (this.charge < MAX_CHARGE) this.charge = Math.min(MAX_CHARGE, this.charge + CHARGE_REFILL_PER_FRAME);
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
        if (this.charge >= MAX_CHARGE && this.energy < MAX_HEALTH && temporizes(10)) {
            this.energy++;
        }
        
        // Player engine flame
        if (temporizes(2)) {
            debrisEntities.push(new EngineFlame(this.x, this.y + this.height / 2 - 4));
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
        gameState.enemyPopulation--;
        audioSystem.playExplosionBig();
        gameState.deathSequenceFrames = DEATH_OVERLAY_DELAY_FRAMES;
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
        this.releaseDebris = 4;
        this.friendly = friendly;
        
        // Create mesh
        this.mesh = BABYLON.MeshBuilder.CreateSphere("missile", { diameter: 1 }, scene);
        const color = friendly ? new BABYLON.Color3(0, 0.6, 1) : new BABYLON.Color3(1, 0.2, 0);
        this.mesh.material = createMaterial(friendly ? "friendlyMissile" : "enemyMissile", color);
        this.mesh.renderingGroupId = 1;
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
        this.mesh.renderingGroupId = 1;
        fitMeshToPixels(this.mesh, this.width, this.height);
        registerGlowMesh(this.mesh);
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
        this.releaseDebris = 4;
        
        this.mesh = BABYLON.MeshBuilder.CreateBox("laser", { width: 1, height: 1, depth: 0.3 }, scene);
        this.mesh.material = createMaterial("laser", new BABYLON.Color3(0, 1, 1));
        this.mesh.renderingGroupId = 1;
        fitMeshToPixels(this.mesh, this.width, this.height);
        registerGlowMesh(this.mesh);
        this.updateMeshPosition();
    }

    update() {
        this.y -= 10;
        this.x = gameState.playerX;
        if (this.y < 40) this.destroy();
        this.updateMeshPosition();
    }
}

// Engine flame particle
class EngineFlame extends Entity {
    constructor(x, y) {
        super(x, y, 6, 6);
        this.life = 14;
        this.velX = (Math.random() - 0.5) * 2;
        this.velY = 2 + Math.random() * 1.5;
        this.mesh = BABYLON.MeshBuilder.CreateDisc("engineFlame", { radius: 0.5, tessellation: 16 }, scene);
        const mat = createMaterial("engineFlameMat", new BABYLON.Color3(1.0, 0.5, 0.1));
        this.mesh.material = mat;
        this.mesh.renderingGroupId = 1;
        this.mesh.billboardMode = BABYLON.AbstractMesh.BILLBOARDMODE_ALL;
        this.mesh.material.alpha = 0.8;
        fitMeshToPixels(this.mesh, this.width, this.height);
        registerGlowMesh(this.mesh);
        this.updateMeshPosition();
    }
    update() {
        this.x += this.velX;
        this.y += this.velY;
        if (this.mesh && this.mesh.material) {
            this.mesh.material.alpha *= 0.88;
        }
        if (--this.life <= 0) this.destroy();
        this.updateMeshPosition();
    }
}

// Enemy
class Enemy extends Entity {
    constructor() {
        super(random(SCREEN_WIDTH - 60) + 30, 30, 20, 20);
        this.energy = ENEMY_HEALTH;
        this.movement = random(8); // expanded patterns
        this.distance = random(50);
        this.shootTime = random(100) + 20;
        this.releaseDebris = 20;
        this.phase = Math.random() * Math.PI * 2;
        this.speed = 0.8 + Math.random() * 1.4;
        
        // Create enemy mesh
        this.mesh = buildBasicEnemyMesh();
        fitMeshToPixels(this.mesh, this.width, this.height);
        this.updateMeshPosition();
        
        gameState.enemyPopulation++;
    }

    update() {
        // Movement
        const oldX = this.x, oldY = this.y;
        switch (this.movement) {
            case 0: this.y += this.speed; break; // down
            case 1: this.y -= this.speed; break; // up
            case 2: this.x -= this.speed; break; // left
            case 3: this.x += this.speed; break; // right
            case 4: // sine horizontal drift
                this.y += 0.7 * this.speed;
                this.phase += 0.1;
                this.x += Math.sin(this.phase) * 1.5;
                break;
            case 5: // sine vertical drift
                this.x += 0.7 * this.speed;
                this.phase += 0.1;
                this.y += Math.sin(this.phase) * 1.5;
                break;
            case 6: // zigzag downward
                this.y += 1.2 * this.speed;
                this.phase += 0.25;
                this.x += Math.sin(this.phase) * 2.6;
                break;
            case 7: { // light homing/strafe
                const dx = gameState.playerX - this.x;
                const dy = gameState.playerY - this.y;
                const ang = Math.atan2(dy, dx);
                this.x += Math.cos(ang) * 0.6 * this.speed;
                this.y += Math.sin(ang) * 0.6 * this.speed;
                // strafe sideways
                this.x += Math.cos(ang + Math.PI / 2) * 0.8;
                break; }
        }
        
        if (this.distance >= 0) {
            this.distance--;
        } else {
            this.distance = random(50) + 20;
            this.movement = random(8);
            this.phase = 0;
            this.speed = 0.8 + Math.random() * 1.6;
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
        
        // Occasional engine trail for enemies
        if (temporizes(6)) debrisEntities.push(new EngineFlame(this.x, this.y + this.height / 2));
        
        // Tilt to direction of travel
        const vx = this.x - oldX;
        const vy = this.y - oldY;
        if (this.mesh) {
            this.mesh.rotation.z = BABYLON.Scalar.Lerp(this.mesh.rotation.z || 0, -vx * 0.04, 0.15);
            this.mesh.rotation.x = BABYLON.Scalar.Lerp(this.mesh.rotation.x || 0, vy * 0.03, 0.15);
        }
        
        this.updateMeshPosition();
    }

    onDestroy() {
        gameState.enemyPopulation--;
        gameState.score += POINTS_ENEMY;
        audioSystem.playExplosion();
    }
}

// Meteor
class Meteor extends Entity {
    constructor() {
        super(0, 0, 5, 5);
        this.energy = METEOR_HEALTH;
        this.releaseDebris = 5;
        
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
        
        this.mesh = buildMeteorMesh();
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
        audioSystem.playExplosion();
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
        this.releaseDebris = 5;
        
this.mesh = BABYLON.MeshBuilder.CreateSphere("guided", { diameter: 1 }, scene);
        this.mesh.material = createMaterial("guided", new BABYLON.Color3(1, 0, 1));
        this.mesh.renderingGroupId = 1;
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
        this.mesh.renderingGroupId = 1;
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

    onDestroy() {
        gameState.score += POINTS_CHUVA;
        audioSystem.playExplosionBig();
    }
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
        
        // Improved turret mesh
        this.mesh = buildTurretMesh();
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
        audioSystem.playExplosion();
    }
}

// Transport (spawns Metralha)
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
        if (temporizes(50)) {
            enemyEntities.push(new Metralha(this.x, this.y));
        }
        if (temporizes(10)) this.y++;
        if (++this.x > SCREEN_WIDTH) this.destroy();
        this.updateMeshPosition();
    }

    onDestroy() {
        audioSystem.playExplosionBig();
    }
}

// Encrenca (spawns Rain)
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
        if (temporizes(100)) {
            enemyEntities.push(new Rain(this.x, this.y));
        }
        if (temporizes(10)) this.y++;
        if (++this.x > SCREEN_WIDTH) this.destroy();
        this.updateMeshPosition();
    }

    onDestroy() {
        audioSystem.playExplosionBig();
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
        // Hit feedback
        if (audioSystem && audioSystem.initialized) audioSystem.playImpact();
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
    
    // Background scroll
    if (starfield) starfield.update();
    
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

    // Handle death sequence delay before showing game over
    if (gameState.deathSequenceFrames > 0) {
        gameState.deathSequenceFrames--;
        if (gameState.deathSequenceFrames === 0) {
            gameState.gameOver = true;
            document.getElementById('game-over').classList.add('visible');
        }
    }
    
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
    
    // Simple ambient setup
    const light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), scene);
    light.intensity = 0.6;

    // Environment for PBR metals
    ensureEnvironment();
    
    // Post FX: glow + bloom + FXAA + vignette
    try {
        glowLayer = new BABYLON.GlowLayer("glow", scene, { blurKernelSize: 48 });
        glowLayer.intensity = 0.25; // toned down overall
        // Only meshes we explicitly include will glow
        glowLayer.neutralColor = new BABYLON.Color3(0, 0, 0);
        highlightLayer = new BABYLON.HighlightLayer("hl", scene, { blurTextureSizeRatio: 0.5 });
        renderingPipeline = new BABYLON.DefaultRenderingPipeline("default", true, scene, [camera]);
        renderingPipeline.fxaaEnabled = true;
        renderingPipeline.bloomEnabled = true;
        renderingPipeline.bloomKernel = 48;
        renderingPipeline.bloomScale = 0.5;
        renderingPipeline.bloomThreshold = 0.8; // require brighter emissive to bloom
        renderingPipeline.bloomWeight = 0.22; // less bloom
        renderingPipeline.imageProcessingEnabled = true;
        renderingPipeline.imageProcessing.contrast = 1.08;
        renderingPipeline.imageProcessing.exposure = 1.05;
        renderingPipeline.imageProcessing.vignetteEnabled = true;
        renderingPipeline.imageProcessing.vignetteColor = new BABYLON.Color4(0, 0, 0, 1);
        renderingPipeline.imageProcessing.vignetteWeight = 0.9;
    } catch {}
    
    // Initialize pooled debris
    initDebrisPool();

    // Background starfield
    starfield = new Starfield(180);

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

    // Keep updating cursor while button is held (with pointer capture)
    canvas.addEventListener('pointermove', (e) => {
        updateCursor(e.clientX, e.clientY);
    }, { passive: true });

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

// Simple parallax starfield background (no textures)
class Starfield {
    constructor(count = 250) {
        this.stars = [];
        // Base star plane
        const base = BABYLON.MeshBuilder.CreatePlane("starBase", { size: 1 }, scene);
        base.isPickable = false;
        base.billboardMode = BABYLON.AbstractMesh.BILLBOARDMODE_ALL;
        base.renderingGroupId = 0; // background group
        const mat = new BABYLON.StandardMaterial("starMat", scene);
        mat.emissiveColor = new BABYLON.Color3(1, 1, 1);
        mat.disableLighting = true;
        base.material = mat;
        base.setEnabled(false);

        for (let i = 0; i < count; i++) {
            const inst = base.createInstance("starInst" + i);
            inst.setEnabled(true);
            inst.isPickable = false;
            inst.renderingGroupId = 0;
            inst.position.x = Math.random() * SCREEN_WIDTH - SCREEN_WIDTH / 2;
            inst.position.y = Math.random() * SCREEN_HEIGHT - SCREEN_HEIGHT / 2;
inst.scaling.x = inst.scaling.y = 0.2 + Math.random() * 0.6; // smaller stars
            // Slight color variation (blue/cool white)
            const c = (i % 6 === 0)
                ? new BABYLON.Color3(0.6, 0.7, 1)
                : new BABYLON.Color3(1, 1, 1);
            inst.material = mat.clone("starMatInst" + i);
            inst.material.emissiveColor = c;
            const speed = 0.15 + Math.random() * 0.35; // slower for depth
            this.stars.push({ mesh: inst, speed });
        }
    }

    update() {
        const bottom = -SCREEN_HEIGHT / 2;
        const top = SCREEN_HEIGHT / 2;
        for (const s of this.stars) {
            s.mesh.position.y -= s.speed;
            if (s.mesh.position.y < bottom) {
                s.mesh.position.y = top;
                s.mesh.position.x = Math.random() * SCREEN_WIDTH - SCREEN_WIDTH / 2;
            }
        }
    }
}
