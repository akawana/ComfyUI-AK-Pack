import { app } from "../../scripts/app.js";
export const AK_PSP_VALUE_KEY = "ak_project_settings_values";
export const STORE_KEY = "ak_project_settings_enable_options";
export const DEFAULT_ENABLE = {
  output_filename: true,
  open_image: true,
  output_subfolder: true,
  width_height: true,
  do_resize: true,
  open_image: true,
};

export const AK_PSP_DEFAULTS = {
  output_filename: "",
  output_subfolder: "",
  width: 512,
  height: 512,
  do_resize: 1,
  open_image: "",
  open_image_filename: "",
  // open_image_stem: "",
  // open_image_relpath: "",
  open_image_subfolder: "",
  open_image_type: "input",
};


const TAB_ID = "ak-project-settings";
const TITLE = "Project";
const TOOLTIP = "Project Settings";
const ICON_CLASS = "ak-psp-icon";

const ICON_URL_OFF = "/extensions/ComfyUI-AK-Pack/img/i_toolbal_project_settings_off.png";
const ICON_URL_ON = "/extensions/ComfyUI-AK-Pack/img/i_toolbal_project_settings_on.png";

const SETTINGS_ENABLE_ID = "ak_project_settings_panel_enable";
let enabledGlobally = true;

let registered = false;

export function getGraphExtra() {
  const g = app && app.graph ? app.graph : null;
  if (!g) return null;
  if (!g.extra) g.extra = {};
  return g.extra;
}

export function toInt(v, dflt) {
  const n = Number(v);
  if (!Number.isFinite(n)) return dflt;
  return Math.trunc(n);
}

export function readProjectSettingsValues() {
  const extra = getGraphExtra();
  const raw = extra && extra[AK_PSP_VALUE_KEY] ? extra[AK_PSP_VALUE_KEY] : null;

  const st = Object.assign(
    {},
    AK_PSP_DEFAULTS,
    raw && typeof raw === "object" ? raw : {}
  );

  st.output_filename = String(st.output_filename ?? "");
  st.output_subfolder = String(st.output_subfolder ?? "");
  st.width = toInt(st.width, AK_PSP_DEFAULTS.width);
  st.height = toInt(st.height, AK_PSP_DEFAULTS.height);
  st.do_resize = toInt(st.do_resize, AK_PSP_DEFAULTS.do_resize);
  st.open_image = String(st.open_image ?? "");
  st.open_image_filename = String(st.open_image_filename ?? "");
  // st.open_image_stem = String(st.open_image_stem ?? "");
  // st.open_image_relpath = String(st.open_image_relpath ?? "");
  st.open_image_subfolder = String(st.open_image_subfolder ?? "");
  st.open_image_type = String(st.open_image_type ?? "input");

  return st;
}

export function writeProjectSettingsValues(next) {
  const extra = getGraphExtra();
  if (!extra) return;

  extra[AK_PSP_VALUE_KEY] = {
    output_filename: String(next.output_filename ?? ""),
    output_subfolder: String(next.output_subfolder ?? ""),
    width: toInt(next.width, AK_PSP_DEFAULTS.width),
    height: toInt(next.height, AK_PSP_DEFAULTS.height),
    do_resize: toInt(next.do_resize, AK_PSP_DEFAULTS.do_resize),
    open_image: String(next.open_image ?? ""),
    open_image_filename: String(next.open_image_filename ?? ""),
    // open_image_stem: String(next.open_image_stem ?? ""),
    // open_image_relpath: String(next.open_image_relpath ?? ""),
    open_image_subfolder: String(next.open_image_subfolder ?? ""),
    open_image_type: String(next.open_image_type ?? "input"),
  };
}


function injectIconStyle() {
  if (document.getElementById("ak-psp-icon-style")) return;

  const style = document.createElement("style");
  style.id = "ak-psp-icon-style";
  style.textContent =
    ".side-bar-button-icon." + ICON_CLASS + "{" +
    "background-image:url(\"" + ICON_URL_OFF + "\");" +
    "background-repeat:no-repeat;" +
    "background-position:center;" +
    "background-size:18px 18px;" +
    "width:1.2em;" +
    "height:1.2em;" +
    "}" +
    "." + TAB_ID + "-tab-button:hover .side-bar-button-icon." + ICON_CLASS + "{" +
    "background-image:url(\"" + ICON_URL_ON + "\");" +
    "}";

  document.head.appendChild(style);
}

