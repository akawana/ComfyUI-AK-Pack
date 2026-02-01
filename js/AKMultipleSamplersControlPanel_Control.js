import { app } from "../../scripts/app.js";

const LABEL_FONT_SIZE_PX = 14;
const STORE_KEY = "ak_multiple_samplers_control_panel";

const DEBUG_LOGS = false;

const FIELD_SPECS = [
  { key: "seed", type: "number", step: 1 },
  { key: "steps", type: "number", step: 1 },
  { key: "cfg", type: "number", step: 0.1 },
  { key: "sampler_name", type: "select" },
  { key: "scheduler", type: "select" },
  { key: "denoise", type: "number", step: 0.01 },
];
const FIXED_2_DECIMALS_KEYS = new Set(["cfg", "denoise"]);

function decimalsFromStep(step) {
  const s = Number(step);
  if (!Number.isFinite(s) || s === 0) return 0;
  const txt = String(s);
  const idx = txt.indexOf(".");
  if (idx < 0) return 0;
  return Math.min(10, txt.length - idx - 1);
}

function decimalsForKey(key, step) {
  if (FIXED_2_DECIMALS_KEYS.has(String(key))) return 2;
  return decimalsFromStep(step);
}

function formatNumberForKey(key, num, step) {
  const n = Number(num);
  if (!Number.isFinite(n)) return String(num ?? "");
  const d = decimalsForKey(key, step);
  if (d > 0) return n.toFixed(d);
  return String(Math.trunc(n));
}



function sanitizeCfgStep(st) {
  const v = Number(st?.cfg_step);
  return Number.isFinite(v) && v > 0 ? v : 0.5;
}

function sanitizeDenoiseStep(st) {
  const v = Number(st?.denoise_step);
  return Number.isFinite(v) && v > 0 ? v : 0.05;
}

function sanitizeChangeDelay(st) {
  const v = Number(st?.change_delay);
  if (!Number.isFinite(v) || v < 0) return 300;
  return Math.trunc(v);
}
function extractSelectValuesFromWidget(w) {
  const opts = w?.options;
  if (!opts) return [];
  const v = opts.values;
  if (Array.isArray(v)) return v;
  if (v && typeof v === "object") {
    const arr = Array.isArray(v.items) ? v.items : null;
    if (arr) return arr;
  }
  if (Array.isArray(opts)) return opts;
  return [];
}

function safeToString(v) {
  try { return String(v); } catch (_) { return ""; }
}

function mkLabel(text) {
  const l = document.createElement("div");
  l.textContent = text;
  l.style.fontSize = `${LABEL_FONT_SIZE_PX}px`;
  l.style.opacity = "0.85";
  l.style.margin = "10px 0 6px";
  return l;
}

function mkSelect() {
  const s = document.createElement("select");
  s.style.width = "100%";
  s.style.boxSizing = "border-box";
  s.style.padding = "6px 8px";
  s.style.borderRadius = "8px";
  s.style.border = "1px solid rgba(255,255,255,0.14)";
  s.style.background = "rgba(0,0,0,0.35)";
  s.style.color = "rgba(255,255,255,0.92)";
  return s;
}

function mkRow() {
  const r = document.createElement("div");
  r.style.display = "flex";
  r.style.alignItems = "center";
  r.style.gap = "8px";
  r.style.margin = "8px 0";
  return r;
}

function mkKeyLabel(text) {
  const l = document.createElement("div");
  l.textContent = text;
  l.style.width = "110px";
  l.style.flex = "0 0 110px";
  l.style.fontSize = `${LABEL_FONT_SIZE_PX}px`;
  l.style.opacity = "0.85";
  return l;
}

function mkInputText() {
  const i = document.createElement("input");
  i.type = "text";
  i.inputMode = "decimal";
  i.style.width = "100%";
  i.style.boxSizing = "border-box";
  i.style.padding = "6px 8px";
  i.style.borderRadius = "8px";
  i.style.border = "1px solid rgba(255,255,255,0.14)";
  i.style.background = "rgba(0,0,0,0.35)";
  i.style.color = "rgba(255,255,255,0.92)";
  i.style.outline = "none";
  return i;
}

