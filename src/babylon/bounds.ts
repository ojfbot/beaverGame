import { Vector3 } from "@babylonjs/core/Maths/math.vector";

// Pure functions for keeping the player on the terrain patch. Ported from
// src/scene/bounds.ts (Three.js) without behavioral change. See BG-002.

export interface BoundsOpts {
  halfExtent: number;
  hardMargin: number;
  softMargin: number;
}

export function applySoftBound(position: Vector3, opts: BoundsOpts): Vector3 {
  const out = position.clone();
  const hard = opts.halfExtent - opts.hardMargin;
  const soft = opts.halfExtent - opts.softMargin;

  for (const axis of ["x", "z"] as const) {
    const v = out[axis];
    const mag = Math.abs(v);
    if (mag <= soft) continue;
    if (mag >= hard) {
      out[axis] = Math.sign(v) * hard;
      continue;
    }
    const t = (mag - soft) / (hard - soft);
    const resistance = 1 - t * t * 0.6;
    const pulled = soft + (mag - soft) * resistance;
    out[axis] = Math.sign(v) * pulled;
  }
  return out;
}

export function isInBounds(position: Vector3, opts: BoundsOpts): boolean {
  const soft = opts.halfExtent - opts.softMargin;
  return Math.abs(position.x) <= soft && Math.abs(position.z) <= soft;
}
