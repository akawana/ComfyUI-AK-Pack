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

function clampInt(n, minV, maxV) {
  let x = toInt(n, minV);
  if (x < minV) x = minV;
  if (x > maxV) x = maxV;
  return x;
}

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
      const st = readProjectSettingsValues();
      st.output_filename = String(ctl.inp.value ?? "").trim();   // Только output_filename
      writeProjectSettingsValues(st);
      syncAllProjectSettingsOutNodes();
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

    const btnRow = document.createElement("div");
    btnRow.style.display = "flex";
    btnRow.style.gap = "6px";
    btnRow.style.width = "100%";

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
    btn.style.flex = "1";

    const btnPaste = document.createElement("button");
    btnPaste.type = "button";
    btnPaste.textContent = "Paste Image";
    btnPaste.style.height = "30px";
    btnPaste.style.cursor = "pointer";
    btnPaste.style.borderRadius = "12px";
    btnPaste.style.border = "1px solid rgba(255,255,255,0.14)";
    btnPaste.style.background = "rgba(255,255,255,0.06)";
    btnPaste.style.color = "inherit";
    btnPaste.style.padding = "0 12px";
    btnPaste.style.flex = "1";

    const inp = document.createElement("input");
    inp.type = "file";
    inp.accept = "image/*";
    inp.style.display = "none";

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
      return `/view?filename=${fn}&subfolder=${sf}&type=${tp}&t=${Date.now()}`;
    }

    let _currentBlobUrl = null;

    async function setPreviewByMeta(filename, subfolder, type) {
      const url = makeViewUrl(filename, subfolder, type);
      try {
        const resp = await fetch(url, { cache: "no-store" });
        if (!resp.ok) throw new Error("fetch failed");
        const blob = await resp.blob();
        if (_currentBlobUrl) {
          URL.revokeObjectURL(_currentBlobUrl);
          _currentBlobUrl = null;
        }
        _currentBlobUrl = URL.createObjectURL(blob);
        setPreview(_currentBlobUrl);
      } catch (_) {
        setPreview(url);
      }
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
      img.style.width = "100%";
      img.style.height = "auto";
      img.style.display = "block";
      // force reload if browser tries to reuse cached decode
      img.decode().catch(() => {});
      preview.appendChild(img);
    }

    if (values.open_image_filename && values.open_image_filename !== "DISABLED") {
      const tp = values.open_image_type || "input";
      const sub = tp === "temp"
        ? (values.open_image_subfolder || "")
        : (values.open_image_subfolder || OPEN_IMAGE_GARBAGE_SUBFOLDER);
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
      if (!res.ok) throw new Error(`upload failed: ${res.status}`);
      const j = await res.json().catch(() => ({}));
      return {
        name: String(j.name || file.name || ""),
        subfolder: String(j.subfolder || subfolder || ""),
        type: String(j.type || "input"),
      };
    }

    inp.addEventListener("change", async () => {
      const f = inp.files && inp.files[0] ? inp.files[0] : null;
      inp.value = "";
      if (!f) return;

      let meta = null;
      try {
        meta = await uploadToComfyInput(f, OPEN_IMAGE_GARBAGE_SUBFOLDER);
      } catch (e) {
        return;
      }

      setPreviewByMeta(meta.name, meta.subfolder, meta.type);

      const st = readProjectSettingsValues();
      st.open_image = "";
      st.open_image_filename = meta.name;        // ← Только здесь обновляется
      st.open_image_subfolder = meta.subfolder;
      st.open_image_type = meta.type;
      st.timestamp = Date.now();

      writeProjectSettingsValues(st);
      syncAllProjectSettingsOutNodes();
    });

    async function uploadToComfyTemp(file) {
      const fd = new FormData();
      fd.append("image", file);
      fd.append("type", "temp");
      fd.append("subfolder", "");
      fd.append("overwrite", "true");

      const res = await fetch("/upload/image", { method: "POST", body: fd });
      if (!res.ok) throw new Error(`upload failed: ${res.status}`);
      const j = await res.json().catch(() => ({}));
      return {
        name: String(j.name || file.name || ""),
        subfolder: String(j.subfolder || ""),
        type: "temp",
      };
    }

    btnPaste.addEventListener("mousedown", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      btnPaste.blur();

      let clipboardItems;
      try {
        clipboardItems = await navigator.clipboard.read();
      } catch (err) {
        return;
      }

      let imageBlob = null;
      for (const item of clipboardItems) {
        for (const mimeType of item.types) {
          if (mimeType.startsWith("image/")) {
            try {
              imageBlob = await item.getType(mimeType);
            } catch (_) {}
            break;
          }
        }
        if (imageBlob) break;
      }
      if (!imageBlob) return;

      const st = readProjectSettingsValues();
      const currentName = st.open_image_filename && st.open_image_filename !== "DISABLED"
        ? st.open_image_filename
        : null;

      const ext = imageBlob.type === "image/png" ? "png"
        : imageBlob.type === "image/jpeg" ? "jpg"
        : imageBlob.type === "image/webp" ? "webp"
        : "png";

      let targetName;
      if (currentName) {
        const dot = currentName.lastIndexOf(".");
        targetName = dot > 0
          ? currentName.slice(0, dot) + "." + ext
          : currentName + "." + ext;
      } else {
        targetName = "paste_" + Math.random().toString(36).slice(2, 10) + "." + ext;
      }

      const file = new File([imageBlob], targetName, { type: imageBlob.type });

      let meta = null;
      try {
        meta = await uploadToComfyTemp(file);
      } catch (err) {
        return;
      }

      setPreviewByMeta(meta.name, meta.subfolder, meta.type);

      st.open_image = "";
      st.open_image_filename = meta.name;
      st.open_image_subfolder = meta.subfolder;
      st.open_image_type = meta.type;
      st.timestamp = Date.now();

      writeProjectSettingsValues(st);
      syncAllProjectSettingsOutNodes();
    });

    btnRow.appendChild(btn);
    btnRow.appendChild(btnPaste);

    block.appendChild(btnRow);
    block.appendChild(inp);
    block.appendChild(preview);
    sec.appendChild(block);
  }
}