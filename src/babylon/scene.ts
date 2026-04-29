import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";

export type TickFn = (dt: number, scene: Scene) => void;

export class BabylonScene {
  readonly engine: Engine;
  readonly scene: Scene;
  readonly camera: UniversalCamera;
  private tickFn: TickFn | null = null;
  private destroyed = false;

  constructor(private canvas: HTMLCanvasElement) {
    this.engine = new Engine(canvas, true, {
      preserveDrawingBuffer: true,
      stencil: true,
    });
    this.scene = new Scene(this.engine);

    this.scene.clearColor = new Color4(0.847, 0.894, 0.823, 1);
    this.scene.fogMode = Scene.FOGMODE_EXP2;
    this.scene.fogDensity = 0.020;
    this.scene.fogColor = new Color3(0.847, 0.894, 0.823);

    // UniversalCamera mirrors Three.js PerspectiveCamera semantics: position +
    // setTarget. player.ts manually drives this each frame. No attachControl —
    // input is handled by the player's WASD bindings.
    this.camera = new UniversalCamera(
      "camera",
      new Vector3(0, 2.4, 4.5),
      this.scene,
    );
    this.camera.fov = (50 * Math.PI) / 180;
    this.camera.minZ = 0.1;
    this.camera.maxZ = 200;
    this.camera.setTarget(new Vector3(0, 0.7, 0));

    const hemi = new HemisphericLight("hemi", new Vector3(0, 1, 0), this.scene);
    hemi.intensity = 1.0;
    hemi.diffuse = new Color3(1, 0.98, 0.92);
    hemi.groundColor = new Color3(0.6, 0.65, 0.55);
  }

  start(): void {
    this.engine.runRenderLoop(() => {
      if (this.destroyed) return;
      const dt = Math.min(this.engine.getDeltaTime() / 1000, 0.05);
      if (this.tickFn) this.tickFn(dt, this.scene);
      this.scene.render();
    });
  }

  resize(): void {
    this.engine.resize();
  }

  setTick(fn: TickFn | null): void {
    this.tickFn = fn;
  }

  destroy(): void {
    this.destroyed = true;
    this.engine.stopRenderLoop();
    this.scene.dispose();
    this.engine.dispose();
  }
}
