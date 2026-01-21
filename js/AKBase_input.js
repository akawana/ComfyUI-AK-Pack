import { app } from "/scripts/app.js";
import { previewRect, backButtonRect, copyButtonRect, pipButtonRect } from "./AKBase_ui.js";
import { fetchTempJson, buildTempViewUrl, loadImageFromUrl } from "./AKBase_io.js";

export function installInputHandlers(node) {
  const state = node._akBase;
  if (!state) return;

async function copyTopLayerImageToClipboard() {
  try {
    const enabled = (state.mode === "compare");
    console.log("[AKBase] copyTopLayerImageToClipboard", { enabled, mode: state.mode });
    if (!enabled) return false;

    const img = state?.b?.img || null;
    const url = state?.b?.url || (img?.src || null);

    if (!navigator?.clipboard?.write || typeof window.ClipboardItem !== "function") {
      console.log("[AKBase] copy failed: ClipboardItem API not available");
      return false;
    }

    let blob = null;

    if (url) {
      try {
        const res = await fetch(url, { cache: "no-store" });
        console.log("[AKBase] copy fetch", { ok: res.ok, status: res.status, url });
        if (res.ok) blob = await res.blob();
      } catch (e) {
        console.log("[AKBase] copy fetch error", e);
      }
    }

    if (!blob && img) {
      const w = Math.max(1, Number(img.naturalWidth || img.width || 0) || 1);
      const h = Math.max(1, Number(img.naturalHeight || img.height || 0) || 1);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        console.log("[AKBase] copy failed: no canvas context");
        return false;
      }
      try { ctx.drawImage(img, 0, 0, w, h); } catch (e) { console.log("[AKBase] copy drawImage error", e); }
      blob = await new Promise((resolve) => {
        try { canvas.toBlob(resolve, "image/png"); } catch (_) { resolve(null); }
      });
    }

    if (!blob) {
      console.log("[AKBase] copy failed: no blob");
      return false;
    }

    const mime = (blob.type && String(blob.type).startsWith("image/")) ? blob.type : "image/png";
    await navigator.clipboard.write([new ClipboardItem({ [mime]: blob })]);
    console.log("[AKBase] compare image copied to clipboard", { mime, size: blob.size });
    return true;
  } catch (e) {
    console.log("[AKBase] copyTopLayerImageToClipboard exception", e);
    return false;
  }
}

async function copyGalleryToClipboard() {
  try {
    const enabled = (state.mode === "gallery");
    console.log("[AKBase] copyGalleryToClipboard", { enabled, mode: state.mode });
    if (!enabled) return false;

    const imgs = state?.gallery?.images ?? [];
    const N = imgs.length;
    if (!N) return false;

    if (!navigator?.clipboard?.write || typeof window.ClipboardItem !== "function") {
      console.log("[AKBase] copy failed: ClipboardItem API not available");
      return false;
    }

    let cellW = 0;
    let cellH = 0;
    for (const im of imgs) {
      const w = Number(im?.naturalWidth || im?.width || 0) || 0;
      const h = Number(im?.naturalHeight || im?.height || 0) || 0;
      if (w > cellW) cellW = w;
      if (h > cellH) cellH = h;
    }
    if (cellW <= 0 || cellH <= 0) return false;

    const cols = Math.max(1, Math.ceil(Math.sqrt(N)));
    const rows = Math.max(1, Math.ceil(N / cols));
    const gap = 0;

    let outW = cols * cellW + gap * (cols - 1);
    let outH = rows * cellH + gap * (rows - 1);

    const MAX_SIDE = 8192;
    const MAX_PIXELS = 64 * 1024 * 1024;
    let scale = 1;

    if (outW > MAX_SIDE || outH > MAX_SIDE) {
      scale = Math.min(scale, MAX_SIDE / outW, MAX_SIDE / outH);
    }
    if ((outW * outH) > MAX_PIXELS) {
      scale = Math.min(scale, Math.sqrt(MAX_PIXELS / (outW * outH)));
    }

    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.floor(outW * scale));
    canvas.height = Math.max(1, Math.floor(outH * scale));

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      console.log("[AKBase] copy failed: no canvas context");
      return false;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const drawCellW = cellW * scale;
    const drawCellH = cellH * scale;

    for (let i = 0; i < N; i++) {
      const im = imgs[i];
      if (!im) continue;

      const w = Number(im?.naturalWidth || im?.width || 0) || 1;
      const h = Number(im?.naturalHeight || im?.height || 0) || 1;

      const col = i % cols;
      const row = Math.floor(i / cols);

      const x0 = col * drawCellW;
      const y0 = row * drawCellH;

      const s = Math.min(drawCellW / w, drawCellH / h);
      const dw = w * s;
      const dh = h * s;

      const dx = x0 + (drawCellW - dw) * 0.5;
      const dy = y0 + (drawCellH - dh) * 0.5;

      try {
        ctx.drawImage(im, dx, dy, dw, dh);
      } catch (e) {
        console.log("[AKBase] copy gallery drawImage error", e);
      }
    }

    const blob = await new Promise((resolve) => {
      try { canvas.toBlob(resolve, "image/png"); } catch (_) { resolve(null); }
    });

    if (!blob) {
      console.log("[AKBase] copy failed: no blob");
      return false;
    }

    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    console.log("[AKBase] gallery copied to clipboard", { w: canvas.width, h: canvas.height, images: N });
    return true;
  } catch (e) {
    console.log("[AKBase] copyGalleryToClipboard exception", e);
    return false;
  }
}

