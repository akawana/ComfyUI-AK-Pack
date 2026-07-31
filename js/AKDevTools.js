import { app } from "../../scripts/app.js";

const TAB_ID = "ak-dev-tools";
const TITLE = "DevTools";
const TOOLTIP = "AK Dev Tools";
const ICON_CLASS = "ak-devtools-icon";

const ICON_URL_OFF = "/extensions/ComfyUI-AK-Pack/img/i_toolbal_dev_off.png";
const ICON_URL_ON  = "/extensions/ComfyUI-AK-Pack/img/i_toolbal_dev_on.png";

// ── state ────────────────────────────────────────────────────────────────────
let registered   = false;
let panelRootEl  = null;   // live DOM root given by renderPanel
let logListEl    = null;   // <div> that holds rows

// per-run tracking
let runStartTime      = null;   // Date.now() when execution_start fired
let nodeStartTimes    = {};     // nodeId → Date.now()
let nodeEndTimes      = {};     // nodeId → Date.now()
let cachedNodes       = new Set();
let executedNodes     = [];     // ordered list of nodeId strings
let pendingRows       = {};     // nodeId → row DOM element (written while executing)
let lastExecutingId   = null;   // id of the last "executing" node (to close it when next arrives)

let hideCached        = false;  // toggle: hide cached rows

// ── icon style ───────────────────────────────────────────────────────────────
function injectIconStyle() {
  if (document.getElementById("ak-devtools-icon-style")) return;
  const s = document.createElement("style");
  s.id = "ak-devtools-icon-style";
  s.textContent =
    ".side-bar-button-icon." + ICON_CLASS + "{" +
    "background-image:url('" + ICON_URL_OFF + "');" +
    "background-repeat:no-repeat;" +
    "background-position:center;" +
    "background-size:18px 18px;" +
    "display:inline-block;" +
    "width:1.2em;height:1.2em;" +
    "}" +
    "." + TAB_ID + "-tab-button:hover .side-bar-button-icon." + ICON_CLASS + "{" +
    "background-image:url('" + ICON_URL_ON + "');" +
    "}";
  document.head.appendChild(s);
}

// ── helpers ───────────────────────────────────────────────────────────────────
function getNodeTitle(nodeId) {
  try {
    const nodes = app?.graph?._nodes || [];
    for (const n of nodes) {
      if (String(n.id) === String(nodeId)) {
        return n.title || n.type || ("Node #" + nodeId);
      }
    }
  } catch (_) {}
  return "Node #" + nodeId;
}

function focusNode(nodeId) {
  try {
    const nodes = app?.graph?._nodes || [];
    for (const n of nodes) {
      if (String(n.id) === String(nodeId)) {
        app.canvas.selectNode(n, false);
        app.canvas.centerOnNode(n);
        app.canvas.setDirty(true, true);
        return;
      }
    }
  } catch (_) {}
}

// pad / truncate a string to exactly `len` chars (monospace columns)
function col(str, len) {
  const s = String(str ?? "");
  if (s.length >= len) return s.slice(0, len);
  return s + " ".repeat(len - s.length);
}

