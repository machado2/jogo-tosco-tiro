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
    paused: false,
    muted: false,
    playerX: SCREEN_WIDTH / 2,
    playerY: SCREEN_HEIGHT - 80,
    cursorX: SCREEN_WIDTH / 2,
    cursorY: SCREEN_HEIGHT / 2,
    leftButton: false,
    rightButton: false,
    enemyPopulation: 0,
    playerAlive: true,
    deathSequenceFrames: 0,
    shakeFrames: 0,
    shakeIntensity: 0
};

// Entity lists
let friendlyEntities = [];
let enemyEntities = [];
let debrisEntities = [];

// Debris pool
let debrisBaseMesh = null;
let debrisMaterial = null;
let totalDebrisCount = 0;

// Post FX and background
let glowLayer = null;
let renderingPipeline = null;
let highlightLayer = null;
let starfield = null;
let engineFlamesEnabled = true;

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

function triggerShake(intensity = 2, frames = 10) {
    gameState.shakeIntensity = intensity;
    gameState.shakeFrames = frames;
}

function flashMesh(mesh, color = new BABYLON.Color3(1, 1, 1), durationMs = 80) {
    if (!highlightLayer || !mesh) return;
    try {
        highlightLayer.addMesh(mesh, color);
        setTimeout(() => { try { highlightLayer.removeMesh(mesh); } catch { } }, durationMs);
    } catch { }
}

// Material helpers moved to visuals.js

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

// fitMeshToPixels moved to visuals.js

// Visual helpers and mesh builders moved to visuals.js

// Entities are defined in entities.js

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

// Update HUD handled in hud.js

// Clean up dead entities
function cleanupEntities() {
    friendlyEntities = friendlyEntities.filter(e => e.alive);
    enemyEntities = enemyEntities.filter(e => e.alive);
    debrisEntities = debrisEntities.filter(e => e.alive);
}

// Main game loop
function gameLoop() {
    if (gameState.gameOver || gameState.paused) return;

    // Background scroll
    if (starfield) starfield.update();

    // Camera shake
    if (gameState.shakeFrames > 0) {
        camera.position.x = (Math.random() - 0.5) * gameState.shakeIntensity;
        camera.position.y = (Math.random() - 0.5) * gameState.shakeIntensity;
        gameState.shakeFrames--;
    } else {
        camera.position.x = 0; camera.position.y = 0;
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
    const damageOverlayEl = document.getElementById('damage-overlay');
    const pausedOverlayEl = document.getElementById('paused');

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
    } catch { }

    // Initialize pooled debris
    initDebrisPool();

    // Background starfield
    starfield = new Starfield(180);

    // Initialize HUD helpers
    if (typeof initHUD === 'function') initHUD();

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
        try { canvas.setPointerCapture(e.pointerId); } catch { }
        e.preventDefault();
    }, { passive: false });

    // Keep updating cursor while button is held (with pointer capture)
    canvas.addEventListener('pointermove', (e) => {
        updateCursor(e.clientX, e.clientY);
    }, { passive: true });

    canvas.addEventListener('pointerup', (e) => {
        if (e.button === 0) gameState.leftButton = false;
        if (e.button === 2) gameState.rightButton = false;
        try { canvas.releasePointerCapture(e.pointerId); } catch { }
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

    // Visual effect toggles only (P/M handled in hud.js)
    document.addEventListener('keydown', (e) => {
        if (e.code === 'KeyG' && glowLayer) glowLayer.isEnabled = !glowLayer.isEnabled;
        if (e.code === 'KeyB' && renderingPipeline) renderingPipeline.bloomEnabled = !renderingPipeline.bloomEnabled;
        if (e.code === 'KeyF') engineFlamesEnabled = !engineFlamesEnabled;
    });

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

// Starfield moved to starfield.js
