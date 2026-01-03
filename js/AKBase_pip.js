import { app } from "/scripts/app.js";
import { renderCompare } from "./AKBase_ui.js";

const TITLE_HEIGHT = 40;
const PIP_ID = "akbase-pip-window";
const AKBASE_PIP_MAX_WIDTH_RATIO = 0.9;
const AKBASE_PIP_MAX_HEIGHT_RATIO = 0.9;

const AKBASE_PIP_MAX_BACKING_WIDTH = 2048;
const AKBASE_PIP_MAX_BACKING_HEIGHT = 2048;

const AKBASE_PIP_BUTTON_SIZE = 18;

const extensionBaseUrl = "/extensions/ComfyUI-AK-Pack/";

function createTitleIconButton(src, title, onClick) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.title = title || "";
  btn.style.border = "none";
  btn.style.outline = "none";
  btn.style.margin = "0";
  btn.style.padding = "0";
  btn.style.width = AKBASE_PIP_BUTTON_SIZE + "px";
  btn.style.height = AKBASE_PIP_BUTTON_SIZE + "px";
  btn.style.background = "transparent";
  btn.style.cursor = "pointer";
  btn.style.display = "inline-flex";
  btn.style.alignItems = "center";
  btn.style.justifyContent = "center";
  btn.style.flex = "0 0 auto";

  const img = document.createElement("img");
  img.src = extensionBaseUrl + src;
  img.alt = title || "";
  img.style.display = "block";
  img.style.width = "100%";
  img.style.height = "100%";
  img.style.objectFit = "contain";

  btn.appendChild(img);

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (typeof onClick === "function") {
      onClick(e);
    }
  });

  btn.addEventListener("mousedown", (e) => {
    e.stopPropagation();
  });

  return btn;
}

function cleanupPipWindow(container) {
  try {
    if (!container) return;
    if (typeof container._akPipDragCleanup === "function") {
      container._akPipDragCleanup();
    }
    if (typeof container._akPipResizeCleanup === "function") {
      container._akPipResizeCleanup();
    }
    if (typeof container._akPipCanvasCleanup === "function") {
      container._akPipCanvasCleanup();
    }
    const canvas = container.querySelector("canvas");
    if (canvas) {
      canvas.width = 0;
      canvas.height = 0;
    }
    container._akPipDragCleanup = null;
    container._akPipResizeCleanup = null;
  } catch (_) {}
}

function destroyPipWindow(container) {
  if (!container) {
    container = document.getElementById(PIP_ID);
  }
  if (!container) return;
  cleanupPipWindow(container);
  if (container.parentNode) {
    container.parentNode.removeChild(container);
  }
}

