import { app } from "../../scripts/app.js";
// import { AK_PSP_DEFAULTS, AK_PSP_VALUE_KEY } from "./AKProjectSettingsPanel.js";
import {
  AK_PSP_DEFAULTS,
  STORE_KEY,
  DEFAULT_ENABLE,
  applyOutputsVisibility,
  getGraphExtra,
  toInt,
  readProjectSettingsValues,
  writeProjectSettingsValues
} from "./AKProjectSettingsPanel.js";


function ensureStyle() {
  if (document.getElementById("ak-psp-style")) return;
  const s = document.createElement("style");
  s.id = "ak-psp-style";
  s.textContent = `
    .comfy-toggle-btn {
      position: relative;
      width: 46px;
      height: 24px;
      border-radius: 12px;
      border: none;
      background: #2a2a2a;
      cursor: pointer;
      padding: 0;
      outline: none;
      flex: 0 0 auto;
    }

    .comfy-toggle-btn::before {
      content: "";
      position: absolute;
      top: 3px;
      left: 3px;
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: #fff;
      transition: transform 0.2s ease;
    }

    .comfy-toggle-btn.active {
      background: #4da3ff;
    }

    .comfy-toggle-btn.active::before {
      transform: translateX(22px);
    }
  `;
  document.head.appendChild(s);
}

// function getGraphExtra() {
//   const g = app && app.graph ? app.graph : null;
//   if (!g) return null;
//   if (!g.extra) g.extra = {};
//   return g.extra;
// }

// function toInt(v, dflt) {
//   const n = Number(v);
//   if (!Number.isFinite(n)) return dflt;
//   return Math.trunc(n);
// }

function readEnableStore() {
  const extra = getGraphExtra();
  const raw = extra && extra[STORE_KEY] ? extra[STORE_KEY] : null;
  const st = Object.assign({}, DEFAULT_ENABLE, raw && typeof raw === "object" ? raw : {});
  st.output_filename = !!st.output_filename;
  st.output_subfolder = !!st.output_subfolder;
  st.width_height = !!st.width_height;
  st.do_resize = !!st.do_resize;
  st.open_image = !!st.open_image;
  return st;
}

function writeEnableStore(st) {
  const extra = getGraphExtra();
  if (!extra) return;
  extra[STORE_KEY] = {
    output_filename: !!st.output_filename,
    output_subfolder: !!st.output_subfolder,
    width_height: !!st.width_height,
    do_resize: !!st.do_resize,
    open_image: !!st.open_image,
  };
  applyOutputsVisibility(extra[STORE_KEY]);
}

// function readValues() {
//   const extra = getGraphExtra();
//   const raw = extra && extra[AK_PSP_VALUE_KEY] ? extra[AK_PSP_VALUE_KEY] : null;
//   const st = Object.assign({}, AK_PSP_DEFAULTS, raw && typeof raw === "object" ? raw : {});
//   st.output_filename = String(st.output_filename ?? "");
//   st.output_subfolder = String(st.output_subfolder ?? "");
//   st.width = toInt(st.width, AK_PSP_DEFAULTS.width);
//   st.height = toInt(st.height, AK_PSP_DEFAULTS.height);
//   st.do_resize = toInt(st.do_resize, AK_PSP_DEFAULTS.do_resize);
//   st.open_image = String(st.open_image ?? "");
//   return st;
// }

// function writeValues(next) {
//   const extra = getGraphExtra();
//   if (!extra) return;
//   extra[AK_PSP_VALUE_KEY] = {
//     output_filename: String(next.output_filename ?? ""),
//     output_subfolder: String(next.output_subfolder ?? ""),
//     width: toInt(next.width, AK_PSP_DEFAULTS.width),
//     height: toInt(next.height, AK_PSP_DEFAULTS.height),
//     do_resize: toInt(next.do_resize, AK_PSP_DEFAULTS.do_resize),
//     open_image: String(next.open_image ?? ""),
//   };
// }

