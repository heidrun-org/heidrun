import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";
import { formatBuildTime } from "./src/lib/build_time";

// Tauri expects a fixed port and does not want Vite to clear its output.
export default defineConfig({
  plugins: [vue()],
  clearScreen: false,
  // The date and time of the build, for the window "About Heidrun". In development, it is the start of the dev server.
  define: {
    __BUILD_TIME__: JSON.stringify(formatBuildTime(new Date())),
  },
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
