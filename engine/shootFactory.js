// Simplified shot factory helpers (optional usage)

function createMissile(x, y, velX, velY, friendly = true) {
    return new Missile(x, y, velX, velY, friendly);
}

function createLaser() {
    return new Laser();
}

function createNuclear(x, y, velX, velY, level = 0) {
    return new Nuclear(x, y, velX, velY, level);
}

window.createMissile = createMissile;
window.createLaser = createLaser;
window.createNuclear = createNuclear;