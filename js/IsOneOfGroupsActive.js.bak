import { app } from "../../../scripts/app.js";

function isNodeActive(node) {
    const flags = node.flags || {};
    const mode = node.mode ?? 0;

    const isMuted =
        mode === 2 ||
        !!flags.muted ||
        !!flags.mute;

    const isBypassed =
        mode === 4 ||
        !!flags.bypassed ||
        !!flags.bypass;

    const active = !(isMuted || isBypassed);
    return active;
}

function getNodesInGroup(graph, group) {
    const allNodes = graph._nodes || [];

    const pos = group.pos || [0, 0];
    const size = group.size || [0, 0];

    const gx = pos[0] ?? 0;
    const gy = pos[1] ?? 0;
    const gw = size[0] ?? 0;
    const gh = size[1] ?? 0;

    const nodesByPosSize = allNodes.filter((n) => {
        if (!n || !n.pos) return false;
        const nx = n.pos[0];
        const ny = n.pos[1];
        return nx >= gx && ny >= gy && nx <= gx + gw && ny <= gy + gh;
    });

    return nodesByPosSize;
}

function updateIsOneOfGroupsActiveNode(graph, node) {
    if (!node.widgets) return;

    const patternWidget = node.widgets.find((w) => w.name === "group_name_contains");
    const activeWidget = node.widgets.find((w) => w.name === "active_state");

    if (!activeWidget) return;

    if (!activeWidget._isHiddenConfigured) {
        activeWidget._isHiddenConfigured = true;
        activeWidget.hidden = true;
        activeWidget.computeSize = () => [0, 0];
    }

    const rawText = (patternWidget?.value || "");
    const groups = graph._groups || [];

    // Support multiple comma-separated patterns: "A, B, C"
    const tokens = String(rawText)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

    const matchedGroups = groups.filter((g) => {
        const title = g.title || "";
        if (tokens.length === 0) return false;
        // substring match: if ANY token matches the group title -> matched
        return tokens.some((t) => title.includes(t));
    });
    let anyActive = false;

    if (matchedGroups.length > 0) {
        for (const g of matchedGroups) {
            const nodesInGroup = getNodesInGroup(graph, g);

            for (const n of nodesInGroup) {
                if (n === node) continue;
                if (isNodeActive(n)) {
                    anyActive = true;
                    break;
                }
            }
            if (anyActive) break;
        }
    }

    activeWidget.value = anyActive;
}

app.registerExtension({
    name: "akawana.IsOneOfGroupsActive",

    init() {
        const origQueuePrompt = app.queuePrompt;
        app.queuePrompt = async function (number, batchSize, ...rest) {
            const graph = app.graph;
            if (graph) {
                const nodes = graph._nodes || [];
                for (const node of nodes) {
                    if (node?.comfyClass === "IsOneOfGroupsActive") {
                        updateIsOneOfGroupsActiveNode(graph, node);
                    }
                }
            }
            return await origQueuePrompt.call(this, number, batchSize, ...rest);
        };
    },

    nodeCreated(node) {
        if (node?.comfyClass !== "IsOneOfGroupsActive") return;
        if (!node.widgets) return;

        const activeWidget = node.widgets.find((w) => w.name === "active_state");
        if (activeWidget) {
            activeWidget.hidden = true;
            activeWidget.computeSize = () => [0, 0];
            activeWidget._isHiddenConfigured = true;
        }
    },
});