function tryCloseSidebarTab() {
  if (!app) return;

  const em = app.extensionManager;
  if (em && typeof em.setActiveSidebarTab === "function") {
    em.setActiveSidebarTab(null);
    return;
  }

  if (em && typeof em.activateSidebarTab === "function") {
    em.activateSidebarTab(null);
    return;
  }

  const icon = document.querySelector(".side-bar-button-icon." + ICON_CLASS);
  const btn = icon ? icon.closest("button") : null;
  if (btn) btn.click();
}

function renderPanel(el) {
  if (!enabledGlobally) {
    el.textContent = "";
    el.style.display = "none";
    return;
  }
  el.style.display = "";
  el.innerHTML = "";

  const header = document.createElement("div");
  header.style.display = "flex";
  header.style.alignItems = "center";
  header.style.justifyContent = "space-between";
  header.style.padding = "10px";
  header.style.borderBottom = "1px solid rgba(255,255,255,0.08)";

  const title = document.createElement("div");
  title.textContent = TOOLTIP;
  title.style.fontSize = "14px";
  title.style.fontWeight = "600";

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.textContent = "×";
  closeBtn.style.width = "28px";
  closeBtn.style.height = "28px";
  closeBtn.style.cursor = "pointer";

  closeBtn.addEventListener("click", function (e) {
    e.preventDefault();
    e.stopPropagation();
    tryCloseSidebarTab();
  });

  header.appendChild(title);
  header.appendChild(closeBtn);
  el.appendChild(header);

  const tabsBar = document.createElement("div");
  tabsBar.style.display = "flex";
  tabsBar.style.gap = "6px";
  tabsBar.style.padding = "8px 10px";
  tabsBar.style.borderBottom = "1px solid rgba(255,255,255,0.08)";
  tabsBar.style.justifyContent = "center";

  const content = document.createElement("div");
  content.style.padding = "10px";
  content.style.fontSize = "13px";

  function mkTabBtn(label) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    b.style.padding = "6px 10px";
    b.style.borderRadius = "8px";
    b.style.cursor = "pointer";
    b.style.border = "1px solid rgba(255,255,255,0.14)";
    b.style.background = "rgba(255,255,255,0.06)";
    b.style.color = "inherit";
    return b;
  }

  const btnProject = mkTabBtn("Project");
  const btnSettings = mkTabBtn("Settings");

  function setActive(which) {
    const isProject = which === "project";

    btnProject.style.background = isProject ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.06)";
    btnSettings.style.background = !isProject ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.06)";

    btnProject.style.borderColor = isProject ? "rgba(255,255,255,0.24)" : "rgba(255,255,255,0.14)";
    btnSettings.style.borderColor = !isProject ? "rgba(255,255,255,0.24)" : "rgba(255,255,255,0.14)";

    content.innerHTML = "";

    if (isProject) {
      import("./AKProjectSettingsPanel_Project.js").then((m) => {
        if (m && typeof m.renderProjectTab === "function") m.renderProjectTab(content);
      });
    } else {
      import("./AKProjectSettingsPanel_Settings.js").then((m) => {
        if (m && typeof m.renderSettingsTab === "function") m.renderSettingsTab(content);
      });
    }
  }

  btnProject.addEventListener("click", function (e) {
    e.preventDefault();
    e.stopPropagation();
    setActive("project");
  });

  btnSettings.addEventListener("click", function (e) {
    e.preventDefault();
    e.stopPropagation();
    setActive("settings");
  });

  tabsBar.appendChild(btnProject);
  tabsBar.appendChild(btnSettings);
  el.appendChild(tabsBar);
  el.appendChild(content);

  setActive("project");
}


