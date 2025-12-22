import { app } from "../../../scripts/app.js";

const _akCallCount = Object.create(null);
function _akCount(name, every = 50) {
  const n = (_akCallCount[name] = (_akCallCount[name] || 0) + 1);
  if (n === 1 || (every > 0 && (n % every) === 0)) {
    console.warn(`[AK][Count] ${name} called ${n} times`);
  }
  return n;
}

const getWidget = (node, name) => node?.widgets?.find(w => w?.name === name) || null;

let _akVarChangedName = null;

function _setChangedName(oldName, newName, setterId) {
  _akVarChangedName = { old: oldName || "", new: newName || "", setter_id: setterId, t: Date.now() };
  return _akVarChangedName;
}

// function _clearChangedNameLater(token) {
//   try {
//     setTimeout(() => {
//       if (_akVarChangedName === token) _akVarChangedName = null;
//     }, 0);
//   } catch (_) { }
// }

function _isGetterNode(node) {
  return node?.type === "Getter" || node?.comfyClass === "Getter";
}

function _isSetterNode(node) {
  return node?.type === "Setter" || node?.comfyClass === "Setter";
}


function _readNodeVarName(node) {
  try {
    const w = getWidget(node, "var_name");
    const v = (typeof w?.value === "string") ? w.value.trim() : "";
    if (v) return v;
  } catch (_) { }

  try {
    const p = (typeof node?.properties?.var_name === "string") ? node.properties.var_name.trim() : "";
    if (p) return p;
  } catch (_) { }

  return "";
}

function _syncNodeTitleToVarName(node) {
  const v = _readNodeVarName(node);
  if (!v) return;
  let prefix = "";
  if (_isSetterNode(node)) prefix = "🔽 "; else if (_isGetterNode(node)) prefix = "🔼 ";
  const newTitle = prefix + v;
  if (node.title !== newTitle) { node.title = newTitle; }
}

function _colorizeSetterGetterNodes(node, type = "Setter") {
  if (type === "Setter") {
    node.color = "#333355";       // blue
    node.bgcolor = "#222233";
  } else {
    node.color = "#335533";       // green
    node.bgcolor = "#223322";
  }
}


function collectSetterNames(graph) {
  const nodes = graph?._nodes;
  if (!nodes) return [];
  const arr = [];
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    if (!n || n.type !== "Setter") continue;
    const v = _readNodeVarName(n);
    if (v) arr.push(v);
  }
  arr.sort((a, b) => a.localeCompare(b));
  const uniq = [];
  let prev = null;
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] !== prev) uniq.push(arr[i]);
    prev = arr[i];
  }
  return uniq;
}

let _lastKey = "";
let _lastNames = [];

let _akUpdateCombosTimer = null;
let _akUpdateCombosForce = false;

function scheduleUpdateCombos(force = false) {
  if (force) _akUpdateCombosForce = true;
  if (_akUpdateCombosTimer) return;

  _akUpdateCombosTimer = setTimeout(() => {
    _akUpdateCombosTimer = null;
    const f = _akUpdateCombosForce;
    _akUpdateCombosForce = false;
    try {
      updateCombos(app.graph, f);
    } catch (e) {
      console.warn("[AK] scheduleUpdateCombos failed:", e);
    }
  }, 0);
}

function keyOf(names) {
  if (!names || !names.length) return "";
  return names.join("\u0001");
}

function ensureVarNameWidget(node, vals) {
  if (!node) return null;

  const values = Array.isArray(vals) ? vals : [];
  let w = getWidget(node, "var_name");

  if (!w || w.type !== "combo") {
    if (node.widgets?.length) {
      node.widgets = node.widgets.filter(x => !(x && x.name === "var_name"));
    }

    const curProp = (typeof node.properties?.var_name === "string") ? node.properties.var_name : "";
    const initial = curProp || (values.length ? values[0] : "");

    w = node.addWidget(
      "combo",
      "var_name",
      initial,
      (v) => {
        try { node.properties = node.properties || {}; node.properties.var_name = v; } catch (_) { }
        try { ensureGetterLinkedToSetter(node); } catch (_) { }
      },
      { values }
    );

    w._akVarInjected = true;

    try { node.properties = node.properties || {}; node.properties.var_name = w.value; } catch (_) { }
  }

  w.options = w.options || {};
  w.options.values = values;

  // восстановить выбранное
  try {
    const saved = (typeof node.properties?.var_name === "string") ? node.properties.var_name.trim() : "";
    if (saved && w.value !== saved) w.value = saved;
    if (!saved && !w.value && values.length) w.value = values[0];
    node.properties = node.properties || {};
    node.properties.var_name = w.value;
  } catch (_) { }

  return w;
}


