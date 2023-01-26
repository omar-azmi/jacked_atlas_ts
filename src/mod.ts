import { blobToBase64 } from "https://deno.land/x/kitchensink_ts@v0.5.6/browser.ts"
import { Base64ImageString, ImageMIMEType, constructImageData, isBase64Image } from "https://deno.land/x/kitchensink_ts@v0.5.6/image.ts"
import { Rect, SimpleImageData } from "https://deno.land/x/kitchensink_ts@v0.5.6/struct.ts"
import { Intervals, sliceIntervalsTypedSubarray } from "https://deno.land/x/kitchensink_ts@v0.5.6/typedbuffer.ts"

/** TODO:
 * - recursive/treelike/nested clipmasks or jatlas, where the parent `JAtlasEntry` can be used as the `source` for the child `entries`
*/
const DEBUG = true

type FilePath = string
type URIType = "data" | "file" | "http" | "https"
type URIString = string

export interface JAtlasEntry {
	name?: string
	x: number
	y: number
	width: number
	height: number
	/** specify the URI scheme used by the `data` <br>
	 * see {@link https://en.wikipedia.org/wiki/List_of_URI_schemes} for a list of common URI schemes, <br>
	 * but practically speaking, there are only three URI schemes that can be decoded as images of the mask:
	 * - `"data"`, for instance: `"data:image/webp;base64,UklGRqQDAA..."`
	 * - `"file"`, for instance: `"file://homepc/C:/users/me/downloads/..."` or `"file:///D:/media%20backup/pictures/..."`
	 * - `"http"` or `"https"`, for instance: `"https://en.wikipedia.org/static/images/icons/wikipedia.png"`
	*/
	kind: URIType | "H" | "V" | "P" | "Z"
	/** specify the URI payload of the image data <br>
	 * the following are valid `kind` and `data` pairs:
	 * | kind | data |
	 * | ---- | ---- |
	 * | "data" | "data:image/png;base64,iVBORw0KGg..." |
	 * | "data" | "data:image/webp;base64,UklGRqQDAA..." |
	 * | "file" | "file:///D:/media%20backup/pictures/..." |
	 * | "http" | "https://en.wikipedia.org/static/images/icons/wikipedia.png" |
	*/
	data: URIString
}

export interface JAtlas {
	/** specify the URI scheme used by the `source` <br>
	 * see {@link JAtlasEntry.kind}
	*/
	kind: URIType
	/** image source to apply this atlas's entries onto */
	source: URIString
	/** atlas entries of the source */
	entries: { [id: number]: JAtlasEntry }
}

const
	clipmask_data_format: ImageMIMEType = "image/webp",
	clipmask_offcanvas = new OffscreenCanvas(10, 10),
	clipmask_offctx = clipmask_offcanvas.getContext("2d", { willReadFrequently: true }) as OffscreenCanvasRenderingContext2D
clipmask_offctx.imageSmoothingEnabled = false

export class ClipMask {
	rect: Rect
	data?: Blob
	loaded!: Promise<this>
	private resolve_loaded!: (self: this) => void
	private reject_loaded!: (reason?: any) => void
	/** encapsulate any meta data you desire. this property is not utilized by this class at all */
	meta: { string?: any } = {}

	constructor(data?: Blob, rect?: Partial<Rect>) {
		this.reset_loaded()
		this.rect = { x: 0, y: 0, width: 1, height: 1, ...rect }
		if (data) {
			this.data = data
			this.resolve_loaded(this)
		}
	}

	private reset_loaded = (): void => {
		this.loaded = new Promise<this>((resolve, reject) => {
			this.resolve_loaded = resolve
			this.reject_loaded = reject
		})
	}

	/** load an image from a string of data uri, such as: `"data:image/gif;base64,R0l..."` */
	loadDataURI = (data_uri: string, rect?: Partial<Rect>) => this.loadURL(data_uri, rect)

	/** load an image from a local path or url, such as: `"./bitmasks/juice.png"` or `"https://picsum.photos/200/300?grayscale"` */
	loadURL = (src_url: string, rect?: Partial<Rect>) => {
		const img = new Image()
		img.src = src_url
		rect ??= {}
		return img.decode()
			.then(() => this.loadImage(img, rect))
			.catch((reason) => { throw new Error(`failed to load url:\n\t${src_url}\nreason:\n\t${reason}`) })
	}

	/** load from a `CanvasImageSource` */
	loadImage = (src_img: CanvasImageSource, rect?: Partial<Rect>) => {
		const { width: w, height: h } = src_img as Exclude<CanvasImageSource, HTMLOrSVGImageElement>
		rect!.width = w
		rect!.height = h
		clipmask_offcanvas.width = w
		clipmask_offcanvas.height = h
		clipmask_offctx.globalCompositeOperation = "copy"
		clipmask_offctx.drawImage(src_img, 0, 0)
		const { data } = clipmask_offctx.getImageData(0, 0, w, h)
		return this.loadBuffer(data, rect)
	}

