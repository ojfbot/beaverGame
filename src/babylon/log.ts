import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { enforceVertexColorMaterials } from "./materials";

// Procedural log mesh — 8-sided cylinder with heartwood caps. Inline geometry
// (no foundry round-trip yet). LogEntity tracks lifecycle: ground → carried →
// placed (committed to a dam).

const BARK = new Color3(233 / 255, 230 / 255, 223 / 255);   // #e9e6df
const HEART = new Color3(163 / 255, 126 / 255, 88 / 255);   // #a37e58

const RADIUS = 0.10;
const LENGTH = 0.9;
const SIDES = 8;

let cachedVertexData: VertexData | null = null;

function buildLogVertexData(): VertexData {
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  const ringStart: number[] = [];
  const ringEnd: number[] = [];
  for (let i = 0; i < SIDES; i++) {
    const a = (i / SIDES) * Math.PI * 2;
    const x = Math.cos(a) * RADIUS;
    const z = Math.sin(a) * RADIUS;
    ringStart.push(positions.length / 3);
    positions.push(x, -LENGTH / 2, z);
    colors.push(BARK.r, BARK.g, BARK.b, 1);
    ringEnd.push(positions.length / 3);
    positions.push(x, LENGTH / 2, z);
    colors.push(BARK.r, BARK.g, BARK.b, 1);
  }
  for (let i = 0; i < SIDES; i++) {
    const j = (i + 1) % SIDES;
    indices.push(ringStart[i]!, ringEnd[i]!, ringEnd[j]!);
    indices.push(ringStart[i]!, ringEnd[j]!, ringStart[j]!);
  }

  for (const y of [-LENGTH / 2, LENGTH / 2]) {
    const center = positions.length / 3;
    positions.push(0, y, 0);
    colors.push(HEART.r, HEART.g, HEART.b, 1);
    const ring: number[] = [];
    for (let i = 0; i < SIDES; i++) {
      const a = (i / SIDES) * Math.PI * 2;
      const x = Math.cos(a) * RADIUS * 0.92;
      const z = Math.sin(a) * RADIUS * 0.92;
      ring.push(positions.length / 3);
      positions.push(x, y, z);
      colors.push(HEART.r, HEART.g, HEART.b, 1);
    }
    for (let i = 0; i < SIDES; i++) {
      const j = (i + 1) % SIDES;
      if (y > 0) indices.push(center, ring[i]!, ring[j]!);
      else indices.push(center, ring[j]!, ring[i]!);
    }
  }

  const normals: number[] = [];
  VertexData.ComputeNormals(positions, indices, normals);
  const vd = new VertexData();
  vd.positions = positions;
  vd.colors = colors;
  vd.indices = indices;
  vd.normals = normals;
  return vd;
}

function logVertexData(): VertexData {
  if (!cachedVertexData) cachedVertexData = buildLogVertexData();
  return cachedVertexData;
}

export interface LogEntity {
  mesh: Mesh;
  status: "ground" | "carried" | "placed";
  groundedPosition: Vector3;
  yaw: number;
}

export function spawnLog(scene: Scene, position: Vector3, yaw: number): LogEntity {
  const mesh = new Mesh("log", scene);
  logVertexData().applyToMesh(mesh);
  enforceVertexColorMaterials([mesh]);

  // Sit on ground, lay horizontal: Z=π/2 lays cylinder flat, Y=yaw aligns
  // with fall direction.
  mesh.position.set(position.x, position.y + 0.10, position.z);
  mesh.rotation.set(0, yaw, Math.PI / 2);

  return {
    mesh,
    status: "ground",
    groundedPosition: position.clone(),
    yaw,
  };
}
