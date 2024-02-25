export { popupCanvas } from "https://deno.land/x/kitchensink_ts@v0.7.3/devdebug.ts"
export { getBGCanvas, getBGCtx } from "../../src/funcdefs.ts"
import { object_entries } from "../../src/deps.ts"
import { JAtlas_LoaderAndSaver, JAtlasObject } from "../../src/image_loaders.ts"
import { ImagePool } from "../../src/image_pool.ts"


export const image_pool = new ImagePool<string, any, any>(1)

const
	atlas_json = await (await fetch("../1/segments.jatlas.json")).json() as JAtlasObject,
	src = new URL(atlas_json.source, new URL("../1/", document.location.href)).toString()
console.log(src)
const
	jatlas_loader = new JAtlas_LoaderAndSaver(src),
	entries = atlas_json.entries

image_pool.addLoader(jatlas_loader)

for (const [name, atlas_entry] of object_entries(entries)) {
	image_pool.set(name, { source: atlas_entry })
}
