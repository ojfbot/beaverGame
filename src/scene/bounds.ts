import * as THREE from "three";

// Pure functions for keeping the player on the terrain patch. Extracted so
// they're testable in isolation (vitest in node, no Three.js scene needed
// beyond Vector3 math). See BG-002.

export interface BoundsOpts {
  halfExtent: number;   // distance from origin to nearest edge (square patch)
  hardMargin: number;   // never let the player past halfExtent - hardMargin
  softMargin: number;   // begin pulling back inside this margin from hardMargin
}

// Soft snap-back: as the player approaches the edge they get gently pulled
// back toward centre, instead of slamming into a wall. Outside hardMargin it
// becomes a hard clamp (we never let the player off the patch).
//
//   |--- soft pull region ---|=hard clamp=|
//                            ^               ^
//                  halfExtent - softMargin   halfExtent - hardMargin
//
// The pull strength scales linearly with how far into the soft region the
// player is. Returns the corrected position (does not mutate the input).
export function applySoftBound(
  position: THREE.Vector3,
  opts: BoundsOpts
): THREE.Vector3 {
  const out = position.clone();
  const hard = opts.halfExtent - opts.hardMargin;
  const soft = opts.halfExtent - opts.softMargin;

  for (const axis of ["x", "z"] as const) {
    const v = out[axis];
    const mag = Math.abs(v);
    if (mag <= soft) continue;          // inside the cozy zone — no force
    if (mag >= hard) {
      // Hard clamp — never beyond the patch
      out[axis] = Math.sign(v) * hard;
      continue;
    }
    // Soft pull — at mag=soft, no resistance (pulled=mag); resistance grows
    // quadratically so by mag near hard, the player is gently restrained.
    const t = (mag - soft) / (hard - soft); // 0 at soft, 1 at hard
    const resistance = 1 - t * t * 0.6;     // 1 at t=0, ~0.4 at t=1
    const pulled = soft + (mag - soft) * resistance;
    out[axis] = Math.sign(v) * pulled;
  }
  return out;
}

// True if the position is anywhere outside the soft region.
export function isInBounds(position: THREE.Vector3, opts: BoundsOpts): boolean {
  const soft = opts.halfExtent - opts.softMargin;
  return Math.abs(position.x) <= soft && Math.abs(position.z) <= soft;
}
