import { PureStep } from "./deps.ts"


export class Transparency_Operation extends PureStep<Uint8Array | Uint8ClampedArray, Uint8Array | Uint8ClampedArray> {
	protected alpha_offset: number

	constructor(alpha_offset = 127) {
		super()
		this.alpha_offset = alpha_offset
	}
	/** turn the provided buffer of pixels to become transparent where a black pixel is present.
	 * this method mutates the original input, so use with caution.
	*/
	forward(input: Uint8Array | Uint8ClampedArray): Uint8ClampedArray {
		// turn black pixels completely transparent
		for (let i = 0, len = input.length * 4; i < len; i += 4) {
			if (input[i] + input[i + 1] + input[i + 2] === 0) {
				input[i + 3] = 0
			}
		}
		return new Uint8ClampedArray(input.buffer)
	}
	/** turn the provided buffer of pixels to become black, wherever a transparent pixel is present.
	 * this method mutates the original input, so use with caution.
	*/
	backward(input: Uint8Array | Uint8ClampedArray): Uint8ClampedArray {
		const alpha_offset = this.alpha_offset
		// turn black pixels completely transparent
		for (let i = 0, len = input.length * 4; i < len; i += 4) {
			const pixel_value = input[i + 3] <= alpha_offset ? 0 : 255
			input[i] = input[i + 1] = input[i + 2] = pixel_value
			input[i + 3] = 255
		}
		return new Uint8ClampedArray(input.buffer)
	}
}
