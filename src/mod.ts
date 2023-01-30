import { blobToBase64 } from "https://deno.land/x/kitchensink_ts@v0.5.7/browser.ts"
import { AnyImageSource, Base64ImageString, constructImageBitmapSource, constructImageBlob, constructImageData, coordinateTransformer, getBGCanvas, getBGCtx } from "https://deno.land/x/kitchensink_ts@v0.5.7/image.ts"
import { Rect, SimpleImageData } from "https://deno.land/x/kitchensink_ts@v0.5.7/struct.ts"
import { Intervals, sliceIntervalsTypedSubarray } from "https://deno.land/x/kitchensink_ts@v0.5.7/typedbuffer.ts"

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
	format: URIType | "H" | "V" | "P" | "Z"
	/** specify the URI payload of the image data <br>
	 * the following are valid `format` and `data` pairs:
	 * | format | data |
	 * | ------ | ---- |
	 * | "data" | "data:image/png;base64,iVBORw0KGg..." |
	 * | "data" | "data:image/webp;base64,UklGRqQDAA..." |
	 * | "file" | "file:///D:/media%20backup/pictures/..." |
	 * | "http" | "https://en.wikipedia.org/static/images/icons/wikipedia.png" |
	*/
	data: URIString
}

export interface JAtlas {
	/** specify the URI scheme used by the `source` <br>
	 * see {@link JAtlasEntry.format}
	*/
	format?: URIType
	/** image source to apply this atlas's entries onto */
	source: URIString
	/** atlas entries of the source */
	entries: { [id: number]: JAtlasEntry }
}

const
	clipmask_toblob_options: Parameters<OffscreenCanvas["convertToBlob"]>[0] = { type: "image/webp" },
	bg_canvas = getBGCanvas(),
	bg_ctx = getBGCtx()
bg_ctx.imageSmoothingEnabled = false

export class ClipMask {
	rect: Rect
	data?: Blob
	/** encapsulate any meta data you desire. this property is not utilized by this class at all */
	meta: { string?: any } = {}
	loaded!: Promise<this>
	private resolve_loaded!: () => void
	private reject_loaded!: (reason?: any) => void
	private reset_loaded = (): void => {
		this.loaded = new Promise<this>((resolve, reject) => {
			this.resolve_loaded = () => resolve(this)
			this.reject_loaded = reject
		})
	}

	/**
	 * @param mask_src a transparent bitmap image to be used as the mask. if this image is not already transparent, and equires transformation, use the static {@link ClipMask.asTransparent} method instead
	 * @param rect the rectangle referencing the physical rectangular location of this mask with respect to whatever base_image that needs to be cliped and masked
	 */
	constructor(mask_src?: AnyImageSource, rect?: Partial<Rect>) {
		this.rect = { x: 0, y: 0, width: 1, height: 1, ...rect }
		if (mask_src) this.setData(mask_src)
		else this.reset_loaded()
	}

	/** doing the following with `ClipMask`:
	 * ```ts
	 * declare mask: ClipMask, mask_src: AnyImageSource, rect: Partial<Rect> | undefined
	 * mask.setData(mask_src, rect).then(() => {
	 * 		my_new_mask.clipImage(...etc)
	 * 		...etc
	 * })
	 * ```
	 * 
	 * is analogus to the following `HTMLImageElement` pattern:
	 * ```ts
	 * declare img: HTMLImageElement, mask_src: string
	 * img.src = mask_src
	 * img.decoded().then(() => {
	 * 		someImgConsumer(img)
	 * 		...etc
	 * })
	 * ```
	 * 
	 * but it might be better to use the following pattern:
	 * ```ts
	 * declare mask: ClipMask, mask_src: AnyImageSource, rect: Partial<Rect> | undefined
	 * mask.setData(mask_src, rect)
	 * mask.loaded().then((my_new_mask) => {
	 * 		my_new_mask.clipImage(...etc)
	 * 		...etc
	 * })
	 * ```
	*/
	setData = (mask_src: AnyImageSource, rect?: Partial<Rect>) => {
		this.reset_loaded()
		this.rect = { ...this.rect, ...rect }
		return constructImageBlob(mask_src, this.rect.width, undefined, undefined, clipmask_toblob_options).then((blob) => {
			this.data = blob
			this.resolve_loaded()
		})
	}

