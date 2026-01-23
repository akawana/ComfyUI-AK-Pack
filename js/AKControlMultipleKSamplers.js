
import { app } from "/scripts/app.js";

const EXT_ID = "ak.control_multiple_ksamplers";

function splitTargets(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return [];
  return s.split(",").map(t => t.trim()).filter(Boolean);
}

function isNumericToken(t) {
  return /^-?\d+$/.test(t);
}

function findWidget(node, name) {
  return node?.widgets?.find(w => w?.name === name) || null;
}

function findWidgetByAnyName(node, names) {
  for (const n of names) {
    const w = findWidget(node, n);
    if (w) return w;
  }
  return null;
}


function markDirty(node) {
  try { node?.graph?.setDirtyCanvas(true, true); } catch (_) {}
  try { node?.setDirtyCanvas?.(true, true); } catch (_) {}
}

function setWidgetValueByAnyName(targetNode, names, value) {
  const w = findWidgetByAnyName(targetNode, names);
  if (!w) return false;

  w.value = value;

  if (typeof w.callback === "function") {
    try { w.callback(value); } catch (_) {}
  }
  if (typeof targetNode.onWidgetChanged === "function") {
    try { targetNode.onWidgetChanged(w, value); } catch (_) {}
  }

  markDirty(targetNode);
  return true;
}

function coerceInt(v, fallback = 0) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.floor(n));
}

