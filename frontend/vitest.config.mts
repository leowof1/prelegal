import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
  test: {
    // Component tests opt into jsdom with a `@vitest-environment jsdom` docblock.
    environment: "node",
    setupFiles: ["./src/test/setup.ts"],
    // Undo vi.spyOn and vi.stubGlobal after every test so no stub leaks into the next one.
    restoreMocks: true,
    unstubGlobals: true,
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