function applyEnabledTransitions(enableSt) {
  const v = readProjectSettingsValues();

  if (!enableSt.output_filename && v.output_filename !== "DISABLED") v.output_filename = "DISABLED";
  if (enableSt.output_filename && v.output_filename === "DISABLED") v.output_filename = "";

  if (!enableSt.output_subfolder && v.output_subfolder !== "DISABLED") v.output_subfolder = "DISABLED";
  if (enableSt.output_subfolder && v.output_subfolder === "DISABLED") v.output_subfolder = "";

  if (!enableSt.open_image && v.open_image !== "DISABLED") {
    v.open_image = "DISABLED";
    v.open_image_filename = "DISABLED";
    v.open_image_subfolder = "DISABLED";
    v.open_image_type = "DISABLED";
  }

  if (enableSt.open_image && v.open_image === "DISABLED") {
    v.open_image = "";
    if (v.open_image_filename === "DISABLED") v.open_image_filename = "";
    if (v.open_image_subfolder === "DISABLED") v.open_image_subfolder = "";
    if (v.open_image_type === "DISABLED") v.open_image_type = "input";
  }


  const w = toInt(v.width, -1);
  const h = toInt(v.height, -1);

  if (!enableSt.width_height) {
    if (w !== -1) v.width = -1;
    if (h !== -1) v.height = -1;
  } else {
    if (w === -1) v.width = AK_PSP_DEFAULTS.width;
    if (h === -1) v.height = AK_PSP_DEFAULTS.height;
  }

  const dr = toInt(v.do_resize, -1);
  if (!enableSt.do_resize) {
    if (dr !== -1) v.do_resize = -1;
  } else {
    if (dr === -1) v.do_resize = AK_PSP_DEFAULTS.do_resize;
  }

  writeProjectSettingsValues(v);
}

function mkToggleButton(on) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "comfy-toggle-btn" + (on ? " active" : "");
  btn.addEventListener("mousedown", () => {
    const next = !btn.classList.contains("active");
    btn.classList.toggle("active", next);
    btn.dispatchEvent(new CustomEvent("toggle", { detail: next }));
  });
  return btn;
}

function mkRow(rootEl, labelText, initialOn, onToggle) {
  const row = document.createElement("div");
  row.style.display = "flex";
  row.style.alignItems = "center";
  row.style.justifyContent = "space-between";
  row.style.gap = "10px";
  row.style.padding = "6px 0";

  const left = document.createElement("div");
  left.textContent = labelText;
  left.style.opacity = "0.95";

  const btn = mkToggleButton(initialOn);

  btn.addEventListener("toggle", (ev) => {
    const next = !!ev.detail;
    onToggle(next);
  });

  row.appendChild(left);
  row.appendChild(btn);
  rootEl.appendChild(row);
}

export function readProjectSettingsEnableOptions() {
  return readEnableStore();
}

export function renderSettingsTab(rootEl) {
  ensureStyle();
  rootEl.innerHTML = "";

  const st = readEnableStore();
  applyEnabledTransitions(st);

  const title = document.createElement("div");
  title.textContent = "Enable options:";
  title.style.padding = "6px 0 10px 0";
  title.style.opacity = "0.85";
  rootEl.appendChild(title);

  mkRow(rootEl, "output_filename", st.output_filename, (on) => {
    const next = readEnableStore();
    next.output_filename = on;
    writeEnableStore(next);
    applyEnabledTransitions(next);
  });

  mkRow(rootEl, "output_subfolder", st.output_subfolder, (on) => {
    const next = readEnableStore();
    next.output_subfolder = on;
    writeEnableStore(next);
    applyEnabledTransitions(next);
  });

  mkRow(rootEl, "width / height", st.width_height, (on) => {
    const next = readEnableStore();
    next.width_height = on;
    writeEnableStore(next);
    applyEnabledTransitions(next);
  });

  mkRow(rootEl, "do_resize", st.do_resize, (on) => {
    const next = readEnableStore();
    next.do_resize = on;
    writeEnableStore(next);
    applyEnabledTransitions(next);
  });

  mkRow(rootEl, "open_image", st.open_image, (on) => {
    const next = readEnableStore();
    next.open_image = on;
    writeEnableStore(next);
    applyEnabledTransitions(next);
  });
}