	/** load an image from  a `Uint8Array` of RGBA pixels. the width and height must be defined in the passed `rect` */
	loadBuffer = async (buf: Uint8Array | Uint8ClampedArray, rect?: Partial<Rect>): Promise<this> => {
		this.reset_loaded()
		this.rect = { ...this.rect, ...rect }
		clipmask_offcanvas.width = this.rect.width
		clipmask_offcanvas.height = this.rect.height
		clipmask_offctx.globalCompositeOperation = "copy"
		clipmask_offctx.putImageData(
			new ImageData(
				ClipMask.turnTransparent(buf),
				this.rect.width,
				this.rect.height
			), 0, 0
		)
		this.data = await clipmask_offcanvas.convertToBlob({ type: clipmask_data_format })
		this.resolve_loaded(this)
		return this
	}

	static fromAuto = async (mask_src: string | Uint8Array | Uint8ClampedArray | CanvasImageSource | Blob, rect?: Partial<Rect>) => {
		return await (
			typeof mask_src === "string" ? this.fromURL(mask_src, rect) :
				mask_src instanceof Blob ? new this(mask_src, rect) :
					mask_src instanceof Uint8Array || mask_src instanceof Uint8ClampedArray ? this.fromBuffer(mask_src, rect) :
						this.fromImage(mask_src, rect)
		)
	}

	/** static version of {@link ClipMask.loadDataURI} */
	static fromDataURI = (data_uri: string, rect?: Partial<Rect>): Promise<ClipMask> => this.fromURL(data_uri, rect)

	/** static version of {@link ClipMask.loadURL} */
	static fromURL = (src_url: string, rect?: Partial<Rect>): Promise<ClipMask> => {
		const new_mask = new this(undefined, rect)
		return new_mask.loadURL(src_url, rect)
	}

	/** static version of {@link ClipMask.loadImage} */
	static fromImage = (src_img: CanvasImageSource, rect?: Partial<Rect>): Promise<ClipMask> => {
		const new_mask = new this(undefined, rect)
		return new_mask.loadImage(src_img, rect)
	}

	/** static version of {@link ClipMask.loadBuffer} */
	static fromBuffer = (buf: Uint8Array | Uint8ClampedArray, rect?: Partial<Rect>): Promise<ClipMask> => {
		const new_mask = new this(undefined, rect)
		return new_mask.loadBuffer(buf, rect)
	}

	/** turn the provided buffer of pixels to become transparent where a black pixel is present */
	static turnTransparent = (buf: Uint8Array | Uint8ClampedArray): Uint8ClampedArray => {
		// turn black pixels completely transparent
		for (let i = 0, len = buf.length * 4; i < len; i += 4) if (buf[i] + buf[i + 1] + buf[i + 2] === 0) buf[i + 3] = 0
		return new Uint8ClampedArray(buf.buffer)
	}

	clearDataBlob = () => {
		this.data = undefined
		this.reset_loaded()
	}

	/** clip/mask an image using this `ClipMask`'s `data` bitmap image blob */
	clipImage = async (img: CanvasImageSource, mask_fallback_src_url?: string): Promise<OffscreenCanvas> => {
		if (this.data === undefined) await this.loadURL(mask_fallback_src_url!, this.rect)
		return createImageBitmap(this.data!).then(mask_img_bitmap => {
			clipmask_offcanvas.width = this.rect.width
			clipmask_offcanvas.height = this.rect.height
			clipmask_offctx.globalCompositeOperation = "copy"
			clipmask_offctx.drawImage(mask_img_bitmap, 0, 0)
			clipmask_offctx.globalCompositeOperation = "source-in"
			clipmask_offctx.drawImage(img, -this.rect.x, -this.rect.y)
			return clipmask_offcanvas
		})
	}

	static clipImageUsing = async (img: CanvasImageSource, mask_src: string | Uint8Array | Uint8ClampedArray | CanvasImageSource | Blob, rect?: Partial<Rect>): Promise<OffscreenCanvas> => {
		let new_mask: ClipMask = await ClipMask.fromAuto(mask_src)
		return new_mask.clipImage(img).then((offcanvas) => {
			new_mask.clearDataBlob();
			(new_mask as unknown) = undefined
			return offcanvas
		})
	}
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
export type IDNumberingFunc = (r: number, g: number, b: number, a: number) => number

const default_id_numbering_func: IDNumberingFunc = (r, g, b, a) => a === 0 ? 0 : (255 - a) / 100 + b * (2 ** 0) + g * (2 ** 8) + r * (2 ** 16)

export class JAtlasManager {
	source!: FilePath | Base64ImageString
	entries: { [id: number]: ClipMask } = {}
	imgloaded!: Promise<this["img"]>
	img?: HTMLImageElement

