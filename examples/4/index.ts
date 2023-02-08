import { Sprite, JAtlasManager } from "../../src/mod.ts"

const
	FPS = 60,
	W = 800,
	H = 600,
	canvas = document.createElement("canvas")!,
	ctx = canvas.getContext("2d")!,
	sprites: Sprite[] = []

JAtlasManager.fromURL("./manuscript.jpg.jatlas.json")
	.then(async (new_atlas_man) => {
		await new_atlas_man.source_loaded
		await new_atlas_man.entries_loaded
		window.atlas_man = new_atlas_man
		for (const id of Object.keys(new_atlas_man.entries)) {
			const
				new_sprite = new_atlas_man.getEntryImageSprite(parseFloat(id)),
				scale = 0.33
			new_sprite.source_loaded
				.then((s) => {
					const { width, height } = s.bitmap!
					s.setConfig({
						x: Math.random() * W,
						y: Math.random() * H,
						width: width * scale,
						height: height * scale,
					})
				})
			sprites.push(new_sprite)
		}
	})


document.body.appendChild(canvas)
canvas.width = W
canvas.height = H
let t = 0
const
	drawAll = () => {
		ctx.resetTransform()
		ctx.fillStyle = "yellow"
		ctx.fillRect(0, 0, W, H)
		for (const sprite of sprites) {
			sprite.coords[0] += 50 / FPS * Math.random()
			sprite.coords[1] += 50 / FPS * Math.random()
			if (sprite.coords[0] > W) sprite.coords[0] = 0
			if (sprite.coords[1] > H) sprite.coords[1] = 0
			sprite.draw(ctx)
		}
		t += 1 / FPS
	},
	RUN = setInterval(requestAnimationFrame, 1 / FPS, drawAll)

Object.assign(window, {
	drawAll, RUN, canvas, ctx, sprites
})