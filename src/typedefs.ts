import { PureStep } from "./deps.ts"

export interface SizedRect {
	/** width of a sprite or rectangle. */
	width: number
	/** height of a sprite or rectangle. */
	height: number
}

export interface PositionedRect {
	/** x-position of a sprite or a rectangle, relative to its parent container. */
	x: number
	/** y-position of a sprite or a rectangle, relative to its parent container. */
	y: number
}

export type Rect = PositionedRect & SizedRect

export interface RectWithMask extends PositionedRect {
	width?: SizedRect["width"]
	height?: SizedRect["height"]
	mask: ImageBitmap
}

export type MaskedRect = (Rect & { mask?: ImageBitmap }) | RectWithMask

export type PromiseOrRegular<T> = Promise<T> | T

export interface LoadedImageWrapper<ARGS> {
	value: ImageBitmap
	args: ARGS
}

/** an image source "loader and saver" provides an invertible interface to {@link forward | load} or {@link backward | save} an image,
 * after it has been {@link test | tested} to verify that it is capable of loading the specific type of {@link SOURCE | source}.
*/
export abstract class ImageSource_LoaderAndSaver<SOURCE, ARGS = never> extends PureStep<Promise<SOURCE>, Promise<LoadedImageWrapper<ARGS>>> {
	/** a method that tests whether or not the source can be loaded by this image loader. */
	abstract test(test_source: PromiseOrRegular<SOURCE | any>): Promise<boolean>

	/** a method that loads the source of the image into an `ImageBitmap`. <br>
	 * this is method is called only after the {@link test | `test`} method verifies that this loader is capable of loading this kind of {@link SOURCE | source}.
	*/
	abstract forward(input: PromiseOrRegular<SOURCE>): Promise<LoadedImageWrapper<ARGS>>

	/** a method that saves input `ImageBitmap` back to the {@link SOURCE | source} kind. <br>
	 * this operation is not always viable. for example, you cannot save an image that you loaded from an HTTP URL back to the source. <br>
	 * in such cases, you can simply fake the saving operation, and pretend that the the image has been saved back to the source.
	*/
	abstract backward(input: PromiseOrRegular<LoadedImageWrapper<ARGS>>): Promise<SOURCE>
}

