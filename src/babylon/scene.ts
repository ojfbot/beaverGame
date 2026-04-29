import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";

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

    this.scene.clearColor = new Color4(0.847, 0.894, 0.823, 1);
    this.scene.fogMode = Scene.FOGMODE_EXP2;
    this.scene.fogDensity = 0.020;
    this.scene.fogColor = new Color3(0.847, 0.894, 0.823);

    // ArcRotateCamera with lockedTarget = beaver (set in player.ts after the
    // beaver loads). Touchpad/mouse drag orbits; wheel zooms. Keys do not
    // affect the camera at all — they're owned by player.ts for the beaver.
    // Match the legacy Three.js POV: camera at offset (0, 2.4, 4.5) from
    // beaver target (0, 0.7, 0) → height 1.7 above target at horizontal
    // distance 4.5 → angle ~21° below horizontal. ArcRotate equivalents:
    //   alpha = π/2 puts camera on +Z axis (beaver faces -Z, so this is
    //     "behind" the beaver at spawn). Updated each frame in player.ts
    //     to track beaver yaw — restores legacy yaw-locked third-person
    //     follow (A/D rotate the world around the beaver).
    //   beta = π/2.6 ≈ 69° from +Y up = 21° below horizontal (matches
    //     legacy 1.7 vertical / 4.5 horizontal offset).
    //   radius = sqrt(4.5² + 1.7²) ≈ 4.81.
    this.camera = new ArcRotateCamera(
      "camera",
      Math.PI / 2,
      Math.PI / 2.6,
      4.8,
      new Vector3(0, 0.7, 0),
      this.scene,
    );
    this.camera.fov = (50 * Math.PI) / 180;
    this.camera.minZ = 0.1;
    this.camera.maxZ = 200;
    this.camera.lowerRadiusLimit = 3;
    this.camera.upperRadiusLimit = 14;
    this.camera.lowerBetaLimit = Math.PI / 6;       // don't go directly above
    this.camera.upperBetaLimit = Math.PI / 2.05;    // prevent flipping under terrain
    this.camera.wheelDeltaPercentage = 0.01;
    this.camera.attachControl(canvas, true);
    // Remove the camera's keyboard input — Babylon's ArcRotateCamera by
    // default binds arrow keys to keysLeft/Right/Up/Down for orbit, which
    // races with player.ts's beaver-turn handler. Keys are reserved for the
    // beaver; touchpad/mouse drag + scroll-wheel still orbit the camera.
    this.camera.inputs.removeByType("ArcRotateCameraKeyboardMoveInput");

    // Hemispheric light — legacy Three.js was THREE.HemisphereLight(0xffe9c2, 0x4d6a3a, 0.55).
    // Sky colour warms ambient; ground colour adds a mossy bounce.
    const hemi = new HemisphericLight("hemi", new Vector3(0, 1, 0), this.scene);
    hemi.intensity = 0.55;
    hemi.diffuse = new Color3(1, 0.914, 0.761);    // #ffe9c2
    hemi.groundColor = new Color3(0.302, 0.416, 0.227);  // #4d6a3a

    // Directional sun — legacy at position (15, 22, 8). Babylon uses a
    // direction vector, so negate.
    const sun = new DirectionalLight("sun", new Vector3(-15, -22, -8).normalize(), this.scene);
    sun.intensity = 0.95;
    sun.diffuse = new Color3(1, 0.95, 0.80);
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
