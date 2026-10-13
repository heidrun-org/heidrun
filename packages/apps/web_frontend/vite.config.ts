import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";

// Tauri expects a fixed port and does not want Vite to clear its output.
export default defineConfig({
  plugins: [vue()],
  clearScreen: false,
  css: {
    preprocessorOptions: {
      scss: {
        api: "modern-compiler",
        quietDeps: true,
      },
    },
  },
  server: {
    port: 1420,
    strictPort: true,
    watch: { ignored: ["**/desktop_tauri/**"] },
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts"],
    // The first test of a file that mounts App.vue loads the whole window, and it needs more than 5 seconds when `pnpm test` runs all the packages together.
    testTimeout: 30000,
  },
  build: {
    target: "safari16",
    sourcemap: false,
  },
});
