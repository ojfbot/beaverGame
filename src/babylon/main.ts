import { BabylonScene } from "./scene";
import { loadWorld } from "./world";

const canvas = document.getElementById("game") as HTMLCanvasElement | null;
if (!canvas) throw new Error("missing #game canvas");

const sb = new BabylonScene(canvas);
sb.start();

loadWorld(sb.scene).then((world) => {
  if (import.meta.env.DEV) {
    (window as unknown as { __beaverBabylon: unknown }).__beaverBabylon = { sb, world };
  }
}).catch((err) => console.error("world load failed:", err));

window.addEventListener("resize", () => sb.resize());
window.addEventListener("beforeunload", () => sb.destroy());
