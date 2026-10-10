import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";

// Tauri expects a fixed port and does not want Vite to clear its output.
export default defineConfig({
  plugins: [vue()],
  clearScreen: false,
  css: {
    preprocessorOptions: {
      // Bootstrap 5 still uses Sass `@import`; the warnings come from its code, not from ours.
      scss: {
        api: "modern-compiler",
        quietDeps: true,
        silenceDeprecations: ["import"],
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
