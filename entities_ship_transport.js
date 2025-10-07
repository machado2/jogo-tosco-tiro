// Entity: Transport Ship (globals)

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
        if (temporizes(50)) enemyEntities.push(new Metralha(this.x, this.y));
        if (temporizes(10)) this.y++;
        if (++this.x > SCREEN_WIDTH) this.destroy();
        this.updateMeshPosition();
    }
    onDestroy() { audioSystem.playExplosionBig(); triggerShake(3.0, 20); }
}