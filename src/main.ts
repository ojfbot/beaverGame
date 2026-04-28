import { SceneBootstrap } from "./scene/bootstrap";
import { applyHdriEnvironment } from "./scene/lighting";
import { composeWorld } from "./scene/world";
import { spawnPlayer } from "./scene/player";
import { createFellingSystem } from "./scene/felling";

const canvas = document.getElementById("game") as HTMLCanvasElement | null;
if (!canvas) throw new Error("missing #game canvas");

const scene = new SceneBootstrap(canvas);
scene.start();

applyHdriEnvironment(scene, "/assets/hdri/dawn-meadow.hdr").catch(() => {});

(async () => {
  const world = await composeWorld(scene.scene);
  const player = await spawnPlayer(scene.scene, { terrain: world.terrain });
  const felling = createFellingSystem(scene.scene, world.treeStates);

  scene.setTick((dt, camera) => {
    player.update(dt, camera);
    felling.update(dt, player);
  });

  // Debug hatch — also exposes a couple of programmatic test entry points
  // so the snap script can exercise interactions without simulating keys.
  (window as unknown as { __beaver: unknown }).__beaver = {
    scene, player, world, felling,
    // Teleport to the nearest standing tree and start gnawing.
    // Top-down overview: parks the camera 25u above the centre, looking down.
    // Bypasses the follow-cam by replacing the tick fn with a no-op.
    setOverviewCamera(targetXZ: { x: number; z: number } = { x: 0, z: 0 }) {
      scene.setTick(null);
      scene.camera.position.set(targetXZ.x, 18, targetXZ.z + 14);
      scene.camera.lookAt(targetXZ.x, 0, targetXZ.z);
    },
    testFellNearestTree() {
      let best = null as null | (typeof world.treeStates)[number];
      let bestDist = Infinity;
      for (const t of world.treeStates) {
        if (t.status !== "standing") continue;
        const d = t.position.distanceTo(player.position);
        if (d < bestDist) { bestDist = d; best = t; }
      }
      if (!best) return null;
      // Stand 1.2u away from the tree, facing it.
      const away = best.position.clone().sub(player.position).setY(0).normalize();
      const stand = best.position.clone().sub(away.clone().multiplyScalar(1.2));
      stand.y = world.terrain.heightAt(stand.x, stand.z);
      player.group.position.copy(stand);
      player.group.rotation.y = Math.atan2(-away.x, -away.z);
      // Hold-equivalent: queue interact repeatedly for ~5s to clear gnaw.
      const start = performance.now();
      const id = setInterval(() => {
        player.state.interactQueued = true;
        if (performance.now() - start > 5000) clearInterval(id);
      }, 80);
      return { tree: best.position.toArray() };
    },
  };
  window.addEventListener("beforeunload", () => player.destroy());
})().catch((err) => console.error("world spawn failed:", err));

window.addEventListener("resize", () => scene.resize());
window.addEventListener("beforeunload", () => scene.destroy());