function mkSpinBtn(label) {
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = label;
  b.style.width = "28px";
  b.style.minWidth = "28px";
  b.style.height = "30px";
  b.style.borderRadius = "8px";
  b.style.border = "1px solid rgba(255,255,255,0.14)";
  b.style.background = "rgba(0,0,0,0.35)";
  b.style.color = "rgba(255,255,255,0.92)";
  b.style.cursor = "pointer";
  b.style.userSelect = "none";
  b.style.display = "flex";
  b.style.alignItems = "center";
  b.style.justifyContent = "center";
  b.style.padding = "0";
  return b;
}

function mkNumberControl(key, step) {
  const wrap = document.createElement("div");
  wrap.style.display = "flex";
  wrap.style.alignItems = "center";
  wrap.style.gap = "6px";
  wrap.style.width = "100%";

  const dec = mkSpinBtn("◀");
  const input = mkInputText();
  input.style.flex = "1 1 auto";
  input.style.textAlign = "center";
  const inc = mkSpinBtn("▶");

  input.dataset.step = String(step ?? 1);
  if (FIXED_2_DECIMALS_KEYS.has(String(key))) input.dataset.fixedDecimals = "2";

  wrap.appendChild(dec);
  wrap.appendChild(input);
  wrap.appendChild(inc);

  return { wrap, input, dec, inc };
}

function bumpNumberInput(inputEl, dir) {
  const step = Number(inputEl?.dataset?.step ?? "1");
  const s = Number.isFinite(step) && step !== 0 ? step : 1;
  const raw = String(inputEl?.value ?? "").trim();
  const cur = Number(raw);
  const base = Number.isFinite(cur) ? cur : 0;
  const next = base + dir * s;

  const decimals = (() => {
    const fd = Number(inputEl?.dataset?.fixedDecimals ?? "");
    if (Number.isFinite(fd) && fd >= 0) return Math.min(10, Math.trunc(fd));
    return decimalsFromStep(s);
  })();

  const fixed = decimals > 0 ? next.toFixed(decimals) : String(Math.trunc(next));
  inputEl.value = fixed;
}

function styleDarkOptions(selectEl) {
  for (const o of Array.from(selectEl.options)) {
    o.style.background = "#1b1b1b";
    o.style.color = "rgba(255,255,255,0.92)";
  }
}

function findWidgetByName(node, name) {
  const ws = node?.widgets;
  if (!Array.isArray(ws)) return null;
  for (const w of ws) {
    if (!w) continue;
    if (w.name === name) return w;
    if (typeof w.name === "string" && w.name.replace(/\u00A0/g, " ") === name) return w;
  }
  return null;
}

function clampByWidgetOptions(w, v) {
  const opts = w?.options || {};
  const min = typeof opts.min === "number" ? opts.min : null;
  const max = typeof opts.max === "number" ? opts.max : null;
  if (min !== null && v < min) v = min;
  if (max !== null && v > max) v = max;
  return v;
}

function setWidgetValue(node, widgetName, value) {
  const w = findWidgetByName(node, widgetName);
  if (!w) return false;

  if (typeof value === "number") {
    let v = Number.isFinite(value) ? value : 0;
    v = clampByWidgetOptions(w, v);
    if (w.value === v) return true;
    w.value = v;
  } else {
    const v = String(value ?? "");
    if (String(w.value ?? "") === v) return true;
    w.value = v;
  }

  try {
    if (typeof w.callback === "function") w.callback(w.value, app?.canvas, node, null, null);
  } catch (_) { }

  if (typeof node?.setDirtyCanvas === "function") node.setDirtyCanvas(true, true);
  return true;
}

function getAllGraphNodes() {
  const g = app?.graph;
  const arr = g?._nodes || g?.nodes || [];
  return Array.isArray(arr) ? arr : [];
}

function getNodeById(id) {
  const nid = Number(id);
  if (!Number.isFinite(nid)) return null;
  for (const n of getAllGraphNodes()) {
    if (n?.id === nid) return n;
  }
  return null;
}

function upsertSelectOptions(selectEl, values) {
  const prev = selectEl.value;
  const newVals = Array.isArray(values) ? values.map(v => String(v)) : [];
  const curVals = Array.from(selectEl.options).map(o => String(o.value));
  const same = curVals.length === newVals.length && curVals.every((v, i) => v === newVals[i]);
  if (same) {
    styleDarkOptions(selectEl);
    return;
  }

  selectEl.innerHTML = "";
  for (const v of newVals) {
    const o = document.createElement("option");
    o.value = v;
    o.textContent = v;
    selectEl.appendChild(o);
  }
  styleDarkOptions(selectEl);

  const hasPrev = Array.from(selectEl.options).some(o => o.value === prev);
  if (hasPrev) selectEl.value = prev;
}

