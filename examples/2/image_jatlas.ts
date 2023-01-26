/** generates `JAtlasManager` from an atlas indexed image
 * the default atlas indexing for a 4 channel image (`ch1`, `ch2`, `ch3`, `ch4`), works as follows:
 * ```ts
 * type ByteRange = number // minval = 0, maxval = 2**8 - 1 = 255
 * declare [ch1, ch2, ch3, ch4]: [ByteRange, ByteRange, ByteRange, ByteRange]
 * id: number = ch1 * (2**0) + ch2 * (2**8) + ch3 * (2**16) + (255 - ch4) * (1/100)
 * ```
 * 
 * so, in the context of `RGBA` channels, `id = R + G * 256 + B * 65536 + A / 100`
 * if fewer channels are available, then the multiplication with extra channels is simply discarded. for instance:
 * - in the case of `RGB`, `id = R + G * 256 + B * 65536`
 * - in the case of `LA`, `id = L + A * 256`
 * - etc...
 * 
 * you can always specify your own channels multipliers. the default is `[2**0, 2**8, 2**16, 1/100]`. <br>
 * in general, you would want to keep `RGBA = 0x000000FF` (or `id = 0`) for the background
*/

import { downloadBuffer } from "https://deno.land/x/kitchensink_ts@v0.5.6/browser.ts"
import { ClippedImage, HorizontalImageScroller, JAtlasManager } from "../../src/mod.ts"

const word_indexing_func = (r: number, g: number, b: number, a: number) => a === 0 ? 0 : (255 - a) / 100 + b * (2 ** 0) + g * (2 ** 8) + r * (2 ** 16)
const img = new Image()
let
	word_atlas_manager: JAtlasManager,
	hscroller: HorizontalImageScroller = new HorizontalImageScroller(document.body, 1400, 600)
img.onload = () => {
	let t0 = performance.now()
	word_atlas_manager = JAtlasManager.fromJAtlasImage(img, "./manuscript.jpg", word_indexing_func, (loaded_word_atlas_manager) => {
		loaded_word_atlas_manager.toJSON().then((json_str) => downloadBuffer(json_str, "manuscript.jpg.jatlas.json", "text/json"))
	})
	let t1 = performance.now()
	console.log(`${t1 - t0} ms`)
	for (const id of Object.keys(word_atlas_manager.entries)) {
		const clipped_img = new ClippedImage(word_atlas_manager, parseFloat(id))
		hscroller.addEntryLeft(clipped_img)
	}
}
img.src = "./manuscript.jpg.jatlas.png"
