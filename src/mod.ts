import { ImagePool } from "./image_pool.ts"


const image_pool = new ImagePool<string>(10)
image_pool.set("1", {
	width: 0,
	height: 0,
	source: "../examples/1/source_image.jpg",
})

image_pool.get("1", (value) => {
	console.log(value.width, value.height, value.image)
})


const mushaf_id = "00" // (0 to 255) so 1 byte
const surah_id = "001" // (1 to 114) so 1 byte or 8bits (or 7 if we wish to be conservative)
const word_id = "00000" // (0 to 12500) so 14 bits (the word `0` is reserved for background)
const part_id = "0" // (0 to 3) so 2 bits
// total 1 byte + 1 byte + 2 bytes = 4 bytes


