import { resolve } from "node:path"
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"

// One build: two pages (side panel, pop-up card) and four scripts. The three content scripts must come out as single
// files with no imports (Chrome loads them as classic scripts), so they only
// import types from src/shared.
const SCRIPTS = ["background", "hook", "bridge", "mini"]

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": resolve(__dirname, "src") } },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    modulePreload: false,
    rollupOptions: {
      input: {
        sidepanel: resolve(__dirname, "src/sidepanel/index.html"),
        miniui: resolve(__dirname, "src/mini/index.html"),
        background: resolve(__dirname, "src/background/index.ts"),
        hook: resolve(__dirname, "src/content/hook.ts"),
        bridge: resolve(__dirname, "src/content/bridge.ts"),
        mini: resolve(__dirname, "src/content/mini.ts"),
      },
      output: {
        // scripts the manifest names keep fixed names; the two pages' bundles get hashed
        entryFileNames: (chunk) => (SCRIPTS.includes(chunk.name) ? "[name].js" : "assets/[name]-[hash].js"),
      },
    },
  },
})
