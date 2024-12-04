import { defineConfig } from "vite";
import dts from "vite-plugin-dts";
import { resolve } from "path";

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "FastGrid",
      fileName: (format) => `fast-grid.${format}.js`,
      formats: ["es", "umd"],
    },
    rollupOptions: {
      external: ["main-thread-scheduling"],
      output: {
        globals: {
          "main-thread-scheduling": "mainThreadScheduling",
        },
        assetFileNames: (assetInfo) => {
          return assetInfo.name ?? "";
        },
      },
    },
    cssCodeSplit: false,
    cssMinify: true,
  },
  plugins: [
    dts({
      insertTypesEntry: true,
    }),
  ],
});
