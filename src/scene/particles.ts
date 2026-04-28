import * as THREE from "three";

// Tiny wood-chip particle system. Each chip is a small flat-shaded triangle
// that spawns at the gnaw site, gets a random outward velocity, falls under
// gravity, and fades over its lifetime. Pooled so we don't allocate during
// gameplay.
//
// Cozy-register choice: the chips are visual punctuation, not a particle
// shower. We cap the active count and use small geometry so the scene stays
// quiet.

const MAX_CHIPS = 96;
const GRAVITY = -6.0;
const LIFETIME = 0.9;
const CHIP_COLOR = new THREE.Color("#c8a06a");
const CHIP_COLOR_DARK = new THREE.Color("#8b6a3e");

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
  group: THREE.Group;
  emit(at: THREE.Vector3, count?: number): void;
  update(dt: number): void;
  destroy(): void;
}

function buildChipGeometry(): THREE.BufferGeometry {
  // Tiny irregular triangle, ~0.06u wide, with bark+heart vertex tones
  const verts = new Float32Array([
    -0.03, 0, 0,
    0.03, 0, 0.012,
    0, 0, 0.04,
  ]);
  const colors = new Float32Array([
    CHIP_COLOR.r, CHIP_COLOR.g, CHIP_COLOR.b,
    CHIP_COLOR_DARK.r, CHIP_COLOR_DARK.g, CHIP_COLOR_DARK.b,
    CHIP_COLOR.r, CHIP_COLOR.g, CHIP_COLOR.b,
  ]);
  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.BufferAttribute(verts, 3));
  geom.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geom.computeVertexNormals();
  return geom;
}

export function createWoodChips(scene: THREE.Scene): ChipsHandles {
  const group = new THREE.Group();
  group.name = "wood-chips";
  scene.add(group);

  const geom = buildChipGeometry();
  const meshes: THREE.Mesh[] = [];
  const states: ChipState[] = [];

  for (let i = 0; i < MAX_CHIPS; i++) {
    const mat = new THREE.MeshLambertMaterial({
      vertexColors: true,
      flatShading: true,
      transparent: true,
      opacity: 1,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.visible = false;
    group.add(mesh);
    meshes.push(mesh);
    states.push({ active: false, age: 0, vx: 0, vy: 0, vz: 0, spinX: 0, spinY: 0, spinZ: 0 });
  }

  function findFree(): number {
    for (let i = 0; i < MAX_CHIPS; i++) {
      if (!states[i]!.active) return i;
    }
    return -1; // all in use; drop
  }

  function emit(at: THREE.Vector3, count: number = 4): void {
    for (let n = 0; n < count; n++) {
      const idx = findFree();
      if (idx < 0) return;
      const mesh = meshes[idx]!;
      const s = states[idx]!;
      s.active = true;
      s.age = 0;
      // Spawn slightly offset around the bite point
      const jx = (Math.random() - 0.5) * 0.05;
      const jz = (Math.random() - 0.5) * 0.05;
      mesh.position.set(at.x + jx, at.y, at.z + jz);
      // Random outward velocity in XZ + upward kick
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.6 + Math.random() * 1.2;
      s.vx = Math.cos(angle) * speed;
      s.vz = Math.sin(angle) * speed;
      s.vy = 1.5 + Math.random() * 1.2;
      s.spinX = (Math.random() - 0.5) * 8;
      s.spinY = (Math.random() - 0.5) * 8;
      s.spinZ = (Math.random() - 0.5) * 8;
      mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
      mesh.visible = true;
      (mesh.material as THREE.MeshLambertMaterial).opacity = 1;
    }
  }

  function update(dt: number): void {
    for (let i = 0; i < MAX_CHIPS; i++) {
      const s = states[i]!;
      if (!s.active) continue;
      s.age += dt;
      if (s.age >= LIFETIME) {
        s.active = false;
        meshes[i]!.visible = false;
        continue;
      }
      const mesh = meshes[i]!;
      // Integrate
      mesh.position.x += s.vx * dt;
      mesh.position.y += s.vy * dt;
      mesh.position.z += s.vz * dt;
      s.vy += GRAVITY * dt;
      // Air drag on horizontal
      s.vx *= 0.96;
      s.vz *= 0.96;
      // Tumble
      mesh.rotation.x += s.spinX * dt;
      mesh.rotation.y += s.spinY * dt;
      mesh.rotation.z += s.spinZ * dt;
      // Fade out the last 30% of life
      const fadeT = Math.max(0, (s.age - LIFETIME * 0.7) / (LIFETIME * 0.3));
      (mesh.material as THREE.MeshLambertMaterial).opacity = 1 - fadeT;
    }
  }

  function destroy(): void {
    for (const m of meshes) {
      (m.material as THREE.Material).dispose();
    }
    geom.dispose();
    scene.remove(group);
  }

  return { group, emit, update, destroy };
}
