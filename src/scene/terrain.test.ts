import { describe, it, expect } from "vitest";
import { Terrain } from "./terrain";

// Cell-corner labels used in heightAt:
//   a = (ix, iz),     b = (ix+1, iz)
//   c = (ix, iz+1),   d = (ix+1, iz+1)
//
// THREE.PlaneGeometry splits each cell along the c↔b diagonal
// (i.e. the line tx + tz = 1 in fractional cell coords). T1 covers
// (a, c, b) where tx + tz < 1; T2 covers (c, d, b) elsewhere.
//
// `heightAt` must:
//   1. return exactly the corner value at each corner (so creek/dam-site
//      grid lookups stay byte-identical)
//   2. evaluate the actual triangle plane interior to a cell (NOT a bilinear
//      blend — that's what dropped the player below the visible surface in
//      concave cells)
//   3. agree on the diagonal so the surface is continuous

// Inject a synthetic heightfield: 2x2 cell, four corners at chosen heights.
// The Terrain constructor builds its own noise field, so we patch
// `(t as any).heights` after construction. The grid is (segments+1)² big.
function withHeights(t: Terrain, h: number[]): Terrain {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (t as any).heights = new Float32Array(h);
  return t;
}

describe("Terrain.heightAt — triangle-exact sampling", () => {
  it("returns the corner value at each cell corner", () => {
    // 1x1-cell terrain: size=1, segments=1 → 2x2 grid of corners.
    // Heights: a=0, b=2, c=3, d=10.
    const t = withHeights(
      new Terrain({ size: 1, segments: 1, amplitude: 1, seed: 1 }),
      [0, 2, 3, 10]
    );
    // halfExtent = 0.5; corner world coords are (-0.5,-0.5) (-0.5,+0.5) etc.
    expect(t.heightAt(-0.5, -0.5)).toBeCloseTo(0, 6); // a
    expect(t.heightAt(+0.5, -0.5)).toBeCloseTo(2, 6); // b
    expect(t.heightAt(-0.5, +0.5)).toBeCloseTo(3, 6); // c
    expect(t.heightAt(+0.5, +0.5)).toBeCloseTo(10, 6); // d
  });

  it("evaluates triangle planes (NOT bilinear) inside a cell", () => {
    // a=0, b=1, c=1, d=1. Bilinear at center would give 0.75; the visible
    // surface at center sits on the (c,d,b) triangle plane, where height = 1.
    const t = withHeights(
      new Terrain({ size: 1, segments: 1, amplitude: 1, seed: 1 }),
      [0, 1, 1, 1]
    );
    // center is on the c↔b diagonal (tx+tz = 1) — both triangles agree at
    // exactly 1 there (linear interp between c=1 and b=1).
    expect(t.heightAt(0, 0)).toBeCloseTo(1, 6);
    // T1 interior point: (tx=0.25, tz=0.25) → world XZ near the a corner.
    // Plane T1 (a,b,c) at (0.25, 0.25) = a + (b-a)*0.25 + (c-a)*0.25 = 0.5.
    expect(t.heightAt(-0.25, -0.25)).toBeCloseTo(0.5, 6);
    // T2 interior point: (tx=0.75, tz=0.75) → on the (c,d,b) plane = 1.
    expect(t.heightAt(0.25, 0.25)).toBeCloseTo(1, 6);
  });

  it("is continuous across the cell diagonal (T1 == T2 at tx+tz = 1)", () => {
    // Use asymmetric heights so the two formulas would diverge if either
    // were wrong. Diagonal value at (tx, 1-tx) is c + (b-c)*tx.
    const t = withHeights(
      new Terrain({ size: 1, segments: 1, amplitude: 1, seed: 1 }),
      [0, 7, 3, 11]
    );
    // Sample two points either side of the diagonal at fractional (0.4, 0.6)
    // (tx+tz exactly 1) — both triangles touch this point.
    const eps = 1e-4;
    const tx = 0.4;
    const tz = 0.6;
    // worldX = -0.5 + tx, worldZ = -0.5 + tz
    const wx = -0.5 + tx;
    const wz = -0.5 + tz;
    const onDiag = t.heightAt(wx, wz);
    const expected = 3 + (7 - 3) * tx; // c + (b-c)*tx = 3 + 1.6 = 4.6
    expect(onDiag).toBeCloseTo(expected, 4);
    // Slightly into T1 and into T2 — values should hug `expected` from both sides.
    expect(t.heightAt(wx - eps, wz - eps)).toBeCloseTo(expected, 2);
    expect(t.heightAt(wx + eps, wz + eps)).toBeCloseTo(expected, 2);
  });

  it("returns a constant on a flat heightfield", () => {
    const t = withHeights(
      new Terrain({ size: 1, segments: 1, amplitude: 1, seed: 1 }),
      [2.5, 2.5, 2.5, 2.5]
    );
    expect(t.heightAt(0, 0)).toBeCloseTo(2.5, 6);
    expect(t.heightAt(-0.3, 0.4)).toBeCloseTo(2.5, 6);
    expect(t.heightAt(0.49, -0.49)).toBeCloseTo(2.5, 6);
  });
});
