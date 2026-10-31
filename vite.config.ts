import { resolve } from "node:path"
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"

// One build, five entries. The three content scripts must come out as single
// files with no imports (Chrome loads them as classic scripts), so they only
// import types from src/shared.
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
        background: resolve(__dirname, "src/background/index.ts"),
        hook: resolve(__dirname, "src/content/hook.ts"),
        bridge: resolve(__dirname, "src/content/bridge.ts"),
        mini: resolve(__dirname, "src/content/mini.ts"),
      },
      output: {
        entryFileNames: (chunk) => (chunk.name === "sidepanel" ? "assets/[name]-[hash].js" : "[name].js"),
      },
    },
  },
})
