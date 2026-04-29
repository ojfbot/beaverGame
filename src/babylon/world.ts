import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { SceneLoader, ISceneLoaderAsyncResult } from "@babylonjs/core/Loading/sceneLoader";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import "@babylonjs/loaders/glTF";
import { Terrain } from "./terrain";
import { ColliderRegistry, createColliderRegistry } from "./collision";
import { enforceVertexColorMaterials } from "./materials";

const ASSET_BASE = "/assets/";

// Terrain config — matches src/scene/world.ts line 55-60. The legacy seed is
// 0xc02ff (cozy beaver, intent: "co2ff") with amplitude 3.2 and 96² grid.
const TERRAIN_OPTS = { size: 40, segments: 96, seed: 0xc02ff, amplitude: 3.2 };

// Tree scatter config — matches src/scene/world.ts line 79-101.
const TREE_TARGET_COUNT = 32;
const TREE_MAX_ATTEMPTS = TREE_TARGET_COUNT * 8;
const TREE_MIN_SPACING = 1.6;
const TREE_SLOPE_REJECT = 0.45;   // radians (~25°)
const TREE_CREEK_REJECT_Y = 0.35;
const TREE_EDGE_MARGIN = 2;
const TREE_SCALE_MIN = 0.85;
const TREE_SCALE_RANGE = 0.55;

// Mulberry32 — same PRNG as terrain.ts. Inlined here to keep world.ts
// self-contained without exporting from terrain.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type TreeInstance = {
  id: string;
  root: TransformNode;
  position: { x: number; y: number; z: number };
  scale: number;
  yaw: number;
};

export type LoadedWorld = {
  terrain: Terrain;
  colliders: ColliderRegistry;
  sky: ISceneLoaderAsyncResult;
  trees: TreeInstance[];
  treePositions: { x: number; z: number }[];
};

async function importGlb(scene: Scene, file: string): Promise<ISceneLoaderAsyncResult> {
  const result = await SceneLoader.ImportMeshAsync("", ASSET_BASE, file, scene);
  enforceVertexColorMaterials(result.meshes);
  return result;
}

export async function loadWorld(scene: Scene): Promise<LoadedWorld> {
  const terrain = new Terrain(scene, TERRAIN_OPTS);

  // Sky dome — atmospheric backdrop. The legacy code adds it to the scene
  // directly; the GLTF loader does the same.
  const sky = await importGlb(scene, "sky_dome_v1.glb");

  // Birch sapling — load once, clone per tree. meshes[0] is the glTF
  // __root__ TransformNode; meshes[1+] are the actual geometry that needs
  // cloning. We instantiate clones via the helper.
  const sapling = await SceneLoader.ImportMeshAsync("", ASSET_BASE, "birch_sapling_v1.glb", scene);
  enforceVertexColorMaterials(sapling.meshes);
  const saplingRoot = sapling.meshes[0] as TransformNode | undefined;
  if (!saplingRoot) throw new Error("birch_sapling glTF returned no root mesh");
  // Hide the original — only its clones get placed.
  saplingRoot.setEnabled(false);

  // Rejection-sample 32 tree positions on slopes < 0.45 rad and y > 0.35.
  const colliders = createColliderRegistry();
  const trees: TreeInstance[] = [];
  const treePositions: { x: number; z: number }[] = [];
  const placed: { x: number; y: number; z: number }[] = [];
  const half = terrain.halfExtent - TREE_EDGE_MARGIN;

  const rng = mulberry32(TERRAIN_OPTS.seed + 99);
  let attempts = 0;
  while (trees.length < TREE_TARGET_COUNT && attempts < TREE_MAX_ATTEMPTS) {
    attempts++;
    const x = (rng() - 0.5) * 2 * half;
    const z = (rng() - 0.5) * 2 * half;
    const y = terrain.heightAt(x, z);
    const slope = terrain.slopeAt(x, z);
    if (slope > TREE_SLOPE_REJECT) continue;
    if (y < TREE_CREEK_REJECT_Y) continue;
    let tooClose = false;
    for (const p of placed) {
      const dx = x - p.x;
      const dy = y - p.y;
      const dz = z - p.z;
      if (Math.sqrt(dx * dx + dy * dy + dz * dz) < TREE_MIN_SPACING) {
        tooClose = true;
        break;
      }
    }
    if (tooClose) continue;
    placed.push({ x, y, z });

    // Use instantiateHierarchy — Babylon's recommended path for duplicating
    // glTF mesh hierarchies. Creates per-mesh instances (shared geometry,
    // independent transforms) and clones the TransformNode tree. Faster +
    // more reliable than .clone() which has incomplete deep-clone semantics
    // for glTF __root__ + descendants.
    const id = `tree-${trees.length}`;
    const clone = saplingRoot.instantiateHierarchy(null) as TransformNode | null;
    if (!clone) continue;
    clone.name = id;
    clone.setEnabled(true);
    clone.position.set(x, y, z);
    clone.rotation.y = rng() * Math.PI * 2;
    const scale = TREE_SCALE_MIN + rng() * TREE_SCALE_RANGE;
    clone.scaling.set(scale, scale, scale);

    trees.push({ id, root: clone, position: { x, y, z }, scale, yaw: clone.rotation.y });
    treePositions.push({ x, z });
    colliders.add({ id, cx: x, cz: z, radius: 0.18 * scale });
  }

  return { terrain, colliders, sky, trees, treePositions };
}
