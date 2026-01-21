export const UI_SETTINGS = {
  backButtonYShift: 0,
  buttonToolbarWidthPercent: 50,
  previewPadding: 10,
  previewYShift: 80,
  previewMinWidth: 240,
  previewMinHeight: 180,

  imageFitMode: "contain",
  previewBgAlpha: 0.08,
  overlayAlpha: 1.0,

  wipeMode: true,
  lineAlpha: 0.7,
  lineWidth: 1,

  galleryBorderWidth: 2,
  galleryBorderAlpha: 0.85,
  galleryBorderColor: "rgba(255,120,0,1.0)",

  galleryGap: 4,
};

const EXT_BASE_URL = "/extensions/ComfyUI-AK-Pack/";

const BUTTON_ROW_HEIGHT = 28;
const BUTTON_ROW_GAP = 4;
const BUTTON_ICON_SIZE = 20;

function createIcon(src) {
  const img = new Image();
  img.src = EXT_BASE_URL + src;
  return img;
}

const AKBASE_ICONS = {
  back: createIcon("img/i_gallery.png"),
  copy: createIcon("img/i_copy.png"),
  pip: createIcon("img/i_pip_in.png"),
};

function drawIconButton(ctx, rect, img, enabled) {
  const alpha = enabled ? 1.0 : 0.45;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "#2a2a2a";
  ctx.strokeStyle = "#555";
  ctx.lineWidth = 1;

  const rr = 6;
  const x0 = rect.x, y0 = rect.y, x1 = rect.x + rect.w, y1 = rect.y + rect.h;
  ctx.beginPath();
  ctx.moveTo(x0 + rr, y0);
  ctx.lineTo(x1 - rr, y0);
  ctx.quadraticCurveTo(x1, y0, x1, y0 + rr);
  ctx.lineTo(x1, y1 - rr);
  ctx.quadraticCurveTo(x1, y1, x1 - rr, y1);
  ctx.lineTo(x0 + rr, y1);
  ctx.quadraticCurveTo(x0, y1, x0, y1 - rr);
  ctx.lineTo(x0, y0 + rr);
  ctx.quadraticCurveTo(x0, y0, x0 + rr, y0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  if (img && img.complete && img.naturalWidth && img.naturalHeight) {
    const size = Math.min(BUTTON_ICON_SIZE, rect.w - 6, rect.h - 6);
    const ix = rect.x + (rect.w - size) * 0.5;
    const iy = rect.y + (rect.h - size) * 0.5;
    ctx.drawImage(img, ix, iy, size, size);
  }

  ctx.restore();
}

export function applyNodeLayout(node) {
  const minW = UI_SETTINGS.previewPadding * 2 + UI_SETTINGS.previewMinWidth;

  const widgetCount = Array.isArray(node?.widgets) ? node.widgets.length : 0;
  const widgetH = widgetCount ? (widgetCount * 28 + 8) : 0;

  const minH = Math.max(260, UI_SETTINGS.previewPadding * 2 + UI_SETTINGS.previewMinHeight + widgetH);
  node.size[0] = Math.max(node.size[0], minW);
  node.size[1] = Math.max(node.size[1], minH);
}

export function previewRect(node) {
  const pad = UI_SETTINGS.previewPadding;
  const x = pad;
  const y = pad + UI_SETTINGS.previewYShift;

  const widgetCount = Array.isArray(node?.widgets) ? node.widgets.length : 0;
  const widgetH = widgetCount ? (widgetCount * 28 + 8) : 0;

  const w = Math.max(10, node.size[0] - x - pad);
  const h = Math.max(10, node.size[1] - y - pad - widgetH);
  return { x, y, w, h };
}

export function backButtonRect(node) {
  const pad = UI_SETTINGS.previewPadding;
  const availW = Math.max(10, node.size[0] - pad * 2);

  const pct = Math.max(
    1,
    Math.min(100, Number(UI_SETTINGS.buttonToolbarWidthPercent) || 100)
  );
  const toolbarW = availW * (pct / 100);

  const wSingle = Math.max(10, (toolbarW - 2 * BUTTON_ROW_GAP) / 3);
  const h = BUTTON_ROW_HEIGHT;

  const x = pad + (availW - toolbarW) * 0.5;
  const y = pad + Number(UI_SETTINGS.backButtonYShift || 0);

  return { x, y, w: wSingle, h };
}

export function copyButtonRect(node) {
  const b = backButtonRect(node);
  const x = b.x + b.w + BUTTON_ROW_GAP;
  const y = b.y;
  return { x, y, w: b.w, h: b.h };
}

export function pipButtonRect(node) {
  const c = copyButtonRect(node);
  const x = c.x + c.w + BUTTON_ROW_GAP;
  const y = c.y;
  return { x, y, w: c.w, h: c.h };
}



function fitRect(srcW, srcH, dstW, dstH, mode) {
  if (srcW <= 0 || srcH <= 0 || dstW <= 0 || dstH <= 0) return { x: 0, y: 0, w: 0, h: 0 };
  const s = (mode === "cover") ? Math.max(dstW / srcW, dstH / srcH) : Math.min(dstW / srcW, dstH / srcH);
  const w = srcW * s;
  const h = srcH * s;
  return { x: (dstW - w) * 0.5, y: (dstH - h) * 0.5, w, h };
}

function computeBestGrid(W, H, iw, ih, N, gap) {
  let best = { cols: 1, rows: N, scale: 0, cellW: W, cellH: H, drawW: iw, drawH: ih };
  if (N <= 0 || iw <= 0 || ih <= 0 || W <= 0 || H <= 0) return best;

  gap = Math.max(0, Number(gap ?? 0));

  for (let cols = 1; cols <= N; cols++) {
    const rows = Math.ceil(N / cols);

    const availW = Math.max(1, W - gap * (cols - 1));
    const availH = Math.max(1, H - gap * (rows - 1));

    const cellW = availW / cols;
    const cellH = availH / rows;

    const scale = Math.min(cellW / iw, cellH / ih);
    if (scale > best.scale) {
      best = {
        cols,
        rows,
        scale,
        cellW,
        cellH,
        drawW: iw * scale,
        drawH: ih * scale,
      };
    }
  }
  return best;
}



export function renderCompare(ctx, r, state, view) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(r.x, r.y, r.w, r.h);
  ctx.clip();

  ctx.fillStyle = `rgba(0,0,0,${UI_SETTINGS.previewBgAlpha})`;
  ctx.fillRect(r.x, r.y, r.w, r.h);

  const zoom = view && typeof view.zoom === "number" ? view.zoom : 1;
  const offsetX = view && typeof view.offsetX === "number" ? view.offsetX : 0;
  const offsetY = view && typeof view.offsetY === "number" ? view.offsetY : 0;
  const hasViewTransform = zoom !== 1 || offsetX !== 0 || offsetY !== 0;

  const drawImg = (img, alpha) => {
    if (!img) return;
    const fit = fitRect(img.naturalWidth, img.naturalHeight, r.w, r.h, UI_SETTINGS.imageFitMode);
    let dx = r.x + fit.x;
    let dy = r.y + fit.y;
    let dw = fit.w;
    let dh = fit.h;

    if (hasViewTransform) {
      dx = dx * zoom + offsetX;
      dy = dy * zoom + offsetY;
      dw = dw * zoom;
      dh = dh * zoom;
    }

    ctx.globalAlpha = alpha;
    ctx.drawImage(img, dx, dy, dw, dh);
  };


  const aReady = !!state?.a?.loaded;
  const bReady = !!state?.b?.loaded;

  if (!aReady && !bReady) {
    ctx.globalAlpha = 1.0;
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = "12px sans-serif";
    ctx.fillText("No preview images loaded", r.x + 10, r.y + 24);
    if (state?.a?.url) ctx.fillText("A: " + state.a.url, r.x + 10, r.y + 44);
    if (state?.b?.url) ctx.fillText("B: " + state.b.url, r.x + 10, r.y + 62);
  } else if (UI_SETTINGS.wipeMode && state?.inPreview && aReady && bReady) {
    drawImg(state.a.img, 1.0);

    const cx = r.x + r.w * (state.cursorX ?? 0.5);
    ctx.save();
    ctx.beginPath();
    ctx.rect(cx, r.y, r.x + r.w - cx, r.h);
    ctx.clip();
    drawImg(state.b.img, 1.0);
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = UI_SETTINGS.lineAlpha;
    ctx.strokeStyle = "rgba(255,255,255,1)";
    ctx.lineWidth = UI_SETTINGS.lineWidth;
    ctx.beginPath();
    ctx.moveTo(cx + 0.5, r.y);
    ctx.lineTo(cx + 0.5, r.y + r.h);
    ctx.stroke();
    ctx.restore();
  } else {
    if (aReady) drawImg(state.a.img, 1.0);
    if (bReady) drawImg(state.b.img, 1.0);
  }

  ctx.restore();
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.15)";
  ctx.lineWidth = 1;
  ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
  ctx.restore();
}