function applyNamesToNode(node, names) {
  _akCount("applyNamesToNode", 200);
  if (node._akApplyNamesBusy) return;
  node._akApplyNamesBusy = true;
  try {

    if (!node) return;
    const vals = names || [];

    const newKey = vals.length ? vals.join("\u0001") : "";
    const prevKey = node._akVarValsKey || "";
    const prevSel = node._akVarSel || "";

    // If dropdown values haven't changed and selection didn't change, do nothing.
    // This avoids redraw/callback loops.
    const w0 = getWidget(node, "var_name");
    const curSel0 = (typeof w0?.value === "string") ? w0.value : "";

    if (prevKey === newKey && prevSel === curSel0) {
      return;
    }

    // console.log("[AK] applyNamesToNode: updating combo for node", node.id, "prevKey:", prevKey, "newKey:", newKey, "prevSel:", prevSel, "curSel:", curSel0);

    // If dropdown is created before setters are hooked, values can be empty on first paint.
    // Request a combo refresh once (async) without creating a sync recursion loop.
    if ((!vals || !vals.length) && !globalThis._akVarNamesRefreshQueued) {
      console.warn("[AK] applyNamesToNode: empty values, scheduling updateCombos refresh");
      globalThis._akVarNamesRefreshQueued = true;
      // try { setTimeout(() => { try { updateCombos(app.graph, true); } catch (_) { } }, 0); } catch (_) { }
      // try { setTimeout(() => { try { updateCombos(app.graph, true); } catch (_) { } }, 100); } catch (_) { }
      // try { setTimeout(() => { try { scheduleUpdateCombos(true); } catch (_) { } }, 100); } catch (_) { }
    }
    // We keep var_name as hidden STRING in Python, so we must render dropdown in JS.
    let w = getWidget(node, "var_name");

    // if (!w || w.type !== "combo") {
    //   console.log("[AK] applyNamesToNode: injecting combo widget for node", node.id);
    //   try {
    //     if (node.widgets && node.widgets.length) {
    //       node.widgets = node.widgets.filter(x => !(x && x.name === "var_name"));
    //     }

    //     const curProp = (typeof node.properties?.var_name === "string") ? node.properties.var_name : "";
    //     const initial = curProp || (vals.length ? vals[0] : "");

    //     w = node.addWidget(
    //       "combo",
    //       "var_name",
    //       initial,
    //       function (v) {
    //         try {
    //           if (!node.properties) node.properties = {};
    //           node.properties.var_name = v;
    //         } catch (_) { }
    //         // try { ensureGetterLinkedToSetter(node); } catch (_) { }
    //       },
    //       { values: vals }
    //     );

    //     w._akVarInjected = true;

    //     try {
    //       if (!node.properties) node.properties = {};
    //       node.properties.var_name = w.value;
    //     } catch (_) { }
    //   } catch (_) {
    //     return;
    //   }
    // }

    if (!w.options) w.options = {};
    w.options.values = vals;

    try {
      const prevKey = node._akVarValsKey || "";
      const newKey = vals.length ? vals.join("\u0001") : "";
      const curSel = (typeof w.value === "string") ? w.value : "";
      const prevSel = (typeof node._akVarSel === "string") ? node._akVarSel : "";

      if (prevKey === newKey && prevSel === curSel) {
        return;
      }

      node._akVarValsKey = newKey;
      node._akVarSel = curSel;
    } catch (_) { }

    try { _applyChangedNameIfNeeded(node); } catch (_) { }

    const cur = (typeof w.value === "string") ? w.value : "";

    const saved = (() => {
      try {
        const p = (typeof node.properties?.var_name === "string") ? node.properties.var_name : "";
        if (p && p.trim()) return p.trim();
      } catch (_) { }
      return "";
    })();

    if (saved) {
      if (cur !== saved) {
        w._akSilent = true;
        w.value = saved;
        w._akSilent = false;
      }
    } else if (!cur) {
      if (vals.length) {
        w._akSilent = true;
        w.value = vals[0];
        w._akSilent = false;
      }
    }

    try {
      if (!node.properties) node.properties = {};
      node.properties.var_name = w.value;
    } catch (_) { }

    node._akVarValsKey = newKey;
    node._akVarSel = (typeof w.value === "string") ? w.value : "";


    try { _updateGetterOutputName(node); } catch (_) { }
    try { ensureGetterLinkedToSetter(node); } catch (_) { }
    // try { _syncNodeTitleToVarName(node); } catch (_) { }
  } finally {
    node._akApplyNamesBusy = false;
  }
}

