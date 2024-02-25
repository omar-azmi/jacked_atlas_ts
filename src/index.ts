export { popupCanvas } from "https://deno.land/x/kitchensink_ts@v0.7.3/devdebug.ts"
export { getBGCanvas, getBGCtx } from "./funcdefs.ts"
import { object_entries } from "./deps.ts"
import { JAtlas_LoaderAndSaver, JAtlasObject } from "./image_loaders.ts"
import { ImagePool } from "./image_pool.ts"


export const image_pool = new ImagePool<string, any, any>(1)

const
	atlas_json = await (await fetch("../examples/1/segments.jatlas.json")).json() as JAtlasObject,
	src = new URL(atlas_json.source, new URL("../examples/1/", document.location.href)).toString()
console.log(src)
const
	jatlas_loader = new JAtlas_LoaderAndSaver(src),
	entries = atlas_json.entries

image_pool.addLoader(jatlas_loader)

for (const [name, atlas_entry] of object_entries(entries)) {
	image_pool.set(name, { source: atlas_entry })
}


// examples / 1 / bitmasks / juice_1bit.webp
// examples / 1 / bitmasks / jack_1bit.png
