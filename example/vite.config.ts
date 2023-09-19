import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import closureCompiler from "rollup-plugin-closure-compiler";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), closureCompiler()],
  build: { sourcemap: "inline" },
});
