import { app } from "../../../scripts/app.js";

function isNodeActive(node) {
    const mode = node.mode ?? 0;
    const flags = node.flags || {};
    const isMuted    = mode === 2 || !!flags.muted    || !!flags.mute;
    const isBypassed = mode === 4 || !!flags.bypassed || !!flags.bypass;
    return !(isMuted || isBypassed);
}

function getNodesInGroup(graph, group) {
    const allNodes = graph._nodes || [];
    const [gx, gy] = group.pos  || [0, 0];
    const [gw, gh] = group.size || [0, 0];
    return allNodes.filter((n) => {
        if (!n?.pos) return false;
        const [nx, ny] = n.pos;
        return nx >= gx && ny >= gy && nx <= gx + gw && ny <= gy + gh;
    });
}

function resolveActiveState(graph, node) {
    const patternWidget = node.widgets?.find((w) => w.name === "group_name_contains");
    const tokens = String(patternWidget?.value || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

    if (tokens.length === 0) return false;

    const groups = (graph._groups || []).filter((g) =>
        tokens.some((t) => (g.title || "").includes(t))
    );

    for (const g of groups) {
        for (const n of getNodesInGroup(graph, g)) {
            if (n === node) continue;
            if (isNodeActive(n)) return true;
        }
    }
    return false;
}

const HANDLED_CLASSES = new Set([
    "AKIsOneOfGroupsActive",
    "AKIfElseIsOneOfGroupsActive",
]);

function updateNode(graph, node) {
    if (!node.widgets) return;

    const activeWidget = node.widgets.find((w) => w.name === "active_state");
    if (!activeWidget) return;

    if (!activeWidget._isHiddenConfigured) {
        activeWidget._isHiddenConfigured = true;
        activeWidget.hidden = true;
        activeWidget.computeSize = () => [0, 0];
    }

    activeWidget.value = resolveActiveState(graph, node);
}

app.registerExtension({
    name: "akawana.AKIsOneOfGroupsActive",

    init() {
        const origQueuePrompt = app.queuePrompt;
        app.queuePrompt = async function (number, batchSize, ...rest) {
            const graph = app.graph;
            if (graph) {
                for (const node of graph._nodes || []) {
                    if (HANDLED_CLASSES.has(node?.comfyClass)) {
                        updateNode(graph, node);
                    }
                }
            }
            return await origQueuePrompt.call(this, number, batchSize, ...rest);
        };
    },

    nodeCreated(node) {
        if (!HANDLED_CLASSES.has(node?.comfyClass)) return;
        const activeWidget = node.widgets?.find((w) => w.name === "active_state");
        if (activeWidget) {
            activeWidget.hidden = true;
            activeWidget.computeSize = () => [0, 0];
            activeWidget._isHiddenConfigured = true;
        }
    },
});