function createPipWindow(nodeId) {
  const pipId = `${PIP_ID}-${nodeId}`;
  if (document.getElementById(pipId)) return;

  const dpr = window.devicePixelRatio || 1;
  const viewportWidth = window.innerWidth || 800;
  const viewportHeight = window.innerHeight || 600;

  // Aspect of viewport: width / height
  const aspect = viewportWidth / viewportHeight;
  // 20% of larger side
  const maxSide = Math.max(viewportWidth, viewportHeight) * 0.2;

  let canvasWidth;
  let canvasHeight;

  if (aspect >= 1) {
    // Landscape-like viewport
    canvasWidth = maxSide;
    canvasHeight = maxSide / aspect;
  } else {
    // Portrait-like viewport
    canvasHeight = maxSide;
    canvasWidth = maxSide * aspect;
  }

  canvasWidth = Math.max(160, Math.floor(canvasWidth));
  canvasHeight = Math.max(90, Math.floor(canvasHeight));

  const windowWidth = canvasWidth;
  const windowHeight = canvasHeight + TITLE_HEIGHT;

  const container = document.createElement("div");
  container.id = pipId;
  container.style.position = "fixed";
  container.style.boxSizing = "border-box";
  container.style.left = `${Math.max(10, (viewportWidth - windowWidth) / 2)}px`;
  container.style.top = "20px";
  container.style.width = `${windowWidth}px`;
  container.style.height = `${windowHeight}px`;
  container.style.background = "#111";
  container.style.border = "1px solid #444";
  container.style.borderRadius = "6px";
  container.style.boxShadow = "0 4px 16px rgba(0,0,0,0.5)";
  container.style.zIndex = "9999";
  container.style.display = "flex";
  container.style.flexDirection = "column";
  container.style.padding = "0";
  container.style.margin = "0";
  container.style.overflow = "hidden";

  // Title bar (drag handle)
  const titleBar = document.createElement("div");
  titleBar.style.flex = "0 0 auto";
  titleBar.style.height = `${TITLE_HEIGHT}px`;
  titleBar.style.cursor = "move";
  titleBar.style.userSelect = "none";
  titleBar.style.WebkitUserSelect = "none";
  titleBar.style.MozUserSelect = "none";
  titleBar.style.padding = "0 12px";
  titleBar.style.background = "#222";
  titleBar.style.color = "#eee";
  titleBar.style.fontSize = "12px";
  titleBar.style.fontFamily =
    "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  titleBar.style.display = "flex";
  titleBar.style.position = "relative";
  titleBar.style.zIndex = "2";
  titleBar.style.alignItems = "center";
  titleBar.style.justifyContent = "space-between";
  titleBar.style.boxSizing = "border-box";

  const leftButtons = document.createElement("div");
  leftButtons.style.flex = "0 0 auto";
  leftButtons.style.display = "flex";
  leftButtons.style.alignItems = "center";

  const titleText = document.createElement("div");
  titleText.textContent = "AK Base PiP";
  titleText.style.flex = "1 1 auto";
  titleText.style.overflow = "hidden";
  titleText.style.whiteSpace = "nowrap";
  titleText.style.textOverflow = "ellipsis";
  titleText.style.textAlign = "center";

  const rightButtons = document.createElement("div");
  rightButtons.style.flex = "0 0 auto";
  rightButtons.style.display = "flex";
  rightButtons.style.alignItems = "center";
  rightButtons.style.gap = "6px";

  titleBar.appendChild(leftButtons);
  titleBar.appendChild(titleText);
  titleBar.appendChild(rightButtons);

  // Canvas area, no padding around
  const canvas = document.createElement("canvas");
  canvas.style.flex = "0 0 auto";
  canvas.style.display = "block";
  canvas.style.background = "red";
  canvas.style.margin = "0 auto";
  canvas.style.padding = "0";

  canvas.width = Math.floor(canvasWidth * dpr);
  canvas.height = Math.floor(canvasHeight * dpr);

  const pipState = container._akPipState || (container._akPipState = {
    inPreview: false,
    cursorX: 0.5,
    zoom: 1,
    offsetX: 0,
    offsetY: 0,
  });

  function onCanvasMove(e) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (x >= 0 && y >= 0 && x <= rect.width && y <= rect.height) {
      pipState.inPreview = true;
      pipState.cursorX = rect.width > 0 ? Math.min(1, Math.max(0, x / rect.width)) : 0.5;
    } else {
      pipState.inPreview = false;
    }
  }

  function onCanvasLeave() {
    pipState.inPreview = false;
  }

  function onCanvasWheel(e) {
    e.preventDefault();

    const canvasRect = canvas.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    const oldZoom = pipState.zoom || 1;
    const zoomFactor = e.deltaY < 0 ? 1.1 : 1.0 / 1.1;
    const newZoom = Math.min(25, Math.max(0.2, oldZoom * zoomFactor));

    // Determine if pointer is currently over the canvas
    const overCanvas =
      e.clientX >= canvasRect.left &&
      e.clientX <= canvasRect.right &&
      e.clientY >= canvasRect.top &&
      e.clientY <= canvasRect.bottom;

    // Zoom IN only when the mouse is over the canvas
    if (newZoom > oldZoom && !overCanvas) {
      return;
    }

    // Mouse position relative to the dialog (container-local)
    const mouseX = e.clientX - containerRect.left;
    const mouseY = e.clientY - containerRect.top;

    // Anchor is stored in dialog coordinates only
    if (newZoom > oldZoom) {
      pipState.lastZoomAnchor = {
        mouseX,
        mouseY,
      };
    }

    // Decide which anchor to use for this wheel step
    let anchorX = mouseX;
    let anchorY = mouseY;
    if (newZoom < oldZoom && pipState.lastZoomAnchor) {
      anchorX = pipState.lastZoomAnchor.mouseX;
      anchorY = pipState.lastZoomAnchor.mouseY;
    }

    // Canvas position relative to dialog
    const oldWidth = canvasRect.width || 1;
    const oldHeight = canvasRect.height || 1;
    const canvasLeft = canvasRect.left - containerRect.left;
    const canvasTop = canvasRect.top - containerRect.top;

    // Relative position of the anchor within the canvas,
    // computed from dialog-space anchor and current canvas position.
    const relX = (anchorX - canvasLeft) / oldWidth;
    const relY = (anchorY - canvasTop) / oldHeight;

    pipState.zoom = newZoom;

    if (typeof resizeCanvasToWindow === "function") {
      resizeCanvasToWindow(container, canvas, true);
    }

    // Reset transform to measure freshly sized canvas
    canvas.style.transform = "translate(0px, 0px)";

    const baseRect = canvas.getBoundingClientRect();
    const baseLeft = baseRect.left - containerRect.left;
    const baseTop = baseRect.top - containerRect.top;

    const newWidth = baseRect.width || 1;
    const newHeight = baseRect.height || 1;

    // Keep the same logical point under the anchor after resize
    const desiredLeft = anchorX - relX * newWidth;
    const desiredTop = anchorY - relY * newHeight;

    const offsetX = desiredLeft - baseLeft;
    const offsetY = desiredTop - baseTop;

    pipState.offsetX = offsetX;
    pipState.offsetY = offsetY;

    canvas.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
  }


  let isPanning = false;
  let panStartX = 0;
  let panStartY = 0;
  let panStartOffsetX = 0;
  let panStartOffsetY = 0;

  function onCanvasPanMouseDown(e) {
    if (e.button !== 0) return;
    e.preventDefault();
    isPanning = true;
    panStartX = e.clientX;
    panStartY = e.clientY;
    panStartOffsetX = pipState.offsetX || 0;
    panStartOffsetY = pipState.offsetY || 0;

    window.addEventListener("mousemove", onCanvasPanMouseMove);
    window.addEventListener("mouseup", onCanvasPanMouseUp);
  }

  function onCanvasPanMouseMove(e) {
    if (!isPanning) return;
    const dx = e.clientX - panStartX;
    const dy = e.clientY - panStartY;
    pipState.offsetX = panStartOffsetX + dx;
    pipState.offsetY = panStartOffsetY + dy;
  }

  function onCanvasPanMouseUp(e) {
    if (!isPanning) return;
    isPanning = false;
    window.removeEventListener("mousemove", onCanvasPanMouseMove);
    window.removeEventListener("mouseup", onCanvasPanMouseUp);
  }
  canvas.addEventListener("mousemove", onCanvasMove);
  canvas.addEventListener("mouseleave", onCanvasLeave);
  container.addEventListener("wheel", onCanvasWheel, { passive: false });
  canvas.addEventListener("mousedown", onCanvasPanMouseDown);

  container._akPipCanvasCleanup = function () {
    canvas.removeEventListener("mousemove", onCanvasMove);
    canvas.removeEventListener("mouseleave", onCanvasLeave);
    canvas.removeEventListener("wheel", onCanvasWheel);
    canvas.removeEventListener("mousedown", onCanvasPanMouseDown);
    window.removeEventListener("mousemove", onCanvasPanMouseMove);
    window.removeEventListener("mouseup", onCanvasPanMouseUp);
  };

  container.appendChild(titleBar);
  container.appendChild(canvas);
  container.dataset.akbaseNodeId = (nodeId !== undefined && nodeId !== null) ? String(nodeId) : "";
  container._akBaseNodeId = container.dataset.akbaseNodeId;
  const maximizeButton = createTitleIconButton("img/i_max.png", "Maximize", () => {
    const isMaximized = !!container._akPipMaximized;
    if (!isMaximized) {
      const rect = container.getBoundingClientRect();
      container._akPipPrevRect = {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      };

      const viewportWidth = window.innerWidth || 800;
      const viewportHeight = window.innerHeight || 600;

      const newWidth = Math.floor(viewportWidth * AKBASE_PIP_MAX_WIDTH_RATIO);
      const newHeight = Math.floor(viewportHeight * AKBASE_PIP_MAX_HEIGHT_RATIO);

      const left = Math.max(0, Math.floor((viewportWidth - newWidth) / 2));
      const top = Math.max(0, Math.floor((viewportHeight - newHeight) / 2));

      container.style.left = left + "px";
      container.style.top = top + "px";
      container.style.width = newWidth + "px";
      container.style.height = newHeight + "px";
      container.style.right = "";
      container.style.bottom = "";

      container._akPipMaximized = true;

      const img = maximizeButton.querySelector("img");
      if (img) {
        img.src = extensionBaseUrl + "img/i_min.png";
      }
      maximizeButton.title = "Minimize";

      resizeCanvasToWindow(container, canvas);
    } else {
      const prev = container._akPipPrevRect;
      if (prev) {
        container.style.left = prev.left + "px";
        container.style.top = prev.top + "px";
        container.style.width = prev.width + "px";
        container.style.height = prev.height + "px";
        container.style.right = "";
        container.style.bottom = "";
      }

      container._akPipMaximized = false;

      const img = maximizeButton.querySelector("img");
      if (img) {
        img.src = extensionBaseUrl + "img/i_max.png";
      }
      maximizeButton.title = "Maximize";

      resizeCanvasToWindow(container, canvas);
    }
  });

  const resetZoomButton = createTitleIconButton("img/i_reset_off.png", "Reset zoom", () => {
    pipState.zoom = 1;
    pipState.offsetX = 0;
    pipState.offsetY = 0;
    resizeCanvasToWindow(container, canvas);
  });

  const resetZoomImg = resetZoomButton.querySelector("img");
  if (resetZoomImg) {
    container._akPipResetImg = resetZoomImg;
  }

  if (typeof leftButtons !== "undefined") {
    leftButtons.appendChild(maximizeButton);
    leftButtons.appendChild(resetZoomButton);
    leftButtons.style.gap = "6px";
    leftButtons.style.minWidth = AKBASE_PIP_BUTTON_SIZE * 2 + "px";
  }

  const closeButton = createTitleIconButton("img/i_close.png", "Close", () => {
    destroyPipWindow(container);
  });

  if (typeof rightButtons !== "undefined") {
    rightButtons.appendChild(closeButton);
    rightButtons.style.minWidth = AKBASE_PIP_BUTTON_SIZE + "px";
  }


  // Resize handles in corners
  const handles = createResizeHandles(container);
  handles.forEach((h) => container.appendChild(h));

  document.body.appendChild(container);

  installDragBehavior(container, titleBar);
  installResizeBehavior(container, canvas);

  startPipRenderLoop(container, canvas);

  return { container, titleBar, canvas };
}