export function installDraw(node, dbg) {
  const state = node._akBase;
  if (!state) return;

  node.onDrawForeground = function (ctx) {
    const r = previewRect(this);

    const btn = backButtonRect(this);
    const btnEnabled = (state.mode === "compare") && !!state.hasGallery;

    const copyBtn = copyButtonRect(this);
    const copyBtnEnabled = ((state.mode === "compare") && (state.a.loaded || state.b.loaded)) || ((state.mode === "gallery") && ((state.gallery?.images?.length ?? 0) > 0));

    const pipBtn = pipButtonRect(this);
    const pipBtnEnabled = true;

    drawIconButton(ctx, btn, AKBASE_ICONS.back, btnEnabled);
    drawIconButton(ctx, copyBtn, AKBASE_ICONS.copy, copyBtnEnabled);
    drawIconButton(ctx, pipBtn, AKBASE_ICONS.pip, pipBtnEnabled);

    // if (!state._drawLogged) {
    //   state._drawLogged = true;
    //   dbg("first draw", this.id, { mode: state.mode });
    // }

    ctx.save();
    ctx.beginPath();
    ctx.rect(r.x, r.y, r.w, r.h);
    ctx.clip();

    ctx.fillStyle = `rgba(0,0,0,${UI_SETTINGS.previewBgAlpha})`;
    ctx.fillRect(r.x, r.y, r.w, r.h);

    if (state.mode === "gallery") {
      const imgs = state.gallery?.images ?? [];
      const N = imgs.length;

      if (!N) {
        ctx.globalAlpha = 1.0;
        ctx.fillStyle = UI_SETTINGS.galleryBorderColor;
        ctx.font = "12px sans-serif";
        ctx.fillText("Gallery: no images loaded", r.x + 10, r.y + 24);
        ctx.restore();
        return;
      }

      const iw = imgs[0].naturalWidth || 1;
      const ih = imgs[0].naturalHeight || 1;

      const gap = UI_SETTINGS.galleryGap ?? 0;
      const grid = computeBestGrid(r.w, r.h, iw, ih, N, gap);
      state.gallery.grid = grid;

      for (let i = 0; i < N; i++) {
        const col = i % grid.cols;
        const row = Math.floor(i / grid.cols);

        const cellX = r.x + col * (grid.cellW + gap);
        const cellY = r.y + row * (grid.cellH + gap);

        const x = cellX + (grid.cellW - grid.drawW) * 0.5;
        const y = cellY + (grid.cellH - grid.drawH) * 0.5;

        ctx.globalAlpha = 1.0;
        ctx.drawImage(imgs[i], x, y, grid.drawW, grid.drawH);

        if (state.gallery.hoverIndex === i && state.inPreview) {
          ctx.save();
          ctx.globalAlpha = UI_SETTINGS.galleryBorderAlpha;
          ctx.strokeStyle = UI_SETTINGS.galleryBorderColor;
          ctx.lineWidth = UI_SETTINGS.galleryBorderWidth;
          ctx.strokeRect(x + 0.5, y + 0.5, grid.drawW - 1, grid.drawH - 1);
          ctx.restore();
        }
      }

      ctx.restore();
      ctx.save();
      ctx.strokeStyle = "rgba(255,255,255,0.15)";
      ctx.lineWidth = 1;
      ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
      ctx.restore();
      return;
    }

    const drawImg = (img, alpha) => {
      if (!img) return;
      const fit = fitRect(img.naturalWidth, img.naturalHeight, r.w, r.h, UI_SETTINGS.imageFitMode);
      ctx.globalAlpha = alpha;
      ctx.drawImage(img, r.x + fit.x, r.y + fit.y, fit.w, fit.h);
    };

    const aReady = !!state.a.loaded;
    const bReady = !!state.b.loaded;

    if (!aReady && !bReady) {
      ctx.globalAlpha = 1.0;
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.font = "12px sans-serif";
      ctx.fillText("No preview images loaded", r.x + 10, r.y + 24);
      if (state.a.url) ctx.fillText("A: " + state.a.url, r.x + 10, r.y + 44);
      if (state.b.url) ctx.fillText("B: " + state.b.url, r.x + 10, r.y + 62);
    } else if (UI_SETTINGS.wipeMode && state.inPreview && aReady && bReady) {
      drawImg(state.a.img, 1.0);

      const cx = r.x + r.w * (state.cursorX ?? 0.5);
      ctx.save();
      ctx.beginPath();
      // ctx.rect(r.x, r.y, Math.max(0, cx - r.x), r.h);
      ctx.rect(cx, r.y, r.x + r.w - cx, r.h);

      ctx.clip();
      drawImg(state.b.img, 1.0);
      ctx.restore();

      ctx.save();
      ctx.globalAlpha = UI_SETTINGS.lineAlpha;
      ctx.strokeStyle = "rgba(255,255,255,1)";
      ctx.lineWidth = UI_SETTINGS.lineWidth;
      ctx.beginPath();
      ctx.moveTo(cx + 0.5, r.y);
      ctx.lineTo(cx + 0.5, r.y + r.h);
      ctx.stroke();
      ctx.restore();
    } else {
      if (aReady) drawImg(state.a.img, 1.0);
      if (bReady) drawImg(state.b.img, 1.0);
    }

    ctx.restore();

    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 1;
    ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
    ctx.restore();
  };
}
