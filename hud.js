// HUD and input helpers (globals, no module build step)
// Expects gameState and audioSystem to be globals provided elsewhere.

function updateHUD() {
  const scoreEl = document.getElementById('score');
  const healthBar = document.getElementById('health-bar');
  const chargeBar = document.getElementById('charge-bar');
  const mutedLabel = document.getElementById('muted-label');
  if (!scoreEl || !healthBar || !chargeBar) return;
  scoreEl.textContent = `Score: ${gameState.score}`;
  healthBar.style.width = `${(gameState.playerHealth / 100) * 100}%`;
  chargeBar.style.width = `${(gameState.playerCharge / 1000) * 100}%`;
  gameState.playerCharge = Math.min(1000, gameState.playerCharge);
  if (mutedLabel) mutedLabel.style.display = gameState.muted ? 'inline' : 'none';
}

function initHUD() {
  // Keyboard: Pause and Mute
  const pausedOverlayEl = document.getElementById('paused');
  document.addEventListener('keydown', (e) => {
    if (e.code === 'KeyP') {
      gameState.paused = !gameState.paused;
      if (pausedOverlayEl) pausedOverlayEl.classList.toggle('visible', gameState.paused);
    }
    if (e.code === 'KeyM') {
      gameState.muted = !gameState.muted;
      if (window.audioSystem) {
        // Ensure nodes exist so mute takes effect immediately
        if (!audioSystem.ctx) {
          try { audioSystem.init(); } catch {}
        }
        if (typeof audioSystem.setMuted === 'function') {
          audioSystem.setMuted(gameState.muted);
        } else {
          // fallback: set property for init to pick up
          audioSystem.muted = gameState.muted;
        }
      }
      const mutedLabel = document.getElementById('muted-label');
      if (mutedLabel) mutedLabel.style.display = gameState.muted ? 'inline' : 'none';
    }
  });
}

function flashDamageOverlay() {
  try {
    const el = document.getElementById('damage-overlay');
    if (el) {
      el.classList.add('flash');
      setTimeout(() => el.classList.remove('flash'), 120);
    }
  } catch {}
}

window.flashDamageOverlay = flashDamageOverlay;
