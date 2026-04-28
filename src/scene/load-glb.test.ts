import { describe, it, expect } from "vitest";
import { validateManifest } from "./load-glb";

// Canonical shape produced by asset-foundry's `gateValidation`. Tests build
// from this baseline and mutate fields to exercise rejection paths.
const valid = {
  asset_id: "birch_sapling",
  version: 1,
  status: "validated",
  tri_count: 80,
  tri_budget: 600,
  bounding_box: { min: [0, 0, 0], max: [1, 1, 1] },
  material_slots: ["bark"],
  blender_version: "4.2.3",
  generated_at: "2026-04-28T12:00:00Z",
};

describe("validateManifest — happy path", () => {
  it("accepts a well-formed validated manifest", () => {
    const r = validateManifest(valid);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.manifest.asset_id).toBe("birch_sapling");
  });
});

describe("validateManifest — type guards", () => {
  it("rejects null", () => {
    const r = validateManifest(null);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/not an object/);
  });

  it("rejects a string", () => {
    const r = validateManifest("hello");
    expect(r.ok).toBe(false);
  });

  it("rejects a number", () => {
    const r = validateManifest(42);
    expect(r.ok).toBe(false);
  });

  it("rejects undefined", () => {
    const r = validateManifest(undefined);
    expect(r.ok).toBe(false);
  });
});

describe("validateManifest — required fields", () => {
  // Each required field, when missing, surfaces a specific reason. Lock the
  // contract so accidentally renaming a field breaks loudly.
  const requiredFields = [
    "asset_id",
    "version",
    "status",
    "tri_count",
    "tri_budget",
    "bounding_box",
    "material_slots",
    "blender_version",
    "generated_at",
  ];

  for (const field of requiredFields) {
    it(`rejects when ${field} is missing`, () => {
      const partial = { ...valid };
      delete (partial as Record<string, unknown>)[field];
      const r = validateManifest(partial);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason).toBe(`missing field: ${field}`);
    });
  }
});

describe("validateManifest — field shape", () => {
  it("rejects empty asset_id", () => {
    const r = validateManifest({ ...valid, asset_id: "" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/asset_id/);
  });

  it("rejects non-string asset_id", () => {
    const r = validateManifest({ ...valid, asset_id: 42 });
    expect(r.ok).toBe(false);
  });

  it("rejects unsupported version", () => {
    const r = validateManifest({ ...valid, version: 2 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/unsupported version/);
  });

  it("rejects unknown status value", () => {
    const r = validateManifest({ ...valid, status: "in_review" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/unknown status/);
  });

  it("rejects non-numeric tri_count", () => {
    const r = validateManifest({ ...valid, tri_count: "lots" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/tri_count/);
  });

  it("rejects non-numeric tri_budget", () => {
    const r = validateManifest({ ...valid, tri_budget: null });
    expect(r.ok).toBe(false);
  });

  it("rejects bounding_box without min/max", () => {
    const r = validateManifest({ ...valid, bounding_box: { foo: "bar" } });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/bounding_box/);
  });

  it("rejects bounding_box with non-array min", () => {
    const r = validateManifest({ ...valid, bounding_box: { min: "not-array", max: [1, 1, 1] } });
    expect(r.ok).toBe(false);
  });

  it("rejects non-array material_slots", () => {
    const r = validateManifest({ ...valid, material_slots: "bark" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/material_slots/);
  });
});

describe("validateManifest — status semantics (env-independent)", () => {
  it("rejects status:rejected with a clear reason", () => {
    const r = validateManifest({ ...valid, status: "rejected" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/rejected by foundry validator/);
  });

  it("rejects status:pending with a clear reason", () => {
    const r = validateManifest({ ...valid, status: "pending" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/pending validation/);
  });

  it("accepts status:validated", () => {
    const r = validateManifest(valid);
    expect(r.ok).toBe(true);
  });
});
