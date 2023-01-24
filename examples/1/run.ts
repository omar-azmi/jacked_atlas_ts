import { JAtlasManager, HorizontalImageScroller, ClippedImage } from "../../src/mod.ts"

let
	atlas_man: JAtlasManager,
	hscroller: HorizontalImageScroller,
	atlas_man_json: string

JAtlasManager.fromURL("./segments.jatlas.json")
	.then((new_atlas_manager) => {
		const
			c1 = new ClippedImage(new_atlas_manager, 0),
			c2 = new ClippedImage(new_atlas_manager, 1)
		atlas_man = new_atlas_manager
		hscroller = new HorizontalImageScroller(document.body, 1500, 600)
		let t0 = performance.now()
		for (let l = 0; l < 25; l++) setTimeout(() => {
			hscroller.addEntryLeft(Math.random() >= 0.5 ? c1 : c2)
		}, Math.random() * 10_000)
		for (let r = 0; r < 25; r++) setTimeout(() => {
			hscroller.addEntryRight(Math.random() < 0.5 ? c1 : c2)
		}, Math.random() * 10_000)
		let t1 = performance.now()
		console.log(`draw loop time: ${t1 - t0}`)
		return new_atlas_manager
	})
	.then(async (new_atlas_manager) => {
		atlas_man_json = await new_atlas_manager.toJSON()
	})
