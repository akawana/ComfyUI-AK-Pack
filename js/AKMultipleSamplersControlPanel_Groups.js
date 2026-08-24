import { app } from "../../scripts/app.js";
import { getGroupsStore } from "./AKMultipleSamplersControlPanel_GroupsSettings.js";

// ── Graph lookup helpers ──────────────────────────────────────────────────────

function getAllGraphNodes() {
    const g = app?.graph;
    const arr = g?._nodes || g?.nodes || [];
    return Array.isArray(arr) ? arr : [];
}

function getAllGraphGroups() {
    const g = app?.graph;
    const arr = g?._groups || g?.groups || [];
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
        if (an !== null && bn !== null) { if (an !== bn) return an - bn; }
        else { if (as !== bs) return as < bs ? -1 : 1; }
    }
    return ax.length - bx.length;
}

function tokenizeList(text) {
    return String(text ?? "").split(/[\n,;]+/g).map(s => s.trim()).filter(Boolean);
}

// Returns array of { kind: "node"|"group", id, label, ref }
function resolveTargets(listText, sortingMode) {
    const tokens = tokenizeList(listText);
    if (!tokens.length) return [];

    const nodes = getAllGraphNodes();
    const groups = getAllGraphGroups();
    const byNodeId = new Map(nodes.map(n => [n?.id, n]));
    const seen = new Set();
    const out = [];

    for (const tok of tokens) {
        if (isIntToken(tok)) {
            const id = tok;
            // const id = Number(tok);
            const n = byNodeId.get(id);
            if (n && !seen.has(`node:${n.id}`)) {
                seen.add(`node:${n.id}`);
                out.push({ kind: "node", id: n.id, label: n.title || n.type || String(n.id), ref: n, order: out.length });
            }
            continue;
        }

        const sub = tok.toLowerCase();

        // Match groups by title — groups have priority over nodes
        let groupFound = false;
        for (const grp of groups) {
            const title = String(grp?.title ?? "");
            if (!title) continue;
            if (!title.toLowerCase().includes(sub)) continue;
            const key = `group:${title}`;
            if (seen.has(key)) continue;
            seen.add(key);
            out.push({ kind: "group", id: key, label: title, ref: grp, order: out.length });
            groupFound = true;
        }

        // Match nodes by title/type — only if no group matched this token
        if (!groupFound) {
            const nodeMatches = [];
            for (const n of nodes) {
                const t = String(n?.title ?? n?.type ?? n?.constructor?.title ?? "");
                if (!t || !t.toLowerCase().includes(sub) || seen.has(`node:${n.id}`)) continue;
                nodeMatches.push({ kind: "node", id: n.id, label: n.title || n.type || String(n.id), ref: n, order: out.length });
            }
            nodeMatches.sort((a, b) => naturalCompare(a.label, b.label) || (a.id - b.id));
            for (const m of nodeMatches) {
                seen.add(`node:${m.id}`);
                out.push({ ...m, order: out.length });
            }
        }
    }

    if (sortingMode === "By name") {
        out.sort((a, b) => naturalCompare(a.label, b.label));
    }

    return out;
}

// ── Mode helpers ──────────────────────────────────────────────────────────────

function getNodeMode(ref) {
    return ref?.mode ?? 0; // 0=active, 2=bypass, 4=mute
}

function setNodeMode(ref, mode) {
    if (ref?.mode === undefined) return;
    ref.mode = mode;
    ref.setDirtyCanvas?.(true, true);
}

function getGroupMode(grp) {
    // Groups don't have a single mode — check if all nodes inside are in that mode
    const g = app?.graph;
    if (!g) return 0;
    const nodesInGroup = getAllGraphNodes().filter(n => grp._nodes?.includes(n) || isNodeInGroup(n, grp));
    if (!nodesInGroup.length) return 0;
    const modes = nodesInGroup.map(n => n.mode ?? 0);
    if (modes.every(m => m === 2)) return 2; // all bypassed
    if (modes.every(m => m === 4)) return 4; // all muted
    return 0;
}

function isNodeInGroup(node, grp) {
    if (!node || !grp) return false;
    const [gx, gy, gw, gh] = [grp.pos?.[0] ?? grp.x, grp.pos?.[1] ?? grp.y, grp.size?.[0] ?? grp.width, grp.size?.[1] ?? grp.height];
    const nx = node.pos?.[0] ?? node.x;
    const ny = node.pos?.[1] ?? node.y;
    return nx >= gx && ny >= gy && nx <= gx + gw && ny <= gy + gh;
}

function setGroupMode(grp, mode) {
    const nodes = getAllGraphNodes().filter(n => isNodeInGroup(n, grp));
    for (const n of nodes) {
        n.mode = mode;
        n.setDirtyCanvas?.(true, true);
    }
}

function isActive(target) {
    if (target.kind === "node") return (getNodeMode(target.ref) === 0);
    if (target.kind === "group") return (getGroupMode(target.ref) === 0);
    return true;
}

