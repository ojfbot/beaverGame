import { defineConfig } from "vite";

export default defineConfig({
  assetsInclude: ["**/*.glb", "**/*.hdr"],
  server: { port: 5173 },
});
