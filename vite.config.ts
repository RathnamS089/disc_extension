import { resolve } from "node:path"
import { defineConfig, type Plugin } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"

// One build: two pages (side panel, pop-up card) and four scripts. The three content scripts must come out as single
// files with no imports (Chrome loads them as classic scripts), so they only
// import types from src/shared.
const SCRIPTS = ["background", "hook", "bridge", "mini"]
const CONTENT_SCRIPTS = ["hook", "bridge", "mini"]

// Classic scripts share one global scope per world, so a second copy in the same tab (the install-time injection on top
// of an orphaned one from before a reload) dies on "Identifier 'n' has already been declared". Give each its own scope.
const ownScope: Plugin = {
  name: "content-script-scope",
  renderChunk: (code, chunk) => (CONTENT_SCRIPTS.includes(chunk.name) ? `(() => {\n${code}\n})();\n` : null),
}

export default defineConfig({
  plugins: [react(), tailwindcss(), ownScope],
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