function updateCombos(graph, force = false) {
  _akCount("updateCombos", 200);
  const names = collectSetterNames(graph);
  const k = keyOf(names);
  if (!force && k === _lastKey) return;

  _lastKey = k;
  _lastNames = names;

  const nodes = graph?._nodes || [];
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    if (!n) continue;
    if (n.type !== "Getter" && n.type !== "Overrider") continue;
    applyNamesToNode(n, names);
    ensureVarNameWidget(n, names);
  }

  // app.canvas?.setDirty(true, true);
}

function hookSetter(node, context = "") {
  // if (!node || node._akVarSetterHooked) return;
  // node._akVarSetterHooked = true;

  _disableVarNameInputConnections(node);

  const w = getWidget(node, "var_name");
  // if (!w || w._akVarHooked) return;
  w._akVarHooked = true;

  w._akPrev = (typeof w.value === "string") ? w.value : "";


  // try { _syncNodeTitleToVarName(node); } catch (_) { }

  const prevCb = w.callback;
  w.callback = function (v) {
    // w._akPrev = (typeof w.value === "string") ? w.value : "";

    const r = prevCb ? prevCb.call(this, v) : undefined;

    const nv = (typeof w.value === "string") ? w.value : "";
    if (nv !== w._akPrev) {
      const ov = w._akPrev;
      w._akPrev = nv;
      // const token = _setChangedName(ov, nv, node.id);
      const sid = (typeof node.id === "number" && node.id >= 0) ? node.id : null;
      // const token = (sid != null) ? _setChangedName(ov, nv, sid) : null;
      const token = _setChangedName(ov, nv, node.id);

      // try { updateCombos(app.graph, true); } catch (_) { }

      // try { scheduleUpdateCombos(true); } catch (_) { }
      try { updateCombos(app.graph, true); } catch (_) { }
      try { _syncNodeTitleToVarName(node); } catch (_) { }
      // try { _colorizeSetterGetterNodes(node); } catch (_) { }
      // if (token) _clearChangedNameLater(token);
      // _clearChangedNameLater(token);
      // try { applyNamesToNode(node, _lastNames); } catch (_) { }
    }

    return r;
  };
}

function _disableVarNameInputConnections(node) {
  try {
    if (node._akVarVarNameTypePatched) return;
    if (!_isSetterNode(node)) return;
    node._akVarVarNameTypePatched = true;

    const inIdx = _findSlotIndexByName(node.inputs, "var_name");
    if (inIdx < 0) return;

    const inp = node.inputs[inIdx];
    if (!inp) return;

    inp.type = "__AK_VAR_NAME__";

    // if (inp.link != null) node.disconnectInput(inIdx);
  } catch (_) { }
}


function initGetter(node) {
  if (!node || node._akVarComboInit) return;
  node._akVarComboInit = true;
  try { applyNamesToNode(node, _lastNames); } catch (_) { }
}

const _findSlotIndexByName = (arr, name) =>
  arr?.findIndex(s => s?.name === name) ?? -1;

function _trimStr(v) {
  return (typeof v === "string") ? v.trim() : "";
}



