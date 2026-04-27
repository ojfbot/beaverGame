import { SceneBootstrap } from "./scene/bootstrap";
import { applyHdriEnvironment } from "./scene/lighting";
import { composeWorld } from "./scene/world";
import { spawnPlayer } from "./scene/player";

const canvas = document.getElementById("game") as HTMLCanvasElement | null;
if (!canvas) throw new Error("missing #game canvas");

const scene = new SceneBootstrap(canvas);
scene.start();

applyHdriEnvironment(scene, "/assets/hdri/dawn-meadow.hdr").catch(() => {});

(async () => {
  const world = await composeWorld(scene.scene);
  const player = await spawnPlayer(scene.scene);
  scene.setTick(player.update);
  // Debug hatch: lets the snap script introspect scene state without polling.
  (window as unknown as { __beaver: unknown }).__beaver = { scene, player, world };
  window.addEventListener("beforeunload", () => player.destroy());
})().catch((err) => console.error("world spawn failed:", err));

window.addEventListener("resize", () => scene.resize());
window.addEventListener("beforeunload", () => scene.destroy());
