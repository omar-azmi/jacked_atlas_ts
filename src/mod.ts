export * from "./jatlas.ts"
export * from "./sprite.ts"

import { JAtlasManager } from "./jatlas.ts"

/** TODO:
 * - recursive/treelike/nested clipmasks or jatlas, where the parent `JAtlasEntry` can be used as the `source` for the child `entries`
*/
const DEBUG = true

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
