import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { SceneLoader, ISceneLoaderAsyncResult } from "@babylonjs/core/Loading/sceneLoader";
import "@babylonjs/loaders/glTF";
import { Terrain } from "./terrain";
import { ColliderRegistry, createColliderRegistry } from "./collision";
import { enforceVertexColorMaterials } from "./materials";

const ASSET_BASE = "/assets/";

// Terrain config — same as Three.js scene/world.ts (40m square, 64 segments,
// seed 1, 2.4 amplitude). Keeps gameplay parity for the test rigs.
const TERRAIN_OPTS = { size: 40, segments: 64, seed: 1, amplitude: 2.4 };

// Sapling positions reused from src/scene/world.ts scatter (truncated to 5 for
// Sprint 1; full scatter ports in Sprint 2 when felling.ts lands).
const SAPLING_POSITIONS = [
  { x: 2.5, z: -1.5 },
  { x: -3.0, z: 2.0 },
  { x: 4.5, z: 3.5 },
  { x: -5.5, z: -3.5 },
  { x: 1.5, z: 6.0 },
];

export type LoadedWorld = {
  terrain: Terrain;
  colliders: ColliderRegistry;
  sky: ISceneLoaderAsyncResult;
  ground: ISceneLoaderAsyncResult;
  water: ISceneLoaderAsyncResult;
  trees: ISceneLoaderAsyncResult[];
  treePositions: { x: number; z: number }[];
};

async function importGlb(
  scene: Scene,
  file: string,
  position?: Vector3,
  opts: { translucent?: boolean } = {},
): Promise<ISceneLoaderAsyncResult> {
  const result = await SceneLoader.ImportMeshAsync("", ASSET_BASE, file, scene);
  if (position && result.meshes[0]) {
    result.meshes[0].position.copyFrom(position);
  }
  enforceVertexColorMaterials(result.meshes, opts);
  return result;
}

export async function loadWorld(scene: Scene): Promise<LoadedWorld> {
  // Procedural terrain first (deterministic, no I/O).
  const terrain = new Terrain(scene, TERRAIN_OPTS);

  // Sky and ground/water layered on top of the procedural terrain. The
  // ground_pond_meadow asset is decorative — the actual ground geometry is
  // the procedural mesh.
  const sky = await importGlb(scene, "sky_dome_v1.glb");
  const ground = await importGlb(scene, "ground_pond_meadow_v1.glb");
  // Water is translucent — vertex colors with reduced alpha. Matches
  // src/scene/world.ts's translucent: true handling.
  const water = await importGlb(scene, "water_pond_v1.glb", undefined, { translucent: true });

  // Trees scattered at fixed positions; collider radius matches Three.js
  // src/scene/world.ts (0.18 trunk radius). Full scatter + standing/fallen
  // state lands in Sprint 2 alongside felling.ts.
  const colliders = createColliderRegistry();
  const trees: ISceneLoaderAsyncResult[] = [];
  for (let i = 0; i < SAPLING_POSITIONS.length; i++) {
    const p = SAPLING_POSITIONS[i]!;
    const y = terrain.heightAt(p.x, p.z);
    const tree = await importGlb(scene, "birch_sapling_v1.glb", new Vector3(p.x, y, p.z));
    colliders.add({ id: `tree-${i}`, cx: p.x, cz: p.z, radius: 0.18 });
    trees.push(tree);
  }

  const treePositions = SAPLING_POSITIONS.map((p) => ({ x: p.x, z: p.z }));
  return { terrain, colliders, sky, ground, water, trees, treePositions };
}
