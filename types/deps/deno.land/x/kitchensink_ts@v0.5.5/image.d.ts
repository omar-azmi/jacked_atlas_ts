/** utility functions for handling images along with canvas tools
 * @module
*/
import { Rect, SimpleImageData } from "./struct.js";
export type ImageMIMEType = `image/${"gif" | "jpeg" | "jpg" | "png" | "svg+xml" | "webp"}`;
export type Base64ImageHeader = `data:${ImageMIMEType};base64,`;
export type Base64ImageString = `${Base64ImageHeader}${string}`;
/** check of the provided string is a base64 string, by simply observing if it starts with `"data:image/"` */
export declare const isBase64Image: (str?: string) => str is `data:image/gif;base64,${string}` | `data:image/jpeg;base64,${string}` | `data:image/jpg;base64,${string}` | `data:image/png;base64,${string}` | `data:image/svg+xml;base64,${string}` | `data:image/webp;base64,${string}`;
/** get the header of a base64 image <br>
 * @example
 * ```ts
 * const img_uri = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAD..."
 * const img_header = getBase64ImageHeader(img_uri) // == "data:image/png;base64,"
 * ```
*/
export declare const getBase64ImageHeader: (str: Base64ImageString) => Base64ImageHeader;
/** get the mime type of a base64 image <br>
 * @example
 * ```ts
 * const img_uri = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAD..."
 * const img_mime = getBase64ImageMIMEType(img_uri) // == "image/png"
 * ```
*/
export declare const getBase64ImageMIMEType: (str: Base64ImageString) => ImageMIMEType;
/** get the body data portion of a base64 image <br>
 * @example
 * ```ts
 * const img_uri = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAD..."
 * const img_body = getBase64ImageBody(img_uri) // == "iVBORw0KGgoAAAANSUhEUgAAD..."
 * ```
*/
export declare const getBase64ImageBody: (str: Base64ImageString) => string;
/** extract the {@link ImageData} from an image source (of type {@link CanvasImageSource}), with optional cropping. <br>
 * due to the fact that this function utilizes a `canvas`, it is important to note that the output `ImageData` is sometimes lossy in nature,
 * because gpu-accelarated web-browsers *approximate* the colors, and also due to rounding errors from/to internal float-valued colors and output
 * integer-valued colors. <br>
 * but generally speaking, the `ImageData` can be lossless if all of the following are satisfied:
 * - disable gpu-acceleration of your web-browser, through the `flags` page
 * - your `img` source has either no alpha-channel, or 100% visible alpha-channel throughout (ie non-transparent image)
 * - you have pre-multiplied alpha disabled (this part can be achieved by this library, but I havn't looked into it yet)
 * @param img an image source can be an `HTMLImageElement`, `HTMLCanvasElement`, `ImageBitmap`, etc..
 * @param crop_rect dimension of the cropping rectangle. leave as `undefined` if you wish not to crop, or only provide a partial {@link Rect}
*/
export declare const constructImageData: (img: CanvasImageSource | HTMLImageElement, crop_rect?: Partial<Rect>) => ImageData;
/** get a grayscale intensity bitmap of multi-channel `pixel_buf` image buffer, with optional alpha that negates intensity if zero <br>
 * @param pixels_buf flattened pixel bytes
 * @param channels number of color channels (ie: bytes per pixel). for instance, you'd use `4` for RGBA, `3` for RGB, `1` for L, `2` for AL, etc...
 * @param alpha_channel specify which channel is the alpha channel, or leave it as `undefined` to dictate lack of thereof. for instance, you'd use `3` for RGB**A**, `0` for **A**L, and `undefined` for RGB
 * @param alpha_bias if alpha is present, you can specify the minimum alpha value required for the pixel to be visible. anything less will make the pixel dull
*/
export declare const intensityBitmap: (pixels_buf: Uint8Array | Uint8ClampedArray, channels: number, alpha_channel: number | undefined, alpha_bias?: number) => Uint8Array;
type PaddingCondition = {
    1: (v: number) => number;
    2: (l: number, a: number) => number;
    3: (r: number, g: number, b: number) => number;
    4: (r: number, g: number, b: number, a: number) => number;
};
/** get the bounding box {@link Rect} of an image, based on an accumulative `padding_condition` function that should return
 * `0.0` for padding/whitespace/empty pixels, and positive numbers (usually `1.0`) for non-padding/important pixels. <br>
 * if the summation of `padding_condition` applied onto a particular row, or column of pixels is less than
 * `minimum_non_padding_value`, then that entire row/column will be counted as an empty padding space. <br>
 * else if the summation of `padding_condition` is greater than `minimum_non_padding_value`, then that specific
 * row/column will be counted as one of the bounding box's sides. <br>
 * take a look at {@link trimImagePadding} to get an understanding of a potential use case. <br>
 * you do not need to specify the number of channels in your `img_data`, because it will be calculated automatically
 * via `img_data.width`, `img_data.height`, and `img_data.data.length` <br>
 * ### a note on performance
 * almost all performance depends purely on the complexity of your `padding_condition` <br>
 * if the equations in `padding_condition` use square-roots, exponents, if conditions, then expect a major performance drop <br>
 * if your equations consist only of `+, -, *, /`, then the performance will be much faster. <br>
 * I've benchmarked this function, and defining `rowAt`, `colAt`, and `nonPaddingValue` outside of this function, instead of
 * inlining them makes no difference. <br>
 * also, substituting `padding_condition` in `nonPaddingValue` with the actual arithmetic function via inlining (and thus
 * avoiding constant function calls) makes no difference, thanks to JIT doing the inlining on its own in V8. <br>
 * finally, the `colAt` inline function is suprisingly super fast (close to `rowAt`). and so, bounding top and bottom
 * is not at all visibly quicker than bounding left and right.
*/
export declare const getBoundingBox: <Channels extends 2 | 1 | 3 | 4 = 4>(img_data: SimpleImageData, padding_condition: PaddingCondition[Channels], minimum_non_padding_value?: number) => Rect;
/** crop an {@link ImageData} or arbitrary channel {@link SimpleImageData} with the provided `crop_rect` <br>
 * the orignal `img_data` is not mutated, and the returned cropped image data contains data that has been copied over.
*/
export declare const cropImageData: <Channels extends 2 | 1 | 3 | 4 = 4>(img_data: SimpleImageData, crop_rect: Partial<Rect>) => SimpleImageData;
/** trim the padding of an image based on sum of pixel conditioning of each border's rows and columns <br>
 * @example
 * for example, to trim the whitespace border pixels of an "RGBA" image, irrespective of the alpha,
 * and a minimum requirement of at least three non-near-white pixels in each border row and column,
 * you would design your `padding_condition` as such:
 * ```ts
 * // distance between pixel's rgb and the white color `(255, 255, 255,)`, should be less than `10 * Math.sqrt(3)` for the pixel to be considered near-white
 * white_padding = (r: number, g: number, b: number, a: number) => (3 * 255**2) - (r**2 + g**2 + b**2) < (3 * 5**2) ? 0.0 : 1.0
 * trimmed_img_data = trimImagePadding(img_data, white_padding, 3.0)
 * ```
*/
export declare const trimImagePadding: <Channels extends 2 | 1 | 3 | 4>(img_data: SimpleImageData, padding_condition: PaddingCondition[Channels], minimum_non_padding_value?: number) => SimpleImageData;
export declare const randomRGBA: (alpha?: undefined | number) => void;
export {};