function coerceFloat(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function getNodeTitleOrType(n) {
  const title = String(n?.title || "").trim();
  if (title) return title;
  return String(n?.type || "").trim();
}

function getNodeDisplayName(n) {
  const label = getNodeTitleOrType(n) || "Node";
  return `${label} #${n.id}`;
}

function isKSamplerLike(n) {
  const t = String(n?.type || "");
  return t === "KSampler" || t.startsWith("KSampler");
}

function pickTargets(graph, tokens) {
  const nodes = graph?._nodes || [];
  const byId = new Map(nodes.map(n => [String(n.id), n]));
  const picked = [];
  const seen = new Set();

  // If tokens empty -> default: all KSampler-like
  if (!tokens.length) {
    for (const n of nodes) {
      if (!isKSamplerLike(n)) continue;
      const key = String(n.id);
      if (seen.has(key)) continue;
      seen.add(key);
      picked.push(n);
    }
    return picked;
  }

  for (const tok of tokens) {
    if (isNumericToken(tok)) {
      const id = String(parseInt(tok, 10));
      const n = byId.get(id);
      if (n) {
        const key = String(n.id);
        if (!seen.has(key)) {
          seen.add(key);
          picked.push(n);
        }
      }
      continue;
    }

    const needle = tok.toLowerCase();
    for (const n of nodes) {
      const title = String(n?.title || "").toLowerCase();
      const type = String(n?.type || "").toLowerCase();

      // substring match in title OR type (case-insensitive)
      if ((title.includes(needle) || type.includes(needle))) {
        const key = String(n.id);
        if (seen.has(key)) continue;
        seen.add(key);
        picked.push(n);
      }
    }
  }

  // Most users want to control KSamplers; if substring matched too broad,
  // you can still filter via node_list tokens, but we keep it as requested.
  return picked;
}

function parseState(ctrl) {
  const w = findWidget(ctrl, "_ak_state_json");
  const raw = String(w?.value || "{}");
  try {
    const obj = JSON.parse(raw);
    return (obj && typeof obj === "object") ? obj : {};
  } catch {
    return {};
  }
}

function writeState(ctrl, state) {
  const w = findWidget(ctrl, "_ak_state_json");
  if (!w) return;
  w.value = JSON.stringify(state);
  try { w.callback?.(w.value); } catch (_) {}
  markDirty(ctrl);
}

function refreshChooseList(ctrl) {
  const graph = ctrl?.graph;
  if (!graph) return;

  const tokens = splitTargets(ctrl.properties?.node_list || "");
  const targets = pickTargets(graph, tokens)
    .filter(t => String(t.id) !== String(ctrl.id))
    .sort((a, b) => {
      const na = getNodeTitleOrType(a).toLowerCase();
      const nb = getNodeTitleOrType(b).toLowerCase();
      if (na < nb) return -1;
      if (na > nb) return 1;
      return a.id - b.id;
    });

  const chooseW = findWidget(ctrl, "choose_ksampler");
  if (!chooseW) return;

  const values = targets.length ? targets.map(getNodeDisplayName) : ["<none>"];
  chooseW.options = chooseW.options || {};
  chooseW.options.values = values;

  if (!values.includes(chooseW.value)) {
    chooseW.value = values[0];
    try { chooseW.callback?.(chooseW.value); } catch (_) {}
  }

  ctrl._ak_targets = targets;
  markDirty(ctrl);
}

function resolveSelected(ctrl) {
  const chooseW = findWidget(ctrl, "choose_ksampler");
  const val = String(chooseW?.value || "");
  const m = val.match(/#(\d+)\s*$/);
  if (!m) return null;
  const id = String(parseInt(m[1], 10));
  return (ctrl._ak_targets || []).find(n => String(n.id) === id) || null;
}

function syncFromTarget(ctrl, target) {
  if (!target) return;

  // Read from target widgets and set into control widgets
  const stepsW = findWidgetByAnyName(target, ["steps"]);

  const samplerW = findWidgetByAnyName(target, ["sampler_name"]);
  const schedulerW = findWidgetByAnyName(target, ["scheduler"]);
  const seedW = findWidgetByAnyName(target, ["seed", "noise_seed"]);
  const cfgW = findWidgetByAnyName(target, ["cfg", "cfg_scale"]);
  const denoiseW = findWidgetByAnyName(target, ["denoise"]);

  const setCtrl = (name, value) => {
    const w = findWidget(ctrl, name);
    if (!w) return;
    w.value = value;
    try { w.callback?.(w.value); } catch (_) {}
  };

  if (stepsW) setCtrl("steps", coerceInt(stepsW.value, 1));
  if (samplerW) setCtrl("sampler_name", samplerW.value);
  if (schedulerW) setCtrl("scheduler", schedulerW.value);
  if (seedW) setCtrl("seed ", coerceInt(seedW.value, 0));
  if (cfgW) setCtrl("cfg", coerceFloat(cfgW.value, 8.0));
  if (denoiseW) setCtrl("denoise", coerceFloat(denoiseW.value, 1.0));

  markDirty(ctrl);
}

function applyToTarget(ctrl, target) {
  if (!target) return;

  const steps = coerceInt(findWidget(ctrl, "steps")?.value, 1);

  const sampler = findWidget(ctrl, "sampler_name")?.value;
  const scheduler = findWidget(ctrl, "scheduler")?.value;
  const seed = coerceInt(findWidget(ctrl, "seed ")?.value, 0);
  const cfg = coerceFloat(findWidget(ctrl, "cfg")?.value, 8.0);
  const denoise = coerceFloat(findWidget(ctrl, "denoise")?.value, 1.0);

  setWidgetValueByAnyName(target, ["steps"], steps);
  setWidgetValueByAnyName(target, ["sampler_name"], sampler);
  setWidgetValueByAnyName(target, ["scheduler"], scheduler);

  // Support common variants:
  setWidgetValueByAnyName(target, ["seed", "noise_seed"], seed);
  setWidgetValueByAnyName(target, ["cfg", "cfg_scale"], cfg);
  setWidgetValueByAnyName(target, ["denoise"], denoise);

  // Persist per-target settings on the control node
  const state = parseState(ctrl);
  const idKey = String(target.id);
  state[idKey] = {
    steps,
    sampler_name: sampler,
    scheduler,
    seed,
    cfg,
    denoise,
    title: String(target.title || ""),
    type: String(target.type || ""),
    updated_at: Date.now()
  };
  writeState(ctrl, state);
}

function applyPersisted(ctrl) {
  const graph = ctrl?.graph;
  if (!graph) return;

  const state = parseState(ctrl);
  const nodes = graph._nodes || [];
  const byId = new Map(nodes.map(n => [String(n.id), n]));

  for (const [id, vals] of Object.entries(state)) {
    const target = byId.get(String(id));
    if (!target || !vals || typeof vals !== "object") continue;

    if ("steps" in vals) setWidgetValueByAnyName(target, ["steps"], coerceInt(vals.steps, 1));
    if ("sampler_name" in vals) setWidgetValueByAnyName(target, ["sampler_name"], vals.sampler_name);
    if ("scheduler" in vals) setWidgetValueByAnyName(target, ["scheduler"], vals.scheduler);
    if ("seed" in vals) setWidgetValueByAnyName(target, ["seed", "noise_seed"], coerceInt(vals.seed, 0));
    if ("cfg" in vals) setWidgetValueByAnyName(target, ["cfg", "cfg_scale"], coerceFloat(vals.cfg, 8.0));
    if ("denoise" in vals) setWidgetValueByAnyName(target, ["denoise"], coerceFloat(vals.denoise, 1.0));
  }
}

function hookCallbacks(ctrl) {
  const chooseW = findWidget(ctrl, "choose_ksampler");
  if (chooseW) {
    const old = chooseW.callback;
    chooseW.callback = (v) => {
      try { old?.(v); } catch (_) {}
      const t = resolveSelected(ctrl);
      if (t) syncFromTarget(ctrl, t);
    };
  }

  for (const k of ["steps", "sampler_name", "scheduler", "seed ", "cfg", "denoise"]) {
    const w = findWidget(ctrl, k);
    if (!w) continue;
    const old = w.callback;
    w.callback = (v) => {
      try { old?.(v); } catch (_) {}
      const t = resolveSelected(ctrl);
      if (t) applyToTarget(ctrl, t);
    };
  }
}

function installRefreshLoop() {
  if (app.__ak_control_multi_ksamplers_loop) return;
  app.__ak_control_multi_ksamplers_loop = true;

  setInterval(() => {
    const graph = app?.graph;
    if (!graph?._nodes) return;

    for (const n of graph._nodes) {
      if (!n || n.type !== "AK Control Multiple KSamplers") continue;

      const tokens = splitTargets(n.properties?.node_list || "");
      const sig = JSON.stringify(tokens);
      const nodeCount = graph._nodes.length;

      if (n._ak_sig !== sig || n._ak_cnt !== nodeCount) {
        n._ak_sig = sig;
        n._ak_cnt = nodeCount;
        refreshChooseList(n);
      }
    }
  }, 600);
}

function createSpacer(name, height = 12) {
  return {
    name,
    type: "hidden",
    value: "",
    serialize: false,
    computeSize: () => [0, height]
  };
}
app.registerExtension({
  name: EXT_ID,
  beforeRegisterNodeDef(nodeType, nodeData) {
    if (nodeData?.name !== "AK Control Multiple KSamplers") return;

    const origCreated = nodeType.prototype.onNodeCreated;
    nodeType.prototype.onNodeCreated = function () {
      origCreated?.apply(this, arguments);

      this.properties = this.properties || {};
      if (typeof this.properties.node_list !== "string" || !this.properties.node_list.trim()) {
        this.properties.node_list = "KSampler";
      }

      refreshChooseList(this);

      // spacer widget after choose_ksampler
      if (!this._ak_has_spacer) {
        this._ak_has_spacer = true;
        const spacer1 = createSpacer("_ak_spacer_1", 12);
        this.widgets.splice(0, 0, spacer1);
        const spacer2 = createSpacer("_ak_spacer_2", 12);
        const idx = this.widgets?.findIndex(w => w.name === "choose_ksampler");
        this.widgets.splice(idx + 1, 0, spacer2);

        if (idx !== -1) {
        } else {
          this.widgets.push(spacer);
        }
      }

      hookCallbacks(this);

      setTimeout(() => {
        try { applyPersisted(this); } catch (_) {}
        const t = resolveSelected(this);
        if (t) syncFromTarget(this, t);
      }, 0);

      installRefreshLoop();
    };

    const origConfigure = nodeType.prototype.onConfigure;
    nodeType.prototype.onConfigure = function () {
      origConfigure?.apply(this, arguments);

      this.properties = this.properties || {};
      if (typeof this.properties.node_list !== "string" || !this.properties.node_list.trim()) {
        this.properties.node_list = "KSampler";
      }

      refreshChooseList(this);
      hookCallbacks(this);

      setTimeout(() => {
        try { applyPersisted(this); } catch (_) {}
        const t = resolveSelected(this);
        if (t) syncFromTarget(this, t);
      }, 0);

      installRefreshLoop();
    };

    const origProp = nodeType.prototype.onPropertyChanged;
    nodeType.prototype.onPropertyChanged = function (name, value) {
      origProp?.apply(this, arguments);
      if (name === "node_list") refreshChooseList(this);
    };
  }
});
