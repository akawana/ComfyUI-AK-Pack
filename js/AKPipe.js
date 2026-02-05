// AKPipe.js
// Auto-bypass AK Pipe when all connected (non-ak_pipe) neighbors are Muted or Bypassed.
// Auto-enable (ALWAYS) immediately if any connected neighbor (non-ak_pipe) is in ALWAYS mode.
// Triggers checks on graph load, connection changes, canvas clicks, and node-toolbar/menu clicks (interactive).
// Uses click events (single trigger). IMPORTANT: click handlers that toggle node.mode run after capture phase,
// so we schedule rescans to the next macrotask to observe the updated node.mode.

import { app } from "../../../scripts/app.js";

const MODE_ALWAYS = 0;
const MODE_MUTE = 2;
const MODE_BYPASS = 4;

// Names to exclude from checks
const SKIP_PORT_NAMES = new Set(["ak_pipe", "pipe_in", "pipe_out"]);

// Settings
const SETTING_ID = "ak.akpipe.enable_auto_bypass";
const SETTING_CATEGORY = ["AK", "AK Pipe"];

function getSettings() {
  return app?.ui?.settings || null;
}

function isEnabled() {
  const s = getSettings();
  if (!s) return true;

  // Treat missing/undefined as enabled (default true)
  let v;
  try {
    if (typeof s.getSettingValue === "function") v = s.getSettingValue(SETTING_ID);
    else if (typeof s.get === "function") v = s.get(SETTING_ID);
  } catch {
    v = undefined;
  }
  return v !== false;
}

function tryInstallSetting() {
  const s = getSettings();
  if (!s || typeof s.addSetting !== "function") return;

  s.addSetting({
    id: SETTING_ID,
    name: "Enable auto Bypass",
    type: "boolean",
    defaultValue: true,
    default: true,
    category: SETTING_CATEGORY,
    onChange: (v) => {
      // If disabled, cancel any scheduled rescan immediately.
      if (v === false) cancelScheduledRescan();
      else requestRescan("setting.enabled");
    },
  });
}

function isSkipPort(port) {
  const name = String(port?.name || "").toLowerCase();
  return SKIP_PORT_NAMES.has(name);
}

function getLink(graph, linkId) {
  const links = graph?.links;
  return links ? links[linkId] : null;
}

function autoBypassAKPipe(node, graph) {
  if (!node || !graph) return false;

  let sawAny = false;

  // INPUTS
  const inputs = node.inputs;
  if (inputs) {
    for (let i = 0; i < inputs.length; i++) {
      const inp = inputs[i];
      if (!inp) continue;

      if (isSkipPort(inp)) continue;

      const linkId = inp.link;
      if (linkId == null) continue;

      const link = getLink(graph, linkId);
      if (!link) continue;

      const other = graph.getNodeById(link.origin_id);
      if (!other) continue;

      sawAny = true;

      if (other.mode === MODE_ALWAYS) {
        if (node.mode !== MODE_ALWAYS) {
          node.mode = MODE_ALWAYS;
          node.setDirtyCanvas?.(true, true);
          return true;
        }
        return false;
      }
    }
  }

  // OUTPUTS
  const outputs = node.outputs;
  if (outputs) {
    for (let o = 0; o < outputs.length; o++) {
      const outp = outputs[o];
      if (!outp) continue;

      if (isSkipPort(outp)) continue;

      const linksArr = outp.links;
      if (!linksArr || linksArr.length === 0) continue;

      for (let j = 0; j < linksArr.length; j++) {
        const linkId = linksArr[j];
        if (linkId == null) continue;

        const link = getLink(graph, linkId);
        if (!link) continue;

        const other = graph.getNodeById(link.target_id);
        if (!other) continue;

        sawAny = true;

        if (other.mode === MODE_ALWAYS) {
          if (node.mode !== MODE_ALWAYS) {
            node.mode = MODE_ALWAYS;
            node.setDirtyCanvas?.(true, true);
            return true;
          }
          return false;
        }
      }
    }
  }

  if (!sawAny) return false;

  if (node.mode !== MODE_BYPASS) {
    node.mode = MODE_BYPASS;
    node.setDirtyCanvas?.(true, true);
    return true;
  }

  return false;
}

