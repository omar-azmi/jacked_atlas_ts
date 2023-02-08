import { AnyImageSource, Ctx2D, UnitInterval, constructImageBitmapSource } from "./deps.ts"

export interface SpriteCoordsObj {
	/** sprite's x-pos w.r.t world origin <br>
	 * defaults to: `0`
	*/
	x?: number
	/** sprite's y-pos w.r.t world origin <br>
	 * defaults to: `0`
	*/
	y?: number
	/** sprite's pixel width w.r.t world. negative values correspond to horizontal mirrorring <br>
	 * defaults to: maintains aspect ratio with bitmap if `height` is provided, else `1`
	*/
	width?: number
	/** sprite's pixel height w.r.t world. negative values correspond to vertical mirrorring <br>
	 * defaults to: maintains aspect ratio with bitmap if `width` is provided, else `1`
	*/
	height?: number
	/** sprite's x-center of body; the point who's position remains invariant to rotation <br>
	 * the value must be in the closed interval `[0.0, 1.0]`, for it to be within the rectangular bounds of the sprite <br>
	 * defaults to: `0` i.e. left border
	*/
	cx?: UnitInterval
	/** sprite's y-center of body; the point who's position remains invariant to rotation <br>
	 * the value must be in the closed interval `[0.0, 1.0]`, for it to be within the rectangular bounds of the sprite <br>
	 * defaults to: `0` i.e. top border
	*/
	cy?: UnitInterval
	/** x-component of the front-facing horizontal line unit vector <br>
	 * defaults to: `1` i.e. left-to-right vector
	*/
	hx?: UnitInterval
	/** y-component of the front-facing horizontal line unit vector <br>
	 * defaults to: `0` i.e. left-to-right vector
	*/
	hy?: UnitInterval
	src?: AnyImageSource
}

export type SpriteCoords = [
	x: SpriteCoordsObj["x"],
	y: SpriteCoordsObj["y"],
	width: SpriteCoordsObj["width"],
	height: SpriteCoordsObj["height"],
	cx: SpriteCoordsObj["cx"],
	cy: SpriteCoordsObj["cy"],
	hx: SpriteCoordsObj["hx"],
	hy: SpriteCoordsObj["hy"],
]

export class Sprite {
	coords: SpriteCoords = [0, 0, 1, 1, 0, 0, 1, 0]
	bitmap?: ImageBitmap
	source_loaded!: Promise<this>
	private resolve_source_loaded!: () => void
	private reject_source_loaded!: (reason?: any) => void
	private reset_source_loaded = (): void => {
		if (this.source_loaded === undefined) {
			this.source_loaded = new Promise<this>((resolve, reject) => {
				this.resolve_source_loaded = () => resolve(this)
				this.reject_source_loaded = reject
			})
		}
	}

	setSource = (source_img: AnyImageSource) => {
		this.bitmap = undefined
		this.reset_source_loaded()
		constructImageBitmapSource(source_img)
			.then(createImageBitmap)
			.then((bitmap) => {
				this.bitmap = bitmap
				this.resolve_source_loaded()
			})
			.catch(() => { throw new Error(`failed to load source image:\n\t${source_img}`) })
		return this.source_loaded
	}

	setConfig(config: Partial<SpriteCoordsObj>) {
		const coords = this.coords
		if (config.x) coords[0] = config.x
		if (config.y) coords[1] = config.y
		if (config.width) coords[2] = config.width
		if (config.height) coords[3] = config.height
		if (config.cx) coords[4] = config.cx
		if (config.cy) coords[5] = config.cy
		if (config.hx) coords[6] = config.hx
		if (config.hy) coords[7] = config.hy
		if (config.src) this.setSource(config.src)
	}

	constructor(config?: Partial<SpriteCoordsObj>) {
		const { src, ...coords_config } = config ?? {}
		if (src) this.setSource(src)
		else this.reset_source_loaded()
		this.setConfig(coords_config)
	}

	draw = (ctx: Ctx2D, ...coords: Partial<SpriteCoords>) => {
		for (let i = 0; i < 8; i++) if (coords[i] === undefined) coords[i] = this.coords[i]
		const
			x = coords[0] - coords[2] * coords[4],
			y = coords[1] - coords[3] * coords[5]
		if (this.bitmap) ctx.drawImage(this.bitmap, x, y, coords[2], coords[3])
	}
}
