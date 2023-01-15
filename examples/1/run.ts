// @deno-types="npm:@types/offscreencanvas"
import { OffscreenCanvas, OffscreenCanvasRenderingContext2D } from "npm:@types/offscreencanvas"
import { Rect, positiveRect } from "https://deno.land/x/kitchensink_ts/struct.ts"


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
	}
}

let
	base_img = "./base_image.jpg",
	bitmask_img = "./bitmasks/juice.png",
	bitmask_rect = { x: 185, y: 184, width: 172, height: 258 } as const

document.body.appendChild(clipmask_offcanvas)
const img = new Image()
img.onload = () => new ClipMask(bitmask_img, bitmask_rect).clipImage(img)
img.src = base_img