	constructor(src_url?: FilePath | Base64ImageString) {
		if (src_url) this.loadImage(src_url)
	}

	loadImage = (src_url: FilePath | Base64ImageString) => {
		this.source = src_url
		this.img = new Image()
		this.img.src = src_url
		this.imgloaded = this.img.decode()
			.then(() => this.img)
			.catch(() => { throw new Error(`failed to load url:\n\t${src_url}`) })
		return this.imgloaded
	}

	addEntry = (entry: JAtlasEntry | string, id?: number) => {
		if (typeof entry === "string") entry = JSON.parse(entry) as JAtlasEntry
		const
			{ x, y, width, height, kind, data } = entry,
			mask = new ClipMask(undefined, { x, y, width, height })
		this.entries[id ?? Date.now() % 1000_000_000] = mask
		mask.loadURL(data)
	}

	addEntries = (entries: { [id: number]: JAtlasEntry }) => {
		for (const [id, entry] of Object.entries(entries)) this.addEntry(entry, parseInt(id))
	}

	getEntryImage = async (id: number): Promise<OffscreenCanvas> => {
		await this.imgloaded
		return this.entries[id].clipImage(this.img!)
	}

	static fromObject = (jatlas_object: JAtlas): JAtlasManager => {
		const new_atlas_manager = new JAtlasManager(jatlas_object.source)
		new_atlas_manager.addEntries(jatlas_object.entries)
		return new_atlas_manager
	}

	static fromJSON = (atlas_json_text: string): JAtlasManager => JAtlasManager.fromObject(JSON.parse(atlas_json_text) as JAtlas)

	static fromURL = (json_url: FilePath): Promise<JAtlasManager> => fetch(json_url).then(async (response) => JAtlasManager.fromJSON(await response.text()))

	static fromJAtlasImage = (img: CanvasImageSource, img_src_url?: JAtlasManager["source"], id_numbering_func?: IDNumberingFunc, onload_callback?: (loaded_new_atlas_manager: JAtlasManager) => void) => {
		// id_numbering_func(r, g, b, a) === 0 must always be dedicated to background if (r, g, b, a) is a background pixel color
		// algorithm: we do a continuous horizontal scan line over img_data.data, then every horizontal index range of pixels of matching id is appended to a dictionary
		// once scanline is over, we convert the flat indexes of the ranges into (x, y) coordinates, then we find their range's max and min x and y to get the left, right top, bottom
		// bounding box or the rect of that particular id.
		// using the bounding box rect, we can offset the flat indexes of the ranges to begin from the top left, and then we fill in (255, 255, 255 255) everywhere in the ranges subarray of the id on a mini imageData.data canvas
		return this.fromJAtlasImageData<4>(constructImageData(img), img_src_url, id_numbering_func, onload_callback)
	}

