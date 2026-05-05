import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { Scene } from "@babylonjs/core/scene";
import type { PlayerHandles } from "./player";
import type { Terrain } from "./terrain";
import { enforceVertexColorMaterials } from "./materials";

// Hold E in an empty spot (no tree to gnaw, no log to pick up) → carve a
// shallow bowl in the terrain a short hop in front of the beaver. Stops on
// release or at MAX_DEPTH. Visual: chunky dirt-clod clumps lobbed up out of
// the hole.

const DIG_AHEAD = 0.7;              // metres: dig in front of beaver so it doesn't sink
const DIG_RADIUS = 0.65;            // metres: rim of the dugout
const DIG_RATE = 0.8;               // metres of depth per second of held E (was 0.18)
const MAX_DEPTH = 0.9;              // cap the dugout depth
const CLOD_INTERVAL_S = 0.10;       // throw a clod often so the burst feels chunky
const MAX_CLODS = 24;
const CLOD_LIFETIME = 0.8;
const CLOD_GRAVITY = -7.0;

interface ClodState {
  active: boolean;
  age: number;
  vy: number;
  vx: number;
  vz: number;
  spinX: number;
  spinY: number;
  spinZ: number;
}

export interface DiggingHandles {
  currentDepth: number;
  activeSite: Vector3 | null;
  update(dt: number, player: PlayerHandles): void;
  destroy(): void;
}

export interface DiggingOpts {
  scene: Scene;
  terrain: Terrain;
  // True if some other system is going to claim E this frame (felling target
  // in range, or carrying a log) — digging stays out of the way.
  isInteractionClaimed: () => boolean;
}

// Chunky low-poly cube for dirt clods — visually distinct from the flat
// triangle wood-chips that felling uses.
function buildClodMesh(scene: Scene, idx: number): Mesh {
  const s = 0.07;
  // 8 vertices of a cube, slightly irregular so it doesn't look like a die
  const positions = [
    -s, -s * 0.7, -s,
     s, -s * 0.7, -s,
     s, -s * 0.7,  s,
    -s, -s * 0.7,  s,
    -s * 0.85,  s * 0.9, -s * 0.85,
     s * 0.85,  s * 0.9, -s * 0.85,
     s * 0.85,  s * 0.9,  s * 0.85,
    -s * 0.85,  s * 0.9,  s * 0.85,
  ];
  const dirt = new Color3(122 / 255, 90 / 255, 58 / 255);    // #7a5a3a
  const dirtDark = new Color3(82 / 255, 60 / 255, 38 / 255); // darker side
  const colors: number[] = [];
  for (let i = 0; i < 4; i++) colors.push(dirtDark.r, dirtDark.g, dirtDark.b, 1);
  for (let i = 0; i < 4; i++) colors.push(dirt.r, dirt.g, dirt.b, 1);
  const indices = [
    // bottom
    0, 1, 2,  0, 2, 3,
    // top
    4, 6, 5,  4, 7, 6,
    // sides
    0, 4, 5,  0, 5, 1,
    1, 5, 6,  1, 6, 2,
    2, 6, 7,  2, 7, 3,
    3, 7, 4,  3, 4, 0,
  ];
  const normals: number[] = [];
  VertexData.ComputeNormals(positions, indices, normals);
  const vd = new VertexData();
  vd.positions = positions;
  vd.colors = colors;
  vd.indices = indices;
  vd.normals = normals;
  const mesh = new Mesh(`clod-${idx}`, scene);
  vd.applyToMesh(mesh);
  return mesh;
}

export function createDiggingSystem(opts: DiggingOpts): DiggingHandles {
  const { scene, terrain, isInteractionClaimed } = opts;

  const group = new TransformNode("dirt-clods", scene);
  const clods: Mesh[] = [];
  const states: ClodState[] = [];
  for (let i = 0; i < MAX_CLODS; i++) {
    const m = buildClodMesh(scene, i);
    m.parent = group;
    m.setEnabled(false);
    enforceVertexColorMaterials([m]);
    clods.push(m);
    states.push({ active: false, age: 0, vx: 0, vy: 0, vz: 0, spinX: 0, spinY: 0, spinZ: 0 });
  }

  function emitClod(at: Vector3, count = 2): void {
    for (let n = 0; n < count; n++) {
      const idx = states.findIndex((s) => !s.active);
      if (idx < 0) return;
      const m = clods[idx]!;
      const s = states[idx]!;
      s.active = true;
      s.age = 0;
      const a = Math.random() * Math.PI * 2;
      const sp = 1.3 + Math.random() * 1.0;
      s.vx = Math.cos(a) * sp;
      s.vz = Math.sin(a) * sp;
      s.vy = 2.2 + Math.random() * 1.4;     // strong upward kick — clods leap
      s.spinX = (Math.random() - 0.5) * 10;
      s.spinY = (Math.random() - 0.5) * 10;
      s.spinZ = (Math.random() - 0.5) * 10;
      m.position.set(
        at.x + (Math.random() - 0.5) * 0.10,
        at.y,
        at.z + (Math.random() - 0.5) * 0.10,
      );
      m.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      m.setEnabled(true);
    }
  }

  function updateClods(dt: number): void {
    for (let i = 0; i < MAX_CLODS; i++) {
      const s = states[i]!;
      if (!s.active) continue;
      s.age += dt;
      if (s.age >= CLOD_LIFETIME) {
        s.active = false;
        clods[i]!.setEnabled(false);
        continue;
      }
      const m = clods[i]!;
      m.position.x += s.vx * dt;
      m.position.y += s.vy * dt;
      m.position.z += s.vz * dt;
      s.vy += CLOD_GRAVITY * dt;
      s.vx *= 0.94;
      s.vz *= 0.94;
      m.rotation.x += s.spinX * dt;
      m.rotation.y += s.spinY * dt;
      m.rotation.z += s.spinZ * dt;
    }
  }

  let currentDepth = 0;
  let activeSite: Vector3 | null = null;
  let lastClodAt = 0;

  function update(dt: number, player: PlayerHandles): void {
    updateClods(dt);

    const moving = player.state.forward || player.state.backward || player.state.left || player.state.right;
    const wantDig = player.state.interactHeld && !moving && !isInteractionClaimed();

    if (!wantDig) {
      activeSite = null;
      currentDepth = 0;
      return;
    }

    // Lock dig site to a small offset in front of the beaver so the player
    // doesn't sink into the bowl as it deepens. forward() points where the
    // body faces (last walked direction).
    if (!activeSite) {
      const fwd = player.forward();
      activeSite = new Vector3(
        player.position.x + fwd.x * DIG_AHEAD,
        player.position.y,
        player.position.z + fwd.z * DIG_AHEAD,
      );
      currentDepth = 0;
    }

    if (currentDepth >= MAX_DEPTH) return;

    const dDepth = Math.min(DIG_RATE * dt, MAX_DEPTH - currentDepth);
    if (dDepth <= 0) return;
    terrain.dig(activeSite.x, activeSite.z, DIG_RADIUS, dDepth);
    currentDepth += dDepth;

    // Toss a clod or two upward out of the hole each beat.
    const now = performance.now();
    if (now - lastClodAt > CLOD_INTERVAL_S * 1000) {
      const groundY = terrain.heightAt(activeSite.x, activeSite.z);
      emitClod(new Vector3(activeSite.x, groundY + 0.05, activeSite.z), 2);
      lastClodAt = now;
    }
  }

  function destroy(): void {
    for (const m of clods) m.dispose();
    group.dispose();
  }

  return {
    get currentDepth() { return currentDepth; },
    get activeSite() { return activeSite; },
    update,
    destroy,
  };
}
