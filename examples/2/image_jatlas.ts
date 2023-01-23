/** generates `JAtlasManager` from an atlas indexed image
 * the default atlas indexing for a 4 channel image (`ch1`, `ch2`, `ch3`, `ch4`), works as follows:
 * ```ts
 * type ByteRange = number // minval = 0, maxval = 2**8 - 1 = 255
 * declare [ch1, ch2, ch3, ch4]: [ByteRange, ByteRange, ByteRange, ByteRange]
 * id: number = ch1 * (2**0) + ch2 * (2**8) + ch3 * (2**16) + (255 - ch4) * (1/100)
 * ```
 * 
 * so, in the context of `RGBA` channels, `id = R + G * 256 + B * 65536 + A / 100`
 * if fewer channels are available, then the multiplication with extra channels is simply discarded. for instance:
 * - in the case of `RGB`, `id = R + G * 256 + B * 65536`
 * - in the case of `LA`, `id = L + A * 256`
 * - etc...
 * 
 * you can always specify your own channels multipliers. the default is `[2**0, 2**8, 2**16, 1/100]`. <br>
 * in general, you would want to keep `RGBA = 0x000000FF` (or `id = 0`) for the background
*/

