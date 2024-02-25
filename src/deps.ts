export { PureStep as Invertible } from "https://deno.land/x/fbicodec_ts@v0.1.1/mod.ts"
export { blobToBase64 } from "https://deno.land/x/kitchensink_ts@v0.7.3/browser.ts"
export { object_assign, object_entries, promise_resolve } from "https://deno.land/x/kitchensink_ts@v0.7.3/builtin_aliases_deps.ts"
export { constructImageBitmapSource, constructImageBlob, constructImageData, coordinateTransformer, getBGCanvas as get_bg_canvas, getBGCtx as get_bg_ctx } from "https://deno.land/x/kitchensink_ts@v0.7.3/image.ts"
export type { AnyImageSource, Base64ImageString, ImageBlob } from "https://deno.land/x/kitchensink_ts@v0.7.3/image.ts"
export { clamp, sum } from "https://deno.land/x/kitchensink_ts@v0.7.3/numericmethods.ts"
export type { Rect, SimpleImageData } from "https://deno.land/x/kitchensink_ts@v0.7.3/struct.ts"
export { sliceIntervalsTypedSubarray } from "https://deno.land/x/kitchensink_ts@v0.7.3/typedbuffer.ts"
export type { Intervals } from "https://deno.land/x/kitchensink_ts@v0.7.3/typedbuffer.ts"
export type { Require, UnitInterval } from "https://deno.land/x/kitchensink_ts@v0.7.3/typedefs.ts"

export const enum DEBUG {
	LOG = 1,
	ERROR = 1,
	ASSERT = 1,
}

export const object_hasOwn = Object.hasOwn

// TODO: import from `kitchenskink_ts` in the upcoming release
export const console_log = console.log
export const console_assert = console.assert
export const console_error = console.error

// TODO: add to `kitchenskink_ts`
export type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D

// TODO: add to `kitchenskink_ts`
export class LimitedMap<K, V> extends Map<K, V> {
	protected capacity: number

	constructor(capacity: number) {
		super()
		this.capacity = capacity
	}

	set(key: K, value: V, on_delete_callback?: (deleted_key: K, deleted_value: V) => void): this {
		if (this.size >= this.capacity) {
			const [oldest_key, oldest_value] = this.entries().next().value as [K, V]
			super.delete(oldest_key)
			on_delete_callback?.(oldest_key, oldest_value)
		}
		return super.set(key, value)
	}

	delete(key: K, on_delete_callback?: (deleted_key: K, deleted_value: V) => void): boolean {
		if (on_delete_callback) {
			const
				value = super.get(key),
				value_existed = super.delete(key)
			if (value_existed) {
				on_delete_callback(key, value!)
			}
			return value_existed
		}
		return super.delete(key)
	}

	clear(on_delete_callback?: (deleted_key: K, deleted_value: V) => void): void {
		if (on_delete_callback) {
			super.forEach((value, key) => on_delete_callback(key, value))
		}
		return super.clear()
	}
}
