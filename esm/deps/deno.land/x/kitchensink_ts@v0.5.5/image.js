/** utility functions for handling images along with canvas tools
 * @module
*/
import { positiveRect } from "./struct.js";
import { concatTyped, sliceSkipTypedSubarray } from "./typedbuffer.js";
/** check of the provided string is a base64 string, by simply observing if it starts with `"data:image/"` */
export const isBase64Image = (str) => str === undefined ? false : str.startsWith("data:image/");
/** get the header of a base64 image <br>
 * @example
 * ```ts
 * const img_uri = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAD..."
 * const img_header = getBase64ImageHeader(img_uri) // == "data:image/png;base64,"
 * ```
*/
export const getBase64ImageHeader = (str) => str.slice(0, str.indexOf(";base64,") + 8);
/** get the mime type of a base64 image <br>
 * @example
 * ```ts
 * const img_uri = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAD..."
 * const img_mime = getBase64ImageMIMEType(img_uri) // == "image/png"
 * ```
*/
export const getBase64ImageMIMEType = (str) => str.slice(5, str.indexOf(";base64,"));
/** get the body data portion of a base64 image <br>
 * @example
 * ```ts
 * const img_uri = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAD..."
 * const img_body = getBase64ImageBody(img_uri) // == "iVBORw0KGgoAAAANSUhEUgAAD..."
 * ```
*/
export const getBase64ImageBody = (str) => str.slice(str.indexOf(";base64,") + 8);
let multipurpose_canvas;
let multipurpose_ctx;
const init_multipurpose_canvas = () => {
    multipurpose_canvas = document.createElement("canvas");
    multipurpose_ctx = multipurpose_canvas.getContext("2d");
};
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
export const constructImageData = (img, crop_rect) => {
    const { width, height, x, y } = positiveRect({ x: 0, y: 0, width: Number(img.width), height: Number(img.height), ...crop_rect });
    if (!multipurpose_ctx)
        init_multipurpose_canvas();
    multipurpose_canvas.width = width;
    multipurpose_canvas.height = height;
    multipurpose_ctx.clearRect(0, 0, width, height);
    multipurpose_ctx.drawImage(img, -x, -y);
    return multipurpose_ctx.getImageData(0, 0, width, height);
};
/** get a grayscale intensity bitmap of multi-channel `pixel_buf` image buffer, with optional alpha that negates intensity if zero <br>
 * @param pixels_buf flattened pixel bytes
 * @param channels number of color channels (ie: bytes per pixel). for instance, you'd use `4` for RGBA, `3` for RGB, `1` for L, `2` for AL, etc...
 * @param alpha_channel specify which channel is the alpha channel, or leave it as `undefined` to dictate lack of thereof. for instance, you'd use `3` for RGB**A**, `0` for **A**L, and `undefined` for RGB
 * @param alpha_bias if alpha is present, you can specify the minimum alpha value required for the pixel to be visible. anything less will make the pixel dull
*/
export const intensityBitmap = (pixels_buf, channels, alpha_channel, alpha_bias = 1) => {
    const pixel_len = pixels_buf.length / channels, alpha_visibility = new Uint8ClampedArray(pixel_len).fill(1), intensity = new Uint8ClampedArray(pixel_len);
    if (alpha_channel !== undefined) {
        for (let i = 0; i < pixel_len; i++)
            alpha_visibility[i] = pixels_buf[i * channels + alpha_channel] < alpha_bias ? 0 : 1;
        pixels_buf = pixels_buf.filter((v, i) => (i % channels) === alpha_channel ? false : true); // remove alpha channel bytes from `pixel_buf` and redefine it
        channels--; // because alpha channel has been discarded
    }
    // channel by channel, sum each channel's value to intensity
    for (let ch = 0; ch < channels; ch++)
        for (let i = 0; i < pixel_len; i++)
            intensity[i] += pixels_buf[i * channels + ch];
    // finally, if necessary, multiply each `intensity` pixel by its `alpha_visibility`
    if (alpha_channel !== undefined)
        for (let i = 0; i < pixel_len; i++)
            intensity[i] *= alpha_visibility[i];
    return new Uint8Array(intensity.buffer);
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
export const getBoundingBox = (img_data, padding_condition, minimum_non_padding_value = 1) => {
    const { width, height, data } = img_data, channels = data.length / (width * height), rowAt = (y) => data.subarray((y * width) * channels, (y * width + width) * channels), colAt = (x) => {
        const col = new Uint8Array(height * channels);
        for (let y = 0; y < height; y++)
            for (let ch = 0; ch < channels; ch++)
                col[y * channels + ch] = data[(y * width + x) * channels + ch];
        return col;
    }, nonPaddingValue = (data_row_or_col) => {
        let non_padding_value = 0;
        for (let px = 0, len = data_row_or_col.length; px < len; px += channels)
            non_padding_value += padding_condition(data_row_or_col[px + 0], data_row_or_col[px + 1], data_row_or_col[px + 2], data_row_or_col[px + 3]);
        return non_padding_value;
    };
    console.assert(Number.isInteger(channels));
    let [top, left, bottom, right] = [0, 0, height, width];
    // find top bounding row
    for (; top < height; top++)
        if (nonPaddingValue(rowAt(top)) >= minimum_non_padding_value)
            break;
    // find bottom bounding row
    for (; bottom >= top; bottom--)
        if (nonPaddingValue(rowAt(bottom)) >= minimum_non_padding_value)
            break;
    // find left bounding column
    for (; left < width; left++)
        if (nonPaddingValue(colAt(left)) >= minimum_non_padding_value)
            break;
    // find right bounding column
    for (; right >= left; right--)
        if (nonPaddingValue(colAt(right)) >= minimum_non_padding_value)
            break;
    return {
        x: left,
        y: top,
        width: right - left,
        height: bottom - top,
    };
};
/** crop an {@link ImageData} or arbitrary channel {@link SimpleImageData} with the provided `crop_rect` <br>
 * the orignal `img_data` is not mutated, and the returned cropped image data contains data that has been copied over.
*/
export const cropImageData = (img_data, crop_rect) => {
    const { width, height, data } = img_data, channels = data.length / (width * height), crop = positiveRect({ x: 0, y: 0, width, height, ...crop_rect }), [top, left, bottom, right] = [crop.y, crop.x, crop.y + crop.height, crop.x + crop.width];
    console.assert(Number.isInteger(channels));
    // trim padding from top, left, bottom, and right
    const row_slice_len = crop.width * channels, skip_len = ((width - right) + (left - 0)) * channels, trim_start = (top * width + left) * channels, trim_end = ((bottom - 1) * width + right) * channels, cropped_data_rows = sliceSkipTypedSubarray(data, row_slice_len, skip_len, trim_start, trim_end), cropped_data = concatTyped(...cropped_data_rows), cropped_img_data = channels === 4 ?
        new ImageData(cropped_data, crop.width, crop.height) :
        {
            width: crop.width,
            height: crop.height,
            data: cropped_data,
            colorSpace: img_data.colorSpace ?? "srgb"
        };
    return cropped_img_data;
};
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
export const trimImagePadding = (img_data, padding_condition, minimum_non_padding_value = 1) => cropImageData(img_data, getBoundingBox(img_data, padding_condition, minimum_non_padding_value));
export const randomRGBA = (alpha) => {
    console.error("not implemented");
};
