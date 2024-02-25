import { DEBUG, LimitedMap, Require, console_assert, console_error } from "./deps.ts"
import { imagebitmap_deletion_action, imagebitmap_is_closed } from "./funcdefs.ts"
import { ImageSource_LoaderAndSaver, LoadedImageWrapper } from "./typedefs.ts"


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
interface ImagePoolEntry<SOURCE = any, ARGS = any> {
	/** TODO: debate whether or not this is even needed */
	width: number
	/** TODO: debate whether or not this is even needed */
	height: number
	source: SOURCE
	image?: ImageBitmap
	/** encapsulates any args that were used along with the {@link source} when loading the image through one of the {@link ImagePool.loaders | `loaders`}.
	 * these args will be required when saving the image entry back to the source.
	*/
	args?: LoadedImageWrapper<ARGS>["args"]
	/** encapsulate any meta data you desire. this property is not utilized by {@link ImagePool | `ImagePool`} at all */
	meta?: { string: any }
}

const try_all_image_loaders = async <SOURCE, ARGS = any>(loaders: Array<ImageSource_LoaderAndSaver<SOURCE, ARGS>>, source: SOURCE): Promise<LoadedImageWrapper<ARGS>> => {
	if (DEBUG.ASSERT) { console_assert(loaders.length > 0, "there are not image loaders in this ImagePool, so there's no way to load any format of image.") }
	for (const loader of loaders) {
		if (await loader.test(source) === true) {
			return loader.forward(source)
		}
	}
	if (DEBUG.ERROR) { console_error("no image loader is capable of loading the source:", source) }
	throw Error(DEBUG.ERROR ? "failed to load image" : "")
}

export class ImagePool<KEY, SOURCE = any, ENTRY extends ImagePoolEntry<SOURCE> = any> extends Map<KEY, ENTRY> {
	protected pool: LimitedMap_ImageBitmap<KEY>
	protected loaders: Array<ImageSource_LoaderAndSaver<SOURCE, any>> = []

	constructor(capacity: number) {
		super()
		this.pool = new LimitedMap_ImageBitmap(capacity)
	}

	addLoader(loader: ImageSource_LoaderAndSaver<SOURCE, any>) {
		this.loaders.push(loader)
	}

	get(key: KEY, on_image_loaded_callback?: (value: Require<ENTRY, "image" | "args">) => void): ENTRY & { image: ImageBitmap, args: NonNullable<ENTRY>["args"] } | undefined {
		const
			pool = this.pool,
			value = super.get(key)
		if (value === undefined) { return }
		if (imagebitmap_is_closed(value.image)) {
			if (imagebitmap_is_closed(value.image = pool.get(key))) {
				// the image is not cached either, so we must now fetch it, and then inform the `on_image_loaded_callback` upon loading.
				try_all_image_loaders(this.loaders, value.source)
					.then((loaded_wrapped_image: LoadedImageWrapper<any>) => {
						const { value: image, args } = loaded_wrapped_image
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
		return value as ENTRY & { image: ImageBitmap, args: NonNullable<ENTRY>["args"] }
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


