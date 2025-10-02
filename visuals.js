// Visuals: materials, textures, PBR, procedural mesh builders (globals, no modules)

// Material cache
let materials = {};

// Configuração de naves (você pode alterar tamanhos, caminhos e texturas)
const ShipConfig = {
  player: {
    rootUrl: "assets/ultimate_spaceships/Striker/OBJ/",
    fileName: "Striker.obj",
    textureUrl: "assets/ultimate_spaceships/Striker/Textures/Striker_Blue.png",
    width: 16,
    height: 16,
    rotationX: Math.PI / 2,
    rotationZ: 0
  },
  enemy: {
    rootUrl: "assets/ultimate_spaceships/Insurgent/OBJ/",
    fileName: "Insurgent.obj",
    textureUrl: "assets/ultimate_spaceships/Insurgent/Textures/Insurgent_Red.png",
    width: 16,
    height: 16,
    rotationX: Math.PI / 2,
    rotationZ: Math.PI
  },
  // Variantes de inimigos disponíveis (usar OBJ locais)
  enemyVariants: [
    { name: "Bob", rootUrl: "assets/ultimate_spaceships/Bob/OBJ/", fileName: "Bob.obj", rotationX: Math.PI / 2, rotationZ: Math.PI, textureUrl: "assets/ultimate_spaceships/Bob/Textures/Bob_Orange.png" },
    { name: "Challenger", rootUrl: "assets/ultimate_spaceships/Challenger/OBJ/", fileName: "Challenger.obj", rotationX: Math.PI / 2, rotationZ: Math.PI, textureUrl: "assets/ultimate_spaceships/Challenger/Textures/Challenger_Green.png" },
    { name: "Dispatcher", rootUrl: "assets/ultimate_spaceships/Dispatcher/OBJ/", fileName: "Dispatcher.obj", rotationX: Math.PI / 2, rotationZ: Math.PI, textureUrl: "assets/ultimate_spaceships/Dispatcher/Textures/Dispatcher_Purple.png" },
    { name: "Executioner", rootUrl: "assets/ultimate_spaceships/Executioner/OBJ/", fileName: "Executioner.obj", rotationX: Math.PI / 2, rotationZ: Math.PI, textureUrl: "assets/ultimate_spaceships/Executioner/Textures/Executioner_Blue.png" },
    { name: "Imperial", rootUrl: "assets/ultimate_spaceships/Imperial/OBJ/", fileName: "Imperial.obj", rotationX: Math.PI / 2, rotationZ: Math.PI, textureUrl: "assets/ultimate_spaceships/Imperial/Textures/Imperial_Red.png" },
    { name: "Insurgent", rootUrl: "assets/ultimate_spaceships/Insurgent/OBJ/", fileName: "Insurgent.obj", rotationX: Math.PI / 2, rotationZ: Math.PI, textureUrl: "assets/ultimate_spaceships/Insurgent/Textures/Insurgent_Purple.png" },
    { name: "Omen", rootUrl: "assets/ultimate_spaceships/Omen/OBJ/", fileName: "Omen.obj", rotationX: Math.PI / 2, rotationZ: Math.PI, textureUrl: "assets/ultimate_spaceships/Omen/Textures/Omen_Orange.png" },
    { name: "Pancake", rootUrl: "assets/ultimate_spaceships/Pancake/OBJ/", fileName: "Pancake.obj", rotationX: Math.PI / 2, rotationZ: Math.PI, textureUrl: "assets/ultimate_spaceships/Pancake/Textures/Pancake_Orange.png" },
    { name: "Spitfire", rootUrl: "assets/ultimate_spaceships/Spitfire/OBJ/", fileName: "Spitfire.obj", rotationX: Math.PI / 2, rotationZ: Math.PI, textureUrl: "assets/ultimate_spaceships/Spitfire/Textures/Spitfire_Red.png" },
    { name: "Striker", rootUrl: "assets/ultimate_spaceships/Striker/OBJ/", fileName: "Striker.obj", rotationX: Math.PI / 2, rotationZ: Math.PI, textureUrl: "assets/ultimate_spaceships/Striker/Textures/Striker_Blue.png" },
    { name: "Zenith", rootUrl: "assets/ultimate_spaceships/Zenith/OBJ/", fileName: "Zenith.obj", rotationX: Math.PI / 2, rotationZ: Math.PI, textureUrl: "assets/ultimate_spaceships/Zenith/Textures/Zenith_Red.png" }
  ]
};

