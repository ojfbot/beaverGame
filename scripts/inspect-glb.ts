import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { readFileSync, existsSync } from "node:fs";
import { basename, dirname, join } from "node:path";

const HELP = `inspect-glb — diagnostic for a single .glb file

Usage:
  pnpm tsx scripts/inspect-glb.ts <path-to.glb>

Reports the things that have actually broken in past debugging:
  - per-mesh attribute presence (esp. COLOR_0 — vertex colours)
  - material type and KHR_materials_unlit flag
  - vertex-color sample (first vertex) so you can confirm linear-vs-sRGB
  - tri count vs declared budget if a sibling <name>.validation.json exists

The validation JSON sibling lookup is the fastest way to spot drift between
the manifest's tri_budget and the actual asset.`;

(async () => {
  const arg = process.argv[2];
  if (!arg || arg === "--help" || arg === "-h") {
    console.log(HELP);
    process.exit(arg ? 0 : 2);
  }

  if (!existsSync(arg)) {
    console.error(`✗ not found: ${arg}`);
    process.exit(1);
  }

  const buf = readFileSync(arg);
  const loader = new GLTFLoader();
  const gltf = await new Promise<any>((res, rej) =>
    loader.parse(
      buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
      "",
      res,
      rej
    )
  );

  // Sibling validation.json — lets us cross-check against the manifest gate.
  const sibling = arg.replace(/\.glb$/, ".validation.json");
  let manifest: Record<string, unknown> | null = null;
  if (existsSync(sibling)) {
    try {
      manifest = JSON.parse(readFileSync(sibling, "utf8"));
    } catch (err) {
      console.error(`! sibling .validation.json malformed: ${(err as Error).message}`);
    }
  }

  console.log(`\n${basename(arg)}`);
  console.log("─".repeat(Math.max(40, basename(arg).length)));
  if (manifest) {
    const status = manifest.status as string;
    const tag = status === "validated" ? "✓" : "✗";
    console.log(`  manifest:    ${tag} ${status}  asset_id=${manifest.asset_id}  blender=${manifest.blender_version}`);
  } else {
    console.log(`  manifest:    (no sibling .validation.json found)`);
  }

  let totalTris = 0;
  let meshCount = 0;
  const issues: string[] = [];

  gltf.scene.traverse((n: any) => {
    if (!n.isMesh) return;
    meshCount++;
    const attrs = Object.keys(n.geometry.attributes);
    const hasColor = "color" in n.geometry.attributes;
    const colorOk = hasColor ? "✓" : "·";
    const matType = n.material?.type ?? "(none)";
    const isUnlit = matType === "MeshBasicMaterial" || /unlit/i.test(matType);
    const matOk = isUnlit ? "✓" : "·";
    // Tri count for indexed geometry = indices/3; non-indexed = positions/3
    const idxCount = n.geometry.index?.count ?? n.geometry.attributes.position?.count ?? 0;
    const tris = Math.floor(idxCount / 3);
    totalTris += tris;

    console.log(
      `  ${n.name.padEnd(20)} tris=${String(tris).padStart(4)}  ` +
      `color=${colorOk}  material=${matType.padEnd(20)} unlit=${matOk}`
    );

    if (hasColor) {
      const c = n.geometry.attributes.color;
      const sample = [c.getX(0), c.getY(0), c.getZ(0)].map((v) => v.toFixed(3)).join(", ");
      console.log(`                       attrs=[${attrs.join(",")}]  vColor[0]=(${sample})`);
    } else {
      console.log(`                       attrs=[${attrs.join(",")}]`);
      issues.push(`${n.name}: no COLOR_0 attribute`);
    }
    if (!isUnlit) {
      issues.push(`${n.name}: not KHR_materials_unlit (material=${matType})`);
    }
  });

  console.log(`\n  total: ${meshCount} mesh(es), ${totalTris} tris`);

  if (manifest) {
    const budget = manifest.tri_budget as number;
    const declared = manifest.tri_count as number;
    const tag = totalTris <= budget ? "✓" : "✗";
    console.log(`  budget: ${tag} ${totalTris}/${budget} tris (manifest declared ${declared})`);
    if (totalTris !== declared) {
      issues.push(`tri count drift: actual ${totalTris} ≠ declared ${declared}`);
    }
  }

  if (issues.length) {
    console.log(`\n  issues:`);
    for (const i of issues) console.log(`    - ${i}`);
    process.exit(1);
  }
})().catch((err) => {
  console.error("inspect-glb failed:", err);
  process.exit(1);
});
