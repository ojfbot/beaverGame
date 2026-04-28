import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { applySoftBound, isInBounds, type BoundsOpts } from "./bounds";

const opts: BoundsOpts = {
  halfExtent: 20,
  hardMargin: 0.6,        // hard clamp at ±19.4
  softMargin: 2.0,        // soft pull begins at ±18.0
};

describe("applySoftBound", () => {
  it("leaves an interior position untouched", () => {
    const p = new THREE.Vector3(1, 0, -3);
    const r = applySoftBound(p, opts);
    expect(r.x).toBe(1);
    expect(r.z).toBe(-3);
    expect(p.x).toBe(1); // input not mutated
  });

  it("hard-clamps past the hard margin in either direction", () => {
    const r1 = applySoftBound(new THREE.Vector3(50, 0, 0), opts);
    expect(r1.x).toBeCloseTo(19.4);
    const r2 = applySoftBound(new THREE.Vector3(-50, 0, 0), opts);
    expect(r2.x).toBeCloseTo(-19.4);
    const r3 = applySoftBound(new THREE.Vector3(0, 0, 50), opts);
    expect(r3.z).toBeCloseTo(19.4);
  });

  it("softly pulls back inside the soft margin", () => {
    const at18_5 = applySoftBound(new THREE.Vector3(18.5, 0, 0), opts);
    expect(at18_5.x).toBeLessThan(18.5);
    expect(at18_5.x).toBeGreaterThan(18.0);

    // Closer to the hard edge — should be pulled back more aggressively
    const at19_3 = applySoftBound(new THREE.Vector3(19.3, 0, 0), opts);
    expect(at19_3.x).toBeLessThan(19.3);
    expect(at19_3.x).toBeGreaterThanOrEqual(18.0);
  });

  it("clamps both axes independently", () => {
    const r = applySoftBound(new THREE.Vector3(50, 0, -50), opts);
    expect(r.x).toBeCloseTo(19.4);
    expect(r.z).toBeCloseTo(-19.4);
  });

  it("preserves Y (terrain height is sampled separately)", () => {
    const r = applySoftBound(new THREE.Vector3(50, 7.7, 50), opts);
    expect(r.y).toBe(7.7);
  });
});

describe("isInBounds", () => {
  it("true inside the soft region", () => {
    expect(isInBounds(new THREE.Vector3(0, 0, 0), opts)).toBe(true);
    expect(isInBounds(new THREE.Vector3(17.9, 0, -17.9), opts)).toBe(true);
  });
  it("false at the soft boundary or beyond", () => {
    expect(isInBounds(new THREE.Vector3(18.5, 0, 0), opts)).toBe(false);
    expect(isInBounds(new THREE.Vector3(0, 0, 25), opts)).toBe(false);
  });
});
