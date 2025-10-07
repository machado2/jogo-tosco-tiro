// Entity: Enemy Ship (globals)

class Enemy extends Entity {
    constructor() {
        super(random(SCREEN_WIDTH - 60) + 30, 30, 20, 20);
        this.energy = ENEMY_HEALTH;
        this.movement = random(8);
        this.distance = random(50);
        this.shootTime = random(100) + 20;
        this.releaseDebris = 20;
        this.phase = Math.random() * Math.PI * 2;
        this.speed = 0.8 + Math.random() * 1.4;
        this.mesh = buildBasicEnemyMesh();
        fitMeshToPixels(this.mesh, this.width, this.height);
        this.updateMeshPosition();
        gameState.enemyPopulation++;
    }
    update() {
        const oldX = this.x, oldY = this.y;
        switch (this.movement) {
            case 0: this.y += this.speed; break;
            case 1: this.y -= this.speed; break;
            case 2: this.x -= this.speed; break;
            case 3: this.x += this.speed; break;
            case 4: this.y += 0.7 * this.speed; this.phase += 0.1; this.x += Math.sin(this.phase) * 1.5; break;
            case 5: this.x += 0.7 * this.speed; this.phase += 0.1; this.y += Math.sin(this.phase) * 1.5; break;
            case 6: this.y += 1.2 * this.speed; this.phase += 0.25; this.x += Math.sin(this.phase) * 2.6; break;
            case 7: {
                const dx = gameState.playerX - this.x;
                const dy = gameState.playerY - this.y;
                const ang = Math.atan2(dy, dx);
                this.x += Math.cos(ang) * 0.6 * this.speed;
                this.y += Math.sin(ang) * 0.6 * this.speed;
                this.x += Math.cos(ang + Math.PI / 2) * 0.8;
                break;
            }
        }
        if (this.distance >= 0) { this.distance--; }
        else { this.distance = random(50) + 20; this.movement = random(8); this.phase = 0; this.speed = 0.8 + Math.random() * 1.6; }
        if (this.y - 20 < 20) { this.movement = 0; this.distance = 10; }
        if (this.y > SCREEN_HEIGHT / 2) { this.movement = 1; this.distance = 10; }
        if (this.x + 20 > SCREEN_WIDTH) { this.movement = 2; this.distance = 10; }
        if (this.x - 20 < 0) { this.movement = 3; this.distance = 10; }
        if (!this.shootTime) {
            this.shootTime = random(180) + 20;
            enemyEntities.push(new Missile(this.x - 9, this.y + 20, 0, 3, false));
            enemyEntities.push(new Missile(this.x + 9, this.y + 20, 0, 3, false));
        } else { this.shootTime--; }
        const vx = this.x - oldX; const vy = this.y - oldY;
        if (this.mesh) {
            this.mesh.rotation.z = BABYLON.Scalar.Lerp(this.mesh.rotation.z || 0, -vx * 0.04, 0.15);
            this.mesh.rotation.x = BABYLON.Scalar.Lerp(this.mesh.rotation.x || 0, vy * 0.03, 0.15);
        }
        this.updateMeshPosition();
    }
    onDestroy() { gameState.enemyPopulation--; gameState.score += POINTS_ENEMY; audioSystem.playExplosion(); triggerShake(1.2, 8); }
}