import { BabylonScene } from "./scene";
import { loadWorld } from "./world";
import { spawnPlayer } from "./player";
import { tryConnectFoundry, callFoundryTool } from "./foundry-client";

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

  sb.setTick((dt) => {
    player.update(dt);
  });

  // Best-effort connect to asset-foundry MCP (ADR-0010 HTTP+SSE on :3036).
  // Game runs whether or not the foundry is reachable.
  const foundry = import.meta.env.DEV ? await tryConnectFoundry() : { connected: false };

  if (import.meta.env.DEV) {
    (window as unknown as { __beaverBabylon: unknown }).__beaverBabylon = {
      sb,
      world,
      player,
      foundry,
      callFoundryTool,
    };
  }

  window.addEventListener("beforeunload", () => {
    player.destroy();
  });
})().catch((err) => console.error("world spawn failed:", err));

window.addEventListener("resize", () => sb.resize());
window.addEventListener("beforeunload", () => sb.destroy());
