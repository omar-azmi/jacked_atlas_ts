/** utility functions for common object structures
 * @module
*/
/** represents a 2d rectangle. compatible with {@link DOMRect}, without its inherited annoying readonly fields */
export type Rect = {
    x: number;
    y: number;
    width: number;
    height: number;
};
/** represents an `ImageData` with optional color space information */
export interface SimpleImageData extends Omit<ImageData, "colorSpace" | "data"> {
    data: Uint8ClampedArray | Uint8Array;
    colorSpace?: PredefinedColorSpace;
}
/** get an equivalent rect where all dimensions are positive */
export declare const positiveRect: (r: Rect) => Rect;
