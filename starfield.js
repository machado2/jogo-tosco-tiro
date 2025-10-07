// Parallax starfield background using base meshes to avoid per-instance material assignment
class Starfield {
  constructor(count = 250) {
    this.stars = [];
    
    for (let i = 0; i < count; i++) {
      const size = 0.5 + Math.random() * 1.5;
      
      // Create star mesh
      const star = BABYLON.MeshBuilder.CreateSphere(`star_${i}`, { diameter: size }, scene);
      
      // Try a simple bright diffuse material instead of emissive
      const material = new BABYLON.StandardMaterial(`starMat_${i}`, scene);
      if (Math.random() < 0.3) {
          // Blue stars - very bright
          material.diffuseColor = new BABYLON.Color3(0.5, 0.8, 1.0);
          material.emissiveColor = new BABYLON.Color3(0.2, 0.4, 0.8);
      } else {
          // White stars - very bright  
          material.diffuseColor = new BABYLON.Color3(1.0, 1.0, 1.0);
          material.emissiveColor = new BABYLON.Color3(0.8, 0.8, 0.8);
      }
      
      // Make sure material is unlit (self-illuminated)
      material.disableLighting = true;
      
      star.material = material;
      star.position.x = Math.random() * SCREEN_WIDTH - SCREEN_WIDTH / 2;
      star.position.y = Math.random() * SCREEN_HEIGHT - SCREEN_HEIGHT / 2;
      star.position.z = -5; // Behind other objects but in front of camera
      star.renderingGroupId = 0; // Background layer
      
      this.stars.push({ mesh: star, speed: Math.random() * 2 + 1 });
    }
  }

  update() {
        for (let i = 0; i < this.stars.length; i++) {
            const star = this.stars[i];
            // Move stars downward for vertical scroller
            star.mesh.position.y -= star.speed;
            
            // Wrap around when stars go off the bottom of the screen
            if (star.mesh.position.y < -SCREEN_HEIGHT / 2 - 10) {
                star.mesh.position.y = SCREEN_HEIGHT / 2 + 10;
                star.mesh.position.x = Math.random() * SCREEN_WIDTH - SCREEN_WIDTH / 2;
                star.mesh.position.z = -5; // Reset Z position when wrapping
            }
        }
    }
}