function createMaterial(name, color) {
  if (materials[name]) return materials[name];
  const mat = new BABYLON.StandardMaterial(name, scene);
  mat.diffuseColor = color; mat.emissiveColor = color.scale(0.9); mat.specularColor = new BABYLON.Color3(0, 0, 0);
  mat.disableLighting = true; // 2D arcade vibe
  materials[name] = mat;
  return mat;
}

// Lit PBR material so dynamic lights can affect it
function createLitMaterial(name, color, emissiveFactor = 0.2) {
  if (materials[name]) return materials[name];
  ensureEnvironment();
  const mat = new BABYLON.PBRMaterial(name, scene);
  mat.metallic = 0.0;
  mat.roughness = 0.6;
  mat.albedoColor = color;
  mat.emissiveColor = color.scale(emissiveFactor);
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

// Tenta aplicar uma textura única a todos os meshes de um grupo
function applyShipTextureToGroup(groupNode, textureUrl) {
  if (!groupNode || !textureUrl) return;
  try {
    ensureEnvironment();
    const tex = new BABYLON.Texture(textureUrl, scene, true, false, BABYLON.Texture.TRILINEAR_SAMPLINGMODE);
    const mat = new BABYLON.PBRMaterial("shipTexMat_" + (groupNode.name || "root"), scene);
    mat.albedoTexture = tex;
    mat.metallic = 0.0;
    mat.roughness = 0.6;
    mat.environmentIntensity = 1.3;
    mat.emissiveColor = new BABYLON.Color3(0.12, 0.12, 0.12);
    const parts = groupNode.getChildren ? groupNode.getChildren().filter(c => c instanceof BABYLON.Mesh) : [];
    parts.forEach(p => { try { p.material = mat; } catch {} });
  } catch (e) {
    console.error("Falha ao aplicar textura na nave:", e);
  }
}

// Try load texture from multiple URLs, returning the first that succeeds (Babylon handles async)
function maybeTexture(url) {
  try {
    return new BABYLON.Texture(url, scene, true, false, BABYLON.Texture.TRILINEAR_SAMPLINGMODE);
  } catch { return null; }
}

// Helper: Attempt Poly Haven CDN URLs, fall back gracefully
function phTexture(slug, suffix, size = "1k") {
  const urls = [
    `https://dl.polyhaven.com/file/ph-textures/${size}/${slug}_${suffix}.png`,
    `https://dl.polyhaven.org/file/ph-textures/${size}/${slug}_${suffix}.png`
  ];
  for (const u of urls) {
    const t = maybeTexture(u);
    if (t) return t;
  }
  return null;
}

function createPBRMetalMaterial(name, baseColor, panelTexture = null, emissiveFactor = 0.08) {
  ensureEnvironment();
  const mat = new BABYLON.PBRMaterial(name, scene);
  mat.metallic = 1.0;
  mat.roughness = 0.32;
  mat.environmentIntensity = 0.9;
  mat.albedoColor = baseColor;
  if (panelTexture) mat.albedoTexture = panelTexture;

  // Avoid external texture loads to prevent CORS errors; rely on panelTexture and environment lighting only

  mat.emissiveColor = baseColor.scale(emissiveFactor);
  return mat;
}

function fitMeshToPixels(mesh, targetWidth, targetHeight) {
  // Support both Mesh and TransformNode groups
  if (mesh && typeof mesh.getBoundingInfo === 'function') {
    mesh.scaling = new BABYLON.Vector3(1, 1, 1); mesh.refreshBoundingInfo(true);
    const bb = mesh.getBoundingInfo().boundingBox;
    const currentWidth = (bb.maximumWorld.x - bb.minimumWorld.x) || 1;
    const currentHeight = (bb.maximumWorld.y - bb.minimumWorld.y) || 1;
    const sx = targetWidth / currentWidth; const sy = targetHeight / currentHeight;
    mesh.scaling = new BABYLON.Vector3(sx, sy, 1); mesh.refreshBoundingInfo(true);
    return;
  }
  // If it's a group (TransformNode), compute bounds from children meshes
  if (mesh && mesh.getChildren) {
    const children = mesh.getChildren().filter(c => c && typeof c.getBoundingInfo === 'function');
    if (children.length === 0) return;
    // Reset scaling to base
    mesh.scaling = new BABYLON.Vector3(1, 1, 1);
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    children.forEach(ch => {
      try { ch.refreshBoundingInfo(true); } catch {}
      const bb = ch.getBoundingInfo().boundingBox;
      minX = Math.min(minX, bb.minimumWorld.x);
      maxX = Math.max(maxX, bb.maximumWorld.x);
      minY = Math.min(minY, bb.minimumWorld.y);
      maxY = Math.max(maxY, bb.maximumWorld.y);
    });
    const currentWidth = (maxX - minX) || 1;
    const currentHeight = (maxY - minY) || 1;
    const sx = targetWidth / currentWidth;
    const sy = targetHeight / currentHeight;
    const s = Math.min(sx, sy); // keep uniform scale for imported models
    mesh.scaling = new BABYLON.Vector3(s, s, s);
  }
}

function buildPlayerShipMesh() {
  // Exigir asset importado (sem fallback escondendo erros)
  if (!(typeof spaceshipMeshes !== 'undefined' && spaceshipMeshes && spaceshipMeshes.player)) {
    throw new Error("Mesh da nave do jogador não carregada. Verifique ShipConfig.player.rootUrl/fileName.");
  }
  const root = new BABYLON.TransformNode("playerShipRoot", scene);
  const base = spaceshipMeshes.player;
  const parts = base.getChildren().filter(c => c instanceof BABYLON.Mesh);
  parts.forEach(p => {
    try { const clone = p.clone(p.name + "_player"); clone.parent = root; clone.renderingGroupId = 1; } catch {}
  });
  // Orientação top-down controlada por configuração
  root.rotation.x = ShipConfig.player.rotationX;
  root.rotation.z = ShipConfig.player.rotationZ;
  // Textura
  applyShipTextureToGroup(root, ShipConfig.player.textureUrl);
  // Engine glow opcional
  const engine = BABYLON.MeshBuilder.CreatePlane("engineGlow", { size: 0.7 }, scene);
  engine.billboardMode = BABYLON.AbstractMesh.BILLBOARDMODE_ALL; engine.position.y = -1.25; engine.position.z = -0.1;
  const engineMat = createMaterial("engineGlowMat", new BABYLON.Color3(1.0, 0.5, 0.1)); engine.material = engineMat;
  engine.parent = root; engine.renderingGroupId = 1; registerGlowMesh(engine);
  return root;
}

function buildBasicEnemyMesh() {
  // Preferir variantes carregadas; caso não existam, usar base "enemy"
  const variants = (typeof window !== 'undefined' && window.spaceshipMeshes && Array.isArray(window.spaceshipMeshes.enemyVariants)) ? window.spaceshipMeshes.enemyVariants : [];
  const chosen = variants.length ? variants[Math.floor(Math.random() * variants.length)] : null;
  // Exigir asset importado (sem fallback silencioso)
  if (!chosen && !(typeof spaceshipMeshes !== 'undefined' && spaceshipMeshes && spaceshipMeshes.enemy)) {
    throw new Error("Mesh da nave inimiga não carregada. Verifique ShipConfig.enemy.rootUrl/fileName.");
  }
  const root = new BABYLON.TransformNode("enemyShipRoot", scene);
  const base = chosen ? chosen.root : spaceshipMeshes.enemy;
  const config = chosen ? chosen.config : ShipConfig.enemy;
  const parts = base.getChildren().filter(c => c instanceof BABYLON.Mesh);
  parts.forEach(p => {
    try { const clone = p.clone(p.name + "_enemy"); clone.parent = root; clone.renderingGroupId = 1; } catch {}
  });
  // Orientação top-down controlada por configuração
  root.rotation.x = (config && typeof config.rotationX === 'number') ? config.rotationX : ShipConfig.enemy.rotationX;
  root.rotation.z = (config && typeof config.rotationZ === 'number') ? config.rotationZ : ShipConfig.enemy.rotationZ;
  // Textura (se disponível na config da variante)
  const texUrl = (config && config.textureUrl) ? config.textureUrl : ShipConfig.enemy.textureUrl;
  applyShipTextureToGroup(root, texUrl);
  return root;
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
  // Try to use PBR with textures if available; otherwise fall back to color
  ensureEnvironment();
  const mat = new BABYLON.PBRMaterial("meteorMat", scene);
  mat.metallic = 0.0; mat.roughness = 0.9; mat.environmentIntensity = 0.6;
  mat.albedoColor = new BABYLON.Color3(0.45, 0.35, 0.25);
  // Remove external asset dependency to avoid 404s; keep pure color/bump-less for performance
  // If you later add local assets under ./assets, we can re-enable these lines.
  // const albedo = maybeTexture("assets/rock_albedo.jpg") || maybeTexture("assets/rock_albedo.png");
  // const normal = maybeTexture("assets/rock_normal.jpg") || maybeTexture("assets/rock_normal.png");
  // if (albedo) mat.albedoTexture = albedo;
  // if (normal) mat.bumpTexture = normal;
  rock.material = mat; rock.renderingGroupId = 1;
  return rock;
}

function colorToCSS(c) { return `rgb(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)})`; }
function scaleColor(c, s) { return new BABYLON.Color3(Math.min(1, c.r * s), Math.min(1, c.g * s), Math.min(1, c.b * s)); }

function createPanelTexture(name, baseColor) {
  const size = 256;
  const dt = new BABYLON.DynamicTexture(name, { width: size, height: size }, scene, false);
  const ctx = dt.getContext();
  const cTop = colorToCSS(scaleColor(baseColor, 1.05));
  const cBot = colorToCSS(scaleColor(baseColor, 0.85));
  const grad = ctx.createLinearGradient(0, 0, 0, size);
  grad.addColorStop(0, cTop);
  grad.addColorStop(1, cBot);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  // panel lines
  ctx.strokeStyle = "rgba(255,255,255,0.06)";
  ctx.lineWidth = 1;
  for (let i = 32; i < size; i += 32) {
    ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(size, i); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, size); ctx.stroke();
  }
  // subtle diagonal scratches
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  for (let i = -size; i < size; i += 64) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + size, size); ctx.stroke();
  }
  dt.update(false);
  return dt;
}

