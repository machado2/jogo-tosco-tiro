// Engine base entity abstraction with body property and simple movement/shoot helpers
// Depends on Babylon.js globals, visuals.js for fitMeshToPixels, and game.js for global arrays/state.

class Entity {
    constructor(x, y, width, height) {
        this.x = x; this.y = y; this.width = width; this.height = height;
        this.mesh = null; this.alive = true; this.energy = 1; this.releaseDebris = 0;
        this.prevX = x; this.prevY = y;
        // Body abstraction for collisions and movement
        this.body = { x: x, y: y, width: width, height: height };
    }

    // Body helpers keep entity and body in sync
    updateBodyFromEntity() { this.body.x = this.x; this.body.y = this.y; this.body.width = this.width; this.body.height = this.height; }
    updateEntityFromBody() { this.x = this.body.x; this.y = this.body.y; this.width = this.body.width; this.height = this.body.height; }

    // Simple movements (top-down: forward = up, backward = down)
    moveForward(distance = 1) { this.y -= distance; this.updateBodyFromEntity(); this.updateMeshPosition(); }
    moveBackward(distance = 1) { this.y += distance; this.updateBodyFromEntity(); this.updateMeshPosition(); }

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
        this.updateBodyFromEntity();
    }

    takeDamage(damage) {
        this.energy -= damage;
        if (this.energy < 1) { this.onDestroy(); this.destroy(); return true; }
        else { if (this.mesh) flashMesh(this.mesh); }
        return false;
    }

    onDestroy() {}

    destroy() {
        this.alive = false;
        if (this.releaseDebris && !this.isOffScreen()) {
            const available = Math.max(0, MAX_DEBRIS_TOTAL - totalDebrisCount);
            const toEmit = Math.min(this.releaseDebris, MAX_DEBRIS_PER_EVENT, available);
            for (let i = 0; i < toEmit; i++) { debrisEntities.push(new Debris(this.x, this.y)); totalDebrisCount++; }
        }
        if (this.mesh) { try {
            if (this.mesh.getChildren && !(this.mesh instanceof BABYLON.AbstractMesh)) {
                this.mesh.getChildren().forEach(ch => { try { ch.dispose(); } catch {} });
            }
            this.mesh.dispose();
        } catch {} this.mesh = null; }
    }

    update() {}

    updateMeshPosition() {
        // Delegate to visuals helper to keep entities focused on gameplay
        if (typeof updateEntityMeshPosition === 'function') {
            updateEntityMeshPosition(this);
        } else {
            // Fallback to original positioning in case helper is unavailable
            if (this.mesh) {
                this.mesh.position.x = this.x - SCREEN_WIDTH / 2;
                this.mesh.position.y = -(this.y - SCREEN_HEIGHT / 2);
            }
            this.updateBodyFromEntity();
        }
    }

    // Simplified shot creation
    shoot(type = 'missile', options = {}) {
        const { velX = 0, velY = -10, friendly = true, level = 0 } = options;
        let shot = null;
        if (type === 'laser') {
            shot = (typeof createLaser === 'function') ? createLaser() : new Laser();
            friendlyEntities.push(shot);
        } else if (type === 'nuclear') {
            const x = this.x, y = this.y - 5;
            shot = (typeof createNuclear === 'function') ? createNuclear(x, y, velX, velY, level) : new Nuclear(x, y, velX, velY, level);
            friendlyEntities.push(shot);
        } else {
            const x = this.x, y = this.y - 5;
            shot = (typeof createMissile === 'function') ? createMissile(x, y, velX, velY, friendly) : new Missile(x, y, velX, velY, friendly);
            (friendly ? friendlyEntities : enemyEntities).push(shot);
        }
        return shot;
    }
}

window.Entity = Entity; // expose globally