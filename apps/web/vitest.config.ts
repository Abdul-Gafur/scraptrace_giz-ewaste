import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    // Rendering a whole screen with jsdom, MSW and next-intl is slow on a loaded machine; the
    // default five seconds produced timeouts that had nothing to do with the assertions.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    server: { deps: { inline: [/next-intl/] } },
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      exclude: ["src/app/**", "src/test/**"],
    },
  },
});