	static asTransparent = (mask_src: AnyImageSource, rect?: Partial<Rect>) => {
		return constructImageData(mask_src, rect?.width).then((img_data) => {
			const { data, width } = img_data
			rect ??= {}
			rect.width = width
			return new ClipMask(ClipMask.turnTransparent(data), rect)
		})
	}

	/** turn the provided buffer of pixels to become transparent where a black pixel is present */
	static turnTransparent = (buf: Uint8Array | Uint8ClampedArray): Uint8ClampedArray => {
		// turn black pixels completely transparent
		for (let i = 0, len = buf.length * 4; i < len; i += 4) if (buf[i] + buf[i + 1] + buf[i + 2] === 0) buf[i + 3] = 0
		return new Uint8ClampedArray(buf.buffer)
	}

	clearDataBlob = () => {
		this.reset_loaded()
		this.data = undefined
	}

	/** clip/mask an image using this `ClipMask`'s `data` bitmap image blob */
	clipImage = (img: CanvasImageSource): Promise<OffscreenCanvas> => {
		return this.loaded
			.then(() => createImageBitmap(this.data!))
			.then(mask_img_bitmap => {
				bg_canvas.width = this.rect.width
				bg_canvas.height = this.rect.height
				bg_ctx.resetTransform()
				bg_ctx.globalCompositeOperation = "copy"
				bg_ctx.drawImage(mask_img_bitmap, 0, 0)
				bg_ctx.globalCompositeOperation = "source-in"
				bg_ctx.drawImage(img, -this.rect.x, -this.rect.y)
				return bg_canvas
			})
	}

	static clipImageUsing = (img: CanvasImageSource, mask_src: AnyImageSource, rect?: Partial<Rect>): Promise<OffscreenCanvas> => {
		let new_mask: ClipMask = new ClipMask(mask_src, rect)
		return new_mask.clipImage(img)
			.then((offcanvas) => {
				new_mask.clearDataBlob();
				(new_mask as unknown) = undefined
				return offcanvas
			})
	}

	static fromObject = (jatlas_entry: JAtlasEntry): ClipMask => {
		const { data, x, y, width, height } = jatlas_entry
		return new ClipMask(data, { x, y, width, height })
	}

	static fromJSON = (jatlas_entry_json_text: string): ClipMask => ClipMask.fromObject(JSON.parse(jatlas_entry_json_text) as JAtlasEntry)

	/** note: you will have to make sure from outside that `this.data` has been loaded by observing the `this.loaded` promise <br>
	 * this function does not await for `this.loaded`, it acts on whatever's currently available at `this.data` <br>
	*/
	toObject = async (): Promise<JAtlasEntry> => {
		const { name, src } = this.meta as { name?: string, src?: URIString }
		let format: JAtlasEntry["format"], data: JAtlasEntry["data"]
		// TIP: uncommenting the line below will make each call `toObject` wait for the data to load. however, one might never load any data (via `setData`), in which case `toObject` will wait forever
		// await this.loaded
		if (this.data) {
			format = "data"
			data = await blobToBase64(this.data)
		} else {
			format = "http"
			data = src!
		}
		return { ...this.rect, format, data, name }
	}

	toJSON = async (): Promise<string> => JSON.stringify(await this.toObject())
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
	private source_bitmap?: ImageBitmap
	source_loaded!: Promise<this>
	private resolve_source_loaded!: () => void
	private reject_source_loaded!: (reason?: any) => void
	private reset_source_loaded = (): void => {
		this.source_loaded = new Promise<this>((resolve, reject) => {
			this.resolve_source_loaded = () => resolve(this)
			this.reject_source_loaded = reject
		})
	}

	entries: { [id: number]: ClipMask } = {}
	entries_loaded!: Promise<this>
	private resolve_entries_loaded!: () => void
	private reject_entries_loaded!: (reason?: any) => void
	private reset_entries_loaded = (): void => {
		this.entries_loaded = new Promise<this>((resolve, reject) => {
			this.resolve_entries_loaded = () => resolve(this)
			this.reject_entries_loaded = reject
		})
	}

