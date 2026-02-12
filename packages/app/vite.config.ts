import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { defineConfig } from "vite"
import tsconfigPaths from "vite-tsconfig-paths"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

type Pkg = {
  dependencies?: Record<string, string> | undefined
  peerDependencies?: Record<string, string> | undefined
}

// CHANGE: Build both the library entry (src/index.ts) and the CLI entry (src/app/main.ts).
// WHY: Consumers need a JS entrypoint in dist for `import "openapi-effect"`, while we keep the template CLI working.
// SOURCE: n/a
const pkgPath = path.resolve(__dirname, "package.json")
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8")) as Pkg
const dependencies = [...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.peerDependencies ?? {})]

const isExternal = (id: string): boolean =>
  dependencies.some((dep) => id === dep || id.startsWith(`${dep}/`))

export default defineConfig({
  plugins: [tsconfigPaths()],
  publicDir: false,
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src")
    }
  },
  build: {
    target: "node20",
    outDir: "dist",
    sourcemap: true,
    rollupOptions: {
      preserveEntrySignatures: "exports-only",
      input: {
        index: path.resolve(__dirname, "src/index.ts"),
        main: path.resolve(__dirname, "src/app/main.ts")
      },
      external: isExternal,
      output: {
        format: "es",
        entryFileNames: "[name].js"
      }
    }
  }
})
