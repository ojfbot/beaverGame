import * as THREE from "three";

export type TickFn = (dt: number, camera: THREE.PerspectiveCamera) => void;

// Lifecycle pattern adapted from /Users/yuri/ojfbot/landing/src/components/Hero/shader.ts
// (start / resize / destroy with explicit RAF cancellation). See ADR-0001.
export class SceneBootstrap {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private frameId = 0;
  private destroyed = false;
  private clock = new THREE.Clock();
  private tickFn: TickFn | null = null;

  constructor(private canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio;
    this.renderer.setPixelRatio(Math.min(dpr, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    // Stylized unlit rendering: keep linear→sRGB but skip tone mapping. ACES
    // is for HDR PBR; with our flat-shaded MeshBasicMaterial(vertexColors)
    // it washes saturated tones to near-white.
    this.renderer.toneMapping = THREE.NoToneMapping;

    this.scene.background = new THREE.Color("#d8e4d2");
    this.scene.fog = new THREE.FogExp2("#d8e4d2", 0.020);

    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 200);
    // Initial pose mirrors player.ts cameraOffset (behind the spawned beaver).
    this.camera.position.set(0, 2.4, 4.5);
    this.camera.lookAt(0, 0.7, 0);
  }

  start(): void {
    this.resize();
    this.loop();
  }

  resize(): void {
    const { canvas, renderer, camera } = this;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  add(object: THREE.Object3D): void {
    this.scene.add(object);
  }

  setEnvironment(env: THREE.Texture | null): void {
    this.scene.environment = env;
  }

  setTick(fn: TickFn | null): void {
    this.tickFn = fn;
  }

  get rendererInstance(): THREE.WebGLRenderer {
    return this.renderer;
  }

  private loop = (): void => {
    if (this.destroyed) return;
    const dt = Math.min(this.clock.getDelta(), 0.05); // clamp big tab-switch deltas
    if (this.tickFn) this.tickFn(dt, this.camera);
    this.renderer.render(this.scene, this.camera);
    this.frameId = requestAnimationFrame(this.loop);
  };

  destroy(): void {
    this.destroyed = true;
    if (typeof cancelAnimationFrame !== "undefined") cancelAnimationFrame(this.frameId);
    this.renderer.dispose();
  }
}
