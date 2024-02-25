import { Invertible, Optional } from "./deps.ts"

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

/** the input object fed to an {@link ImageSource_Codec | image codec's} {@link ImageSource_Codec.forward | `forward`} method, to get a loaded image bitmap {@link ImageCodecOutput | (wrapped) object} <br>
 * it is also the output of the same image codec's {@link ImageSource_Codec.backward | `backward`} method.
*/
export interface ImageCodecInput<SOURCE> {
	/** specify the {@link ImageSource_Codec.format | name} of the codec to use when loading the source. */
	format?: string
	/** the source of image is placed in this member. */
	source: SOURCE
}

/** the output object of an {@link ImageSource_Codec | image codec's} {@link ImageSource_Codec.forward | `forward`} method. <br>
 * it can also be used as an input by the same image codec's {@link ImageSource_Codec.backward | `backward`} method to convert the image back to the {@link ImageCodecInput | source object}.
*/
export interface ImageCodecOutput<ARGS> {
	/** the {@link ImageSource_Codec.format | name} of the codec from which this output originated from. <br>
	 * this information is used when to figure out which codec to use when reverting this image back to its source.
	*/
	format: string
	/** the image loaded by a {@link ImageSource_Codec | image codec} */
	image: ImageBitmap
	/** encapsulates any args that were used by the {@link ImageSource_Codec | image codec} when loading the source of the image.
	 * these args will be required when saving the image back to the source.
	*/
	args: ARGS
}

/** an image source "codec" provides an invertible interface to {@link forward | load} or {@link backward | save} an image,
 * after it has been {@link test | tested} to verify that it is capable of loading the specific type of {@link INPUT | source}.
*/
export abstract class ImageSource_Codec<
	INPUT extends ImageCodecInput<any>,
	OUTPUT extends ImageCodecOutput<any>
> extends Invertible<Promise<INPUT>, Promise<OUTPUT>> {
	/** a `format` member is stamped onto all {@link forward | `forward`} method's {@link ImageCodecOutput.format | outputs},
	 * so that their codec can be re-identified before applying the {@link backward | reverse} transformation to get back the source.
	*/
	abstract format: string

	/** a method that tests whether or not the source can be loaded by this image codec. <br>
	 * it must absolutely not rely on the input's {@link ImageCodecOutput.format | `format`} member,
	 * since the test method is designed to be only be used when **no** {@link ImageCodecOutput.format | `format`} member has been specified.
	*/
	abstract test(test_input_source: PromiseOrRegular<ImageCodecInput<any>>): Promise<boolean>

	/** a method that loads the source of the image into an `ImageBitmap`. <br>
	 * this is method is called only after the {@link test | `test`} method verifies that this codec is capable of loading this kind of {@link INPUT | source}.
	*/
	abstract forward(input: PromiseOrRegular<INPUT>): Promise<OUTPUT>

	/** a method that saves input `ImageBitmap` back to the {@link INPUT | source} kind. <br>
	 * this operation is not always viable. for example, you cannot save an image that you loaded from an HTTP URL back to the source. <br>
	 * in such cases, you can simply fake the saving operation, and pretend that the the image has been saved back to the source.
	*/
	abstract backward(input: PromiseOrRegular<Optional<OUTPUT, "format">>): Promise<INPUT>
}
