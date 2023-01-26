# Jacked Atlas
a tool for clipping regions of interest based on a bitmap mask, which is commonly referred to as an atlas. <br>
under the hood, I'm simply utilizing an `OffscreenCanvas` with `ctx.globalCompositeOperation = "source-in"` to clip <br>
there are several ways of going about extracting masked regions of interest from an image. <br>
but in general, you need 3 sets of information/data:
- **source image**
  - can be anything accepted by `ctx.drawImage` (aka `CanvasImageSource`)
- **bitmap of mask**
  - can be anything accepted by `ctx.drawImage` (aka `CanvasImageSource`)
  - can be either a boolean `Array` or `Uint8Array` of y-major stream of pixel data (`px_data = [x0y0, x1y0, x2y0, ..., x0y1, x1y1, ...]`)
  - can be ~~scanline~~ drawing instructions (TODO)
- **offset position of mask**
  - [x, y, width, height] = [185, 184, 172, 258]

although clipping regions of interest is the fundamental functionality of this library, it is just a small portion of the codebase <br>
much of the library provides an interface for managing clips asynchronously, converting from various input atlas formats to different various output atlas formats, and previewing clips on canvas asynchronously. <br>

the source is written in `Typescript` and the documentation is generated using `TypeDoc`. <br>

### Example


| description | data |
| ----------- | ----------- |
| input source image | <img src="../examples/1/source_image.jpg" alt="jack atlas holding juice" width="400"> |
| input juice bitmask | <img src="../examples/1/bitmasks/juice.png" alt="juice bitmask" width="100"> |
| input mask rect coordinates | `let rect = { x: 185, y: 184, width: 172, height: 258 }` |
| output extracted image | <img src="../examples/1/extracts/juice.png" alt="extracted juice" width="100"> |


### TODO
- improve name consistency, especially the loadImage function of JAtlasManager and JAtlasManager.source 
- make more `Promise<void>` functions return their important value rather than just signallying `undefined`
- make an interactive HScroller
- design uncaching/deleting of `ClipMask.data_blob`
- turn `ClipMask` or `JAtlas` into a recursive/nested `JAtlasManager`, with the clipped parent image always being the `source` of the child/nested `JAtlas` clip
- for web supported MIME image formats, don't put the MIME-text inside of `JAtlas.kind`, but rather keep it prepended to `JAtlas.data`, and introduce `JAtlas.kind = "mime" | "native" | "uri" | "data_uri" | "base64" | etc...` for natively supported web browser images
- use `idat_codec_ts` to encode 1bit png clipmasks into `JAtlas.data`, because browsers are too stupid to realize the compressibility of bit-data. although webp might already do that, but the native webp encoding is not lossless, nor can you set an option for it to become lossless. But I have yet to see an artifacact from the lossy compression of webp, unlike jpg, where it was immediately clear at 75% quality encoding


