// Visuals: materials, textures, PBR, procedural mesh builders (globals, no modules)

// Material cache
let materials = {};

function createMaterial(name, color) {
  if (materials[name]) return materials[name];
  const mat = new BABYLON.StandardMaterial(name, scene);
  mat.diffuseColor = color; mat.emissiveColor = color.scale(0.9); mat.specularColor = new BABYLON.Color3(0, 0, 0);
  mat.disableLighting = true; // 2D arcade vibe
  materials[name] = mat;
  return mat;
}

function ensureEnvironment() {
  if (!scene.environmentTexture) {
    try {
      scene.environmentTexture = BABYLON.CubeTexture.CreateFromPrefilteredData(
        "https://assets.babylonjs.com/environments/environmentSpecular.env", scene);
    } catch {}
  }
}

function registerGlowMesh(mesh) {
  if (glowLayer && glowLayer.addIncludedOnlyMesh) {
    try { glowLayer.addIncludedOnlyMesh(mesh); } catch {}
  }
}

function colorToCSS(c) { return `rgb(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)})`; }
function scaleColor(c, s) { return new BABYLON.Color3(Math.min(1, c.r * s), Math.min(1, c.g * s), Math.min(1, c.b * s)); }

function createPanelTexture(name, baseColor) {
  const size = 256; const dt = new BABYLON.DynamicTexture(name, { width: size, height: size }, scene, false);
  const ctx = dt.getContext(); const cTop = colorToCSS(scaleColor(baseColor, 1.05)); const cBot = colorToCSS(scaleColor(baseColor, 0.85));
  const grad = ctx.createLinearGradient(0, 0, 0, size); grad.addColorStop(0, cTop); grad.addColorStop(1, cBot);
  ctx.fillStyle = grad; ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = "rgba(255,255,255,0.06)"; ctx.lineWidth = 1;
  for (let i = 32; i < size; i += 32) { ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(size, i); ctx.stroke(); ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, size); ctx.stroke(); }
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  for (let i = -size; i < size; i += 64) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + size, size); ctx.stroke(); }
  dt.update(false); return dt;
}

function createPBRMetalMaterial(name, baseColor, panelTexture = null, emissiveFactor = 0.08) {
  ensureEnvironment(); const mat = new BABYLON.PBRMaterial(name, scene);
  mat.metallic = 1.0; mat.roughness = 0.35; mat.environmentIntensity = 0.8; mat.albedoColor = baseColor;
  if (panelTexture) mat.albedoTexture = panelTexture;
  mat.emissiveColor = baseColor.scale(emissiveFactor); return mat;
}

function fitMeshToPixels(mesh, targetWidth, targetHeight) {
  mesh.scaling = new BABYLON.Vector3(1, 1, 1); mesh.refreshBoundingInfo(true);
  const bb = mesh.getBoundingInfo().boundingBox;
  const currentWidth = (bb.maximumWorld.x - bb.minimumWorld.x) || 1;
  const currentHeight = (bb.maximumWorld.y - bb.minimumWorld.y) || 1;
  const sx = targetWidth / currentWidth; const sy = targetHeight / currentHeight;
  mesh.scaling = new BABYLON.Vector3(sx, sy, 1); mesh.refreshBoundingInfo(true);
}

