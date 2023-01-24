/** utility functions for web browser interaction
 * @module
*/
/** create a blob out of your `Uint8Array` bytes buffer and queue it for downloading. <br>
 * you can also provide an optional `file_name` and `mime_type`
*/
export declare const downloadBuffer: (buf: Uint8Array, file_name?: string, mime_type?: string) => void;
/** convert a blob to base64 string. <br>
 * this function works correctly all the time, unlike `btoa`, which fails for arbitrary bytes
*/
export declare const blobToBase64: (blob: Blob) => Promise<string>;
