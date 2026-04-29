import * as THREE from "three";

// Procedural log mesh. Inline geometry (no foundry round-trip) for the
// sandbox-loop slice; a `birch_log` foundry fixture is a follow-up task.
//
// Two states:
//   "ground" — sitting where it fell, draggable on E if you're close
//   "carried" — followed at hip height behind the player
//   "placed"  — committed to a dam, no longer interactable

const BARK = new THREE.Color("#e9e6df");
const HEARTWOOD = new THREE.Color("#a37e58");

function buildLogGeometry(): THREE.BufferGeometry {
  // 8-sided low-poly cylinder, length 0.9, radius 0.10. Two "heart" caps
  // (slightly recessed dark circles) so the cut ends read.
  const radius = 0.10;
  const length = 0.9;
  const sides = 8;

  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  // Side ring
  const ringStart: number[] = [];
  const ringEnd: number[] = [];
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * Math.PI * 2;
    const x = Math.cos(a) * radius;
    const z = Math.sin(a) * radius;
    ringStart.push(positions.length / 3);
    positions.push(x, -length / 2, z);
    colors.push(BARK.r, BARK.g, BARK.b);
    ringEnd.push(positions.length / 3);
    positions.push(x, length / 2, z);
    colors.push(BARK.r, BARK.g, BARK.b);
  }
  for (let i = 0; i < sides; i++) {
    const j = (i + 1) % sides;
    indices.push(ringStart[i]!, ringEnd[i]!, ringEnd[j]!);
    indices.push(ringStart[i]!, ringEnd[j]!, ringStart[j]!);
  }

  // Caps (heartwood)
  for (const y of [-length / 2, length / 2]) {
    const centerIdx = positions.length / 3;
    positions.push(0, y, 0);
    colors.push(HEARTWOOD.r, HEARTWOOD.g, HEARTWOOD.b);
    const ringIdx: number[] = [];
    for (let i = 0; i < sides; i++) {
      const a = (i / sides) * Math.PI * 2;
      const x = Math.cos(a) * radius * 0.92;
      const z = Math.sin(a) * radius * 0.92;
      ringIdx.push(positions.length / 3);
      positions.push(x, y, z);
      colors.push(HEARTWOOD.r, HEARTWOOD.g, HEARTWOOD.b);
    }
    for (let i = 0; i < sides; i++) {
      const j = (i + 1) % sides;
      if (y > 0) indices.push(centerIdx, ringIdx[i]!, ringIdx[j]!);
      else indices.push(centerIdx, ringIdx[j]!, ringIdx[i]!);
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  return geom;
}

let cachedGeom: THREE.BufferGeometry | null = null;
function logGeometry(): THREE.BufferGeometry {
  if (!cachedGeom) cachedGeom = buildLogGeometry();
  return cachedGeom;
}

// Stable id for the collider registry — one per spawned log, monotonic
// across the session.
let nextLogId = 0;

export interface LogEntity {
  id: string;
  mesh: THREE.Mesh;
  status: "ground" | "carried" | "placed";
  // Where on the ground it landed when felled (or last dropped). Used for
  // dam-site distance checks.
  groundedPosition: THREE.Vector3;
  // Spawn-time orientation (yaw radians). Carried logs ride at player yaw.
  yaw: number;
}

// Cylinder-collider radius for a horizontal 0.9-long, 0.10-radius log.
// Approximates the log's bounding circle in plan view; over-represents the
// midline width and under-represents the ends, which is fine for the cozy
// register (you can't walk through fallen birch).
export const LOG_COLLIDER_RADIUS = 0.45;

export function spawnLog(scene: THREE.Scene, position: THREE.Vector3, yaw: number): LogEntity {
  const material = new THREE.MeshLambertMaterial({
    vertexColors: true,
    flatShading: true,
  });
  const mesh = new THREE.Mesh(logGeometry(), material);
  mesh.position.copy(position).setY(position.y + 0.10); // sit on ground
  mesh.rotation.y = yaw;
  // Lay it flat — log axis lies along its yaw direction, so rotate Z by 90°
  // to get the cylinder horizontal.
  mesh.rotation.z = Math.PI / 2;
  scene.add(mesh);

  return {
    id: `log-${nextLogId++}`,
    mesh,
    status: "ground",
    groundedPosition: position.clone(),
    yaw,
  };
}