	static fromJAtlasImageData = <Channels extends (1 | 2 | 3 | 4) = 4>(img_data: SimpleImageData, img_src_url?: JAtlasManager["source"], id_numbering_func?: IDNumberingFunc, onload_callback?: (loaded_new_atlas_manager: JAtlasManager) => void) => {
		id_numbering_func ??= default_id_numbering_func
		const
			{ width, height, data } = img_data,
			channels = data.length / (width * height) as Channels,
			id_pixel_intervals: { [id: Exclude<number, 0>]: Intervals } = {}
		console.assert(Number.isInteger(channels))
		let [prev_id, id] = [0, 0]
		for (let px = 0, len = data.length; px < len; px += channels) {
			id = id_numbering_func(data[px + 0], data[px + 1], data[px + 2], data[px + 3])
			if (id !== prev_id) {
				id_pixel_intervals[id] ??= []
				// register the current pixel as the start of an id_interval, only if id number is positive
				if (id > 0) id_pixel_intervals[id].push(px)
				// register the previous pixel as the end (exclusive) of the previous id_interval, only if prev_id number is positive
				if (prev_id > 0) id_pixel_intervals[prev_id].push(px)
			}
			prev_id = id
		}
		// register the end index (excusive) of the final id as the final pixel
		id_pixel_intervals[prev_id]?.push(data.length)
		delete id_pixel_intervals[0]
		// convert flat index of image data to (x, y) coordinates and find the bounding box of each id
		const
			new_atlas_manager = new this(img_src_url),
			mask_from_buffer_promises: Promise<void | ClipMask>[] = []
		for (const [id, intervals] of Object.entries(id_pixel_intervals)) {
			let [min_x, min_y, max_x, max_y] = [width, height, 0, 0]
			for (let i = 0, len = intervals.length; i < len; i += 2) {
				const
					start_px: number = intervals[i]! / channels,
					x = start_px % width,
					y = (start_px / width) | 0
				if (x < min_x) min_x = x
				if (y < min_y) min_y = y
			}
			for (let i = 1, len = intervals.length; i < len; i += 2) {
				const
					end_px: number = intervals[i]! / channels,
					x = (end_px) % width,
					y = ((end_px) / width) | 0
				if (x > max_x) max_x = x
				if (y > max_y) max_y = y
			}
			max_x++
			max_y++
			const
				mask = new ClipMask(),
				[x, y, w, h] = [min_x, min_y, max_x - min_x, max_y - min_y],
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
				mask_intervals = intervals.map((px: number) => 4 * (((px / channels % width) - x) + ((px / (channels * width) | 0) - y) * w)) as Intervals,
				rgba_buf = new Uint8Array(w * h * 4).fill(0)
			for (const sub_arr of sliceIntervalsTypedSubarray(rgba_buf, mask_intervals)) sub_arr.fill(255)
			mask_from_buffer_promises.push(mask.loadBuffer(rgba_buf, { x, y, width: w, height: h }))
			new_atlas_manager.entries[parseFloat(id)] = mask
		}
		if (onload_callback) Promise.all(mask_from_buffer_promises).then(() => onload_callback(new_atlas_manager))
		return new_atlas_manager
	}

	/** TODO
	toJAtlasImage = () => {}
	*/

	toObject = async (): Promise<JAtlas> => {
		const new_jatlas_object: JAtlas = {
			source: this.source.toString(),
			entries: {}
		}
		for (const [id, mask] of Object.entries(this.entries)) {
			let kind: JAtlasEntry["kind"], data: JAtlasEntry["data"]
			if (mask.data) {
				kind = "data"
				data = await blobToBase64(mask.data)
			} else if (isBase64Image(mask.meta.src!)) {
				kind = "data"
				data = mask.meta.src!
			} else {
				kind = "https"
				data = mask.meta.src!
			}
			new_jatlas_object.entries[parseFloat(id)] = { ...mask.rect, kind, data }
		}
		return new_jatlas_object
	}

	toJSON = async (): Promise<string> => JSON.stringify(await this.toObject())
}

export class ClippedImage {
	jatlas_manager: JAtlasManager
	entry_id: keyof this["jatlas_manager"]["entries"] & number

	constructor(jatlas_manager: JAtlasManager, entry_id: number) {
		this.jatlas_manager = jatlas_manager
		this.entry_id = entry_id
	}

	getImage = () => this.jatlas_manager.getEntryImage(this.entry_id)

	getRect = () => this.jatlas_manager.entries[this.entry_id].rect
}

export class HorizontalImageScroller {
	canvas: HTMLCanvasElement
	ctx: CanvasRenderingContext2D
	entries: Array<CanvasImageSource | ClippedImage> = []
	left: number = 0
	right: number = 0

	constructor(append_to?: HTMLElement, width: number = 300, height: number = 200) {
		this.canvas = document.createElement("canvas")
		this.ctx = this.canvas.getContext("2d")!
		this.canvas.width = width
		this.canvas.height = height
		this.ctx.translate((width / 2) | 0, 0)
		if (DEBUG) {
			this.ctx.lineWidth = 5
			this.ctx.moveTo(0, 0)
			this.ctx.lineTo(0, height)
			this.ctx.stroke()
			this.ctx.scale(0.25, 0.25)
		}
		if (append_to) this.appendTo(append_to)
	}

	appendTo = (element: HTMLElement) => element.appendChild(this.canvas)

	addEntryLeft = async (entry: this["entries"][number]) => {
		this.entries.unshift(entry)
		const width = entry instanceof ClippedImage ? entry.getRect().width : entry.width as number
		this.left -= width
		const
			x = this.left,
			img = entry instanceof ClippedImage ? await entry.getImage() : entry as CanvasImageSource
		this.ctx.drawImage(img, x, 0)
	}

	addEntryRight = async (entry: this["entries"][number]) => {
		this.entries.push(entry)
		const
			width = entry instanceof ClippedImage ? entry.getRect().width : entry.width as number,
			x = this.right
		this.right += width
		const img = entry instanceof ClippedImage ? await entry.getImage() : entry as CanvasImageSource
		this.ctx.drawImage(img, x, 0)
	}
}