// Visual helper: update entity mesh position and sync body
function updateEntityMeshPosition(entity) {
  if (!entity || !entity.mesh) return;
  const mesh = entity.mesh;
  mesh.position.x = entity.x - SCREEN_WIDTH / 2;
  mesh.position.y = -(entity.y - SCREEN_HEIGHT / 2);
  try {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    if (typeof mesh.getBoundingInfo === 'function') {
      try { mesh.refreshBoundingInfo && mesh.refreshBoundingInfo(true); } catch {}
      const bb = mesh.getBoundingInfo().boundingBox;
      minX = Math.min(minX, bb.minimumWorld.x);
      maxX = Math.max(maxX, bb.maximumWorld.x);
      minY = Math.min(minY, bb.minimumWorld.y);
      maxY = Math.max(maxY, bb.maximumWorld.y);
    }
    if (mesh.getChildren) {
      const children = mesh.getChildren().filter(c => c && typeof c.getBoundingInfo === 'function');
      children.forEach(ch => {
        try { ch.refreshBoundingInfo && ch.refreshBoundingInfo(true); } catch {}
        const bb = ch.getBoundingInfo().boundingBox;
        minX = Math.min(minX, bb.minimumWorld.x);
        maxX = Math.max(maxX, bb.maximumWorld.x);
        minY = Math.min(minY, bb.minimumWorld.y);
        maxY = Math.max(maxY, bb.maximumWorld.y);
      });
    }
    const newW = (maxX - minX);
    const newH = (maxY - minY);
    if (isFinite(newW) && isFinite(newH) && newW > 0 && newH > 0) {
      entity.width = newW; entity.height = newH; entity.updateBodyFromEntity && entity.updateBodyFromEntity();
    }
  } catch {}
  // Always sync body after position update
  entity.updateBodyFromEntity && entity.updateBodyFromEntity();
}