// ── row builder ───────────────────────────────────────────────────────────────
// status : "cached" | "executing" | "exec"
// elapsed: number (seconds) or null
function buildRow(nodeId, status, elapsed) {
  const title   = getNodeTitle(nodeId);
  const idStr   = col(String(nodeId), 6);
  const statStr = col(status === "cached" ? "cached" : status === "executing" ? "running" : "exec  ", 10);
  const timeStr = col(elapsed !== null ? elapsed.toFixed(2) + "s" : "…", 8);
  const nameStr = title;

  const row = document.createElement("div");
  row.dataset.nodeId = String(nodeId);
  row.style.cssText = [
    "display:flex",
    "align-items:center",
    "padding:3px 6px",
    "cursor:pointer",
    "border-bottom:1px solid rgba(255,255,255,0.05)",
    "font-family:monospace",
    "font-size:12px",
    "line-height:1.6",
    "transition:background 0.1s",
    "gap:0",
  ].join(";");

  row.addEventListener("mouseenter", () => { row.style.background = "rgba(255,255,255,0.07)"; });
  row.addEventListener("mouseleave", () => { row.style.background = ""; });
  row.addEventListener("click",      () => focusNode(nodeId));

  function makeCell(text, width, color) {
    const c = document.createElement("span");
    c.style.cssText = [
      "display:inline-block",
      "min-width:" + width + "px",
      "max-width:" + width + "px",
      "overflow:hidden",
      "white-space:pre",
      "color:" + color,
      "padding-right:8px",
    ].join(";");
    c.textContent = text;
    return c;
  }

  // color scheme
  const colId    = "#8ab4f8";                          // blue
  const colStat  = status === "cached"    ? "#6fcf97"  // green
                 : status === "executing" ? "#f2c94c"  // yellow
                 :                          "#56ccf2";  // cyan (exec)
  const colTime  = status === "cached"    ? "#6fcf97"
                 : elapsed !== null       ? "#e0e0e0"
                 :                          "#888";
  const colName  = "#e0e0e0";

  row.appendChild(makeCell(idStr,   52,  colId));
  row.appendChild(makeCell(statStr, 76,  colStat));
  row.appendChild(makeCell(timeStr, 64,  colTime));
  row.appendChild(makeCell(nameStr, 999, colName));  // name fills rest

  return row;
}

// ── update an existing row in place ──────────────────────────────────────────
function updateRow(row, nodeId, status, elapsed) {
  const cells = row.querySelectorAll("span");
  if (cells.length < 4) return;

  const title   = getNodeTitle(nodeId);
  const statStr = col(status === "cached" ? "cached" : status === "executing" ? "running" : "exec  ", 10);
  const timeStr = col(elapsed !== null ? elapsed.toFixed(2) + "s" : "…", 8);

  const colStat  = status === "cached"    ? "#6fcf97"
                 : status === "executing" ? "#f2c94c"
                 :                          "#56ccf2";
  const colTime  = status === "cached"    ? "#6fcf97"
                 : elapsed !== null       ? "#e0e0e0"
                 :                          "#888";

  if (status !== "cached") row.style.display = "";
  cells[1].textContent = statStr;
  cells[1].style.color = colStat;
  cells[2].textContent = timeStr;
  cells[2].style.color = colTime;
  cells[3].textContent = title;
}

// ── summary line ──────────────────────────────────────────────────────────────
function buildSummaryRow(totalSec) {
  const el = document.createElement("div");
  el.id = "ak-devtools-summary";
  el.style.cssText = [
    "padding:6px 8px",
    "font-family:monospace",
    "font-size:12px",
    "color:#f2c94c",
    "border-bottom:1px solid rgba(255,255,255,0.12)",
    "margin-bottom:2px",
  ].join(";");
  el.textContent = totalSec !== null
    ? "Execution time: " + totalSec.toFixed(2) + " sec."
    : "Running…";
  return el;
}

// ── header row (column labels) ────────────────────────────────────────────────
function buildHeaderRow() {
  const el = document.createElement("div");
  el.style.cssText = [
    "display:flex",
    "align-items:center",
    "padding:3px 6px",
    "font-family:monospace",
    "font-size:11px",
    "color:rgba(255,255,255,0.4)",
    "border-bottom:1px solid rgba(255,255,255,0.12)",
    "gap:0",
    "user-select:none",
  ].join(";");

  function hcell(text, width) {
    const c = document.createElement("span");
    c.style.cssText = [
      "display:inline-block",
      "min-width:" + width + "px",
      "max-width:" + width + "px",
      "white-space:pre",
      "padding-right:8px",
    ].join(";");
    c.textContent = text;
    return c;
  }

  el.appendChild(hcell("ID",      52));
  el.appendChild(hcell("STATUS",  76));
  el.appendChild(hcell("TIME",    64));
  el.appendChild(hcell("NODE",    999));
  return el;
}

