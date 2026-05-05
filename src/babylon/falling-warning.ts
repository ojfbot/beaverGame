import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import type { Terrain } from "./terrain";

// Fall warning: a flat red cone-wedge on the ground (apex at the trunk base,
// fanning out along the fall direction up to TRUNK_LENGTH) plus N concentric
// radar arcs that pulse outward through the wedge. The wedge tip half-width
// matches the strike half-width in felling.ts so the warning area = the hit
// area.

const TRUNK_LENGTH = 3.0;
const STRIKE_HALF_WIDTH = 0.7;            // matches felling.ts STRIKE_HALF_WIDTH
const WEDGE_HALF_ANGLE = Math.atan(STRIKE_HALF_WIDTH / TRUNK_LENGTH); // ~13°
const N_RINGS = 4;
const RING_BAND_THICKNESS = 0.10;
const PULSE_PERIOD_MS = 750;
const GROUND_OFFSET = 0.05;

interface WarningEntry {
  group: TransformNode;
  wedge: Mesh;
  rings: Mesh[];
  startedAt: number;
  durationMs: number;
}

export interface FallWarningHandles {
  show(treeId: string, base: Vector3, fallDir: Vector3, durationS: number): void;
  hide(treeId: string): void;
  update(dt: number): void;
  destroy(): void;
}

// Triangle fan from apex (0,0,0) outward along +Z, between angles ±halfAngle.
function buildWedgeMesh(scene: Scene, name: string): Mesh {
  const segments = 14;
  const positions: number[] = [0, 0, 0];
  const indices: number[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const angle = -WEDGE_HALF_ANGLE + 2 * WEDGE_HALF_ANGLE * t;
    positions.push(Math.sin(angle) * TRUNK_LENGTH, 0, Math.cos(angle) * TRUNK_LENGTH);
  }
  // Wind so the +Y face (top) is the visible front face.
  for (let i = 1; i <= segments; i++) indices.push(0, i + 1, i);
  const normals: number[] = [];
  VertexData.ComputeNormals(positions, indices, normals);
  const vd = new VertexData();
  vd.positions = positions;
  vd.indices = indices;
  vd.normals = normals;
  const m = new Mesh(name, scene);
  vd.applyToMesh(m);
  return m;
}

// Thin arc band between radii [r-dr/2, r+dr/2], spanning ±WEDGE_HALF_ANGLE.
function buildArcMesh(scene: Scene, name: string, radius: number, thickness: number): Mesh {
  const segments = 14;
  const positions: number[] = [];
  const indices: number[] = [];
  const inner = radius - thickness / 2;
  const outer = radius + thickness / 2;
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const angle = -WEDGE_HALF_ANGLE + 2 * WEDGE_HALF_ANGLE * t;
    positions.push(Math.sin(angle) * inner, 0, Math.cos(angle) * inner);
    positions.push(Math.sin(angle) * outer, 0, Math.cos(angle) * outer);
  }
  for (let i = 0; i < segments; i++) {
    const a = i * 2;
    indices.push(a, a + 2, a + 1);   // inner-inner-outer (wound for +Y up)
    indices.push(a + 1, a + 2, a + 3);
  }
  const normals: number[] = [];
  VertexData.ComputeNormals(positions, indices, normals);
  const vd = new VertexData();
  vd.positions = positions;
  vd.indices = indices;
  vd.normals = normals;
  const m = new Mesh(name, scene);
  vd.applyToMesh(m);
  return m;
}

export function createFallWarning(scene: Scene, terrain: Terrain): FallWarningHandles {
  const entries = new Map<string, WarningEntry>();

  // Shared materials. Ring material is brighter so the pulses pop against the
  // base wedge.
  const wedgeMat = new StandardMaterial("fall-wedge-mat", scene);
  wedgeMat.diffuseColor = new Color3(0.95, 0.20, 0.18);
  wedgeMat.emissiveColor = new Color3(0.7, 0.05, 0.05);
  wedgeMat.specularColor = new Color3(0, 0, 0);
  wedgeMat.disableLighting = true;
  wedgeMat.alpha = 0.45;
  wedgeMat.backFaceCulling = false;

  const ringMat = new StandardMaterial("fall-ring-mat", scene);
  ringMat.diffuseColor = new Color3(1.0, 0.95, 0.85);
  ringMat.emissiveColor = new Color3(1.0, 0.85, 0.55);
  ringMat.specularColor = new Color3(0, 0, 0);
  ringMat.disableLighting = true;
  ringMat.alpha = 0.85;
  ringMat.backFaceCulling = false;

  function show(treeId: string, base: Vector3, fallDir: Vector3, durationS: number): void {
    if (entries.has(treeId)) hide(treeId);

    const group = new TransformNode(`fall-warn-${treeId}`, scene);
    group.position.set(base.x, terrain.heightAt(base.x, base.z) + GROUND_OFFSET, base.z);
    // Local +Z = fall direction. Rotate Y by atan2(dir.x, dir.z).
    group.rotation.y = Math.atan2(fallDir.x, fallDir.z);

    const wedge = buildWedgeMesh(scene, `fall-wedge-${treeId}`);
    wedge.material = wedgeMat.clone(`fall-wedge-mat-${treeId}`);
    wedge.parent = group;

    const rings: Mesh[] = [];
    for (let i = 0; i < N_RINGS; i++) {
      const r = TRUNK_LENGTH * ((i + 1) / N_RINGS);
      const ring = buildArcMesh(scene, `fall-ring-${treeId}-${i}`, r, RING_BAND_THICKNESS);
      ring.material = ringMat.clone(`fall-ring-mat-${treeId}-${i}`);
      ring.parent = group;
      rings.push(ring);
    }

    entries.set(treeId, { group, wedge, rings, startedAt: performance.now(), durationMs: durationS * 1000 });
  }

  function hide(treeId: string): void {
    const e = entries.get(treeId);
    if (!e) return;
    e.wedge.material?.dispose();
    e.wedge.dispose();
    for (const r of e.rings) {
      r.material?.dispose();
      r.dispose();
    }
    e.group.dispose();
    entries.delete(treeId);
  }

  function update(_dt: number): void {
    const now = performance.now();
    const omega = (Math.PI * 2) / PULSE_PERIOD_MS;
    for (const [, e] of entries) {
      const t = Math.min(1, (now - e.startedAt) / e.durationMs);
      // Wedge alpha rises with fall progress so the danger reads more urgent.
      const wm = e.wedge.material as StandardMaterial | null;
      if (wm) wm.alpha = 0.30 + t * 0.40;
      // Outward radar sweep: each ring lags by 2π/N in phase, so peaks travel
      // from inner to outer ring.
      for (let i = 0; i < e.rings.length; i++) {
        const phase = now * omega - i * ((Math.PI * 2) / N_RINGS);
        const v = Math.sin(phase);
        const a = v <= 0 ? 0 : Math.pow(v, 1.4) * 0.95;
        const m = e.rings[i]!.material as StandardMaterial | null;
        if (m) m.alpha = a;
      }
    }
  }

  function destroy(): void {
    for (const id of Array.from(entries.keys())) hide(id);
    wedgeMat.dispose();
    ringMat.dispose();
  }

  return { show, hide, update, destroy };
}
