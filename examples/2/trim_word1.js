import { constructImageData, trimImagePadding, getBoundingBox, cropImageData } from "kitchensink_ts/src/image.ts"

const img = new Image()
const white_padding = (r, g, b, a) => (3 * 255 ** 2) - (r ** 2 + g ** 2 + b ** 2) < (3 * 5 ** 2) ? 0.0 : 1.0
const transparent_padding = (r, g, b, a) => a === 255 ? 1.0 : 0.0
const word1_padding = (r, g, b, a) => b === 14 && a === 255 ? 1.0 : 0.0
const imagedata_to_image = (imagedata) => {
	var canvas = document.createElement("canvas")
	var ctx = canvas.getContext("2d")
	canvas.width = imagedata.width
	canvas.height = imagedata.height
	ctx.putImageData(imagedata, 0, 0)
	var image = new Image()
	image.src = canvas.toDataURL()
	return image
}
img.src = "./manuscript.jpg.jatlas.png" //"./word1.jpg"
img.onload = () => {
	const
		img_data = constructImageData(img),
		t0 = performance.now(),
		crop_rect = getBoundingBox(img_data, word1_padding, 1.0),
		t1 = performance.now(),
		cropped_img_data = cropImageData(img_data, crop_rect),
		t2 = performance.now(),
		new_img = imagedata_to_image(new ImageData(cropped_img_data.data, cropped_img_data.width, cropped_img_data.height))
	console.log(`bbox-time: ${t1 - t0} ms`, `crop-time: ${t2 - t1} ms`,)
	document.body.appendChild(new_img)
}
