import { SceneBootstrap } from "./scene/bootstrap";
import { applyHdriEnvironment } from "./scene/lighting";
import { composeWorld } from "./scene/world";
import { spawnPlayer } from "./scene/player";
import { createFellingSystem } from "./scene/felling";
import { createHaulingSystem } from "./scene/hauling";

const canvas = document.getElementById("game") as HTMLCanvasElement | null;
if (!canvas) throw new Error("missing #game canvas");

const scene = new SceneBootstrap(canvas);
scene.start();

applyHdriEnvironment(scene, "/assets/hdri/dawn-meadow.hdr").catch(() => {});

(async () => {
  const world = await composeWorld(scene.scene);
  const player = await spawnPlayer(scene.scene, { terrain: world.terrain });
  const felling = createFellingSystem(scene.scene, world.treeStates);

  // M-δ will replace this with a real water-level driver tied to dam state.
  // For M-γ, the water level is fixed at -100 (effectively never in water),
  // so the speed multiplier still works for the carry-on-land case.
  let waterLevel = -100;
  const hauling = createHaulingSystem({
    terrain: world.terrain,
    getWaterLevel: () => waterLevel,
  });

  scene.setTick((dt, camera) => {
    // Order: felling first (claims interact for gnawing if a tree is in
    // range), then hauling (claims interact for pickup/drop if not), then
    // player (consumes the speedMultiplier hauling just wrote).
    felling.update(dt, player);
    hauling.update(dt, player, felling.logs);
    player.speedMultiplier = hauling.speedMultiplier;
    player.update(dt, camera);
  });

  // Debug hatch + programmatic test entry points for the snap script.
  (window as unknown as { __beaver: unknown }).__beaver = {
    scene, player, world, felling, hauling,
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
      const away = best.position.clone().sub(player.position).setY(0).normalize();
      const stand = best.position.clone().sub(away.clone().multiplyScalar(1.2));
      stand.y = world.terrain.heightAt(stand.x, stand.z);
      player.group.position.copy(stand);
      player.group.rotation.y = Math.atan2(-away.x, -away.z);
      const start = performance.now();
      const id = setInterval(() => {
        player.state.interactQueued = true;
        if (performance.now() - start > 5000) clearInterval(id);
      }, 80);
      return { tree: best.position.toArray() };
    },
    // After a successful fell, walk over to the log and pick it up.
    testPickUpNearestLog() {
      const log = felling.logs.find((l) => l.status === "ground");
      if (!log) return null;
      // Stand 0.4u away from the log, facing it.
      const lp = log.mesh.position;
      const dir = new THREE.Vector3().subVectors(player.position, lp).setY(0).normalize();
      const stand = lp.clone().add(dir.multiplyScalar(0.4));
      stand.y = world.terrain.heightAt(stand.x, stand.z);
      player.group.position.copy(stand);
      const toLog = lp.clone().sub(stand).setY(0).normalize();
      player.group.rotation.y = Math.atan2(-toLog.x, -toLog.z);
      // Edge-trigger interact once
      player.state.interactQueued = true;
      return { log: lp.toArray() };
    },
  };
  window.addEventListener("beforeunload", () => player.destroy());
})().catch((err) => console.error("world spawn failed:", err));

window.addEventListener("resize", () => scene.resize());
window.addEventListener("beforeunload", () => scene.destroy());

// We import THREE only for the test-rig vector math at the bottom. Tree-shake
// trims unused symbols.
import * as THREE from "three";