function _updateGetterOutputName(getterNode) {
  if (!getterNode || !Array.isArray(getterNode.outputs) || getterNode.outputs.length < 1) return;

  let varName = "";
  try { varName = getterNode.properties?.var_name || ""; } catch (_) { }

  const out0 = getterNode.outputs[0];
  if (!out0) return;

  const newName = (typeof varName === "string" && varName.trim()) ? varName.trim() : "OBJ";

  if (out0.name === newName && (out0.label === undefined || out0.label === newName)) {
    return;
  }

  out0.name = newName;
  out0.label = newName;

  try {
    if (typeof getterNode.setSize === "function" && typeof getterNode.computeSize === "function") {
      const sz = getterNode.computeSize();
      if (sz && sz[0] && sz[1]) getterNode.setSize(sz);
    }
  } catch (_) { }

  // try {
  //   if (globalThis.app?.graph?.setDirtyCanvas) globalThis.app.graph.setDirtyCanvas(true, true);
  //   if (globalThis.app?.canvas?.setDirty) globalThis.app.canvas.setDirty(true, true);
  // } catch (_) { }
}

function _applyChangedNameIfNeeded(getterNode) {
  const ch = _akVarChangedName;
  if (!ch) return false;
  if (!getterNode || getterNode.type !== "Getter") return false;

  const g = app.graph;
  if (!g) return false;

  const inpIdx = _findSlotIndexByName(getterNode.inputs, "inp");
  if (inpIdx < 0) return false;

  const linkId = getterNode.inputs?.[inpIdx]?.link;
  if (linkId == null || !g.links || !g.links[linkId]) return false;

  const l = g.links[linkId];
  if (l.origin_id !== ch.setter_id) return false;

  const cur = _trimStr((typeof getterNode.properties?.var_name === "string") ? getterNode.properties.var_name : (getWidget(getterNode, "var_name")?.value));
  if (!cur || cur !== ch.old) return false;

  try {
    const w = getWidget(getterNode, "var_name");
    if (w) w.value = ch.new;
    try { w.callback?.(ch.new); } catch (_) { }
  } catch (_) { }

  try {
    if (!getterNode.properties) getterNode.properties = {};
    getterNode.properties.var_name = ch.new;
    try { app.graph?.change?.(); } catch (_) { }
    try { app.graph?.setDirtyCanvas?.(true, true); } catch (_) { }

  } catch (_) { }
  // try { _clearChangedNameLater(ch); } catch (_) { }
  return true;
}

function _findFirstSetterByVarName(graph, varName) {
  const nodes = graph?._nodes || [];
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    if (!n || n.type !== "Setter") continue;
    const w = getWidget(n, "var_name");
    const v = _trimStr(w?.value);
    if (v && v === varName) return n;
  }
  return null;
}

function _hideLinkInGraph(graph, linkId) {
  if (!graph || linkId == null) return;
  const links = graph.links;
  if (!links) return;
  const link = links[linkId];
  if (link) link._ak_hide = true;
}

let _akLinksHideInstalled = false;

function _installHideLinksPatch() {

  // if (_akLinksHideInstalled) return;

  const CanvasProto =
    (globalThis.LGraphCanvas && globalThis.LGraphCanvas.prototype) ||
    (globalThis.LiteGraph && globalThis.LiteGraph.LGraphCanvas && globalThis.LiteGraph.LGraphCanvas.prototype);

  if (!CanvasProto) return;

  _akLinksHideInstalled = true;

  function _isHiddenLink(graph, linkId, getterNodeId) {
    const l = graph?.links?.[linkId];
    if (!l) return false;
    const a = graph.getNodeById(l.origin_id);
    const b = graph.getNodeById(getterNodeId); // Because there is no target_id when we just create node.
    if (!a || !b) return false;
    if (!_isSetterNode(a) || !_isGetterNode(b)) return false;
    l.target_id = getterNodeId;
    const outName = a.outputs?.[l.origin_slot]?.name;
    const inName = b.inputs?.[l.target_slot]?.name;
    return outName === "OUT" && inName === "inp";
  }

  function _withHiddenLinksDisconnected(canvas, fn) {
    const g = canvas?.graph;
    if (!g) return fn();

    const nodes = g._nodes || [];
    const saved = [];
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      if (!n || !_isGetterNode(n)) continue;
      const inputs = n.inputs || [];
      // for (let j = 0; j < inputs.length; j++) {
        const inp = inputs[0];
        if (!inp || inp.name !== "inp") continue;
        const linkId = inp.link;
        if (linkId == null) continue;
        if (_isHiddenLink(g, linkId, n.id)) {
          saved.push([n, 0, linkId]);
          inp.link = null;
        }
      // }
    }

    const r = fn();

    for (let k = 0; k < saved.length; k++) {
      const [node, slotIdx, linkId] = saved[k];
      try {
        if (node?.inputs?.[slotIdx]) node.inputs[slotIdx].link = linkId;
      } catch (_) { }
    }

    return r;
  }

  if (!CanvasProto._akHideDrawPatched && typeof CanvasProto.draw === "function") {
    CanvasProto._akHideDrawPatched = true;
    const origDraw = CanvasProto.draw;
    CanvasProto.draw = function (...args) {
      return _withHiddenLinksDisconnected(this, () => origDraw.apply(this, args));
    };
  }
}


