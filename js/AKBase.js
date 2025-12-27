import { app } from "/scripts/app.js";
import { api } from "/scripts/api.js";

import { buildTempViewUrl, loadImageFromUrl, loadGalleryByCount, fetchTempJson, IO_SETTINGS } from "./AKBase_io.js";
import { installInputHandlers } from "./AKBase_input.js";
import { applyNodeLayout, installDraw } from "./AKBase_ui.js";

const AKBASE_VERSION = "v11-statefile";

window.AKBASE_DEBUG ??= true;
const DBG = (...a) => { if (window.AKBASE_DEBUG) console.log(`[AKBase ${AKBASE_VERSION}]`, ...a); };

async function loadCompare(node, stateJson) {
  const state = node._akBase;
  const token = ++state.loadingToken;

  const nid = node?.id;
  const suffix = (nid !== undefined && nid !== null) ? `_${nid}` : "";

  const aFn = stateJson?.a?.filename ?? `ak_base_image_a${suffix}.png`;
  const bFn = stateJson?.b?.filename ?? `ak_base_image_b${suffix}.png`;

  const aUrl = buildTempViewUrl(aFn);
  const bUrl = buildTempViewUrl(bFn);

  state.a.loaded = false;
  state.b.loaded = false;
  state.a.url = aUrl;
  state.b.url = bUrl;

  DBG("compare loading", { aUrl, bUrl });

  const [aImg, bImg] = await Promise.all([loadImageFromUrl(aUrl), loadImageFromUrl(bUrl)]);
  if (state.loadingToken !== token) return;

  state.mode = "compare";
  state.hasGallery = false;
  state.galleryMeta = null;
  state.gallery.images = [];
  state.gallery.urls = [];
  state.gallery.hoverIndex = -1;

  state.a.img = aImg;
  state.b.img = bImg;
  state.a.loaded = true;
  state.b.loaded = true;

  DBG("compare loaded", { a: [aImg.naturalWidth, aImg.naturalHeight], b: [bImg.naturalWidth, bImg.naturalHeight] });
  app.graph.setDirtyCanvas(true, true);
}

async function loadGallery(node, stateJson) {
  const state = node._akBase;
  const token = ++state.loadingToken;

  const count = Math.max(0, Math.min(4096, Number(stateJson?.count ?? 0)));
  const nid = node?.id;
  const prefix = String(stateJson?.gallery_prefix ?? ((nid !== undefined && nid !== null) ? `ak_base_image_xy_${nid}_` : "ak_base_image_xy_"));

  DBG("gallery loading", { count, prefix });

  const { images, urls } = await loadGalleryByCount(prefix, count);
  if (state.loadingToken !== token) return;

  state.mode = "gallery";
  state.hasGallery = true;
  state.galleryMeta = { count, prefix };
  state.a.loaded = false;
  state.b.loaded = false;

  state.gallery.images = images;
  state.gallery.urls = urls;
  state.gallery.hoverIndex = -1;

  DBG("gallery loaded", { count: images.length });
  app.graph.setDirtyCanvas(true, true);
}

async function loadFromStateFile(node) {
  let s = null;
  try {
    const nid = node?.id;
    const stateFn = (nid !== undefined && nid !== null) ? `ak_base_state_${nid}.json` : IO_SETTINGS.stateFilename;
    s = await fetchTempJson(stateFn);
    DBG("state json", s);
  } catch (e) {
    DBG("state json missing", e);
    return;
  }

  if (s?.mode === "gallery") {
    await loadGallery(node, s);
  } else {
    await loadCompare(node, s);
  }
}

function installOnNode(node) {
  if (node._akBaseInstalled) return;
  node._akBaseInstalled = true;

  node._akBase = {
    mode: "compare",
    a: { img: null, url: null, loaded: false },
    b: { img: null, url: null, loaded: false },
    hover: false,
    inPreview: false,
    cursorX: 0.5,
    loadingToken: 0,
    _drawLogged: false,
    hasGallery: false,
    galleryMeta: null,
    gallery: {
      images: [],
      urls: [],
      hoverIndex: -1,
      grid: null,
    },
  };

  const state = node._akBase;


  applyNodeLayout(node);


  state.backToGallery = async () => {
    try {
      if (!state.hasGallery) return false;
      if (state.mode === "gallery") return false;

      const meta = state.galleryMeta;
      if (!meta || !meta.prefix || !meta.count) return false;

      const token = ++state.loadingToken;
      const { images, urls } = await loadGalleryByCount(String(meta.prefix), Number(meta.count));
      if (state.loadingToken !== token) return false;

      state.mode = "gallery";
      state.a.loaded = false;
      state.b.loaded = false;

      state.gallery.images = images;
      state.gallery.urls = urls;
      state.gallery.hoverIndex = -1;

      // app.graph.setDirtyCanvas(true, true);
      return true;
    } catch (_) {
      return false;
    }
  };

  const origOnResize = node.onResize;
  node.onResize = function (size) {
    const r = origOnResize?.call(this, size);
    applyNodeLayout(this);
    // app.graph.setDirtyCanvas(true, true);
    return r;
  };

  installInputHandlers(node);
  installDraw(node, DBG);
}


app.registerExtension({
  name: "AKBase",
  async beforeRegisterNodeDef(nodeType, nodeData) {
    if (nodeData?.name !== "AK Base") return;

    const onCreated = nodeType.prototype.onNodeCreated;
    nodeType.prototype.onNodeCreated = function () {
      const r = onCreated?.apply(this, arguments);
      installOnNode(this);
      return r;
    };
  },
});

api.addEventListener("executed", async (e) => {
  const detail = e?.detail;
  const nodeId = detail?.node;
  if (!nodeId) return;

  const node = app.graph.getNodeById(nodeId);
  if (!node) return;
  if (node.comfyClass !== "AK Base") return;

  installOnNode(node);

  try {
    await loadFromStateFile(node);
  } catch (err) {
    DBG("load error", err);
    // app.graph.setDirtyCanvas(true, true);
  }
});