function createResizeHandles(container) {
  const size = 10;
  const corners = ["nw", "ne", "sw", "se"];
  const handles = [];

  for (const corner of corners) {
    const h = document.createElement("div");
    h.dataset.corner = corner;
    h.style.position = "absolute";
    h.style.width = `${size}px`;
    h.style.height = `${size}px`;
    h.style.zIndex = "10000";
    h.style.background = "transparent";

    if (corner === "nw") {
      h.style.left = "0";
      h.style.top = "0";
      h.style.cursor = "nwse-resize";
    } else if (corner === "ne") {
      h.style.right = "0";
      h.style.top = "0";
      h.style.cursor = "nesw-resize";
    } else if (corner === "sw") {
      h.style.left = "0";
      h.style.bottom = "0";
      h.style.cursor = "nesw-resize";
    } else if (corner === "se") {
      h.style.right = "0";
      h.style.bottom = "0";
      h.style.cursor = "nwse-resize";
    }

    handles.push(h);
  }

  return handles;
}

function installDragBehavior(container, titleBar) {
  let isDragging = false;
  let dragOffsetX = 0;
  let dragOffsetY = 0;

  function onMouseDown(e) {
    if (e.button !== 0) return;

    isDragging = true;
    const rect = container.getBoundingClientRect();
    dragOffsetX = e.clientX - rect.left;
    dragOffsetY = e.clientY - rect.top;

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }

  function onMouseMove(e) {
    if (!isDragging) return;

    const viewportWidth = window.innerWidth || 800;
    const viewportHeight = window.innerHeight || 600;

    let left = e.clientX - dragOffsetX;
    let top = e.clientY - dragOffsetY;

    const rect = container.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    const minLeft = 0;
    const minTop = 0;
    const maxLeft = viewportWidth - width;
    const maxTop = viewportHeight - height;

    left = Math.min(Math.max(minLeft, left), Math.max(minLeft, maxLeft));
    top = Math.min(Math.max(minTop, top), Math.max(minTop, maxTop));

    container.style.left = `${left}px`;
    container.style.top = `${top}px`;
    container.style.right = "";
    container.style.bottom = "";
  }

  function onMouseUp() {
    if (!isDragging) return;
    isDragging = false;
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", onMouseUp);
  }

  titleBar.addEventListener("mousedown", onMouseDown);

  container._akPipDragCleanup = function () {
    titleBar.removeEventListener("mousedown", onMouseDown);
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", onMouseUp);
  };
}

