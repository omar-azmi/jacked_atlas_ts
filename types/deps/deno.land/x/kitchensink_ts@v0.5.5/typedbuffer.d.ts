/** utility functions for handling buffers and typed arrays, and also reading and writing data to them
 * @module
*/
import { NumericArray, NumericDType, TypedArray, TypedArrayConstructor } from "./typedefs.js";
/** checks if an object `obj` is a {@link TypedArray}, based on simply checking whether `obj.buffer` exists or not. <br>
 * this is certainly not a very robust way of verifying. <br>
 * a better approach would be to check if `obj instanceof Object.getPrototypeOf(Uint8Array)`, but this is quicker <br>
*/
export declare const isTypedArray: (obj: unknown) => obj is TypedArray<NumericDType>;
/** get a typed array constructor by specifying the type as a string */
export declare const typed_array_constructor_of: <DType extends NumericDType = NumericDType>(type: `${DType}${string}`) => TypedArrayConstructor<DType>;
/** dictates if the native endianess of your `TypedArray`s is little endian. */
export declare const getEnvironmentEndianess: () => boolean;
/** this variable dictates if the native endianess of your `TypedArray`s is little endian. */
export declare const env_le: boolean;
/** swap the endianess of the provided `Uint8Array` buffer array in-place, given that each element has a byte-size of `bytesize`
 * @category inplace
*/
export declare const swapEndianess: (buf: Uint8Array, bytesize: number) => Uint8Array;
/** 10x faster implementation of {@link swapEndianess} that does not mutatate the original `buf` array
 * @category copy
*/
export declare const swapEndianessFast: (buf: Uint8Array, bytesize: number) => Uint8Array;
/** concatenate a bunch of `Uint8Array` and `Array<number>` into a single `Uint8Array` array
 * @category copy
*/
export declare const concatBytes: (...arrs: (Uint8Array | Array<number>)[]) => Uint8Array;
/** concatenate a bunch of {@link TypedArray}
 * @category copy
*/
export declare const concatTyped: <TA extends TypedArray<NumericDType>>(...arrs: TA[]) => TA;
/** resovle the positive (normalized) starting and ending indexes of a range. <br>
 * for both `start` and `end`, a negative index can be used to indicate an index from the end of the range, if a `length` is given. <br>
 * for example, `-2` refers to the second to last index (ie `length - 2`).
 * @param start starting index. defaults to `0`
 * @param end ending index. defaults to `undefined` if `length` is not provided. else `end = length` (before offsetting)
 * @param length length of the array in question. required if you want a numeric value of `end` that is `undefined`. defaults to `undefined`
 * @param offset in the very end of evauation, add an addition offset to `start` and `end` indexes
 * @returns a 3-tuple array of resolved [`start` index, `end` index, and `length` of range (ie `end - start`)]
*/
export declare function resolveRange(start: number | undefined, end: number | undefined, length: number, offset?: number): [start: number, end: number, length: number];
export declare function resolveRange(start?: number | undefined, end?: number | undefined, length?: undefined, offset?: number): [start: number, end: number | undefined, length: undefined];
/** split {@link TypedArray} after every `step` number of elements through the use of subarray views <br>
 * @deprecated kind of pointless, when {@link sliceSkipTypedSubarray} and {@link sliceSkip} exist
 * @category inplace
*/
export declare const splitTypedSubarray: <TA extends TypedArray<NumericDType>>(arr: TA, step: number) => TA[];
/** slice `slice_length` number of elements, then jump forward `skip_length` number of elements, and repeat <br>
 * optionally provide a `start` index to begin at, and an `end` index to stop at. <br>
 * if you want to skip first and slice second, you can set `start = skip_length` to get the desired equivalent result <br>
 * @category copy
*/
export declare const sliceSkip: <A extends NumericArray>(arr: A, slice_length: number, skip_length?: number, start?: number, end?: number) => A[];
/** similar to {@link sliceSkip}, but for subarray views of {@link TypedArray}. <br>
 * @category inplace
*/
export declare const sliceSkipTypedSubarray: <TA extends TypedArray<NumericDType>>(arr: TA, slice_length: number, skip_length?: number, start?: number, end?: number) => TA[];
/** find out if two regular, or typed arrays are element wise equal, and have the same lengths */
export declare const isIdentical: <T extends [] | TypedArray<NumericDType>>(arr1: T, arr2: T) => boolean;
/** find out if two regular, or typed arrays are element wise equal upto the last element of the shorter of the two arrays */
export declare const isSubidentical: <T extends [] | TypedArray<NumericDType>>(arr1: T, arr2: T) => boolean;
/** represents continuous intervals at which slices should be performed by {@link sliceContinuous}. <br>
 * if the final entry/element is `undefined`, it would indicate an open end towards infinity (ie till end of array).
*/
export type ContinuousIntervals = [...number[], number | undefined];
/** continuously slice an array (or string) at the provided continuous interval indexes. <br>
 * @example
 * ```ts
 * const arr = Array(100).map((v, i) => i) // === [0, 1, 2, ..., 99]
 * const slices: ContinuousIntervals = [0, 20, 30, 70, undefined]
 * sliceContinuous(arr, slices) // === [[0, 1, 2, ..., 19], [20, 21, ..., 29], [30, ..., 69], [70, ..., 99]]
 * ```
*/
export declare const sliceContinuous: <T extends string | any[]>(arr: T, slice_intervals: ContinuousIntervals) => T[];
/** exactly similar to {@link sliceContinuous}, but catered toward providing {@link TypedArray}'s subarray views, instead of doing actual copy-slicing. */
export declare const sliceContinuousTypedSubarray: <T extends TypedArray<NumericDType>>(arr: T, slice_intervals: ContinuousIntervals) => T[];
/** represents intervals at which slices should be performed by {@link sliceIntervals}. <br>
 * - every even element dictates a `start` index, which should be:
 *   - a positive `number`
 * - every odd element dictates the subsequent `end` index, which can one of:
 *   - a positive `number`
 *   - a negative `number`, for reverse indexing
 *   - or `undefined`, for last element (inclusive) indexing
 * @example
 * ```ts
 * // mathematically represents the set of intervals: { [0, 10), [20, 30), [90, Inf), [15, arr.length - 15) }
 * const my_intervals: Intervals = [0, 10, 20, 30, 90, undefined, 15, -15]
 * ```
*/
export type Intervals = [start_0: number, end_0: number | undefined, ...start_i_end_i: (number | undefined)[]];
/** slice an array (or string) at the provided flattened 2-tuple of interval indexes. <br>
 * @example
 * ```ts
 * const arr = Array(100).map((v, i) => i) // === [0, 1, 2, ..., 99]
 * const slices: Intervals = [0, 10, 20, 30, 90, undefined, 15, -15]
 * sliceIntervals(arr, slices) // === [[0, 1, 2, ..., 9], [20, 21, ..., 29], [90, ..., 99], [15, ..., 84]]
 * ```
*/
export declare const sliceIntervals: <T extends string | any[]>(arr: T, slice_intervals: Intervals) => T[];
/** exactly similar to {@link sliceIntervals}, but catered toward providing {@link TypedArray}'s subarray views, instead of doing actual copy-slicing. */
export declare const sliceIntervalsTypedSubarray: <T extends TypedArray<NumericDType>>(arr: T, slice_intervals: Intervals) => T[];
/** represents interval starting points and lengths at which slices should be performed by {@link sliceIntervalLengths}. <br>
 * - every even element dictates a `start` index, which should be:
 *   - a positive `number`
 * - every odd element dictates the subsequent `len` length of the interval, which can one of:
 *   - a positive `number`
 *   - or `undefined`, for slicing till end
 * @example
 * ```ts
 * // mathematically represents the set of intervals: { [0, 0 + 10), [20, 20 + 10), [90, Inf), [15, 15 + 70) } === { [0, 10), [20, 30), [90, 100), [15, 85) }
 * const my_intervals: IntervalLengths = [0, 10, 20, 10, 90, undefined, 15, 70]
 * ```
*/
export type IntervalLengths = [start_0: number, len_0: number | undefined, ...start_i_len_i: (number | undefined)[]];
/** slice an array (or string) at the provided flattened 2-tuple of (interval starting index, interval length). <br>
 * @example
 * ```ts
 * const arr = Array(100).map((v, i) => i) // === [0, 1, 2, ..., 99]
 * const slices: IntervalLengths = [0, 10, 20, 10, 90, undefined, 15, 70]
 * sliceIntervalLengths(arr, slices) // === [[0, 1, 2, ..., 9], [20, 21, ..., 29], [90, ..., 99], [15, ..., 84]]
 * ```
*/
export declare const sliceIntervalLengths: <T extends string | any[]>(arr: T, slice_intervals: IntervalLengths) => T[];
/** exactly similar to {@link sliceIntervalLengths}, but catered toward providing {@link TypedArray}'s subarray views, instead of doing actual copy-slicing. */
export declare const sliceIntervalLengthsTypedSubarray: <T extends TypedArray<NumericDType>>(arr: T, slice_intervals: Intervals) => T[];
