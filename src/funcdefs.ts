import { get_bg_canvas, get_bg_ctx } from "./deps.ts"
import { PromiseOrRegular } from "./typedefs.ts"


export const getBGCanvas = (min_width?: number | undefined, min_height?: number | undefined, force_resize?: boolean) => {
	const canvas = get_bg_canvas(min_width, min_height)
	min_width ??= 0
	min_height ??= 0
	if (force_resize || (canvas.width < min_width)) { canvas.width = min_width }
	if (force_resize || (canvas.height < min_height)) { canvas.height = min_height }
	return canvas
}

export const getBGCtx = (min_width?: number | undefined, min_height?: number | undefined, force_resize?: boolean) => {
	getBGCanvas(min_width, min_height, force_resize)
	const ctx = get_bg_ctx()
	ctx.reset()
	return ctx
}

// TODO: purge and remove dependance on this function, OR make all every fetchers rely on this function 
export const blob_fetcher = async (source: PromiseOrRegular<string | URL>): Promise<Blob> => {
	const response = await fetch(await source)
	return await response.blob()
}

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


