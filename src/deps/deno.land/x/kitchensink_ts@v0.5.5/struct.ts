/** utility functions for common object structures
 * @module
*/

/** represents a 2d rectangle. compatible with {@link DOMRect}, without its inherited annoying readonly fields */
export type Rect = { x: number, y: number, width: number, height: number }

/** represents an `ImageData` with optional color space information */
export interface SimpleImageData extends Omit<ImageData, "colorSpace" | "data"> {
	data: Uint8ClampedArray | Uint8Array
	colorSpace?: PredefinedColorSpace
}

/** get an equivalent rect where all dimensions are positive */
export const positiveRect = (r: Rect): Rect => {
	let { x, y, width, height } = r
	if (width < 0) {
		width *= -1 // width is now positive
		x -= width // x has been moved further to the left
	}
	if (height < 0) {
		height *= -1 // height is now positive
		y -= height // y has been moved further to the top
	}
	return { x, y, width, height }
}
