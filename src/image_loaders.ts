import { DEBUG, blobToBase64, console_error, console_log, object_hasOwn } from "./deps.ts"
import { getBGCanvas, getBGCtx } from "./funcdefs.ts"
import { Transparency_Operation } from "./operations.ts"
import { ImageSource_LoaderAndSaver, LoadedImageWrapper, MaskedRect, PositionedRect, PromiseOrRegular } from "./typedefs.ts"


// TODO: add ImageURL_LoaderAndSaver

/** an image source "loader and saver" for image data-uri types, such as `"data:image/png;base64,iVBOR..."`. */
export class ImageDataURI_LoaderAndSaver extends ImageSource_LoaderAndSaver<string, ImageEncodeOptions> {
	private args: ImageEncodeOptions

	constructor(default_encoding_options: ImageEncodeOptions = { type: "image/png" }) {
		super()
		this.args = default_encoding_options
	}
	async test(test_source: Promise<string | any>): Promise<boolean> {
		try {
			const source = await test_source
			// check if the source starts with "data:image/"
			return typeof source === "string" && source.startsWith("data:image/")
		} catch (error) {
			if (DEBUG.ERROR) { console_log("while testing image source, failed to fetch the source due to error:\n\t", error) }
		}
		return false
	}
	async forward(input: PromiseOrRegular<string>): Promise<LoadedImageWrapper<ImageEncodeOptions>> {
		const
			blob = await (await fetch(await input)).blob(),
			image_type = blob.type,
			image = await createImageBitmap(blob)
		return {
			value: image,
			args: { type: image_type }
		}
	}
	async backward(input: PromiseOrRegular<LoadedImageWrapper<ImageEncodeOptions | undefined>>): Promise<string> {
		const
			default_args = this.args,
			{ value: image, args = {} } = await input
		getBGCtx(image.width, image.height).drawImage(image, 0, 0)
		const blob = await getBGCanvas().convertToBlob({ ...default_args, ...args })
		return blobToBase64(blob)
	}
}


export class ImageClipped_LoaderAndSaver extends ImageSource_LoaderAndSaver<MaskedRect, PositionedRect> {
	protected base?: CanvasImageSource
	protected transparency_op = new Transparency_Operation(127)

	constructor(base_image?: CanvasImageSource) {
		super()
		if (base_image) { this.setBaseImage(base_image) }
	}
	setBaseImage(base_image: CanvasImageSource) {
		this.base = base_image
	}

	async test(test_source: PromiseOrRegular<MaskedRect | any>): Promise<boolean> {
		const source = await test_source
		return (typeof source === "object"
			&& object_hasOwn(source, "x")
			&& object_hasOwn(source, "y")
			&& (
				(object_hasOwn(source, "width") && object_hasOwn(source, "height"))
				|| source.mask instanceof ImageBitmap
			)
		)
	}
	async forward(input: PromiseOrRegular<MaskedRect>): Promise<LoadedImageWrapper<PositionedRect>> {
		const
			rect = await input,
			transparency_operation = this.transparency_op,
			base_image = this.base,
			{ x, y, mask } = rect,
			width = (mask ?? rect).width!,
			height = (mask ?? rect).height!,
			canvas = getBGCanvas(width, height),
			ctx = getBGCtx(width, height)
		if (mask) {
			ctx.globalCompositeOperation = "copy"
			ctx.drawImage(mask, 0, 0)
			const transparent_mask = transparency_operation.forward(ctx.getImageData(0, 0, width, height).data)
			ctx.putImageData(new ImageData(transparent_mask, width), 0, 0)
			ctx.globalCompositeOperation = "source-in"
		}
		if (DEBUG.ERROR && base_image === undefined) {
			console_error("no base image has been loaded yet")
		}
		if (base_image) {
			ctx.drawImage(base_image, x, y, width, height, 0, 0, width, height)
		}
		const image = await createImageBitmap(canvas)
		return {
			value: image,
			args: { x, y }
		}
	}
	async backward(input: Promise<LoadedImageWrapper<PositionedRect>>): Promise<MaskedRect> {
		// TODO: check for bound-box of the buffer returned by `transparency_operation.backward`, and either minimize it,
		// or if the buffer is entirely white (none of the rect actually gets masked), then drop the mask option entirely.
		const
			{ value: image, args: { x = 0, y = 0 } } = await input,
			transparency_operation = this.transparency_op,
			width = image.width,
			height = image.height,
			canvas = getBGCanvas(width, height),
			ctx = getBGCtx(width, height)
		ctx.globalCompositeOperation = "copy"
		ctx.drawImage(image, 0, 0)
		const black_and_white_mask = transparency_operation.backward(ctx.getImageData(0, 0, width, height).data)
		ctx.putImageData(new ImageData(black_and_white_mask, width), 0, 0)
		return {
			x, y, width, height,
			mask: await createImageBitmap(canvas)
		}
	}
}


export interface JAtlasObjectEntry {
	x: number
	y: number
	width?: number
	height?: number
	mask?: string
}

export interface JAtlasObject {
	format: "jatlas"
	source: string
	width: number
	height: number
	entries: { [name: string]: JAtlasObjectEntry }
}

export class JAtlas_LoaderAndSaver extends ImageSource_LoaderAndSaver<JAtlasObjectEntry, PositionedRect> {
	protected url_loader_step: ImageDataURI_LoaderAndSaver
	protected clipper_step: ImageClipped_LoaderAndSaver

	constructor(base_image_source: string) {
		super()
		const
			url_loader_step = new ImageDataURI_LoaderAndSaver(),
			clipper_step = new ImageClipped_LoaderAndSaver()
		this.url_loader_step = url_loader_step
		this.clipper_step = clipper_step
		url_loader_step.forward(base_image_source).then((output) => {
			clipper_step.setBaseImage(output.value)
		})
	}

	async test(test_source: PromiseOrRegular<JAtlasObjectEntry | any>): Promise<boolean> {
		const source = await test_source
		return (typeof source === "object"
			&& object_hasOwn(source, "x")
			&& object_hasOwn(source, "y")
			&& (
				(object_hasOwn(source, "width") && object_hasOwn(source, "height"))
				|| typeof source.mask === "string"
			)
		)
	}
	async forward(input: PromiseOrRegular<JAtlasObjectEntry>): Promise<LoadedImageWrapper<PositionedRect>> {
		const
			source = await input,
			{ mask, ...clipper_input } = source
		return this.clipper_step.forward({
			...clipper_input,
			mask: mask ? (await this.url_loader_step.forward(mask)).value : undefined as any
		})
	}
	async backward(input: PromiseOrRegular<LoadedImageWrapper<PositionedRect>>): Promise<JAtlasObjectEntry> {
		throw new Error("Method not implemented.")
	}
}
