import * as THREE from "three";
import { loadValidatedGlb } from "./load-glb";
import { enforceVertexColorMaterials } from "./materials";

export interface WorldHandles {
  ground: THREE.Group;
  pond: THREE.Group;
  sky: THREE.Group;
  trees: THREE.Group[];
  pondCentre: THREE.Vector3;
  pondRadius: number;
}

// Deterministic scatter of saplings around a centre, biased away from the pond.
// Seeded by the prop_id so the foundry artefact and the layout stay in sync.
function* mulberry32(seed: number): Generator<number> {
  let a = seed >>> 0;
  while (true) {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    yield ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
}

interface ScatterPlacement {
  position: THREE.Vector3;
  rotationY: number;
  scale: number;
}

function scatterPositions(
  count: number,
  centre: THREE.Vector3,
  innerRadius: number,
  outerRadius: number,
  seed: number
): ScatterPlacement[] {
  const rng = mulberry32(seed);
  const out: ScatterPlacement[] = [];
  for (let i = 0; i < count; i++) {
    const angle = rng.next().value! * Math.PI * 2;
    const r = innerRadius + rng.next().value! * (outerRadius - innerRadius);
    const x = centre.x + Math.cos(angle) * r;
    const z = centre.z + Math.sin(angle) * r;
    const y = 0;
    out.push({
      position: new THREE.Vector3(x, y, z),
      rotationY: rng.next().value! * Math.PI * 2,
      scale: 0.85 + rng.next().value! * 0.5,
    });
  }
  return out;
}

export async function composeWorld(scene: THREE.Scene): Promise<WorldHandles> {
  // Load assets in parallel — the dev-mode loader will block on each
  // .validation.json, but the network round-trips overlap.
  const [groundGlb, pondGlb, skyGlb, saplingTemplate] = await Promise.all([
    loadValidatedGlb("/assets/ground_pond_meadow_v1.glb"),
    loadValidatedGlb("/assets/water_pond_v1.glb"),
    loadValidatedGlb("/assets/sky_dome_v1.glb"),
    loadValidatedGlb("/assets/birch_sapling_v1.glb"),
  ]);

  enforceVertexColorMaterials(groundGlb);
  enforceVertexColorMaterials(skyGlb);
  enforceVertexColorMaterials(saplingTemplate);
  enforceVertexColorMaterials(pondGlb, { translucent: true });

  scene.add(groundGlb);
  scene.add(skyGlb);

  // Pond ahead and to the left of the spawn (camera looks toward -Z).
  const pondCentre = new THREE.Vector3(-3, 0, -5);
  pondGlb.position.copy(pondCentre);
  scene.add(pondGlb);

  // ~14 saplings between r=3 and r=11, biased forward so the spawn view feels
  // populated (the camera looks toward -Z). Trees inside the pond radius are
  // rejected and back-half over-sampled trees are dropped.
  const placements = scatterPositions(
    28,
    new THREE.Vector3(0, 0, 0),
    3,
    11,
    /*seed*/ 0xc02ff
  )
    .filter((p) => p.position.distanceTo(pondCentre) > 5)
    .filter((p) => p.position.z < 6) // keep trees mostly in front of the camera
    .slice(0, 14);

  const trees: THREE.Group[] = [];
  for (const p of placements) {
    const inst = saplingTemplate.clone(true);
    inst.position.copy(p.position);
    inst.rotation.y = p.rotationY;
    inst.scale.setScalar(p.scale);
    enforceVertexColorMaterials(inst);
    scene.add(inst);
    trees.push(inst);
  }

  return { ground: groundGlb, pond: pondGlb, sky: skyGlb, trees, pondCentre, pondRadius: 4.5 };
}
