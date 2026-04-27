// Mirrors the shape produced by asset-foundry's Validator.
// Source of truth: asset-foundry/src/validator/index.ts.
export interface ValidationManifest {
  asset_id: string;
  version: number;
  status: "validated" | "rejected" | "pending";
  tri_count: number;
  tri_budget: number;
  bounding_box: { min: [number, number, number]; max: [number, number, number] };
  material_slots: string[];
  blender_version: string;
  generated_at: string;
}