function syncEntityVisual(entity) { updateEntityMeshPosition(entity); }

// Visual helper: banking rotation based on velocity
function updateBankingRotation(entity, vx, vy, clamp = 1.1, lerp = 0.24, scale = 0.12) {
  if (!entity || !entity.mesh) return;
  try {
    const targetZ = BABYLON.Scalar.Clamp(-vx * scale, -clamp, clamp);
    const baseRotZ = entity.baseRotZ || (entity.mesh.rotation.z || 0);
    const baseRotX = entity.baseRotX || (entity.mesh.rotation.x || 0);
    entity.mesh.rotation.z = BABYLON.Scalar.Lerp(entity.mesh.rotation.z || baseRotZ, baseRotZ + targetZ, lerp);
    entity.mesh.rotation.x = BABYLON.Scalar.Lerp(entity.mesh.rotation.x || baseRotX, baseRotX, lerp);
  } catch {}
}

// Player-specific highlight color pulse helper
function updatePlayerHighlight(player) {
  if (!player || !player.mesh || !highlightLayer) return;
  try {
    const base = new BABYLON.Color3(0.12, 0.4, 0.8);
    let color = base;
    if (player.charge >= MAX_CHARGE * 0.8) {
      const pulse = 0.75 + 0.25 * Math.sin(gameState.numFrame * 0.15);
      color = new BABYLON.Color3(base.r * pulse, base.g * pulse, base.b * pulse);
    }
    if (player.mesh.getChildren && !(player.mesh instanceof BABYLON.AbstractMesh)) {
      player.mesh.getChildren().filter(m => m instanceof BABYLON.Mesh).forEach(m => { try { highlightLayer.addMesh(m, color); } catch {} });
    } else { try { highlightLayer.addMesh(player.mesh, color); } catch {} }
  } catch {}
}

