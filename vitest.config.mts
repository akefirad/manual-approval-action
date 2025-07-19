import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    clearMocks: true,
    coverage: {
      provider: "v8",
      enabled: true,
      reporter: ["json-summary", "text", "lcov"],
      reportsDirectory: "./coverage",
      exclude: ["node_modules/**", "dist/**", "**/*.config.*", "**/*.d.ts"],
      include: ["src/**/*.ts"],
    },
    include: ["**/*.test.ts"],
    exclude: ["node_modules", "dist"],
  },
});
