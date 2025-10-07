// Mesh: Meteor (globals)

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