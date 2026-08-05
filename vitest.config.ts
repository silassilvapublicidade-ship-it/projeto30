import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // Parte K - lets tests import service files with a top-level
      // `import "server-only"` directly (see src/test/server-only-stub.ts).
      // Production bundling is unaffected: Next.js resolves the real
      // package via its own "react-server" condition, never this alias.
      "server-only": fileURLToPath(new URL("./src/test/server-only-stub.ts", import.meta.url)),
    },
  },
  test: {
    coverage: {
      reporter: ["text", "html"],
    },
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