async function copyCurrentViewToClipboard() {
  if (state.mode === "compare") {
    return await copyTopLayerImageToClipboard();
  }
  if (state.mode === "gallery") {
    return await copyGalleryToClipboard();
  }
  return false;
}



  async function setConnectedNodeValue(seedIn) {
    try {
      console.log("[AKBase] setConnectedNodeValue called with seed:", seedIn);

      const nid = node?.id;
      console.log("[AKBase] current node id:", nid);
      if (nid === undefined || nid === null) {
        console.log("[AKBase] node id is missing");
        return;
      }

      const fn = `ak_settings_${nid}.json`;
      console.log("[AKBase] loading settings json:", fn);
      let cfg = null;
      try {cfg = await fetchTempJson(fn);} catch (e) {
        console.log("[AKBase] settings json not found (skip):", fn);
        return;
      }
      console.log("[AKBase] loaded settings json:", cfg);

      const fromId = cfg?.from_id;
      console.log("[AKBase] from_id:", fromId);
      if (fromId === undefined || fromId === null) {
        console.log("[AKBase] from_id not found in json");
        return;
      }

      const targetId = Number(fromId);
      if (!Number.isFinite(targetId)) {
        console.log("[AKBase] from_id is not a valid number:", fromId);
        return;
      }

      const targetNode = app?.graph?.getNodeById?.(targetId);
      console.log("[AKBase] target node:", targetNode);
      if (!targetNode) {
        console.log("[AKBase] target node not found in graph");
        return;
      }

      const w = targetNode.widgets?.find(w => w?.name === "seed");
      console.log("[AKBase] target seed widget:", w);
      if (!w) {
        console.log("[AKBase] seed widget not found on target node");
        return;
      }

      w.value = Number(seedIn);
      console.log("[AKBase] seed widget value set to:", w.value);

      try {
        targetNode.onWidgetChanged?.(w.name, w.value, w);
        console.log("[AKBase] onWidgetChanged called");
      } catch (e) {
        console.log("[AKBase] onWidgetChanged error:", e);
      }

      const w2 = targetNode.widgets?.find(w => w?.name === "xy_variations");
      if (w2) {
        w2.value = 1;
        try { targetNode.onWidgetChanged?.(w2.name, w2.value, w2); } catch (_) { }
      }


      // try {
      //   targetNode.setDirtyCanvas?.(true, true);
      // } catch (_) { }

      console.log("[AKBase] canvas marked dirty, done");
    } catch (e) {
      console.log("[AKBase] setConnectedNodeValue exception:", e);
    }
  }

  async function getPropertiesFromImage(imageNumber) {
    console.log("[AKBase] getPropertiesFromImage", { imageNumber });
    try {
      const idx = Number(imageNumber);

      let seedVal = null;

      try {
        const nid = node?.id;
        if (nid !== undefined && nid !== null) {
          const cfgFn = `ak_base_xz_config_${nid}.json`;
          const cfg = await fetchTempJson(cfgFn);
          const images = cfg?.image;
          if (Array.isArray(images)) {
            const it = images[idx];
            if (it && typeof it === "object") {
              const xName = String(it?.x_parameter_name_0 ?? "").toLowerCase();
              const zName = String(it?.z_parameter_name_0 ?? "").toLowerCase();

              const isSeed = (xName === "seed") || (zName === "seed");
              if (isSeed) {
                const sv = (xName === "seed") ? it?.x_parameter_value_0 : it?.z_parameter_value_0;
                if (sv !== undefined && sv !== null) {
                  seedVal = sv;
                }
              }
            }
          }
        }
      } catch (e) {
        console.log("[AKBase] getPropertiesFromImage: xz_config read failed (ignored)", e);
      }

      if (seedVal !== null && seedVal !== undefined) {
        console.log("[AKBase] seed extracted from xz_config:", seedVal);
        await setConnectedNodeValue(seedVal);
      }

      return true;
    } catch (e) {
      console.log("[AKBase] getPropertiesFromImage exception (non-fatal):", e);
      return true;
    }
  }

