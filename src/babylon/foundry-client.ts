// MCP client wiring — beaverGame consumes asset-foundry's MCP HTTP server
// (the same registry as `pnpm foundry` CLI and `pnpm foundry mcp` stdio).
// asset-foundry ADR-0010 documents the contract; per the platformization
// shipped 2026-04-28, beaverGame is a "target" of asset-foundry per ADR-0006
// (the manifest + fixtures + dist layout already live at `asset-foundry/` in
// this repo).
//
// Pattern adapted from asset-foundry/apps/web/src/lib/mcp-client.ts.
//
// URL resolution:
//   1. ?mcp=http://host:port/mcp   (override via query string for ad-hoc dev)
//   2. window.__FOUNDRY_MCP_URL__  (shell/ host can inject this at runtime)
//   3. http://localhost:3036/mcp   (default, matches `pnpm foundry mcp-http`)
//
// **Best-effort connect.** beaverGame must run if the foundry server is offline
// (no devs running `pnpm foundry mcp-http`). Connection failure is logged but
// not thrown; the game loads .glbs from `public/assets/` regardless.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

declare global {
  interface Window {
    __FOUNDRY_MCP_URL__?: string;
  }
}

function resolveUrl(): string {
  if (typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get("mcp");
    if (fromQuery) return fromQuery;
    if (window.__FOUNDRY_MCP_URL__) return window.__FOUNDRY_MCP_URL__;
  }
  return "http://localhost:3036/mcp";
}

let cached: { client: Client; ready: Promise<void> } | null = null;

export function getFoundryClient(): { client: Client; ready: Promise<void> } {
  if (cached) return cached;
  const client = new Client({ name: "beaver-game", version: "0.0.1" });
  const transport = new StreamableHTTPClientTransport(new URL(resolveUrl()));
  const ready = client.connect(transport);
  cached = { client, ready };
  return cached;
}

interface ToolResult {
  content: Array<{ type: string; text?: string }>;
  isError?: boolean;
}

export async function callFoundryTool<T>(
  name: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  const { client, ready } = getFoundryClient();
  await ready;
  const result = (await client.callTool({ name, arguments: args })) as ToolResult;
  if (result.isError) {
    throw new Error(`tool error from ${name}: ${JSON.stringify(result.content)}`);
  }
  const text = result.content[0]?.text;
  if (!text) throw new Error(`tool ${name} returned no text content`);
  return JSON.parse(text) as T;
}

// Minimal typed helpers for the Phase 3 tool registry. Extend as we consume
// more verbs from main.ts / debug rigs.

export type AssetSummary = {
  asset_id: string;
  glb_path: string;
  validation_path: string;
  tri_count: number;
};

export async function listFoundryAssets(): Promise<AssetSummary[]> {
  return callFoundryTool<AssetSummary[]>("foundry.asset.list");
}

/** Best-effort connect on dev startup. Logs success or quietly notes that the
 *  foundry isn't reachable. Never throws. */
export async function tryConnectFoundry(): Promise<{ connected: boolean; assets?: AssetSummary[] }> {
  try {
    const assets = await listFoundryAssets();
    console.info(`[foundry] connected to MCP at ${resolveUrl()} — ${assets.length} assets available`);
    return { connected: true, assets };
  } catch (err) {
    console.info(
      `[foundry] not reachable at ${resolveUrl()}; running in offline mode. ` +
      `Start with: cd asset-foundry && pnpm foundry mcp-http (in the asset-foundry repo). Error: ${(err as Error).message}`,
    );
    return { connected: false };
  }
}