function scanAllAKPipes(graph) {
  if (!isEnabled()) return false;

  const nodes = graph?._nodes;
  if (!nodes) return false;

  let changed = false;

  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    const type = String(n?.type || "");
    const title = String(n?.title || "");
    if (type === "AK Pipe" || title === "AK Pipe") {
      if (autoBypassAKPipe(n, graph)) changed = true;
    }
  }

  return changed;
}

let _rescanQueuedReason = "";
let _rescanTimer = null;

function cancelScheduledRescan() {
  if (_rescanTimer != null) {
    clearTimeout(_rescanTimer);
    _rescanTimer = null;
  }
  _rescanQueuedReason = "";
}

function requestRescan(reason) {
  if (!isEnabled()) return;

  _rescanQueuedReason = reason;

  if (_rescanTimer != null) return;

  // Use macrotask so node toolbar/menu click handlers can update node.mode first.
  _rescanTimer = setTimeout(() => {
    _rescanTimer = null;

    if (!isEnabled()) return;

    const changed = scanAllAKPipes(app.graph);
    if (changed) {
      app.canvas?.setDirty?.(true, true);
      app.graph?.setDirtyCanvas?.(true, true);
    }
    _rescanQueuedReason = "";
  }, 0);
}

function shouldIgnoreGlobalEventTarget(t) {
  const tag = String(t?.tagName || "").toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") return true;
  if (t?.isContentEditable) return true;
  return false;
}

function installCanvasDomHooks() {
  const el = app?.canvas?.canvas; // HTMLCanvasElement
  if (!el) return;
  if (el.__ak_pipe_autobypass_dompatched) return;
  el.__ak_pipe_autobypass_dompatched = true;

  const onClick = () => {
    if (!isEnabled()) return;
    requestRescan("canvas.dom.click");
  };

  // Keep click (single trigger) and keep capture to be consistent; rescan is delayed anyway.
  el.addEventListener("click", onClick, true);
}

function installGlobalDomHooks() {
  if (document.__ak_pipe_autobypass_globalpatched) return;
  document.__ak_pipe_autobypass_globalpatched = true;

  const handler = (ev) => {
    if (!isEnabled()) return;

    const t = ev?.target;
    if (shouldIgnoreGlobalEventTarget(t)) return;

    const canvasEl = app?.canvas?.canvas;
    if (canvasEl && (t === canvasEl || (t && canvasEl.contains?.(t)))) return;

    requestRescan("global.dom.click");
  };

  // Keep click (single trigger) and keep capture; rescan is delayed anyway.
  document.addEventListener("click", handler, true);
}

app.registerExtension({
  name: "AK.AKPipe.AutoBypass",
  setup() {
    // Settings first
    tryInstallSetting();

    const g = app.graph;

    const origOnConn = g.onConnectionChange;
    g.onConnectionChange = function (...args) {
      const r = origOnConn ? origOnConn.apply(this, args) : undefined;
      if (isEnabled()) requestRescan("connectionChange");
      return r;
    };

    setTimeout(() => {
      if (isEnabled()) requestRescan("initialLoad");
    }, 0);

    const origConfigure = app.graph.configure;
    if (typeof origConfigure === "function") {
      app.graph.configure = function (...args) {
        const r = origConfigure.apply(this, args);
        setTimeout(() => {
          if (isEnabled()) requestRescan("graph.configure");
        }, 0);
        return r;
      };
    }

    setTimeout(() => installCanvasDomHooks(), 0);
    setTimeout(() => installGlobalDomHooks(), 0);
  },
});
