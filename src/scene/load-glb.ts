import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { ValidationManifest } from "./types";

const loader = new GLTFLoader();
const isDev = import.meta.env.DEV;

// Per ADR-0007 (asset-foundry contract): every shipped .glb has a sibling
// `<asset>.validation.json` describing tri count, bounding box, and material slots.
// Dev builds refuse to load an unvalidated asset so style drift is caught early.
export async function loadValidatedGlb(path: string): Promise<THREE.Group> {
  if (isDev) {
    const manifestUrl = path.replace(/\.glb$/, ".validation.json");
    const res = await fetch(manifestUrl);
    if (!res.ok) {
      throw new Error(
        `dev mode: ${path} has no sibling validation manifest at ${manifestUrl}. Generate via asset-foundry's gen-asset.`
      );
    }
    const manifest = (await res.json()) as ValidationManifest;
    if (manifest.status !== "validated") {
      throw new Error(`asset ${path} not validated: ${manifest.status}`);
    }
  }

  const gltf = await loader.loadAsync(path);
  return gltf.scene;
}
