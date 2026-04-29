// Cylinder collider registry. Pure math, engine-agnostic — straight port from
// src/scene/collision.ts. See BG-003 for cylinder-resolve test cases.

export interface CylinderCollider {
  id: string;
  cx: number;
  cz: number;
  radius: number;
}

export interface ColliderRegistry {
  add(c: CylinderCollider): void;
  remove(id: string): void;
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
      for (const c of items.values()) {
        const dx = cx - c.cx;
        const dz = cz - c.cz;
        const minDist = c.radius + playerRadius;
        const distSq = dx * dx + dz * dz;
        if (distSq >= minDist * minDist) continue;
        const dist = Math.sqrt(distSq);
        if (dist < 1e-6) {
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