function installResizeBehavior(container, canvas) {
  let isResizing = false;
  let activeCorner = null;
  let startX = 0;
  let startY = 0;
  let startWidth = 0;
  let startHeight = 0;
  let startLeft = 0;
  let startTop = 0;

  const minWidth = 160;
  const minHeight = 120;

  const cornerHandles = container.querySelectorAll("div[data-corner]");

  function onHandleMouseDown(e) {
    if (e.button !== 0) return;

    const target = e.currentTarget;
    const corner = target?.dataset?.corner;
    if (!corner) return;

    const rect = container.getBoundingClientRect();

    isResizing = true;
    activeCorner = corner;
    startX = e.clientX;
    startY = e.clientY;
    startWidth = rect.width;
    startHeight = rect.height;
    startLeft = rect.left;
    startTop = rect.top;

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);

    e.stopPropagation();
    e.preventDefault();
  }

  function onMouseMove(e) {
    if (!isResizing || !activeCorner) return;

    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    let newWidth = startWidth;
    let newHeight = startHeight;
    let newLeft = startLeft;
    let newTop = startTop;

    if (activeCorner === "se") {
      newWidth = startWidth + dx;
      newHeight = startHeight + dy;
    } else if (activeCorner === "sw") {
      newWidth = startWidth - dx;
      newHeight = startHeight + dy;
      newLeft = startLeft + dx;
    } else if (activeCorner === "ne") {
      newWidth = startWidth + dx;
      newHeight = startHeight - dy;
      newTop = startTop + dy;
    } else if (activeCorner === "nw") {
      newWidth = startWidth - dx;
      newHeight = startHeight - dy;
      newLeft = startLeft + dx;
      newTop = startTop + dy;
    }

    newWidth = Math.max(minWidth, newWidth);
    newHeight = Math.max(minHeight, newHeight);

    container.style.width = `${newWidth}px`;
    container.style.height = `${newHeight}px`;
    container.style.left = `${newLeft}px`;
    container.style.top = `${newTop}px`;
    container.style.right = "";
    container.style.bottom = "";

    resizeCanvasToWindow(container, canvas);
  }

  function onMouseUp() {
    if (!isResizing || !activeCorner) return;
    isResizing = false;
    activeCorner = null;
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", onMouseUp);
  }

  cornerHandles.forEach((handle) => {
    handle.addEventListener("mousedown", onHandleMouseDown);
  });

  container._akPipResizeCleanup = function () {
    cornerHandles.forEach((handle) => {
      handle.removeEventListener("mousedown", onHandleMouseDown);
    });
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", onMouseUp);
  };
}


