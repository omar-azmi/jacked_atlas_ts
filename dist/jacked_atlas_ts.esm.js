var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => {
  __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};

// src/deps/deno.land/x/kitchensink_ts@v0.5.5/browser.ts
var blobToBase64 = (blob) => {
  const reader = new FileReader();
  return new Promise((resolve, reject) => {
    reader.onload = () => resolve(reader.result.split(";base64,", 2)[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

// src/deps/deno.land/x/kitchensink_ts@v0.5.5/struct.ts
var positiveRect = (r) => {
  let { x, y, width, height } = r;
  if (width < 0) {
    width *= -1;
    x -= width;
  }
  if (height < 0) {
    height *= -1;
    y -= height;
  }
  return { x, y, width, height };
};

// src/deps/deno.land/x/kitchensink_ts@v0.5.5/typedbuffer.ts
var getEnvironmentEndianess = () => new Uint8Array(Uint32Array.of(1).buffer)[0] === 1 ? true : false;
var env_le = getEnvironmentEndianess();
var sliceIntervalsTypedSubarray = (arr, slice_intervals) => {
  const out_arr = [];
  for (let i = 1; i < slice_intervals.length; i += 2)
    out_arr.push(arr.subarray(slice_intervals[i - 1], slice_intervals[i]));
  return out_arr;
};

// src/deps/deno.land/x/kitchensink_ts@v0.5.5/image.ts
var isBase64Image = (str) => str === void 0 ? false : str.startsWith("data:image/");
var getBase64ImageHeader = (str) => str.slice(0, str.indexOf(";base64,") + 8);
var getBase64ImageBody = (str) => str.slice(str.indexOf(";base64,") + 8);
var multipurpose_canvas;
var multipurpose_ctx;
var init_multipurpose_canvas = () => {
  multipurpose_canvas = document.createElement("canvas");
  multipurpose_ctx = multipurpose_canvas.getContext("2d");
};
var constructImageData = (img, crop_rect) => {
  const { width, height, x, y } = positiveRect({ x: 0, y: 0, width: Number(img.width), height: Number(img.height), ...crop_rect });
  if (!multipurpose_ctx)
    init_multipurpose_canvas();
  multipurpose_canvas.width = width;
  multipurpose_canvas.height = height;
  multipurpose_ctx.clearRect(0, 0, width, height);
  multipurpose_ctx.drawImage(img, -x, -y);
  return multipurpose_ctx.getImageData(0, 0, width, height);
};

// src/mod.ts
var DEBUG = true;
var clipmask_data_format = "image/webp";
var clipmask_offcanvas = new OffscreenCanvas(10, 10);
var clipmask_offctx = clipmask_offcanvas.getContext("2d", { willReadFrequently: true });
clipmask_offctx.imageSmoothingEnabled = false;
var _ClipMask = class {
  rect;
  src_url;
  data_blob;
  constructor(src_url, rect) {
    this.src_url = src_url;
    this.rect = { x: 0, y: 0, width: 1, height: 1, ...rect };
  }
  fromURL = (src_url, rect) => {
    this.src_url = src_url;
    const img = new Image();
    img.src = src_url;
    return img.decode().then(() => {
      const { width: w, height: h } = img;
      rect.width = w;
      rect.height = h;
      clipmask_offcanvas.width = w;
      clipmask_offcanvas.height = h;
      clipmask_offctx.globalCompositeOperation = "copy";
      clipmask_offctx.drawImage(img, 0, 0);
      const { data } = clipmask_offctx.getImageData(0, 0, w, h);
      return this.fromBuffer(data, rect);
    }).catch(() => {
      throw new Error(`failed to load url:
	${src_url}`);
    });
  };
  fromDataURI = (data_uri, rect) => {
    return this.fromURL(data_uri, rect);
  };
  fromBuffer = async (buf, rect) => {
    rect.x ??= 0;
    rect.y ??= 0;
    this.rect = rect;
    clipmask_offcanvas.width = rect.width;
    clipmask_offcanvas.height = rect.height;
    clipmask_offctx.globalCompositeOperation = "copy";
    clipmask_offctx.putImageData(new ImageData(_ClipMask.turnTransparent(buf), rect.width, rect.height), 0, 0);
    this.data_blob = await clipmask_offcanvas.convertToBlob({ type: clipmask_data_format });
    if (isBase64Image(this.src_url))
      this.src_url = void 0;
    return;
  };
  clearDataBlob = () => this.data_blob = void 0;
  clipImage = async (img) => {
    if (this.data_blob === void 0)
      await this.fromURL(this.src_url, this.rect);
    return createImageBitmap(this.data_blob).then((mask_img_bitmap) => {
      clipmask_offcanvas.width = this.rect.width;
      clipmask_offcanvas.height = this.rect.height;
      clipmask_offctx.globalCompositeOperation = "copy";
      clipmask_offctx.drawImage(mask_img_bitmap, 0, 0);
      clipmask_offctx.globalCompositeOperation = "source-in";
      clipmask_offctx.drawImage(img, -this.rect.x, -this.rect.y);
      return clipmask_offcanvas;
    });
  };
};
var ClipMask = _ClipMask;
__publicField(ClipMask, "turnTransparent", (buf) => {
  for (let i = 0, len = buf.length * 4; i < len; i += 4)
    if (buf[i] + buf[i + 1] + buf[i + 2] === 0)
      buf[i + 3] = 0;
  return new Uint8ClampedArray(buf.buffer);
});
var default_id_numbering_func = (r, g, b, a) => a === 0 ? 0 : (255 - a) / 100 + b * 2 ** 0 + g * 2 ** 8 + r * 2 ** 16;
var _JAtlasManager = class {
  source;
  entries = {};
  imgloaded;
  img;
  constructor(src_url) {
    if (src_url)
      this.loadImage(src_url);
  }
  loadImage = (src_url) => {
    this.source = src_url;
    this.img = new Image();
    this.img.src = src_url;
    this.imgloaded = this.img.decode().then(() => this.img).catch(() => {
      throw new Error(`failed to load url:
	${src_url}`);
    });
    return this.imgloaded;
  };
  addEntry = (entry, id) => {
    if (typeof entry === "string")
      entry = JSON.parse(entry);
    const { x, y, width, height, kind, data } = entry, mask = new ClipMask(kind + data, { x, y, width, height });
    this.entries[id ?? Date.now() % 1e9] = mask;
  };
  addEntries = (entries) => {
    for (const [id, entry] of Object.entries(entries))
      this.addEntry(entry, parseInt(id));
  };
  getEntryImage = async (id) => {
    await this.imgloaded;
    return this.entries[id].clipImage(this.img);
  };
  toObject = async () => {
    const new_jatlas_object = {
      source: this.source.toString(),
      entries: {}
    };
    for (const [id, clipmask] of Object.entries(this.entries)) {
      let kind, data;
      if (clipmask.data_blob) {
        kind = "data:" + clipmask.data_blob.type + ";base64,";
        data = await blobToBase64(clipmask.data_blob);
      } else if (isBase64Image(clipmask.src_url)) {
        kind = getBase64ImageHeader(clipmask.src_url);
        data = getBase64ImageBody(clipmask.src_url);
      } else {
        kind = "path";
        data = clipmask.src_url;
      }
      new_jatlas_object.entries[parseFloat(id)] = { ...clipmask.rect, kind, data };
    }
    return new_jatlas_object;
  };
  toJSON = async () => JSON.stringify(await this.toObject());
};
var JAtlasManager = _JAtlasManager;
__publicField(JAtlasManager, "fromObject", (jatlas_object) => {
  const new_atlas_manager = new _JAtlasManager(jatlas_object.source);
  new_atlas_manager.addEntries(jatlas_object.entries);
  return new_atlas_manager;
});
__publicField(JAtlasManager, "fromJSON", (atlas_json_text) => _JAtlasManager.fromObject(JSON.parse(atlas_json_text)));
__publicField(JAtlasManager, "fromURL", (json_url) => fetch(json_url).then(async (response) => _JAtlasManager.fromJSON(await response.text())));
__publicField(JAtlasManager, "fromJAtlasImage", (img, img_src_url, id_numbering_func, onload_callback) => {
  return _JAtlasManager.fromJAtlasImageData(constructImageData(img), img_src_url, id_numbering_func, onload_callback);
});
__publicField(JAtlasManager, "fromJAtlasImageData", (img_data, img_src_url, id_numbering_func, onload_callback) => {
  id_numbering_func ??= default_id_numbering_func;
  const { width, height, data } = img_data, channels = data.length / (width * height), id_pixel_intervals = {};
  console.assert(Number.isInteger(channels));
  let [prev_id, id] = [0, 0];
  for (let px = 0, len = data.length; px < len; px += channels) {
    id = id_numbering_func(data[px + 0], data[px + 1], data[px + 2], data[px + 3]);
    if (id !== prev_id) {
      id_pixel_intervals[id] ??= [];
      if (id > 0)
        id_pixel_intervals[id].push(px);
      if (prev_id > 0)
        id_pixel_intervals[prev_id].push(px);
    }
    prev_id = id;
  }
  id_pixel_intervals[prev_id]?.push(data.length);
  delete id_pixel_intervals[0];
  const new_atlas_manager = new _JAtlasManager(img_src_url), mask_from_buffer_promises = [];
  for (const [id2, intervals] of Object.entries(id_pixel_intervals)) {
    let [min_x, min_y, max_x, max_y] = [width, height, 0, 0];
    for (let i = 0, len = intervals.length; i < len; i += 2) {
      const start_px = intervals[i] / channels, x2 = start_px % width, y2 = start_px / width | 0;
      if (x2 < min_x)
        min_x = x2;
      if (y2 < min_y)
        min_y = y2;
    }
    for (let i = 1, len = intervals.length; i < len; i += 2) {
      const end_px = intervals[i] / channels, x2 = end_px % width, y2 = end_px / width | 0;
      if (x2 > max_x)
        max_x = x2;
      if (y2 > max_y)
        max_y = y2;
    }
    max_x++;
    max_y++;
    const mask = new ClipMask(), [x, y, w, h] = [min_x, min_y, max_x - min_x, max_y - min_y], mask_intervals = intervals.map((px) => 4 * (px / channels % width - x + ((px / (channels * width) | 0) - y) * w)), rgba_buf = new Uint8Array(w * h * 4).fill(0);
    for (const sub_arr of sliceIntervalsTypedSubarray(rgba_buf, mask_intervals))
      sub_arr.fill(255);
    mask_from_buffer_promises.push(mask.fromBuffer(rgba_buf, { x, y, width: w, height: h }));
    new_atlas_manager.entries[parseFloat(id2)] = mask;
  }
  if (onload_callback)
    Promise.all(mask_from_buffer_promises).then(() => onload_callback(new_atlas_manager));
  return new_atlas_manager;
});
var ClippedImage = class {
  jatlas_manager;
  entry_id;
  constructor(jatlas_manager, entry_id) {
    this.jatlas_manager = jatlas_manager;
    this.entry_id = entry_id;
  }
  getImage = () => this.jatlas_manager.getEntryImage(this.entry_id);
  getRect = () => this.jatlas_manager.entries[this.entry_id].rect;
};
var HorizontalImageScroller = class {
  canvas;
  ctx;
  entries = [];
  left = 0;
  right = 0;
  constructor(append_to, width = 300, height = 200) {
    this.canvas = document.createElement("canvas");
    this.ctx = this.canvas.getContext("2d");
    this.canvas.width = width;
    this.canvas.height = height;
    this.ctx.translate(width / 2 | 0, 0);
    if (DEBUG) {
      this.ctx.lineWidth = 5;
      this.ctx.moveTo(0, 0);
      this.ctx.lineTo(0, height);
      this.ctx.stroke();
      this.ctx.scale(0.25, 0.25);
    }
    if (append_to)
      this.appendTo(append_to);
  }
  appendTo = (element) => element.appendChild(this.canvas);
  addEntryLeft = async (entry) => {
    this.entries.unshift(entry);
    const width = entry instanceof ClippedImage ? entry.getRect().width : entry.width;
    this.left -= width;
    const x = this.left, img = entry instanceof ClippedImage ? await entry.getImage() : entry;
    this.ctx.drawImage(img, x, 0);
  };
  addEntryRight = async (entry) => {
    this.entries.push(entry);
    const width = entry instanceof ClippedImage ? entry.getRect().width : entry.width, x = this.right;
    this.right += width;
    const img = entry instanceof ClippedImage ? await entry.getImage() : entry;
    this.ctx.drawImage(img, x, 0);
  };
};
export {
  ClipMask,
  ClippedImage,
  HorizontalImageScroller,
  JAtlasManager
};
