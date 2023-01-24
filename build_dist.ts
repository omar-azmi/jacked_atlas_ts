import { build as esbuild, stop as esstop } from "https://deno.land/x/esbuild/mod.js"
import { denoPlugin } from "https://deno.land/x/esbuild_deno_loader/mod.ts"

/** use:
 * - `"./src/mod.ts"` for bundling the main module (default if unspecified in `Deno.args`)
 * - `"./examples/${num}/${script}.ts"` for compiling an example
*/
const
	compile_file = Deno.args[0] ?? "./src/mod.ts",
	compiled_file = `./dist/${compile_file.split("/").reverse()[0].slice(0, -3)}.js`
let t0 = performance.now(), t1: number
await esbuild({
	entryPoints: [compile_file],
	outdir: "./dist/",
	bundle: true,
	minify: false,
	platform: "neutral",
	format: "esm",
	target: "esnext",
	plugins: [denoPlugin()],
	define: {},
})
esstop()
t1 = performance.now()
console.log("execution time:", t1 - t0, "ms")
console.log("dist binary size:", Deno.statSync(compiled_file).size / 1024, "kb")
