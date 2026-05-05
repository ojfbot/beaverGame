import { BabylonScene } from "./scene";
import { loadWorld } from "./world";
import { spawnPlayer } from "./player";
import { createFellingSystem } from "./felling";
import { createHaulingSystem } from "./hauling";
import { createDammingSystem } from "./damming";
import { createDiggingSystem } from "./digging";
import { tryConnectFoundry, callFoundryTool } from "./foundry-client";
import { createUI } from "./ui";

const canvas = document.getElementById("game") as HTMLCanvasElement | null;
if (!canvas) throw new Error("missing #game canvas");

const sb = new BabylonScene(canvas);
sb.start();

(async () => {
  const world = await loadWorld(sb.scene);
  const player = await spawnPlayer(sb.scene, {
    terrain: world.terrain,
    camera: sb.camera,
    colliders: world.colliders,
  });

  const felling = createFellingSystem({
    scene: sb.scene,
    trees: world.trees,
    colliders: world.colliders,
  });

  const damming = createDammingSystem({
    scene: sb.scene,
    terrain: world.terrain,
    damSite: world.terrain.damSite,
  });

  const hauling = createHaulingSystem({
    terrain: world.terrain,
    getWaterLevel: () => damming.waterLevel,
  });

  const digging = createDiggingSystem({
    scene: sb.scene,
    terrain: world.terrain,
    // Suppress digging if the player is positioned to gnaw (any standing tree
    // in INTERACT_RANGE) or carrying a log (E is the drop key, not dig).
    isInteractionClaimed: () => {
      if (hauling.carriedLog !== null) return true;
      const px = player.position.x;
      const pz = player.position.z;
      for (const t of world.trees) {
        if (t.status !== "standing" && t.status !== "gnawing") continue;
        const dx = t.position.x - px;
        const dz = t.position.z - pz;
        if (dx * dx + dz * dz < 1.6 * 1.6) return true;
      }
      return false;
    },
  });

  const ui = createUI({
    terrain: world.terrain,
    player,
    treePositions: world.treePositions,
  });

  sb.setTick((dt) => {
    // Order: felling claims interactHeld+queued first (gnaw if standing tree
    // is in range), hauling claims queued next (pickup/drop if a log is
    // nearby), damming claims dropped logs, digging consumes whatever's left.
    felling.update(dt, player);
    hauling.update(dt, player, felling.logs);
    damming.update(dt, player, felling.logs);
    digging.update(dt, player);
    player.speedMultiplier = hauling.speedMultiplier;
    player.update(dt);
    // Drain edge-trigger so a single E press doesn't fire repeatedly across
    // frames; consumers above already inspected it.
    player.state.interactQueued = false;
    ui.update();
  });

  const foundry = import.meta.env.DEV ? await tryConnectFoundry() : { connected: false };

  if (import.meta.env.DEV) {
    (window as unknown as { __beaverBabylon: unknown }).__beaverBabylon = {
      sb,
      world,
      player,
      felling,
      hauling,
      damming,
      digging,
      ui,
      foundry,
      callFoundryTool,
    };
  }

  window.addEventListener("beforeunload", () => {
    ui.destroy();
  });

  window.addEventListener("beforeunload", () => {
    player.destroy();
  });
})().catch((err) => console.error("world spawn failed:", err));

window.addEventListener("resize", () => sb.resize());
window.addEventListener("beforeunload", () => sb.destroy());