	constructor(source_img?: FilePath | Base64ImageString) {
		if (source_img) {
			this.source = source_img
			this.setSource(source_img)
		}
		else this.reset_source_loaded()
		this.reset_entries_loaded()
		this.resolve_entries_loaded()
	}

	setSource = (source_img: AnyImageSource) => {
		this.reset_source_loaded()
		if (typeof source_img === "string") this.source = source_img
		constructImageBitmapSource(source_img)
			.then(createImageBitmap)
			.then((bitmap) => {
				this.source_bitmap = bitmap
				this.resolve_source_loaded()
			})
			.catch(() => { throw new Error(`failed to load source image:\n\t${source_img}`) })
		return this.source_loaded
	}

	addEntry = (entry: ClipMask | JAtlasEntry | string, id?: number) => {
		const mask: ClipMask = typeof entry === "string" ? ClipMask.fromJSON(entry) :
			entry instanceof ClipMask ? entry :
				ClipMask.fromObject(entry)
		this.entries[id ?? Date.now() % 1000_000_000] = mask
	}

	addEntries = (entries: { [id: number]: ClipMask | JAtlasEntry | string }) => {
		for (const [id, entry] of Object.entries(entries)) this.addEntry(entry, parseInt(id))
	}

	getEntryImage = async (id: number): Promise<OffscreenCanvas> => {
		await this.source_loaded
		return this.entries[id].clipImage(this.source_bitmap!)
	}

	static fromObject = (jatlas_object: JAtlas): JAtlasManager => {
		const new_atlas_manager = new JAtlasManager(jatlas_object.source)
		new_atlas_manager.addEntries(jatlas_object.entries)
		return new_atlas_manager
	}

	static fromJSON = (atlas_json_text: string): JAtlasManager => JAtlasManager.fromObject(JSON.parse(atlas_json_text) as JAtlas)

	static fromURL = (json_url: FilePath): Promise<JAtlasManager> => fetch(json_url).then(async (response) => JAtlasManager.fromJSON(await response.text()))

	static fromJAtlasImage = async (img: CanvasImageSource, img_src_url?: JAtlasManager["source"], id_numbering_func?: IDNumberingFunc) => {
		// id_numbering_func(r, g, b, a) === 0 must always be dedicated to background if (r, g, b, a) is a background pixel color
		// algorithm: we do a continuous horizontal scan line over img_data.data, then every horizontal index range of pixels of matching id is appended to a dictionary
		// once scanline is over, we convert the flat indexes of the ranges into (x, y) coordinates, then we find their range's max and min x and y to get the left, right top, bottom
		// bounding box or the rect of that particular id.
		// using the bounding box rect, we can offset the flat indexes of the ranges to begin from the top left, and then we fill in (255, 255, 255 255) everywhere in the ranges subarray of the id on a mini imageData.data canvas
		return this.fromJAtlasImageData<4>(await constructImageData(img), img_src_url, id_numbering_func)
	}

	static fromJAtlasImageData = <Channels extends (1 | 2 | 3 | 4) = 4>(img_data: SimpleImageData, img_src_url?: JAtlasManager["source"], id_numbering_func?: IDNumberingFunc): JAtlasManager => {
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
		new_atlas_manager.reset_entries_loaded()
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
				coord_map = coordinateTransformer({ width, channels }, { x, y, width: w, channels: 4 }),
				mask_intervals = intervals.map(coord_map) as Intervals,
				rgba_buf = new Uint8Array(w * h * 4).fill(0)
			for (const sub_arr of sliceIntervalsTypedSubarray(rgba_buf, mask_intervals)) sub_arr.fill(255)
			mask_from_buffer_promises.push(mask.setData(rgba_buf, { x, y, width: w, height: h }))
			new_atlas_manager.addEntry(mask, parseFloat(id))
		}
		Promise.all(mask_from_buffer_promises)
			.then(() => new_atlas_manager.resolve_entries_loaded())
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
		await Promise.all(Object.entries(this.entries).map(kv => {
			const [id, mask] = kv
			return mask.loaded
				.then(loaded_mask => loaded_mask.toObject())
				.then((mask_obj) => {
					new_jatlas_object.entries[parseFloat(id)] = mask_obj
				})
		}))
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
