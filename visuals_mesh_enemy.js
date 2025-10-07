// Mesh: Basic Enemy (globals)

function buildBasicEnemyMesh() {
  const bodyColor = new BABYLON.Color3(0.6, 0.6, 0.65);
  const tex = createPanelTexture("enemyPanelTex", bodyColor);
  const mat = createPBRMetalMaterial("enemyHull", bodyColor, tex, 0.03);
  const body = BABYLON.MeshBuilder.CreatePolyhedron("enemyBody", { type: 2, size: 1.0 }, scene);
  body.material = mat;
  const armL = BABYLON.MeshBuilder.CreateBox("armL", { width: 1.6, height: 0.12, depth: 0.4 }, scene);
  armL.position.x = -1.1; armL.material = mat; const armR = armL.clone("armR"); armR.position.x = 1.1;
  const spike = BABYLON.MeshBuilder.CreateCylinder("spike", { height: 0.8, diameterTop: 0.0, diameterBottom: 0.35 }, scene);
  spike.position.y = -0.9; spike.material = mat;
  const merged = BABYLON.Mesh.MergeMeshes([body, armL, armR, spike], true, true, undefined, false, true);
  merged.renderingGroupId = 1; return merged;
}