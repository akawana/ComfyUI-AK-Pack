import { app } from "../../scripts/app.js";

const LABEL_FONT_SIZE_PX = 14;
const STORE_KEY = "ak_multiple_samplers_control_panel";

function getStore() {
  const g = app?.graph;
  if (!g) return { nodes_list: "KSampler", nodes_exclude_list: "", sorting_mode: "By name", cfg_step: 0.5, denoise_step: 0.05, change_delay: 300 };
  if (!g.extra) g.extra = {};
  const st = g.extra[STORE_KEY];
  if (!st || typeof st !== "object") {
    g.extra[STORE_KEY] = { nodes_list: "KSampler", nodes_exclude_list: "", sorting_mode: "By name", cfg_step: 0.5, denoise_step: 0.05, change_delay: 300 };
    return g.extra[STORE_KEY];
  }
  if (typeof st.nodes_list !== "string") st.nodes_list = "KSampler";
  if (typeof st.nodes_exclude_list !== "string") st.nodes_exclude_list = "";
  if (st.sorting_mode !== "By name" && st.sorting_mode !== "By order in list") {
    st.sorting_mode = "By name";
  }
  return st;
}

function mkLabel(text) {
  const l = document.createElement("div");
  l.textContent = text;
  l.style.fontSize = `${LABEL_FONT_SIZE_PX}px`;
  l.style.opacity = "0.85";
  l.style.margin = "10px 0 6px";
  return l;
}

function mkSelect(options) {
  const s = document.createElement("select");
  s.style.width = "100%";
  s.style.boxSizing = "border-box";
  s.style.padding = "6px 8px";
  s.style.borderRadius = "8px";
  s.style.border = "1px solid rgba(255,255,255,0.14)";
  s.style.background = "rgba(0,0,0,0.35)";
  s.style.color = "rgba(255,255,255,0.92)";

  for (const opt of options) {
    const o = document.createElement("option");
    o.value = opt;
    o.textContent = opt;
    o.style.background = "#1b1b1b";
    o.style.color = "rgba(255,255,255,0.92)";
    s.appendChild(o);
  }

  return s;
}


function mkInput() {
  const i = document.createElement("input");
  i.type = "text";
  i.style.width = "100%";
  i.style.boxSizing = "border-box";
  i.style.padding = "6px 8px";
  i.style.borderRadius = "8px";
  i.style.border = "1px solid rgba(255,255,255,0.14)";
  i.style.background = "rgba(0,0,0,0.35)";
  i.style.color = "rgba(255,255,255,0.92)";
  i.style.fontFamily = "inherit";
  i.style.fontSize = "12px";
  return i;
}
function mkTextarea() {
  const t = document.createElement("textarea");
  t.rows = 6;
  t.style.width = "100%";
  t.style.minHeight = "120px";
  t.style.resize = "vertical";
  t.style.boxSizing = "border-box";
  t.style.padding = "8px";
  t.style.borderRadius = "8px";
  t.style.border = "1px solid rgba(255,255,255,0.14)";
  t.style.background = "rgba(255,255,255,0.06)";
  t.style.color = "inherit";
  t.style.fontFamily = "inherit";
  t.style.fontSize = "12px";
  return t;
}

export function renderSettingsPanel(el) {
  el.innerHTML = "";
  el.style.padding = "10px";

  const st = getStore();

  const nodesLabel = mkLabel("List nodes to control:");
  const nodesText = mkTextarea();
  nodesText.value = st.nodes_list;

  
  const excludeLabel = mkLabel("List nodes to exclude:");
  const excludeText = mkTextarea();
  excludeText.value = st.nodes_exclude_list;

const sortingLabel = mkLabel("Sorting mode:");
  const sortingSelect = mkSelect(["By name", "By order in list"]);
  sortingSelect.value = st.sorting_mode;

  const cfgStepLabel = mkLabel("Cfg step:");
  const cfgStepInput = mkInput();
  cfgStepInput.value = String(st.cfg_step);

  const denoiseStepLabel = mkLabel("Denoise step:");
  const denoiseStepInput = mkInput();
  denoiseStepInput.value = String(st.denoise_step);

  const changeDelayLabel = mkLabel("Change delay:");
  const changeDelayInput = mkInput();
  changeDelayInput.value = String(st.change_delay);

  let saveTimer = 0;
  const scheduleSave = () => {
    if (saveTimer) window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => {
      saveTimer = 0;
      const s = getStore();
      s.nodes_list = String(nodesText.value ?? "");
      s.nodes_exclude_list = String(excludeText.value ?? "");
      const mode = String(sortingSelect.value ?? "By name");
      s.sorting_mode = mode === "By order in list" ? "By order in list" : "By name";

      const csRaw = String(cfgStepInput.value ?? "").trim();
      const cs = Number(csRaw);
      s.cfg_step = Number.isFinite(cs) && cs > 0 ? cs : 0.5;
      cfgStepInput.value = String(s.cfg_step);

      const dsRaw = String(denoiseStepInput.value ?? "").trim();
      const ds = Number(dsRaw);
      s.denoise_step = Number.isFinite(ds) && ds > 0 ? ds : 0.05;
      denoiseStepInput.value = String(s.denoise_step);

      const cdRaw = String(changeDelayInput.value ?? "").trim();
      const cd = Number(cdRaw);
      s.change_delay = Number.isFinite(cd) && cd >= 0 ? Math.trunc(cd) : 300;
      changeDelayInput.value = String(s.change_delay);

      const g = app?.graph;
      if (g) {
        if (typeof g.setDirtyCanvas === "function") g.setDirtyCanvas(true, true);
        if (typeof g.change === "function") g.change();
      }
    }, 150);
  };

  nodesText.addEventListener("input", scheduleSave);
  excludeText.addEventListener("input", scheduleSave);
  sortingSelect.addEventListener("change", scheduleSave);
  cfgStepInput.addEventListener("input", scheduleSave);
  denoiseStepInput.addEventListener("input", scheduleSave);
  changeDelayInput.addEventListener("input", scheduleSave);

  el.appendChild(nodesLabel);
  el.appendChild(nodesText);
  el.appendChild(excludeLabel);
  el.appendChild(excludeText);
  el.appendChild(sortingLabel);
  el.appendChild(sortingSelect);
  el.appendChild(cfgStepLabel);
  el.appendChild(cfgStepInput);
  el.appendChild(denoiseStepLabel);
  el.appendChild(denoiseStepInput);
  el.appendChild(changeDelayLabel);
  el.appendChild(changeDelayInput);
}
