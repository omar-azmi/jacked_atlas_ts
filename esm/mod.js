var _a;
import { blobToBase64 } from "./deps/deno.land/x/kitchensink_ts@v0.5.5/browser.js";
import { constructImageData, getBase64ImageBody, getBase64ImageHeader, isBase64Image } from "./deps/deno.land/x/kitchensink_ts@v0.5.5/image.js";
import { sliceIntervalsTypedSubarray } from "./deps/deno.land/x/kitchensink_ts@v0.5.5/typedbuffer.js";
/** TODO:
 * - recursive/treelike/nested clipmasks or jatlas, where the parent `JAtlasEntry` can be used as the `source` for the child `entries`
*/
const DEBUG = true;
const clipmask_data_format = "image/webp", clipmask_offcanvas = new OffscreenCanvas(10, 10), clipmask_offctx = clipmask_offcanvas.getContext("2d", { willReadFrequently: true });
clipmask_offctx.imageSmoothingEnabled = false;
export class ClipMask {
    constructor(src_url, rect) {
        Object.defineProperty(this, "rect", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        /** file path of the source image, or base64 data uri <br>
         * if a base64 data uri is provided, then once it has been turned trasnparent and converted into `this.data_uri`, `this.src_url` will be deleted <br>
         * at any given time, one of either `this.src_url` or `this.data_blob` will be present
        */
        Object.defineProperty(this, "src_url", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "data_blob", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        /** load an image from a local path or url, such as: `"./bitmasks/juice.png"` or `"https://picsum.photos/200/300?grayscale"` */
        Object.defineProperty(this, "fromURL", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: (src_url, rect) => {
                this.src_url = src_url;
                const img = new Image();
                img.src = src_url;
                return img.decode()
                    .then(() => {
                    const { width: w, height: h } = img;
                    rect.width = w;
                    rect.height = h;
                    clipmask_offcanvas.width = w;
                    clipmask_offcanvas.height = h;
                    clipmask_offctx.globalCompositeOperation = "copy";
                    clipmask_offctx.drawImage(img, 0, 0);
                    const { data } = clipmask_offctx.getImageData(0, 0, w, h);
                    return this.fromBuffer(data, rect);
                })
                    .catch(() => { throw new Error(`failed to load url:\n\t${src_url}`); });
            }
        });
        /** load an image from a string of data uri, such as: `"data:image/gif;base64,R0l..."` */
        Object.defineProperty(this, "fromDataURI", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: (data_uri, rect) => {
                return this.fromURL(data_uri, rect);
            }
        });
        /** load an image from  a `Uint8Array` of RGBA pixels. the width and height must be defined in the passed `rect` */
        Object.defineProperty(this, "fromBuffer", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: async (buf, rect) => {
                rect.x ??= 0;
                rect.y ??= 0;
                this.rect = rect;
                clipmask_offcanvas.width = rect.width;
                clipmask_offcanvas.height = rect.height;
                clipmask_offctx.globalCompositeOperation = "copy";
                clipmask_offctx.putImageData(new ImageData(ClipMask.turnTransparent(buf), rect.width, rect.height), 0, 0);
                this.data_blob = await clipmask_offcanvas.convertToBlob({ type: clipmask_data_format });
                if (isBase64Image(this.src_url))
                    this.src_url = undefined;
                return;
            }
        });
        Object.defineProperty(this, "clearDataBlob", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: () => this.data_blob = undefined
        });
        Object.defineProperty(this, "clipImage", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: async (img) => {
                if (this.data_blob === undefined)
                    await this.fromURL(this.src_url, this.rect);
                return createImageBitmap(this.data_blob).then(mask_img_bitmap => {
                    clipmask_offcanvas.width = this.rect.width;
                    clipmask_offcanvas.height = this.rect.height;
                    clipmask_offctx.globalCompositeOperation = "copy";
                    clipmask_offctx.drawImage(mask_img_bitmap, 0, 0);
                    clipmask_offctx.globalCompositeOperation = "source-in";
                    clipmask_offctx.drawImage(img, -this.rect.x, -this.rect.y);
                    return clipmask_offcanvas;
                });
            }
        });
        this.src_url = src_url;
        this.rect = { x: 0, y: 0, width: 1, height: 1, ...rect };
    }
}
/** turn the provided buffer of pixels to become transparent where a black pixel is present */
Object.defineProperty(ClipMask, "turnTransparent", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: (buf) => {
        // turn black pixels completely transparent
        for (let i = 0, len = buf.length * 4; i < len; i += 4)
            if (buf[i] + buf[i + 1] + buf[i + 2] === 0)
                buf[i + 3] = 0;
        return new Uint8ClampedArray(buf.buffer);
    }
});
const default_id_numbering_func = (r, g, b, a) => a === 0 ? 0 : (255 - a) / 100 + b * (2 ** 0) + g * (2 ** 8) + r * (2 ** 16);
export class JAtlasManager {
    constructor(src_url) {
        Object.defineProperty(this, "source", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "entries", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: {}
        });
        Object.defineProperty(this, "imgloaded", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "img", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "loadImage", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: (src_url) => {
                this.source = src_url;
                this.img = new Image();
                this.img.src = src_url;
                this.imgloaded = this.img.decode()
                    .then(() => this.img)
                    .catch(() => { throw new Error(`failed to load url:\n\t${src_url}`); });
                return this.imgloaded;
            }
        });
        Object.defineProperty(this, "addEntry", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: (entry, id) => {
                if (typeof entry === "string")
                    entry = JSON.parse(entry);
                const { x, y, width, height, kind, data } = entry, mask = new ClipMask(kind + data, { x, y, width, height });
                this.entries[id ?? Date.now() % 1000000000] = mask;
            }
        });
        Object.defineProperty(this, "addEntries", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: (entries) => {
                for (const [id, entry] of Object.entries(entries))
                    this.addEntry(entry, parseInt(id));
            }
        });
        Object.defineProperty(this, "getEntryImage", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: async (id) => {
                await this.imgloaded;
                return this.entries[id].clipImage(this.img);
            }
        });
        /** TODO
        toJAtlasImage = () => {}
        */
        Object.defineProperty(this, "toObject", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: async () => {
                const new_jatlas_object = {
                    source: this.source.toString(),
                    entries: {}
                };
                for (const [id, clipmask] of Object.entries(this.entries)) {
                    let kind, data;
                    if (clipmask.data_blob) {
                        kind = "data:" + clipmask.data_blob.type + ";base64,";
                        data = await blobToBase64(clipmask.data_blob);
                    }
                    else if (isBase64Image(clipmask.src_url)) {
                        kind = getBase64ImageHeader(clipmask.src_url);
                        data = getBase64ImageBody(clipmask.src_url);
                    }
                    else {
                        kind = "path";
                        data = clipmask.src_url;
                    }
                    new_jatlas_object.entries[parseFloat(id)] = { ...clipmask.rect, kind, data };
                }
                return new_jatlas_object;
            }
        });
        Object.defineProperty(this, "toJSON", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: async () => JSON.stringify(await this.toObject())
        });
        if (src_url)
            this.loadImage(src_url);
    }
}
_a = JAtlasManager;
Object.defineProperty(JAtlasManager, "fromObject", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: (jatlas_object) => {
        const new_atlas_manager = new JAtlasManager(jatlas_object.source);
        new_atlas_manager.addEntries(jatlas_object.entries);
        return new_atlas_manager;
    }
});
Object.defineProperty(JAtlasManager, "fromJSON", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: (atlas_json_text) => JAtlasManager.fromObject(JSON.parse(atlas_json_text))
});
Object.defineProperty(JAtlasManager, "fromURL", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: (json_url) => fetch(json_url).then(async (response) => JAtlasManager.fromJSON(await response.text()))
});
Object.defineProperty(JAtlasManager, "fromJAtlasImage", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: (img, img_src_url, id_numbering_func, onload_callback) => {
        // id_numbering_func(r, g, b, a) === 0 must always be dedicated to background if (r, g, b, a) is a background pixel color
        // algorithm: we do a continuous horizontal scan line over img_data.data, then every horizontal index range of pixels of matching id is appended to a dictionary
        // once scanline is over, we convert the flat indexes of the ranges into (x, y) coordinates, then we find their range's max and min x and y to get the left, right top, bottom
        // bounding box or the rect of that particular id.
        // using the bounding box rect, we can offset the flat indexes of the ranges to begin from the top left, and then we fill in (255, 255, 255 255) everywhere in the ranges subarray of the id on a mini imageData.data canvas
        return _a.fromJAtlasImageData(constructImageData(img), img_src_url, id_numbering_func, onload_callback);
    }
});
Object.defineProperty(JAtlasManager, "fromJAtlasImageData", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: (img_data, img_src_url, id_numbering_func, onload_callback) => {
        id_numbering_func ??= default_id_numbering_func;
        const { width, height, data } = img_data, channels = data.length / (width * height), id_pixel_intervals = {};
        console.assert(Number.isInteger(channels));
        let [prev_id, id] = [0, 0];
        for (let px = 0, len = data.length; px < len; px += channels) {
            id = id_numbering_func(data[px + 0], data[px + 1], data[px + 2], data[px + 3]);
            if (id !== prev_id) {
                id_pixel_intervals[id] ??= [];
                // register the current pixel as the start of an id_interval, only if id number is positive
                if (id > 0)
                    id_pixel_intervals[id].push(px);
                // register the previous pixel as the end (exclusive) of the previous id_interval, only if prev_id number is positive
                if (prev_id > 0)
                    id_pixel_intervals[prev_id].push(px);
            }
            prev_id = id;
        }
        // register the end index (excusive) of the final id as the final pixel
        id_pixel_intervals[prev_id]?.push(data.length);
        delete id_pixel_intervals[0];
        // convert flat index of image data to (x, y) coordinates and find the bounding box of each id
        const new_atlas_manager = new _a(img_src_url), mask_from_buffer_promises = [];
        for (const [id, intervals] of Object.entries(id_pixel_intervals)) {
            let [min_x, min_y, max_x, max_y] = [width, height, 0, 0];
            for (let i = 0, len = intervals.length; i < len; i += 2) {
                const start_px = intervals[i] / channels, x = start_px % width, y = (start_px / width) | 0;
                if (x < min_x)
                    min_x = x;
                if (y < min_y)
                    min_y = y;
            }
            for (let i = 1, len = intervals.length; i < len; i += 2) {
                const end_px = intervals[i] / channels, x = (end_px) % width, y = ((end_px) / width) | 0;
                if (x > max_x)
                    max_x = x;
                if (y > max_y)
                    max_y = y;
            }
            max_x++;
            max_y++;
            const mask = new ClipMask(), [x, y, w, h] = [min_x, min_y, max_x - min_x, max_y - min_y], 
            /** the equation for `mask_intervals` can be easily derived as follows:
             * - `p0 = px of data`, `y0 = y-coords of pixel in data`, `x0 = x-coords of pixel in data`, `w0 = width of data`, `c0 = channels of data`
             * - `p1 = px of mask`, `y1 = y-coords of pixel in mask`, `x1 = x-coords of pixel in mask`, `w1 = width of mask`, `c1 = channels of mask`
             * - `y = y-coords of mask's rect`, `x = x-coords of mask's rect`
             * ```ts
             * let
             * 		p0 = (x0 + y0 * w0) * c0,
             * 		x0 = (p0 / c0) % w0,
             * 		y0 = trunc(p0 / (c0 * w0)),
             * 		p1 = (x1 + y1 * w1) * c1,
             * 		x1 = (p1 / c1) % w1,
             * 		y1 = trunc(p1 / (c1 * w1)),
             * 		x  = x0 - x1,
             * 		y  = y0 - y1
             * so {
             * -> p1 / c1 = x1 + y1 * w1
             * -> p1 / c1 = (x0 - x) + (y0 - y) * w1
             * -> p1 / c1 = (((p0 / c0) % w0) - x) + (((p0 / c0) / w0 | 0) - y) * w1
             * -> p1 = c1 * ((((p0 / c0) % w0) - x) + (((p0 / c0) / w0 | 0) - y) * w1)
             * }
             * ```
            */
            mask_intervals = intervals.map((px) => 4 * (((px / channels % width) - x) + ((px / (channels * width) | 0) - y) * w)), rgba_buf = new Uint8Array(w * h * 4).fill(0);
            for (const sub_arr of sliceIntervalsTypedSubarray(rgba_buf, mask_intervals))
                sub_arr.fill(255);
            mask_from_buffer_promises.push(mask.fromBuffer(rgba_buf, { x, y, width: w, height: h }));
            new_atlas_manager.entries[parseFloat(id)] = mask;
        }
        if (onload_callback)
            Promise.all(mask_from_buffer_promises).then(() => onload_callback(new_atlas_manager));
        return new_atlas_manager;
    }
});
export class ClippedImage {
    constructor(jatlas_manager, entry_id) {
        Object.defineProperty(this, "jatlas_manager", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "entry_id", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "getImage", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: () => this.jatlas_manager.getEntryImage(this.entry_id)
        });
        Object.defineProperty(this, "getRect", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: () => this.jatlas_manager.entries[this.entry_id].rect
        });
        this.jatlas_manager = jatlas_manager;
        this.entry_id = entry_id;
    }
}
export class HorizontalImageScroller {
    constructor(append_to, width = 300, height = 200) {
        Object.defineProperty(this, "canvas", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "ctx", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "entries", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "left", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "right", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "appendTo", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: (element) => element.appendChild(this.canvas)
        });
        Object.defineProperty(this, "addEntryLeft", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: async (entry) => {
                this.entries.unshift(entry);
                const width = entry instanceof ClippedImage ? entry.getRect().width : entry.width;
                this.left -= width;
                const x = this.left, img = entry instanceof ClippedImage ? await entry.getImage() : entry;
                this.ctx.drawImage(img, x, 0);
            }
        });
        Object.defineProperty(this, "addEntryRight", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: async (entry) => {
                this.entries.push(entry);
                const width = entry instanceof ClippedImage ? entry.getRect().width : entry.width, x = this.right;
                this.right += width;
                const img = entry instanceof ClippedImage ? await entry.getImage() : entry;
                this.ctx.drawImage(img, x, 0);
            }
        });
        this.canvas = document.createElement("canvas");
        this.ctx = this.canvas.getContext("2d");
        this.canvas.width = width;
        this.canvas.height = height;
        this.ctx.translate((width / 2) | 0, 0);
        if (DEBUG) {
            this.ctx.lineWidth = 5;
            this.ctx.moveTo(0, 0);
            this.ctx.lineTo(0, height);
            this.ctx.stroke();
            this.ctx.scale(0.25, 0.25);
        }
        if (append_to)
            this.appendTo(append_to);
    }
}