function toggle(target, wantMode) {
    const currentMode = target.kind === "node"
        ? getNodeMode(target.ref)
        : getGroupMode(target.ref);
    const newMode = currentMode === wantMode ? 0 : wantMode;
    if (target.kind === "node") setNodeMode(target.ref, newMode);
    if (target.kind === "group") setGroupMode(target.ref, newMode);

    const g = app?.graph;
    if (g) {
        if (typeof g.setDirtyCanvas === "function") g.setDirtyCanvas(true, true);
        if (typeof g.change === "function") g.change();
    }
}

// ── Color helpers ─────────────────────────────────────────────────────────────

function getTargetColor(target) {
    const raw = target.ref?.color;
    if (!raw || typeof raw !== "string") return null;
    return raw;
}

// Parse hex color to r,g,b (0-255)
function hexToRgb(hex) {
    const h = hex.replace("#", "");
    if (h.length === 3) {
        return [
            parseInt(h[0] + h[0], 16),
            parseInt(h[1] + h[1], 16),
            parseInt(h[2] + h[2], 16),
        ];
    }
    if (h.length === 6) {
        return [
            parseInt(h.slice(0, 2), 16),
            parseInt(h.slice(2, 4), 16),
            parseInt(h.slice(4, 6), 16),
        ];
    }
    return null;
}

// Blend color toward gray (128,128,128) by ratio 0..1
function blendToGray(r, g, b, ratio) {
    const gray = 128;
    return [
        Math.round(r + (gray - r) * ratio),
        Math.round(g + (gray - g) * ratio),
        Math.round(b + (gray - b) * ratio),
    ];
}

function colorStyles(target, active) {
    const color = getTargetColor(target);
    const textColor = active ? "rgb(255,255,255)" : "rgb(153,153,153)";

    if (!color) {
        return active
            ? `background:rgba(77,163,255,0.25);border-color:rgba(77,163,255,0.5);color:${textColor};`
            : `background:rgba(255,255,255,0.06);border-color:rgba(255,255,255,0.14);color:${textColor};`;
    }

    const rgb = hexToRgb(color);
    if (!rgb) {
        return active
            ? `background:rgba(77,163,255,0.25);border-color:rgba(77,163,255,0.5);color:${textColor};`
            : `background:rgba(255,255,255,0.06);border-color:rgba(255,255,255,0.14);color:${textColor};`;
    }

    const [r, g, b] = rgb;

    if (active) {
        return `background:rgba(${r},${g},${b},0.3);border-color:rgba(${r},${g},${b},0.7);color:${textColor};`;
    } else {
        const [gr, gg, gb] = blendToGray(r, g, b, 0.6);
        return `background:rgba(${gr},${gg},${gb},0.12);border-color:rgba(${gr},${gg},${gb},0.3);color:${textColor};`;
    }
}

// ── UI helpers ────────────────────────────────────────────────────────────────

function mkLabel(text) {
    const l = document.createElement("div");
    l.textContent = text;
    l.style.fontSize = "14px";
    l.style.opacity = "0.85";
    l.style.margin = "10px 0 6px";
    return l;
}

function mkToggleBtn(label, active, target, onClick) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = label;
    btn.style.cssText = [
        "width:100%;",
        "text-align:left;",
        "padding:6px 10px;",
        "margin-bottom:4px;",
        "border-radius:8px;",
        "cursor:pointer;",
        "font-size:13px;",
        colorStyles(target, active),
    ].join("");

    btn.addEventListener("mousedown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick(btn);
        btn.blur();
    });

    return btn;
}

// ── Main render ───────────────────────────────────────────────────────────────

export function renderGroupsPanel(el) {
    el.innerHTML = "";
    el.style.padding = "10px";

    const st = getGroupsStore();
    const bypassTargets = resolveTargets(st.bypass_list, st.sorting_mode);
    const muteTargets = resolveTargets(st.mute_list, st.sorting_mode);

    if (!bypassTargets.length && !muteTargets.length) {
        const msg = document.createElement("div");
        msg.textContent = "List the Group and Nodes names or Nodes IDs in the Grp Settings panel.";
        msg.style.cssText = "padding:12px 0;font-size:13px;opacity:0.7;";
        el.appendChild(msg);
        return;
    }

    if (bypassTargets.length) {
        el.appendChild(mkLabel("Groups and Nodes to Bypass:"));
        for (const target of bypassTargets) {
            const active = isActive(target);
            const btn = mkToggleBtn(target.label, active, target, (btn) => {
                toggle(target, 2);
                const nowActive = isActive(target);
                btn.style.cssText = btn.style.cssText.replace(/background:[^;]+;/g, "").replace(/border-color:[^;]+;/g, "").replace(/color:[^;]+;/g, "");
                btn.style.cssText += colorStyles(target, nowActive);
            });
            el.appendChild(btn);
        }
    }

    if (muteTargets.length) {
        el.appendChild(mkLabel("Groups and Nodes to Mute:"));
        for (const target of muteTargets) {
            const active = isActive(target);
            const btn = mkToggleBtn(target.label, active, target, (btn) => {
                toggle(target, 4);
                const nowActive = isActive(target);
                btn.style.cssText = btn.style.cssText.replace(/background:[^;]+;/g, "").replace(/border-color:[^;]+;/g, "").replace(/color:[^;]+;/g, "");
                btn.style.cssText += colorStyles(target, nowActive);
            });
            el.appendChild(btn);
        }
    }
}
