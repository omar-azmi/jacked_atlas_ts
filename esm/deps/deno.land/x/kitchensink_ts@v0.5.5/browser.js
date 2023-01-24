/** utility functions for web browser interaction
 * @module
*/
/** create a blob out of your `Uint8Array` bytes buffer and queue it for downloading. <br>
 * you can also provide an optional `file_name` and `mime_type`
*/
export const downloadBuffer = (buf, file_name = "data.bin", mime_type = "application/octet-stream") => {
    const blob = new Blob([buf], { type: mime_type }), anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(blob);
    anchor.download = file_name;
    anchor.click();
    URL.revokeObjectURL(anchor.href);
};
/** convert a blob to base64 string. <br>
 * this function works correctly all the time, unlike `btoa`, which fails for arbitrary bytes
*/
export const blobToBase64 = (blob) => {
    const reader = new FileReader();
    return new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result.split(";base64,", 2)[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};
