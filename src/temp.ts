import { PureStep } from "https://deno.land/x/fbicodec_ts@v0.1.1/mod.ts"
import { blobToBase64 } from "https://deno.land/x/kitchensink_ts@v0.7.3/browser.ts"
import { blob_fetcher, getBGCanvas, getBGCtx } from "./funcdefs.ts"

export interface JAtlasEntry<DATA_TYPE extends any = any> {
	name?: string
	x: number
	y: number
	width: number
	height: number
	format: string
	data: DATA_TYPE
}

export interface JAtlasMaskEntry_Image extends JAtlasEntry<ImageBitmap> {
	format: "maskbitmap"
}

export abstract class ImageFormatParser<DATA_TYPE, FORMAT extends string = any> extends PureStep<
	JAtlasEntry<DATA_TYPE> & { format: FORMAT },
	JAtlasMaskEntry_Image
> { }

export class Base64Image_Step extends ImageFormatParser<string, "base64image"> {
	forward(input: JAtlasEntry<string> & { format: "base64image" }): JAtlasMaskEntry_Image {
		const { format, data, ...output } = input

		return {
			...output,
			format: "maskbitmap",
			data: new ImageBitmap()
		}
	}

	backward(input: JAtlasMaskEntry_Image): JAtlasEntry<string> & { format: "base64image" } {
		throw new Error("Method not implemented.")
	}
}




class JAtlasContext {
	formatParsers: ImageFormatParser[]

}
