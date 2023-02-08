import { AnyImageSource, Base64ImageString, ImageBlob, Intervals, Rect, SimpleImageData, blobToBase64, constructImageBitmapSource, constructImageBlob, constructImageData, coordinateTransformer, getBGCanvas, getBGCtx, sliceIntervalsTypedSubarray, rgbaToHex } from "./deps.ts"
import { Sprite } from "./sprite.ts"

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

export interface JAtlasTop {
	/** specify the URI scheme used by the `source` <br>
	 * see {@link JAtlasEntry.format}
	*/
	format?: URIType
	/** image source to apply this atlas's entries onto */
	source: URIString
	/** atlas entries of the source */
	entries: { [id: number]: JAtlasEntry }
}

/** turn the provided buffer of pixels to become transparent where a black pixel is present */
export const turnTransparent = (buf: Uint8Array | Uint8ClampedArray): Uint8ClampedArray => {
	// turn black pixels completely transparent
	for (let i = 0, len = buf.length * 4; i < len; i += 4) if (buf[i] + buf[i + 1] + buf[i + 2] === 0) buf[i + 3] = 0
	return new Uint8ClampedArray(buf.buffer)
}

const
	clipmask_toblob_options: Parameters<OffscreenCanvas["convertToBlob"]>[0] = { type: "image/webp" },
	bg_canvas = getBGCanvas(),
	bg_ctx = getBGCtx()
bg_ctx.imageSmoothingEnabled = false

export class JAtlasClip {
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
	 * @param mask_src a transparent bitmap image to be used as the mask. if this image is not already transparent, and equires transformation, use the static {@link JAtlasClip.asTransparent} method instead
	 * @param rect the rectangle referencing the physical rectangular location of this mask with respect to whatever base_image that needs to be cliped and masked
	*/
	constructor(mask_src?: AnyImageSource, rect?: Partial<Rect>) {
		this.rect = { x: 0, y: 0, width: 1, height: 1, ...rect }
		if (mask_src) this.setData(mask_src)
		else this.reset_loaded()
	}

	/** doing the following with `JAtlasClip`:
	 * ```ts
	 * declare mask: JAtlasClip, mask_src: AnyImageSource, rect: Partial<Rect> | undefined
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
	 * declare mask: JAtlasClip, mask_src: AnyImageSource, rect: Partial<Rect> | undefined
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
			return new JAtlasClip(turnTransparent(data), rect)
		})
	}

	clearDataBlob = () => {
		this.reset_loaded()
		this.data = undefined
	}

	/** clip/mask an image using this `JAtlasClip`'s `data` bitmap image blob */
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
		let new_mask: JAtlasClip = new JAtlasClip(mask_src, rect)
		return new_mask.clipImage(img)
			.then((offcanvas) => {
				new_mask.clearDataBlob();
				(new_mask as unknown) = undefined
				return offcanvas
			})
	}

	clipImageSprite = (img: CanvasImageSource): Sprite => {
		const img_sprite = new Sprite()
		this.clipImage(img)
			.then((offcanvas) => img_sprite.setSource(offcanvas.transferToImageBitmap()))
			.then((sprite) => {
				const { width, height } = img_sprite.bitmap!
				sprite.setConfig({ width, height })
			})
		return img_sprite
	}

	static clipImageSpriteUsing = (img: CanvasImageSource, mask_src: AnyImageSource, rect?: Partial<Rect>): Sprite => {
		let new_mask: JAtlasClip = new JAtlasClip(mask_src, rect)
		return new_mask.clipImageSprite(img)
	}

	static fromObject = (jatlas_entry: JAtlasEntry): JAtlasClip => {
		const { data, x, y, width, height } = jatlas_entry
		return new JAtlasClip(data, { x, y, width, height })
	}

	static fromJSON = (jatlas_entry_json_text: string): JAtlasClip => JAtlasClip.fromObject(JSON.parse(jatlas_entry_json_text) as JAtlasEntry)

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

