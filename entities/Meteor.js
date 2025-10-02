class Meteor extends Entity {
    constructor() {
        super(0, 0, SizesConfig.meteor.width, SizesConfig.meteor.height);
        this.energy = METEOR_HEALTH; this.releaseDebris = 5;
        let angle; switch (random(4)) { case 0: this.x = 10; this.y = random(SCREEN_HEIGHT - 10); angle = random(90); if (angle > 45) angle += 269; break;
            case 1: this.x = SCREEN_WIDTH - 10; this.y = random(SCREEN_HEIGHT - 10); angle = between(135, 225); break;
            case 2: this.x = random(SCREEN_WIDTH - 10); this.y = 10; angle = between(45, 135); break;
            case 3: this.x = random(SCREEN_WIDTH - 10); this.y = SCREEN_HEIGHT - 10; angle = between(225, 315); break; }
        angle *= Math.PI / 180; this.dirX = Math.floor(200 * Math.cos(angle)); this.dirY = Math.floor(200 * Math.sin(angle)); this.incX = sign(this.dirX); this.incY = sign(this.dirY);
        this.dirX = Math.abs(this.dirX); this.dirY = Math.abs(this.dirY); this.restoX = 0; this.restoY = 0;
        this.mesh = buildMeteorMesh(); fitMeshToPixels(this.mesh, this.width, this.height); this.updateMeshPosition(); this.updateBodyFromEntity();
    }
    update() { this.restoX += this.dirX; this.restoY += this.dirY; while (this.restoX >= 100) { this.restoX -= 100; this.x += this.incX; } while (this.restoY >= 100) { this.restoY -= 100; this.y += this.incY; } if (this.isOffScreen()) this.destroy(); this.updateMeshPosition(); this.updateBodyFromEntity(); }
    onDestroy() { gameState.score += POINTS_METEOR; try { audioSystem.playExplosion(); } catch {} triggerShake(0.8, 6); }
}

window.Meteor = Meteor;