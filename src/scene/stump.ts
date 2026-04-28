import * as THREE from "three";

// Procedural stump mesh. Short cylinder with a darker top "heartwood" cap so
// the cut surface reads at a glance. Sits at the felled-tree's base position
// and registers as a collider so the player can't walk through it either.
//
// Inline geometry (no foundry round-trip) — same pragmatism as src/scene/log.ts.

const BARK = new THREE.Color("#d8d2c2");
const HEARTWOOD = new THREE.Color("#a37e58");

export interface StumpHandles {
  mesh: THREE.Mesh;
  position: THREE.Vector3;
  radius: number;
}

function buildStumpGeometry(radius: number, height: number): THREE.BufferGeometry {
  const sides = 8;
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  // Bottom ring (slightly under terrain so we don't see the seam)
  const bottomRing: number[] = [];
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * Math.PI * 2;
    bottomRing.push(positions.length / 3);
    positions.push(Math.cos(a) * radius, -0.05, Math.sin(a) * radius);
    colors.push(BARK.r, BARK.g, BARK.b);
  }
  // Top ring (cut surface)
  const topRing: number[] = [];
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * Math.PI * 2;
    topRing.push(positions.length / 3);
    positions.push(Math.cos(a) * radius * 0.95, height, Math.sin(a) * radius * 0.95);
    colors.push(BARK.r, BARK.g, BARK.b);
  }
  for (let i = 0; i < sides; i++) {
    const j = (i + 1) % sides;
    indices.push(bottomRing[i]!, topRing[i]!, topRing[j]!);
    indices.push(bottomRing[i]!, topRing[j]!, bottomRing[j]!);
  }

  // Heartwood cap
  const capCenter = positions.length / 3;
  positions.push(0, height + 0.005, 0);
  colors.push(HEARTWOOD.r, HEARTWOOD.g, HEARTWOOD.b);
  const capRing: number[] = [];
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * Math.PI * 2;
    capRing.push(positions.length / 3);
    positions.push(Math.cos(a) * radius * 0.85, height + 0.005, Math.sin(a) * radius * 0.85);
    colors.push(HEARTWOOD.r, HEARTWOOD.g, HEARTWOOD.b);
  }
  for (let i = 0; i < sides; i++) {
    const j = (i + 1) % sides;
    indices.push(capCenter, capRing[i]!, capRing[j]!);
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  return geom;
}

export function spawnStump(
  scene: THREE.Scene,
  position: THREE.Vector3,
  scale: number = 1.0
): StumpHandles {
  const radius = 0.16 * scale;
  const height = 0.18 * scale;
  const geom = buildStumpGeometry(radius, height);
  const material = new THREE.MeshLambertMaterial({
    vertexColors: true,
    flatShading: true,
  });
  const mesh = new THREE.Mesh(geom, material);
  mesh.position.copy(position);
  scene.add(mesh);
  return {
    mesh,
    position: position.clone(),
    radius,
  };
}
