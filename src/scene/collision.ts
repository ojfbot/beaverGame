import * as THREE from "three";

// Cylinder colliders. Cheap, deterministic, no physics engine. The world
// registers each tree trunk and (after fell) each stump as a vertical cylinder
// with (centerXZ, radius). The player resolves against them every frame: if
// inside one, push out tangentially to the cylinder's surface.
//
// Pure resolve function — no Three.js scene reads, no time-dependent state.
// Tested in collision.test.ts.

export interface CylinderCollider {
  // ID lets the world swap colliders as tree state changes
  // (standing trunk → fallen → stump). Comparing by reference is also fine
  // but ids let test cases distinguish.
  id: string;
  cx: number;
  cz: number;
  radius: number;
}

export interface ColliderRegistry {
  add(c: CylinderCollider): void;
  remove(id: string): void;
  // Returns the corrected XZ given an attempted position. The player's Y is
  // preserved by the caller (terrain.heightAt sample), so we only need to
  // shuffle X and Z.
  resolve(x: number, z: number, playerRadius: number): { x: number; z: number };
  list(): readonly CylinderCollider[];
}

export function createColliderRegistry(): ColliderRegistry {
  const items = new Map<string, CylinderCollider>();
  return {
    add(c) { items.set(c.id, c); },
    remove(id) { items.delete(id); },
    list() { return Array.from(items.values()); },
    resolve(x, z, playerRadius) {
      let cx = x;
      let cz = z;
      // Single pass — for sparse colliders with reasonable spacing, this is
      // enough. If two colliders overlap (which shouldn't happen for trees),
      // the second pass would matter; we accept that small artifact as
      // negligible for the cozy register.
      for (const c of items.values()) {
        cx = (cx as number);
        cz = (cz as number);
        const dx = cx - c.cx;
        const dz = cz - c.cz;
        const minDist = c.radius + playerRadius;
        const distSq = dx * dx + dz * dz;
        if (distSq >= minDist * minDist) continue;
        const dist = Math.sqrt(distSq);
        if (dist < 1e-6) {
          // Player exactly inside the trunk centre — push along arbitrary
          // axis. Pick +X so the resolve is deterministic.
          cx = c.cx + minDist;
          continue;
        }
        const k = minDist / dist;
        cx = c.cx + dx * k;
        cz = c.cz + dz * k;
      }
      return { x: cx, z: cz };
    },
  };
}
