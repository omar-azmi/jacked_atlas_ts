import { Base64ImageHeader, Base64ImageString } from "./deps/deno.land/x/kitchensink_ts@v0.5.5/image.js";
import { Rect, SimpleImageData } from "./deps/deno.land/x/kitchensink_ts@v0.5.5/struct.js";
type FilePath = string;
export interface JAtlasEntry {
    name?: string;
    x: number;
    y: number;
    width: number;
    height: number;
    kind: Base64ImageHeader | "path" | "H" | "V" | "P" | "Z";
    data: string;
}
export interface JAtlas {
    /** image source to apply this atlas onto */
    source: FilePath | Base64ImageString;
    /** atlas entries of the source */
    entries: {
        [id: number]: JAtlasEntry;
    };
}
export declare class ClipMask {
    rect: Rect;
    /** file path of the source image, or base64 data uri <br>
     * if a base64 data uri is provided, then once it has been turned trasnparent and converted into `this.data_uri`, `this.src_url` will be deleted <br>
     * at any given time, one of either `this.src_url` or `this.data_blob` will be present
    */
    src_url?: FilePath | Base64ImageString;
    data_blob?: Blob;
    constructor(src_url?: string, rect?: Partial<Rect>);
    /** load an image from a local path or url, such as: `"./bitmasks/juice.png"` or `"https://picsum.photos/200/300?grayscale"` */
    fromURL: (src_url: string, rect: Partial<Rect>) => Promise<void>;
    /** load an image from a string of data uri, such as: `"data:image/gif;base64,R0l..."` */
    fromDataURI: (data_uri: string, rect: Partial<Rect>) => Promise<void>;
    /** load an image from  a `Uint8Array` of RGBA pixels. the width and height must be defined in the passed `rect` */
    fromBuffer: (buf: Uint8Array | Uint8ClampedArray, rect: {
        x?: number;
        y?: number;
        width: number;
        height: number;
    }) => Promise<void>;
    /** turn the provided buffer of pixels to become transparent where a black pixel is present */
    static turnTransparent: (buf: Uint8Array | Uint8ClampedArray) => Uint8ClampedArray;
    clearDataBlob: () => undefined;
    clipImage: (img: CanvasImageSource) => Promise<OffscreenCanvas>;
}
/** represents a function that takes 4 or less arguments as each pixel's color (0 to 255), and spits out a `float` id for the provided color <br>
 * this pixel color identification is used by {@link JAtlasManager.fromJAtlasImage} and {@link JAtlasManager.fromJAtlasImageData} <br>
 * in general, any id equal to `0` or less (negative) is considered background, and thus omitted <br>
 * while, ids greater than `0` are registered in {@link JAtlasManager.entries} <br>
 * the static methods mentioned above fallback to a default pixel identification function when none is provided: <br>
 * ```ts
 * const default_id_numbering_func: IDNumberingFunc = (r, g, b, a) => a === 0 ? 0 : (255 - a) / 100 + b * (2 ** 0) + g * (2 ** 8) + r * (2 ** 16)
 * ```
*/
export type IDNumberingFunc = (r: number, g: number, b: number, a: number) => number;
export declare class JAtlasManager {
    source: FilePath | Base64ImageString;
    entries: {
        [id: number]: ClipMask;
    };
    imgloaded: Promise<this["img"]>;
    img?: HTMLImageElement;
    constructor(src_url?: FilePath | Base64ImageString);
    loadImage: (src_url: FilePath | Base64ImageString) => Promise<this["img"]>;
    addEntry: (entry: JAtlasEntry | string, id?: number) => void;
    addEntries: (entries: {
        [id: number]: JAtlasEntry;
    }) => void;
    getEntryImage: (id: number) => Promise<OffscreenCanvas>;
    static fromObject: (jatlas_object: JAtlas) => JAtlasManager;
    static fromJSON: (atlas_json_text: string) => JAtlasManager;
    static fromURL: (json_url: FilePath) => Promise<JAtlasManager>;
    static fromJAtlasImage: (img: CanvasImageSource, img_src_url?: JAtlasManager["source"], id_numbering_func?: IDNumberingFunc, onload_callback?: ((loaded_new_atlas_manager: JAtlasManager) => void) | undefined) => JAtlasManager;
    static fromJAtlasImageData: <Channels extends 2 | 1 | 3 | 4 = 4>(img_data: SimpleImageData, img_src_url?: JAtlasManager["source"], id_numbering_func?: IDNumberingFunc, onload_callback?: ((loaded_new_atlas_manager: JAtlasManager) => void) | undefined) => JAtlasManager;
    /** TODO
    toJAtlasImage = () => {}
    */
    toObject: () => Promise<JAtlas>;
    toJSON: () => Promise<string>;
}
export declare class ClippedImage {
    jatlas_manager: JAtlasManager;
    entry_id: keyof this["jatlas_manager"]["entries"] & number;
    constructor(jatlas_manager: JAtlasManager, entry_id: number);
    getImage: () => Promise<OffscreenCanvas>;
    getRect: () => Rect;
}
export declare class HorizontalImageScroller {
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    entries: Array<CanvasImageSource | ClippedImage>;
    left: number;
    right: number;
    constructor(append_to?: HTMLElement, width?: number, height?: number);
    appendTo: (element: HTMLElement) => HTMLCanvasElement;
    addEntryLeft: (entry: this["entries"][number]) => Promise<void>;
    addEntryRight: (entry: this["entries"][number]) => Promise<void>;
}
export {};
