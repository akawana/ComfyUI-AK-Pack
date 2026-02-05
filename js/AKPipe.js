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

function modeName(m) {
  if (m === MODE_ALWAYS) return "ALWAYS(0)";
  if (m === MODE_MUTE) return "MUTED(2)";
  if (m === MODE_BYPASS) return "BYPASSED(4)";
  return String(m);
}

function nodeLabel(n) {
  if (!n) return "<null node>";
  const t = String(n.title || n.type || "Node");
  return `${t}#${n.id}`;
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

  const self = nodeLabel(node);

  let sawAny = false;

  // INPUTS
  const inputs = node.inputs;
  if (inputs) {
    for (let i = 0; i < inputs.length; i++) {
      const inp = inputs[i];
      if (!inp) continue;

      const name = String(inp.name || "");
      if (isSkipPort(inp)) {
        continue;
      }

      const linkId = inp.link;
      if (linkId == null) {
        continue;
      }

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

      const name = String(outp.name || "");
      if (isSkipPort(outp)) {
        continue;
      }

      const linksArr = outp.links;
      if (!linksArr || linksArr.length === 0) {
        continue;
      }

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

  if (!sawAny) {
    return false;
  }

  if (node.mode !== MODE_BYPASS) {
    node.mode = MODE_BYPASS;
    node.setDirtyCanvas?.(true, true);
    return true;
  }

  return false;
}

function scanAllAKPipes(graph) {
  const nodes = graph?._nodes;
  if (!nodes) return false;

  let changed = false;
  let count = 0;

  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    const type = String(n?.type || "");
    const title = String(n?.title || "");
    if (type === "AK Pipe" || title === "AK Pipe") {
      count++;
      if (autoBypassAKPipe(n, graph)) changed = true;
    }
  }

  return changed;
}

let _rescanQueued = false;
let _rescanQueuedReason = "";
function requestRescan(reason) {
  _rescanQueuedReason = reason;

  if (_rescanQueued) return;
  _rescanQueued = true;

  // Use macrotask so node toolbar/menu click handlers can update node.mode first.
  setTimeout(() => {
    _rescanQueued = false;

    const r = _rescanQueuedReason || reason;
    _rescanQueuedReason = "";

    const changed = scanAllAKPipes(app.graph);
    if (changed) {
      app.canvas?.setDirty?.(true, true);
      app.graph?.setDirtyCanvas?.(true, true);
    }
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
  if (!el) {
    return;
  }
  if (el.__ak_pipe_autobypass_dompatched) return;
  el.__ak_pipe_autobypass_dompatched = true;

  const onClick = () => {
    requestRescan("canvas.dom.click");
  };

  // Keep click (single trigger) and keep capture to be consistent; rescan is delayed anyway.
  el.addEventListener("click", onClick, true);

}

function installGlobalDomHooks() {
  if (document.__ak_pipe_autobypass_globalpatched) return;
  document.__ak_pipe_autobypass_globalpatched = true;

  const handler = (ev) => {
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
    const g = app.graph;

    const origOnConn = g.onConnectionChange;
    g.onConnectionChange = function (...args) {
      const r = origOnConn ? origOnConn.apply(this, args) : undefined;
      requestRescan("connectionChange");
      return r;
    };

    setTimeout(() => requestRescan("initialLoad"), 0);

    const origConfigure = app.graph.configure;
    if (typeof origConfigure === "function") {
      app.graph.configure = function (...args) {
        const r = origConfigure.apply(this, args);
        setTimeout(() => requestRescan("graph.configure"), 0);
        return r;
      };
    }

    setTimeout(() => installCanvasDomHooks(), 0);
    setTimeout(() => installGlobalDomHooks(), 0);

  },
});
