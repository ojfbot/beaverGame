import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { enforceVertexColorMaterials } from "./materials";

// Pooled wood-chip particles. Babylon analog of the legacy three.js system —
// chips spawn at the gnaw point, get an outward XZ velocity + upward kick,
// fall under gravity, fade in the last 30% of life. Pool is fixed so we don't
// allocate during gameplay.

const MAX_CHIPS = 96;
const GRAVITY = -6.0;
const LIFETIME = 0.9;
const CHIP_COLOR = new Color3(200 / 255, 160 / 255, 106 / 255);    // #c8a06a
const CHIP_DARK = new Color3(139 / 255, 106 / 255, 62 / 255);      // #8b6a3e

interface ChipState {
  active: boolean;
  age: number;
  vx: number;
  vy: number;
  vz: number;
  spinX: number;
  spinY: number;
  spinZ: number;
}

export interface ChipsHandles {
  group: TransformNode;
  emit(at: Vector3, count?: number): void;
  update(dt: number): void;
  destroy(): void;
}

function buildChipMesh(scene: Scene, idx: number): Mesh {
  const positions = [
    -0.03, 0, 0,
     0.03, 0, 0.012,
     0, 0, 0.04,
  ];
  const colors = [
    CHIP_COLOR.r, CHIP_COLOR.g, CHIP_COLOR.b, 1,
    CHIP_DARK.r, CHIP_DARK.g, CHIP_DARK.b, 1,
    CHIP_COLOR.r, CHIP_COLOR.g, CHIP_COLOR.b, 1,
  ];
  const indices = [0, 1, 2];
  const normals: number[] = [];
  VertexData.ComputeNormals(positions, indices, normals);

  const vd = new VertexData();
  vd.positions = positions;
  vd.colors = colors;
  vd.indices = indices;
  vd.normals = normals;

  const mesh = new Mesh(`chip-${idx}`, scene);
  vd.applyToMesh(mesh);
  return mesh;
}

export function createWoodChips(scene: Scene): ChipsHandles {
  const group = new TransformNode("wood-chips", scene);
  const meshes: Mesh[] = [];
  const states: ChipState[] = [];

  for (let i = 0; i < MAX_CHIPS; i++) {
    const m = buildChipMesh(scene, i);
    m.parent = group;
    m.setEnabled(false);
    enforceVertexColorMaterials([m]);
    meshes.push(m);
    states.push({ active: false, age: 0, vx: 0, vy: 0, vz: 0, spinX: 0, spinY: 0, spinZ: 0 });
  }

  function findFree(): number {
    for (let i = 0; i < MAX_CHIPS; i++) if (!states[i]!.active) return i;
    return -1;
  }

  function emit(at: Vector3, count = 4): void {
    for (let n = 0; n < count; n++) {
      const idx = findFree();
      if (idx < 0) return;
      const m = meshes[idx]!;
      const s = states[idx]!;
      s.active = true;
      s.age = 0;
      const jx = (Math.random() - 0.5) * 0.05;
      const jz = (Math.random() - 0.5) * 0.05;
      m.position.set(at.x + jx, at.y, at.z + jz);
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.6 + Math.random() * 1.2;
      s.vx = Math.cos(angle) * speed;
      s.vz = Math.sin(angle) * speed;
      s.vy = 1.5 + Math.random() * 1.2;
      s.spinX = (Math.random() - 0.5) * 8;
      s.spinY = (Math.random() - 0.5) * 8;
      s.spinZ = (Math.random() - 0.5) * 8;
      m.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
      m.setEnabled(true);
    }
  }

  function update(dt: number): void {
    for (let i = 0; i < MAX_CHIPS; i++) {
      const s = states[i]!;
      if (!s.active) continue;
      s.age += dt;
      if (s.age >= LIFETIME) {
        s.active = false;
        meshes[i]!.setEnabled(false);
        continue;
      }
      const m = meshes[i]!;
      m.position.x += s.vx * dt;
      m.position.y += s.vy * dt;
      m.position.z += s.vz * dt;
      s.vy += GRAVITY * dt;
      s.vx *= 0.96;
      s.vz *= 0.96;
      m.rotation.x += s.spinX * dt;
      m.rotation.y += s.spinY * dt;
      m.rotation.z += s.spinZ * dt;
    }
  }

  function destroy(): void {
    for (const m of meshes) m.dispose();
    group.dispose();
  }

  return { group, emit, update, destroy };
}
