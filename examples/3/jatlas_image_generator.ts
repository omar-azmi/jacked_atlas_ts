/** uses a `JAtlasManager` to generate an atlas indexed image */

import { downloadBuffer } from "https://deno.land/x/kitchensink_ts@v0.5.7/browser.ts"
import { IDColoringFunc, JAtlasManager } from "../../src/mod.ts"

const word_coloring_func: IDColoringFunc = (id) => {
	if (id === 0) return [0, 0, 0, 0]
	return [
		id / 2 ** 16 | 0,
		(id % 2 ** 16) / 2 ** 8 | 0,
		(id % 2 ** 8) / 2 ** 0 | 0,
		255 - (id % 2 ** 0) * 100 | 0,
	]
}

JAtlasManager.fromURL("./manuscript.jpg.jatlas.json")
	.then(async (new_atlas_manager) => {
		await new_atlas_manager.source_loaded
		await new_atlas_manager.entries_loaded
		window.atlas_man = new_atlas_manager
		return new_atlas_manager.toJAtlasImage(word_coloring_func)
	})
	.then((blob) => downloadBuffer(blob, "manuscript.jpg.jatlas.png", blob.type))

