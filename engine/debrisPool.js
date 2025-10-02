// Debris pool initialization extracted from game.js

let debrisBaseMesh = null;
let debrisMaterial = null;
let totalDebrisCount = 0;

function initDebrisPool() {
    if (debrisBaseMesh) return;
    debrisBaseMesh = BABYLON.MeshBuilder.CreateBox("debrisBase", { size: 0.5 }, scene);
    debrisMaterial = new BABYLON.StandardMaterial("debrisMat", scene);
    debrisMaterial.emissiveColor = new BABYLON.Color3(1, 1, 1);
    debrisMaterial.disableLighting = true;
    debrisBaseMesh.material = debrisMaterial;
    debrisBaseMesh.renderingGroupId = 1; // above background
    debrisBaseMesh.setEnabled(false);
}

window.debrisBaseMesh = debrisBaseMesh;
window.debrisMaterial = debrisMaterial;
window.totalDebrisCount = totalDebrisCount;
window.initDebrisPool = initDebrisPool;