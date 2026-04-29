import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { VertexBuffer } from "@babylonjs/core/Buffers/buffer";
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Scene } from "@babylonjs/core/scene";

// Babylon analog of src/scene/materials.ts. Asset-foundry .glbs ship
// KHR_materials_unlit + linear vertex colors (per asset-foundry/_lib.py).
// Babylon's glTF loader installs PBRMaterials that don't pipe vertex colors
// into output the way Three.js's MeshBasicMaterial(vertexColors:true) does.
//
// Using PBRMaterial.unlit=true is the documented Babylon path for
// "no lighting, vertex colors multiply albedo." Output formula:
//   color = albedoColor * vertexColor.rgb (+ emissive)
// Tried StandardMaterial(disableLighting=true) first — that path zeros the
// diffuse contribution and renders pure black. PBRMaterial.unlit handles it
// correctly.

const cached: { mat: PBRMaterial; opaque: boolean }[] = [];

function getOrCreateMaterial(scene: Scene, opaque: boolean): PBRMaterial {
  const found = cached.find((m) => m.opaque === opaque);
  if (found) return found.mat;
  const mat = new PBRMaterial(`unlit-vc-${opaque ? "opaque" : "translucent"}`, scene);
  mat.unlit = true;
  mat.albedoColor = new Color3(1, 1, 1);
  mat.backFaceCulling = false;
  if (!opaque) {
    mat.alpha = 0.55;
    mat.transparencyMode = PBRMaterial.MATERIAL_ALPHABLEND;
  }
  cached.push({ mat, opaque });
  return mat;
}

export function enforceVertexColorMaterials(
  meshes: AbstractMesh[],
  opts: { translucent?: boolean } = {},
): void {
  for (const node of meshes) {
    if (!(node instanceof Mesh)) continue;
    const kinds = node.getVerticesDataKinds?.() ?? [];
    const hasColor = kinds.includes(VertexBuffer.ColorKind);
    if (!hasColor) continue;
    const scene = node.getScene();
    node.material = getOrCreateMaterial(scene, !opts.translucent);
    node.useVertexColors = true;
    // Don't force hasVertexAlpha — let Babylon infer from the buffer. asset-
    // foundry COLOR_0 is RGB (no alpha channel) so forcing vertex alpha
    // produced the previous black-render bug when reading 0 from a missing
    // alpha component.
  }
}
