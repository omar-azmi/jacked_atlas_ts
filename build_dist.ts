import { build as esbuild, stop as esstop } from "https://deno.land/x/esbuild/mod.js"
import { denoPlugin } from "https://deno.land/x/esbuild_deno_loader/mod.ts"

let t0 = performance.now(), t1: number
await esbuild({
	entryPoints: ["./src/mod.ts"],
	outdir: "./dist/",
	bundle: true,
	minify: true,
	platform: "neutral",
	format: "esm",
	target: "esnext",
	plugins: [denoPlugin()],
	define: {},
})
esstop()
t1 = performance.now()
console.log("execution time:", t1 - t0, "ms")
console.log("dist binary size:", Deno.statSync("./dist/mod.js").size / 1024, "kb")