function applyEnabled(on) {
  enabledGlobally = on === true;

  try {
    const btns = document.getElementsByClassName("ak-project-settings-tab-button");
    for (const b of btns) {
      if (b && b.style) b.style.display = enabledGlobally ? "" : "none";
    }
  } catch (_) { }

  if (!enabledGlobally) {
    try {
      const btn = document.querySelector(".ak-project-settings-tab-button");
      if (btn && btn.classList && btn.classList.contains("active")) {
        const other = document.querySelector(".side-bar-button.active:not(.ak-project-settings-tab-button)") ||
          document.querySelector(".side-bar-button:not(.ak-project-settings-tab-button)");
        if (other && typeof other.click === "function") other.click();
      }
    } catch (_) { }

    try {
      const els = [
        document.getElementById("ak-project-settings"),
        document.querySelector(".ak-project-settings-tab"),
        document.querySelector(".ak-project-settings-tab-content"),
        document.querySelector("#ak-project-settings-tab"),
        document.querySelector("#ak-project-settings-content"),
      ];
      for (const el of els) {
        if (el && el.style) el.style.display = "none";
      }
    } catch (_) { }
  }
}

function installEnableSetting() {
  let addSetting = null;
  try { addSetting = app?.ui?.settings?.addSetting; } catch (_) { }
  if (!addSetting) {
    try { addSetting = app?.settings?.addSetting; } catch (_) { }
  }
  if (typeof addSetting !== "function") return;

  try {
    addSetting({
      id: SETTINGS_ENABLE_ID,
      name: "Enable",
      type: "boolean",
      defaultValue: true,
      category: ["AK", "Project Settings Panel"],
      onChange: (v) => {
        try { applyEnabled(v === true); } catch (_) { }
      },
    });
  } catch (_) { }
}

function hideWidget(node) {
  if (!node?.widgets) return;

  for (const w of node.widgets) {
    if (w.name === "ak_project_settings_json") {
      w.type = "hidden";
      w.hidden = true;

      w.computeSize = () => [0, 0];

      if (w.inputEl) {
        w.inputEl.style.display = "none";
        w.inputEl.style.height = "0px";
        w.inputEl.style.minHeight = "0px";
        w.inputEl.style.maxHeight = "0px";
        w.inputEl.style.padding = "0";
        w.inputEl.style.margin = "0";
      }
    }
  }

  if (typeof node.setSize === "function") {
    node.setSize([node.size[0], node.size[1]]);
  }
}

const VALUE_KEY = "ak_project_settings_values";
const ENABLE_KEY = "ak_project_settings_enable_options";
const TARGET_NODE = "AKProjectSettingsOut";


function syncNode(node) {
  const extra = app.graph?.extra || {};
  const vals = extra[VALUE_KEY] || {};
  const json = JSON.stringify(vals);

  const w = node.widgets?.find(w => w.name === "ak_project_settings_json");
  if (w) w.value = json;

  // if (w) {
  //   w.value = json;

  //   try {
  //     const dbg = JSON.parse(json);
  //     console.log(
  //       "[AKProjectSettings] image meta in json:",
  //       {
  //         open_image_filename: dbg.open_image_filename,
  //         open_image_stem: dbg.open_image_stem,
  //         open_image_relpath: dbg.open_image_relpath,
  //       }
  //     );
  //   } catch (e) {
  //     console.warn("[AKProjectSettings] invalid json in widget", e);
  //   }
  // }

  // console.log("Syncing AKProjectSettingsOut json:", json);

  // hideWidget(node);

  // const en = extra[ENABLE_KEY] || {};
  // const hideImage = en.open_image === false;

  // for (const o of node.outputs || []) {
  //   if (["image", "image_filename", "image_path"].includes(o.name)) {
  //     o.hidden = hideImage;
  //   }
  // }

  // node.setDirtyCanvas(true, true);
}

export function syncAllProjectSettingsOutNodes() {
  const nodes = app?.graph?._nodes || [];
  for (const n of nodes) {
    if (n?.comfyClass === TARGET_NODE) {
      syncNode(n);
    }
  }
}