function startPipRenderLoop(container, canvas) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const pipState = container._akPipState || (container._akPipState = {
    inPreview: false,
    cursorX: 0.5,
    zoom: 1,
    offsetX: 0,
    offsetY: 0,
  });

  function getNodeStateForPip() {
    const nidRaw = container._akBaseNodeId || container.dataset.akbaseNodeId;
    const nid = (nidRaw !== undefined && nidRaw !== null && nidRaw !== "") ? Number(nidRaw) : null;

    const graph = app?.graph;
    const nodes = graph?._nodes;
    if (!nodes || !nodes.length) return null;

    let target = null;
    if (nid !== null && Number.isFinite(nid)) {
      if (typeof graph.getNodeById === "function") {
        target = graph.getNodeById(nid) || null;
      } else {
        for (let i = 0; i < nodes.length; i++) {
          const n = nodes[i];
          if (n && n.id === nid) {
            target = n;
            break;
          }
        }
      }
    }

    if (!target) {
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        if (n && n._akBase) {
          target = n;
          break;
        }
      }
    }

    if (!target || !target._akBase) return null;

    const src = target._akBase;
    const state = {
      mode: src.mode,
      a: {
        img: src.a?.img || null,
        url: src.a?.url || null,
        loaded: !!src.a?.loaded,
      },
      b: {
        img: src.b?.img || null,
        url: src.b?.url || null,
        loaded: !!src.b?.loaded,
      },
      inPreview: !!pipState.inPreview,
      cursorX: typeof pipState.cursorX === "number" ? pipState.cursorX : 0.5,
    };

    return state;
  }

  function frame() {
    if (!document.body.contains(container)) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const logicalWidth = rect.width || (canvas.width / dpr);
    const logicalHeight = rect.height || (canvas.height / dpr);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const state = getNodeStateForPip();

    // Track source image dimensions for canvas sizing.
    if (state) {
      let img = null;
      if (state.a && state.a.img) {
        img = state.a.img;
      } else if (state.b && state.b.img) {
        img = state.b.img;
      }
      if (img && typeof img.naturalWidth === "number" && img.naturalWidth > 0 && typeof img.naturalHeight === "number" && img.naturalHeight > 0) {
        const prevW = container._akPipImgWidth || 0;
        const prevH = container._akPipImgHeight || 0;

        container._akPipImgWidth = img.naturalWidth;
        container._akPipImgHeight = img.naturalHeight;

        // When image dimensions appear for the first time (or change) in normal mode,
        // recalculate canvas size so it fits/centers correctly without requiring a manual resize.
        const pip = container._akPipState;
        const zoomNow = pip && typeof pip.zoom === "number" ? pip.zoom : 1;
        const isZoom = zoomNow !== 1;

        if (!isZoom && typeof resizeCanvasToWindow === "function") {
          if (prevW !== container._akPipImgWidth || prevH !== container._akPipImgHeight) {
            resizeCanvasToWindow(container, canvas, false);
          }
        }
      }
    }

    const scaleX = canvas.width / logicalWidth;
    const scaleY = canvas.height / logicalHeight;

    ctx.save();
    ctx.scale(scaleX, scaleY);

    const zoom = pipState.zoom || 1;
    const offsetX = pipState.offsetX || 0;
    const offsetY = pipState.offsetY || 0;

    // Move the whole canvas inside the dialog using CSS transform.
    canvas.style.transform = `translate(${offsetX}px, ${offsetY}px)`;

    const isZoomMode =
      zoom !== 1 ||
      (offsetX || 0) !== 0 ||
      (offsetY || 0) !== 0;

    const resetImg = container._akPipResetImg || null;
    if (resetImg) {
      const expectedSrc = extensionBaseUrl + (isZoomMode ? "img/i_reset.png" : "img/i_reset_off.png");
      if (resetImg.src !== expectedSrc) {
        resetImg.src = expectedSrc;
      }
    }

        if (state && state.mode === "compare" && typeof renderCompare === "function") {
      const view = {
        zoom: 1,
        offsetX: 0,
        offsetY: 0,
      };
      const r = { x: 0, y: 0, w: logicalWidth, h: logicalHeight };
      try {
        renderCompare(ctx, r, state, view);
      } catch (e) {
        console.log("[AKBasePiP] renderCompare error", e);
      }
    } else {
      ctx.fillStyle = "#111";
      ctx.fillRect(0, 0, logicalWidth, logicalHeight);
      ctx.fillStyle = "#eee";
      ctx.font = "12px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      let msg = "PiP: compare mode only";
      if (state && state.mode === "gallery") {
        msg = "Gallery mode is not supported";
      } else if (!state) {
        msg = "No AKBase node state";
      }

      ctx.fillText(msg, logicalWidth / 2, logicalHeight / 2);
    }

    ctx.restore();

    window.requestAnimationFrame(frame);
  }

  window.requestAnimationFrame(frame);
}

