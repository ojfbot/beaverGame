// Lightweight check that every .glb under public/assets/ has a sibling
// .validation.json declaring `status: "validated"`. The full validator lives
// in asset-foundry; this is the consumer-side tripwire.
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
const ROOT = join(process.cwd(), "public", "assets");
function walk(dir) {
    if (!existsSync(dir))
        return [];
    const out = [];
    for (const entry of readdirSync(dir)) {
        const p = join(dir, entry);
        if (statSync(p).isDirectory())
            out.push(...walk(p));
        else if (p.endsWith(".glb"))
            out.push(p);
    }
    return out;
}
let failed = 0;
const glbs = walk(ROOT);
if (glbs.length === 0) {
    console.warn(`no .glb files under ${ROOT} (Phase 0 not yet run?)`);
    process.exit(0);
}
for (const glb of glbs) {
    const manifest = glb.replace(/\.glb$/, ".validation.json");
    if (!existsSync(manifest)) {
        console.error(`MISSING manifest for ${glb}`);
        failed++;
        continue;
    }
    const data = JSON.parse(readFileSync(manifest, "utf8"));
    if (data.status !== "validated") {
        console.error(`UNVALIDATED ${glb}: status=${data.status}`);
        failed++;
        continue;
    }
    if (data.tri_count > data.tri_budget) {
        console.error(`OVER BUDGET ${glb}: ${data.tri_count} > ${data.tri_budget}`);
        failed++;
        continue;
    }
    console.log(`ok  ${glb} (${data.tri_count}/${data.tri_budget} tris)`);
}
process.exit(failed === 0 ? 0 : 1);
