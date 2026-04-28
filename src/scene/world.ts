import * as THREE from "three";
import { loadValidatedGlb } from "./load-glb";
import { enforceVertexColorMaterials } from "./materials";
import { Terrain } from "./terrain";

export interface WorldHandles {
  terrain: Terrain;
  sky: THREE.Group;
  trees: THREE.Group[];
  // Mode A loop targets — populated as M-β / M-δ land.
  treeStates: TreeState[];
  damSite: THREE.Vector3;
}

export interface TreeState {
  group: THREE.Group;
  position: THREE.Vector3;
  // 0 = standing, 0..1 = gnaw progress, then "falling" plays out as a tween,
  // then "fallen" with a log spawned at the trunk base. Filled in M-β.
  status: "standing" | "gnawing" | "falling" | "fallen";
  gnawProgress: number;
  fallTimer: number;
  fallAxis: THREE.Vector3 | null;
}

// Deterministic Mulberry32 (kept to a single seed source).
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

export async function composeWorld(scene: THREE.Scene, seed = 0xc02ff): Promise<WorldHandles> {
  // ── Lighting (we now have a Lambert terrain that wants real light)
  // Hemisphere = soft sky/ground bounce; Directional = the sun.
  const hemi = new THREE.HemisphereLight(0xffe9c2, 0x4d6a3a, 0.55);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff2cc, 0.95);
  sun.position.set(15, 22, 8);
  sun.castShadow = false; // shadows would be nice but they're a polish item
  scene.add(sun);

  // ── Terrain (M-α)
  const terrain = new Terrain({
    size: 40,
    segments: 96,
    seed,
    amplitude: 3.2,
  });
  scene.add(terrain.group);

  // ── Sky dome (kept from Phase 0 — sits around the world)
  const skyGlb = await loadValidatedGlb("/assets/sky_dome_v1.glb");
  enforceVertexColorMaterials(skyGlb);
  scene.add(skyGlb);

  // ── Tree scatter
  // Reject placements where slope > ~25° or where the tree would clip into
  // the creek bed (low elevation). Keep within the playable patch with a
  // safety margin from the edge.
  const sapling = await loadValidatedGlb("/assets/birch_sapling_v1.glb");
  enforceVertexColorMaterials(sapling);

  const trees: THREE.Group[] = [];
  const treeStates: TreeState[] = [];
  const rng = mulberry32(seed + 99);
  const target = 32; // target tree count
  const maxAttempts = target * 8;
  const minSpacing = 1.6;
  const placed: THREE.Vector3[] = [];
  const half = terrain.halfExtent - 2;
  let attempts = 0;
  while (placed.length < target && attempts < maxAttempts) {
    attempts++;
    const x = (rng.next().value! - 0.5) * 2 * half;
    const z = (rng.next().value! - 0.5) * 2 * half;
    const y = terrain.heightAt(x, z);
    const slope = terrain.slopeAt(x, z);
    if (slope > 0.45) continue; // too steep
    if (y < 0.35) continue; // creek bed
    // Spacing
    let tooClose = false;
    for (const p of placed) {
      if (p.distanceTo(new THREE.Vector3(x, y, z)) < minSpacing) {
        tooClose = true;
        break;
      }
    }
    if (tooClose) continue;
    placed.push(new THREE.Vector3(x, y, z));

    const inst = sapling.clone(true);
    enforceVertexColorMaterials(inst);
    inst.position.set(x, y, z);
    inst.rotation.y = rng.next().value! * Math.PI * 2;
    inst.scale.setScalar(0.85 + rng.next().value! * 0.55);
    scene.add(inst);
    trees.push(inst);
    treeStates.push({
      group: inst,
      position: inst.position.clone(),
      status: "standing",
      gnawProgress: 0,
      fallTimer: 0,
      fallAxis: null,
    });
  }

  return {
    terrain,
    sky: skyGlb,
    trees,
    treeStates,
    damSite: terrain.damSite,
  };
}
