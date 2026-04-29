import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { VertexBuffer } from "@babylonjs/core/Buffers/buffer";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Scene } from "@babylonjs/core/scene";

// Babylon analog of src/scene/materials.ts. Asset-foundry .glbs ship
// KHR_materials_unlit + linear vertex colors; Babylon's glTF loader installs
// a PBRMaterial which renders pure white because the unlit/vertex-color
// pipeline isn't wired the way Three.js's MeshBasicMaterial(vertexColors:true)
// does it. Walk the mesh tree, find anything with a COLOR_0 attribute, and
// replace its material with an unlit StandardMaterial that respects vertex
// colors.

let cachedMaterial: { mat: StandardMaterial; opaque: boolean }[] = [];

function getOrCreateMaterial(scene: Scene, opaque: boolean): StandardMaterial {
  const found = cachedMaterial.find((m) => m.opaque === opaque);
  if (found) return found.mat;
  const mat = new StandardMaterial(`unlit-vc-${opaque ? "opaque" : "translucent"}`, scene);
  // Disable Babylon's lighting calc — diffuseColor becomes the unlit base
  // color, vertex colors multiply against it.
  mat.disableLighting = true;
  mat.diffuseColor = new Color3(1, 1, 1);
  mat.specularColor = new Color3(0, 0, 0);
  mat.emissiveColor = new Color3(0, 0, 0);
  mat.useEmissiveAsIllumination = false;
  if (!opaque) {
    mat.alpha = 0.55;
    mat.alphaMode = 1; // ALPHA_COMBINE
  }
  mat.backFaceCulling = false;
  cachedMaterial.push({ mat, opaque });
  return mat;
}

export function enforceVertexColorMaterials(
  meshes: AbstractMesh[],
  opts: { translucent?: boolean } = {},
): void {
  for (const node of meshes) {
    if (!(node instanceof Mesh)) continue;
    const hasColor = !!node.getVerticesDataKinds?.()?.includes(VertexBuffer.ColorKind);
    if (!hasColor) continue;
    const scene = node.getScene();
    node.material = getOrCreateMaterial(scene, !opts.translucent);
    // Ensure the renderer actually multiplies by vertex colors.
    node.useVertexColors = true;
    node.hasVertexAlpha = true;
  }
}
