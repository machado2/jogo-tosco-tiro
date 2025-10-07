// Entity: Encrenca Ship (globals)

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
        if (temporizes(100)) enemyEntities.push(new Rain(this.x, this.y));
        if (temporizes(10)) this.y++;
        if (++this.x > SCREEN_WIDTH) this.destroy();
        this.updateMeshPosition();
    }
    onDestroy() { audioSystem.playExplosionBig(); }
}