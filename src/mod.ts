import { Rect } from "https://deno.land/x/kitchensink_ts/struct.ts"


type Base64ImageHeader = `data:image/${"jpeg" | "jpg" | "png" | "gif" | "webp"};base64,`
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

const
	clipmask_offcanvas = new OffscreenCanvas(10, 10),
	clipmask_offctx = clipmask_offcanvas.getContext("2d", { willReadFrequently: true }) as OffscreenCanvasRenderingContext2D
clipmask_offctx.imageSmoothingEnabled = false


class ClipMask {
	rect: Rect
	/** file path of the source image, or base64 data uri <br>
	 * if a base64 data uri is provided, then once it has been turned trasnparent and converted into `this.data_uri`, `this.src_url` will be deleted
	*/
	src_url?: FilePath | Base64Image
	data_uri?: Base64Image
	mask_imgdata?: ImageData

	constructor(src_url?: string, rect?: Partial<Rect>) {
		this.src_url = src_url
		this.rect = { x: 0, y: 0, width: 1, height: 1, ...rect }
	}

	/** load an image from a local path or url, such as: `"./bitmasks/juice.png"` or `"https://picsum.photos/200/300?grayscale"` */
	fromURL = (src_url: string, rect: Partial<Rect>) => {
		const img = new Image()
		this.src_url = src_url
		return new Promise<ImageData>((resolve, reject) => {
			img.onerror = () => reject(`failed to load url:\n\t${src_url}`)
			img.onload = () => {
				rect.width = img.width
				rect.height = img.height
				clipmask_offcanvas.width = rect.width
				clipmask_offcanvas.height = rect.height
				clipmask_offctx.globalCompositeOperation = "copy"
				clipmask_offctx.drawImage(img, 0, 0)
				const { data } = clipmask_offctx.getImageData(0, 0, rect.width, rect.height)
				resolve(
					this.fromBuffer(data, rect as { x?: number, y?: number, width: number, height: number })
				)
			}
			img.src = src_url
		})

	}

	/** load an image from a string of data uri, such as: `"data:image/gif;base64,R0l..."` */
	fromDataURI = (data_uri: string, rect: Partial<Rect>) => {
		return this.fromURL(data_uri, rect)
	}

	/** load an image from  a `Uint8Array` of RGBA pixels. the width and height must be defined in the passed `rect` */
	fromBuffer = (buf: Uint8Array | Uint8ClampedArray, rect: { x?: number, y?: number, width: number, height: number }): ImageData => {
		rect.x ??= 0
		rect.y ??= 0
		this.rect = rect as Rect
		this.mask_imgdata = new ImageData(ClipMask.turnTransparent(buf) as Uint8ClampedArray, rect.width, rect.height)
		return this.mask_imgdata
	}

	/** turn the provided buffer of pixels to become transparent where a black pixel is present */
	static turnTransparent = (buf: Uint8Array | Uint8ClampedArray) => {
		// turn black pixels completely transparent
		for (let i = 0, len = buf.length * 4; i < len; i += 4) if (buf[i] + buf[i + 1] + buf[i + 2] === 0) buf[i + 3] = 0
		return buf
	}

	clearImageData = () => this.mask_imgdata = undefined

	clipImage = async (img: CanvasImageSource) => {
		if (this.mask_imgdata === undefined) await this.fromURL(this.src_url!, this.rect)
		clipmask_offctx.globalCompositeOperation = "copy"
		clipmask_offctx.putImageData(this.mask_imgdata!, 0, 0)
		clipmask_offctx.globalCompositeOperation = "source-in"
		clipmask_offctx.drawImage(img, -this.rect.x, -this.rect.y)
	}
}

