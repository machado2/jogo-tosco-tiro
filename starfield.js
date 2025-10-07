// Parallax starfield background using base meshes to avoid per-instance material assignment
class Starfield {
  constructor(count = 250) {
    this.stars = [];
    // Two base star planes to allow color variation without per-instance material set
    const baseWhite = BABYLON.MeshBuilder.CreatePlane("starBaseWhite", { size: 1 }, scene);
    baseWhite.isPickable = false;
    baseWhite.billboardMode = BABYLON.AbstractMesh.BILLBOARDMODE_ALL;
    baseWhite.renderingGroupId = 0; // background group
    const matWhite = new BABYLON.StandardMaterial("starMatWhite", scene);
    matWhite.emissiveColor = new BABYLON.Color3(1, 1, 1);
    matWhite.disableLighting = true;
    baseWhite.material = matWhite;
    baseWhite.isVisible = false;

    const baseBlue = baseWhite.clone("starBaseBlue");
    baseBlue.material = matWhite.clone("starMatBlue");
    baseBlue.material.emissiveColor = new BABYLON.Color3(0.6, 0.7, 1);
    baseBlue.isVisible = false;

    for (let i = 0; i < count; i++) {
      const useBlue = (i % 6 === 0);
      const base = useBlue ? baseBlue : baseWhite;
      const inst = base.createInstance("starInst" + i);
      inst.setEnabled(true);
      inst.isPickable = false;
      inst.renderingGroupId = 0;
      inst.position.x = Math.random() * SCREEN_WIDTH - SCREEN_WIDTH / 2;
      inst.position.y = Math.random() * SCREEN_HEIGHT - SCREEN_HEIGHT / 2;
      inst.scaling.x = inst.scaling.y = 2.0 + Math.random() * 2.0; // 2–4 px stars for visibility
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