function getLocalStoreFallback() {
  const g = app?.graph;
  if (!g) return { selected_sampler_id: "" };
  if (!g.extra) g.extra = {};
  const st = g.extra[STORE_KEY];
  if (!st || typeof st !== "object") {
    g.extra[STORE_KEY] = { nodes_list: "", sorting_mode: "By name", selected_sampler_id: "", run_on_change_panel: false };
    return g.extra[STORE_KEY];
  }
  if (typeof st.selected_sampler_id !== "string") st.selected_sampler_id = "";
  if (typeof st.run_on_change_panel !== "boolean") st.run_on_change_panel = false;
  return st;
}

function dbg(...args) {
  if (!DEBUG_LOGS) return;
  try { console.log("[AKMultipleSamplers][Control]", ...args); } catch (_) { }
}

function markGraphDirty() {
  const g = app?.graph;
  if (!g) return;
  if (typeof g.setDirtyCanvas === "function") g.setDirtyCanvas(true, true);
  if (typeof g.change === "function") g.change();
  if (typeof g._trigger === "function") {
    try { g._trigger("change"); } catch (_) { }
  }
  if (typeof g._version === "number") g._version++;
}


let delayedForceQueueTimer = 0;
let delayedForceQueueReason = "";

function cancelDelayedForceQueue() {
  if (delayedForceQueueTimer) {
    window.clearTimeout(delayedForceQueueTimer);
    delayedForceQueueTimer = 0;
    delayedForceQueueReason = "";
  }
}

function scheduleDelayedForceQueue(reason, delayMs) {
  cancelDelayedForceQueue();
  delayedForceQueueReason = String(reason || "");
  const d = Number(delayMs);
  const ms = Number.isFinite(d) && d >= 0 ? Math.trunc(d) : 300;
  delayedForceQueueTimer = window.setTimeout(() => {
    delayedForceQueueTimer = 0;
    const r = delayedForceQueueReason || reason;
    delayedForceQueueReason = "";
    markGraphDirty();
    if (typeof app?.queuePrompt === "function") {
      try { app.queuePrompt(0); } catch (_) { }
    }
  }, ms);
}
function setOptions(selectEl, nodes, selectedId) {
  const prev = selectEl.value;
  selectEl.innerHTML = "";

  const noneOpt = document.createElement("option");
  noneOpt.value = "";
  noneOpt.textContent = "(none)";
  noneOpt.style.background = "#1b1b1b";
  noneOpt.style.color = "rgba(255,255,255,0.92)";
  selectEl.appendChild(noneOpt);

  for (const n of nodes) {
    const id = n?.id;
    const title = String(n?.title ?? "");
    const opt = document.createElement("option");
    opt.value = String(id ?? "");
    opt.textContent = title ? `${title}  #${id}` : `#${id}`;
    opt.style.background = "#1b1b1b";
    opt.style.color = "rgba(255,255,255,0.92)";
    selectEl.appendChild(opt);
  }

  const want = String(selectedId ?? "");
  const hasWant = Array.from(selectEl.options).some(o => o.value === want);
  selectEl.value = hasWant ? want : (prev && Array.from(selectEl.options).some(o => o.value === prev) ? prev : want);
}

