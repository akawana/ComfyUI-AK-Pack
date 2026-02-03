import { app } from "../../scripts/app.js";
import { renderControlPanel } from "./AKMultipleSamplersControlPanel_Control.js";
import { renderSettingsPanel } from "./AKMultipleSamplersControlPanel_Settings.js";

const TAB_ID = "ak-multiple-samplers-control";
const TITLE = "Samplers";
const TOOLTIP = "Multiple Samplers control";
const ICON_CLASS = "ak-mscp-icon";
const ICON_URL_OFF = new URL("./img/i_toolbal_control_off.png", import.meta.url).toString();
const ICON_URL_ON = new URL("./img/i_toolbal_control_on.png", import.meta.url).toString();

const STORE_KEY = "ak_multiple_samplers_control_panel";

const SETTINGS_ENABLE_ID = "A⁠K.MultipleSamplersControl.Enable";
const ENABLE_STYLE_ID = "ak-mscp-enabled-visibility-style";

function getUiSettings() {
  return app?.ui?.settings || null;
}

function readEnableSettingFallback() {
  try {
    const raw = window.localStorage.getItem(SETTINGS_ENABLE_ID);
    if (raw === "true") return true;
    if (raw === "false") return false;
  } catch (_) {}
  return true;
}

function isFeatureEnabled() {
  const settings = getUiSettings();
  const getSetting = typeof settings?.getSettingValue === "function" ? settings.getSettingValue.bind(settings) : null;
  if (getSetting) {
    try {
      const v = getSetting(SETTINGS_ENABLE_ID);
      if (typeof v === "boolean") return v;
    } catch (_) {}
  }
  return readEnableSettingFallback();
}

function ensureEnableSettingRegistered(applyFn) {
  const settings = getUiSettings();
  const addSetting = typeof settings?.addSetting === "function" ? settings.addSetting.bind(settings) : null;
  if (!addSetting) return;

  try {
    addSetting({
      id: SETTINGS_ENABLE_ID,
      name: "Enable",
      type: "boolean",
      defaultValue: true,
      category: ["AK", "Multiple Samplers Control"],
      onChange: (v) => {
        try { applyFn(v === true); } catch (_) {}
      },
    });
  } catch (_) {}
}

function applyEnabledState(enabled) {
  const on = enabled === true;

  let style = document.getElementById(ENABLE_STYLE_ID);
  if (!style) {
    style = document.createElement("style");
    style.id = ENABLE_STYLE_ID;
    document.head.appendChild(style);
  }

  style.textContent = on ? "" : `
    .${TAB_ID}-tab-button { display: none !important; }
  `;

  if (!on) closeThisTab();
}

function getStore() {
  const g = app?.graph;
  if (!g) return { nodes_list: "KSampler", nodes_exclude_list: "", sorting_mode: "By name", selected_sampler_id: "", cfg_step: 0.5, denoise_step: 0.05, change_delay: 300 };
  if (!g.extra) g.extra = {};
  const st = g.extra[STORE_KEY];
  if (!st || typeof st !== "object") {
    g.extra[STORE_KEY] = { nodes_list: "KSampler", nodes_exclude_list: "", sorting_mode: "By name", selected_sampler_id: "", cfg_step: 0.5, denoise_step: 0.05, change_delay: 300 };
    return g.extra[STORE_KEY];
  }
  if (typeof st.nodes_list !== "string") st.nodes_list = "";
  if (st.sorting_mode !== "By name" && st.sorting_mode !== "By order in list") st.sorting_mode = "By name";
  if (typeof st.selected_sampler_id !== "string") st.selected_sampler_id = "";
  return st;
}

function tokenizeNodesList(text) {
  const raw = String(text ?? "");
  return raw
    .split(/[\n,;]+/g)
    .map(s => s.trim())
    .filter(Boolean);
}

function getAllGraphNodes() {
  const g = app?.graph;
  const arr = g?._nodes || g?.nodes || [];
  return Array.isArray(arr) ? arr : [];
}

function isIntToken(tok) {
  if (!tok) return false;
  if (!/^[0-9]+$/.test(tok)) return false;
  const n = Number(tok);
  return Number.isFinite(n) && Math.trunc(n) === n;
}

function naturalCompare(a, b) {
  const ax = String(a ?? "").toLowerCase().match(/\d+|\D+/g) || [];
  const bx = String(b ?? "").toLowerCase().match(/\d+|\D+/g) || [];
  const n = Math.min(ax.length, bx.length);
  for (let i = 0; i < n; i++) {
    const as = ax[i], bs = bx[i];
    const an = /^[0-9]+$/.test(as) ? Number(as) : null;
    const bn = /^[0-9]+$/.test(bs) ? Number(bs) : null;
    if (an !== null && bn !== null) {
      if (an !== bn) return an - bn;
    } else {
      if (as !== bs) return as < bs ? -1 : 1;
    }
  }
  return ax.length - bx.length;
}

