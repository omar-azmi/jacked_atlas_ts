import { DEBUG, LimitedMap, Require, console_assert, console_error } from "./deps.ts"
import { imagebitmap_deletion_action, imagebitmap_is_closed } from "./funcdefs.ts"
import { ImageCodecInput, ImageCodecOutput, ImageSource_Codec } from "./typedefs.ts"


class LimitedMap_ImageBitmap<K> extends LimitedMap<K, ImageBitmap> {
	set(key: K, value: ImageBitmap) {
		return super.set(key, value, imagebitmap_deletion_action)
	}
	delete(key: K): boolean {
		return super.delete(key, imagebitmap_deletion_action)
	}
	clear(): void {
		return super.clear(imagebitmap_deletion_action)
	}
}

// TODO: add plugin style source loaders
type ImagePoolEntry<SOURCE = any, ARGS = any> = ImageCodecInput<SOURCE> & Partial<ImageCodecOutput<ARGS>> & {
	/** TODO: debate whether or not this is even needed */
	width: number
	/** TODO: debate whether or not this is even needed */
	height: number
	/** encapsulate any meta data you desire. this property is not utilized by {@link ImagePool | `ImagePool`} at all */
	meta?: { string: any }
}

const try_all_image_loaders = async <
	INPUT extends ImageCodecInput<any> = any,
	OUTPUT extends ImageCodecOutput<any> = any
>(image_codecs: Array<ImageSource_Codec<INPUT, OUTPUT>>, source_input: INPUT): Promise<OUTPUT> => {
	if (DEBUG.ASSERT) { console_assert(image_codecs.length > 0, "there are not image loaders in this ImagePool, so there's no way to load any format of image.") }
	for (const loader of image_codecs) {
		if (await loader.test(source_input) === true) {
			return loader.forward(source_input)
		}
	}
	if (DEBUG.ERROR) { console_error("no image loader is capable of loading the source:", source_input) }
	throw Error(DEBUG.ERROR ? "failed to load image" : "")
}

export class ImagePool<KEY, SOURCE = any, ENTRY extends ImagePoolEntry<SOURCE> = any> extends Map<KEY, ENTRY> {
	protected pool: LimitedMap_ImageBitmap<KEY>
	protected codecs: Array<ImageSource_Codec<ImageCodecInput<SOURCE>, ImageCodecOutput<any>>> = []

	constructor(capacity: number) {
		super()
		this.pool = new LimitedMap_ImageBitmap(capacity)
	}

	addCodec(codec: ImageSource_Codec<ImageCodecInput<SOURCE>, ImageCodecOutput<any>>) {
		this.codecs.push(codec)
	}

	get(key: KEY, on_image_loaded_callback?: (value: Require<ENTRY, "image" | "args">) => void): ENTRY & ImageCodecOutput<any> | undefined {
		const
			pool = this.pool,
			value = super.get(key)
		if (value === undefined) { return }
		if (imagebitmap_is_closed(value.image)) {
			if (imagebitmap_is_closed(value.image = pool.get(key))) {
				// the image is not cached either (or perhaps it was released/closed),
				// so we must now fetch it (or re-fetch it), and then inform the `on_image_loaded_callback` upon loading.
				try_all_image_loaders(this.codecs, value)
					.then((image_codec_output: ImageCodecOutput<any>) => {
						const { image, args } = image_codec_output
						pool.set(key, image)
						value.image = image
						value.width = image.width
						value.height = image.height
						value.args = args
						return value as Require<ENTRY, "image" | "args">
					})
					.then(on_image_loaded_callback)
				return undefined
			}
			// if we make it to here, then the image was cached and hasn't been disposed (closed) yet. so it is perfectly viable for usage.
		}
		return value as ENTRY & ImageCodecOutput<any>
	}

	set(key: KEY, value: ENTRY): this {
		const old_entry = super.get(key)
		if (old_entry?.image !== value.image) {
			// there exists an old entry (that is different from the current image entry).
			// we must first close its image (to release memory) and then dispose of it.
			old_entry?.image?.close()
			this.pool.delete(key)
		}
		return super.set(key, value)
	}

	delete(key: KEY): boolean {
		const
			value = super.get(key),
			value_existed = super.delete(key)
		if (value_existed) {
			const image = value!.image
			if (image) { imagebitmap_deletion_action(key, image) }
			this.pool.delete(key)
		}
		return value_existed
	}

	clear(): void {
		super.forEach((value, key) => {
			const image = value.image
			if (image) { imagebitmap_deletion_action(key, image) }
		})
		this.pool.clear()
		return super.clear()
	}
}