function _installHideSocketsPatch() {
  _akCount("_installHideSocketsPatch", 2000);

  const CanvasProto =
    (globalThis.LGraphCanvas && globalThis.LGraphCanvas.prototype) ||
    (globalThis.LiteGraph && globalThis.LiteGraph.LGraphCanvas && globalThis.LiteGraph.LGraphCanvas.prototype);

  if (!CanvasProto) {
    _akHideSocketsRetry++;
    if (_akHideSocketsRetry === 1 || (_akHideSocketsRetry % 20) === 0) {
      console.warn(`[AK] HideSockets: CanvasProto not ready (retry ${_akHideSocketsRetry})`);
    }
    if (_akHideSocketsRetry >= 200) {
      console.error("[AK] HideSockets: giving up after 200 retries. drawNode patch NOT installed.");
      return;
    }
    setTimeout(_installHideSocketsPatch, 50);
    return;
  }
  if (CanvasProto._akHideSocketsDrawNodePatched) return;

  const origDrawNode = CanvasProto.drawNode;
  if (typeof origDrawNode !== "function") return;

  CanvasProto._akHideSocketsDrawNodePatched = true;

  CanvasProto.drawNode = function (node, ctx, ...rest) {
    let savedInputs = null;
    let savedOutputs = null;

    try {
      if (_isGetterNode(node) && Array.isArray(node.inputs) && node.inputs.length) {
        savedInputs = node.inputs;
        node.inputs = savedInputs.filter(s => !(s && s.name === "inp"));
      }

      if (_isSetterNode(node) && Array.isArray(node.outputs) && node.outputs.length) {
        savedOutputs = node.outputs;
        node.outputs = savedOutputs.filter(s => !(s && s.name === "OUT"));
      }

      return origDrawNode.call(this, node, ctx, ...rest);
    } finally {
      if (savedInputs) node.inputs = savedInputs;
      if (savedOutputs) node.outputs = savedOutputs;
    }
  };
  try { _installHideLinksPatch(); } catch (_) { }
}


function ensureGetterLinkedToSetter(node) {
  try {
    if (!_isGetterNode(node)) return;

    const g = app.graph;
    if (!g) return;

    const varName = _trimStr((typeof node.properties?.var_name === "string") ? node.properties.var_name : (getWidget(node, "var_name")?.value));
    if (!varName) return;

    const setter = _findFirstSetterByVarName(g, varName);
    if (!setter) return;

    const outIdx = _findSlotIndexByName(setter.outputs, "OUT");
    const inIdx = _findSlotIndexByName(node.inputs, "inp");
    if (outIdx < 0 || inIdx < 0) return;

    const inSlot = node.inputs[inIdx];
    const existingLinkId = inSlot ? inSlot.link : null;

    if (existingLinkId != null && g.links && g.links[existingLinkId]) {
      const l = g.links[existingLinkId];
      const fromNode = g.getNodeById(l.origin_id);
      if (fromNode && fromNode.id === setter.id && l.origin_slot === outIdx) {
        _hideLinkInGraph(g, existingLinkId);
        return;
      }
    }

    if (typeof node.disconnectInput === "function") {
      try { node.disconnectInput(inIdx); } catch (_) { }
    }

    if (typeof setter.connect === "function") {
      setter.connect(outIdx, node, inIdx);
    } else if (typeof node.connect === "function") {
      node.connect(inIdx, setter, outIdx);
    }

    const linkId = node.inputs[inIdx]?.link ?? null;

    _hideLinkInGraph(g, linkId);
  } catch (_) { }
}

