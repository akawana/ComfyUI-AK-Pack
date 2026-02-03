import { app } from "../../scripts/app.js";
import { readProjectSettingsEnableOptions } from "./AKProjectSettingsPanel_Settings.js";
import {
  syncAllProjectSettingsOutNodes,
  toInt,
  readProjectSettingsValues,
  writeProjectSettingsValues
} from "./AKProjectSettingsPanel.js";

const OPEN_IMAGE_GARBAGE_SUBFOLDER = "garbage";

(function () {
  if (document.getElementById("ak-psp-style")) return;
  const s = document.createElement("style");
  s.id = "ak-psp-style";
  s.textContent = `
    input[type=number]::-webkit-inner-spin-button,
    input[type=number]::-webkit-outer-spin-button {
      -webkit-appearance: none;
      margin: 0;
    }

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
})();

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

function clampInt(n, minV, maxV) {
  let x = toInt(n, minV);
  if (x < minV) x = minV;
  if (x > maxV) x = maxV;
  return x;
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

function mkSection(rootEl) {
  const sec = document.createElement("div");
  sec.style.display = "flex";
  sec.style.flexDirection = "column";
  sec.style.gap = "10px";
  rootEl.appendChild(sec);
  return sec;
}

function mkRow(rootEl) {
  const row = document.createElement("div");
  row.style.display = "flex";
  row.style.alignItems = "center";
  row.style.gap = "10px";
  rootEl.appendChild(row);
  return row;
}

function mkLabel(text) {
  const l = document.createElement("div");
  l.textContent = text;
  l.style.minWidth = "140px";
  l.style.opacity = "0.92";
  return l;
}

function mkTextControl(value) {
  const wrap = document.createElement("div");
  wrap.style.display = "flex";
  wrap.style.flex = "1";

  const inp = document.createElement("input");
  inp.type = "text";
  inp.value = String(value ?? "");
  inp.style.width = "100%";
  inp.style.height = "30px";
  inp.style.textAlign = "left";
  inp.style.borderRadius = "12px";
  inp.style.border = "1px solid rgba(255,255,255,0.14)";
  inp.style.background = "rgba(0,0,0,0.0)";
  inp.style.color = "inherit";
  inp.style.padding = "0 10px";

  wrap.appendChild(inp);
  return { wrap, inp };
}

function mkToggleButton(value) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "comfy-toggle-btn" + (toInt(value, 0) === 1 ? " active" : "");

  btn.addEventListener("mousedown", () => {
    const next = !btn.classList.contains("active");
    btn.classList.toggle("active", next);
    btn.dispatchEvent(new CustomEvent("toggle", { detail: next ? 1 : 0 }));
  });

  return btn;
}

function mkStepControl(value, minV, maxV, step) {
  const wrap = document.createElement("div");
  wrap.style.display = "flex";
  wrap.style.alignItems = "center";
  wrap.style.gap = "6px";
  wrap.style.flex = "1";

  const commonBtn = (b) => {
    b.type = "button";
    b.style.width = "34px";
    b.style.height = "30px";
    b.style.cursor = "pointer";
    b.style.borderRadius = "10px";
    b.style.border = "1px solid rgba(255,255,255,0.14)";
    b.style.background = "rgba(255,255,255,0.06)";
    b.style.color = "inherit";
    b.style.display = "flex";
    b.style.alignItems = "center";
    b.style.justifyContent = "center";
    b.style.padding = "0";
    b.style.userSelect = "none";
    b.style.fontSize = "14px";
    b.style.flex = "0 0 auto";
  };

  const btnMinus = document.createElement("button");
  commonBtn(btnMinus);
  btnMinus.textContent = "◀";

  const inp = document.createElement("input");
  inp.type = "number";
  inp.step = String(step);
  inp.min = String(minV);
  inp.max = String(maxV);
  inp.value = String(value);
  inp.style.flex = "1";
  inp.style.height = "30px";
  inp.style.textAlign = "center";
  inp.style.borderRadius = "12px";
  inp.style.border = "1px solid rgba(255,255,255,0.14)";
  inp.style.MozAppearance = "textfield";
  inp.style.appearance = "textfield";
  inp.style.background = "rgba(0,0,0,0.0)";
  inp.style.color = "inherit";

  const btnPlus = document.createElement("button");
  commonBtn(btnPlus);
  btnPlus.textContent = "▶";

  function setVal(next) {
    inp.value = String(clampInt(next, minV, maxV));
  }

  btnMinus.addEventListener("mousedown", function () {
    setVal(toInt(inp.value, value) - step);
    inp.dispatchEvent(new Event("change"));
    inp.blur();
  });

  btnPlus.addEventListener("mousedown", function () {
    setVal(toInt(inp.value, value) + step);
    inp.dispatchEvent(new Event("change"));
    inp.blur();
  });

  wrap.appendChild(btnMinus);
  wrap.appendChild(inp);
  wrap.appendChild(btnPlus);

  return { wrap, inp };
}

function commitIfEnabled(key, value, enabledMap) {
  if (!enabledMap) return;

  const enabledKey =
    enabledMap[key] === true
      ? key
      : (key === "width" || key === "height")
        ? "width_height"
        : null;

  if (!enabledKey || enabledMap[enabledKey] !== true) return;

  const st = readProjectSettingsValues();
  st[key] = value;
  writeProjectSettingsValues(st);
  syncAllProjectSettingsOutNodes();
}

function fileStem(name) {
  const s = String(name ?? "");
  return s.replace(/\.[^/.]+$/, "");
}

function relPathFromFile(f) {
  const rp = f && typeof f.webkitRelativePath === "string" ? f.webkitRelativePath : "";
  console.log("file.name:", f.name);
  console.log("file.webkitRelativePath:", f.webkitRelativePath);
  console.log("file.type:", f.type, "size:", f.size);
  return String(rp || "");
}

export function renderProjectTab(rootEl) {
  rootEl.innerHTML = "";

  const enabled = readProjectSettingsEnableOptions();
  const values = readProjectSettingsValues();

  const sec = mkSection(rootEl);

  if (enabled.output_filename === true) {
    const row = mkRow(sec);
    row.appendChild(mkLabel("output_filename"));
    const ctl = mkTextControl(values.output_filename);
    ctl.inp.addEventListener("change", function () {
      commitIfEnabled("output_filename", String(ctl.inp.value ?? ""), enabled);
    });
    row.appendChild(ctl.wrap);
  }

  if (enabled.output_subfolder === true) {
    const row = mkRow(sec);
    row.appendChild(mkLabel("output_subfolder"));
    const ctl = mkTextControl(values.output_subfolder);
    ctl.inp.addEventListener("change", function () {
      commitIfEnabled("output_subfolder", String(ctl.inp.value ?? ""), enabled);
    });
    row.appendChild(ctl.wrap);
  }

  if (enabled.width_height === true) {
    const rowW = mkRow(sec);
    rowW.appendChild(mkLabel("width"));
    const wCtl = mkStepControl(values.width, 1, 16384, 1);
    wCtl.inp.addEventListener("change", function () {
      commitIfEnabled("width", clampInt(wCtl.inp.value, 1, 16384), enabled);
    });
    rowW.appendChild(wCtl.wrap);

    const rowH = mkRow(sec);
    rowH.appendChild(mkLabel("height"));
    const hCtl = mkStepControl(values.height, 1, 16384, 1);
    hCtl.inp.addEventListener("change", function () {
      commitIfEnabled("height", clampInt(hCtl.inp.value, 1, 16384), enabled);
    });
    rowH.appendChild(hCtl.wrap);
  }

  if (enabled.do_resize === true) {
    const row = mkRow(sec);
    row.appendChild(mkLabel("do_resize"));
    const toggle = mkToggleButton(values.do_resize);
    toggle.addEventListener("toggle", (e) => {
      commitIfEnabled("do_resize", e.detail, enabled);
    });
    row.appendChild(toggle);
  }
  if (enabled.open_image === true) {
    const block = document.createElement("div");
    block.style.marginTop = "10px";
    block.style.display = "flex";
    block.style.flexDirection = "column";
    block.style.gap = "6px";
    block.style.width = "100%";

    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = "Open Image";
    btn.style.height = "30px";
    btn.style.cursor = "pointer";
    btn.style.borderRadius = "12px";
    btn.style.border = "1px solid rgba(255,255,255,0.14)";
    btn.style.background = "rgba(255,255,255,0.06)";
    btn.style.color = "inherit";
    btn.style.padding = "0 12px";
    btn.style.width = "100%";

    const inp = document.createElement("input");
    inp.type = "file";
    inp.accept = "image/*";
    inp.style.display = "none";
    // inp.setAttribute("webkitdirectory", "");
    // inp.setAttribute("directory", "");

    const preview = document.createElement("div");
    preview.style.width = "100%";
    preview.style.minHeight = "120px";
    preview.style.border = "1px dashed rgba(255,255,255,0.2)";
    preview.style.borderRadius = "12px";
    preview.style.display = "flex";
    preview.style.alignItems = "center";
    preview.style.justifyContent = "center";
    preview.style.overflow = "hidden";

    function makeViewUrl(filename, subfolder, type) {
      const fn = encodeURIComponent(String(filename || ""));
      const sf = encodeURIComponent(String(subfolder || ""));
      const tp = encodeURIComponent(String(type || "input"));
      if (!fn) return "";
      return `/view?filename=${fn}&subfolder=${sf}&type=${tp}`;
    }

    function setPreviewByMeta(filename, subfolder, type) {
      const url = makeViewUrl(filename, subfolder, type);
      setPreview(url);
    }

    function setPreview(src) {
      preview.innerHTML = "";
      if (!src || src === "DISABLED") {
        preview.textContent = "No image opened";
        preview.style.opacity = "0.85";
        return;
      }
      preview.style.opacity = "1";
      const img = document.createElement("img");
      img.src = src;
      img.style.maxWidth = "100%";
      img.style.maxHeight = "220px";
      img.style.display = "block";
      preview.appendChild(img);
    }

    if (values.open_image_filename && values.open_image_filename !== "DISABLED") {
      const sub = values.open_image_subfolder || OPEN_IMAGE_GARBAGE_SUBFOLDER;
      const tp = values.open_image_type || "input";
      setPreviewByMeta(values.open_image_filename, sub, tp);
    } else {
      setPreview(values.open_image);
    }

    btn.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      inp.click();
      btn.blur();
    });

    async function uploadToComfyInput(file, subfolder) {
      const fd = new FormData();
      fd.append("image", file);
      fd.append("type", "input");
      fd.append("subfolder", String(subfolder || ""));
      fd.append("overwrite", "true");

      const res = await fetch("/upload/image", { method: "POST", body: fd });
      if (!res.ok) {
        throw new Error(`upload failed: ${res.status}`);
      }
      const j = await res.json().catch(() => ({}));
      return {
        name: String(j.name || file.name || ""),
        subfolder: String(j.subfolder || subfolder || ""),
        type: String(j.type || "input"),
      };
    }

    inp.addEventListener("change", async () => {
      const f = inp.files && inp.files[0] ? inp.files[0] : null;
      if (!f) return;

      // загружаем в fixed subfolder: input/garbage/
      let meta = null;
      try {
        meta = await uploadToComfyInput(f, OPEN_IMAGE_GARBAGE_SUBFOLDER);
      } catch (e) {
        // если upload упал — просто не сохраняем ничего, превью тоже не меняем
        return;
      }

      // превью всегда через /view (а не dataURL)
      setPreviewByMeta(meta.name, meta.subfolder, meta.type);

      // сохраняем в graph ТОЛЬКО метаданные (никаких base64)
      const st = readProjectSettingsValues();
      st.open_image = ""; // важно: очищаем, чтобы не попадало в workflow
      st.open_image_filename = meta.name;
      st.open_image_subfolder = meta.subfolder;
      st.open_image_type = meta.type;

      writeProjectSettingsValues(st);
      syncAllProjectSettingsOutNodes();
    });

    block.appendChild(btn);
    block.appendChild(inp);
    block.appendChild(preview);
    sec.appendChild(block);
  }

}