// ── log area helpers ──────────────────────────────────────────────────────────
function getLogList() {
  if (panelRootEl) {
    logListEl = panelRootEl.querySelector("#ak-devtools-loglist");
  }
  return logListEl;
}

function clearLog() {
  const ll = getLogList();
  if (ll) ll.innerHTML = "";
  // reset run state
  runStartTime   = null;
  nodeStartTimes = {};
  nodeEndTimes   = {};
  cachedNodes    = new Set();
  executedNodes  = [];
  pendingRows    = {};
}

function ensureSummary(totalSec) {
  const ll = getLogList();
  if (!ll) return;
  let s = ll.querySelector("#ak-devtools-summary");
  if (!s) {
    s = buildSummaryRow(totalSec);
    ll.insertBefore(s, ll.firstChild);
    // header right after summary
    const h = buildHeaderRow();
    h.id = "ak-devtools-header";
    ll.insertBefore(h, s.nextSibling);
  } else if (totalSec !== null) {
    s.textContent = "Execution time: " + totalSec.toFixed(2) + " sec.";
  }
}

function applyHideCached() {
  for (const id of cachedNodes) {
    const row = pendingRows[id];
    if (row) row.style.display = hideCached ? "none" : "";
  }
}

function appendOrUpdateRow(nodeId, status, elapsed) {
  const ll = getLogList();
  if (!ll) return;

  if (pendingRows[nodeId]) {
    updateRow(pendingRows[nodeId], nodeId, status, elapsed);
    return;
  }
  const row = buildRow(nodeId, status, elapsed);
  if (status === "cached" && hideCached) row.style.display = "none";
  pendingRows[nodeId] = row;
  ll.appendChild(row);
}

