import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { spawnLog, LOG_COLLIDER_RADIUS } from "./log";

describe("spawnLog", () => {
  it("assigns a non-empty id that is unique across spawns", () => {
    const scene = new THREE.Scene();
    const ids = new Set<string>();
    for (let i = 0; i < 8; i++) {
      const log = spawnLog(scene, new THREE.Vector3(i, 0, 0), 0);
      expect(log.id).toMatch(/^log-\d+$/);
      ids.add(log.id);
    }
    expect(ids.size).toBe(8);
  });

  it("starts in `ground` status with the given yaw", () => {
    const scene = new THREE.Scene();
    const log = spawnLog(scene, new THREE.Vector3(1, 2, 3), Math.PI / 4);
    expect(log.status).toBe("ground");
    expect(log.yaw).toBeCloseTo(Math.PI / 4, 6);
    // Sits 0.10u above its spawn position so the cylinder rests on the ground.
    expect(log.mesh.position.y).toBeCloseTo(2.10, 6);
    // Snapshot of `groundedPosition` is the spawn position, untouched.
    expect(log.groundedPosition.toArray()).toEqual([1, 2, 3]);
  });

  it("exposes a stable collider radius constant", () => {
    // The felling and hauling systems both register/re-add the same
    // collider radius. Pin it so they can't drift independently.
    expect(LOG_COLLIDER_RADIUS).toBeGreaterThan(0);
    expect(LOG_COLLIDER_RADIUS).toBeLessThan(1.0);
  });
});