// Engine glow emissive pulse helper
function updateEngineGlow(entity) {
  if (!entity || !entity.engineGlow || !entity.engineGlow.material) return;
  try {
    const baseColor = new BABYLON.Color3(1.0, 0.5, 0.1);
    const pulseFactor = (entity.charge && entity.charge >= MAX_CHARGE * 0.8)
      ? (0.3 + 0.7 * (0.5 + 0.5 * Math.sin(gameState.numFrame * 0.2)))
      : 0.25;
    entity.engineGlow.material.emissiveColor = baseColor.scale(pulseFactor);
  } catch {}
}

// Emit engine flame helper (generic)
function maybeEmitEngineFlame(entity, offsetFromHalf = 0) {
  try {
    if (engineFlamesEnabled && temporizes(6)) {
      const y = entity.y + (entity.height / 2) + (offsetFromHalf || 0);
      debrisEntities.push(new EngineFlame(entity.x, y));
    }
  } catch {}
}

// Expose helpers globally
window.updateEntityMeshPosition = updateEntityMeshPosition;
window.syncEntityVisual = syncEntityVisual;
window.updateBankingRotation = updateBankingRotation;
window.updatePlayerHighlight = updatePlayerHighlight;
window.updateEngineGlow = updateEngineGlow;
window.maybeEmitEngineFlame = maybeEmitEngineFlame;
