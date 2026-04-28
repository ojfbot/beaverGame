import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { ValidationManifest } from "./types";

const loader = new GLTFLoader();
const isDev = import.meta.env.DEV;

// ── Pure validation ──────────────────────────────────────────────────────────
//
// validateManifest accepts unknown JSON (the parsed body of a sibling
// .validation.json) and returns a tagged result. Pure: no I/O, no globals,
// no time. Exhaustively tested in load-glb.test.ts.
//
// This is the consumer half of the cross-repo contract with asset-foundry.
// If it silently passes on a malformed validation file, the entire contract
// collapses without anyone noticing until something looks wrong. Locked here.

export type ManifestCheck =
  | { ok: true; manifest: ValidationManifest }
  | { ok: false; reason: string };

const REQUIRED_KEYS = [
  "asset_id",
  "version",
  "status",
  "tri_count",
  "tri_budget",
  "bounding_box",
  "material_slots",
  "blender_version",
  "generated_at",
] as const;

export function validateManifest(raw: unknown): ManifestCheck {
  if (raw === null || typeof raw !== "object") {
    return { ok: false, reason: "manifest is not an object" };
  }
  const m = raw as Record<string, unknown>;

  for (const k of REQUIRED_KEYS) {
    if (!(k in m)) return { ok: false, reason: `missing field: ${k}` };
  }

  if (typeof m.asset_id !== "string" || m.asset_id.length === 0) {
    return { ok: false, reason: "asset_id must be a non-empty string" };
  }
  if (m.version !== 1) {
    return { ok: false, reason: `unsupported version: ${m.version} (expected 1)` };
  }
  if (m.status !== "validated" && m.status !== "rejected" && m.status !== "pending") {
    return { ok: false, reason: `unknown status: ${m.status}` };
  }
  if (typeof m.tri_count !== "number" || typeof m.tri_budget !== "number") {
    return { ok: false, reason: "tri_count and tri_budget must be numbers" };
  }

  const bbox = m.bounding_box as Record<string, unknown> | null;
  if (
    !bbox ||
    typeof bbox !== "object" ||
    !Array.isArray((bbox as { min?: unknown }).min) ||
    !Array.isArray((bbox as { max?: unknown }).max)
  ) {
    return { ok: false, reason: "bounding_box must be { min: [x,y,z], max: [x,y,z] }" };
  }
  if (!Array.isArray(m.material_slots)) {
    return { ok: false, reason: "material_slots must be an array" };
  }

  // Status check is environment-independent: a "rejected" or "pending" asset
  // should never load, in dev or prod. Dev catches a missing manifest at the
  // fetch layer; prod is permissive about missing manifest (shipped builds
  // may strip them) but strict about a manifest that explicitly says NO.
  if (m.status === "rejected") {
    return { ok: false, reason: "asset rejected by foundry validator" };
  }
  if (m.status === "pending") {
    return { ok: false, reason: "asset still pending validation" };
  }

  return { ok: true, manifest: m as unknown as ValidationManifest };
}

// ── Loader ───────────────────────────────────────────────────────────────────

export async function loadValidatedGlb(path: string): Promise<THREE.Group> {
  const manifestUrl = path.replace(/\.glb$/, ".validation.json");
  let res: Response | null = null;
  try {
    res = await fetch(manifestUrl);
  } catch {
    res = null;
  }

  // Dev mode is strict: every .glb must have a sibling manifest. Prod is
  // permissive about missing (shipped bundles may have been stripped) but
  // strict on a present manifest that says rejected/pending.
  if (!res || !res.ok) {
    if (isDev) {
      throw new Error(
        `dev mode: ${path} has no sibling validation manifest at ${manifestUrl}. Generate via asset-foundry's gen-asset.`
      );
    }
  } else {
    let raw: unknown;
    try {
      raw = await res.json();
    } catch (err) {
      throw new Error(`asset ${path}: malformed validation manifest — ${(err as Error).message}`);
    }
    const check = validateManifest(raw);
    if (!check.ok) {
      throw new Error(`asset ${path}: ${check.reason}`);
    }
  }

  const gltf = await loader.loadAsync(path);
  return gltf.scene;
}
