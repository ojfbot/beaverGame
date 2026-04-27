import * as THREE from "three";

// Belt-and-braces: even though our foundry fixtures now ship KHR_materials_unlit
// (Three.js loads them as MeshBasicMaterial({vertexColors:true}) automatically),
// older or LLM-authored .glbs may not. Walk the tree and force vertex-color
// rendering anywhere COLOR_0 is present but the material is dropping it.
export function enforceVertexColorMaterials(
  group: THREE.Object3D,
  opts: { translucent?: boolean } = {}
): void {
  group.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;
    const geom = node.geometry as THREE.BufferGeometry;
    const hasColor = !!geom.attributes.color;
    if (!hasColor) return;

    const existing = node.material as THREE.Material;
    const isUnlit = existing instanceof THREE.MeshBasicMaterial && existing.vertexColors;
    if (isUnlit) return;

    const replacement = new THREE.MeshBasicMaterial({
      vertexColors: true,
      side: THREE.DoubleSide,
      transparent: !!opts.translucent,
      opacity: opts.translucent ? 0.55 : 1.0,
      depthWrite: !opts.translucent,
    });
    node.material = replacement;
    if (existing && "dispose" in existing) (existing as THREE.Material).dispose();
  });
}