// ── WebSocket listener ────────────────────────────────────────────────────────
function hookWebSocket() {
  const origSend = WebSocket.prototype.send;

  // We listen on the existing ComfyUI ws via api events if available,
  // otherwise patch WebSocket.
  // ComfyUI exposes app.api with addEventListener for custom message types.
  if (app?.api) {
    const api = app.api;

    // execution_start: new run begins
    api.addEventListener("execution_start", () => {
      runStartTime   = Date.now();
      nodeStartTimes = {};
      nodeEndTimes   = {};
      cachedNodes    = new Set();
      executedNodes  = [];
      pendingRows    = {};
      lastExecutingId = null;
      const ll = getLogList();
      if (ll) ll.innerHTML = "";
      ensureSummary(null);
    });

    // execution_cached: list of node ids that will be skipped
    api.addEventListener("execution_cached", (ev) => {
      const nodes = ev?.detail?.nodes || [];
      for (const id of nodes) {
        cachedNodes.add(String(id));
        appendOrUpdateRow(String(id), "cached", 0);
      }
    });

    // executing: a node starts
    api.addEventListener("executing", (ev) => {
      const id = ev?.detail;  // ComfyUI sends node id directly
      if (!id) {
        // null id → execution finished
        if (runStartTime !== null) {
          const total = (Date.now() - runStartTime) / 1000;
          ensureSummary(total);
        }
        return;
      }
      const sid = String(id);
      // close previous node using time diff
      if (lastExecutingId && !nodeEndTimes[lastExecutingId]) {
        nodeEndTimes[lastExecutingId] = Date.now();
        const elapsed = (nodeEndTimes[lastExecutingId] - nodeStartTimes[lastExecutingId]) / 1000;
        cachedNodes.delete(lastExecutingId);
        appendOrUpdateRow(lastExecutingId, "exec", elapsed);
      }
      lastExecutingId = sid;
      nodeStartTimes[sid] = Date.now();
      executedNodes.push(sid);
      appendOrUpdateRow(sid, "executing", null);
    });

    // executed: a node finished
    api.addEventListener("executed", (ev) => {
      const id = ev?.detail?.node;
      if (!id) return;
      const sid = String(id);
      nodeEndTimes[sid] = Date.now();
      if (!nodeStartTimes[sid]) nodeStartTimes[sid] = nodeEndTimes[sid];
      const elapsed = (nodeEndTimes[sid] - nodeStartTimes[sid]) / 1000;
      cachedNodes.delete(sid);
      appendOrUpdateRow(sid, "exec", elapsed);
    });

    // execution_error
    api.addEventListener("execution_error", (ev) => {
      const id = ev?.detail?.node_id;
      if (!id) return;
      const sid = String(id);
      const start = nodeStartTimes[sid];
      const elapsed = start ? (Date.now() - start) / 1000 : null;
      // mark as error visually
      const ll = getLogList();
      if (ll && pendingRows[sid]) {
        const cells = pendingRows[sid].querySelectorAll("span");
        if (cells[1]) { cells[1].textContent = col("ERROR", 10); cells[1].style.color = "#eb5757"; }
        if (cells[2] && elapsed !== null) { cells[2].textContent = col(elapsed.toFixed(2) + "s", 8); }
      }
      if (runStartTime !== null) {
        ensureSummary((Date.now() - runStartTime) / 1000);
      }
    });

    return; // hooked via api events
  }

  // Fallback: patch WebSocket onmessage (older ComfyUI)
  const origAddEventListener = WebSocket.prototype.addEventListener;
  WebSocket.prototype.addEventListener = function(type, listener, opts) {
    if (type === "message") {
      const wrapped = function(ev) {
        try {
          const data = JSON.parse(ev.data);
          handleRawWsMessage(data);
        } catch (_) {}
        listener.call(this, ev);
      };
      return origAddEventListener.call(this, type, wrapped, opts);
    }
    return origAddEventListener.call(this, type, listener, opts);
  };
}

function handleRawWsMessage(data) {
  if (!data || !data.type) return;

  if (data.type === "execution_start") {
    runStartTime   = Date.now();
    nodeStartTimes = {};
    nodeEndTimes   = {};
    cachedNodes    = new Set();
    executedNodes  = [];
    pendingRows    = {};
    lastExecutingId = null;
    const ll = getLogList();
    if (ll) ll.innerHTML = "";
    ensureSummary(null);
  }

  if (data.type === "execution_cached") {
    const nodes = data?.data?.nodes || [];
    for (const id of nodes) {
      cachedNodes.add(String(id));
      appendOrUpdateRow(String(id), "cached", 0);
    }
  }

  if (data.type === "executing") {
    const id = data?.data?.node;
    if (!id) {
      if (runStartTime !== null) {
        ensureSummary((Date.now() - runStartTime) / 1000);
      }
      return;
    }
    const sid = String(id);
    // close previous node using time diff
    if (lastExecutingId && !nodeEndTimes[lastExecutingId]) {
      nodeEndTimes[lastExecutingId] = Date.now();
      const elapsed = (nodeEndTimes[lastExecutingId] - nodeStartTimes[lastExecutingId]) / 1000;
      cachedNodes.delete(lastExecutingId);
      appendOrUpdateRow(lastExecutingId, "exec", elapsed);
    }
    lastExecutingId = sid;
    nodeStartTimes[sid] = Date.now();
    executedNodes.push(sid);
    appendOrUpdateRow(sid, "executing", null);
  }

  if (data.type === "executed") {
    const id = data?.data?.node;
    if (!id) return;
    const sid = String(id);
    nodeEndTimes[sid] = Date.now();
    if (!nodeStartTimes[sid]) nodeStartTimes[sid] = nodeEndTimes[sid];
    const elapsed = (nodeEndTimes[sid] - nodeStartTimes[sid]) / 1000;
    cachedNodes.delete(sid);
    appendOrUpdateRow(sid, "exec", elapsed);
  }

  if (data.type === "execution_error") {
    const id = data?.data?.node_id;
    if (!id) return;
    const sid = String(id);
    const start = nodeStartTimes[sid];
    const elapsed = start ? (Date.now() - start) / 1000 : null;
    if (pendingRows[sid]) {
      const cells = pendingRows[sid].querySelectorAll("span");
      if (cells[1]) { cells[1].textContent = col("ERROR", 10); cells[1].style.color = "#eb5757"; }
      if (cells[2] && elapsed !== null) { cells[2].textContent = col(elapsed.toFixed(2) + "s", 8); }
    }
    if (runStartTime !== null) ensureSummary((Date.now() - runStartTime) / 1000);
  }
}