export function renderControlPanel(el, ctx = null) {
  el.innerHTML = "";
  el.style.padding = "10px";

  const label = mkLabel("Choose Sampler:");
  const select = mkSelect();

  const fieldsWrap = document.createElement("div");
  fieldsWrap.style.marginTop = "10px";


  const runOnChangeRow = mkRow();
  const runOnChangeLabel = mkKeyLabel("Run on change");
  const runOnChangeCheckbox = document.createElement("input");
  runOnChangeCheckbox.type = "checkbox";
  runOnChangeCheckbox.style.width = "18px";
  runOnChangeCheckbox.style.height = "18px";
  runOnChangeCheckbox.style.cursor = "pointer";
  runOnChangeRow.appendChild(runOnChangeLabel);
  runOnChangeRow.appendChild(runOnChangeCheckbox);
  fieldsWrap.appendChild(runOnChangeRow);

  const getStore = typeof ctx?.getStore === "function" ? ctx.getStore : getLocalStoreFallback;
  const getControlledNodes = typeof ctx?.getControlledNodes === "function" ? ctx.getControlledNodes : () => [];

  const getSelectValues = (key) => {
    const st = getStore();
    const sel = getNodeById(st.selected_sampler_id);
    const nodes = getControlledNodes();
    const probe = [];
    if (sel) probe.push(sel);
    for (const n of nodes) if (n && n !== sel) probe.push(n);

    for (const n of probe) {
      const w = findWidgetByName(n, key);
      if (!w) continue;

      const vals = extractSelectValuesFromWidget(w);

      if (Array.isArray(vals) && vals.length) return vals;
    }

    return [];
  };

  const fields = {};
  const numBtns = {};
  for (const spec of FIELD_SPECS) {
    const row = mkRow();
    const klabel = mkKeyLabel(spec.key);
    let control;
    if (spec.type === "select") {
      control = mkSelect();
      control.style.width = "100%";
      upsertSelectOptions(control, getSelectValues(spec.key));
      control.addEventListener("mousedown", () => upsertSelectOptions(control, getSelectValues(spec.key)));
      row.appendChild(klabel);
      row.appendChild(control);
      fieldsWrap.appendChild(row);
      fields[spec.key] = control;
      continue;
    } else {
      const nc = mkNumberControl(spec.key, spec.step ?? 1);
      control = nc.wrap;
      numBtns[spec.key] = { dec: nc.dec, inc: nc.inc };
      row.appendChild(klabel);
      row.appendChild(control);
      fieldsWrap.appendChild(row);
      fields[spec.key] = nc.input;
      continue;
    }
  }

  let lastSig = "";
  let raf = 0;

  const syncFromNode = () => {
    const st = getStore();
    const node = getNodeById(st.selected_sampler_id);
    if (!node) return;
    for (const spec of FIELD_SPECS) {
      const w = findWidgetByName(node, spec.key);
      if (!w) continue;
      const v = w.value;
      if (spec.type === "select") {
        upsertSelectOptions(fields[spec.key], getSelectValues(spec.key));
        fields[spec.key].value = String(v ?? "");
        st[spec.key] = String(fields[spec.key].value ?? "");
      } else {
        const num = typeof v === "number" ? v : Number(v);
        fields[spec.key].value = Number.isFinite(num) ? formatNumberForKey(spec.key, num, spec.step) : String(v ?? "");
        st[spec.key] = fields[spec.key].value;
      }
    }
  };

  const refresh = () => {
    raf = 0;
    const st = getStore();
    const nodes = getControlledNodes();

    const node = getNodeById(st.selected_sampler_id);
    const nodeSnap = {};
    if (node) {
      for (const spec of FIELD_SPECS) {
        const w = findWidgetByName(node, spec.key);
        nodeSnap[spec.key] = w ? safeToString(w.value) : "";
      }
    }
    const sig = JSON.stringify({
      list: st.nodes_list ?? "",
      sort: st.sorting_mode ?? "",
      ids: nodes.map(n => n?.id ?? null),
      titles: nodes.map(n => String(n?.title ?? "")),
      sel: st.selected_sampler_id ?? "",
      node: nodeSnap,
      seed: st.seed ?? "",
      steps: st.steps ?? "",
      cfg: st.cfg ?? "",
      sampler_name: st.sampler_name ?? "",
      scheduler: st.scheduler ?? "",
      denoise: st.denoise ?? "",
      roc: st.run_on_change_panel === true,
      cfg_step: st.cfg_step ?? "",
      denoise_step: st.denoise_step ?? "",
      change_delay: st.change_delay ?? "",
    });

    if (sig === lastSig) return;
    lastSig = sig;

    setOptions(select, nodes, st.selected_sampler_id);
    runOnChangeCheckbox.checked = st.run_on_change_panel === true;
    const cs = sanitizeCfgStep(st);
    const ds = sanitizeDenoiseStep(st);
    if (fields.cfg && fields.cfg?.dataset) fields.cfg.dataset.step = String(cs);
    if (fields.denoise && fields.denoise?.dataset) fields.denoise.dataset.step = String(ds);
    syncFromNode();
  };

  const scheduleRefresh = () => {
    if (raf) return;
    raf = window.requestAnimationFrame(refresh);
  };

  select.addEventListener("change", () => {
    const st = getStore();
    st.selected_sampler_id = String(select.value ?? "");
    dbg("selectChange", { selected_sampler_id: st.selected_sampler_id });
    syncFromNode();
    scheduleRefresh();
  });
  runOnChangeCheckbox.addEventListener("change", () => {
    const st = getStore();
    st.run_on_change_panel = runOnChangeCheckbox.checked === true;
    if (st.run_on_change_panel !== true) cancelDelayedForceQueue();
    scheduleRefresh();
  });



  const applyFieldToNode = (key, commitFormat = false) => {
    const st = getStore();
    const node = getNodeById(st.selected_sampler_id);
    const elc = fields[key];
    if (!elc) return;

    dbg("fieldChange", {
      key,
      selected_sampler_id: st.selected_sampler_id,
      hasNode: !!node,
      tag: elc?.tagName,
      value: safeToString(elc?.value),
      commitFormat,
    });

    if (elc.tagName === "SELECT") {
      const v = String(elc.value ?? "");
      st[key] = v;
      if (node) setWidgetValue(node, key, v); const reason = `fieldChange:${key}`;
      if (st.run_on_change_panel === true) {
        scheduleDelayedForceQueue(reason, sanitizeChangeDelay(st));
      }
      return;
    }

    const raw = String(elc.value ?? "").trim();
    const num = Number(raw);

    if (Number.isFinite(num)) {
      if (commitFormat && FIXED_2_DECIMALS_KEYS.has(String(key))) {
        const fixed = formatNumberForKey(key, num, FIELD_SPECS.find(s => s.key === key)?.step);
        elc.value = fixed;
        st[key] = fixed;
        if (node) setWidgetValue(node, key, Number(fixed));
      } else {
        st[key] = raw;
        if (node) setWidgetValue(node, key, num);
      }
    } else {
      st[key] = raw;
      if (node) setWidgetValue(node, key, raw);
    }
    const reason = `fieldChange:${key}`;
    if (st.run_on_change_panel === true) {
      scheduleDelayedForceQueue(reason, sanitizeChangeDelay(st));
    }
  };


  for (const spec of FIELD_SPECS) {
    if (spec.type !== "number") continue;
    const btn = numBtns[spec.key];
    const inp = fields[spec.key];
    if (!btn || !inp) continue;

    const attachBtnLogs = (elBtn, dir) => {
      elBtn.addEventListener("pointerdown", (ev) => {
        dbg("btnPointerDown", { key: spec.key, dir, buttons: ev?.buttons, pointerType: ev?.pointerType });
      });
      elBtn.addEventListener("mousedown", (ev) => {
        dbg("btnMouseDown", { key: spec.key, dir, buttons: ev?.buttons });
      });
      elBtn.addEventListener("mouseup", (ev) => {
        dbg("btnMouseUp", { key: spec.key, dir, buttons: ev?.buttons });
      });
    };
    attachBtnLogs(btn.dec, -1);
    attachBtnLogs(btn.inc, 1);

    btn.dec.addEventListener("mousedown", () => {
      dbg("btnClick", { key: spec.key, dir: -1 });
      bumpNumberInput(inp, -1);
      
      inp.focus({ preventScroll: true });
      inp.select();
      applyFieldToNode(spec.key, true);
    });
    btn.inc.addEventListener("mousedown", () => {
      dbg("btnClick", { key: spec.key, dir: 1 });
      bumpNumberInput(inp, 1);
      
      inp.focus({ preventScroll: true });
      inp.select();
      applyFieldToNode(spec.key, true);
    });
  }

  for (const spec of FIELD_SPECS) {
    const c = fields[spec.key];
    if (!c) continue;
    c.addEventListener("change", () => applyFieldToNode(spec.key, true));
    c.addEventListener("input", () => {
      if (c.tagName === "SELECT") return;
      applyFieldToNode(spec.key, true);
    });
  }

  el.appendChild(label);
  el.appendChild(select);
  el.appendChild(fieldsWrap);

  scheduleRefresh();

  const poll = window.setInterval(scheduleRefresh, 250);
  const onRemoved = () => {
    window.clearInterval(poll);
    el.removeEventListener("DOMNodeRemovedFromDocument", onRemoved);
  };
  el.addEventListener("DOMNodeRemovedFromDocument", onRemoved);
}
