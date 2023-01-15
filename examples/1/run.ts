// @deno-types="npm:@types/offscreencanvas"
import { OffscreenCanvas, OffscreenCanvasRenderingContext2D } from "npm:@types/offscreencanvas"
import { Rect, positiveRect } from "https://deno.land/x/kitchensink_ts/struct.ts"
import { } from "https://deno.land/x/kitchensink_ts/mod.ts"


const
	clipmask_offcanvas = document.createElement("canvas"), //new OffscreenCanvas(10, 10),
	clipmask_offctx: CanvasRenderingContext2D = clipmask_offcanvas.getContext("2d", { willReadFrequently: true })!
clipmask_offctx.imageSmoothingEnabled = false


class ClipMask {
	rect: Rect
	mask_img_src: string
	mask_imgdata?: ImageData

	constructor(mask_img_src: string, rect: Partial<Rect>) {
		this.mask_img_src = mask_img_src
		this.rect = { x: 0, y: 0, width: 1, height: 1, ...rect }
	}

	loadImageData = () => {
		const img = new Image()
		return new Promise<string>((resolve, reject) => {
			img.onerror = () => reject(this.mask_img_src)
			img.onload = () => {
				this.rect.width = img.width
				this.rect.height = img.height
				const { width: w, height: h } = this.rect
				clipmask_offcanvas.width = w
				clipmask_offcanvas.height = h
				clipmask_offctx.globalCompositeOperation = "copy"
				clipmask_offctx.drawImage(img, 0, 0)
				this.mask_imgdata = clipmask_offctx.getImageData(0, 0, w, h)
				const { data } = this.mask_imgdata
				// turn black pixels completely transparent
				for (let i = 0; i < w * h * 4; i += 4) if (data[i] + data[i + 1] + data[i + 2] === 0) data[i + 3] = 0
				resolve(this.mask_img_src)
			}
			img.src = this.mask_img_src
		})
	}

	clearImageData = () => this.mask_imgdata = undefined

	clipImage = async (img: CanvasImageSource) => {
		if (this.mask_imgdata === undefined) await this.loadImageData()
		clipmask_offctx.globalCompositeOperation = "copy"
		clipmask_offctx.putImageData(this.mask_imgdata!, 0, 0)
		clipmask_offctx.globalCompositeOperation = "source-in"
		clipmask_offctx.drawImage(img, -this.rect.x, -this.rect.y)
		//this.mask_imgdata!
	}
}

const
	offcanvas: OffscreenCanvas = document.createElement("canvas"), //new OffscreenCanvas(100, 100),
	offctx: OffscreenCanvasRenderingContext2D = offcanvas.getContext("2d", { willReadFrequently: true })
offctx.imageSmoothingEnabled = false

const drawBase = (img_url: string, dx: number, dy: number, dw: number, dh: number) => {
	const img = new Image()
	return new Promise((resolve, reject) => {
		img.onload = () => {
			offcanvas.width = dw
			offcanvas.height = dh
			offctx.globalCompositeOperation = "copy"
			offctx.drawImage(img, -dx, -dy)
			resolve(img)
		}
		img.onerror = () => reject(img)
		img.src = img_url
	})
}

const clipMask = (mask_url: string) => {
	const img = new Image()
	return new Promise((resolve, reject) => {
		img.onload = () => {
			offctx.globalCompositeOperation = "multiply"
			offctx.drawImage(img, 0, 0)
			resolve(img)
		}
		img.onerror = () => reject(img)
		img.src = mask_url
	})
}

const render_canvas = document.createElement("canvas")
render_canvas.width = 500
render_canvas.height = 500
const render_ctx = render_canvas.getContext("2d")!
render_ctx.imageSmoothingEnabled = false
//document.body.appendChild(offcanvas)

const getClippedImage = () => {
	// render_ctx.clearRect(0, 0, 500, 500)
	// render_ctx.drawImage(offcanvas, 0, 0)
}

let
	base_img = "./base_image.jpg",
	bitmask_img = "./bitmasks/juice.png",
	bitmask_rect_arr = [185, 184, 172, 258] as const,
	bitmask_rect = { x: 185, y: 184, width: 172, height: 258 } as const

//drawBase(base_img, ...bitmask_rect).then(() => clipMask(bitmask_img)).then(getClippedImage)
document.body.appendChild(clipmask_offcanvas)
let a = new ClipMask(bitmask_img, bitmask_rect)
const img = new Image()
img.onload = () => {
	a.clipImage(img)
}
img.src = base_img
