import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Component and unit tests. `next build` never reads this file; it only
// exists so `npm test` can render components under jsdom with the same `@/`
// alias tsconfig.json declares.
export default defineConfig({
  esbuild: { jsx: "automatic" },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
