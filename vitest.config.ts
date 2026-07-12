import { defineConfig } from "vitest/config";

// Standalone Vitest config (found before vite.config.ts) so unit tests run in
// plain node without loading the React/Tailwind plugins — they cover pure
// logic only. Real canvas/pointer behavior is covered by tests/e2e.mjs.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
