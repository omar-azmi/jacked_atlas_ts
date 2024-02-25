import { PureStep, blobToBase64, get_bg_canvas, get_bg_ctx, } from "./deps.ts"


export const getBGCanvas = (min_width?: number | undefined, min_height?: number | undefined) => {
	const canvas = get_bg_canvas(min_width, min_height)
	min_width ??= 0
	min_height ??= 0
	if (canvas.width < min_width) { canvas.width = min_width }
	if (canvas.height < min_height) { canvas.height = min_height }
	return canvas
}

export const getBGCtx = (min_width?: number | undefined, min_height?: number | undefined) => {
	getBGCanvas(min_width, min_height)
	const ctx = get_bg_ctx()
	ctx.reset()
	return ctx
}

export const blob_fetcher = async (source: string | URL): Promise<Blob> => {
	const response = await fetch(source)
	return await response.blob()
}

export class Base64ImageLoader_Step extends PureStep<Promise<string>, Promise<ImageBitmap>> {
	async forward(input: Promise<string | URL>): Promise<ImageBitmap> {
		return await createImageBitmap(await blob_fetcher(await input))
	}
	async backward(input: Promise<ImageBitmap>): Promise<string> {
		const image = await input
		getBGCtx(image.width, image.height).drawImage(image, 0, 0)
		const blob = await getBGCanvas().convertToBlob({ type: "image/png", quality: 1 })
		return blobToBase64(blob)
	}
}

export const base64image_loader_step = new Base64ImageLoader_Step()

/** test if a certain `ImageBitmap` has been closed.
 * the way it is done is simply by testing if both its `width` and `height` are zero.
 * this works because whenever the `ImageBitmap.close()` method is called, it sets the dimensions to zero.
*/
export const imagebitmap_is_closed = (image?: ImageBitmap): boolean => {
	return image ? image.width + image.height <= 0 : true
}

export const imagebitmap_deletion_action = (deleted_key: any, deleted_image: ImageBitmap) => { deleted_image.close() }

export const rgbaToHex = (rgba: [r: number, g: number, b: number, a: number]) => "#" + rgba.map(x => {
	const hex = x.toString(16)
	return hex.length === 2 ? hex : "0" + hex
}).join("")


