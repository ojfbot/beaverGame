import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { SceneLoader, ISceneLoaderAsyncResult } from "@babylonjs/core/Loading/sceneLoader";
import "@babylonjs/loaders/glTF";

const ASSET_BASE = "/assets/";

type AssetSpec = { id: string; file: string; position?: Vector3 };

const ASSETS: AssetSpec[] = [
  { id: "sky_dome", file: "sky_dome_v1.glb", position: new Vector3(0, 0, 0) },
  { id: "ground_pond_meadow", file: "ground_pond_meadow_v1.glb", position: new Vector3(0, 0, 0) },
  { id: "water_pond", file: "water_pond_v1.glb", position: new Vector3(0, 0, 0) },
  { id: "beaver_basic", file: "beaver_basic_v1.glb", position: new Vector3(0, 0, 0) },
  // Place a single birch sapling near origin for now; world.ts will scatter
  // many once terrain heightAt is ported.
  { id: "birch_sapling", file: "birch_sapling_v1.glb", position: new Vector3(2.5, 0, -1.5) },
];

export type LoadedWorld = {
  meshes: Record<string, ISceneLoaderAsyncResult>;
};

export async function loadWorld(scene: Scene): Promise<LoadedWorld> {
  const meshes: Record<string, ISceneLoaderAsyncResult> = {};

  for (const asset of ASSETS) {
    const result = await SceneLoader.ImportMeshAsync("", ASSET_BASE, asset.file, scene);
    if (asset.position && result.meshes[0]) {
      result.meshes[0].position.copyFrom(asset.position);
    }
    meshes[asset.id] = result;
  }

  return { meshes };
}
