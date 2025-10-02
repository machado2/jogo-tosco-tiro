// Simplified shot factory helpers (optional usage)

function createMissile(x, y, velX, velY, friendly = true) {
    const m = new Missile(x, y, velX, velY, friendly);
    if (friendly && typeof playGameSound === 'function') playGameSound('shoot');
    return m;
}

function createLaser() {
    if (typeof playGameSound === 'function') playGameSound('laser');
    return new Laser();
}

function createNuclear(x, y, velX, velY, level = 0) {
    const n = new Nuclear(x, y, velX, velY, level);
    if (typeof playGameSound === 'function') playGameSound('special');
    return n;
}

window.createMissile = createMissile;
window.createLaser = createLaser;
window.createNuclear = createNuclear;