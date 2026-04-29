import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";

export type TickFn = (dt: number, scene: Scene) => void;

export class BabylonScene {
  readonly engine: Engine;
  readonly scene: Scene;
  readonly camera: ArcRotateCamera;
  private tickFn: TickFn | null = null;
  private destroyed = false;

  constructor(private canvas: HTMLCanvasElement) {
    this.engine = new Engine(canvas, true, {
      preserveDrawingBuffer: true,
      stencil: true,
    });
    this.scene = new Scene(this.engine);

    // Cozy palette: same #d8e4d2 background + fog as Three.js bootstrap
    this.scene.clearColor = new Color4(0.847, 0.894, 0.823, 1);
    this.scene.fogMode = Scene.FOGMODE_EXP2;
    this.scene.fogDensity = 0.020;
    this.scene.fogColor = new Color3(0.847, 0.894, 0.823);

    // Default camera: orbit around origin so we can see the world.
    // Will be replaced by a follow-camera once player.ts ports.
    this.camera = new ArcRotateCamera(
      "camera",
      -Math.PI / 2,
      Math.PI / 3.2,
      12,
      new Vector3(0, 0.5, 0),
      this.scene,
    );
    this.camera.attachControl(canvas, true);
    this.camera.lowerRadiusLimit = 4;
    this.camera.upperRadiusLimit = 30;
    this.camera.wheelDeltaPercentage = 0.01;

    // Hemispheric light approximating overcast cozy meadow.
    // Sufficient until a port of lighting.ts replaces with HDRI / clustered lights.
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
