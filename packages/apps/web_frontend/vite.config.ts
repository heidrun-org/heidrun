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
  },
  build: {
    target: "safari16",
    sourcemap: false,
  },
});