async function setPreviewImage(imageNumber) {
    const g = state.gallery;
    const imgs = g?.images ?? [];
    const idx = Number(imageNumber);

    if (!imgs.length) return;

    const bImg = (idx >= 0 && idx < imgs.length) ? imgs[idx] : null;
    if (!bImg) return;

    const nid = node?.id;
    if (nid === undefined || nid === null) return;

    const aFn = `ak_base_image_a_${nid}.png`;
    const aUrl = buildTempViewUrl(aFn);

    let aImg = null;
    try {
      aImg = await loadImageFromUrl(aUrl);
    } catch (_) {
      return;
    }

    state.mode = "compare";

    state.a.img = aImg;
    state.a.loaded = true;
    state.a.url = null;

    state.b.img = bImg;
    state.b.loaded = true;
    state.b.url = null;

    state.gallery.images = [];
    state.gallery.urls = [];
    state.gallery.hoverIndex = -1;

    state.inPreview = true;
    state.hover = true;
    state.cursorX = 0.5;

    node?._akBase?.updateBackBtn?.();
    // app.graph.setDirtyCanvas(true, true);
  }

  async function copyCompareImageToClipboard() {
    try {
      const enabled = (state.mode === "compare");
      if (!enabled) return false;

      const hasReady = !!state?.a?.loaded || !!state?.b?.loaded;
      if (!hasReady) return false;

      const url =
        state?.b?.url || state?.b?.img?.src ||
        state?.a?.url || state?.a?.img?.src ||
        null;

      if (!url) return false;

      if (!navigator?.clipboard || typeof navigator.clipboard.write !== "function" || typeof window.ClipboardItem !== "function") {
        console.log("[AKBase] clipboard image write is not supported");
        return false;
      }

      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        console.log("[AKBase] copy fetch failed", res.status);
        return false;
      }

      const blob = await res.blob();
      const mime = blob?.type || "image/png";

      await navigator.clipboard.write([
        new ClipboardItem({ [mime]: blob })
      ]);

      console.log("[AKBase] image copied to clipboard");
      return true;
    } catch (e) {
      console.log("[AKBase] copyCompareImageToClipboard exception:", e);
      return false;
    }
  }

  node.onMouseMove = function (e, pos) {
    let localX = pos[0];
    let localY = pos[1];
    if (localX > this.size[0] || localY > this.size[1] || localX < 0 || localY < 0) {
      localX = pos[0] - this.pos[0];
      localY = pos[1] - this.pos[1];
    }

    const r = previewRect(this);
    const inside = localX >= r.x && localX <= r.x + r.w && localY >= r.y && localY <= r.y + r.h;

    state.inPreview = inside;
    state.hover = inside;

    if (!inside) {
      if (state.mode === "gallery") state.gallery.hoverIndex = -1;
      return;
    }

    if (state.mode === "gallery") {
      const g = state.gallery;
      const grid = g?.grid;
      const N = g?.images?.length ?? 0;
      if (!grid || !N) return;

      const x = localX - r.x;
      const y = localY - r.y;

      const col = Math.floor(x / grid.cellW);
      const row = Math.floor(y / grid.cellH);
      const idx = row * grid.cols + col;

      g.hoverIndex = (idx >= 0 && idx < N) ? idx : -1;
      // app.graph.setDirtyCanvas(true, true);
      return;
    }

    if (r.w > 0) {
      state.cursorX = Math.min(1, Math.max(0, (localX - r.x) / r.w));
      // app.graph.setDirtyCanvas(true, true);
    }
  };


  node.onMouseDown = function (e, pos) {
    console.log("[AKBase] onMouseDown", { mode: state.mode, pos });

    let localX = pos[0];
    let localY = pos[1];
    if (localX > this.size[0] || localY > this.size[1] || localX < 0 || localY < 0) {
      localX = pos[0] - this.pos[0];
      localY = pos[1] - this.pos[1];
    }

    const btn = backButtonRect(this);
    const insideBtn = localX >= btn.x && localX <= btn.x + btn.w && localY >= btn.y && localY <= btn.y + btn.h;
    if (insideBtn) {
      const enabled = (state.mode === "compare") && !!state.hasGallery;
      console.log("[AKBase] back button click", { enabled });
      if (enabled) {
        (async () => { await state.backToGallery?.(); })();
      }
      return true;
    }

    const copyBtn = copyButtonRect(this);
    const insideCopyBtn = localX >= copyBtn.x && localX <= copyBtn.x + copyBtn.w && localY >= copyBtn.y && localY <= copyBtn.y + copyBtn.h;
    if (insideCopyBtn) {
      const enabled = (state.mode === "compare") || (state.mode === "gallery");
      console.log("[AKBase] copy button click", { enabled, mode: state.mode });
      if (enabled) {
        (async () => { await copyCurrentViewToClipboard(); })();
      }
      return true;
    }

    const pipBtn = pipButtonRect(this);
    const insidePipBtn = localX >= pipBtn.x && localX <= pipBtn.x + pipBtn.w && localY >= pipBtn.y && localY <= pipBtn.y + pipBtn.h;
    if (insidePipBtn) {
      console.log("[AKBase] Open PIP button click");
      try {
        const nid = node?.id;
        if (window.AKBasePip && typeof window.AKBasePip.openForNode === "function") {
          window.AKBasePip.openForNode(nid);
        }
      } catch (e) {
        console.log("[AKBase] Open PIP error", e);
      }
      return true;
    }

    if (state.mode !== "gallery") return false;

    const r = previewRect(this);
    const inside = localX >= r.x && localX <= r.x + r.w && localY >= r.y && localY <= r.y + r.h;
    console.log("[AKBase] click inside preview:", inside);

    if (!inside) return false;

    const g = state.gallery;
    const grid = g?.grid;
    const N = g?.images?.length ?? 0;

    if (!grid || !N) {
      console.log("[AKBase] gallery grid/images missing", { hasGrid: !!grid, N });
      return false;
    }

    const x = localX - r.x;
    const y = localY - r.y;

    const col = Math.floor(x / grid.cellW);
    const row = Math.floor(y / grid.cellH);
    const idx = row * grid.cols + col;

    console.log("[AKBase] computed gallery index:", idx, { row, col, cols: grid.cols, cellW: grid.cellW, cellH: grid.cellH, N });

    if (!(idx >= 0 && idx < N)) return false;

    g.hoverIndex = idx;

    (async () => {
      const ok = await getPropertiesFromImage(idx);
      console.log("[AKBase] getPropertiesFromImage result:", ok);
      if (ok) await setPreviewImage(idx);
    })();

    return true;
  };

  node.onMouseLeave = function () {
    state.hover = false;
    state.inPreview = false;
    if (state.mode === "gallery") state.gallery.hoverIndex = -1;
    // app.graph.setDirtyCanvas(true, true);
  };
}