function resizeCanvasToWindow(container, canvas, allowZoomResize = false) {
  const dpr = window.devicePixelRatio || 1;
  const rect = container.getBoundingClientRect();
  const containerWidth = rect.width;
  const containerHeight = rect.height;

  const pipState = container._akPipState || {};
  const zoom = pipState.zoom || 1;
  const isZoomMode = zoom !== 1;

  // In zoom mode, ignore window size changes triggered by container resize when not explicitly allowed.
  if (isZoomMode && !allowZoomResize) {
    const currentRect = canvas.getBoundingClientRect();
    const currentW = currentRect.width || (canvas.width / dpr);
    const currentH = currentRect.height || (canvas.height / dpr);

    container._akPipLastWidth = currentW;
    container._akPipLastHeight = currentH;

    canvas.style.width = `${currentW}px`;
    canvas.style.height = `${currentH}px`;

    canvas.width = Math.max(1, Math.floor(currentW * dpr));
    canvas.height = Math.max(1, Math.floor(currentH * dpr));
    return;
  }

  // Base image size (fallback to container size if unknown).
  const imgW =
    container._akPipImgWidth && container._akPipImgWidth > 0
      ? container._akPipImgWidth
      : containerWidth;
  const imgH =
    container._akPipImgHeight && container._akPipImgHeight > 0
      ? container._akPipImgHeight
      : (containerHeight - TITLE_HEIGHT);

  const availW = Math.max(1, Math.floor(containerWidth));
  const availH = Math.max(1, Math.floor(containerHeight - TITLE_HEIGHT));

  // Base scale: how the image fits into the window at zoom = 1.
  let baseScale =
    typeof container._akPipBaseScale === "number" && container._akPipBaseScale > 0
      ? container._akPipBaseScale
      : null;

  // Recalculate base scale when not in zoom mode or if it was never set.
  if (!isZoomMode || baseScale === null) {
    baseScale = Math.min(availW / imgW, availH / imgH);
    container._akPipBaseScale = baseScale;
  }

  // Visual scale controls how large the image appears inside the dialog.
  const displayScale = baseScale * zoom;
  const displayWidth = Math.max(1, Math.floor(imgW * displayScale));
  const displayHeight = Math.max(1, Math.floor(imgH * displayScale));

  // Backing scale controls how many pixels we actually render.
  let backingScale = displayScale;

  const maxBackingWidth = AKBASE_PIP_MAX_BACKING_WIDTH;
  const maxBackingHeight = AKBASE_PIP_MAX_BACKING_HEIGHT;

  const backingWidthCandidate = imgW * backingScale;
  const backingHeightCandidate = imgH * backingScale;

  if (backingWidthCandidate > maxBackingWidth || backingHeightCandidate > maxBackingHeight) {
    const widthRatio = maxBackingWidth / backingWidthCandidate;
    const heightRatio = maxBackingHeight / backingHeightCandidate;
    const ratio = Math.min(widthRatio, heightRatio);
    backingScale = backingScale * ratio;
  }

  const backingWidth = Math.max(1, Math.floor(imgW * backingScale));
  const backingHeight = Math.max(1, Math.floor(imgH * backingScale));

  container._akPipLastWidth = displayWidth;
  container._akPipLastHeight = displayHeight;

  canvas.style.width = `${displayWidth}px`;
  canvas.style.height = `${displayHeight}px`;

  canvas.width = Math.max(1, Math.floor(backingWidth * dpr));
  canvas.height = Math.max(1, Math.floor(backingHeight * dpr));
}


app.registerExtension({
  name: "AKBasePiP",
  setup() {
    window.AKBasePip = window.AKBasePip || {};
    window.AKBasePip.openForNode = function (nodeId) {
      createPipWindow(nodeId);
    };
  },
});
