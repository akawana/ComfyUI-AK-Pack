import { app } from "../../scripts/app.js";

const GRP_STORE_KEY = "ak_mscp_groups";

export function getGroupsStore() {
    const g = app?.graph;
    if (!g) return { bypass_list: "", mute_list: "", sorting_mode: "By name" };
    if (!g.extra) g.extra = {};
    if (!g.extra[GRP_STORE_KEY] || typeof g.extra[GRP_STORE_KEY] !== "object") {
        g.extra[GRP_STORE_KEY] = { bypass_list: "", mute_list: "", sorting_mode: "By name" };
    }
    const st = g.extra[GRP_STORE_KEY];
    if (typeof st.bypass_list !== "string") st.bypass_list = "";
    if (typeof st.mute_list   !== "string") st.mute_list   = "";
    if (st.sorting_mode !== "By name" && st.sorting_mode !== "By order in list") st.sorting_mode = "By name";
    return st;
}

function mkLabel(text) {
    const l = document.createElement("div");
    l.textContent = text;
    l.style.fontSize = "14px";
    l.style.opacity = "0.85";
    l.style.margin = "10px 0 6px";
    return l;
}

function mkSelect(options, value) {
    const s = document.createElement("select");
    s.style.cssText = "width:100%;box-sizing:border-box;padding:6px 8px;border-radius:8px;border:1px solid rgba(255,255,255,0.14);background:rgba(0,0,0,0.35);color:rgba(255,255,255,0.92);";
    for (const opt of options) {
        const o = document.createElement("option");
        o.value = opt;
        o.textContent = opt;
        o.style.background = "#1b1b1b";
        s.appendChild(o);
    }
    s.value = value;
    return s;
}

function mkTextarea(value) {
    const t = document.createElement("textarea");
    t.rows = 6;
    t.value = value || "";
    t.style.cssText = "width:100%;min-height:120px;resize:vertical;box-sizing:border-box;padding:8px;border-radius:8px;border:1px solid rgba(255,255,255,0.14);background:rgba(255,255,255,0.06);color:inherit;font-family:inherit;font-size:12px;";
    return t;
}

export function renderGroupsSettingsPanel(el) {
    el.innerHTML = "";
    el.style.padding = "10px";

    const st = getGroupsStore();

    const bypassLabel    = mkLabel("List Groups and Nodes to Bypass:");
    const bypassTextarea = mkTextarea(st.bypass_list);

    const muteLabel    = mkLabel("List Groups and Nodes to Mute:");
    const muteTextarea = mkTextarea(st.mute_list);

    const sortingLabel  = mkLabel("Sorting mode:");
    const sortingSelect = mkSelect(["By name", "By order in list"], st.sorting_mode);

    let saveTimer = 0;
    const scheduleSave = () => {
        if (saveTimer) window.clearTimeout(saveTimer);
        saveTimer = window.setTimeout(() => {
            saveTimer = 0;
            const s = getGroupsStore();
            s.bypass_list  = String(bypassTextarea.value ?? "");
            s.mute_list    = String(muteTextarea.value   ?? "");
            s.sorting_mode = sortingSelect.value === "By order in list" ? "By order in list" : "By name";

            const g = app?.graph;
            if (g) {
                if (typeof g.setDirtyCanvas === "function") g.setDirtyCanvas(true, true);
                if (typeof g.change         === "function") g.change();
            }
        }, 150);
    };

    bypassTextarea.addEventListener("input", scheduleSave);
    muteTextarea.addEventListener("input",   scheduleSave);
    sortingSelect.addEventListener("change", scheduleSave);

    el.appendChild(bypassLabel);
    el.appendChild(bypassTextarea);
    el.appendChild(muteLabel);
    el.appendChild(muteTextarea);
    el.appendChild(sortingLabel);
    el.appendChild(sortingSelect);
}