function buildPlayerShipMesh() {
  const bodyColor = new BABYLON.Color3(0.18, 0.55, 1);
  const panelTex = createPanelTexture("playerPanelTex", bodyColor);
  const hullMat = createPBRMetalMaterial("playerHull", bodyColor, panelTex, 0.05);
  const profile = [new BABYLON.Vector3(0.00, 1.20, 0), new BABYLON.Vector3(0.45, 0.90, 0), new BABYLON.Vector3(0.60, 0.30, 0),
                   new BABYLON.Vector3(0.38, -0.40, 0), new BABYLON.Vector3(0.20, -0.95, 0), new BABYLON.Vector3(0.00, -1.30, 0)];
  const fuselage = BABYLON.MeshBuilder.CreateLathe("playerFuselage", { shape: profile, sideOrientation: BABYLON.Mesh.DOUBLESIDE, tessellation: 24 }, scene);
  fuselage.material = hullMat;
  const wingL = BABYLON.MeshBuilder.CreateBox("wingL", { width: 2.4, height: 0.12, depth: 0.7 }, scene);
  wingL.position.x = -1.0; wingL.position.y = 0.1; wingL.rotation.z = 0.12; wingL.material = hullMat;
  const wingR = wingL.clone("wingR"); wingR.position.x = 1.0; wingR.rotation.z = -0.12;
  const fin = BABYLON.MeshBuilder.CreateBox("fin", { width: 0.25, height: 0.9, depth: 0.4 }, scene);
  fin.position.y = -0.5; fin.material = hullMat;
  const glass = new BABYLON.PBRMaterial("cockpitGlass", scene); ensureEnvironment();
  glass.metallic = 0.0; glass.roughness = 0.05; glass.alpha = 0.8; glass.albedoColor = new BABYLON.Color3(0.5, 0.8, 1);
  const canopy = BABYLON.MeshBuilder.CreateSphere("canopy", { diameter: 0.7 }, scene);
  canopy.position.y = 0.25; canopy.position.z = 0.25; canopy.material = glass;
  const engine = BABYLON.MeshBuilder.CreatePlane("engineGlow", { size: 0.7 }, scene);
  engine.billboardMode = BABYLON.AbstractMesh.BILLBOARDMODE_ALL; engine.position.y = -1.25; engine.position.z = -0.1;
  const engineMat = createMaterial("engineGlowMat", new BABYLON.Color3(1.0, 0.5, 0.1)); engine.material = engineMat;
  const merged = BABYLON.Mesh.MergeMeshes([fuselage, wingL, wingR, fin, canopy], true, true, undefined, false, true);
  merged.renderingGroupId = 1; engine.parent = merged; engine.renderingGroupId = 1; registerGlowMesh(engine);
  return merged;
}

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

function buildTurretMesh() {
  const baseColor = new BABYLON.Color3(0.0, 0.8, 0.4);
  const tex = createPanelTexture("turretPanelTex", baseColor);
  const mat = createPBRMetalMaterial("turretHull", baseColor, tex, 0.04);
  const base = BABYLON.MeshBuilder.CreateCylinder("turBase", { height: 0.6, diameter: 1.4, tessellation: 24 }, scene);
  base.material = mat;
  const ring = BABYLON.MeshBuilder.CreateTorus("turRing", { diameter: 1.6, thickness: 0.12 }, scene);
  ring.rotation.x = Math.PI / 2; ring.material = mat;
  const barrel = BABYLON.MeshBuilder.CreateCylinder("turBarrel", { height: 1.8, diameter: 0.25 }, scene);
  barrel.rotation.x = Math.PI / 2; barrel.position.y = 0.5; barrel.position.z = 0.8; barrel.material = mat;
  const merged = BABYLON.Mesh.MergeMeshes([base, ring, barrel], true, true, undefined, false, true);
  merged.renderingGroupId = 1; return merged;
}

function buildTransportMesh(color = new BABYLON.Color3(0.4, 0.3, 0.3)) {
  const tex = createPanelTexture("transportPanelTex", color);
  const mat = createPBRMetalMaterial("transportHull", color, tex, 0.02);
  const hull = BABYLON.MeshBuilder.CreateBox("transHull", { width: 5, height: 1.2, depth: 1.2 }, scene);
  hull.material = mat; const ribs = [];
  for (let i = -2; i <= 2; i++) {
    const rib = BABYLON.MeshBuilder.CreateBox("rib" + i, { width: 0.2, height: 1.3, depth: 1.25 }, scene);
    rib.position.x = i * 0.9; rib.material = mat; ribs.push(rib);
  }
  const merged = BABYLON.Mesh.MergeMeshes([hull, ...ribs], true, true, undefined, false, true);
  merged.renderingGroupId = 1; return merged;
}

function buildMeteorMesh() {
  const rock = BABYLON.MeshBuilder.CreateIcoSphere("meteor", { radius: 1, subdivisions: 2 }, scene);
  const positions = rock.getVerticesData(BABYLON.VertexBuffer.PositionKind);
  for (let i = 0; i < positions.length; i += 3) {
    const nx = (Math.random() - 0.5) * 0.25; const ny = (Math.random() - 0.5) * 0.25; const nz = (Math.random() - 0.5) * 0.25;
    positions[i] += nx; positions[i + 1] += ny; positions[i + 2] += nz;
  }
  rock.updateVerticesData(BABYLON.VertexBuffer.PositionKind, positions);
  const mat = new BABYLON.StandardMaterial("meteorMat", scene);
  mat.diffuseColor = new BABYLON.Color3(0.45, 0.35, 0.25); mat.emissiveColor = new BABYLON.Color3(0.1, 0.08, 0.06);
  mat.specularColor = new BABYLON.Color3(0.05, 0.05, 0.05); rock.material = mat; rock.renderingGroupId = 1;
  return rock;
}