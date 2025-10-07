// Mesh: Player Ship (globals)

function buildPlayerShipMesh() {
  ensureEnvironment();
  const bodyColor = new BABYLON.Color3(0.15, 0.8, 0.95);
  const panelTex = createPanelTexture("playerPanelTex", bodyColor);
  const hullMat = createPBRMetalMaterial("playerHull", bodyColor, panelTex, 0.06);

  const profile = [
    new BABYLON.Vector3(0.0, 1.4, 0),
    new BABYLON.Vector3(0.40, 1.1, 0),
    new BABYLON.Vector3(0.55, 0.5, 0),
    new BABYLON.Vector3(0.45, -0.1, 0),
    new BABYLON.Vector3(0.30, -0.9, 0),
    new BABYLON.Vector3(0.00, -1.5, 0),
  ];
  const fuselage = BABYLON.MeshBuilder.CreateLathe(
    "playerFuselage",
    { shape: profile, sideOrientation: BABYLON.Mesh.DOUBLESIDE, tessellation: 48 },
    scene
  );
  fuselage.material = hullMat;

  const wingRoot = BABYLON.MeshBuilder.CreateBox("wingRoot", { width: 0.5, height: 0.12, depth: 0.9 }, scene);
  wingRoot.material = hullMat;
  wingRoot.position.y = 0.0;
  wingRoot.position.z = 0.1;

  const wingL = BABYLON.MeshBuilder.CreateBox("wingL", { width: 2.8, height: 0.08, depth: 0.6 }, scene);
  wingL.material = hullMat;
  wingL.position.x = -1.3;
  wingL.position.y = 0.05;
  wingL.position.z = 0.15;
  wingL.rotation.z = 0.18;
  wingL.rotation.y = 0.05;

  const wingR = wingL.clone("wingR");
  wingR.position.x = 1.3;
  wingR.rotation.z = -0.18;
  wingR.rotation.y = -0.05;

  const tipL = BABYLON.MeshBuilder.CreateCylinder("wingTipL", { height: 0.8, diameter: 0.18 }, scene);
  tipL.rotation.x = Math.PI / 2;
  tipL.position.x = -2.6;
  tipL.position.y = 0.05;
  tipL.position.z = 0.4;
  tipL.material = hullMat;

  const tipR = tipL.clone("wingTipR");
  tipR.position.x = 2.6;

  const nacelleL = BABYLON.MeshBuilder.CreateCylinder("nacelleL", { height: 1.6, diameter: 0.4, tessellation: 32 }, scene);
  nacelleL.rotation.x = Math.PI / 2;
  nacelleL.position.x = -0.95;
  nacelleL.position.y = -0.65;
  nacelleL.position.z = -0.20;
  nacelleL.material = hullMat;

  const nacelleR = nacelleL.clone("nacelleR");
  nacelleR.position.x = 0.95;

  const tail = BABYLON.MeshBuilder.CreateBox("tail", { width: 0.28, height: 1.2, depth: 0.4 }, scene);
  tail.position.y = -0.4;
  tail.position.z = -0.1;
  tail.material = hullMat;

  const glass = new BABYLON.PBRMaterial("cockpitGlass", scene);
  glass.metallic = 0.0;
  glass.roughness = 0.05;
  glass.alpha = 0.85;
  glass.albedoColor = new BABYLON.Color3(0.6, 0.85, 1.0);

  const canopy = BABYLON.MeshBuilder.CreateSphere("canopy", { diameter: 0.75 }, scene);
  canopy.position.y = 0.32;
  canopy.position.z = 0.28;
  canopy.material = glass;

  const intake = BABYLON.MeshBuilder.CreateTorus("intake", { diameter: 0.6, thickness: 0.08 }, scene);
  intake.position.y = 0.5;
  intake.position.z = -0.15;
  intake.material = hullMat;

  const nozzle = BABYLON.MeshBuilder.CreateCylinder("engineNozzle", { height: 0.4, diameterTop: 0.22, diameterBottom: 0.5, tessellation: 32 }, scene);
  nozzle.rotation.x = Math.PI / 2;
  nozzle.position.y = -1.45;
  nozzle.position.z = -0.25;
  nozzle.material = hullMat;

  const engineGlowMat = new BABYLON.PBRMaterial("engineGlow", scene);
  engineGlowMat.metallic = 0.0; engineGlowMat.roughness = 0.2; engineGlowMat.environmentIntensity = 0.0;
  engineGlowMat.albedoColor = new BABYLON.Color3(0.0, 0.0, 0.0);
  engineGlowMat.emissiveColor = new BABYLON.Color3(0.25, 0.7, 1.0);
  engineGlowMat.alpha = 0.65;
  const glowDisc = BABYLON.MeshBuilder.CreateDisc("engineGlowDisc", { radius: 0.34, tessellation: 48 }, scene);
  glowDisc.rotation.x = Math.PI / 2;
  glowDisc.position.y = -1.62;
  glowDisc.position.z = -0.25;
  glowDisc.material = engineGlowMat;
  registerGlowMesh(glowDisc);

  const merged = BABYLON.Mesh.MergeMeshes([
    fuselage,
    wingRoot,
    wingL,
    wingR,
    tipL,
    tipR,
    nacelleL,
    nacelleR,
    tail,
    canopy,
    intake,
    nozzle,
  ], true, true, undefined, false, true);

  merged.renderingGroupId = 1;
  try { glowDisc.parent = merged; } catch {}
  return merged;
}