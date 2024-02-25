export { popupCanvas } from "https://deno.land/x/kitchensink_ts@v0.7.3/devdebug.ts"
export { getBGCanvas, getBGCtx } from "../../src/funcdefs.ts"
import { object_entries } from "../../src/deps.ts"
import { JAtlas_Codec, JAtlasObject } from "../../src/image_codecs.ts"
import { ImagePool } from "../../src/image_pool.ts"


export const image_pool = new ImagePool<string>(1)

const
	atlas_json = await (await fetch("../1/segments.jatlas.json")).json() as JAtlasObject,
	src = new URL(atlas_json.source, new URL("../1/", document.location.href)).toString()
console.log(src)
const
	jatlas_codec = new JAtlas_Codec(src),
	entries = atlas_json.entries

image_pool.addCodec(jatlas_codec)

for (const [name, atlas_entry] of object_entries(entries)) {
	image_pool.set(name, {
		format: "jatlas-entry",
		source: atlas_entry
	})
}
