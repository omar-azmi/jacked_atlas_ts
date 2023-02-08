export { blobToBase64 } from "https://deno.land/x/kitchensink_ts@v0.5.7/browser.ts"
export { AnyImageSource, Base64ImageString, ImageBlob, constructImageBitmapSource, constructImageBlob, constructImageData, coordinateTransformer, getBGCanvas, getBGCtx } from "https://deno.land/x/kitchensink_ts@v0.5.7/image.ts"
export { Rect, SimpleImageData } from "https://deno.land/x/kitchensink_ts@v0.5.7/struct.ts"
export { Intervals, sliceIntervalsTypedSubarray } from "https://deno.land/x/kitchensink_ts@v0.5.7/typedbuffer.ts"
export { UnitInterval } from "https://deno.land/x/kitchensink_ts@v0.5.7/typedefs.ts"

export type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D

export const rgbaToHex = (rgba: [r: number, g: number, b: number, a: number]) => "#" + rgba.map(x => {
	const hex = x.toString(16)
	return hex.length === 2 ? hex : "0" + hex
}).join("")