// ── panel renderer ────────────────────────────────────────────────────────────
function renderPanel(el) {
  panelRootEl = el;
  el.innerHTML = "";
  el.style.display = "flex";
  el.style.flexDirection = "column";
  el.style.height = "100%";
  el.style.overflow = "hidden";

  // ── header bar ──
  const header = document.createElement("div");
  header.style.cssText = [
    "display:flex",
    "align-items:center",
    "justify-content:space-between",
    "padding:8px 10px",
    "border-bottom:1px solid rgba(255,255,255,0.08)",
    "flex-shrink:0",
  ].join(";");

  const titleEl = document.createElement("div");
  titleEl.textContent = TOOLTIP;
  titleEl.style.cssText = "font-size:13px;font-weight:600;";

  const rightBtns = document.createElement("div");
  rightBtns.style.cssText = "display:flex;gap:6px;align-items:center;";

  const clearBtn = document.createElement("button");
  clearBtn.type = "button";
  clearBtn.textContent = "Clear";
  clearBtn.style.cssText = [
    "padding:3px 10px",
    "border-radius:6px",
    "border:1px solid rgba(255,255,255,0.2)",
    "background:rgba(255,255,255,0.08)",
    "color:inherit",
    "font-size:12px",
    "cursor:pointer",
  ].join(";");
  clearBtn.addEventListener("mouseenter", () => clearBtn.style.background = "rgba(255,255,255,0.14)");
  clearBtn.addEventListener("mouseleave", () => clearBtn.style.background = "rgba(255,255,255,0.08)");
  clearBtn.addEventListener("click", clearLog);

  rightBtns.appendChild(clearBtn);
  header.appendChild(titleEl);
  header.appendChild(rightBtns);
  el.appendChild(header);

  // ── toolbar: hide cached toggle ──
  const toolbar = document.createElement("div");
  toolbar.style.cssText = [
    "display:flex",
    "align-items:center",
    "gap:8px",
    "padding:5px 10px",
    "border-bottom:1px solid rgba(255,255,255,0.08)",
    "flex-shrink:0",
    "font-size:12px",
  ].join(";");

  const toggleLabel = document.createElement("label");
  toggleLabel.style.cssText = "display:flex;align-items:center;gap:6px;cursor:pointer;user-select:none;color:rgba(255,255,255,0.7);";

  const toggleCheck = document.createElement("input");
  toggleCheck.type = "checkbox";
  toggleCheck.checked = hideCached;
  toggleCheck.style.cssText = "width:13px;height:13px;cursor:pointer;accent-color:#4da3ff;";
  toggleCheck.addEventListener("change", () => {
    hideCached = toggleCheck.checked;
    applyHideCached();
  });

  const toggleText = document.createElement("span");
  toggleText.textContent = "Hide cached";

  toggleLabel.appendChild(toggleCheck);
  toggleLabel.appendChild(toggleText);
  toolbar.appendChild(toggleLabel);
  el.appendChild(toolbar);

  // ── scrollable log area ──
  const logWrap = document.createElement("div");
  logWrap.style.cssText = [
    "flex:1",
    "overflow-y:auto",
    "overflow-x:auto",
    "padding:4px 0",
  ].join(";");

  const logList = document.createElement("div");
  logList.id = "ak-devtools-loglist";
  logList.style.cssText = [
    "min-width:max-content",
    "width:100%",
  ].join(";");

  // restore any existing rows from state
  if (runStartTime !== null || Object.keys(pendingRows).length > 0) {
    _rebuildLogFromState(logList);
  }

  logWrap.appendChild(logList);
  el.appendChild(logWrap);

  logListEl = logList;
}

