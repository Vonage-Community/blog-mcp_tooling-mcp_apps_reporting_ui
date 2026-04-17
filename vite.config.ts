import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  root: path.join(__dirname, "src/ui"),
  build: {
    outDir: path.join(__dirname, "dist"),
    emptyOutDir: false,
    rollupOptions: {
      input: path.join(__dirname, "src/ui/mcp-app.html"),
      output: {
        entryFileNames: "assets/[name].js",
        chunkFileNames: "assets/[name].js",
        assetFileNames: "assets/[name].[ext]",
      },
    },
  },
  plugins: [viteSingleFile()],
});
