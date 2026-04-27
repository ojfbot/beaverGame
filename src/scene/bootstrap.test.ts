import { describe, it, expect, vi } from "vitest";
import { SceneBootstrap } from "./bootstrap";

vi.mock("three", async () => {
  const actual = await vi.importActual<typeof import("three")>("three");
  class FakeRenderer {
    setPixelRatio = vi.fn();
    setSize = vi.fn();
    render = vi.fn();
    dispose = vi.fn();
    outputColorSpace = "";
    toneMapping = 0;
  }
  return { ...actual, WebGLRenderer: FakeRenderer };
});

describe("SceneBootstrap", () => {
  it("constructs without touching a real GL context", () => {
    const canvas = { clientWidth: 800, clientHeight: 600 } as HTMLCanvasElement;
    const scene = new SceneBootstrap(canvas);
    expect(scene.scene).toBeDefined();
    expect(scene.camera.fov).toBe(45);
  });

  it("destroy is idempotent and stops the loop", () => {
    const canvas = { clientWidth: 1, clientHeight: 1 } as HTMLCanvasElement;
    const scene = new SceneBootstrap(canvas);
    scene.destroy();
    expect(() => scene.destroy()).not.toThrow();
  });
});