const default_id_numbering_func: IDNumberingFunc = (r, g, b, a) => a === 0 ? 0 : (255 - (a >= 156 ? a : 156)) / 100 + b * (2 ** 0) + g * (2 ** 8) + r * (2 ** 16)

export type IDColoringFunc = (id: number) => [r: number, g: number, b: number, a: number]

const default_id_coloring_func: IDColoringFunc = (id) => {
	if (id === 0) return [0, 0, 0, 0]
	return [
		id / 2 ** 16 | 0,
		(id % 2 ** 16) / 2 ** 8 | 0,
		(id % 2 ** 8) / 2 ** 0 | 0,
		255 - (id % 2 ** 0) * 100 | 0,
	]
}

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

	entries: { [id: number]: JAtlasClip } = {}
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
		this.source_bitmap = undefined
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

	addEntry = (entry: JAtlasClip | JAtlasEntry | string, id?: number) => {
		const mask: JAtlasClip = typeof entry === "string" ? JAtlasClip.fromJSON(entry) :
			entry instanceof JAtlasClip ? entry :
				JAtlasClip.fromObject(entry)
		this.entries[id ?? Date.now() % 1000_000_000] = mask
	}

	addEntries = (entries: { [id: number]: JAtlasClip | JAtlasEntry | string }) => {
		for (const [id, entry] of Object.entries(entries)) this.addEntry(entry, parseInt(id))
	}

	getEntryImage = async (id: number): Promise<OffscreenCanvas> => {
		await this.source_loaded
		return this.entries[id].clipImage(this.source_bitmap!)
	}

	static fromObject = (jatlas_object: JAtlasTop): JAtlasManager => {
		const new_atlas_manager = new JAtlasManager(jatlas_object.source)
		new_atlas_manager.addEntries(jatlas_object.entries)
		return new_atlas_manager
	}

	static fromJSON = (atlas_json_text: string): JAtlasManager => JAtlasManager.fromObject(JSON.parse(atlas_json_text) as JAtlasTop)

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
			mask_from_buffer_promises: Promise<void | JAtlasClip>[] = []
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
				mask = new JAtlasClip(),
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

	toJAtlasImage = async (id_coloring_func?: IDColoringFunc, width?: number, height?: number): ImageBlob => {
		id_coloring_func ??= default_id_coloring_func
		if (this.source_bitmap) {
			width = this.source_bitmap.width
			height = this.source_bitmap.height
		}
		const
			canvas = new OffscreenCanvas(width!, height!),
			ctx = canvas.getContext("2d") as OffscreenCanvasRenderingContext2D,
			queued_drawings: Promise<void>[] = []
		ctx.globalCompositeOperation = "source-over"
		ctx.imageSmoothingEnabled = false
		for (const [id, mask] of Object.entries(this.entries)) {
			queued_drawings.push(
				mask.loaded
					.then(async (m) => {
						const
							mask_img_bitmap = await createImageBitmap(m.data!),
							{ width: w, height: h } = m.rect,
							color = rgbaToHex(id_coloring_func!(parseFloat(id)))
						bg_canvas.width = w
						bg_canvas.height = h
						bg_ctx.resetTransform()
						bg_ctx.globalCompositeOperation = "copy"
						bg_ctx.drawImage(mask_img_bitmap, 0, 0)
						bg_ctx.globalCompositeOperation = "source-in"
						bg_ctx.fillStyle = color
						bg_ctx.fillRect(0, 0, w, h)
						ctx.drawImage(
							bg_canvas.transferToImageBitmap(),
							m.rect.x,
							m.rect.y
						)
					})
			)
		}
		await Promise.all(queued_drawings)
		return canvas.convertToBlob({ type: "image/png" })
	}

	toObject = async (): Promise<JAtlasTop> => {
		const new_jatlas_object: JAtlasTop = {
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
