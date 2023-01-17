import { Rect } from "https://deno.land/x/kitchensink_ts/struct.ts"


type ImageDataFormats = `image/${"jpeg" | "jpg" | "png" | "gif" | "webp"}`
type Base64ImageHeader = `data:${ImageDataFormats};base64,`
type Base64Image = `${Base64ImageHeader}${string}`
type FilePath = string
interface JAtlasEntry {
	name?: string
	x: number
	y: number
	width: number
	height: number
	kind: Base64ImageHeader | "H" | "V" | "P" | "Z"
	data: string
}
interface JAtlas {
	/** image source to apply this atlas onto */
	source: FilePath | Base64Image
	/** atlas entries of the source */
	entries: { [id: number]: JAtlasEntry }
}

const isBase64Image = (obj?: string): obj is Base64Image => obj === undefined ? false : obj.startsWith("data:image/")

const
	clipmask_data_format: ImageDataFormats = "image/webp",
	clipmask_offcanvas = new OffscreenCanvas(10, 10),
	clipmask_offctx = clipmask_offcanvas.getContext("2d", { willReadFrequently: true }) as OffscreenCanvasRenderingContext2D
clipmask_offctx.imageSmoothingEnabled = false


class ClipMask {
	rect: Rect
	/** file path of the source image, or base64 data uri <br>
	 * if a base64 data uri is provided, then once it has been turned trasnparent and converted into `this.data_uri`, `this.src_url` will be deleted <br>
	 * at any given time, one of either `this.src_url` or `this.data_blob` will be present
	*/
	src_url?: FilePath | Base64Image
	data_blob?: Blob

	constructor(src_url?: string, rect?: Partial<Rect>) {
		this.src_url = src_url
		this.rect = { x: 0, y: 0, width: 1, height: 1, ...rect }
	}

	/** load an image from a local path or url, such as: `"./bitmasks/juice.png"` or `"https://picsum.photos/200/300?grayscale"` */
	fromURL = (src_url: string, rect: Partial<Rect>) => {
		this.src_url = src_url
		const img = new Image()
		img.src = src_url
		return img.decode()
			.then(() => {
				const { width: w, height: h } = img
				rect.width = w
				rect.height = h
				clipmask_offcanvas.width = w
				clipmask_offcanvas.height = h
				clipmask_offctx.globalCompositeOperation = "copy"
				clipmask_offctx.drawImage(img, 0, 0)
				const { data } = clipmask_offctx.getImageData(0, 0, w, h)
				return this.fromBuffer(data, rect as { x?: number, y?: number, width: number, height: number })
			})
			.catch(() => { throw new Error(`failed to load url:\n\t${src_url}`) })
	}

	/** load an image from a string of data uri, such as: `"data:image/gif;base64,R0l..."` */
	fromDataURI = (data_uri: string, rect: Partial<Rect>) => {
		return this.fromURL(data_uri, rect)
	}

	/** load an image from  a `Uint8Array` of RGBA pixels. the width and height must be defined in the passed `rect` */
	fromBuffer = async (buf: Uint8Array | Uint8ClampedArray, rect: { x?: number, y?: number, width: number, height: number }): Promise<void> => {
		rect.x ??= 0
		rect.y ??= 0
		this.rect = rect as Rect
		clipmask_offctx.globalCompositeOperation = "copy"
		clipmask_offctx.putImageData(new ImageData(ClipMask.turnTransparent(buf) as Uint8ClampedArray, rect.width, rect.height), 0, 0)
		this.data_blob = await clipmask_offcanvas.convertToBlob({ type: clipmask_data_format })
		if (isBase64Image(this.src_url)) this.src_url = undefined
		return
	}

	/** turn the provided buffer of pixels to become transparent where a black pixel is present */
	static turnTransparent = (buf: Uint8Array | Uint8ClampedArray) => {
		// turn black pixels completely transparent
		for (let i = 0, len = buf.length * 4; i < len; i += 4) if (buf[i] + buf[i + 1] + buf[i + 2] === 0) buf[i + 3] = 0
		return buf
	}

	clearDataBlob = () => this.data_blob = undefined

	clipImage = async (img: CanvasImageSource) => {
		if (this.data_blob === undefined) await this.fromURL(this.src_url!, this.rect)
		return createImageBitmap(this.data_blob!).then(mask_img => {
			clipmask_offcanvas.width = this.rect.width
			clipmask_offcanvas.height = this.rect.height
			clipmask_offctx.globalCompositeOperation = "copy"
			clipmask_offctx.drawImage(mask_img, 0, 0)
			clipmask_offctx.globalCompositeOperation = "source-in"
			clipmask_offctx.drawImage(img, -this.rect.x, -this.rect.y)
		})
	}
}

const
	atlas_canvas = document.createElement("canvas"),
	atlas_ctx = atlas_canvas.getContext("2d")!
document.body.appendChild(atlas_canvas)

class JAtlasManager {
	source!: FilePath | Base64Image
	entries: { [id: number]: ClipMask } = {}
	imgloaded!: Promise<this["img"]>
	img?: HTMLImageElement

	constructor(src_url: FilePath | Base64Image) {
		this.loadImage(src_url)
	}

	loadImage = (src_url: FilePath | Base64Image) => {
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
			mask = new ClipMask(kind + data, { x, y, width, height })
		this.entries[id ?? Date.now() % 1000_000_000] = mask
	}

	addEntries = (entries: { [id: number]: JAtlasEntry }) => {
		for (const [id, entry] of Object.entries(entries)) this.addEntry(entry, parseInt(id))
	}

	showEntry = async (id: number) => {
		await this.imgloaded
		await this.entries[id].clipImage(this.img!).then(() => {
			atlas_canvas.width = clipmask_offcanvas.width
			atlas_canvas.height = clipmask_offcanvas.height
			atlas_ctx.drawImage(clipmask_offcanvas, 0, 0)
		})
	}

	static fromJSON = (atlas_json_text: string): JAtlasManager => {
		const
			atlas = JSON.parse(atlas_json_text) as JAtlas,
			new_atlas_manager = new JAtlasManager(atlas.source)
		new_atlas_manager.addEntries(atlas.entries)
		return new_atlas_manager
	}

	static fromURL = (json_url: FilePath): Promise<JAtlasManager> => fetch(json_url).then(async (response) => JAtlasManager.fromJSON(await response.text()))
}
