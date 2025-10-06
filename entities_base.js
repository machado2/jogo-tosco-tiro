// Entities Base (globals)

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