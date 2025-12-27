import { api } from "/scripts/api.js";

export const IO_SETTINGS = {
  cacheBustParam: "_akb",
  stateFilename: "ak_base_state.json",
};


export function buildTempViewUrl(filename) {
  const fn = encodeURIComponent(filename ?? "");
  const base = `/view?filename=${fn}&type=temp&subfolder=&${IO_SETTINGS.cacheBustParam}=${Date.now()}`;
  return api.apiURL(base);
}

export async function fetchTempJson(filename) {
  const url = buildTempViewUrl(filename);
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const txt = await res.text();
  return JSON.parse(txt);
}

export async function loadImageFromUrl(url) {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = url;
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
  });
  return img;
}

export async function loadGalleryByCount(prefix, count) {
  const images = [];
  const urls = [];
  for (let i = 0; i < count; i++) {
    const filename = `${prefix}${i}.png`;
    const url = buildTempViewUrl(filename);
    const img = await loadImageFromUrl(url);
    images.push(img);
    urls.push(url);
  }
  return { images, urls };
}


export async function readPngTextChunks(url) {
  const res = await fetch(url, { cache: "no-store" });
  const buf = await res.arrayBuffer();
  const bytes = new Uint8Array(buf);
  if (bytes.length < 8) return [];

  let off = 8;
  const out = [];

  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const dec = new TextDecoder();

  while (off + 12 <= bytes.length) {
    const len = dv.getUint32(off, false); off += 4;
    const type = dec.decode(bytes.slice(off, off + 4)); off += 4;

    if (off + len + 4 > bytes.length) break;

    const data = bytes.slice(off, off + len); off += len;
    off += 4; // crc

    if (type === "tEXt") {
      const i0 = data.indexOf(0);
      if (i0 > 0) {
        const key = dec.decode(data.slice(0, i0));
        const val = dec.decode(data.slice(i0 + 1));
        out.push({ type, key, val });
      }
    } else if (type === "iTXt") {
      const i0 = data.indexOf(0);
      if (i0 > 0) {
        const key = dec.decode(data.slice(0, i0));
        let p = i0 + 1;
        if (p + 2 <= data.length) {
          const compressionFlag = data[p]; p += 1;
          p += 1; // compressionMethod

          const z1 = data.indexOf(0, p);
          if (z1 < 0) { out.push({ type, key, val: "" }); continue; }
          p = z1 + 1;

          const z2 = data.indexOf(0, p);
          if (z2 < 0) { out.push({ type, key, val: "" }); continue; }
          p = z2 + 1;

          const z3 = data.indexOf(0, p);
          if (z3 < 0) { out.push({ type, key, val: "" }); continue; }
          p = z3 + 1;

          let val = "";
          if (compressionFlag === 0) {
            val = dec.decode(data.slice(p));
          }
          out.push({ type, key, val });
        }
      }
    }

    if (type === "IEND") break;
  }

  return out;
}
