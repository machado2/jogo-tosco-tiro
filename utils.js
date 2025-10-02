// Global constants and utilities (loaded first)

// Constants
const MAX_HEALTH = 100;
const MAX_CHARGE = 1000;
const CHARGE_REFILL_PER_FRAME = 0.3;
const ENEMY_HEALTH = 5;
const METEOR_HEALTH = 1;
const MISSILE_HEALTH = 1;
const POINTS_ENEMY = 5;
const POINTS_METEOR = 1;
const POINTS_METRALHA = 20;
const POINTS_CHUVA = 100;
const SCREEN_WIDTH = 640;
const SCREEN_HEIGHT = 480;
const MAX_DEBRIS_TOTAL = 600;
const MAX_DEBRIS_PER_EVENT = 80;
const DEATH_OVERLAY_DELAY_FRAMES = 90; // ~1.5s at 60fps

// Utility functions
function random(max) { return Math.floor(Math.random() * max); }
function between(min, max) { return random(max - min) + min; }
function distance(x1, y1, x2, y2) {
  const dx = Math.abs(x1 - x2); const dy = Math.abs(y1 - y2);
  return Math.sqrt(dx * dx + dy * dy);
}
function sign(n) { if (n < 0) return -1; if (n > 0) return 1; return 0; }
function angleDir(x, y) {
  const dist = Math.sqrt(x * x + y * y) || 1;
  if (x < 0) return Math.asin(-y / dist) + Math.PI;
  return Math.asin(y / dist);
}
function temporizes(num) { return (typeof gameState !== 'undefined') && ((gameState.numFrame % num) === 0); }
function triggerShake(intensity = 2, frames = 10) {
  if (typeof gameState !== 'undefined') { gameState.shakeIntensity = intensity; gameState.shakeFrames = frames; }
}
function flashMesh(mesh, color = new BABYLON.Color3(1, 1, 1), durationMs = 80) {
  if (!mesh || typeof highlightLayer === 'undefined' || !highlightLayer) return;
  try {
    // If a group (TransformNode), apply highlight to child meshes
    if (mesh.getChildren && !(mesh instanceof BABYLON.AbstractMesh)) {
      const children = mesh.getChildren().filter(c => c instanceof BABYLON.Mesh);
      children.forEach(m => { try { highlightLayer.addMesh(m, color); } catch {} });
      setTimeout(() => { children.forEach(m => { try { highlightLayer.removeMesh(m); } catch {} }); }, durationMs);
      return;
    }
    // Single mesh
    highlightLayer.addMesh(mesh, color);
    setTimeout(() => { try { highlightLayer.removeMesh(mesh); } catch {} }, durationMs);
  } catch {}
}
