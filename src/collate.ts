import { PureStep, clamp, sum } from "./deps.ts"


type WordID = [mushaf: number, surah: number, word: number, part: number]

class Integer32ArrayBitpacker<T extends number[]> extends PureStep<number, T> {
	private readonly bit_lengths: Array<number> & { length: T["length"] }

	constructor(field_bit_lengths: Array<number> & { length: T["length"] }) {
		super()
		console.assert(sum(field_bit_lengths) === 32, "the number of bits of all fields should exactly sum up to 32")
		this.bit_lengths = field_bit_lengths
	}

	forward(input: number): T {
		// truncate the input into a 32bit integer
		input |= 0
		const output: number[] = []
		for (const bit_length of this.bit_lengths.toReversed()) {
			output.push(input & ((1 << bit_length) - 1))
			input >>>= bit_length
		}
		return output.reverse() as T
	}

	backward(input: T): number {
		const
			bit_lengths = this.bit_lengths,
			len = bit_lengths.length
		let output = 0
		for (let i = 0; i < len; i++) {
			const bit_length = bit_lengths[i]
			output <<= bit_length
			output += clamp(input[i], 0, (1 << bit_length) - 1) | 0
		}
		return output
	}
}


class IntegerBigArrayBitpacker<T extends bigint[]> extends PureStep<bigint, T> {
	private readonly bit_lengths: Array<bigint> & { length: T["length"] }

	constructor(field_bit_lengths: Array<bigint> & { length: T["length"] }) {
		super()
		this.bit_lengths = field_bit_lengths
	}

	forward(input: bigint): T {
		const output: bigint[] = []
		for (const bit_length of this.bit_lengths.toReversed()) {
			output.push(input & ((1n << bit_length) - 1n))
			input >>= bit_length
		}
		return output.reverse() as T
	}

	backward(input: T): bigint {
		const
			bit_lengths = this.bit_lengths,
			len = bit_lengths.length
		let output = 0n
		for (let i = 0; i < len; i++) {
			const bit_length = bit_lengths[i]
			output <<= bit_length
			// @ts-ignore: `clamp` will work with bigint, it's just not typed for it.
			output += clamp(input[i], 0n, (1n << bit_length) - 1n)
		}
		return output
	}
}

const word_id_step = new Integer32ArrayBitpacker<WordID>([8, 8, 14, 2])
