// Visuals Common: materiais e utilitários compartilhados (globals)

// Cache de materiais
let materials = {};

function createMaterial(name, color) {
  if (materials[name]) return materials[name];
  const mat = new BABYLON.StandardMaterial(name, scene);
  mat.diffuseColor = color; mat.emissiveColor = color.scale(0.9); mat.specularColor = new BABYLON.Color3(0, 0, 0);
  mat.disableLighting = true; // vibe arcade 2D
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