function hookGetter(node, context = "") {

  // if (!node || node._akVarGetterHooked) return;
  if (node) {
    node._akVarGetterHooked = true;
  }

  // Ensure dropdown exists (hidden var_name in backend)

  const w = getWidget(node, "var_name");

  // if (!w || w._akVarGetterWidgetHooked) return;
  if (w) {
    w._akVarGetterWidgetHooked = true;
    const prevCb = w.callback;
    w.callback = function (v) {
      const r = prevCb ? prevCb.call(this, v) : undefined;
      try {
        if (!node.properties) node.properties = {};
        node.properties.var_name = w.value;
      } catch (_) { }
      try { applyNamesToNode(node, _lastNames); } catch (_) { }
      try { ensureGetterLinkedToSetter(node); } catch (_) { }
      // try { _updateGetterOutputName(node); } catch (_) { }
      try { _syncNodeTitleToVarName(node); } catch (_) { }
      // try { _colorizeSetterGetterNodes(node); } catch (_) { }
      return r;
    };
  }

}

app.registerExtension({
  name: "AK.VarNodes.ComboSync",

  async nodeCreated(node) {
    if (!node) return;

    if (_isSetterNode(node)) {
      try { hookSetter(node, "nodeCreated"); } catch (_) { }
      try { scheduleUpdateCombos(true); } catch (_) { }
      try { _colorizeSetterGetterNodes(node, "Setter"); } catch (_) { }
      // _installHideSocketsPatch();
      // try { _syncNodeTitleToVarName(node); } catch (_) { }
      // try { _colorizeSetterGetterNodes(node); } catch (_) { }
      // try { updateCombos(app.graph, false); } catch (_) { }

      // try { _colorizeSetterGetterNodes(node, "Setter"); } catch (_) { }
    }

    if (_isGetterNode(node)) {
      const names = collectSetterNames(app.graph);
      ensureVarNameWidget(node, names);
      try { initGetter(node); } catch (_) { }
      try { hookGetter(node, "nodeCreated"); } catch (_) { }
      try { _syncNodeTitleToVarName(node); } catch (_) { }
      try { ensureGetterLinkedToSetter(node); } catch (_) { }
      try { _colorizeSetterGetterNodes(node, "Getter"); } catch (_) { }
      // try { _installHideSocketsPatch(); } catch (_) { }
      // try { _syncNodeTitleToVarName(node); } catch (_) { }
      // try { updateCombos(app.graph); } catch (_) { }
      // try { scheduleUpdateCombos(true); } catch (_) { }

    }
    // try { _installHideLinksPatch(); } catch (_) { }

  },

  async afterConfigureGraph() {
    const nodes = app.graph?._nodes || [];
    const names = collectSetterNames(app.graph);

    for (const node of nodes) {
      if (_isSetterNode(node)) {

        hookSetter(node, "afterConfigureGraph");
        // try { _installHideSocketsPatch(); } catch (_) { }
        try { _syncNodeTitleToVarName(node); } catch (_) { }
        try { _colorizeSetterGetterNodes(node, "Setter"); } catch (_) { }
        try { _installHideSocketsPatch(); } catch (_) { }

      }

      if (_isGetterNode(node)) {
        ensureVarNameWidget(node, names);
        initGetter(node);
        hookGetter(node, "afterConfigureGraph");
        try { ensureGetterLinkedToSetter(node); } catch (_) { }
        try { _syncNodeTitleToVarName(node); } catch (_) { }
        try { _colorizeSetterGetterNodes(node, "Getter"); } catch (_) { }
        try { _installHideSocketsPatch(); } catch (_) { }
      }
    }
    scheduleUpdateCombos(true);

  }

});
