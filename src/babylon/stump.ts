import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { enforceVertexColorMaterials } from "./materials";

// Procedural stump mesh — short 8-sided cylinder + heartwood cap. Sits where
// the felled tree was, swaps in for the trunk collider.

const BARK = new Color3(216 / 255, 210 / 255, 194 / 255);   // #d8d2c2
const HEART = new Color3(163 / 255, 126 / 255, 88 / 255);   // #a37e58

export interface StumpHandles {
  mesh: Mesh;
  position: Vector3;
  radius: number;
}

function buildStumpVertexData(radius: number, height: number): VertexData {
  const sides = 8;
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  const bottom: number[] = [];
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * Math.PI * 2;
    bottom.push(positions.length / 3);
    positions.push(Math.cos(a) * radius, -0.05, Math.sin(a) * radius);
    colors.push(BARK.r, BARK.g, BARK.b, 1);
  }
  const top: number[] = [];
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * Math.PI * 2;
    top.push(positions.length / 3);
    positions.push(Math.cos(a) * radius * 0.95, height, Math.sin(a) * radius * 0.95);
    colors.push(BARK.r, BARK.g, BARK.b, 1);
  }
  for (let i = 0; i < sides; i++) {
    const j = (i + 1) % sides;
    indices.push(bottom[i]!, top[i]!, top[j]!);
    indices.push(bottom[i]!, top[j]!, bottom[j]!);
  }

  const center = positions.length / 3;
  positions.push(0, height + 0.005, 0);
  colors.push(HEART.r, HEART.g, HEART.b, 1);
  const cap: number[] = [];
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * Math.PI * 2;
    cap.push(positions.length / 3);
    positions.push(Math.cos(a) * radius * 0.85, height + 0.005, Math.sin(a) * radius * 0.85);
    colors.push(HEART.r, HEART.g, HEART.b, 1);
  }
  for (let i = 0; i < sides; i++) {
    const j = (i + 1) % sides;
    indices.push(center, cap[i]!, cap[j]!);
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

export function spawnStump(scene: Scene, position: Vector3, scale = 1.0): StumpHandles {
  const radius = 0.16 * scale;
  const height = 0.18 * scale;
  const mesh = new Mesh("stump", scene);
  buildStumpVertexData(radius, height).applyToMesh(mesh);
  enforceVertexColorMaterials([mesh]);
  mesh.position.copyFrom(position);
  return {
    mesh,
    position: position.clone(),
    radius,
  };
}