function findNodesFromNodesList(nodesListText) {
  const nodes = getAllGraphNodes();
  const tokens = tokenizeNodesList(nodesListText);

  const byId = new Map(nodes.map(n => [n?.id, n]));
  const seen = new Set();
  const out = [];

  for (const tok of tokens) {
    if (isIntToken(tok)) {
      const id = Number(tok);
      const n = byId.get(id);
      if (n && !seen.has(n.id)) {
        seen.add(n.id);
        out.push({ node: n, order: out.length });
      }
      continue;
    }

    const sub = tok.toLowerCase();
    for (const n of nodes) {
      const title = String(n?.title ?? "");
      if (!title) continue;
      if (title.toLowerCase().includes(sub)) {
        if (!seen.has(n.id)) {
          seen.add(n.id);
          out.push({ node: n, order: out.length });
        }
      }
    }
  }

  return out.map(x => x.node);
}

function getControlledNodes() {
  const st = getStore();
  const nodes = findNodesFromNodesList(st.nodes_list);
  const excluded = findNodesFromNodesList(st.nodes_exclude_list);
  const exIds = new Set(excluded.map(n => n?.id));
  const filtered = nodes.filter(n => n && !exIds.has(n.id));

  if (st.sorting_mode === "By order in list") {
    return filtered;
  }

  return filtered.slice().sort((a, b) => {
    const ta = String(a?.title ?? "");
    const tb = String(b?.title ?? "");
    const c = naturalCompare(ta, tb);
    if (c !== 0) return c;
    return (a?.id ?? 0) - (b?.id ?? 0);
  });
}

let registered = false;

function injectIconStyle() {
  if (document.getElementById("ak-mscp-icon-style")) return;
  const style = document.createElement("style");
  style.id = "ak-mscp-icon-style";
  style.textContent = `
    .side-bar-button-icon.${ICON_CLASS} {
      background-image: url("${ICON_URL_OFF}");
      background-repeat: no-repeat;
      background-position: center;
      background-size: 18px 18px;
      width: 1.2em;
      height: 1.2em;
    }
    .${TAB_ID}-tab-button:hover .side-bar-button-icon.${ICON_CLASS} {
      background-image: url("${ICON_URL_ON}");
    }
  `;
  document.head.appendChild(style);
}

function closeThisTab() {
  const em = app?.extensionManager;
  if (!em) return;

  if (typeof em.setActiveSidebarTab === "function") {
    em.setActiveSidebarTab(null);
    return;
  }

  if (typeof em.activateSidebarTab === "function") {
    em.activateSidebarTab(null);
    return;
  }

  const icon = document.querySelector(`.side-bar-button-icon.${ICON_CLASS}`);
  const btn = icon?.closest("button");
  if (btn) btn.click();
}

function renderPanel(el) {
  el.innerHTML = "";

if (!isFeatureEnabled()) {
  const msg = document.createElement("div");
  msg.style.padding = "12px 10px";
  msg.style.fontSize = "13px";
  msg.style.opacity = "0.9";
  msg.textContent = "Disabled. Enable it in Settings: AK → Multiple Samplers Control → Enable.";
  el.appendChild(msg);
  return;
}


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

  closeBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    closeThisTab();
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

  const mkTabBtn = (label) => {
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
  };

  const btnControl = mkTabBtn("Control");
  const btnSettings = mkTabBtn("Settings");

  const setActive = (which) => {
    const isControl = which === "control";
    btnControl.style.background = isControl ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.06)";
    btnSettings.style.background = !isControl ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.06)";
    btnControl.style.borderColor = isControl ? "rgba(255,255,255,0.24)" : "rgba(255,255,255,0.14)";
    btnSettings.style.borderColor = !isControl ? "rgba(255,255,255,0.24)" : "rgba(255,255,255,0.14)";

    content.innerHTML = "";
    if (isControl) renderControlPanel(content, { getStore, getControlledNodes });
    else renderSettingsPanel(content);
  };

  btnControl.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    setActive("control");
  });

  btnSettings.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    setActive("settings");
  });

  tabsBar.appendChild(btnControl);
  tabsBar.appendChild(btnSettings);
  el.appendChild(tabsBar);
  el.appendChild(content);

  setActive("control");
}

app.registerExtension({
  name: "AK.MultipleSamplersControlPanel",
  async setup() {
    if (registered) return;

    const em = app?.extensionManager;
    if (!em?.registerSidebarTab) return;

    ensureEnableSettingRegistered(applyEnabledState);
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
    applyEnabledState(isFeatureEnabled());
  },
});