function _rebuildLogFromState(ll) {
  ll.innerHTML = "";
  const totalMs = runStartTime ? (Date.now() - runStartTime) : null;
  const isFinished = totalMs !== null && Object.keys(nodeEndTimes).length > 0;

  const summary = buildSummaryRow(isFinished ? totalMs / 1000 : null);
  ll.appendChild(summary);
  ll.appendChild(buildHeaderRow());

  // cached nodes first
  for (const id of cachedNodes) {
    const row = buildRow(id, "cached", 0);
    if (hideCached) row.style.display = "none";
    pendingRows[id] = row;
    ll.appendChild(row);
  }

  // executed nodes in order
  for (const id of executedNodes) {
    const end   = nodeEndTimes[id];
    const start = nodeStartTimes[id];
    const elapsed = (end && start) ? (end - start) / 1000 : null;
    const status  = end ? "exec" : "executing";
    const row = buildRow(id, status, elapsed);
    pendingRows[id] = row;
    ll.appendChild(row);
  }
}

// ── enable/disable ────────────────────────────────────────────────────────────
const ENABLE_STYLE_ID = "ak-devtools-enabled-visibility-style";
const ENABLE_SETTING_ID = "AK.DevTools_Enable";

function applyEnabled(enabled) {
  let style = document.getElementById(ENABLE_STYLE_ID);
  if (!style) {
    style = document.createElement("style");
    style.id = ENABLE_STYLE_ID;
    document.head.appendChild(style);
  }
  style.textContent = enabled ? "" : `
    .${TAB_ID}-tab-button { display: none !important; }
  `;
  if (!enabled) {
    const em = app?.extensionManager;
    if (typeof em?.setActiveSidebarTab === "function") em.setActiveSidebarTab(null);
    else if (typeof em?.activateSidebarTab === "function") em.activateSidebarTab(null);
  }
}

function isEnabled() {
  try {
    const v = app?.ui?.settings?.getSettingValue(ENABLE_SETTING_ID);
    if (typeof v === "boolean") return v;
  } catch (_) {}
  try {
    const raw = window.localStorage.getItem(ENABLE_SETTING_ID);
    if (raw === "false") return false;
  } catch (_) {}
  return true;
}

function installEnableSetting() {
  try {
    app.ui.settings.addSetting({
      id: ENABLE_SETTING_ID,
      name: "Dev Tools Panel",
      type: "boolean",
      defaultValue: true,
      category: ["AK", "Project, Samplers, Debug Panels", "Dev Tools Panel"],
      onChange: (v) => { try { applyEnabled(v === true); } catch (_) {} },
    });
  } catch (_) {}
}

// ── register ──────────────────────────────────────────────────────────────────
app.registerExtension({
  name: "AK.DevTools",
  setup() {
    if (registered) return;
    registered = true;

    injectIconStyle();
    hookWebSocket();
    installEnableSetting();
    applyEnabled(isEnabled());

    const em = app?.extensionManager;
    if (em && typeof em.registerSidebarTab === "function") {
      em.registerSidebarTab({
        id:      TAB_ID,
        title:   TITLE,
        tooltip: TOOLTIP,
        icon:    ICON_CLASS,
        type:    "custom",
        render:  renderPanel,
      });
    }
  },
});