export function applyOutputsVisibility(enableMap) {
  if (!enableMap || typeof enableMap !== "object") return;

  const GROUP_TO_OUTPUTS = {
    output_filename: ["output_filename"],
    output_subfolder: ["output_subfolder"],
    width_height: ["width", "height"],
    do_resize: ["do_resize"],
    open_image: ["image", "image_filename", "image_path"],
  };

  // build allow-set by groups (default: enabled unless explicitly false)
  const allow = new Set();
  for (const [groupKey, outs] of Object.entries(GROUP_TO_OUTPUTS)) {
    if (enableMap[groupKey] !== false) {
      for (const n of outs) allow.add(n);
    }
  }

  const g = app?.graph;
  const nodes = g?._nodes || [];
  const glinks = g?.links || null;

  for (const node of nodes) {
    if (node?.comfyClass !== TARGET_NODE) continue;
    if (!Array.isArray(node.outputs)) continue;

    // Snapshot FULL canonical outputs list ONCE.
    // IMPORTANT: this list must NEVER change order/length afterward,
    // because Python execution relies on output slot indices.
    if (!node.__ak_all_outputs) {
      node.__ak_all_outputs = node.outputs.slice();
    }

    const all = node.__ak_all_outputs;

    // Ensure node.outputs points to the canonical list (full list, stable indices)
    node.outputs = all;

    // 1) Mark outputs as hidden/visible WITHOUT changing indices
    // (ComfyUI/LiteGraph usually respects "hidden" for slot rendering in many builds.
    // If your build ignores it, you'll need a draw patch; indices must still remain stable.)
    for (const out of all) {
      const name = out?.name != null ? String(out.name) : "";
      const isAllowed = !!name && allow.has(name);
      out.hidden = !isAllowed;
      out._ak_hidden = !isAllowed; // extra flag for custom draw patches if needed
    }

    // 2) Fix links:
    //    - If an origin output is now hidden => remove that link.
    //    - DO NOT rewrite origin_slot for visible links (indices must stay canonical).
    if (glinks) {
      for (const k in glinks) {
        const lid = Number(k);
        const L = glinks[k];
        if (!L) continue;
        if (L.origin_id !== node.id) continue;

        const slot = L.origin_slot;
        const out = all[slot];
        const outName = out?.name != null ? String(out.name) : "";

        if (!outName || !allow.has(outName)) {
          try { g?.removeLink?.(lid); } catch (_) { }
        }
      }
    }

    // 3) Rebuild each output.links array from graph.links (keeps UI consistent)
    for (const out of all) out.links = null;

    if (glinks) {
      for (const k in glinks) {
        const lid = Number(k);
        const L = glinks[k];
        if (!L) continue;
        if (L.origin_id !== node.id) continue;

        const slot = L.origin_slot;
        const out = all[slot];
        if (!out) continue;

        if (!Array.isArray(out.links)) out.links = [];
        out.links.push(lid);
      }
    }

    node.setDirtyCanvas?.(true, true);
  }

  g?.setDirtyCanvas?.(true, true);
}



function getEnableMapFromGraphExtra() {
  const extra = getGraphExtra();
  const raw = extra && extra[STORE_KEY] ? extra[STORE_KEY] : null;

  return Object.assign({}, DEFAULT_ENABLE, raw && typeof raw === "object" ? raw : {});
}


app.registerExtension({
  name: "AK.ProjectSettingsPanel",
  setup: function () {
    if (registered) return;
    installEnableSetting();
    applyEnabled(enabledGlobally);


    const em = app && app.extensionManager ? app.extensionManager : null;
    if (!em || typeof em.registerSidebarTab !== "function") return;

    injectIconStyle();

    em.registerSidebarTab({
      id: TAB_ID,
      title: TITLE,
      tooltip: TOOLTIP,
      icon: ICON_CLASS,
      type: "custom",
      render: renderPanel,
    });

    registered = true;
  },
  nodeCreated(node) {
    if (node?.comfyClass === TARGET_NODE) {
      syncNode(node);
      queueMicrotask(() => hideWidget(node));
    }
  },

  loadedGraphNode(node) {
    if (node?.comfyClass === TARGET_NODE) {
      syncNode(node);
      queueMicrotask(() => {
        hideWidget(node);
        // applyOutputsVisibility(getEnableMapFromGraphExtra());
      });

    }
  },
});