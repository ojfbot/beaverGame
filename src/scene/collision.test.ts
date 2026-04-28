import { describe, it, expect } from "vitest";
import { createColliderRegistry } from "./collision";

describe("colliderRegistry", () => {
  it("returns input unchanged when no colliders registered", () => {
    const r = createColliderRegistry();
    const out = r.resolve(3, -2, 0.3);
    expect(out.x).toBe(3);
    expect(out.z).toBe(-2);
  });

  it("returns input unchanged when player is outside all colliders", () => {
    const r = createColliderRegistry();
    r.add({ id: "tree-1", cx: 0, cz: 0, radius: 0.15 });
    const out = r.resolve(5, 0, 0.3);
    expect(out.x).toBe(5);
    expect(out.z).toBe(0);
  });

  it("pushes player out tangentially when inside a single collider", () => {
    const r = createColliderRegistry();
    r.add({ id: "tree-1", cx: 0, cz: 0, radius: 0.15 });
    // Player at (0.1, 0) — inside the 0.45u combined radius (tree 0.15 + player 0.30).
    const out = r.resolve(0.1, 0, 0.3);
    // Should be pushed to (0.45, 0) along +X
    expect(out.x).toBeCloseTo(0.45, 5);
    expect(out.z).toBeCloseTo(0, 5);
  });

  it("preserves direction of approach when pushing out", () => {
    const r = createColliderRegistry();
    r.add({ id: "tree-1", cx: 0, cz: 0, radius: 0.2 });
    // Player coming in from the +X +Z diagonal, slightly inside
    const out = r.resolve(0.2, 0.2, 0.3);
    // Combined radius 0.5; output should be (0.5/√2, 0.5/√2) ≈ (0.353, 0.353)
    expect(out.x).toBeCloseTo(0.5 / Math.SQRT2, 4);
    expect(out.z).toBeCloseTo(0.5 / Math.SQRT2, 4);
  });

  it("handles multiple colliders in one pass", () => {
    const r = createColliderRegistry();
    r.add({ id: "a", cx: 0, cz: 0, radius: 0.2 });
    r.add({ id: "b", cx: 1, cz: 0, radius: 0.2 });
    // Player between them at 0.5 — outside both (combined 0.5 each), unchanged
    expect(r.resolve(0.5, 0, 0.2).x).toBe(0.5);
  });

  it("dead-centre push is deterministic (along +X)", () => {
    const r = createColliderRegistry();
    r.add({ id: "tree-1", cx: 5, cz: 5, radius: 0.2 });
    const out = r.resolve(5, 5, 0.3);
    expect(out.x).toBeCloseTo(5.5);
    expect(out.z).toBe(5);
  });

  it("remove() takes a collider out of the resolve set", () => {
    const r = createColliderRegistry();
    r.add({ id: "tree-1", cx: 0, cz: 0, radius: 0.15 });
    r.remove("tree-1");
    const out = r.resolve(0, 0, 0.3);
    expect(out.x).toBe(0);
    expect(out.z).toBe(0);
  });
});
