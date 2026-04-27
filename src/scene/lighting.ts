import * as THREE from "three";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";
import type { SceneBootstrap } from "./bootstrap";

// IBL is only meaningful for lit materials. Our props ship as KHR_materials_unlit
// (vertex colours), so this is a no-op when the HDRI is missing — exactly what we
// want for Phase 0. Once we have lit props (water surfaces, beaver fur), drop a
// real .hdr under public/assets/hdri/ and this lights them automatically.
export async function applyHdriEnvironment(
  scene: SceneBootstrap,
  hdrPath: string
): Promise<void> {
  const head = await fetch(hdrPath, { method: "HEAD" }).catch(() => null);
  // Vite's SPA fallback returns 200 + text/html for unknown paths; sniff the
  // content-type so we don't hand HTML to RGBELoader.
  const contentType = head?.headers.get("content-type") ?? "";
  if (!head || !head.ok || contentType.includes("text/html")) {
    console.info("HDRI not present; skipping IBL (unlit materials don't need it)");
    return;
  }
  const hdr = await new RGBELoader().loadAsync(hdrPath);
  hdr.mapping = THREE.EquirectangularReflectionMapping;
  const pmrem = new THREE.PMREMGenerator(scene.rendererInstance);
  const env = pmrem.fromEquirectangular(hdr).texture;
  scene.setEnvironment(env);
  hdr.dispose();
  pmrem.dispose();
}
